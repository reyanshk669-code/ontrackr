from flask import Blueprint, request, jsonify, g
from datetime import date, datetime, timezone
from database import SessionLocal
from models import Habit, CheckIn
from services.scoring import calculate_habit_metrics

checkins_bp = Blueprint('checkins', __name__, url_prefix='/api/checkins')

def get_current_user_id():
    return getattr(g, 'user_id', None) or request.headers.get('X-User-Id') or request.args.get('user_id') or 'guest'

@checkins_bp.route('/toggle', methods=['POST'])
def toggle_checkin():
    """
    3-State Check-In Cycle:
    COMPLETED -> SKIPPED (Rest Day) -> UNCHECKED
    """
    data = request.get_json() or {}
    habit_id = data.get('habit_id')
    date_str = data.get('checkin_date')

    if not habit_id or not date_str:
        return jsonify({"status": "error", "message": "habit_id and checkin_date required"}), 400

    try:
        check_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"status": "error", "message": "Invalid date format, use YYYY-MM-DD"}), 400

    current_uid = get_current_user_id()
    db = SessionLocal()
    try:
        habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == current_uid).first()
        if not habit:
            return jsonify({"status": "error", "message": "Habit not found"}), 404

        checkin = db.query(CheckIn).filter(
            CheckIn.habit_id == habit_id,
            CheckIn.checkin_date == check_date
        ).first()

        next_status = "COMPLETED"
        next_value = habit.target_value
        next_note = None

        if checkin is None:
            # 1. UNCHECKED -> COMPLETED
            checkin = CheckIn(
                habit_id=habit_id,
                checkin_date=check_date,
                status="COMPLETED",
                value_completed=habit.target_value,
                note=None,
                updated_at=datetime.now(timezone.utc)
            )
            db.add(checkin)
        else:
            if checkin.status == "COMPLETED":
                # 2. COMPLETED -> SKIPPED (Rest / Freeze Day)
                checkin.status = "SKIPPED"
                checkin.value_completed = 0.0
                next_status = "SKIPPED"
                next_value = 0.0
                next_note = checkin.note
            elif checkin.status == "SKIPPED":
                # 3. SKIPPED -> UNCHECKED (Delete record)
                db.delete(checkin)
                db.commit()
                # Compute updated metrics
                metrics = calculate_habit_metrics(habit, habit.check_ins)
                return jsonify({
                    "status": "success",
                    "action": "deleted",
                    "checkin": {
                        "habit_id": habit_id,
                        "checkin_date": date_str,
                        "status": "UNCHECKED",
                        "value_completed": 0.0,
                        "note": ""
                    },
                    "metrics": metrics
                })
            else:
                # Any other status (e.g. MISSED, PARTIAL) -> COMPLETED
                checkin.status = "COMPLETED"
                checkin.value_completed = habit.target_value
                next_status = "COMPLETED"
                next_value = habit.target_value
                next_note = checkin.note

            checkin.updated_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(habit)
        metrics = calculate_habit_metrics(habit, habit.check_ins)

        return jsonify({
            "status": "success",
            "action": "saved",
            "checkin": checkin.to_dict(),
            "metrics": metrics
        })
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        db.close()

@checkins_bp.route('/save', methods=['POST'])
def save_checkin():
    """Explicitly save status, value, and note for measurable or detailed check-in."""
    data = request.get_json() or {}
    habit_id = data.get('habit_id')
    date_str = data.get('checkin_date')
    status = data.get('status', 'COMPLETED')
    value_completed = float(data.get('value_completed', 0.0) or 0.0)
    note = data.get('note')

    if not habit_id or not date_str:
        return jsonify({"status": "error", "message": "habit_id and checkin_date required"}), 400

    try:
        check_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"status": "error", "message": "Invalid date format, use YYYY-MM-DD"}), 400

    current_uid = get_current_user_id()
    db = SessionLocal()
    try:
        habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == current_uid).first()
        if not habit:
            return jsonify({"status": "error", "message": "Habit not found"}), 404

        checkin = db.query(CheckIn).filter(
            CheckIn.habit_id == habit_id,
            CheckIn.checkin_date == check_date
        ).first()

        # Auto-compute status if measurable and status is not SKIPPED
        if status != "SKIPPED":
            if value_completed >= habit.target_value:
                status = "COMPLETED"
            elif value_completed > 0:
                status = "PARTIAL"
            else:
                status = "MISSED"

        if checkin:
            checkin.status = status
            checkin.value_completed = value_completed
            if note is not None:
                checkin.note = note.strip()
            checkin.updated_at = datetime.now(timezone.utc)
        else:
            checkin = CheckIn(
                habit_id=habit_id,
                checkin_date=check_date,
                status=status,
                value_completed=value_completed,
                note=note.strip() if note else None,
                updated_at=datetime.now(timezone.utc)
            )
            db.add(checkin)

        db.commit()
        db.refresh(habit)
        metrics = calculate_habit_metrics(habit, habit.check_ins)

        return jsonify({
            "status": "success",
            "checkin": checkin.to_dict(),
            "metrics": metrics
        })
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        db.close()

@checkins_bp.route('/log-time', methods=['POST'])
def log_time():
    """
    Auto-logging from Built-in Pomodoro/Stopwatch Study Timer:
    - Increments today's value_completed
    - Auto-marks COMPLETED if daily target reached
    - Updates study revision note
    """
    data = request.get_json() or {}
    habit_id = data.get('habit_id')
    elapsed_minutes = float(data.get('elapsed_minutes', 0.0) or 0.0)
    note = data.get('note', '').strip()
    date_str = data.get('checkin_date', date.today().isoformat())

    if not habit_id or elapsed_minutes <= 0:
        return jsonify({"status": "error", "message": "Valid habit_id and positive elapsed_minutes required"}), 400

    try:
        check_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"status": "error", "message": "Invalid date format, use YYYY-MM-DD"}), 400

    current_uid = get_current_user_id()
    db = SessionLocal()
    try:
        habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == current_uid).first()
        if not habit:
            return jsonify({"status": "error", "message": "Habit not found"}), 404

        checkin = db.query(CheckIn).filter(
            CheckIn.habit_id == habit_id,
            CheckIn.checkin_date == check_date
        ).first()

        current_val = float(checkin.value_completed or 0.0) if checkin else 0.0
        new_val = round(current_val + elapsed_minutes, 1)

        # Status evaluation
        status = "COMPLETED" if new_val >= habit.target_value else "PARTIAL"

        # Combine notes if existing
        combined_note = note
        if checkin and checkin.note:
            if note and note not in checkin.note:
                combined_note = f"{checkin.note}; {note}"
            else:
                combined_note = checkin.note

        if checkin:
            checkin.value_completed = new_val
            checkin.status = status
            if combined_note:
                checkin.note = combined_note
            checkin.updated_at = datetime.now(timezone.utc)
        else:
            checkin = CheckIn(
                habit_id=habit_id,
                checkin_date=check_date,
                status=status,
                value_completed=new_val,
                note=combined_note or None,
                updated_at=datetime.now(timezone.utc)
            )
            db.add(checkin)

        db.commit()
        db.refresh(habit)
        metrics = calculate_habit_metrics(habit, habit.check_ins)

        return jsonify({
            "status": "success",
            "message": f"Logged {elapsed_minutes} mins to '{habit.name}'",
            "checkin": checkin.to_dict(),
            "metrics": metrics
        })
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        db.close()

@checkins_bp.route('/note', methods=['POST'])
def update_note():
    """Quick 1-line micro-note update for a habit on a date."""
    data = request.get_json() or {}
    habit_id = data.get('habit_id')
    date_str = data.get('checkin_date')
    note = data.get('note', '').strip()

    if not habit_id or not date_str:
        return jsonify({"status": "error", "message": "habit_id and checkin_date required"}), 400

    try:
        check_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"status": "error", "message": "Invalid date format, use YYYY-MM-DD"}), 400

    db = SessionLocal()
    try:
        checkin = db.query(CheckIn).filter(
            CheckIn.habit_id == habit_id,
            CheckIn.checkin_date == check_date
        ).first()

        if not checkin:
            # Create a completed or default checkin
            current_uid = get_current_user_id()
            habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == current_uid).first()
            if not habit:
                return jsonify({"status": "error", "message": "Habit not found"}), 404
            checkin = CheckIn(
                habit_id=habit_id,
                checkin_date=check_date,
                status="COMPLETED",
                value_completed=habit.target_value,
                note=note,
                updated_at=datetime.now(timezone.utc)
            )
            db.add(checkin)
        else:
            checkin.note = note
            checkin.updated_at = datetime.now(timezone.utc)

        db.commit()
        return jsonify({"status": "success", "checkin": checkin.to_dict()})
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        db.close()

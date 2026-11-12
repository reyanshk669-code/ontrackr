from flask import Blueprint, request, jsonify, Response, g
from datetime import date, datetime, timezone
import json
import csv
import io
from database import SessionLocal
from models import Habit, CheckIn, Milestone
from services.seed_data import seed_sample_data

backup_bp = Blueprint('backup', __name__, url_prefix='/api/backup')

def get_current_user_id():
    return getattr(g, 'user_id', None) or request.headers.get('X-User-Id') or request.args.get('user_id') or 'guest'

@backup_bp.route('/export-json', methods=['GET'])
def export_json():
    """Export complete database backup as JSON for current user."""
    db = SessionLocal()
    try:
        current_uid = get_current_user_id()
        habits = db.query(Habit).filter(Habit.user_id == current_uid).all()
        habit_ids = [h.id for h in habits]
        checkins = db.query(CheckIn).filter(CheckIn.habit_id.in_(habit_ids)).all() if habit_ids else []
        milestones = db.query(Milestone).filter(Milestone.user_id == current_uid).all()

        data = {
            "version": "1.0",
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "habits": [h.to_dict() for h in habits],
            "check_ins": [c.to_dict() for c in checkins],
            "milestones": [m.to_dict() for m in milestones]
        }

        json_str = json.dumps(data, indent=2)
        filename = f"habitwall_backup_{date.today().isoformat()}.json"
        return Response(
            json_str,
            mimetype="application/json",
            headers={"Content-Disposition": f"attachment;filename={filename}"}
        )
    finally:
        db.close()

@backup_bp.route('/export-csv', methods=['GET'])
def export_csv():
    """Export all check-in history as CSV."""
    db = SessionLocal()
    try:
        current_uid = get_current_user_id()
        checkins = db.query(CheckIn).join(Habit).filter(Habit.user_id == current_uid).order_by(CheckIn.checkin_date.desc(), Habit.id.asc()).all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["CheckIn_ID", "Habit_ID", "Habit_Name", "Category", "Date", "Status", "Value_Completed", "Unit", "Note", "Updated_At"])

        for c in checkins:
            writer.writerow([
                c.id,
                c.habit_id,
                c.habit.name if c.habit else "",
                c.habit.category if c.habit else "",
                c.checkin_date.isoformat() if isinstance(c.checkin_date, (date, datetime)) else str(c.checkin_date),
                c.status,
                c.value_completed,
                c.habit.unit if c.habit else "",
                c.note or "",
                c.updated_at.isoformat() if c.updated_at else ""
            ])

        csv_str = output.getvalue()
        filename = f"habitwall_checkins_{date.today().isoformat()}.csv"
        return Response(
            csv_str,
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment;filename={filename}"}
        )
    finally:
        db.close()

@backup_bp.route('/import-json', methods=['POST'])
def import_json():
    """Restore database from JSON backup file."""
    if 'file' not in request.files and not request.is_json:
        return jsonify({"status": "error", "message": "No file or JSON data provided"}), 400

    try:
        if 'file' in request.files:
            file = request.files['file']
            data = json.load(file)
        else:
            data = request.get_json()
    except Exception as e:
        return jsonify({"status": "error", "message": f"Invalid JSON file: {str(e)}"}), 400

    if not isinstance(data, dict) or "habits" not in data:
        return jsonify({"status": "error", "message": "Invalid backup format: missing 'habits' key"}), 400

    db = SessionLocal()
    try:
        # Clear existing
        db.query(CheckIn).delete()
        db.query(Habit).delete()
        db.query(Milestone).delete()
        db.commit()

        # Map old habit id to new habit id
        habit_id_map = {}

        # 1. Restore Habits
        for h_data in data.get("habits", []):
            old_id = h_data.get("id")
            c_at = datetime.fromisoformat(h_data["created_at"]) if h_data.get("created_at") else datetime.now(timezone.utc)
            habit = Habit(
                name=h_data.get("name", "Untitled"),
                category=h_data.get("category", "General"),
                hex_color=h_data.get("hex_color", "#4F46E5"),
                habit_type=h_data.get("habit_type", "BOOLEAN"),
                target_value=float(h_data.get("target_value", 1.0) or 1.0),
                unit=h_data.get("unit", ""),
                frequency_type=h_data.get("frequency_type", "DAILY"),
                frequency_data=h_data.get("frequency_data", "0,1,2,3,4,5,6"),
                scheduled_time_slot=h_data.get("scheduled_time_slot", ""),
                is_priority_crunch=bool(h_data.get("is_priority_crunch", False)),
                is_archived=bool(h_data.get("is_archived", False)),
                created_at=c_at
            )
            db.add(habit)
            db.flush()
            if old_id is not None:
                habit_id_map[old_id] = habit.id

        # 2. Restore Check-Ins
        for c_data in data.get("check_ins", []):
            old_h_id = c_data.get("habit_id")
            new_h_id = habit_id_map.get(old_h_id)
            if not new_h_id:
                continue

            c_date_raw = c_data.get("checkin_date")
            c_date = datetime.strptime(c_date_raw, "%Y-%m-%d").date() if isinstance(c_date_raw, str) else date.today()

            checkin = CheckIn(
                habit_id=new_h_id,
                checkin_date=c_date,
                status=c_data.get("status", "COMPLETED"),
                value_completed=float(c_data.get("value_completed", 0.0) or 0.0),
                note=c_data.get("note"),
                updated_at=datetime.now(timezone.utc)
            )
            db.add(checkin)

        # 3. Restore Milestones
        for m_data in data.get("milestones", []):
            t_date_raw = m_data.get("target_date")
            t_date = datetime.strptime(t_date_raw, "%Y-%m-%d").date() if isinstance(t_date_raw, str) else date.today()
            m = Milestone(
                title=m_data.get("title", "Exam"),
                target_date=t_date,
                category=m_data.get("category", "Exam"),
                crunch_mode_active=bool(m_data.get("crunch_mode_active", False))
            )
            db.add(m)

        db.commit()
        return jsonify({
            "status": "success",
            "message": f"Successfully restored {len(data.get('habits', []))} habits and {len(data.get('check_ins', []))} check-ins."
        })
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        db.close()

@backup_bp.route('/seed-demo', methods=['POST'])
def trigger_seed_demo():
    """Populate database with sample student data."""
    try:
        res = seed_sample_data(force=True)
        return jsonify(res)
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@backup_bp.route('/reset', methods=['POST'])
def reset_database():
    """Wipe database clean."""
    db = SessionLocal()
    try:
        db.query(CheckIn).delete()
        db.query(Habit).delete()
        db.query(Milestone).delete()
        db.commit()
        return jsonify({"status": "success", "message": "All habits and check-ins have been wiped."})
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        db.close()

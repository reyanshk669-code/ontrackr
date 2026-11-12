from flask import Blueprint, request, jsonify, g
from datetime import date, datetime, timedelta, timezone
from database import SessionLocal
from models import Habit, CheckIn
from services.scoring import calculate_habit_metrics

habits_bp = Blueprint('habits', __name__, url_prefix='/api/habits')

def get_current_user_id():
    return getattr(g, 'user_id', None) or request.headers.get('X-User-Id') or request.args.get('user_id') or 'guest'

@habits_bp.route('', methods=['GET'])
def list_habits():
    db = SessionLocal()
    try:
        current_uid = get_current_user_id()
        category = request.args.get('category')
        crunch_only = request.args.get('crunch') == '1'
        include_archived = request.args.get('archived') == '1'

        query = db.query(Habit).filter(Habit.user_id == current_uid)
        if not include_archived:
            query = query.filter(Habit.is_archived == False)
        if category and category != 'All':
            query = query.filter(Habit.category == category)
        if crunch_only:
            query = query.filter(Habit.is_priority_crunch == True)

        habits = query.order_by(Habit.is_priority_crunch.desc(), Habit.id.asc()).all()

        today = date.today()
        # Compute dates for the last 7 days (today down to today-6)
        seven_days = [today - timedelta(days=i) for i in range(6, -1, -1)]
        seven_days_str = [d.isoformat() for d in seven_days]

        result = []
        for h in habits:
            h_dict = h.to_dict()
            metrics = calculate_habit_metrics(h, h.check_ins, today)
            h_dict['metrics'] = metrics

            # Build 7-day map
            checkin_lookup = {}
            for c in h.check_ins:
                c_date = c.checkin_date.isoformat() if isinstance(c.checkin_date, date) else str(c.checkin_date)
                if c_date in seven_days_str:
                    checkin_lookup[c_date] = c.to_dict()

            seven_days_data = []
            for d_str in seven_days_str:
                if d_str in checkin_lookup:
                    seven_days_data.append(checkin_lookup[d_str])
                else:
                    seven_days_data.append({
                        "habit_id": h.id,
                        "checkin_date": d_str,
                        "status": "UNCHECKED",
                        "value_completed": 0.0,
                        "note": ""
                    })

            h_dict['seven_days'] = seven_days_data
            result.append(h_dict)

        # Collect distinct categories for this user
        all_cats = [r[0] for r in db.query(Habit.category).filter(Habit.user_id == current_uid).distinct().all() if r[0]]

        return jsonify({
            "status": "success",
            "habits": result,
            "categories": sorted(list(set(["All"] + all_cats))),
            "dates": [
                {
                    "date": d.isoformat(),
                    "day_name": d.strftime("%a"),
                    "day_num": d.strftime("%d"),
                    "is_today": (d == today)
                } for d in seven_days
            ]
        })
    finally:
        db.close()

@habits_bp.route('', methods=['POST'])
def create_habit():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    if not name:
        return jsonify({"status": "error", "message": "Habit name is required."}), 400

    current_uid = get_current_user_id()
    db = SessionLocal()
    try:
        habit = Habit(
            user_id=current_uid,
            name=name,
            category=data.get('category', 'General').strip() or 'General',
            hex_color=data.get('hex_color', '#4F46E5'),
            habit_type=data.get('habit_type', 'BOOLEAN'),
            target_value=float(data.get('target_value', 1.0) or 1.0),
            unit=data.get('unit', '').strip(),
            frequency_type=data.get('frequency_type', 'DAILY'),
            frequency_data=data.get('frequency_data', '0,1,2,3,4,5,6'),
            scheduled_time_slot=data.get('scheduled_time_slot', '').strip(),
            is_priority_crunch=bool(data.get('is_priority_crunch', False)),
            is_archived=False,
            created_at=datetime.now(timezone.utc)
        )
        db.add(habit)
        db.commit()
        db.refresh(habit)
        return jsonify({"status": "success", "habit": habit.to_dict()}), 201
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        db.close()

@habits_bp.route('/<int:habit_id>', methods=['GET'])
def get_habit(habit_id):
    db = SessionLocal()
    try:
        current_uid = get_current_user_id()
        habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == current_uid).first()
        if not habit:
            return jsonify({"status": "error", "message": "Habit not found"}), 404
        metrics = calculate_habit_metrics(habit, habit.check_ins)
        h_dict = habit.to_dict()
        h_dict['metrics'] = metrics
        return jsonify({"status": "success", "habit": h_dict})
    finally:
        db.close()

@habits_bp.route('/<int:habit_id>', methods=['PUT'])
def update_habit(habit_id):
    data = request.get_json() or {}
    db = SessionLocal()
    try:
        current_uid = get_current_user_id()
        habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == current_uid).first()
        if not habit:
            return jsonify({"status": "error", "message": "Habit not found"}), 404

        if 'name' in data:
            habit.name = data['name'].strip()
        if 'category' in data:
            habit.category = data['category'].strip()
        if 'hex_color' in data:
            habit.hex_color = data['hex_color']
        if 'habit_type' in data:
            habit.habit_type = data['habit_type']
        if 'target_value' in data:
            habit.target_value = float(data['target_value'] or 1.0)
        if 'unit' in data:
            habit.unit = data['unit'].strip()
        if 'frequency_type' in data:
            habit.frequency_type = data['frequency_type']
        if 'frequency_data' in data:
            habit.frequency_data = data['frequency_data']
        if 'scheduled_time_slot' in data:
            habit.scheduled_time_slot = data['scheduled_time_slot'].strip()
        if 'is_priority_crunch' in data:
            habit.is_priority_crunch = bool(data['is_priority_crunch'])
        if 'is_archived' in data:
            habit.is_archived = bool(data['is_archived'])

        db.commit()
        db.refresh(habit)
        return jsonify({"status": "success", "habit": habit.to_dict()})
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        db.close()

@habits_bp.route('/<int:habit_id>', methods=['DELETE'])
def delete_habit(habit_id):
    db = SessionLocal()
    try:
        current_uid = get_current_user_id()
        habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == current_uid).first()
        if not habit:
            return jsonify({"status": "error", "message": "Habit not found"}), 404
        db.delete(habit)
        db.commit()
        return jsonify({"status": "success", "message": "Habit deleted"})
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        db.close()

@habits_bp.route('/<int:habit_id>/archive', methods=['POST'])
def toggle_archive(habit_id):
    db = SessionLocal()
    try:
        current_uid = get_current_user_id()
        habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == current_uid).first()
        if not habit:
            return jsonify({"status": "error", "message": "Habit not found"}), 404
        habit.is_archived = not habit.is_archived
        db.commit()
        return jsonify({"status": "success", "is_archived": habit.is_archived})
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        db.close()

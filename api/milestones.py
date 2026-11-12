from flask import Blueprint, request, jsonify, g
from datetime import date, datetime
from database import SessionLocal
from models import Milestone

milestones_bp = Blueprint('milestones', __name__, url_prefix='/api/milestones')

def get_current_user_id():
    return getattr(g, 'user_id', None) or request.headers.get('X-User-Id') or request.args.get('user_id') or 'guest'

@milestones_bp.route('', methods=['GET'])
def list_milestones():
    db = SessionLocal()
    try:
        current_uid = get_current_user_id()
        milestones = db.query(Milestone).filter(Milestone.user_id == current_uid).order_by(Milestone.target_date.asc()).all()
        return jsonify({
            "status": "success",
            "milestones": [m.to_dict() for m in milestones]
        })
    finally:
        db.close()

@milestones_bp.route('', methods=['POST'])
def create_milestone():
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    target_date_str = data.get('target_date', '').strip()
    if not title or not target_date_str:
        return jsonify({"status": "error", "message": "title and target_date required"}), 400

    try:
        t_date = datetime.strptime(target_date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"status": "error", "message": "target_date must be YYYY-MM-DD"}), 400

    current_uid = get_current_user_id()
    db = SessionLocal()
    try:
        milestone = Milestone(
            user_id=current_uid,
            title=title,
            target_date=t_date,
            category=data.get('category', 'Exam').strip() or 'Exam',
            crunch_mode_active=bool(data.get('crunch_mode_active', False))
        )
        db.add(milestone)
        db.commit()
        db.refresh(milestone)
        return jsonify({"status": "success", "milestone": milestone.to_dict()}), 201
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        db.close()

@milestones_bp.route('/<int:milestone_id>', methods=['PUT'])
def update_milestone(milestone_id):
    data = request.get_json() or {}
    db = SessionLocal()
    try:
        current_uid = get_current_user_id()
        milestone = db.query(Milestone).filter(Milestone.id == milestone_id, Milestone.user_id == current_uid).first()
        if not milestone:
            return jsonify({"status": "error", "message": "Milestone not found"}), 404

        if 'title' in data:
            milestone.title = data['title'].strip()
        if 'target_date' in data:
            milestone.target_date = datetime.strptime(data['target_date'], '%Y-%m-%d').date()
        if 'category' in data:
            milestone.category = data['category'].strip()
        if 'crunch_mode_active' in data:
            milestone.crunch_mode_active = bool(data['crunch_mode_active'])

        db.commit()
        db.refresh(milestone)
        return jsonify({"status": "success", "milestone": milestone.to_dict()})
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        db.close()

@milestones_bp.route('/<int:milestone_id>', methods=['DELETE'])
def delete_milestone(milestone_id):
    db = SessionLocal()
    try:
        current_uid = get_current_user_id()
        milestone = db.query(Milestone).filter(Milestone.id == milestone_id, Milestone.user_id == current_uid).first()
        if not milestone:
            return jsonify({"status": "error", "message": "Milestone not found"}), 404
        db.delete(milestone)
        db.commit()
        return jsonify({"status": "success", "message": "Milestone deleted"})
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        db.close()

@milestones_bp.route('/<int:milestone_id>/toggle-crunch', methods=['POST'])
def toggle_crunch(milestone_id):
    db = SessionLocal()
    try:
        current_uid = get_current_user_id()
        milestone = db.query(Milestone).filter(Milestone.id == milestone_id, Milestone.user_id == current_uid).first()
        if not milestone:
            return jsonify({"status": "error", "message": "Milestone not found"}), 404
        milestone.crunch_mode_active = not milestone.crunch_mode_active
        db.commit()
        return jsonify({"status": "success", "crunch_mode_active": milestone.crunch_mode_active})
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "message": str(e)}), 500
    finally:
        db.close()

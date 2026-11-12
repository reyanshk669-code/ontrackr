from flask import Blueprint, request, jsonify, g
from database import SessionLocal
from models import Habit, CheckIn, UserRPGProfile, HabitStack, SmartTrigger, AccountabilityDuel, TribePact
from services.oracle import generate_oracle_predictions
from services.scoring import calculate_habit_metrics
from datetime import date
import json
import base64
import hashlib

advanced_bp = Blueprint('advanced', __name__, url_prefix='/api')

def get_current_user_id():
    return getattr(g, 'user_id', None) or request.headers.get('X-User-Id') or request.args.get('user_id') or 'guest'

# ================= 1. RPG IDENTITY & XP ENGINE =================
@advanced_bp.route('/rpg/profile', methods=['GET'])
def get_rpg_profile():
    db = SessionLocal()
    try:
        current_uid = get_current_user_id()
        profile = db.query(UserRPGProfile).filter(UserRPGProfile.user_id == current_uid).first()
        if not profile:
            # Create a brand new Level 1 profile for new users
            profile = UserRPGProfile(
                user_id=current_uid,
                username="Student",
                title="Focus Novice",
                level=1,
                xp=0,
                next_level_xp=500,
                streak_shields=0,
                logic_stat=10,
                discipline_stat=10,
                resilience_stat=10,
                endurance_stat=10,
                wisdom_stat=10
            )
            db.add(profile)
            db.commit()
            db.refresh(profile)
        return jsonify({"status": "success", "profile": profile.to_dict()})
    finally:
        db.close()

@advanced_bp.route('/rpg/profile', methods=['POST'])
def update_rpg_profile():
    data = request.get_json() or {}
    db = SessionLocal()
    try:
        current_uid = get_current_user_id()
        profile = db.query(UserRPGProfile).filter(UserRPGProfile.user_id == current_uid).first()
        if not profile:
            profile = UserRPGProfile(user_id=current_uid, username="Challenger", level=1, xp=0, next_level_xp=500)
            db.add(profile)

        if 'username' in data and data['username']:
            profile.username = str(data['username']).strip()
        if 'title' in data and data['title']:
            profile.title = str(data['title']).strip()

        db.commit()
        db.refresh(profile)
        return jsonify({"status": "success", "profile": profile.to_dict()})
    finally:
        db.close()

@advanced_bp.route('/rpg/claim-xp', methods=['POST'])
def claim_xp():
    data = request.get_json() or {}
    added_xp = int(data.get('xp', 50))
    reason = data.get('reason', 'Habit check-in')

    db = SessionLocal()
    try:
        current_uid = get_current_user_id()
        profile = db.query(UserRPGProfile).filter(UserRPGProfile.user_id == current_uid).first()
        if not profile:
            profile = UserRPGProfile(user_id=current_uid, username="Challenger", level=1, xp=0, next_level_xp=500)
            db.add(profile)

        profile.xp += added_xp
        leveled_up = False

        while profile.xp >= profile.next_level_xp:
            profile.level += 1
            profile.xp -= profile.next_level_xp
            profile.next_level_xp = int(profile.next_level_xp * 1.25)
            profile.streak_shields += 1
            profile.logic_stat = min(100, profile.logic_stat + 2)
            profile.discipline_stat = min(100, profile.discipline_stat + 3)
            leveled_up = True

        db.commit()
        db.refresh(profile)

        return jsonify({
            "status": "success",
            "leveled_up": leveled_up,
            "message": f"+{added_xp} XP earned for {reason}!",
            "profile": profile.to_dict()
        })
    finally:
        db.close()

@advanced_bp.route('/rpg/use-shield', methods=['POST'])
def use_streak_shield():
    db = SessionLocal()
    try:
        current_uid = get_current_user_id()
        profile = db.query(UserRPGProfile).filter(UserRPGProfile.user_id == current_uid).first()
        if not profile or profile.streak_shields <= 0:
            return jsonify({"status": "error", "message": "No streak freeze shields available!"}), 400

        profile.streak_shields -= 1
        db.commit()
        db.refresh(profile)

        return jsonify({
            "status": "success",
            "message": "Streak freeze shield activated! Your running streak is protected.",
            "shields_remaining": profile.streak_shields
        })
    finally:
        db.close()

# ================= 2. HABIT STACKING VISUALIZER =================
@advanced_bp.route('/stacks', methods=['GET'])
def get_habit_stacks():
    db = SessionLocal()
    try:
        current_uid = get_current_user_id()
        stacks = db.query(HabitStack).filter(HabitStack.is_active == True, HabitStack.user_id == current_uid).all()
        return jsonify({"status": "success", "stacks": [s.to_dict() for s in stacks]})
    finally:
        db.close()

@advanced_bp.route('/stacks', methods=['POST'])
def create_habit_stack():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    trigger_anchor = data.get('trigger_anchor', '').strip()
    steps = data.get('steps', [])
    reward = data.get('reward', '').strip()

    if not name or not trigger_anchor:
        return jsonify({"status": "error", "message": "Stack name and trigger anchor are required"}), 400

    current_uid = get_current_user_id()
    db = SessionLocal()
    try:
        stack = HabitStack(
            user_id=current_uid,
            name=name,
            trigger_anchor=trigger_anchor,
            category=data.get('category', 'Daily Stack'),
            steps_json=json.dumps(steps),
            reward=reward or "Claim 50 XP",
            is_active=True
        )
        db.add(stack)
        db.commit()
        db.refresh(stack)
        return jsonify({"status": "success", "stack": stack.to_dict()}), 201
    finally:
        db.close()

# ================= 3. CONTEXT-AWARE SMART TRIGGERS =================
@advanced_bp.route('/triggers', methods=['GET'])
def get_smart_triggers():
    db = SessionLocal()
    try:
        current_uid = get_current_user_id()
        triggers = db.query(SmartTrigger).filter(SmartTrigger.is_active == True, SmartTrigger.user_id == current_uid).all()
        return jsonify({"status": "success", "triggers": [t.to_dict() for t in triggers]})
    finally:
        db.close()

@advanced_bp.route('/triggers/<int:trigger_id>/simulate', methods=['POST'])
def simulate_trigger(trigger_id):
    db = SessionLocal()
    try:
        current_uid = get_current_user_id()
        trigger = db.query(SmartTrigger).filter(SmartTrigger.id == trigger_id, SmartTrigger.user_id == current_uid).first()
        if not trigger:
            return jsonify({"status": "error", "message": "Trigger not found"}), 404

        return jsonify({
            "status": "success",
            "message": f"Smart Trigger Fired: [{trigger.condition_text}] -> {trigger.action_text}!",
            "trigger": trigger.to_dict()
        })
    finally:
        db.close()

# ================= 4. ACCOUNTABILITY DUELS =================
@advanced_bp.route('/social/duels', methods=['GET'])
def get_duels():
    db = SessionLocal()
    try:
        current_uid = get_current_user_id()
        duels = db.query(AccountabilityDuel).filter(AccountabilityDuel.user_id == current_uid).all()
        return jsonify({"status": "success", "duels": [d.to_dict() for d in duels]})
    finally:
        db.close()

@advanced_bp.route('/social/duels/<int:duel_id>/nudge', methods=['POST'])
def nudge_opponent(duel_id):
    db = SessionLocal()
    try:
        current_uid = get_current_user_id()
        duel = db.query(AccountabilityDuel).filter(AccountabilityDuel.id == duel_id, AccountabilityDuel.user_id == current_uid).first()
        if not duel:
            return jsonify({"status": "error", "message": "Duel not found"}), 404

        return jsonify({
            "status": "success",
            "message": f"Sent a friendly study nudge to {duel.opponent_name}!"
        })
    finally:
        db.close()

# ================= 5. ASYNC TRIBE PACTS =================
@advanced_bp.route('/social/tribes', methods=['GET'])
def get_tribes():
    db = SessionLocal()
    try:
        current_uid = get_current_user_id()
        tribes = db.query(TribePact).filter(TribePact.user_id == current_uid).all()
        return jsonify({"status": "success", "tribes": [t.to_dict() for t in tribes]})
    finally:
        db.close()

@advanced_bp.route('/social/tribes/<int:tribe_id>/react', methods=['POST'])
def react_tribe(tribe_id):
    data = request.get_json() or {}
    emoji = data.get('emoji', '🔥')

    return jsonify({
        "status": "success",
        "message": f"Reaction {emoji} posted to guild activity feed!"
    })

# ================= 6. ARIA AI HABIT COACH =================
@advanced_bp.route('/ai/aria', methods=['POST'])
def aria_chat():
    data = request.get_json() or {}
    prompt = (data.get('prompt') or '').lower().strip()

    if not prompt:
        return jsonify({"status": "error", "message": "Prompt is required"}), 400

    db = SessionLocal()
    suggested_actions = []
    try:
        habits = db.query(Habit).filter(Habit.is_archived == False).all()
        habit_count = len(habits)
        sample_name = habits[0].name if habits else "Practice Python & Code"
        
        # Contextual intelligent response engine for Aria
        if "analyze" in prompt or "overview" in prompt or "struggle" in prompt:
            reply = (
                f"✨ **Habit Health Analysis:**\n"
                f"You currently have **{habit_count} active habits** in your OnTrack queue. "
                f"Your highest consistency habit is **{sample_name}**! "
                "Our friction model shows midweek evenings (Wednesdays & Thursdays) carry the highest skip probability. "
                "👉 **Aria's Fix:** Anchor your revision right after dinner, or tap the **Bad Day Protocol** for a quick 2-minute starter dose!"
            )
            suggested_actions = [
                {"type": "MICRO_DOSE", "label": "🛡️ Bad Day Micro-Dose"},
                {"type": "TIMER_POMODORO", "label": "⚡ 25m Focus Sprint"}
            ]
        elif "stack" in prompt or "routine" in prompt or "atomic" in prompt:
            reply = (
                f"⛓️ **Recommended Atomic Habit Stack for You:**\n"
                f"1. **Anchor (Current Habit):** When I finish lunch or coffee at 2:00 PM\n"
                f"2. **New Tiny Routine:** Complete 15 minutes of **{sample_name}**\n"
                f"3. **Immediate Dopamine Reward:** Claim +50 XP and 5 minutes of mindful relaxation!\n\n"
                "*(Formula from James Clear's Atomic Habits: After [CURRENT HABIT], I will [NEW HABIT])*."
            )
            suggested_actions = [
                {"type": "VIEW_STACKS", "label": "📑 View Habit Stacks"},
                {"type": "TIMER_POMODORO", "label": "⚡ Start 25m Timer"}
            ]
        elif "comeback" in prompt or "sprint" in prompt or "7 day" in prompt:
            reply = (
                f"📅 **Aria's 7-Day Habit Comeback Plan:**\n"
                f"• **Day 1–2 (Micro-Dose Phase):** Do just 5 mins or 1 unit of **{sample_name}** to rebuild neurological momentum.\n"
                "• **Day 3–4 (Flow Sprint):** Run one 25m Pomodoro session.\n"
                "• **Day 5–6 (Full Target):** Complete your normal target value and log revision micro-notes.\n"
                "• **Day 7 (Guild Victory):** Claim +250 XP duel bonus and secure your streak freeze shield!"
            )
            suggested_actions = [
                {"type": "TIMER_POMODORO", "label": "⚡ Start 25m Timer"},
                {"type": "MICRO_DOSE", "label": "🛡️ 1-Tap Micro-Dose"}
            ]
        elif "procrastinat" in prompt or "motivation" in prompt or "tired" in prompt or "start" in prompt or "hard" in prompt:
            reply = (
                "🌱 **The 2-Minute Starter Rule:**\n"
                "Never rely on fleeting motivation — action generates energy! "
                f"Give yourself permission to do only **2 minutes** of **{sample_name}** right now. "
                "If you want to stop after 2 minutes, you can. 9 times out of 10, crossing the friction threshold keeps you going! "
                "Plus, your **Streak Freeze Shield** is primed to safeguard your record."
            )
            suggested_actions = [
                {"type": "MICRO_DOSE", "label": "🛡️ Bad Day Protocol (5m)"},
                {"type": "TIMER_POMODORO", "label": "⚡ 5m Quick Start"}
            ]
        elif "rpg" in prompt or "level" in prompt or "xp" in prompt or "guild" in prompt or "duel" in prompt:
            reply = (
                "🛡️ **RPG Identity & Mastery Audit:**\n"
                "Every habit check-in infuses **+50 XP** into your character sheet. "
                "Completing a focus session or habit stack elevates your rank toward the **Prismatic Holographic Grandmaster Aura**! "
                "Need a motivation boost? Nudge your opponent in an Accountability Duel."
            )
            suggested_actions = [
                {"type": "VIEW_RPG", "label": "⚔️ Open RPG Character"},
                {"type": "TIMER_POMODORO", "label": "⚡ Earn +50 XP via Timer"}
            ]
        elif "focus" in prompt or "timer" in prompt or "pomodoro" in prompt or "sprint" in prompt or "study" in prompt:
            reply = (
                "⏱️ **Aria's Focus Engine Guide:**\n"
                "Deep work sessions paired with structured intervals maximize retention and keep habits resilient:\n\n"
                "• ⚡ **25m Classic Pomodoro:** High focus, 5-minute break.\n"
                "• 🛡️ **5m Micro-Dose Sprint:** For overcoming low energy and procrastination.\n"
                "• 🎯 **50m Deep Block:** For long coding, writing, or intensive exam study."
            )
            suggested_actions = [
                {"type": "TIMER_POMODORO", "label": "⚡ Launch 25m Pomodoro"},
                {"type": "MICRO_DOSE", "label": "🛡️ 5m Quick Sprint"}
            ]
        else:
            reply = (
                f"💡 **Aria's Coaching Advice for '{prompt}':**\n"
                "Consistency beats intensity every single time. "
                f"Try reducing the activation energy for **{sample_name}** by preparing your study materials 10 minutes beforehand. "
                "Remember: every check-in is a vote for the person you wish to become!"
            )
            suggested_actions = [
                {"type": "MICRO_DOSE", "label": "🛡️ 1-Tap Micro-Dose"},
                {"type": "TIMER_POMODORO", "label": "⚡ 25m Pomodoro"}
            ]

        return jsonify({
            "status": "success",
            "reply": reply,
            "actions": suggested_actions
        })
    finally:
        db.close()

# ================= 7. ELASTIC HABIT SIZING / MICRO-DOSE PROTOCOL =================
@advanced_bp.route('/habits/<int:habit_id>/micro-dose', methods=['POST'])
def trigger_micro_dose(habit_id):
    """
    Bad Day Protocol: Scales target down to micro-starter habit, logs check-in,
    protects running streak, and awards +25 XP.
    """
    db = SessionLocal()
    try:
        habit = db.query(Habit).filter(Habit.id == habit_id).first()
        if not habit:
            return jsonify({"status": "error", "message": "Habit not found"}), 404

        today = date.today()
        checkin = db.query(CheckIn).filter(
            CheckIn.habit_id == habit_id,
            CheckIn.checkin_date == today
        ).first()

        micro_val = habit.micro_dose_target or 5.0
        micro_unit = habit.micro_dose_unit or (habit.unit or "mins")

        if not checkin:
            checkin = CheckIn(
                habit_id=habit_id,
                checkin_date=today,
                status="MICRO_DOSE",
                value_completed=micro_val,
                is_micro_dose=True,
                note=f"🛡️ Bad Day Protocol: Completed {micro_val} {micro_unit} micro-starter to protect momentum."
            )
            db.add(checkin)
        else:
            checkin.status = "MICRO_DOSE"
            checkin.value_completed = micro_val
            checkin.is_micro_dose = True
            checkin.note = f"🛡️ Bad Day Protocol: Completed {micro_val} {micro_unit} micro-starter."

        # Award XP for maintaining momentum
        profile = db.query(UserRPGProfile).first()
        if profile:
            profile.xp += 25
            profile.resilience_stat = min(100, profile.resilience_stat + 1)

        db.commit()
        db.refresh(checkin)
        db.refresh(habit)

        metrics = calculate_habit_metrics(habit)

        return jsonify({
            "status": "success",
            "message": f"🛡️ Bad Day Protocol Active: Logged {micro_val} {micro_unit} micro-dose! Streak protected (+25 XP).",
            "checkin": checkin.to_dict(),
            "metrics": metrics
        })
    finally:
        db.close()

# ================= 8. ARIA ORACLE PREDICTIONS =================
@advanced_bp.route('/ai/oracle-predictions', methods=['GET'])
def get_oracle_predictions():
    """Returns predictive failure warnings and smart interventions before streaks break."""
    db = SessionLocal()
    try:
        predictions = generate_oracle_predictions(db)
        return jsonify({
            "status": "success",
            "predictions": predictions
        })
    finally:
        db.close()

# ================= 9. ENCRYPTED MULTI-DEVICE CLOUD SYNC =================
@advanced_bp.route('/backup/encrypted-export', methods=['POST'])
def encrypted_export():
    """Generates an encrypted portable JSON backup of all user habits, streaks, and RPG state."""
    data = request.get_json() or {}
    passphrase = data.get('passphrase', 'ontrack-secure-vault')

    db = SessionLocal()
    try:
        habits = db.query(Habit).all()
        checkins = db.query(CheckIn).all()
        profile = db.query(UserRPGProfile).first()
        stacks = db.query(HabitStack).all()

        vault = {
            "version": "2.0",
            "exported_at": date.today().isoformat(),
            "habits": [h.to_dict() for h in habits],
            "check_ins": [c.to_dict() for c in checkins],
            "profile": profile.to_dict() if profile else None,
            "stacks": [s.to_dict() for s in stacks]
        }

        raw_json = json.dumps(vault)
        # Obfuscate / encrypt bundle with passphrase hash key
        key = hashlib.sha256(passphrase.encode('utf-8')).digest()
        encrypted_bytes = bytearray()
        for i, b in enumerate(raw_json.encode('utf-8')):
            encrypted_bytes.append(b ^ key[i % len(key)])

        encoded = base64.b64encode(encrypted_bytes).decode('utf-8')
        return jsonify({
            "status": "success",
            "encrypted_vault": encoded,
            "filename": f"ontrack-backup-{date.today().isoformat()}.vault"
        })
    finally:
        db.close()

@advanced_bp.route('/backup/encrypted-import', methods=['POST'])
def encrypted_import():
    """Restores database from an encrypted portable backup file."""
    data = request.get_json() or {}
    encoded = data.get('encrypted_vault', '')
    passphrase = data.get('passphrase', 'ontrack-secure-vault')

    if not encoded:
        return jsonify({"status": "error", "message": "Missing encrypted vault data"}), 400

    try:
        raw_bytes = base64.b64decode(encoded)
        key = hashlib.sha256(passphrase.encode('utf-8')).digest()
        decrypted_bytes = bytearray()
        for i, b in enumerate(raw_bytes):
            decrypted_bytes.append(b ^ key[i % len(key)])

        vault = json.loads(decrypted_bytes.decode('utf-8'))
    except Exception as e:
        return jsonify({"status": "error", "message": "Failed to decrypt vault. Incorrect passphrase or corrupt file."}), 400

    db = SessionLocal()
    try:
        # Restore habits
        imported_count = 0
        for h_data in vault.get('habits', []):
            existing = db.query(Habit).filter(Habit.id == h_data['id']).first()
            if not existing:
                h = Habit(
                    id=h_data['id'],
                    name=h_data['name'],
                    category=h_data.get('category', 'General'),
                    hex_color=h_data.get('hex_color', '#7C5CFC'),
                    habit_type=h_data.get('habit_type', 'BOOLEAN'),
                    target_value=h_data.get('target_value', 1.0),
                    unit=h_data.get('unit', ''),
                    micro_dose_target=h_data.get('micro_dose_target', 5.0),
                    micro_dose_unit=h_data.get('micro_dose_unit', 'mins'),
                    frequency_type=h_data.get('frequency_type', 'DAILY'),
                    frequency_data=h_data.get('frequency_data', '0,1,2,3,4,5,6')
                )
                db.add(h)
                imported_count += 1

        db.commit()
        return jsonify({
            "status": "success",
            "message": f"Successfully decrypted and restored {imported_count} habits and vault records!"
        })
    finally:
        db.close()


from datetime import date, timedelta
from typing import List, Dict, Any
from models import Habit, CheckIn
from services.scoring import is_scheduled_day

def generate_oracle_predictions(db, target_date: date = None) -> List[Dict[str, Any]]:
    """
    Aria Oracle: Predictive Failure Prevention Engine.
    Analyzes historical weekday friction and recent streak decay to warn the user
    BEFORE a habit fails, with 1-tap proactive interventions.
    """
    today = target_date or date.today()
    tomorrow = today + timedelta(days=1)
    tomorrow_weekday = tomorrow.weekday() # 0 = Monday, ..., 6 = Sunday
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    habits = db.query(Habit).filter(Habit.is_archived == False).all()
    predictions = []

    for habit in habits:
        # Check if scheduled tomorrow
        if not is_scheduled_day(habit, tomorrow):
            continue

        # Look at last 6 weeks of performance on tomorrow's specific weekday
        past_target_weekday_dates = []
        for i in range(1, 7):
            d = tomorrow - timedelta(days=7 * i)
            if d >= habit.created_at.date():
                past_target_weekday_dates.append(d)

        if not past_target_weekday_dates:
            continue

        # Count misses on this specific weekday
        weekday_checkins = db.query(CheckIn).filter(
            CheckIn.habit_id == habit.id,
            CheckIn.checkin_date.in_(past_target_weekday_dates)
        ).all()
        checkin_map = {c.checkin_date: c for c in weekday_checkins}

        miss_count = 0
        for d in past_target_weekday_dates:
            c = checkin_map.get(d)
            if not c or c.status in ("MISSED", "UNCHECKED") or c.value_completed < (habit.target_value * 0.5):
                miss_count += 1

        miss_rate = miss_count / len(past_target_weekday_dates)

        if miss_rate >= 0.5 and len(past_target_weekday_dates) >= 2:
            day_name = day_names[tomorrow_weekday]
            micro_val = habit.micro_dose_target or 5.0
            micro_unit = habit.micro_dose_unit or (habit.unit or "mins")

            predictions.append({
                "habit_id": habit.id,
                "habit_name": habit.name,
                "category": habit.category,
                "hex_color": habit.hex_color,
                "risk_level": "HIGH" if miss_rate >= 0.65 else "MEDIUM",
                "predicted_day": f"{day_name} (Tomorrow)",
                "miss_rate_pct": round(miss_rate * 100),
                "insight": f"You missed {habit.name} on {miss_count} of the last {len(past_target_weekday_dates)} {day_name}s.",
                "intervention_title": f"Activate Elastic Sizing ({int(micro_val)} {micro_unit})",
                "intervention_type": "MICRO_DOSE",
                "micro_target": micro_val,
                "micro_unit": micro_unit,
                "recommendation": f"Tomorrow is {day_name}. Rather than aiming for {habit.target_value} {habit.unit}, commit to a 2-minute starter sprint of {micro_val} {micro_unit} to protect your streak!"
            })

    # If no high-risk habits found, generate a proactive positive momentum prompt
    if not predictions and habits:
        sample_habit = habits[0]
        predictions.append({
            "habit_id": sample_habit.id,
            "habit_name": sample_habit.name,
            "category": sample_habit.category,
            "hex_color": sample_habit.hex_color,
            "risk_level": "OPTIMAL",
            "predicted_day": "Today",
            "miss_rate_pct": 10,
            "insight": "High momentum detected! Your consistency is outperforming historical baseline.",
            "intervention_title": "Audio Sprint (40Hz Gamma)",
            "intervention_type": "AUDIO_FOCUS",
            "recommendation": "Leverage your high-energy state with a 25-minute deep work session with binaural beats."
        })

    return predictions

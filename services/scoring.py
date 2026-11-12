from datetime import date, datetime, timedelta
from typing import Dict, Any, Tuple, Optional

def parse_scheduled_days(frequency_data: str) -> set:
    """Parse comma-separated day indices (0=Mon, ..., 6=Sun)."""
    if not frequency_data:
        return set(range(7))
    try:
        parts = [p.strip() for p in str(frequency_data).split(',') if p.strip()]
        return set(int(p) for p in parts if p.isdigit() and 0 <= int(p) <= 6)
    except Exception:
        return set(range(7))

def is_scheduled_day(habit, target_date: date) -> bool:
    """Determine whether a given date is a scheduled day for the habit."""
    freq_type = getattr(habit, 'frequency_type', 'DAILY')
    freq_data = getattr(habit, 'frequency_data', '0,1,2,3,4,5,6')

    if freq_type == 'DAILY':
        return True
    elif freq_type == 'SPECIFIC_DAYS':
        scheduled_days = parse_scheduled_days(freq_data)
        return target_date.weekday() in scheduled_days
    elif freq_type == 'TIMES_PER_WEEK':
        # Default all days eligible, tracked weekly
        return True
    return True

def calculate_habit_strength(habit, checkins_map: Dict[str, Any], as_of_date: Optional[date] = None) -> float:
    """
    Loop-style Habit Strength Score using Exponential Moving Average (EMA).
    Formula: score = (score * 0.94) + (day_weight * 0.06)
    - If day is unscheduled or status == "SKIPPED", score carries forward unchanged.
    - Day weight:
        - COMPLETED (or value_completed >= target_value): 1.0
        - PARTIAL (0 < value_completed < target_value): value_completed / target_value
        - MISSED / no record: 0.0
    Returns: round(score * 100, 1)
    """
    today = as_of_date or date.today()
    created_dt = getattr(habit, 'created_at', None)
    if isinstance(created_dt, datetime):
        start_date = created_dt.date()
    elif isinstance(created_dt, date):
        start_date = created_dt
    else:
        start_date = today - timedelta(days=60)

    # Ensure we cover at least 60 days of history if habit is older, or from creation
    earliest_date = today - timedelta(days=60)
    eval_start = min(start_date, earliest_date)
    target_value = float(getattr(habit, 'target_value', 1.0) or 1.0)
    if target_value <= 0:
        target_value = 1.0

    score = 0.0
    curr = eval_start
    while curr <= today:
        date_str = curr.isoformat()
        checkin = checkins_map.get(date_str)
        scheduled = is_scheduled_day(habit, curr)

        status = checkin.get('status') if isinstance(checkin, dict) else (getattr(checkin, 'status', None) if checkin else None)
        value_completed = checkin.get('value_completed', 0.0) if isinstance(checkin, dict) else (getattr(checkin, 'value_completed', 0.0) if checkin else 0.0)
        try:
            value_completed = float(value_completed or 0.0)
        except (ValueError, TypeError):
            value_completed = 0.0

        if not scheduled or status == "SKIPPED":
            # Carry previous day's score forward unchanged
            pass
        else:
            if status == "COMPLETED" or value_completed >= target_value:
                day_weight = 1.0
            elif status == "MICRO_DOSE":
                day_weight = 0.85
            elif status == "PARTIAL" or (0 < value_completed < target_value):
                day_weight = max(0.0, min(1.0, value_completed / target_value))
            elif status == "MISSED" or checkin is None:
                day_weight = 0.0
            else:
                day_weight = 0.0

            score = (score * 0.94) + (day_weight * 0.06)

        curr += timedelta(days=1)

    return round(score * 100, 1)

def calculate_strength_history(habit, checkins_map: Dict[str, Any], days: int = 90, as_of_date: Optional[date] = None) -> list:
    """
    Calculate day-by-day habit strength curve for the last N days (Loop-style strength graph).
    Returns list of dicts: [{"date": "YYYY-MM-DD", "strength": float}]
    """
    today = as_of_date or date.today()
    created_dt = getattr(habit, 'created_at', None)
    if isinstance(created_dt, datetime):
        start_date = created_dt.date()
    elif isinstance(created_dt, date):
        start_date = created_dt
    else:
        start_date = today - timedelta(days=days + 60)

    # Warmup period of 60 days prior to history window
    history_start = today - timedelta(days=days)
    eval_start = min(start_date, history_start - timedelta(days=60))
    target_value = float(getattr(habit, 'target_value', 1.0) or 1.0)
    if target_value <= 0:
        target_value = 1.0

    score = 0.0
    curr = eval_start
    history = []

    while curr <= today:
        date_str = curr.isoformat()
        checkin = checkins_map.get(date_str)
        scheduled = is_scheduled_day(habit, curr)

        status = checkin.get('status') if isinstance(checkin, dict) else (getattr(checkin, 'status', None) if checkin else None)
        value_completed = checkin.get('value_completed', 0.0) if isinstance(checkin, dict) else (getattr(checkin, 'value_completed', 0.0) if checkin else 0.0)
        try:
            value_completed = float(value_completed or 0.0)
        except (ValueError, TypeError):
            value_completed = 0.0

        if not scheduled or status == "SKIPPED":
            pass
        else:
            if status == "COMPLETED" or value_completed >= target_value:
                day_weight = 1.0
            elif status == "MICRO_DOSE":
                day_weight = 0.85
            elif status == "PARTIAL" or (0 < value_completed < target_value):
                day_weight = max(0.0, min(1.0, value_completed / target_value))
            else:
                day_weight = 0.0

            score = (score * 0.94) + (day_weight * 0.06)

        # Collect history only within the requested window
        if curr >= history_start:
            history.append({
                "date": date_str,
                "strength": round(score * 100, 1)
            })

        curr += timedelta(days=1)

    return history

def calculate_streaks(habit, checkins_map: Dict[str, Any], as_of_date: Optional[date] = None) -> Tuple[int, int]:
    """
    Forgiving Streak Calculator:
    - COMPLETED increments streak by 1.
    - SKIPPED (Rest day) or unscheduled off-days BRIDGE the streak without resetting and without incrementing.
    - Missing today does not break current_streak until today passes.
    - Missing a past scheduled day resets the running streak to 0.
    Returns: (current_streak, best_streak)
    """
    today = as_of_date or date.today()
    created_dt = getattr(habit, 'created_at', None)
    if isinstance(created_dt, datetime):
        start_date = created_dt.date()
    elif isinstance(created_dt, date):
        start_date = created_dt
    else:
        start_date = today - timedelta(days=365)

    eval_start = min(start_date, today - timedelta(days=90))
    target_value = float(getattr(habit, 'target_value', 1.0) or 1.0)
    if target_value <= 0:
        target_value = 1.0

    running_streak = 0
    best_streak = 0

    curr = eval_start
    while curr <= today:
        date_str = curr.isoformat()
        checkin = checkins_map.get(date_str)
        scheduled = is_scheduled_day(habit, curr)

        status = checkin.get('status') if isinstance(checkin, dict) else (getattr(checkin, 'status', None) if checkin else None)
        value_completed = checkin.get('value_completed', 0.0) if isinstance(checkin, dict) else (getattr(checkin, 'value_completed', 0.0) if checkin else 0.0)
        try:
            value_completed = float(value_completed or 0.0)
        except (ValueError, TypeError):
            value_completed = 0.0

        is_completed = (status in ("COMPLETED", "MICRO_DOSE")) or (value_completed >= target_value)
        is_skipped = (status == "SKIPPED")

        if is_completed:
            running_streak += 1
            if running_streak > best_streak:
                best_streak = running_streak
        elif is_skipped or not scheduled:
            # Bridge day: streak neither increments nor resets
            pass
        else:
            # Scheduled day missed
            if curr == today:
                # If today has not been completed yet, it doesn't break current streak until today passes
                pass
            else:
                running_streak = 0

        curr += timedelta(days=1)

    return running_streak, best_streak

def calculate_habit_metrics(habit, checkins=None, as_of_date: Optional[date] = None) -> Dict[str, Any]:
    """Calculate combined metrics for a habit."""
    today = as_of_date or date.today()
    if checkins is None:
        checkins = getattr(habit, 'check_ins', [])

    checkins_map = {}
    total_completions = 0
    total_value = 0.0
    target_value = float(getattr(habit, 'target_value', 1.0) or 1.0)

    for c in checkins:
        c_date = c.checkin_date if isinstance(c.checkin_date, date) else datetime.strptime(str(c.checkin_date), '%Y-%m-%d').date()
        date_str = c_date.isoformat()
        checkins_map[date_str] = c

        status = getattr(c, 'status', None) or (c.get('status') if isinstance(c, dict) else None)
        val = getattr(c, 'value_completed', 0.0) or (c.get('value_completed', 0.0) if isinstance(c, dict) else 0.0)
        try:
            val = float(val)
        except (ValueError, TypeError):
            val = 0.0

        if status == "COMPLETED" or val >= target_value:
            total_completions += 1
        total_value += val

    strength = calculate_habit_strength(habit, checkins_map, today)
    curr_streak, best_streak = calculate_streaks(habit, checkins_map, today)

    return {
        "habit_strength": strength,
        "current_streak": curr_streak,
        "best_streak": best_streak,
        "total_completions": total_completions,
        "total_value": round(total_value, 1)
    }

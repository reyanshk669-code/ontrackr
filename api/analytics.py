from flask import Blueprint, jsonify, request, g
from datetime import date, datetime, timedelta
from database import SessionLocal
from models import Habit, CheckIn
from services.scoring import calculate_habit_metrics, is_scheduled_day, calculate_strength_history

analytics_bp = Blueprint('analytics', __name__, url_prefix='/api/analytics')

def get_current_user_id():
    return getattr(g, 'user_id', None) or request.headers.get('X-User-Id') or request.args.get('user_id') or 'guest'

@analytics_bp.route('/summary', methods=['GET'])
def get_summary():
    """Returns top-level KPIs for today."""
    db = SessionLocal()
    try:
        today = date.today()
        current_uid = get_current_user_id()
        habits = db.query(Habit).filter(Habit.is_archived == False, Habit.user_id == current_uid).all()

        if not habits:
            return jsonify({
                "status": "success",
                "kpis": {
                    "today_completion_rate": 0,
                    "overall_habit_strength": 0,
                    "total_focus_minutes_today": 0,
                    "active_streaks_count": 0,
                    "total_habits": 0
                }
            })

        total_habits = len(habits)
        today_scheduled_habits = 0
        today_completed_habits = 0
        strengths = []
        active_streaks = 0
        today_focus_minutes = 0.0

        for h in habits:
            metrics = calculate_habit_metrics(h, h.check_ins, today)
            strengths.append(metrics["habit_strength"])
            if metrics["current_streak"] > 0:
                active_streaks += 1

            if is_scheduled_day(h, today):
                today_scheduled_habits += 1

            # Check today's checkin
            today_checkin = next((c for c in h.check_ins if c.checkin_date == today), None)
            if today_checkin:
                if today_checkin.status == "COMPLETED" or float(today_checkin.value_completed or 0) >= float(h.target_value or 1):
                    today_completed_habits += 1
                if h.habit_type == "MEASURABLE" and ("min" in (h.unit or "").lower() or not h.unit):
                    today_focus_minutes += float(today_checkin.value_completed or 0.0)
                elif h.habit_type == "MEASURABLE" and "hour" in (h.unit or "").lower():
                    today_focus_minutes += float(today_checkin.value_completed or 0.0) * 60.0

        comp_rate = round((today_completed_habits / today_scheduled_habits * 100), 1) if today_scheduled_habits > 0 else 0
        avg_strength = round(sum(strengths) / len(strengths), 1) if strengths else 0

        return jsonify({
            "status": "success",
            "kpis": {
                "today_completion_rate": comp_rate,
                "overall_habit_strength": avg_strength,
                "total_focus_minutes_today": round(today_focus_minutes, 1),
                "active_streaks_count": active_streaks,
                "total_habits": total_habits
            }
        })
    finally:
        db.close()

@analytics_bp.route('/habit/<int:habit_id>', methods=['GET'])
def get_habit_analytics(habit_id):
    """Deep-dive analytics for a single habit: stats, 365-day heatmap, day-of-week radar/bar, revision log."""
    db = SessionLocal()
    try:
        current_uid = get_current_user_id()
        habit = db.query(Habit).filter(Habit.id == habit_id, Habit.user_id == current_uid).first()
        if not habit:
            return jsonify({"status": "error", "message": "Habit not found"}), 404

        today = date.today()
        metrics = calculate_habit_metrics(habit, habit.check_ins, today)

        # Build lookup of check-ins
        checkins_by_date = {}
        for c in habit.check_ins:
            d_str = c.checkin_date.isoformat() if isinstance(c.checkin_date, date) else str(c.checkin_date)
            checkins_by_date[d_str] = c

        # 1. 365-day Heatmap Data (from today - 364 to today)
        heatmap = []
        target_val = float(habit.target_value or 1.0)
        start_date = today - timedelta(days=364)
        curr = start_date

        # Track weekday performance: 0=Mon, ..., 6=Sun
        weekday_scheduled = [0] * 7
        weekday_completed = [0] * 7

        while curr <= today:
            d_str = curr.isoformat()
            c = checkins_by_date.get(d_str)
            sched = is_scheduled_day(habit, curr)
            w = curr.weekday()

            if sched:
                weekday_scheduled[w] += 1

            status = getattr(c, 'status', 'UNCHECKED') if c else 'UNCHECKED'
            val = float(getattr(c, 'value_completed', 0.0) or 0.0) if c else 0.0
            note = getattr(c, 'note', '') or '' if c else ''

            # Compute intensity: 0 to 4
            intensity = 0
            if status == "COMPLETED" or val >= target_val:
                intensity = 4
                if sched:
                    weekday_completed[w] += 1
            elif status == "PARTIAL":
                ratio = val / target_val if target_val > 0 else 0.5
                if ratio >= 0.75:
                    intensity = 3
                elif ratio >= 0.5:
                    intensity = 2
                else:
                    intensity = 1
            elif status == "SKIPPED":
                intensity = -1  # Special freeze/skip marker
            else:
                intensity = 0

            heatmap.append({
                "date": d_str,
                "day_of_week": w,
                "scheduled": sched,
                "status": status,
                "value_completed": val,
                "intensity": intensity,
                "note": note
            })

            curr += timedelta(days=1)

        # 2. Weekday Breakdown Chart Data
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        day_of_week_stats = []
        for i in range(7):
            sched_cnt = weekday_scheduled[i]
            comp_cnt = weekday_completed[i]
            rate = round((comp_cnt / sched_cnt * 100), 1) if sched_cnt > 0 else 0
            day_of_week_stats.append({
                "day_name": day_names[i],
                "scheduled_count": sched_cnt,
                "completed_count": comp_cnt,
                "completion_rate": rate
            })

        # 3. Searchable Study Revision Log (most recent first)
        revision_log = []
        sorted_checkins = sorted(habit.check_ins, key=lambda x: x.checkin_date, reverse=True)
        count_completed = 0
        count_skipped = 0
        count_partial = 0

        for c in sorted_checkins:
            if c.status == "COMPLETED" or float(c.value_completed or 0) >= target_val:
                count_completed += 1
            elif c.status == "SKIPPED":
                count_skipped += 1
            elif c.status == "PARTIAL":
                count_partial += 1

            if c.note or (c.value_completed and c.value_completed > 0) or c.status in ["COMPLETED", "SKIPPED"]:
                revision_log.append({
                    "date": c.checkin_date.isoformat() if isinstance(c.checkin_date, date) else str(c.checkin_date),
                    "status": c.status,
                    "value_completed": c.value_completed,
                    "unit": habit.unit or "",
                    "note": c.note or ""
                })

        # 4. Loop-Style Habit Strength History curve (90 days)
        strength_history = calculate_strength_history(habit, checkins_by_date, days=90, as_of_date=today)
        strength_30d_ago = strength_history[-30]["strength"] if len(strength_history) >= 30 else strength_history[0]["strength"] if strength_history else 0.0
        current_strength = metrics["habit_strength"]
        strength_diff = round(current_strength - strength_30d_ago, 1)

        total_tracked = count_completed + count_skipped + count_partial
        success_rate = round((count_completed / (total_tracked or 1)) * 100, 1)

        # 5. Full checkin lookup for interactive monthly calendar
        calendar_records = {}
        for c in habit.check_ins:
            ds = c.checkin_date.isoformat() if isinstance(c.checkin_date, date) else str(c.checkin_date)
            calendar_records[ds] = {
                "status": c.status,
                "value_completed": c.value_completed,
                "note": c.note or ""
            }

        return jsonify({
            "status": "success",
            "habit": habit.to_dict(),
            "metrics": metrics,
            "heatmap": heatmap,
            "day_of_week_stats": day_of_week_stats,
            "revision_log": revision_log,
            "strength_history": strength_history,
            "strength_change_30d": strength_diff,
            "stats_breakdown": {
                "completed": count_completed,
                "skipped": count_skipped,
                "partial": count_partial,
                "success_rate": success_rate
            },
            "calendar_records": calendar_records
        })
    finally:
        db.close()

@analytics_bp.route('/timeframe', methods=['GET'])
def get_timeframe_analytics():
    """
    Multi-Timeframe Activity Analyser:
    Provides weekly, monthly, and yearly aggregations with per-activity breakdown.
    """
    period = request.args.get('period', 'weekly').lower()
    db = SessionLocal()
    try:
        today = date.today()
        if period == 'weekly':
            days_count = 7
            start_date = today - timedelta(days=6)
            period_label = "Weekly (Last 7 Days)"
        elif period == 'yearly':
            days_count = 365
            start_date = today - timedelta(days=364)
            period_label = "Yearly (Last 365 Days)"
        else:
            days_count = 30
            start_date = today - timedelta(days=29)
            period_label = "Monthly (Last 30 Days)"

        current_uid = get_current_user_id()
        habits = db.query(Habit).filter(Habit.is_archived == False, Habit.user_id == current_uid).all()
        
        daily_trends = []
        curr_d = start_date
        date_map = {}
        day_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

        while curr_d <= today:
            d_str = curr_d.isoformat()
            if period == 'weekly':
                label = day_names[curr_d.weekday()]
            elif period == 'monthly':
                label = f"{curr_d.day} {month_names[curr_d.month - 1]}"
            else:
                label = f"{month_names[curr_d.month - 1]} '{str(curr_d.year)[2:]}"

            item = {
                "date": d_str,
                "label": label,
                "scheduled_total": 0,
                "completed_total": 0,
                "focus_minutes": 0.0
            }
            daily_trends.append(item)
            date_map[d_str] = item
            curr_d += timedelta(days=1)

        total_scheduled_all = 0
        total_completed_all = 0
        total_focus_mins_all = 0.0
        habits_breakdown = []

        for h in habits:
            metrics = calculate_habit_metrics(h, h.check_ins, today)
            checkin_lookup = {
                (c.checkin_date.isoformat() if isinstance(c.checkin_date, date) else str(c.checkin_date)): c
                for c in h.check_ins
            }

            h_scheduled = 0
            h_completed = 0
            h_volume = 0.0
            recent_day_records = []

            curr = start_date
            while curr <= today:
                ds = curr.isoformat()
                sched = is_scheduled_day(h, curr)
                c = checkin_lookup.get(ds)
                
                status = getattr(c, 'status', 'UNCHECKED') if c else 'UNCHECKED'
                val = float(getattr(c, 'value_completed', 0.0) or 0.0) if c else 0.0
                target_val = float(h.target_value or 1.0)

                is_done = False
                if status in ["COMPLETED", "MICRO_DOSE"] or val >= target_val:
                    is_done = True
                
                if sched:
                    h_scheduled += 1
                    total_scheduled_all += 1
                    if ds in date_map:
                        date_map[ds]["scheduled_total"] += 1

                if is_done:
                    h_completed += 1
                    total_completed_all += 1
                    if ds in date_map:
                        date_map[ds]["completed_total"] += 1

                if val > 0:
                    h_volume += val
                    if h.habit_type == "MEASURABLE":
                        mins = val if ("min" in (h.unit or "").lower() or not h.unit) else (val * 60.0 if "hour" in (h.unit or "").lower() else 0.0)
                        total_focus_mins_all += mins
                        if ds in date_map:
                            date_map[ds]["focus_minutes"] += mins

                recent_day_records.append({
                    "date": ds,
                    "status": status,
                    "is_done": is_done,
                    "value": val
                })
                curr += timedelta(days=1)

            adherence = round((h_completed / h_scheduled * 100), 1) if h_scheduled > 0 else 0.0

            if adherence >= 90:
                grade = "A+ Master"
                grade_badge = "success"
            elif adherence >= 75:
                grade = "A Consistent"
                grade_badge = "primary"
            elif adherence >= 60:
                grade = "B Solid"
                grade_badge = "info"
            elif adherence >= 40:
                grade = "C Developing"
                grade_badge = "warning"
            else:
                grade = "At Risk"
                grade_badge = "danger"

            habits_breakdown.append({
                "id": h.id,
                "name": h.name,
                "category": h.category,
                "hex_color": h.hex_color,
                "habit_type": h.habit_type,
                "unit": h.unit or "",
                "target_value": h.target_value,
                "scheduled_days": h_scheduled,
                "completed_days": h_completed,
                "adherence_rate": adherence,
                "total_volume_logged": round(h_volume, 1),
                "current_streak": metrics.get("current_streak", 0),
                "best_streak": metrics.get("best_streak", 0),
                "habit_strength": metrics.get("habit_strength", 0.0),
                "grade": grade,
                "grade_badge": grade_badge,
                "recent_days": recent_day_records[-14:]
            })

        habits_breakdown.sort(key=lambda x: x["adherence_rate"], reverse=True)
        overall_adherence = round((total_completed_all / total_scheduled_all * 100), 1) if total_scheduled_all > 0 else 0.0
        mvp_habit = habits_breakdown[0]["name"] if habits_breakdown else "None"

        chart_labels = []
        chart_completion_rates = []
        chart_focus_minutes = []

        if period == 'yearly':
            monthly_agg = {}
            for d in daily_trends:
                m_key = d["date"][:7]
                if m_key not in monthly_agg:
                    dt = datetime.strptime(m_key, "%Y-%m")
                    monthly_agg[m_key] = {
                        "label": dt.strftime("%b"),
                        "scheduled": 0,
                        "completed": 0,
                        "focus": 0.0
                    }
                monthly_agg[m_key]["scheduled"] += d["scheduled_total"]
                monthly_agg[m_key]["completed"] += d["completed_total"]
                monthly_agg[m_key]["focus"] += d["focus_minutes"]

            for m_key, agg in sorted(monthly_agg.items()):
                chart_labels.append(agg["label"])
                rate = round((agg["completed"] / agg["scheduled"] * 100), 1) if agg["scheduled"] > 0 else 0.0
                chart_completion_rates.append(rate)
                chart_focus_minutes.append(round(agg["focus"], 1))
        else:
            for d in daily_trends:
                chart_labels.append(d["label"])
                rate = round((d["completed_total"] / d["scheduled_total"] * 100), 1) if d["scheduled_total"] > 0 else 0.0
                chart_completion_rates.append(rate)
                chart_focus_minutes.append(round(d["focus_minutes"], 1))

        return jsonify({
            "status": "success",
            "period": period,
            "period_label": period_label,
            "days_count": days_count,
            "start_date": start_date.isoformat(),
            "end_date": today.isoformat(),
            "kpis": {
                "overall_adherence_rate": overall_adherence,
                "total_completed_checks": total_completed_all,
                "total_scheduled_checks": total_scheduled_all,
                "total_focus_minutes": round(total_focus_mins_all, 1),
                "total_activities": len(habits),
                "mvp_activity": mvp_habit
            },
            "chart_data": {
                "labels": chart_labels,
                "completion_rates": chart_completion_rates,
                "focus_minutes": chart_focus_minutes
            },
            "habits_breakdown": habits_breakdown
        })
    finally:
        db.close()

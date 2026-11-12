from datetime import date, datetime, timedelta, timezone
import random
import json
from models import Habit, CheckIn, Milestone, UserRPGProfile, HabitStack, SmartTrigger, AccountabilityDuel, TribePact
from database import SessionLocal

SAMPLE_HABITS = [
    {
        "name": "Practice Python & Tkinter",
        "category": "Core CS",
        "hex_color": "#2196F3",  # Material Blue
        "habit_type": "MEASURABLE",
        "target_value": 60.0,
        "unit": "mins",
        "frequency_type": "DAILY",
        "frequency_data": "0,1,2,3,4,5,6",
        "scheduled_time_slot": "16:00 - 17:30",
        "is_priority_crunch": True,
        "priority_tag": "High",
        "notes": [
            "Built recursive algorithm visualizer with Tkinter canvas",
            "Refactored GUI event loop and command bindings",
            "Solved 3 medium LeetCode array problems with Python dictionary",
            "Practiced OOP inheritance, abstract base classes and dataclasses",
            "Implemented custom tkinter dialog modal with validation",
            "Debugging memory leak in long-running animation loop",
            "Created reusable Tkinter theme palette manager"
        ]
    },
    {
        "name": "Revise PostgreSQL Queries & Indexes",
        "category": "Web Dev",
        "hex_color": "#4CAF50",  # Material Green
        "habit_type": "MEASURABLE",
        "target_value": 45.0,
        "unit": "mins",
        "frequency_type": "DAILY",
        "frequency_data": "0,1,2,3,4,5,6",
        "scheduled_time_slot": "18:00 - 19:00",
        "is_priority_crunch": True,
        "priority_tag": "High",
        "notes": [
            "Practiced EXPLAIN ANALYZE on complex multi-table joins",
            "Benchmarked B-Tree vs Hash index scan on 500k row dataset",
            "Wrote CTEs and Window Functions (ROW_NUMBER, DENSE_RANK)",
            "Implemented database transactions with ACID isolation levels",
            "Constructed composite foreign key constraints & cascade behaviors",
            "Reviewed connection pooling & pgbouncer configuration"
        ]
    },
    {
        "name": "HTML5, CSS Grid & Responsive UI",
        "category": "Web Dev",
        "hex_color": "#9C27B0",  # Material Purple
        "habit_type": "MEASURABLE",
        "target_value": 40.0,
        "unit": "mins",
        "frequency_type": "DAILY",
        "frequency_data": "0,1,2,3,4,5,6",
        "scheduled_time_slot": "19:30 - 20:30",
        "is_priority_crunch": False,
        "priority_tag": "Medium",
        "notes": [
            "Mastered CSS subgrid and container query break points",
            "Built accessible mobile bottom navigation bar with safe-area insets",
            "Implemented glassmorphic modal backdrop with blur filter",
            "Created 365-day SVG heatmap with CSS tooltips",
            "Configured responsive print media stylesheets",
            "Designed touch-first micro-interaction ripple animations"
        ]
    },
    {
        "name": "Morning Calisthenics & Cardio",
        "category": "Fitness",
        "hex_color": "#FF9800",  # Material Orange
        "habit_type": "BOOLEAN",
        "target_value": 1.0,
        "unit": "",
        "frequency_type": "SPECIFIC_DAYS",
        "frequency_data": "0,1,2,3,4,5",  # Mon to Sat
        "scheduled_time_slot": "06:30 - 07:15",
        "is_priority_crunch": False,
        "priority_tag": "Medium",
        "notes": [
            "5km outdoor tempo run + 50 pushups",
            "High intensity core tabata circuit & stretching",
            "Pullups, dips, and mobility cooldown",
            "Light morning jog and deep breathwork",
            "Full body resistance band routine"
        ]
    },
    {
        "name": "Daily CS Book Reading & System Design",
        "category": "Core CS",
        "hex_color": "#E91E63",  # Material Pink
        "habit_type": "MEASURABLE",
        "target_value": 20.0,
        "unit": "pages",
        "frequency_type": "DAILY",
        "frequency_data": "0,1,2,3,4,5,6",
        "scheduled_time_slot": "21:30 - 22:15",
        "is_priority_crunch": False,
        "priority_tag": "Low",
        "notes": [
            "Read Designing Data-Intensive Applications: Chapter 3 Storage Engines",
            "Studied LSM-Trees vs B-Trees trade-offs",
            "Analyzed distributed consensus algorithms (Paxos & Raft)",
            "Read Clean Code: Meaningful variable naming & small functions",
            "Reviewed caching strategies: Cache-Aside vs Write-Through"
        ]
    }
]

SAMPLE_MILESTONES = [
    {
        "title": "PostgreSQL Module Assessment",
        "days_ahead": 9,
        "category": "Web Dev",
        "crunch_mode_active": True
    },
    {
        "title": "Python & Data Structures Final Project",
        "days_ahead": 18,
        "category": "Core CS",
        "crunch_mode_active": True
    },
    {
        "title": "Full-Stack Portfolio Showcase",
        "days_ahead": 27,
        "category": "Web Dev",
        "crunch_mode_active": False
    }
]

SAMPLE_STACKS = [
    {
        "name": "Morning Code & Cognition Stack",
        "trigger_anchor": "After morning pour-over coffee brew",
        "category": "Morning Deep Work",
        "steps": [
            {"title": "10m Calisthenics & Hydration", "duration": "10m", "color": "#FF9800"},
            {"title": "45m Python & Algorithms Sprint", "duration": "45m", "color": "#2196F3"},
            {"title": "Quick Micro-Note Log & XP Claim", "duration": "5m", "color": "#4CAF50"}
        ],
        "reward": "15m Tech Podcast & Breakfast"
    },
    {
        "name": "Evening Assessment Prep Stack",
        "trigger_anchor": "After closing laptop for dinner",
        "category": "Evening Mastery",
        "steps": [
            {"title": "30m PostgreSQL EXPLAIN Queries", "duration": "30m", "color": "#4CAF50"},
            {"title": "20m Distributed Systems Reading", "duration": "20m", "color": "#E91E63"}
        ],
        "reward": "Herbal Tea & Ambient Music Wind-down"
    }
]

SAMPLE_TRIGGERS = [
    {
        "habit_name": "Revise PostgreSQL Queries & Indexes",
        "trigger_type": "TIME",
        "condition_text": "7:00 PM on Weekdays (Desk Time)",
        "action_text": "Launch 45m Pomodoro Query Tuning timer",
        "icon": "⏱"
    },
    {
        "habit_name": "Practice Python & Tkinter",
        "trigger_type": "DEVICE",
        "condition_text": "When phone connects to Study Wi-Fi",
        "action_text": "Open LeetCode Array Challenge",
        "icon": "💻"
    },
    {
        "habit_name": "Morning Calisthenics & Cardio",
        "trigger_type": "LOCATION",
        "condition_text": "Morning Alarm Dismissed & Step Count > 30",
        "action_text": "Trigger 50 Pushups & Tabata warm-up",
        "icon": "🏃"
    },
    {
        "habit_name": "Daily CS Book Reading",
        "trigger_type": "MOOD",
        "condition_text": "Night Wind-down Mode (10:00 PM)",
        "action_text": "Dim lights and read 20 pages DDIA",
        "icon": "📖"
    }
]

SAMPLE_DUELS = [
    {
        "title": "7-Day LeetCode Array Duel",
        "opponent_name": "Alex Chen",
        "opponent_avatar": "🦊",
        "habit_name": "Practice Python & Tkinter",
        "user_score": 5,
        "opponent_score": 4,
        "total_days": 7,
        "current_day": 5,
        "status": "ACTIVE",
        "xp_wager": 300
    },
    {
        "title": "Morning Cardio Clash",
        "opponent_name": "Vikram Rao",
        "opponent_avatar": "🦁",
        "habit_name": "Morning Calisthenics & Cardio",
        "user_score": 6,
        "opponent_score": 5,
        "total_days": 7,
        "current_day": 6,
        "status": "ACTIVE",
        "xp_wager": 200
    }
]

SAMPLE_TRIBES = [
    {
        "name": "Full-Stack Dev Guild",
        "members_count": 5,
        "target_adherence": 85,
        "current_adherence": 92,
        "streak_days": 14,
        "guild_avatar": "🛡️",
        "activities": [
            {"user": "Reyansh", "text": "Completed 45m PostgreSQL indexing sprint (+50 XP)", "time": "20m ago", "reaction": "🔥"},
            {"user": "Alex", "text": "Solved Tkinter recursive animation bug (+45 XP)", "time": "1h ago", "reaction": "👏"},
            {"user": "Sarah", "text": "Built mobile bottom navigation dock (+60 XP)", "time": "3h ago", "reaction": "🚀"},
            {"user": "Liam", "text": "Completed 5km morning run (+40 XP)", "time": "5h ago", "reaction": "💪"}
        ]
    },
    {
        "name": "Core CS Systems Tribe",
        "members_count": 8,
        "target_adherence": 80,
        "current_adherence": 88,
        "streak_days": 21,
        "guild_avatar": "⚡",
        "activities": [
            {"user": "Marcus", "text": "Finished DDIA Chapter 3 on B-Trees (+40 XP)", "time": "40m ago", "reaction": "💡"},
            {"user": "Reyansh", "text": "Logged 1hr system design revision (+60 XP)", "time": "2h ago", "reaction": "🔥"}
        ]
    }
]

def seed_sample_data(force: bool = False) -> dict:
    """Populate database with habits, RPG profile, stacks, triggers, duels, and tribes."""
    db = SessionLocal()
    try:
        existing_habits = db.query(Habit).count()
        if existing_habits > 0 and not force:
            return {"status": "skipped", "message": "Database already contains habits."}

        if force:
            db.query(CheckIn).delete()
            db.query(Habit).delete()
            db.query(Milestone).delete()
            db.query(UserRPGProfile).delete()
            db.query(HabitStack).delete()
            db.query(SmartTrigger).delete()
            db.query(AccountabilityDuel).delete()
            db.query(TribePact).delete()
            db.commit()

        today = date.today()

        # 1. Seed Milestones
        for m_data in SAMPLE_MILESTONES:
            m = Milestone(
                title=m_data["title"],
                target_date=today + timedelta(days=m_data["days_ahead"]),
                category=m_data["category"],
                crunch_mode_active=m_data["crunch_mode_active"]
            )
            db.add(m)

        # 2. Seed RPG Profile
        rpg = UserRPGProfile(
            username="Reyansh",
            title="Code Sorcerer & Polymath",
            level=12,
            xp=2450,
            next_level_xp=3000,
            streak_shields=2,
            logic_stat=85,
            discipline_stat=92,
            resilience_stat=78,
            endurance_stat=70,
            wisdom_stat=88
        )
        db.add(rpg)

        # 3. Seed Habit Stacks
        for s_data in SAMPLE_STACKS:
            stack = HabitStack(
                name=s_data["name"],
                trigger_anchor=s_data["trigger_anchor"],
                category=s_data["category"],
                steps_json=json.dumps(s_data["steps"]),
                reward=s_data["reward"],
                is_active=True
            )
            db.add(stack)

        # 4. Seed Smart Triggers
        for t_data in SAMPLE_TRIGGERS:
            trigger = SmartTrigger(
                habit_name=t_data["habit_name"],
                trigger_type=t_data["trigger_type"],
                condition_text=t_data["condition_text"],
                action_text=t_data["action_text"],
                icon=t_data["icon"],
                is_active=True
            )
            db.add(trigger)

        # 5. Seed Accountability Duels
        for d_data in SAMPLE_DUELS:
            duel = AccountabilityDuel(
                title=d_data["title"],
                opponent_name=d_data["opponent_name"],
                opponent_avatar=d_data["opponent_avatar"],
                habit_name=d_data["habit_name"],
                user_score=d_data["user_score"],
                opponent_score=d_data["opponent_score"],
                total_days=d_data["total_days"],
                current_day=d_data["current_day"],
                status=d_data["status"],
                xp_wager=d_data["xp_wager"]
            )
            db.add(duel)

        # 6. Seed Tribe Pacts
        for tr_data in SAMPLE_TRIBES:
            tribe = TribePact(
                name=tr_data["name"],
                members_count=tr_data["members_count"],
                target_adherence=tr_data["target_adherence"],
                current_adherence=tr_data["current_adherence"],
                streak_days=tr_data["streak_days"],
                guild_avatar=tr_data["guild_avatar"],
                recent_activity_json=json.dumps(tr_data["activities"])
            )
            db.add(tribe)

        # 7. Seed Habits and 30-day history
        random.seed(42)

        for h_data in SAMPLE_HABITS:
            habit = Habit(
                name=h_data["name"],
                category=h_data["category"],
                hex_color=h_data["hex_color"],
                habit_type=h_data["habit_type"],
                target_value=h_data["target_value"],
                unit=h_data["unit"],
                frequency_type=h_data["frequency_type"],
                frequency_data=h_data["frequency_data"],
                scheduled_time_slot=h_data["scheduled_time_slot"],
                is_priority_crunch=h_data["is_priority_crunch"],
                is_archived=False,
                created_at=datetime.now(timezone.utc) - timedelta(days=32)
            )
            db.add(habit)
            db.flush()

            notes_pool = h_data.get("notes", ["Focused study session"])

            for day_offset in range(30, -1, -1):
                check_date = today - timedelta(days=day_offset)
                
                if h_data["frequency_type"] == "SPECIFIC_DAYS":
                    sched_days = [int(x) for x in h_data["frequency_data"].split(",") if x.strip()]
                    if check_date.weekday() not in sched_days:
                        continue

                roll = random.random()
                if roll < 0.82:
                    status = "COMPLETED"
                    val = h_data["target_value"]
                    note = random.choice(notes_pool)
                elif roll < 0.92:
                    if h_data["habit_type"] == "MEASURABLE":
                        status = "PARTIAL"
                        val = round(h_data["target_value"] * random.uniform(0.5, 0.85), 1)
                        note = "Short sprint between lectures."
                    else:
                        status = "COMPLETED"
                        val = 1.0
                        note = random.choice(notes_pool)
                elif roll < 0.97:
                    status = "SKIPPED"
                    val = 0.0
                    note = "Rest Day (Streak Shielded)"
                else:
                    status = "MISSED"
                    val = 0.0
                    note = None

                checkin = CheckIn(
                    habit_id=habit.id,
                    checkin_date=check_date,
                    status=status,
                    value_completed=val,
                    note=note,
                    updated_at=datetime.now(timezone.utc) - timedelta(days=day_offset)
                )
                db.add(checkin)

        db.commit()
        return {
            "status": "success",
            "message": f"Successfully seeded 5 habits, RPG identity profile, habit stacks, smart triggers, duels, and tribes!"
        }
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()

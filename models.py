from datetime import datetime, date, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, Text, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Habit(Base):
    __tablename__ = 'habits'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(128), default="guest", nullable=False, index=True)
    name = Column(String(255), nullable=False)
    category = Column(String(100), default="General", nullable=False)
    hex_color = Column(String(16), default="#4F46E5", nullable=False)
    habit_type = Column(String(20), default="BOOLEAN", nullable=False)  # "BOOLEAN" or "MEASURABLE"
    target_value = Column(Float, default=1.0, nullable=False)
    unit = Column(String(50), default="", nullable=True)
    micro_dose_target = Column(Float, default=5.0, nullable=False)  # Elastic habit sizing target (e.g. 5m / 1 problem)
    micro_dose_unit = Column(String(50), default="mins", nullable=True)
    frequency_type = Column(String(30), default="DAILY", nullable=False)  # "DAILY", "SPECIFIC_DAYS", "TIMES_PER_WEEK"
    frequency_data = Column(String(100), default="0,1,2,3,4,5,6", nullable=False)
    scheduled_time_slot = Column(String(100), nullable=True)  # e.g., "07:00 - 08:30"
    is_priority_crunch = Column(Boolean, default=False, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    check_ins = relationship("CheckIn", back_populates="habit", cascade="all, delete-orphan", lazy="selectin")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "category": self.category,
            "hex_color": self.hex_color,
            "habit_type": self.habit_type,
            "target_value": self.target_value,
            "unit": self.unit or "",
            "micro_dose_target": self.micro_dose_target,
            "micro_dose_unit": self.micro_dose_unit or (self.unit or ""),
            "frequency_type": self.frequency_type,
            "frequency_data": self.frequency_data,
            "scheduled_time_slot": self.scheduled_time_slot or "",
            "is_priority_crunch": self.is_priority_crunch,
            "is_archived": self.is_archived,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class CheckIn(Base):
    __tablename__ = 'check_ins'

    id = Column(Integer, primary_key=True, autoincrement=True)
    habit_id = Column(Integer, ForeignKey('habits.id', ondelete='CASCADE'), nullable=False)
    checkin_date = Column(Date, nullable=False, index=True)
    status = Column(String(20), default="COMPLETED", nullable=False)  # "COMPLETED", "PARTIAL", "SKIPPED", "MISSED", "MICRO_DOSE"
    value_completed = Column(Float, default=1.0, nullable=False)
    is_micro_dose = Column(Boolean, default=False, nullable=False)
    note = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    habit = relationship("Habit", back_populates="check_ins")

    __table_args__ = (
        UniqueConstraint('habit_id', 'checkin_date', name='uq_habit_checkin_date'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "habit_id": self.habit_id,
            "checkin_date": self.checkin_date.isoformat() if isinstance(self.checkin_date, (date, datetime)) else str(self.checkin_date),
            "status": self.status,
            "value_completed": self.value_completed,
            "is_micro_dose": bool(self.is_micro_dose),
            "note": self.note or "",
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class Milestone(Base):
    __tablename__ = 'milestones'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(128), default="guest", nullable=False, index=True)
    title = Column(String(255), nullable=False)
    target_date = Column(Date, nullable=False)
    category = Column(String(100), default="Exam", nullable=False)
    crunch_mode_active = Column(Boolean, default=False, nullable=False)

    def to_dict(self):
        today = date.today()
        days_left = (self.target_date - today).days if self.target_date else None
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "target_date": self.target_date.isoformat() if self.target_date else None,
            "category": self.category,
            "crunch_mode_active": self.crunch_mode_active,
            "days_left": days_left
        }


class UserRPGProfile(Base):
    __tablename__ = 'user_rpg_profile'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(128), default="guest", nullable=False, index=True)
    username = Column(String(100), default="Student", nullable=False)
    title = Column(String(150), default="Focus Novice", nullable=False)
    level = Column(Integer, default=1, nullable=False)
    xp = Column(Integer, default=0, nullable=False)
    next_level_xp = Column(Integer, default=500, nullable=False)
    streak_shields = Column(Integer, default=0, nullable=False)
    logic_stat = Column(Integer, default=10, nullable=False)
    discipline_stat = Column(Integer, default=10, nullable=False)
    resilience_stat = Column(Integer, default=10, nullable=False)
    endurance_stat = Column(Integer, default=10, nullable=False)
    wisdom_stat = Column(Integer, default=10, nullable=False)

    @property
    def aura_tier(self):
        if self.level >= 15:
            return "Grandmaster"
        elif self.level >= 10:
            return "Paladin"
        elif self.level >= 5:
            return "Scholar"
        return "Initiate"

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "username": self.username,
            "title": self.title,
            "level": self.level,
            "aura_tier": self.aura_tier,
            "xp": self.xp,
            "next_level_xp": self.next_level_xp,
            "streak_shields": self.streak_shields,
            "attributes": {
                "logic": self.logic_stat,
                "discipline": self.discipline_stat,
                "resilience": self.resilience_stat,
                "endurance": self.endurance_stat,
                "wisdom": self.wisdom_stat
            }
        }


class HabitStack(Base):
    __tablename__ = 'habit_stacks'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(128), default="guest", nullable=False, index=True)
    name = Column(String(150), nullable=False)
    trigger_anchor = Column(String(200), nullable=False) # e.g. "After morning espresso"
    category = Column(String(100), default="Morning Routine", nullable=False)
    steps_json = Column(Text, nullable=False) # JSON list: [{"title": "10m Calisthenics", "duration": "10m", "color": "#F59E0B"}, ...]
    reward = Column(String(200), default="15m Podcast listen", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    def to_dict(self):
        import json
        steps = []
        try:
            steps = json.loads(self.steps_json)
        except Exception:
            steps = []
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "trigger_anchor": self.trigger_anchor,
            "category": self.category,
            "steps": steps,
            "reward": self.reward,
            "is_active": self.is_active
        }


class SmartTrigger(Base):
    __tablename__ = 'smart_triggers'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(128), default="guest", nullable=False, index=True)
    habit_name = Column(String(150), nullable=False)
    trigger_type = Column(String(50), default="TIME", nullable=False) # TIME, LOCATION, DEVICE, MOOD
    condition_text = Column(String(255), nullable=False)
    action_text = Column(String(255), nullable=False)
    icon = Column(String(50), default="⚡", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "habit_name": self.habit_name,
            "trigger_type": self.trigger_type,
            "condition_text": self.condition_text,
            "action_text": self.action_text,
            "icon": self.icon,
            "is_active": self.is_active
        }


class AccountabilityDuel(Base):
    __tablename__ = 'accountability_duels'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(128), default="guest", nullable=False, index=True)
    title = Column(String(150), nullable=False)
    opponent_name = Column(String(100), nullable=False)
    opponent_avatar = Column(String(10), default="🦊", nullable=False)
    habit_name = Column(String(150), nullable=False)
    user_score = Column(Integer, default=5, nullable=False)
    opponent_score = Column(Integer, default=4, nullable=False)
    total_days = Column(Integer, default=7, nullable=False)
    current_day = Column(Integer, default=5, nullable=False)
    status = Column(String(50), default="ACTIVE", nullable=False)
    xp_wager = Column(Integer, default=250, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "title": self.title,
            "opponent_name": self.opponent_name,
            "opponent_avatar": self.opponent_avatar,
            "habit_name": self.habit_name,
            "user_score": self.user_score,
            "opponent_score": self.opponent_score,
            "total_days": self.total_days,
            "current_day": self.current_day,
            "status": self.status,
            "xp_wager": self.xp_wager
        }


class TribePact(Base):
    __tablename__ = 'tribe_pacts'

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(128), default="guest", nullable=False, index=True)
    name = Column(String(150), nullable=False)
    members_count = Column(Integer, default=5, nullable=False)
    target_adherence = Column(Integer, default=85, nullable=False)
    current_adherence = Column(Integer, default=92, nullable=False)
    streak_days = Column(Integer, default=14, nullable=False)
    guild_avatar = Column(String(10), default="🛡️", nullable=False)
    recent_activity_json = Column(Text, nullable=True)

    def to_dict(self):
        import json
        activities = []
        try:
            activities = json.loads(self.recent_activity_json) if self.recent_activity_json else []
        except Exception:
            activities = []
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "members_count": self.members_count,
            "target_adherence": self.target_adherence,
            "current_adherence": self.current_adherence,
            "streak_days": self.streak_days,
            "guild_avatar": self.guild_avatar,
            "activities": activities
        }

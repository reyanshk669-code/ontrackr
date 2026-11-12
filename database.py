from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, scoped_session
from config import Config

engine = create_engine(
    Config.SQLALCHEMY_DATABASE_URI,
    connect_args={"check_same_thread": False} if Config.SQLALCHEMY_DATABASE_URI.startswith("sqlite") else {}
)

SessionLocal = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        return db
    finally:
        pass

def init_db():
    import models  # Ensure all models are imported before creating tables
    Base.metadata.create_all(bind=engine)
    
    # Auto-migration for SQLite when new columns are added
    from sqlalchemy import text
    with engine.connect() as conn:
        # Check and add micro_dose_target to habits
        try:
            conn.execute(text("ALTER TABLE habits ADD COLUMN micro_dose_target FLOAT DEFAULT 5.0"))
            conn.commit()
        except Exception:
            pass

        # Check and add micro_dose_unit to habits
        try:
            conn.execute(text("ALTER TABLE habits ADD COLUMN micro_dose_unit VARCHAR(50) DEFAULT 'mins'"))
            conn.commit()
        except Exception:
            pass

        # Check and add is_micro_dose to check_ins
        try:
            conn.execute(text("ALTER TABLE check_ins ADD COLUMN is_micro_dose BOOLEAN DEFAULT 0"))
            conn.commit()
        except Exception:
            pass

        # Multi-user data partition migration: add user_id column
        for table in ['habits', 'milestones', 'user_rpg_profile', 'habit_stacks', 'smart_triggers', 'accountability_duels', 'tribe_pacts']:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN user_id VARCHAR(128) DEFAULT 'guest'"))
                conn.commit()
            except Exception:
                pass

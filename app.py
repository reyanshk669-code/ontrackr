import os
from flask import Flask, render_template, send_from_directory, jsonify
from config import Config
from database import init_db, SessionLocal
from services.seed_data import seed_sample_data
from api.habits import habits_bp
from api.checkins import checkins_bp
from api.milestones import milestones_bp
from api.analytics import analytics_bp
from api.backup import backup_bp
from api.advanced_features import advanced_bp
from models import Habit

def create_app():
    app = Flask(__name__, static_folder='static', template_folder='templates')
    app.config.from_object(Config)

    # Initialize Database Tables
    with app.app_context():
        init_db()
        # Auto-seed sample student data if database is brand new
        db = SessionLocal()
        try:
            if db.query(Habit).count() == 0:
                print("Database is empty. Seeding initial student sample habits...")
                seed_sample_data(force=False)
        except Exception as e:
            print(f"Auto-seed error: {e}")
        finally:
            db.close()

    # Register API Blueprints
    app.register_blueprint(habits_bp)
    app.register_blueprint(checkins_bp)
    app.register_blueprint(milestones_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(backup_bp)
    app.register_blueprint(advanced_bp)

    # Multi-User Session Filter
    @app.before_request
    def set_current_user():
        from flask import g, request
        uid = request.headers.get('X-User-Id') or request.args.get('user_id')
        if not uid or uid.strip() in ('', 'null', 'undefined'):
            g.user_id = 'guest'
        else:
            g.user_id = uid.strip()

    @app.teardown_appcontext
    def remove_session(exception=None):
        SessionLocal.remove()

    # Frontend Routes
    @app.route('/')
    def index():
        return render_template('index.html')

    @app.route('/manifest.json')
    def manifest():
        return send_from_directory('static', 'manifest.json', mimetype='application/manifest+json')

    @app.route('/service-worker.js')
    def service_worker():
        response = send_from_directory('static', 'service-worker.js', mimetype='application/javascript')
        # Crucial for service worker updates
        response.headers['Service-Worker-Allowed'] = '/'
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        return response

    @app.route('/.well-known/assetlinks.json')
    def assetlinks():
        return send_from_directory(
            os.path.join('static', '.well-known'),
            'assetlinks.json',
            mimetype='application/json'
        )

    @app.route('/health')
    def health():
        return jsonify({"status": "healthy", "app": "HabitWall Student Studio"})

    return app

app = create_app()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)

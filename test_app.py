import unittest
import json
from datetime import date, timedelta
from app import create_app
from database import SessionLocal
from models import Habit, CheckIn, Milestone
from services.scoring import calculate_habit_strength, calculate_streaks, calculate_habit_metrics

class TestHabitWallApp(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.client = cls.app.test_client()

    def test_01_index_and_pwa_routes(self):
        """Test index page, manifest, and service-worker are properly served."""
        res = self.client.get('/')
        self.assertEqual(res.status_code, 200)
        self.assertIn(b'OnTrack', res.data)

        # Manifest
        res_m = self.client.get('/manifest.json')
        self.assertEqual(res_m.status_code, 200)
        m_json = res_m.get_json()
        self.assertEqual(m_json['short_name'], 'OnTrack')
        self.assertIn('icons', m_json)

        # Service Worker
        res_sw = self.client.get('/service-worker.js')
        self.assertEqual(res_sw.status_code, 200)

        # Assetlinks
        res_al = self.client.get('/.well-known/assetlinks.json')
        self.assertEqual(res_al.status_code, 200)

    def test_02_scoring_and_streak_algorithms(self):
        """Test EMA Habit Strength and forgiving streak algorithms."""
        class MockHabit:
            created_at = date.today() - timedelta(days=20)
            target_value = 60.0
            frequency_type = 'DAILY'
            frequency_data = '0,1,2,3,4,5,6'

        habit = MockHabit()
        today = date.today()

        # Case 1: 5 days completed
        checkins_map = {}
        for i in range(5, 0, -1):
            d = (today - timedelta(days=i)).isoformat()
            checkins_map[d] = {"status": "COMPLETED", "value_completed": 60.0}

        score = calculate_habit_strength(habit, checkins_map, today)
        self.assertGreater(score, 0.0)

        curr_s, best_s = calculate_streaks(habit, checkins_map, today)
        self.assertEqual(curr_s, 5)
        self.assertEqual(best_s, 5)

        # Case 2: Bridge with a SKIPPED day
        checkins_map_bridge = {
            (today - timedelta(days=4)).isoformat(): {"status": "COMPLETED", "value_completed": 60.0},
            (today - timedelta(days=3)).isoformat(): {"status": "SKIPPED", "value_completed": 0.0},
            (today - timedelta(days=2)).isoformat(): {"status": "COMPLETED", "value_completed": 60.0},
            (today - timedelta(days=1)).isoformat(): {"status": "COMPLETED", "value_completed": 60.0},
        }
        curr_b, best_b = calculate_streaks(habit, checkins_map_bridge, today)
        self.assertEqual(curr_b, 3)

    def test_03_habits_api(self):
        """Test listing, creating, and fetching habits."""
        res = self.client.get('/api/habits')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['status'], 'success')
        self.assertGreater(len(data['habits']), 0)
        self.assertIn('dates', data)
        self.assertEqual(len(data['dates']), 7)

        # Create new habit
        new_habit_payload = {
            "name": "Test Docker & CI/CD",
            "category": "DevOps",
            "hex_color": "#06B6D4",
            "habit_type": "MEASURABLE",
            "target_value": 30.0,
            "unit": "mins",
            "frequency_type": "DAILY",
            "scheduled_time_slot": "15:00 - 15:30",
            "is_priority_crunch": True
        }
        res_post = self.client.post('/api/habits', json=new_habit_payload)
        self.assertEqual(res_post.status_code, 201)
        created = res_post.get_json()['habit']
        self.assertEqual(created['name'], "Test Docker & CI/CD")

    def test_04_checkins_toggle_and_log_time(self):
        """Test 3-state check-in cycle and timer auto-logging."""
        habits_res = self.client.get('/api/habits')
        habit = habits_res.get_json()['habits'][0]
        test_date_str = (date.today() + timedelta(days=25)).isoformat()

        # 1. Toggle empty date -> COMPLETED
        res_toggle_1 = self.client.post('/api/checkins/toggle', json={
            "habit_id": habit['id'],
            "checkin_date": test_date_str
        })
        self.assertEqual(res_toggle_1.status_code, 200)
        data_1 = res_toggle_1.get_json()
        self.assertEqual(data_1['checkin']['status'], "COMPLETED")

        # 2. Toggle COMPLETED -> SKIPPED
        res_toggle_2 = self.client.post('/api/checkins/toggle', json={
            "habit_id": habit['id'],
            "checkin_date": test_date_str
        })
        self.assertEqual(res_toggle_2.status_code, 200)
        data_2 = res_toggle_2.get_json()
        self.assertEqual(data_2['checkin']['status'], "SKIPPED")

        # 3. Toggle SKIPPED -> UNCHECKED (deleted)
        res_toggle_3 = self.client.post('/api/checkins/toggle', json={
            "habit_id": habit['id'],
            "checkin_date": test_date_str
        })
        self.assertEqual(res_toggle_3.status_code, 200)
        data_3 = res_toggle_3.get_json()
        self.assertEqual(data_3['checkin']['status'], "UNCHECKED")

        # 4. Auto-log via Pomodoro timer
        res_log = self.client.post('/api/checkins/log-time', json={
            "habit_id": habit['id'],
            "elapsed_minutes": 25.0,
            "note": "Completed 25m Pomodoro session on unit tests"
        })
        self.assertEqual(res_log.status_code, 200)
        log_data = res_log.get_json()
        self.assertIn("Logged 25.0 mins", log_data['message'])

    def test_05_analytics_and_summary(self):
        """Test analytics summary KPIs and habit deep-dive view."""
        res_sum = self.client.get('/api/analytics/summary')
        self.assertEqual(res_sum.status_code, 200)
        kpis = res_sum.get_json()['kpis']
        self.assertIn('today_completion_rate', kpis)
        self.assertIn('overall_habit_strength', kpis)

        habits_res = self.client.get('/api/habits')
        habit = habits_res.get_json()['habits'][0]
        res_dive = self.client.get(f"/api/analytics/habit/{habit['id']}")
        self.assertEqual(res_dive.status_code, 200)
        dive_data = res_dive.get_json()
        self.assertIn('heatmap', dive_data)
        self.assertIn('day_of_week_stats', dive_data)
        self.assertIn('revision_log', dive_data)
        self.assertEqual(len(dive_data['heatmap']), 365)
        self.assertEqual(len(dive_data['day_of_week_stats']), 7)

    def test_06_backup_export_and_import(self):
        """Test backup export JSON, CSV, and import."""
        res_json = self.client.get('/api/backup/export-json')
        self.assertEqual(res_json.status_code, 200)
        backup_content = json.loads(res_json.data.decode('utf-8'))
        self.assertIn('habits', backup_content)
        self.assertIn('check_ins', backup_content)

        res_csv = self.client.get('/api/backup/export-csv')
        self.assertEqual(res_csv.status_code, 200)
        self.assertIn(b'CheckIn_ID,Habit_ID,Habit_Name', res_csv.data)

        res_import = self.client.post('/api/backup/import-json', json=backup_content)
        self.assertEqual(res_import.status_code, 200)
        self.assertEqual(res_import.get_json()['status'], 'success')

    def test_07_rpg_identity_and_xp(self):
        """Test RPG profile, claiming XP, leveling up, and streak shield usage."""
        res = self.client.get('/api/rpg/profile')
        self.assertEqual(res.status_code, 200)
        p = res.get_json()['profile']
        self.assertIn('level', p)
        self.assertIn('xp', p)
        self.assertIn('streak_shields', p)

        # Claim XP
        res_claim = self.client.post('/api/rpg/claim-xp', json={"xp": 100, "reason": "Test habit"})
        self.assertEqual(res_claim.status_code, 200)
        self.assertIn('+100 XP', res_claim.get_json()['message'])

        # Use Streak Freeze Shield
        res_shield = self.client.post('/api/rpg/use-shield')
        self.assertIn(res_shield.status_code, [200, 400])

    def test_08_habit_stacks(self):
        """Test habit stacking visualizer API."""
        res = self.client.get('/api/stacks')
        self.assertEqual(res.status_code, 200)
        stacks = res.get_json()['stacks']
        self.assertIsInstance(stacks, list)

        # Create stack
        new_stack = {
            "name": "Night Wind-Down Routine",
            "trigger_anchor": "After I put laptop on charger at 10 PM",
            "category": "Sleep & Focus",
            "steps": ["Read 10 pages of book", "Log micro-notes for tomorrow"],
            "reward": "Claim +50 XP and 8 hours sleep"
        }
        res_create = self.client.post('/api/stacks', json=new_stack)
        self.assertEqual(res_create.status_code, 201)
        self.assertEqual(res_create.get_json()['stack']['name'], "Night Wind-Down Routine")

    def test_09_smart_triggers(self):
        """Test context-aware smart triggers API and simulation."""
        res = self.client.get('/api/triggers')
        self.assertEqual(res.status_code, 200)
        triggers = res.get_json()['triggers']
        self.assertIsInstance(triggers, list)

        if triggers:
            tid = triggers[0]['id']
            res_sim = self.client.post(f"/api/triggers/{tid}/simulate")
            self.assertEqual(res_sim.status_code, 200)
            self.assertIn("Smart Trigger Fired", res_sim.get_json()['message'])

    def test_10_accountability_duels_and_tribes(self):
        """Test duels, study nudges, tribe pacts, and emoji reactions."""
        res_d = self.client.get('/api/social/duels')
        self.assertEqual(res_d.status_code, 200)
        duels = res_d.get_json()['duels']
        self.assertIsInstance(duels, list)

        if duels:
            did = duels[0]['id']
            res_nudge = self.client.post(f"/api/social/duels/{did}/nudge")
            self.assertEqual(res_nudge.status_code, 200)
            self.assertIn("nudge", res_nudge.get_json()['message'].lower())

        res_t = self.client.get('/api/social/tribes')
        self.assertEqual(res_t.status_code, 200)
        tribes = res_t.get_json()['tribes']
        self.assertIsInstance(tribes, list)

        if tribes:
            tid = tribes[0]['id']
            res_react = self.client.post(f"/api/social/tribes/{tid}/react", json={"emoji": "🔥"})
            self.assertEqual(res_react.status_code, 200)

    def test_11_aria_ai_coach(self):
        """Test Aria AI habit coach conversational responses."""
        res_aria = self.client.post('/api/ai/aria', json={"prompt": "Analyze all my habits"})
        self.assertEqual(res_aria.status_code, 200)
        self.assertIn("Habit Health", res_aria.get_json()['reply'])

        res_stack = self.client.post('/api/ai/aria', json={"prompt": "How to create an atomic habit stack?"})
        self.assertEqual(res_stack.status_code, 200)
        self.assertIn("Atomic Habit Stack", res_stack.get_json()['reply'])

        res_focus = self.client.post('/api/ai/aria', json={"prompt": "How does the pomodoro focus timer work?"})
        self.assertEqual(res_focus.status_code, 200)
        focus_data = res_focus.get_json()
        self.assertIn("Focus Engine Guide", focus_data['reply'])
        self.assertTrue(any(a.get('type') in ['TIMER_POMODORO', 'MICRO_DOSE'] for a in focus_data.get('actions', [])))

    def test_12_micro_dose_elastic_habit(self):
        """Test Slump Buster / Bad Day Protocol micro-dose check-in."""
        habits_res = self.client.get('/api/habits')
        habit = habits_res.get_json()['habits'][0]
        res = self.client.post(f"/api/habits/{habit['id']}/micro-dose")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['status'], 'success')
        self.assertIn('micro-dose', data['message'].lower())
        self.assertEqual(data['checkin']['status'], 'MICRO_DOSE')
        self.assertTrue(data['checkin']['is_micro_dose'])

    def test_13_aria_oracle_predictive_engine(self):
        """Test Aria Oracle predictive failure prevention analysis."""
        res = self.client.get('/api/ai/oracle-predictions')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['status'], 'success')
        self.assertIn('predictions', data)
        if len(data['predictions']) > 0:
            pred = data['predictions'][0]
            self.assertIn('risk_level', pred)
            self.assertIn('insight', pred)
            self.assertIn('intervention_type', pred)

    def test_14_encrypted_cloud_vault(self):
        """Test Encrypted Vault export and import with passphrase."""
        passphrase = "SecretVaultKey2026!"
        res_exp = self.client.post('/api/backup/encrypted-export', json={"passphrase": passphrase})
        self.assertEqual(res_exp.status_code, 200)
        exp_data = res_exp.get_json()
        self.assertEqual(exp_data['status'], 'success')
        self.assertIn('encrypted_vault', exp_data)
        encoded_vault = exp_data['encrypted_vault']

        # Import back with correct passphrase
        res_imp = self.client.post('/api/backup/encrypted-import', json={
            "passphrase": passphrase,
            "encrypted_vault": encoded_vault
        })
        self.assertEqual(res_imp.status_code, 200)
        imp_data = res_imp.get_json()
        self.assertEqual(imp_data['status'], 'success')
        self.assertIn('restored', imp_data['message'].lower())

        # Import with incorrect passphrase should fail gracefully with 400
        res_imp_bad = self.client.post('/api/backup/encrypted-import', json={
            "passphrase": "WrongPassword123",
            "encrypted_vault": encoded_vault
        })
        self.assertEqual(res_imp_bad.status_code, 400)
        self.assertIn('failed to decrypt', imp_data_bad := res_imp_bad.get_json()['message'].lower())

    def test_15_timeframe_analyser(self):
        """Test Multi-Timeframe Activity Analyser across weekly, monthly, and yearly intervals."""
        for period in ['weekly', 'monthly', 'yearly']:
            res = self.client.get(f'/api/analytics/timeframe?period={period}')
            self.assertEqual(res.status_code, 200)
            data = res.get_json()
            self.assertEqual(data['status'], 'success')
            self.assertEqual(data['period'], period)
            self.assertIn('kpis', data)
            self.assertIn('overall_adherence_rate', data['kpis'])
            self.assertIn('chart_data', data)
            self.assertIn('habits_breakdown', data)
            self.assertIsInstance(data['habits_breakdown'], list)

    def test_16_multi_user_data_isolation(self):
        """Verify that a brand new user gets 0 tasks, and user data is strictly isolated."""
        user_bob = "usr_bob_unique_123"
        user_alice = "usr_alice_unique_456"

        # 1. New user Bob signs in: should get 0 habits (completely fresh app)
        res_bob = self.client.get('/api/habits', headers={'X-User-Id': user_bob})
        self.assertEqual(res_bob.status_code, 200)
        data_bob = res_bob.get_json()
        self.assertEqual(len(data_bob['habits']), 0, "New user Bob must have 0 habits initially")

        # Bob's analytics should also be empty
        res_summary = self.client.get('/api/analytics/summary', headers={'X-User-Id': user_bob})
        self.assertEqual(res_summary.status_code, 200)
        self.assertEqual(res_summary.get_json()['kpis']['total_habits'], 0)

        # 2. Bob creates a habit
        res_create_bob = self.client.post('/api/habits', headers={'X-User-Id': user_bob}, json={
            "name": "Bob's Morning Sprint",
            "category": "Fitness",
            "hex_color": "#10B981",
            "habit_type": "MEASURABLE",
            "target_value": 30.0,
            "unit": "mins"
        })
        self.assertEqual(res_create_bob.status_code, 201)

        # 3. Another new user Alice signs in: should have 0 habits (cannot see Bob's sprint!)
        res_alice = self.client.get('/api/habits', headers={'X-User-Id': user_alice})
        self.assertEqual(res_alice.status_code, 200)
        data_alice = res_alice.get_json()
        self.assertEqual(len(data_alice['habits']), 0, "Alice must NOT see Bob's habit")

        # 4. Alice creates her own habit
        res_create_alice = self.client.post('/api/habits', headers={'X-User-Id': user_alice}, json={
            "name": "Alice's Guitar Practice",
            "category": "Music",
            "hex_color": "#EC4899",
            "habit_type": "MEASURABLE",
            "target_value": 45.0,
            "unit": "mins"
        })
        self.assertEqual(res_create_alice.status_code, 201)

        # 5. Bob queries again: sees ONLY his habit (1 habit), NOT Alice's habit
        res_bob_after = self.client.get('/api/habits', headers={'X-User-Id': user_bob})
        bobs_habits = res_bob_after.get_json()['habits']
        self.assertEqual(len(bobs_habits), 1)
        self.assertEqual(bobs_habits[0]['name'], "Bob's Morning Sprint")

        # 6. Alice queries again: sees ONLY her habit (1 habit), NOT Bob's habit
        res_alice_after = self.client.get('/api/habits', headers={'X-User-Id': user_alice})
        alices_habits = res_alice_after.get_json()['habits']
        self.assertEqual(len(alices_habits), 1)
        self.assertEqual(alices_habits[0]['name'], "Alice's Guitar Practice")

    def test_17_demo_mode_data_isolation(self):
        """Test that Demo Mode data never bleeds into a fresh new user account, and vice-versa."""
        demo_uid = "demo_user"
        new_user_uid = "usr_fresh_student_999"

        # 1. New user arrives: query must return empty list (0 habits)
        res_fresh = self.client.get('/api/habits', headers={'X-User-Id': new_user_uid})
        self.assertEqual(res_fresh.status_code, 200)
        self.assertEqual(len(res_fresh.get_json()['habits']), 0, "New user without demo must have empty list")

        # 2. Demo user creates a sample task
        res_demo_create = self.client.post('/api/habits', headers={'X-User-Id': demo_uid}, json={
            "name": "Demo Sample Task",
            "category": "Sample",
            "hex_color": "#10B981",
            "habit_type": "BOOLEAN",
            "target_value": 1.0
        })
        self.assertEqual(res_demo_create.status_code, 201)

        # 3. Fresh user checks again: must still see 0 habits (never see demo task)
        res_fresh_again = self.client.get('/api/habits', headers={'X-User-Id': new_user_uid})
        self.assertEqual(len(res_fresh_again.get_json()['habits']), 0, "Fresh user must never see demo tasks")

        # 4. Fresh user creates a personal habit
        res_user_create = self.client.post('/api/habits', headers={'X-User-Id': new_user_uid}, json={
            "name": "My Personal Real Habit",
            "category": "Health",
            "hex_color": "#7C5CFC",
            "habit_type": "BOOLEAN",
            "target_value": 1.0
        })
        self.assertEqual(res_user_create.status_code, 201)

        # 5. Demo user queries: must see ONLY demo tasks, never the real user's personal habit
        res_demo_query = self.client.get('/api/habits', headers={'X-User-Id': demo_uid})
        demo_habits = res_demo_query.get_json()['habits']
        demo_names = [h['name'] for h in demo_habits]
        self.assertIn("Demo Sample Task", demo_names)
        self.assertNotIn("My Personal Real Habit", demo_names, "Demo user must NEVER see personal user tasks")

    def test_18_fresh_user_rpg_and_analytics_kpis(self):
        """Test that fresh real user starts at Level 1, 0 XP, 0 Shields, and 0% consistency."""
        fresh_uid = "usr_fresh_test_start_001"

        # 1. Fresh user RPG Profile: must start at Level 1, 0 XP, 0 streak shields
        res_rpg = self.client.get('/api/rpg/profile', headers={'X-User-Id': fresh_uid})
        self.assertEqual(res_rpg.status_code, 200)
        profile = res_rpg.get_json()['profile']
        self.assertEqual(profile['level'], 1)
        self.assertEqual(profile['xp'], 0)
        self.assertEqual(profile['streak_shields'], 0)

        # 2. Fresh user Analytics Summary: 0 habits, 0% completion rate
        res_summary = self.client.get('/api/analytics/summary', headers={'X-User-Id': fresh_uid})
        self.assertEqual(res_summary.status_code, 200)
        kpis = res_summary.get_json()['kpis']
        self.assertEqual(kpis['today_completion_rate'], 0)
        self.assertEqual(kpis['total_habits'], 0)

        # 3. Fresh user Timeframe Analytics: 0 adherence
        res_timeframe = self.client.get('/api/analytics/timeframe?period=weekly', headers={'X-User-Id': fresh_uid})
        self.assertEqual(res_timeframe.status_code, 200)
        t_data = res_timeframe.get_json()
        self.assertEqual(t_data['kpis']['overall_adherence_rate'], 0.0)
        self.assertEqual(len(t_data['habits_breakdown']), 0)

if __name__ == '__main__':
    unittest.main()

# HabitWall: Student Habit Tracker & Printable Wall Studio

> **Loop-Style Offline Habit Tracker & Study Wall Timetable Studio**  
> Inspired by *Loop Habit Tracker* (`uhabits`), optimized for students, mobile devices, and Google Play Store distribution via Android Trusted Web Activity (TWA) / PWA.

---

## 🌟 Key Features

1. **Loop-Style Habit Strength (Exponential Moving Average):**
   - Dynamic `0%` to `100%` score based on the EMA formula:  
     $$\text{score} = (\text{score} \times 0.94) + (\text{day\_weight} \times 0.06)$$
   - Rest/freeze days (`SKIPPED`) and unscheduled days **bridge** without penalizing strength.

2. **Forgiving Streak Engine:**
   - Completed days increment streak.
   - Rest days (`SKIPPED`) bridge streaks without artificially inflating the count.
   - Missing today does not break streak until the day passes.

3. **Interactive 7-Day Mobile Check-In Matrix:**
   - 3-State cycle: `COMPLETED` (Solid fill + checkmark) $\rightarrow$ `SKIPPED` (Freeze/Pause icon) $\rightarrow$ `UNCHECKED`.
   - Measurable target popover with slider and micro-note prompts.

4. **Built-in Pomodoro & Stopwatch Study Timer:**
   - Drift-proof `Date.now()` delta calculation engine (unaffected by tab switches or phone lock).
   - Web Audio API offline dual chime.
   - **Auto-logging:** "Finish & Log Session" automatically increments today's focus minutes, evaluates completion against daily target, and prompts for study revision notes.

5. **Deep Habit Analytics Modal:**
   - 4 Stat Cards: Habit Strength %, Current Streak, Best Streak, Total Volume.
   - 365-Day GitHub-style consistency heatmap with tooltip breakdown.
   - Day-of-Week completion radar/bar chart via Chart.js.
   - Searchable chronological micro-note revision feed.

6. **Aesthetic "Print Wall Studio":**
   - 3 Print Themes: *Pastel Study Grid*, *Minimalist Architectural Blueprint*, *Modern Dark Poster*.
   - **Template 1: Monthly Habit Wall Matrix (A4 Landscape):**
     - Toggle between *Blank Printable Template* (empty circles for physical wall markers) and *Completed Trophy Grid*.
   - **Template 2: Color-Coded Weekly Study Timetable (A4 Landscape):**
     - Automatically maps scheduled habit time slots (06:00 to 22:30) + custom lecture block builder.
   - **One-Click High-Res Exports:**
     - 🖼 **Download 300 DPI PNG** (`html2canvas` scale: 3).
     - 📄 **Download Printable A4 PDF** (`jsPDF` landscape vector/image rendering).

7. **Full Data Ownership & PWA Offline Capability:**
   - Export/Import complete database to JSON & CSV.
   - Standalone Android PWA with Cache-First Service Worker and offline indicators.

---

## 🚀 Quick Start (Local Run)

### 1. Requirements
- Python 3.10+
- Flask & SQLAlchemy (dependencies in `requirements.txt`)

### 2. Install & Launch
```bash
# Clone or navigate to the directory
cd "Reyansh Mobil App"

# Install dependencies
pip install -r requirements.txt

# Run the application (auto-creates SQLite habit_tracker.db and seeds sample data)
python run.py
```

Open your browser at **`http://127.0.0.1:5000`**.

### 3. Production PostgreSQL Setup
Switching to PostgreSQL in production requires only setting the environment variable `DATABASE_URL`:
```bash
export DATABASE_URL="postgresql://username:password@localhost:5432/habitwall_db"
python run.py
```

---

## 📱 Viewing & Running in Android Studio

A complete native Android Studio project is located in the **`android/`** folder.

### 1. Opening in Android Studio
1. Launch **Android Studio**.
2. Click **Open** (or **File $\rightarrow$ Open...**).
3. Navigate to and select the `android` folder:
   ```
   C:\Users\REYANSH\OneDrive\Desktop\Reyansh Mobil App\android
   ```
4. Android Studio will automatically recognize the Gradle project, sync dependencies, and index the project files.

### 2. Project Hierarchy in Android Studio
- **`app/java/com.habitwall.studentapp/MainActivity.java`**: The native Android activity embedding the modern `WebViewAssetLoader`, swipe-to-refresh, status bar theming, and Android back navigation.
- **`app/java/com.habitwall.studentapp/WebAppInterface.java`**: The JavaScript interface providing native Android haptic feedback vibrations (`vibrate(25)`) and native system sharing.
- **`app/assets/www/`**: The offline-bundled Habit Tracker and Print Studio web app (HTML, CSS, JS, vendor libraries, and icons).
- **`app/res/`**: Adaptive launcher icons for all screen densities (`mdpi`, `hdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi`), Material 3 theme colors, and network security configs.

### 3. Running on Emulator or Physical Phone
1. In Android Studio's top toolbar, select your device (e.g., your installed **`Pixel_10`** AVD or your connected physical Android phone with USB debugging enabled).
2. Click the green **Run (▶)** button (or press `Shift + F10`).
3. The app will launch in standalone full-screen mode with tactile haptic feedback and offline data readiness.

### 4. Generating Signed Android App Bundle (.aab) for Google Play Store
1. In Android Studio, go to the top menu: **Build $\rightarrow$ Generate Signed Bundle / APK...**
2. Choose **Android App Bundle** and click **Next**.
3. Select your Keystore path (or click *Create new...* to generate a release key).
4. Select build variant **release** and click **Create**.
5. The signed `.aab` file will be generated in `app/release/app-release.aab`, ready to be uploaded directly to the **Google Play Console**!

---

## 📱 Google Play Store Submission Guide (TWA / Bubblewrap)

HabitWall is architected to be submitted directly to the **Google Play Store** using Google's official **Trusted Web Activity (TWA)** wrapper or **PWA Builder**.

### Option A: Using Google Bubblewrap CLI (Recommended)

1. **Install Bubblewrap CLI & Java JDK:**
   ```bash
   npm install -g @bubblewrap/cli
   ```

2. **Initialize Bubblewrap with HabitWall Manifest:**
   Ensure your app is deployed to HTTPS (e.g., Render, Railway, Vercel, or custom domain):
   ```bash
   bubblewrap init --manifest=https://your-domain.com/manifest.json
   ```
   Bubblewrap will read `manifest.json`, download icons (`icon-512x512.png`, maskable icons), and configure the package ID (`com.habitwall.studentapp`).

3. **Build the Android App Bundle (`.aab`):**
   ```bash
   bubblewrap build
   ```
   This generates an Android App Bundle (`app-release-bundle.aab`) signed with your release keystore.

4. **Set Up Digital Asset Links (`assetlinks.json`):**
   - Bubblewrap will output your signing certificate SHA-256 fingerprint.
   - Paste that fingerprint into `static/.well-known/assetlinks.json`:
     ```json
     [
       {
         "relation": ["delegate_permission/common.handle_all_urls"],
         "target": {
           "namespace": "android_app",
           "package_name": "com.habitwall.studentapp",
           "sha256_cert_fingerprints": [
             "YOUR:SHA256:FINGERPRINT:HERE"
           ]
         }
       }
     ]
     ```
   - Deploy so that `https://your-domain.com/.well-known/assetlinks.json` is publicly accessible. This tells Android that your app owns the domain, **removing the browser URL bar** for a 100% native full-screen experience.

5. **Upload to Google Play Console:**
   - Log in to [Google Play Console](https://play.google.com/console).
   - Create a new app (Category: *Education* or *Productivity*).
   - Upload `app-release-bundle.aab` under *Production* or *Internal Testing*.
   - Fill in store listing descriptions and screenshots (you can take screenshots directly using HabitWall's mobile view or Print Wall studio).
   - Submit for review!

### Option B: Using PWABuilder (No Command Line Required)
1. Go to [PWABuilder.com](https://www.pwabuilder.com).
2. Enter your live HTTPS URL.
3. Click **Package for Stores** $\rightarrow$ **Android**.
4. Configure package name: `com.habitwall.studentapp`.
5. Download the `.zip` containing your Google Play `.aab` package and signing keys.

---

## 🗄 Database Schema

- **`habits`**: Core habit metadata, frequency (`DAILY`, `SPECIFIC_DAYS`, `TIMES_PER_WEEK`), colors, time slots, crunch status.
- **`check_ins`**: Daily status (`COMPLETED`, `PARTIAL`, `SKIPPED`, `MISSED`), numeric values, micro-notes, indexed on `(habit_id, checkin_date)`.
- **`milestones`**: Deadlines and exam dates for the dynamic countdown banner.

---

## 📄 License
MIT License. Built for students and lifelong learners.

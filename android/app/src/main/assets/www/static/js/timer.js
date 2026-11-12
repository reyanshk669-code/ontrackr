/**
 * HabitWall - Pomodoro & Stopwatch Focus Timer Studio
 * Accurate Date.now() Delta Engine, Offline Web Audio Chime, Ambient Sound Generator & Auto-Logging
 */

class FocusTimerStudio {
  constructor() {
    this.mode = 'pomodoro-25';
    this.state = 'idle'; // 'idle', 'running', 'paused'
    this.durationSeconds = 25 * 60;
    this.elapsedSeconds = 0;
    this.startTime = null;
    this.accumulatedSeconds = 0;
    this.timerInterval = null;
    this.selectedHabitId = null;

    // Ambient noise generator
    this.ambientNoiseNode = null;
    this.ambientGainNode = null;
    this.ambientType = 'off'; // 'off', 'rain', 'whitenoise'

    // SVG Dial circumference (radius = 115)
    this.circleRadius = 115;
    this.circumference = 2 * Math.PI * this.circleRadius;

    this.init();
  }

  init() {
    this.cacheElements();
    this.setupListeners();
    this.updateDisplay();
    this.setupSvgRing();
  }

  cacheElements() {
    this.elTimeText = document.getElementById('timer-time-display');
    this.elSubText = document.getElementById('timer-sub-display');
    this.elCircleProgress = document.getElementById('timer-svg-progress');
    this.btnToggle = document.getElementById('btn-timer-toggle');
    this.btnReset = document.getElementById('btn-timer-reset');
    this.btnLog = document.getElementById('btn-timer-log');
    this.selectHabit = document.getElementById('timer-habit-select');
    this.modeBtns = document.querySelectorAll('.timer-mode-btn');
    this.ambientBtns = document.querySelectorAll('.ambient-btn');
  }

  setupSvgRing() {
    if (this.elCircleProgress) {
      this.elCircleProgress.style.strokeDasharray = `${this.circumference} ${this.circumference}`;
      this.elCircleProgress.style.strokeDashoffset = '0';
    }
  }

  setupListeners() {
    // Mode switcher buttons
    this.modeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetMode = btn.getAttribute('data-mode');
        this.switchMode(targetMode);
      });
    });

    // Ambient sound switcher
    this.ambientBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-ambient');
        this.setAmbientSound(type);
      });
    });

    // Play / Pause toggle
    if (this.btnToggle) {
      this.btnToggle.addEventListener('click', () => {
        if (this.state === 'running') {
          this.pause();
        } else {
          this.start();
        }
      });
    }

    // Reset button
    if (this.btnReset) {
      this.btnReset.addEventListener('click', () => this.reset());
    }

    // Finish & Log Session button
    if (this.btnLog) {
      this.btnLog.addEventListener('click', () => this.finishAndLog());
    }

    // Habit select dropdown change
    if (this.selectHabit) {
      this.selectHabit.addEventListener('change', (e) => {
        this.selectedHabitId = e.target.value ? parseInt(e.target.value) : null;
      });
    }
  }

  setAmbientSound(type) {
    this.ambientBtns.forEach(b => {
      if (b.getAttribute('data-ambient') === type) b.classList.add('active');
      else b.classList.remove('active');
    });

    this.ambientType = type;
    this.stopAmbientSound();

    if (this.state === 'running' && type !== 'off') {
      this.startAmbientSound(type);
    }
  }

  startAmbientSound(type) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Generate 2 seconds of synthetic noise buffer
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Pink noise approximation for rain/focus
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      // Lowpass filter for smooth rainfall sensation
      const filter = ctx.createBiquadFilter();
      filter.type = type === 'rain' ? 'lowpass' : 'bandpass';
      filter.frequency.value = type === 'rain' ? 800 : 1200;

      const gain = ctx.createGain();
      gain.gain.value = 0.08;

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      whiteNoise.start();
      this.ambientNoiseNode = whiteNoise;
      this.ambientGainNode = gain;
    } catch (e) {
      console.warn('Ambient noise error:', e);
    }
  }

  stopAmbientSound() {
    if (this.ambientNoiseNode) {
      try {
        this.ambientNoiseNode.stop();
        this.ambientNoiseNode.disconnect();
      } catch (e) {}
      this.ambientNoiseNode = null;
    }
  }

  switchMode(newMode) {
    if (this.state === 'running') {
      const confirmSwitch = confirm('A focus session is currently running. Switch mode and reset?');
      if (!confirmSwitch) return;
    }

    this.reset();
    this.mode = newMode;

    this.modeBtns.forEach(b => {
      if (b.getAttribute('data-mode') === newMode) b.classList.add('active');
      else b.classList.remove('active');
    });

    if (newMode === 'pomodoro-15') {
      this.durationSeconds = 15 * 60;
      this.elSubText.textContent = 'Quick Sprint (15m)';
    } else if (newMode === 'pomodoro-25') {
      this.durationSeconds = 25 * 60;
      this.elSubText.textContent = 'Pomodoro Focus (25m)';
    } else if (newMode === 'pomodoro-50') {
      this.durationSeconds = 50 * 60;
      this.elSubText.textContent = 'Deep Work Session (50m)';
    } else if (newMode === 'stopwatch') {
      this.durationSeconds = 0;
      this.elSubText.textContent = 'Stopwatch Count-Up';
    }

    this.updateDisplay();
  }

  start() {
    if (this.state === 'running') return;

    this.state = 'running';
    this.startTime = Date.now();
    this.btnToggle.innerHTML = '⏸';
    this.btnToggle.title = 'Pause Session';

    // Smart Focus Guard: Keep screen awake during active focus session
    if (window.AndroidNative && window.AndroidNative.setKeepScreenOn) {
      window.AndroidNative.setKeepScreenOn(true);
    }

    if (this.ambientType !== 'off') {
      this.startAmbientSound(this.ambientType);
    }

    this.timerInterval = setInterval(() => {
      this.tick();
    }, 250);
  }

  pause() {
    if (this.state !== 'running') return;

    this.state = 'paused';
    clearInterval(this.timerInterval);
    const now = Date.now();
    this.accumulatedSeconds += Math.floor((now - this.startTime) / 1000);
    this.startTime = null;

    if (window.AndroidNative && window.AndroidNative.setKeepScreenOn) {
      window.AndroidNative.setKeepScreenOn(false);
    }

    this.stopAmbientSound();
    this.btnToggle.innerHTML = '▶';
    this.btnToggle.title = 'Resume Session';
  }

  reset() {
    clearInterval(this.timerInterval);
    this.state = 'idle';
    this.startTime = null;
    this.accumulatedSeconds = 0;
    this.elapsedSeconds = 0;
    this.stopAmbientSound();

    if (window.AndroidNative && window.AndroidNative.setKeepScreenOn) {
      window.AndroidNative.setKeepScreenOn(false);
    }

    if (this.btnToggle) {
      this.btnToggle.innerHTML = '▶';
      this.btnToggle.title = 'Start Session';
    }

    this.updateDisplay();
  }

  tick() {
    const now = Date.now();
    const currentDelta = Math.floor((now - this.startTime) / 1000);
    this.elapsedSeconds = this.accumulatedSeconds + currentDelta;

    if (this.mode.startsWith('pomodoro')) {
      const remaining = Math.max(0, this.durationSeconds - this.elapsedSeconds);
      if (remaining === 0) {
        this.onPomodoroComplete();
      }
    }

    this.updateDisplay();
  }

  updateDisplay() {
    let displaySeconds = 0;
    let fraction = 0;

    if (this.mode.startsWith('pomodoro')) {
      displaySeconds = Math.max(0, this.durationSeconds - this.elapsedSeconds);
      fraction = Math.min(1, this.elapsedSeconds / (this.durationSeconds || 1));
    } else {
      displaySeconds = this.elapsedSeconds;
      fraction = (this.elapsedSeconds % 60) / 60;
    }

    const mins = Math.floor(displaySeconds / 60);
    const secs = displaySeconds % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    if (this.elTimeText) {
      this.elTimeText.textContent = formatted;
    }

    if (this.elCircleProgress) {
      const offset = this.circumference - (fraction * this.circumference);
      this.elCircleProgress.style.strokeDashoffset = offset;
    }
  }

  onPomodoroComplete() {
    this.pause();
    this.playChime();
    if (this.elSubText) {
      this.elSubText.textContent = '🎉 Session Completed! Log your session below.';
    }
  }

  playChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const playTone = (freq, delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0, ctx.currentTime + delay);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + delay + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 1.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 1.3);
      };

      playTone(523.25, 0);
      playTone(659.25, 0.25);
      playTone(783.99, 0.5);
    } catch (e) {
      console.warn('Web Audio chime error:', e);
    }
  }

  async finishAndLog() {
    if (!this.selectedHabitId) {
      alert('Please select a habit to log this study session to.');
      return;
    }

    let elapsedMins = Math.round(this.elapsedSeconds / 60);
    if (elapsedMins === 0 && this.elapsedSeconds >= 30) {
      elapsedMins = 1;
    }

    if (elapsedMins <= 0) {
      const manualMins = prompt('Session was short. Enter minutes to log:', '25');
      if (!manualMins || isNaN(manualMins)) return;
      elapsedMins = parseFloat(manualMins);
    }

    const note = prompt(`Log revision note for ${elapsedMins} mins session:`, 'Focused study revision session');
    if (note === null) return;

    try {
      const res = await fetch('/api/checkins/log-time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          habit_id: this.selectedHabitId,
          elapsed_minutes: elapsedMins,
          note: note.trim()
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        alert(`Logged ${elapsedMins} mins! ${data.message || ''}`);
        this.reset();
        if (window.AndroidNative && window.AndroidNative.refreshWidget) {
          window.AndroidNative.refreshWidget();
        }
        if (window.HabitApp) {
          window.HabitApp.loadDashboardData(false);
        }
      } else {
        alert(data.message || 'Error logging study time');
      }
    } catch (err) {
      console.error('Failed to log study session:', err);
      alert('Error connecting to server to log session.');
    }
  }

  populateHabitSelect(habits) {
    if (!this.selectHabit) return;
    const currentVal = this.selectHabit.value;
    this.selectHabit.innerHTML = '<option value="">-- Choose Habit to Focus On --</option>';

    habits.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h.id;
      opt.textContent = `${h.name} (${h.category}) - Target: ${h.target_value} ${h.unit || ''}`;
      this.selectHabit.appendChild(opt);
    });

    if (this.selectedHabitId) {
      this.selectHabit.value = this.selectedHabitId;
    } else if (currentVal) {
      this.selectHabit.value = currentVal;
    }
  }

  selectHabit(habitId) {
    this.selectedHabitId = parseInt(habitId);
    if (this.selectHabit) {
      this.selectHabit.value = habitId;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.TimerStudio = new FocusTimerStudio();
});

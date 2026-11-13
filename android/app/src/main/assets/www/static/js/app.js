/**
 * OnTrack - Next-Gen AI Habit & Focus Engine
 * Inspired by Loop Habit Tracker (Alinson Xavier) & ReviveAI Modern Ergonomics
 */

// Automatically attach X-User-Id header to every API request for strict multi-user data isolation
const _nativeFetch = window.fetch;
window.fetch = function(url, options = {}) {
  try {
    const urlStr = typeof url === 'string' ? url : (url && url.url ? url.url : '');
    if (urlStr.includes('/api/')) {
      options = options || {};
      const uid = window.FirebaseAuthManager ? window.FirebaseAuthManager.getUserId() : 'guest';
      if (options.headers instanceof Headers) {
        if (!options.headers.has('X-User-Id')) {
          options.headers.set('X-User-Id', uid);
        }
      } else if (Array.isArray(options.headers)) {
        options.headers.push(['X-User-Id', uid]);
      } else {
        options.headers = options.headers || {};
        if (!options.headers['X-User-Id']) {
          options.headers['X-User-Id'] = uid;
        }
      }
    }
  } catch (err) {
    console.warn('Fetch interceptor error:', err);
  }
  return _nativeFetch.call(this, url, options);
};

const AppState = {
  habits: [],
  selectedFilter: 'all', // 'all', 'high', 'medium', 'low'
  searchQuery: '',
  dates: [],
  activeCheckinHabitId: null,
  activeCheckinDate: null,
  soundEnabled: true,
  hideCompleted: false,
  compactView: false,
  showMicroDose: true,
  hapticEnabled: true,
  autoShield: true,
  remindersEnabled: true
};
window.AppState = AppState;

// Data Persistence & Storage Helpers
function isDemoModeActive() {
  return Boolean(window.FirebaseAuthManager && typeof window.FirebaseAuthManager.isDemoMode === 'function' && window.FirebaseAuthManager.isDemoMode());
}

function getUserStorageKey() {
  if (isDemoModeActive()) {
    return 'ontrack_demo_habits';
  }
  const uid = (window.FirebaseAuthManager && window.FirebaseAuthManager.getUserId) ? window.FirebaseAuthManager.getUserId() : 'guest';
  return 'ontrack_user_habits_' + uid;
}

function saveLocalHabits(habits) {
  try {
    const key = getUserStorageKey();
    localStorage.setItem(key, JSON.stringify(habits));
    if (!isDemoModeActive()) {
      localStorage.setItem('ontrack_habits', JSON.stringify(habits));
    }
  } catch (e) {
    console.error('Error saving local habits:', e);
  }
}

function getLocalHabits() {
  try {
    const key = getUserStorageKey();
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      return JSON.parse(raw);
    }
  } catch (e) {}
  return null;
}

function getOrGenerate7Dates() {
  const today = new Date();
  const dates = [];
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push({
      date: d.toISOString().split('T')[0],
      day_name: dayNames[d.getDay()],
      is_today: (i === 0)
    });
  }
  return dates;
}
window.getOrGenerate7Dates = getOrGenerate7Dates;

// Loop Material Colors Palette (Template 1 Calm Light Default)
const LOOP_MATERIAL_PALETTE = [
  { name: 'Sage Green', hex: '#7A9A78' },
  { name: 'Matcha', hex: '#85A384' },
  { name: 'Peach', hex: '#F7B99A' },
  { name: 'Buttercream Amber', hex: '#F5CE7B' },
  { name: 'Sky Blue', hex: '#5A8EB8' },
  { name: 'Muted Thistle', hex: '#857DA6' },
  { name: 'Teal', hex: '#589A8D' },
  { name: 'Terracotta', hex: '#D97757' },
  { name: 'Forest', hex: '#4E6B4C' },
  { name: 'Earth Slate', hex: '#6D776C' }
];

// SVG Icons
const ICONS = {
  check: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  pause: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`
};

// Web Audio API Sound Effects Engine
const SoundEffects = {
  ctx: null,
  getAudioContext() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  },

  playCheck() {
    if (!AppState.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880.00, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch (e) {}
  },

  playSkip() {
    if (!AppState.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440.00, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(329.63, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
  }
};
window.SoundEffects = SoundEffects;

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initGreeting();
  initPreferencesAndToggles();
  setupDockNavigation();
  setupEventListeners();
  renderMaterialPalettePicker();
  loadDashboardData();
});

// Dynamic Greeting Based on Time of Day
function initGreeting() {
  const hour = new Date().getHours();
  const periodEl = document.getElementById('greeting-period');
  if (periodEl) {
    if (hour < 12) periodEl.textContent = 'Morning';
    else if (hour < 17) periodEl.textContent = 'Afternoon';
    else periodEl.textContent = 'Evening';
  }
}

// Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem('ontrack_theme') || 'light';
  applyTheme(savedTheme);

  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const toggleDark = document.getElementById('toggle-dark-mode');

  const toggleHandler = () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const order = ['light', 'dark', 'paper'];
    const next = order[(order.indexOf(current) + 1) % order.length];
    applyTheme(next);
  };

  if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleHandler);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('ontrack_theme', theme);
  const themeIcon = document.getElementById('theme-icon-indicator');
  if (themeIcon) {
    if (theme === 'dark') themeIcon.textContent = '🌙';
    else if (theme === 'light') themeIcon.textContent = '☀️';
    else themeIcon.textContent = '📜';
  }
  const toggleDark = document.getElementById('toggle-dark-mode');
  if (toggleDark) toggleDark.checked = (theme === 'dark');
}

// ================= TACTILE PREFERENCES & TOGGLE CONTROLS =================
function initPreferencesAndToggles() {
  // 1. Sound FX Toggle
  const toggleSound = document.getElementById('toggle-sound-fx');
  const soundIcon = document.getElementById('sound-icon-indicator');
  const soundHeaderBtn = document.getElementById('sound-toggle-btn');
  const savedSound = localStorage.getItem('ontrack_sound');
  if (savedSound !== null) {
    AppState.soundEnabled = savedSound === 'true';
  }
  if (toggleSound) toggleSound.checked = AppState.soundEnabled;
  if (soundIcon) soundIcon.textContent = AppState.soundEnabled ? '🔊' : '🔇';

  const setSound = (enabled) => {
    AppState.soundEnabled = enabled;
    localStorage.setItem('ontrack_sound', enabled);
    if (toggleSound) toggleSound.checked = enabled;
    if (soundIcon) soundIcon.textContent = enabled ? '🔊' : '🔇';
    if (enabled && SoundEffects) SoundEffects.playCheck();
  };

  if (toggleSound) {
    toggleSound.addEventListener('change', (e) => setSound(e.target.checked));
  }
  if (soundHeaderBtn) {
    soundHeaderBtn.addEventListener('click', () => setSound(!AppState.soundEnabled));
  }

  // 2. Dark Mode Toggle
  const toggleDark = document.getElementById('toggle-dark-mode');
  const currentTheme = document.documentElement.getAttribute('data-theme') || localStorage.getItem('ontrack_theme') || 'light';
  if (toggleDark) {
    toggleDark.checked = (currentTheme === 'dark');
    toggleDark.addEventListener('change', (e) => {
      const theme = e.target.checked ? 'dark' : 'light';
      applyTheme(theme);
      if (AppState.soundEnabled && SoundEffects) SoundEffects.playCheck();
    });
  }

  // 3. Haptic Vibration Toggle
  const toggleHaptic = document.getElementById('toggle-haptic-fx');
  const savedHaptic = localStorage.getItem('ontrack_haptic');
  AppState.hapticEnabled = savedHaptic !== null ? (savedHaptic === 'true') : true;
  if (toggleHaptic) {
    toggleHaptic.checked = AppState.hapticEnabled;
    toggleHaptic.addEventListener('change', (e) => {
      AppState.hapticEnabled = e.target.checked;
      localStorage.setItem('ontrack_haptic', e.target.checked);
      if (e.target.checked && navigator.vibrate) {
        try { navigator.vibrate(35); } catch (err) {}
      }
      if (AppState.soundEnabled && SoundEffects) SoundEffects.playCheck();
    });
  }

  // 4. Auto-Shield Streak Protection Toggle
  const toggleAutoShield = document.getElementById('toggle-auto-shield');
  const savedShield = localStorage.getItem('ontrack_auto_shield');
  AppState.autoShield = savedShield !== null ? (savedShield === 'true') : true;
  if (toggleAutoShield) {
    toggleAutoShield.checked = AppState.autoShield;
    toggleAutoShield.addEventListener('change', (e) => {
      AppState.autoShield = e.target.checked;
      localStorage.setItem('ontrack_auto_shield', e.target.checked);
      if (AppState.soundEnabled && SoundEffects) SoundEffects.playCheck();
    });
  }

  // 5. Micro-Dose Bad Day Protocol Toggle
  const toggleMicroDose = document.getElementById('toggle-show-microdose');
  const savedMicro = localStorage.getItem('ontrack_show_microdose');
  AppState.showMicroDose = savedMicro !== null ? (savedMicro === 'true') : true;
  if (toggleMicroDose) {
    toggleMicroDose.checked = AppState.showMicroDose;
    toggleMicroDose.addEventListener('change', (e) => {
      AppState.showMicroDose = e.target.checked;
      localStorage.setItem('ontrack_show_microdose', e.target.checked);
      document.querySelectorAll('.btn-micro-dose-pill').forEach(btn => {
        btn.style.display = e.target.checked ? 'inline-flex' : 'none';
      });
      if (AppState.soundEnabled && SoundEffects) SoundEffects.playCheck();
    });
  }

  // 6. Daily Reminders Toggle
  const toggleReminders = document.getElementById('toggle-daily-reminders');
  const savedReminders = localStorage.getItem('ontrack_daily_reminders');
  AppState.remindersEnabled = savedReminders !== null ? (savedReminders === 'true') : true;
  if (toggleReminders) {
    toggleReminders.checked = AppState.remindersEnabled;
    toggleReminders.addEventListener('change', (e) => {
      AppState.remindersEnabled = e.target.checked;
      localStorage.setItem('ontrack_daily_reminders', e.target.checked);
      if (e.target.checked && 'Notification' in window && Notification.permission !== 'granted') {
        try { Notification.requestPermission(); } catch (err) {}
      }
      if (AppState.soundEnabled && SoundEffects) SoundEffects.playCheck();
    });
  }

  // 7. Habit Queue Toolbar: Hide Completed Toggle
  const toggleHideComp = document.getElementById('toggle-hide-completed');
  if (toggleHideComp) {
    toggleHideComp.addEventListener('change', (e) => {
      AppState.hideCompleted = e.target.checked;
      renderHabitQueue();
      if (AppState.soundEnabled && SoundEffects) SoundEffects.playCheck();
    });
  }

  // 8. Habit Queue Toolbar: Compact View Toggle
  const toggleCompact = document.getElementById('toggle-compact-view');
  const savedCompact = localStorage.getItem('ontrack_compact_cards') === 'true';
  AppState.compactView = savedCompact;
  if (toggleCompact) {
    toggleCompact.checked = savedCompact;
    toggleCompact.addEventListener('change', (e) => {
      AppState.compactView = e.target.checked;
      localStorage.setItem('ontrack_compact_cards', e.target.checked);
      renderHabitQueue();
      if (AppState.soundEnabled && SoundEffects) SoundEffects.playCheck();
    });
  }
}

// Floating Glowing Curved Dock Navigation
function updateGlowingNavIndicator(activeIdx) {
  const nav = document.getElementById('glowing-nav-menu');
  const track = document.getElementById('nav-indicator-track');
  if (nav) {
    nav.style.setProperty('--active-tab-index', activeIdx);
  }
  if (track) {
    track.style.transform = `translateX(${activeIdx * 100}%)`;
  }
}

function setupDockNavigation() {
  const dockBtns = document.querySelectorAll('.bottom-dock-nav .dock-btn');
  dockBtns.forEach((btn, idx) => {
    if (!btn.getAttribute('data-index')) {
      btn.setAttribute('data-index', idx);
    }
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '');
    if (hash) switchTab(hash);
  });

  if (window.location.hash) {
    switchTab(window.location.hash.replace('#', ''));
  } else {
    // Initialize indicator on the active button
    const activeBtn = document.querySelector('.bottom-dock-nav .dock-btn.active');
    if (activeBtn) {
      const idx = parseInt(activeBtn.getAttribute('data-index') || '0', 10);
      updateGlowingNavIndicator(idx);
    }
  }
}

function switchTab(tabId) {
  const cleanId = tabId.startsWith('tab-') ? tabId : `tab-${tabId}`;
  document.querySelectorAll('.tab-content-view').forEach(view => {
    view.classList.remove('active');
  });
  const targetView = document.getElementById(cleanId);
  if (targetView) {
    targetView.classList.add('active');
    if (window.AdvancedFeatures && window.AdvancedFeatures.observeNewElements) {
      window.AdvancedFeatures.observeNewElements(targetView);
    }
    if (cleanId === 'tab-settings' && window.TimeframeAnalyser) {
      const localData = window.TimeframeAnalyser.calculateLocalTimeframe(window.TimeframeAnalyser.currentPeriod);
      window.TimeframeAnalyser.renderUI(localData);
      setTimeout(() => window.TimeframeAnalyser.loadAnalysis(window.TimeframeAnalyser.currentPeriod), 60);
    }
  }

  let activeIdx = 0;
  document.querySelectorAll('.bottom-dock-nav .dock-btn').forEach((btn, idx) => {
    if (btn.getAttribute('data-tab') === cleanId || btn.getAttribute('data-tab') === tabId) {
      btn.classList.add('active');
      activeIdx = parseInt(btn.getAttribute('data-index') !== null ? btn.getAttribute('data-index') : idx, 10);
    } else {
      btn.classList.remove('active');
    }
  });

  updateGlowingNavIndicator(activeIdx);

  // Control Floating Action Button (+) visibility: Only show on Home / Tracker tab
  const fab = document.querySelector('.fab-add-habit');
  if (fab) {
    fab.style.display = (cleanId === 'tab-tracker') ? 'flex' : 'none';
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Render Palette Swatches in Add Modal
function renderMaterialPalettePicker() {
  const container = document.getElementById('palette-picker-container');
  const inputColor = document.getElementById('input-habit-color');
  if (!container || !inputColor) return;

  container.innerHTML = '';
  LOOP_MATERIAL_PALETTE.forEach((color, idx) => {
    const swatch = document.createElement('div');
    swatch.style.width = '34px';
    swatch.style.height = '34px';
    swatch.style.borderRadius = '50%';
    swatch.style.backgroundColor = color.hex;
    swatch.style.cursor = 'pointer';
    swatch.style.border = idx === 0 ? '3px solid #1E1B2E' : '2px solid transparent';
    swatch.style.boxShadow = '0 3px 8px rgba(0,0,0,0.12)';
    swatch.style.transition = 'transform 0.2s ease';
    swatch.title = color.name;

    swatch.addEventListener('click', () => {
      container.querySelectorAll('div').forEach(s => {
        s.style.border = '2px solid transparent';
        s.style.transform = 'scale(1)';
      });
      swatch.style.border = '3px solid #1E1B2E';
      swatch.style.transform = 'scale(1.15)';
      inputColor.value = color.hex;
    });

    container.appendChild(swatch);
  });
}

// Event Listeners for Filters, Modals, Forms
function setupEventListeners() {
  // Status Filter Pills (Screen 3)
  const filterPills = document.querySelectorAll('.status-filter-pill');
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      AppState.selectedFilter = pill.getAttribute('data-filter') || 'all';
      renderHabitQueue();
    });
  });

  // Ensure input gets immediate soft keyboard focus when modal opens
  const modalAddHabitEl = document.getElementById('modal-add-habit');
  if (modalAddHabitEl) {
    modalAddHabitEl.addEventListener('shown.bs.modal', () => {
      setTimeout(() => {
        const nameInput = document.getElementById('input-habit-name') || modalAddHabitEl.querySelector('input[name="name"]');
        if (nameInput) {
          nameInput.focus();
        }
      }, 60);
    });
  }

  // Save Habit Form (Reliable Instant Offline + Online Persistence)
  const formAddHabit = document.getElementById('form-add-habit');
  if (formAddHabit) {
    formAddHabit.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(formAddHabit);
      const nameInput = document.getElementById('input-habit-name');
      const nameVal = (nameInput ? nameInput.value : (formData.get('name') || '')).trim();
      if (!nameVal) {
        alert('Please enter a habit name (e.g. Practice Python or Morning Workout).');
        if (nameInput) nameInput.focus();
        return;
      }

      const colorVal = document.getElementById('input-habit-color')?.value || '#7A9A78';
      const categoryInput = document.getElementById('input-habit-category');
      const categoryVal = (categoryInput ? categoryInput.value : (formData.get('category') || '')).trim() || 'General';
      const habitType = formData.get('habit_type') || 'BOOLEAN';
      const targetVal = parseFloat(formData.get('target_value') || (habitType === 'MEASURABLE' ? 60 : 1.0));
      const unitVal = (formData.get('unit') || '').trim();
      const freqType = formData.get('frequency_type') || 'DAILY';
      const isPriority = formData.get('is_priority_crunch') === 'on';

      const payload = {
        name: nameVal,
        category: categoryVal,
        hex_color: colorVal,
        habit_type: habitType,
        target_value: targetVal,
        unit: unitVal,
        frequency_type: freqType,
        frequency_data: '0,1,2,3,4,5,6',
        is_priority_crunch: isPriority
      };

      if (!AppState.dates || AppState.dates.length !== 7) {
        AppState.dates = getOrGenerate7Dates();
      }

      const newId = Date.now();
      const newHabit = {
        id: newId,
        name: nameVal,
        category: categoryVal,
        hex_color: colorVal,
        habit_type: habitType,
        target_value: targetVal,
        unit: unitVal,
        frequency_type: freqType,
        frequency_data: '0,1,2,3,4,5,6',
        is_priority_crunch: isPriority,
        priority_level: isPriority ? 'high' : 'medium',
        metrics: {
          habit_strength: 0,
          current_streak: 0,
          best_streak: 0,
          total_completions: 0
        },
        seven_days: AppState.dates.map(d => ({
          habit_id: newId,
          checkin_date: d.date,
          status: 'UNCHECKED',
          value_completed: 0
        }))
      };

      // 1. Reset filter to 'all' so newly created habit is immediately visible
      AppState.selectedFilter = 'all';
      document.querySelectorAll('.status-filter-pill').forEach(pill => {
        pill.classList.toggle('active', pill.getAttribute('data-filter') === 'all');
      });

      // 2. Instantly store and display in user's isolated local storage
      if (!Array.isArray(AppState.habits)) AppState.habits = [];
      AppState.habits.unshift(newHabit);
      saveLocalHabits(AppState.habits);

      // 3. Reset form & close modal cleanly
      formAddHabit.reset();
      const modalEl = document.getElementById('modal-add-habit');
      if (modalEl && window.bootstrap) {
        try {
          const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
          if (modal) modal.hide();
        } catch (me) {}
      }
      document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
      document.body.classList.remove('modal-open');
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('padding-right');

      // 4. Ensure user is on the main habit queue tab
      switchTab('tab-tracker');

      // 5. Render immediately to the screen
      renderHabitQueue();
      renderKPICards(null);
      if (AppState.soundEnabled && SoundEffects) SoundEffects.playCheck();
      if (window.AndroidNative?.vibrate) {
        try { window.AndroidNative.vibrate(30); } catch (v) {}
      }

      // 6. Update day-after-day analysis in Settings
      if (window.TimeframeAnalyser && window.TimeframeAnalyser.loadAnalysis) {
        window.TimeframeAnalyser.loadAnalysis(window.TimeframeAnalyser.currentPeriod);
      }

      // 4. Opportunistically sync with backend database if available (skip in demo mode)
      if (!isDemoModeActive()) {
        try {
          const res = await fetch('/api/habits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (data && data.status === 'success' && data.habit && data.habit.id) {
            newHabit.id = data.habit.id;
            newHabit.seven_days.forEach(s => s.habit_id = data.habit.id);
            saveLocalHabits(AppState.habits);
            renderHabitQueue();
          }
        } catch (err) {
          // Safe offline mode
        }
      }
    });
  }

  // Type Switcher in Add Habit Modal
  const habitTypeSelect = document.getElementById('input-habit-type');
  const measurableInputs = document.getElementById('measurable-extra-inputs');
  if (habitTypeSelect && measurableInputs) {
    habitTypeSelect.addEventListener('change', () => {
      measurableInputs.style.display = habitTypeSelect.value === 'MEASURABLE' ? 'flex' : 'none';
    });
  }

  // Save Measurable Check-in Modal
  const btnSaveMeasurable = document.getElementById('btn-save-measurable-modal');
  if (btnSaveMeasurable) {
    btnSaveMeasurable.addEventListener('click', async () => {
      const habitId = parseInt(document.getElementById('modal-measurable-habit-id').value);
      const dateStr = document.getElementById('modal-measurable-date').value;
      const val = parseFloat(document.getElementById('modal-measurable-value').value || 0);
      const note = document.getElementById('modal-measurable-note').value;

      // Update local state immediately
      const habit = (AppState.habits || []).find(h => h.id === habitId);
      if (habit) {
        if (!habit.seven_days) habit.seven_days = [];
        let day = habit.seven_days.find(d => d.checkin_date === dateStr);
        if (!day) {
          day = { habit_id: habitId, checkin_date: dateStr, status: 'UNCHECKED', value_completed: 0 };
          habit.seven_days.push(day);
        }
        day.status = val >= (habit.target_value || 1) ? 'COMPLETED' : (val > 0 ? 'COMPLETED' : 'UNCHECKED');
        day.value_completed = val;
        day.note = note;
        if (!habit.metrics) habit.metrics = { habit_strength: 0, current_streak: 0, best_streak: 0, total_completions: 0 };
        habit.metrics.total_completions = (habit.metrics.total_completions || 0) + 1;
        habit.metrics.habit_strength = Math.min(100, (habit.metrics.habit_strength || 50) + 5);
        saveLocalHabits(AppState.habits);
      }

      const modalEl = document.getElementById('modal-measurable-checkin');
      if (modalEl && window.bootstrap) {
        try {
          const modal = bootstrap.Modal.getInstance(modalEl);
          if (modal) modal.hide();
        } catch (me) {}
      }
      document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
      document.body.classList.remove('modal-open');
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('padding-right');

      SoundEffects.playCheck();
      if (window.AdvancedFeatures) window.AdvancedFeatures.claimXP(50, 'Measurable study log');
      if (window.AndroidNative && window.AndroidNative.refreshWidget) window.AndroidNative.refreshWidget();
      renderHabitQueue();
      renderKPICards(null);

      try {
        await fetch('/api/checkins/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            habit_id: habitId,
            checkin_date: dateStr,
            value_completed: val,
            note: note
          })
        });
      } catch (err) {
        // Safe offline mode
      }
    });
  }

  // Sample Data & Database Reset Buttons in Settings
  const btnSeed = document.getElementById('btn-seed-sample-data');
  if (btnSeed) {
    btnSeed.addEventListener('click', async () => {
      if (confirm('Load sample habits, stacks, and duels?')) {
        try {
          await fetch('/api/backup/seed-demo', { method: 'POST' });
          alert('OnTrack sample habits & study routines reloaded!');
          loadDashboardData();
        } catch (e) {
          location.reload();
        }
      }
    });
  }

  const btnReset = document.getElementById('btn-reset-database');
  if (btnReset) {
    btnReset.addEventListener('click', async () => {
      if (confirm('Are you sure you want to wipe all habits? This cannot be undone.')) {
        try {
          await fetch('/api/backup/reset-database', { method: 'POST' });
          alert('Database reset complete.');
          loadDashboardData();
        } catch (e) {
          location.reload();
        }
      }
    });
  }
}

// Load Dashboard Habits & KPIs
async function loadDashboardData() {
  const demoBanner = document.getElementById('demo-mode-banner');
  if (demoBanner) {
    demoBanner.style.display = isDemoModeActive() ? 'flex' : 'none';
  }

  // Demo Mode: Completely isolated offline sample dataset
  if (isDemoModeActive()) {
    loadOfflineFallbackData();
    renderKPICards(null);
    renderHabitQueue();
    return;
  }

  try {
    const [habitsRes, summaryRes] = await Promise.all([
      fetch('/api/habits').catch(() => null),
      fetch('/api/analytics/summary').catch(() => null)
    ]);

    let habitsData = habitsRes ? await habitsRes.json().catch(() => null) : null;
    let summaryData = summaryRes ? await summaryRes.json().catch(() => null) : null;

    if (habitsData && habitsData.status === 'success' && Array.isArray(habitsData.habits)) {
      AppState.habits = habitsData.habits;
      AppState.dates = (habitsData.dates && habitsData.dates.length === 7) ? habitsData.dates : getOrGenerate7Dates();
      saveLocalHabits(AppState.habits);
    } else {
      loadOfflineFallbackData();
    }

    renderKPICards(summaryData ? summaryData.kpis : null);
    renderHabitQueue();
  } catch (err) {
    console.warn('Network load failed, using fallback data:', err);
    loadOfflineFallbackData();
    renderKPICards(null);
    renderHabitQueue();
  }
}
window.loadDashboardData = loadDashboardData;

function getSampleDemoHabits(dates) {
  return [
    {
      id: 101,
      name: "Write product description",
      category: "Web Dev",
      hex_color: "#10B981",
      habit_type: "MEASURABLE",
      target_value: 60.0,
      unit: "mins",
      is_priority_crunch: true,
      priority_level: "high",
      metrics: { habit_strength: 75.0, current_streak: 5, best_streak: 14, total_completions: 24 },
      seven_days: dates.map((d, idx) => ({
        habit_id: 101, checkin_date: d.date, status: idx > 1 ? "COMPLETED" : "SKIPPED", value_completed: 60
      }))
    },
    {
      id: 102,
      name: "User testing session",
      category: "UX Research",
      hex_color: "#FF7043",
      habit_type: "BOOLEAN",
      target_value: 1.0,
      unit: "",
      is_priority_crunch: false,
      priority_level: "low",
      metrics: { habit_strength: 60.0, current_streak: 2, best_streak: 8, total_completions: 16 },
      seven_days: dates.map((d, idx) => ({
        habit_id: 102, checkin_date: d.date, status: idx % 2 === 0 ? "COMPLETED" : "UNCHECKED", value_completed: 1
      }))
    },
    {
      id: 103,
      name: "Database optimization",
      category: "Core CS",
      hex_color: "#3B82F6",
      habit_type: "MEASURABLE",
      target_value: 45.0,
      unit: "mins",
      is_priority_crunch: false,
      priority_level: "medium",
      metrics: { habit_strength: 45.0, current_streak: 3, best_streak: 10, total_completions: 18 },
      seven_days: dates.map((d, idx) => ({
        habit_id: 103, checkin_date: d.date, status: idx > 3 ? "COMPLETED" : "UNCHECKED", value_completed: 45
      }))
    },
    {
      id: 104,
      name: "Practice Python & Algorithms",
      category: "Core CS",
      hex_color: "#7C5CFC",
      habit_type: "MEASURABLE",
      target_value: 60.0,
      unit: "mins",
      is_priority_crunch: true,
      priority_level: "high",
      metrics: { habit_strength: 88.0, current_streak: 8, best_streak: 20, total_completions: 28 },
      seven_days: dates.map(d => ({
        habit_id: 104, checkin_date: d.date, status: "COMPLETED", value_completed: 60
      }))
    }
  ];
}

function loadOfflineFallbackData() {
  const dates = getOrGenerate7Dates();
  AppState.dates = dates;

  // 1. DEMO MODE: Load isolated sample tasks & streaks
  if (isDemoModeActive()) {
    const demoRaw = localStorage.getItem('ontrack_demo_habits');
    if (demoRaw) {
      try {
        const parsed = JSON.parse(demoRaw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          AppState.habits = parsed.map(h => {
            if (!h.seven_days || h.seven_days.length !== 7) {
              h.seven_days = dates.map(d => ({
                habit_id: h.id, checkin_date: d.date, status: 'UNCHECKED', value_completed: 0
              }));
            }
            return h;
          });
          return;
        }
      } catch (e) {}
    }
    // Initialize default demo dataset
    AppState.habits = getSampleDemoHabits(dates);
    localStorage.setItem('ontrack_demo_habits', JSON.stringify(AppState.habits));
    return;
  }

  // 2. REGULAR USER: Load user's private local cache
  const saved = getLocalHabits();
  if (saved !== null) {
    AppState.habits = saved.map(h => {
      if (!h.history) h.history = {};
      if (Array.isArray(h.seven_days)) {
        h.seven_days.forEach(d => {
          if (d && d.checkin_date) {
            h.history[d.checkin_date] = {
              status: d.status,
              value_completed: d.value_completed || 0
            };
          }
        });
      }
      // Re-align rolling 7-day window with today's dates
      h.seven_days = dates.map(d => {
        const hist = h.history[d.date];
        return {
          habit_id: h.id,
          checkin_date: d.date,
          status: hist ? hist.status : 'UNCHECKED',
          value_completed: hist ? (hist.value_completed || 0) : 0
        };
      });
      return h;
    });
    return;
  }

  // 3. NEW USER WITHOUT DEMO: Completely fresh empty list, 0 tasks!
  AppState.habits = [];
  saveLocalHabits([]);
}

// Render 4 KPI Cards (Matching Screen 2)
function renderKPICards(kpis) {
  const falteringEl = document.getElementById('kpi-faltering-count');
  const rateEl = document.getElementById('kpi-today-rate');
  const countBadge = document.getElementById('active-habits-count-badge');

  const habits = AppState.habits || [];
  if (countBadge) countBadge.textContent = `${habits.length} Active`;

  // Count faltering habits (habits with prior activity whose strength drops < 40%)
  const falteringCount = habits.filter(h => {
    const comps = h.metrics?.total_completions || 0;
    const strength = h.metrics?.habit_strength || 0;
    return comps > 0 && strength < 40;
  }).length;
  if (falteringEl) falteringEl.textContent = String(falteringCount).padStart(2, '0');

  // Overall consistency rate calculated directly from day-after-day check-ins
  const linearFill = document.getElementById('daily-progress-bar-fill');
  const percentBadge = document.getElementById('daily-progress-percent-badge');
  const summaryText = document.getElementById('daily-progress-summary-text');
  const ringBar = document.getElementById('daily-progress-ring-bar');
  const circumference = 2 * Math.PI * 40; // ~251.327

  if (rateEl) {
    if (habits.length === 0) {
      rateEl.textContent = '0%';
      if (percentBadge) percentBadge.textContent = '0%';
      if (linearFill) linearFill.style.width = '0%';
      if (summaryText) summaryText.textContent = '0 tasks active — add your first habit below';
      if (ringBar) {
        ringBar.style.strokeDasharray = circumference;
        ringBar.style.strokeDashoffset = circumference;
      }
    } else {
      let totalSlots = 0;
      let totalCompleted = 0;
      habits.forEach(h => {
        const days = h.seven_days || [];
        totalSlots += days.length;
        totalCompleted += days.filter(d => d.status === 'COMPLETED' || d.status === 'MICRO_DOSE').length;
      });
      const avg = totalSlots > 0 ? Math.round((totalCompleted / totalSlots) * 100) : 0;
      rateEl.textContent = `${avg}%`;
      if (percentBadge) percentBadge.textContent = `${avg}%`;
      if (linearFill) linearFill.style.width = `${avg}%`;
      if (summaryText) summaryText.textContent = `${totalCompleted} of ${totalSlots} check-ins completed today`;
      if (ringBar) {
        ringBar.style.strokeDasharray = circumference;
        const offset = circumference - (circumference * (avg / 100));
        ringBar.style.strokeDashoffset = offset;
      }
    }
  }
}

// Color Utility Helpers for Radiant Jewel Buttons
function shadeColor(color, percent) {
  let num = parseInt(color.replace('#', ''), 16);
  let amt = Math.round(2.55 * percent);
  let R = (num >> 16) + amt;
  let B = ((num >> 8) & 0x00FF) + amt;
  let G = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 + (B < 255 ? (B < 1 ? 0 : B) : 255) * 0x100 + (G < 255 ? (G < 1 ? 0 : G) : 255)).toString(16).slice(1);
}

function hexToRgba(hex, alpha) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  let num = parseInt(c, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Render Habit Queue with Segmented Progress & 7-Day Loop Checkins
function renderHabitQueue() {
  const container = document.getElementById('habit-queue-container');
  const emptyState = document.getElementById('matrix-empty-state');
  if (!container) return;

  let filtered = AppState.habits || [];
  if (AppState.selectedFilter === 'high') {
    filtered = filtered.filter(h => h.is_priority_crunch || h.priority_level === 'high');
  } else if (AppState.selectedFilter === 'medium') {
    filtered = filtered.filter(h => !h.is_priority_crunch && (h.metrics?.habit_strength || 0) >= 40);
  } else if (AppState.selectedFilter === 'low') {
    filtered = filtered.filter(h => (h.metrics?.habit_strength || 0) < 55);
  }

  if (filtered.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  if (emptyState) emptyState.style.display = 'none';

  container.innerHTML = '';
  filtered.forEach((habit, idx) => {
    try {
      const card = document.createElement('div');
      card.className = 'habit-queue-card revealed';
      card.style.opacity = '1';
      card.style.visibility = 'visible';
      card.style.display = 'block';
      card.setAttribute('data-habit-id', String(habit.id));

      const habitColor = habit.hex_color || '#7C5CFC';
      const darkerColor = shadeColor(habitColor, -25);
      const lighterColor = shadeColor(habitColor, 20);

      // Priority pill class & label
      let priorityClass = 'medium';
      let priorityLabel = 'Medium';
      if (habit.is_priority_crunch || habit.priority_level === 'high') {
        priorityClass = 'high';
        priorityLabel = 'High';
      } else if ((habit.metrics?.habit_strength || 0) < 50 || habit.priority_level === 'low') {
        priorityClass = 'low';
        priorityLabel = 'Low';
      }

      const strength = Math.round(habit.metrics?.habit_strength || 0);

      // Build 20 segmented vertical tick bars
      const totalTicks = 20;
      const filledTicks = Math.round((strength / 100) * totalTicks);
      let ticksHtml = '';
      for (let i = 0; i < totalTicks; i++) {
        const isFilled = i < filledTicks;
        ticksHtml += `<span class="seg-tick ${isFilled ? `fill ${priorityClass}` : ''}"></span>`;
      }

      // Ensure 7 dates exist
      let sevenDays = habit.seven_days;
      if (!Array.isArray(sevenDays) || sevenDays.length !== 7) {
        if (!AppState.dates || AppState.dates.length !== 7) {
          AppState.dates = getOrGenerate7Dates();
        }
        sevenDays = AppState.dates.map(d => ({
          habit_id: habit.id,
          checkin_date: d.date,
          status: (habit.history && habit.history[d.date] && habit.history[d.date].status) || 'UNCHECKED',
          value_completed: (habit.history && habit.history[d.date] && habit.history[d.date].value_completed) || 0
        }));
        habit.seven_days = sevenDays;
      }

      // Build 7-Day Loop Checkin Circles with Radiant Tactile Gradients
      let loopChecksHtml = '';
      sevenDays.forEach(day => {
        if (!day) return;
        const isComp = day.status === 'COMPLETED';
        const isSkip = day.status === 'SKIPPED';
        const dayDate = day.checkin_date || '';
        const dayLetter = dayDate ? getDayLetter(dayDate) : '•';

        let circleContent = '';
        let circleStyle = '';
        if (isComp) {
          circleContent = ICONS.check;
          circleStyle = `background: linear-gradient(135deg, ${lighterColor} 0%, ${darkerColor} 100%); box-shadow: 0 5px 16px ${hexToRgba(habitColor, 0.45)}, inset 0 2px 3px rgba(255, 255, 255, 0.55);`;
        } else if (isSkip) {
          circleContent = ICONS.pause;
        }

        loopChecksHtml += `
          <div class="checkin-day-pill">
            <span class="checkin-day-label">${dayLetter}</span>
            <button class="loop-checkin-circle ${isComp ? 'completed' : (isSkip ? 'skipped' : 'unchecked')}"
                    style="${circleStyle}"
                    data-habit-id="${habit.id}"
                    data-date="${dayDate}"
                    title="${isComp ? 'Completed' : (isSkip ? 'Skipped' : 'Tap to Complete')}">
              ${circleContent}
            </button>
          </div>
        `;
      });

      const microDoseStyle = AppState.showMicroDose ? '' : 'display:none;';
      card.innerHTML = `
        <div class="card-top-meta">
          <span class="priority-pill ${priorityClass}">● ${priorityLabel}</span>
          <div style="display:flex; align-items:center; gap:6px;">
            <button class="btn-micro-dose-pill" style="${microDoseStyle}" title="Bad Day Protocol: 1-Tap Micro-Dose (Preserves Streak)">
              🛡️ Micro
            </button>
            <button class="btn-card-menu" title="Habit options">⋮</button>
          </div>
        </div>

        <h5 class="habit-card-title">${escapeHtml(habit.name || 'Untitled Habit')}</h5>
        <div class="habit-card-subtitle">${escapeHtml(habit.category || 'General')} • Target: ${habit.target_value || 1} ${escapeHtml(habit.unit || 'times')}</div>

        <!-- Segmented Progress Bar (Screen 3) -->
        <div class="segmented-progress-wrap">
          <div class="segmented-progress-header">
            <span>Progress</span>
            <span class="segmented-percent-badge">${strength}%</span>
          </div>
          <div class="segmented-bar-ticks">
            ${ticksHtml}
          </div>
        </div>

        <!-- 7-Day Loop Tactile Check-in Row -->
        <div class="loop-checkin-row">
          ${loopChecksHtml}
        </div>
      `;

      // Clicking the card body opens deep-dive analytics directly on mobile!
      card.addEventListener('click', () => {
        if (window.AnalyticsModal) window.AnalyticsModal.open(habit.id);
      });

      // Micro-dose button
      const btnMicro = card.querySelector('.btn-micro-dose-pill');
      if (btnMicro) {
        btnMicro.addEventListener('click', (e) => {
          e.stopPropagation();
          if (window.AdvancedFeatures && window.AdvancedFeatures.activateMicroDose) {
            window.AdvancedFeatures.activateMicroDose(habit.id, habit.name);
          }
        });
      }

      // Options menu button
      const btnMenu = card.querySelector('.btn-card-menu');
      if (btnMenu) {
        btnMenu.addEventListener('click', (e) => {
          e.stopPropagation();
          if (window.AnalyticsModal && window.AnalyticsModal.open) {
            window.AnalyticsModal.open(habit.id);
          }
        });
      }

      // Wire up the circular check buttons
      card.querySelectorAll('.loop-checkin-circle').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const dateStr = btn.getAttribute('data-date');
          const dayObj = sevenDays.find(d => d.checkin_date === dateStr) || { checkin_date: dateStr, status: 'UNCHECKED' };
          handleCheckinToggle(habit, dayObj, btn);
        });
      });

      container.appendChild(card);
    } catch (err) {
      console.error('Error rendering habit card:', err, habit);
    }
  });

  if (window.AdvancedFeatures && window.AdvancedFeatures.observeNewElements) {
    window.AdvancedFeatures.observeNewElements(container);
  }
}

function getDayLetter(dateStr) {
  const d = new Date(dateStr);
  const letters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return letters[d.getDay()] || '•';
}

// 3-State Check-in Toggle (Completed -> Skipped -> Unchecked)
async function handleCheckinToggle(habit, day, circleBtn) {
  AppState.activeCheckinHabitId = habit.id;
  AppState.activeCheckinDate = day.checkin_date;

  if (window.AndroidNative?.vibrate) {
    try { window.AndroidNative.vibrate(25); } catch (e) {}
  }

  if (habit.habit_type === 'MEASURABLE' && day.status === 'UNCHECKED') {
    openMeasurableModal(habit, day);
    return;
  }

  // 1. Determine next 3-state cycle: UNCHECKED -> COMPLETED -> SKIPPED -> UNCHECKED
  let nextStatus = 'COMPLETED';
  if (day.status === 'COMPLETED') {
    nextStatus = 'SKIPPED';
  } else if (day.status === 'SKIPPED') {
    nextStatus = 'UNCHECKED';
  } else {
    nextStatus = 'COMPLETED';
  }

  day.status = nextStatus;
  if (!habit.metrics) habit.metrics = { habit_strength: 0, current_streak: 0, best_streak: 0, total_completions: 0 };
  if (!habit.history) habit.history = {};

  if (nextStatus === 'COMPLETED') {
    day.value_completed = habit.target_value || 1;
    habit.metrics.total_completions = (habit.metrics.total_completions || 0) + 1;
    habit.metrics.current_streak = (habit.metrics.current_streak || 0) + 1;
    if (habit.metrics.current_streak > (habit.metrics.best_streak || 0)) {
      habit.metrics.best_streak = habit.metrics.current_streak;
    }
    habit.metrics.habit_strength = Math.min(100, (habit.metrics.habit_strength || 0) + 15);
    SoundEffects.playCheck();
    if (window.AdvancedFeatures) window.AdvancedFeatures.claimXP(50, `Completed ${habit.name}`);
  } else if (nextStatus === 'SKIPPED') {
    day.value_completed = 0;
    SoundEffects.playSkip();
  } else {
    day.value_completed = 0;
    habit.metrics.total_completions = Math.max(0, (habit.metrics.total_completions || 1) - 1);
    habit.metrics.current_streak = Math.max(0, (habit.metrics.current_streak || 1) - 1);
    habit.metrics.habit_strength = Math.max(0, (habit.metrics.habit_strength || 15) - 15);
  }

  // Record day-after-day history
  habit.history[day.checkin_date] = {
    status: day.status,
    value_completed: day.value_completed
  };

  // 2. Persist locally and update UI instantly
  saveLocalHabits(AppState.habits);
  renderHabitQueue();
  renderKPICards(null);

  // Update Settings day-after-day charts
  if (window.TimeframeAnalyser && window.TimeframeAnalyser.loadAnalysis) {
    window.TimeframeAnalyser.loadAnalysis(window.TimeframeAnalyser.currentPeriod);
  }
  if (window.AndroidNative && window.AndroidNative.refreshWidget) {
    try { window.AndroidNative.refreshWidget(); } catch (e) {}
  }

  // 3. Background server sync (skip in demo mode)
  if (!isDemoModeActive()) {
    try {
      await fetch('/api/checkins/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          habit_id: habit.id,
          checkin_date: day.checkin_date
        })
      });
    } catch (err) {
      // Offline / Android APK mode preserved
    }
  }
}

function openMeasurableModal(habit, day) {
  document.getElementById('modal-measurable-habit-id').value = habit.id;
  document.getElementById('modal-measurable-date').value = day.checkin_date;
  document.getElementById('modal-measurable-title').textContent = `Log ${habit.name}`;
  document.getElementById('modal-measurable-unit-label').textContent = habit.unit ? `(${habit.unit})` : '';
  document.getElementById('modal-measurable-value').value = habit.target_value || '';
  document.getElementById('modal-measurable-note').value = day.note || '';

  const modalEl = document.getElementById('modal-measurable-checkin');
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

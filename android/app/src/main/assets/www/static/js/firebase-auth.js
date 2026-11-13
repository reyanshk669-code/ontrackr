/**
 * OnTrack Firebase Authentication & User Profile Manager
 * Project: ontrack-42597 (Package: com.reyansh.ontrack)
 */

const FirebaseAuthManager = {
  currentUser: null,

  init() {
    this.loadCachedUser();
    this.setupUI();
    this.updateUIState();
  },

  isDemoMode() {
    return Boolean(this.currentUser && this.currentUser.isDemo === true);
  },

  getUserId() {
    if (this.isDemoMode()) {
      return 'demo_user';
    }
    if (this.currentUser && this.currentUser.uid) {
      return this.currentUser.uid;
    }
    return 'guest';
  },

  enterDemoMode(fromOnboarding = false) {
    const demoUser = {
      uid: 'demo_user',
      email: 'demo@ontrack.app',
      displayName: 'Demo Account',
      isDemo: true,
      provider: 'demo',
      lastLogin: new Date().toLocaleDateString()
    };

    if (fromOnboarding) {
      localStorage.setItem('ontrack_onboarding_completed', 'true');
      const overlay = document.getElementById('onboarding-modal-overlay');
      if (overlay) {
        overlay.style.display = 'none';
        overlay.classList.remove('active');
      }
    }

    const modalEl = document.getElementById('modal-firebase-auth');
    if (modalEl && window.bootstrap) {
      const m = bootstrap.Modal.getInstance(modalEl);
      if (m) m.hide();
    }

    this.saveUser(demoUser);
    if (window.SoundEffects) window.SoundEffects.playCheck();
    this.showToast('✨ Entered Demo Mode with sample tasks & streaks!');
  },

  exitDemoMode() {
    this.saveUser(null);
    if (window.SoundEffects) window.SoundEffects.playCheck();
    this.showToast('Exited Demo Mode. Loaded fresh account.');

    const modalEl = document.getElementById('modal-firebase-auth');
    if (modalEl && window.bootstrap) {
      const m = bootstrap.Modal.getOrCreateInstance(modalEl);
      m.show();
    }
  },

  // Generates a consistent, unique user id for each distinct email
  generateUserIdFromEmail(email) {
    try {
      const clean = email.toLowerCase().trim();
      const b64 = btoa(clean).replace(/[^a-zA-Z0-9]/g, '');
      return 'usr_' + b64.substring(0, 24);
    } catch (e) {
      return 'usr_' + Math.random().toString(36).substring(2, 12);
    }
  },

  loadCachedUser() {
    try {
      const saved = localStorage.getItem('ontrack_firebase_user');
      if (saved) {
        this.currentUser = JSON.parse(saved);
      }
    } catch (e) {
      this.currentUser = null;
    }
  },

  saveUser(user) {
    this.currentUser = user;
    if (user) {
      localStorage.setItem('ontrack_firebase_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('ontrack_firebase_user');
    }
    this.updateUIState();

    // Trigger full app reload with the new user's isolated data
    if (window.loadDashboardData) {
      window.loadDashboardData();
    }
    if (window.AdvancedFeatures && window.AdvancedFeatures.loadAllData) {
      window.AdvancedFeatures.loadAllData();
    } else if (window.AdvancedUI && window.AdvancedUI.loadAllFeatures) {
      window.AdvancedUI.loadAllFeatures();
    }
    if (window.TimeframeAnalyser && window.TimeframeAnalyser.loadAnalysis) {
      window.TimeframeAnalyser.loadAnalysis(window.TimeframeAnalyser.currentPeriod);
    }
  },

  // Simulate or execute email authentication
  async signInWithEmail(email, password) {
    if (!email || !password) {
      alert("Please enter both email and password.");
      return;
    }

    // If native Android Firebase Auth is available
    if (window.AndroidNative && window.AndroidNative.firebaseSignIn) {
      window.AndroidNative.firebaseSignIn(email, password);
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const displayName = cleanEmail.split('@')[0];
    const uid = this.generateUserIdFromEmail(cleanEmail);

    const user = {
      uid: uid,
      email: cleanEmail,
      displayName: displayName.charAt(0).toUpperCase() + displayName.slice(1),
      lastLogin: new Date().toLocaleDateString(),
      provider: 'password'
    };

    this.saveUser(user);
    if (window.SoundEffects) window.SoundEffects.playCheck();
    this.showToast(`✨ Welcome back, ${user.displayName}! Loaded your personal tasks.`);
    
    // Close modal if open
    const modalEl = document.getElementById('modal-firebase-auth');
    if (modalEl && window.bootstrap) {
      const m = bootstrap.Modal.getInstance(modalEl);
      if (m) m.hide();
    }
  },

  async signUpWithEmail(email, password, confirmPassword) {
    if (!email || !password) {
      alert("Please enter an email and password.");
      return;
    }
    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const displayName = cleanEmail.split('@')[0];
    const uid = this.generateUserIdFromEmail(cleanEmail);

    const user = {
      uid: uid,
      email: cleanEmail,
      displayName: displayName.charAt(0).toUpperCase() + displayName.slice(1),
      lastLogin: new Date().toLocaleDateString(),
      provider: 'password'
    };

    // New user created: clean slate, 0 tasks from previous users
    this.saveUser(user);
    if (window.SoundEffects) window.SoundEffects.playCheck();
    this.showToast(`🎉 Account created! Welcome, ${user.displayName}. Your fresh habit tracker is ready.`);

    const modalEl = document.getElementById('modal-firebase-auth');
    if (modalEl && window.bootstrap) {
      const m = bootstrap.Modal.getInstance(modalEl);
      if (m) m.hide();
    }
  },

  signOut() {
    this.saveUser(null);
    if (window.SoundEffects) window.SoundEffects.playCheck();
    this.showToast("Signed out. Switched to guest mode.");
  },

  updateUIState() {
    const avatarEl = document.getElementById('header-auth-avatar');
    const statusTextEl = document.getElementById('firebase-auth-status-text');
    const emailTextEl = document.getElementById('firebase-auth-user-email');
    const signedInView = document.getElementById('firebase-signed-in-section');
    const signedOutView = document.getElementById('firebase-signed-out-section');
    const profileNameEl = document.getElementById('fb-profile-name');
    const profileEmailEl = document.getElementById('fb-profile-email');
    const greetingUserEl = document.getElementById('greeting-user-name');
    const demoBanner = document.getElementById('demo-mode-banner');

    if (this.isDemoMode()) {
      if (avatarEl) avatarEl.textContent = '👀';
      if (statusTextEl) statusTextEl.textContent = 'Demo Mode (Sample Data)';
      if (emailTextEl) emailTextEl.textContent = 'demo@ontrack.app';
      if (profileNameEl) profileNameEl.textContent = 'Demo Account';
      if (profileEmailEl) profileEmailEl.textContent = 'demo@ontrack.app';
      if (signedInView) signedInView.style.display = 'block';
      if (signedOutView) signedOutView.style.display = 'none';
      if (greetingUserEl) greetingUserEl.textContent = ', Demo User';
      if (demoBanner) demoBanner.style.display = 'flex';
    } else if (this.currentUser) {
      if (avatarEl) avatarEl.textContent = '🟢';
      if (statusTextEl) statusTextEl.textContent = 'Connected (Cloud Synced)';
      if (emailTextEl) emailTextEl.textContent = this.currentUser.email;
      if (profileNameEl) profileNameEl.textContent = this.currentUser.displayName;
      if (profileEmailEl) profileEmailEl.textContent = this.currentUser.email;
      if (signedInView) signedInView.style.display = 'block';
      if (signedOutView) signedOutView.style.display = 'none';
      if (greetingUserEl) greetingUserEl.textContent = `, ${this.currentUser.displayName}`;
      if (demoBanner) demoBanner.style.display = 'none';
    } else {
      if (avatarEl) avatarEl.textContent = '👤';
      if (statusTextEl) statusTextEl.textContent = 'Guest / Fresh Account';
      if (emailTextEl) emailTextEl.textContent = 'Not signed in';
      if (profileNameEl) profileNameEl.textContent = 'Guest User';
      if (profileEmailEl) profileEmailEl.textContent = 'Local Storage Only';
      if (signedInView) signedInView.style.display = 'none';
      if (signedOutView) signedOutView.style.display = 'block';
      if (greetingUserEl) greetingUserEl.textContent = '';
      if (demoBanner) demoBanner.style.display = 'none';
    }
  },

  setupUI() {
    // Dynamic floating label & input value tracking for all auth inputs
    document.querySelectorAll('.neu-input-group input').forEach(input => {
      const updateValueClass = () => {
        if (input.value && input.value.trim().length > 0) {
          input.classList.add('has-value');
        } else {
          input.classList.remove('has-value');
        }
      };
      input.addEventListener('input', updateValueClass);
      input.addEventListener('change', updateValueClass);
      input.addEventListener('blur', updateValueClass);
      updateValueClass();
    });

    // Form Sign In
    const formSignIn = document.getElementById('form-firebase-signin');
    if (formSignIn) {
      formSignIn.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('fb-signin-email').value.trim();
        const pass = document.getElementById('fb-signin-password').value;
        this.signInWithEmail(email, pass);
      });
    }

    // Form Sign Up
    const formSignUp = document.getElementById('form-firebase-signup');
    if (formSignUp) {
      formSignUp.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('fb-signup-email').value.trim();
        const pass = document.getElementById('fb-signup-password').value;
        const confirm = document.getElementById('fb-signup-confirm').value;
        this.signUpWithEmail(email, pass, confirm);
      });
    }

    // Sign out button
    const btnSignOut = document.getElementById('btn-firebase-signout');
    if (btnSignOut) {
      btnSignOut.addEventListener('click', () => this.signOut());
    }
  },

  showToast(msg) {
    if (window.AdvancedFeatures && window.AdvancedFeatures.showToast) {
      window.AdvancedFeatures.showToast(msg);
    } else {
      alert(msg);
    }
  }
};

// Neumorphic 3D Card Flip & Password Visibility Helpers
function flipCard(cardId) {
  const card = document.getElementById(cardId || "authCard");
  if (card) {
    card.classList.toggle("flipped");
  }
}

function togglePassword(inputId, button) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPass = input.type === "password";
  input.type = isPass ? "text" : "password";
  if (button) {
    const icon = button.querySelector('i');
    const svg = button.querySelector('svg');
    if (icon) {
      if (isPass) {
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
      } else {
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
      }
    }
    if (svg) {
      if (isPass) {
        svg.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
      } else {
        svg.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
      }
    }
  }
}

window.flipCard = flipCard;
window.togglePassword = togglePassword;
window.FirebaseAuthManager = FirebaseAuthManager;

// Immediately hydrate cached user synchronously so subsequent scripts know the user identity
FirebaseAuthManager.loadCachedUser();

document.addEventListener('DOMContentLoaded', () => {
  FirebaseAuthManager.init();
});

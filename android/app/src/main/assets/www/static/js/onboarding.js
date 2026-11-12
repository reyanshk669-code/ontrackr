/**
 * OnTrack First-Time User Onboarding & Setup Wizard
 * Flow:
 * 1. Notifications & Offline Data Storage Permissions
 * 2. Login or Create Account (Firebase Auth)
 * 3. Age Selection
 * 4. Designation / Role (Student, Working Professional, etc.)
 * 5. Finish & Enter App (Flagged in localStorage so it never asks again!)
 */

const OnboardingManager = {
  currentStep: 1,
  totalSteps: 4,
  userAge: 20,
  userDesignation: 'student',

  init() {
    this.checkOnboardingStatus();
    this.setupEventListeners();
    this.updateSettingsProfileDisplay();
  },

  checkOnboardingStatus() {
    const completed = localStorage.getItem('ontrack_onboarding_completed');
    const overlay = document.getElementById('onboarding-modal-overlay');
    if (!overlay) return;

    if (completed === 'true') {
      // User has already completed onboarding. Do NOT show again!
      overlay.style.display = 'none';
      overlay.classList.remove('active');
    } else {
      // First-time download / new install: show onboarding flow
      overlay.style.display = 'flex';
      overlay.classList.add('active');
      this.goToStep(1);
    }
  },

  goToStep(stepNumber) {
    this.currentStep = stepNumber;

    // Hide all step panes
    document.querySelectorAll('.onboarding-step-pane').forEach(pane => {
      pane.style.display = 'none';
      pane.classList.remove('active');
    });

    // Show target step pane
    const targetPane = document.getElementById(`onboarding-step-${stepNumber}`);
    if (targetPane) {
      targetPane.style.display = 'block';
      targetPane.classList.add('active');
    }

    // Update progress dots
    document.querySelectorAll('.onboarding-dot').forEach((dot, idx) => {
      if (idx + 1 === stepNumber) {
        dot.classList.add('active');
        dot.classList.remove('completed');
      } else if (idx + 1 < stepNumber) {
        dot.classList.remove('active');
        dot.classList.add('completed');
      } else {
        dot.classList.remove('active');
        dot.classList.remove('completed');
      }
    });

    const stepLabel = document.getElementById('onboarding-step-count');
    if (stepLabel) {
      stepLabel.textContent = `Step ${stepNumber} of ${this.totalSteps}`;
    }
  },

  requestNotifications() {
    // 1. If native Android interface exists, invoke native runtime permission
    if (window.AndroidNative && window.AndroidNative.requestSystemPermissions) {
      window.AndroidNative.requestSystemPermissions();
    }

    // 2. Browser Notifications API
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission().then(permission => {
        const btn = document.getElementById('btn-allow-notifications');
        if (btn) {
          if (permission === 'granted') {
            btn.innerHTML = '✓ Notifications Allowed';
            btn.classList.remove('btn-outline-primary');
            btn.classList.add('btn-success');
          } else {
            btn.innerHTML = 'Checked (System Managed)';
          }
        }
      });
    } else {
      const btn = document.getElementById('btn-allow-notifications');
      if (btn) {
        btn.innerHTML = '✓ Notifications Allowed';
        btn.classList.remove('btn-outline-primary');
        btn.classList.add('btn-success');
      }
    }
  },

  setupEventListeners() {
    // Step 1: Auth Switcher (Sign In vs Create Account)
    const btnTabCreate = document.getElementById('onboarding-tab-create');
    const btnTabSignIn = document.getElementById('onboarding-tab-signin');
    const formCreate = document.getElementById('onboarding-form-create');
    const formSignIn = document.getElementById('onboarding-form-signin');

    if (btnTabCreate && btnTabSignIn) {
      btnTabCreate.addEventListener('click', () => {
        btnTabCreate.classList.add('active');
        btnTabSignIn.classList.remove('active');
        if (formCreate) formCreate.style.display = 'block';
        if (formSignIn) formSignIn.style.display = 'none';
      });

      btnTabSignIn.addEventListener('click', () => {
        btnTabSignIn.classList.add('active');
        btnTabCreate.classList.remove('active');
        if (formSignIn) formSignIn.style.display = 'block';
        if (formCreate) formCreate.style.display = 'none';
      });
    }

    // Step 1: Form Create Account -> Advances to Step 2 (Permissions)
    if (formCreate) {
      formCreate.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('onboarding-create-email').value.trim();
        const pass = document.getElementById('onboarding-create-password').value;
        const confirm = document.getElementById('onboarding-create-confirm').value;

        if (!email || !pass) {
          alert('Please enter an email and password.');
          return;
        }
        if (pass !== confirm) {
          alert('Passwords do not match.');
          return;
        }
        if (pass.length < 6) {
          alert('Password must be at least 6 characters.');
          return;
        }

        if (window.FirebaseAuthManager) {
          window.FirebaseAuthManager.signUpWithEmail(email, pass, confirm);
        }
        this.goToStep(2); // Advances to Permissions step
      });
    }

    // Step 1: Form Sign In -> Advances to Step 2 (Permissions)
    if (formSignIn) {
      formSignIn.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('onboarding-signin-email').value.trim();
        const pass = document.getElementById('onboarding-signin-password').value;

        if (!email || !pass) {
          alert('Please enter both email and password.');
          return;
        }

        if (window.FirebaseAuthManager) {
          window.FirebaseAuthManager.signInWithEmail(email, pass);
        }
        this.goToStep(2); // Advances to Permissions step
      });
    }

    // Step 1: Demo Mode Button -> Immediately loads demo account & sample data
    const btnDemo = document.getElementById('onboarding-btn-demo');
    if (btnDemo) {
      btnDemo.addEventListener('click', () => {
        if (window.FirebaseAuthManager) {
          window.FirebaseAuthManager.enterDemoMode(true);
        }
      });
    }

    // Step 1: Skip / Guest Continue -> Advances to Step 2 (Permissions)
    const btnGuest = document.getElementById('onboarding-btn-guest');
    if (btnGuest) {
      btnGuest.addEventListener('click', () => {
        this.goToStep(2);
      });
    }

    // Step 2: Notifications Button
    const btnNotify = document.getElementById('btn-allow-notifications');
    if (btnNotify) {
      btnNotify.addEventListener('click', () => this.requestNotifications());
    }

    // Step 2: Continue Button -> Advances to Step 3 (Age)
    const btnStep2Next = document.getElementById('onboarding-btn-step2-next');
    if (btnStep2Next) {
      btnStep2Next.addEventListener('click', () => {
        this.goToStep(3);
      });
    }

    // Step 3: Age Controls
    const ageInput = document.getElementById('onboarding-age-input');
    const btnAgeMinus = document.getElementById('onboarding-age-minus');
    const btnAgePlus = document.getElementById('onboarding-age-plus');

    if (btnAgeMinus && ageInput) {
      btnAgeMinus.addEventListener('click', () => {
        let val = parseInt(ageInput.value || '20', 10);
        if (val > 10) val--;
        ageInput.value = val;
        this.userAge = val;
      });
    }

    if (btnAgePlus && ageInput) {
      btnAgePlus.addEventListener('click', () => {
        let val = parseInt(ageInput.value || '20', 10);
        if (val < 100) val++;
        ageInput.value = val;
        this.userAge = val;
      });
    }

    if (ageInput) {
      ageInput.addEventListener('change', () => {
        let val = parseInt(ageInput.value || '20', 10);
        if (isNaN(val) || val < 10) val = 10;
        if (val > 100) val = 100;
        ageInput.value = val;
        this.userAge = val;
      });
    }

    // Step 3: Quick Age Pills
    document.querySelectorAll('.onboarding-age-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.onboarding-age-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const ageVal = parseInt(pill.getAttribute('data-age') || '20', 10);
        if (ageInput) ageInput.value = ageVal;
        this.userAge = ageVal;
      });
    });

    // Step 3: Next Button
    const btnStep3Next = document.getElementById('onboarding-btn-step3-next');
    if (btnStep3Next) {
      btnStep3Next.addEventListener('click', () => {
        if (ageInput) {
          this.userAge = parseInt(ageInput.value || '20', 10);
        }
        this.goToStep(4);
      });
    }

    // Step 4: Designation Selection Cards
    document.querySelectorAll('.onboarding-role-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.onboarding-role-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.userDesignation = card.getAttribute('data-role') || 'student';
      });
    });

    // Step 4: Finish Button
    const btnFinish = document.getElementById('onboarding-btn-finish');
    if (btnFinish) {
      btnFinish.addEventListener('click', () => {
        this.completeOnboarding();
      });
    }

    // Settings Profile Edit Button
    const btnEditProfile = document.getElementById('btn-edit-onboarding-profile');
    if (btnEditProfile) {
      btnEditProfile.addEventListener('click', () => {
        this.reopenOnboarding();
      });
    }
  },

  completeOnboarding() {
    // 1. Mark onboarding as permanently completed in localStorage
    localStorage.setItem('ontrack_onboarding_completed', 'true');
    localStorage.setItem('ontrack_user_age', this.userAge.toString());
    localStorage.setItem('ontrack_user_designation', this.userDesignation);

    // 2. Sync profile to backend
    this.syncProfileToBackend();

    // 3. Audio & Haptic Feedback
    if (window.SoundEffects && window.SoundEffects.playCheck) {
      window.SoundEffects.playCheck();
    }
    if (window.AndroidNative && window.AndroidNative.vibrate) {
      window.AndroidNative.vibrate(60);
    }

    // 4. Show friendly celebratory message
    const designationTitles = {
      'student': 'Student & Scholar',
      'working_pro': 'Working Professional',
      'entrepreneur': 'Founder & Builder',
      'personal_growth': 'Self-Mastery Pioneer'
    };
    const roleName = designationTitles[this.userDesignation] || 'Trailblazer';

    if (window.AdvancedUI && window.AdvancedUI.showToast) {
      window.AdvancedUI.showToast(`🎉 Setup Complete! Welcome to OnTrack, ${roleName}!`);
    }

    // 5. Smoothly transition out the overlay
    const overlay = document.getElementById('onboarding-modal-overlay');
    if (overlay) {
      overlay.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
      overlay.style.opacity = '0';
      overlay.style.transform = 'scale(0.96)';
      setTimeout(() => {
        overlay.style.display = 'none';
        overlay.classList.remove('active');
      }, 400);
    }

    // 6. Update profile info in Settings
    this.updateSettingsProfileDisplay();

    // 7. Load user data
    if (window.loadDashboardData) {
      window.loadDashboardData();
    }
  },

  async syncProfileToBackend() {
    try {
      const roleTitles = {
        'student': 'Scholar & Polymath',
        'working_pro': 'Corporate Knight & Strategist',
        'entrepreneur': 'Venture Pioneer & Builder',
        'personal_growth': 'Zen Mind & Self-Mastery'
      };
      const title = roleTitles[this.userDesignation] || 'Novice Tracker';
      const user = window.FirebaseAuthManager ? window.FirebaseAuthManager.currentUser : null;
      const username = user ? user.displayName : 'Challenger';

      await fetch('/api/rpg/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title,
          username: username,
          age: this.userAge,
          designation: this.userDesignation
        })
      });
    } catch (e) {
      console.warn('Profile sync warning:', e);
    }
  },

  updateSettingsProfileDisplay() {
    const ageEl = document.getElementById('settings-display-age');
    const roleEl = document.getElementById('settings-display-role');
    const age = localStorage.getItem('ontrack_user_age') || 'Not specified';
    const designation = localStorage.getItem('ontrack_user_designation') || 'student';

    const roleNames = {
      'student': '🎓 Student / Competitive Exam',
      'working_pro': '💼 Working Professional',
      'entrepreneur': '🚀 Founder / Entrepreneur',
      'personal_growth': '🌟 Self-Improvement / Life Balance'
    };

    if (ageEl) ageEl.textContent = `${age} years old`;
    if (roleEl) roleEl.textContent = roleNames[designation] || designation;
  },

  reopenOnboarding() {
    const overlay = document.getElementById('onboarding-modal-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
      overlay.style.opacity = '1';
      overlay.style.transform = 'scale(1)';
      overlay.classList.add('active');
      this.goToStep(3); // Start directly at Age & Role editing
    }
  }
};

window.OnboardingManager = OnboardingManager;
document.addEventListener('DOMContentLoaded', () => {
  OnboardingManager.init();
});

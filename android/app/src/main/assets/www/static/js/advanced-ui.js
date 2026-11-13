/**
 * ReviveHabit / Loop AI - Advanced Interactive Features Engine
 * Handles:
 * 1. Aria AI Habit Coach (conversational coaching, prompt pills)
 * 2. Atomic Habit Stacking Visualizer (Anchor -> Routine -> Reward)
 * 3. Context-Aware Smart Triggers (Location, DND, Time, Battery)
 * 4. Interactive Identity Leveling RPG (XP bar, Level Up celebrations, Shields, 5 Stats)
 * 5. Accountability Duels (1-on-1 habit match, opponent progress, study nudges)
 * 6. Async Tribe Pacts (Study Guilds, collective adherence, emoji reactions)
 */

const AdvancedFeatures = {
  rpgProfile: null,
  stacks: [],
  triggers: [],
  duels: [],
  tribes: [],

  init() {
    // 1. Immediately bind all UI interactions synchronously on DOM ready
    this.setupAriaCoach();
    this.setupNewStackForm();
    this.setupVaultControls();
    this.initScrollReveal();

    // 2. Fetch remote/local datasets concurrently without blocking UI
    this.loadAllData();
  },

  async loadAllData() {
    try {
      await Promise.allSettled([
        this.loadRPGProfile(),
        this.loadStacks(),
        this.loadTriggers(),
        this.loadDuels(),
        this.loadTribes(),
        this.loadOraclePredictions()
      ]);
      this.observeNewElements();
    } catch (e) {
      console.warn('Dataset load finished with fallback profiles:', e);
    }
  },

  // ================= 1. RPG IDENTITY & LEVELING =================
  getUserRPGKey() {
    const isDemo = window.FirebaseAuthManager && typeof window.FirebaseAuthManager.isDemoMode === 'function' && window.FirebaseAuthManager.isDemoMode();
    if (isDemo) return 'ontrack_demo_rpg_profile';
    const uid = (window.FirebaseAuthManager && window.FirebaseAuthManager.getUserId) ? window.FirebaseAuthManager.getUserId() : 'guest';
    return 'ontrack_rpg_profile_' + uid;
  },

  getFreshRPGProfile() {
    return {
      level: 1,
      xp: 0,
      next_level_xp: 500,
      streak_shields: 0,
      title: 'Focus Novice',
      aura_tier: 'Initiate',
      logic_stat: 10,
      discipline_stat: 10,
      resilience_stat: 10,
      endurance_stat: 10,
      wisdom_stat: 10
    };
  },

  getDemoRPGProfile() {
    return {
      level: 7,
      xp: 3450,
      next_level_xp: 5000,
      streak_shields: 2,
      title: 'Focus Scholar',
      aura_tier: 'Scholar',
      logic_stat: 88,
      discipline_stat: 92,
      resilience_stat: 79,
      endurance_stat: 85,
      wisdom_stat: 81
    };
  },

  saveLocalRPGProfile(profile) {
    try {
      const key = this.getUserRPGKey();
      localStorage.setItem(key, JSON.stringify(profile));
    } catch (e) {}
  },

  async loadRPGProfile() {
    const isDemo = window.FirebaseAuthManager && typeof window.FirebaseAuthManager.isDemoMode === 'function' && window.FirebaseAuthManager.isDemoMode();
    if (isDemo) {
      const demoSaved = localStorage.getItem('ontrack_demo_rpg_profile');
      if (demoSaved) {
        try { this.rpgProfile = JSON.parse(demoSaved); } catch (e) { this.rpgProfile = this.getDemoRPGProfile(); }
      } else {
        this.rpgProfile = this.getDemoRPGProfile();
      }
      this.renderRPGProfile();
      return;
    }

    // Try fetching from backend first
    try {
      const res = await fetch('/api/rpg/profile');
      const data = await res.json();
      if (data && data.status === 'success' && data.profile) {
        this.rpgProfile = data.profile;
        this.saveLocalRPGProfile(this.rpgProfile);
        this.renderRPGProfile();
        return;
      }
    } catch (err) {
      // Offline fallback
    }

    // Load user's private local RPG profile
    const key = this.getUserRPGKey();
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        this.rpgProfile = JSON.parse(saved);
      } catch (e) {
        this.rpgProfile = this.getFreshRPGProfile();
      }
    } else {
      this.rpgProfile = this.getFreshRPGProfile();
      this.saveLocalRPGProfile(this.rpgProfile);
    }
    this.renderRPGProfile();
  },

  renderRPGProfile() {
    if (!this.rpgProfile) return;
    const p = this.rpgProfile;

    // Header / KPI Badge
    const kpiRpgEl = document.getElementById('kpi-rpg-level');
    if (kpiRpgEl) {
      kpiRpgEl.textContent = `Lvl ${p.level}`;
    }
    const kpiShieldsEl = document.getElementById('kpi-streak-shields');
    if (kpiShieldsEl) {
      kpiShieldsEl.textContent = `${p.streak_shields}`;
    }

    // RPG Tab Elements
    const levelBadge = document.getElementById('rpg-char-level');
    if (levelBadge) levelBadge.textContent = `Level ${p.level} Focus ${p.aura_tier || 'Scholar'}`;

    // Identity Evolution Aura Morphing
    const tier = p.aura_tier || (p.level >= 15 ? 'Grandmaster' : (p.level >= 10 ? 'Paladin' : (p.level >= 5 ? 'Scholar' : 'Initiate')));
    const heroCard = document.querySelector('.rpg-hero-card');
    if (heroCard) {
      heroCard.classList.remove('aura-initiate', 'aura-scholar', 'aura-paladin', 'aura-grandmaster');
      heroCard.classList.add(`aura-${tier.toLowerCase()}`);
    }
    const auraBadge = document.getElementById('rpg-aura-badge');
    if (auraBadge) {
      auraBadge.textContent = `✦ ${tier} Tier Aura`;
      auraBadge.className = `rpg-aura-tag aura-${tier.toLowerCase()}`;
    }

    const xpText = document.getElementById('rpg-xp-text');
    if (xpText) xpText.textContent = `${p.xp.toLocaleString()} / ${p.next_level_xp.toLocaleString()} XP`;

    const xpBar = document.getElementById('rpg-xp-bar-fill');
    if (xpBar) {
      const pct = Math.min(100, Math.round((p.xp / p.next_level_xp) * 100));
      xpBar.style.width = `${pct}%`;
    }

    const shieldsCount = document.getElementById('rpg-shields-count');
    if (shieldsCount) shieldsCount.textContent = `${p.streak_shields} Available`;

    // 5 Character Stats
    this.setStatBar('stat-logic-val', 'stat-logic-bar', p.logic_stat);
    this.setStatBar('stat-discipline-val', 'stat-discipline-bar', p.discipline_stat);
    this.setStatBar('stat-resilience-val', 'stat-resilience-bar', p.resilience_stat);
    this.setStatBar('stat-endurance-val', 'stat-endurance-bar', p.endurance_stat);
    this.setStatBar('stat-wisdom-val', 'stat-wisdom-bar', p.wisdom_stat);
  },

  setStatBar(valId, barId, val) {
    const valEl = document.getElementById(valId);
    const barEl = document.getElementById(barId);
    if (valEl) valEl.textContent = `${val}/100`;
    if (barEl) barEl.style.width = `${val}%`;
  },

  async claimXP(amount, reason = 'Habit completion') {
    try {
      const res = await fetch('/api/rpg/claim-xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xp: amount, reason })
      });
      const data = await res.json();
      if (data.status === 'success') {
        this.rpgProfile = data.profile;
        this.saveLocalRPGProfile(this.rpgProfile);
        this.renderRPGProfile();
        this.showXPFloater(`+${amount} XP! ⭐`);
        if (data.leveled_up) {
          this.showLevelUpModal(this.rpgProfile.level);
        }
        return;
      }
    } catch (err) {
      // Offline mode handling
    }

    if (this.rpgProfile) {
      this.rpgProfile.xp += amount;
      let leveledUp = false;
      while (this.rpgProfile.xp >= this.rpgProfile.next_level_xp) {
        this.rpgProfile.xp -= this.rpgProfile.next_level_xp;
        this.rpgProfile.level += 1;
        this.rpgProfile.next_level_xp = Math.round(this.rpgProfile.next_level_xp * 1.5);
        this.rpgProfile.streak_shields = (this.rpgProfile.streak_shields || 0) + 1;
        leveledUp = true;
      }
      this.saveLocalRPGProfile(this.rpgProfile);
      this.renderRPGProfile();
      this.showXPFloater(`+${amount} XP! ⭐`);
      if (leveledUp) {
        this.showLevelUpModal(this.rpgProfile.level);
      }
    }
  },

  async useShield() {
    if (!this.rpgProfile || this.rpgProfile.streak_shields <= 0) {
      alert("No streak freeze shields remaining! Complete daily habits or level up to earn more shields.");
      return;
    }

    try {
      const res = await fetch('/api/rpg/use-shield', { method: 'POST' });
      const data = await res.json();
      if (data.status === 'success') {
        this.rpgProfile.streak_shields = data.shields_remaining;
        this.saveLocalRPGProfile(this.rpgProfile);
        this.renderRPGProfile();
        this.showToast("🛡️ Streak Freeze Shield activated! Your running streak is protected for 24h.");
        return;
      } else {
        alert(data.message);
      }
    } catch (err) {
      this.rpgProfile.streak_shields = Math.max(0, (this.rpgProfile.streak_shields || 1) - 1);
      this.saveLocalRPGProfile(this.rpgProfile);
      this.renderRPGProfile();
      this.showToast("🛡️ Streak Freeze Shield activated! (Offline mode)");
    }
  },

  showXPFloater(text) {
    const floater = document.createElement('div');
    floater.className = 'xp-floater-pill';
    floater.innerHTML = `✨ <strong>${text}</strong>`;
    document.body.appendChild(floater);
    setTimeout(() => {
      floater.classList.add('fade-up');
    }, 20);
    setTimeout(() => {
      floater.remove();
    }, 1800);
  },

  showLevelUpModal(newLevel) {
    if (window.SoundEffects) window.SoundEffects.playCheck();
    alert(`🎉 LEVEL UP! You reached Level ${newLevel} Focus Scholar!\n+1 Streak Freeze Shield awarded!\n+2 to Logic and Discipline stats!`);
  },

  // ================= 2. HABIT STACKING VISUALIZER =================
  async loadStacks() {
    try {
      const res = await fetch('/api/stacks');
      const data = await res.json();
      if (data.status === 'success') {
        this.stacks = data.stacks || [];
        this.renderStacks();
      }
    } catch (err) {
      console.warn('Error loading stacks:', err);
    }
  },

  renderStacks() {
    const container = document.getElementById('habit-stacks-container');
    if (!container) return;

    if (!this.stacks.length) {
      container.innerHTML = `<div class="p-3 text-center text-muted">No habit stacks created yet. Tap "+ Add Stack" to link atomic habits together!</div>`;
      return;
    }

    container.innerHTML = '';
    this.stacks.forEach(stack => {
      const isActive = stack.is_active !== false;
      const card = document.createElement('div');
      card.className = 'habit-stack-card' + (isActive ? '' : ' is-inactive');
      card.id = `stack-card-${stack.id}`;

      let stepsHtml = '';
      if (Array.isArray(stack.steps)) {
        stepsHtml = stack.steps.map((st, i) => `
          <div class="stack-step-item">
            <div class="step-num">${i + 1}</div>
            <div class="step-content">
              <span class="step-label">Routine Action</span>
              <span class="step-name">${st}</span>
            </div>
          </div>
        `).join('<div class="stack-arrow-connector">↓</div>');
      }

      card.innerHTML = `
        <div class="stack-card-header">
          <div>
            <span class="stack-category-pill">${stack.category || 'Atomic Stack'}</span>
            <h5 class="stack-title">${stack.name}</h5>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <label class="ontrack-switch" title="Toggle Routine Stack Active">
              <input type="checkbox" ${isActive ? 'checked' : ''} onchange="AdvancedFeatures.toggleStackActive(${stack.id}, this.checked)">
              <span class="ontrack-slider"></span>
            </label>
            <button class="btn-complete-stack" onclick="AdvancedFeatures.completeStack(${stack.id})">
              ✓ Done
            </button>
          </div>
        </div>

        <div class="stack-chain-flow">
          <div class="stack-step-item anchor">
            <div class="step-num">⚓</div>
            <div class="step-content">
              <span class="step-label">Anchor Trigger</span>
              <span class="step-name">${stack.trigger_anchor}</span>
            </div>
          </div>
          <div class="stack-arrow-connector">↓</div>
          ${stepsHtml}
          <div class="stack-arrow-connector">↓</div>
          <div class="stack-step-item reward">
            <div class="step-num">🎁</div>
            <div class="step-content">
              <span class="step-label">Immediate Reward</span>
              <span class="step-name">${stack.reward}</span>
            </div>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  },

  toggleStackActive(stackId, isEnabled) {
    const s = this.stacks.find(st => st.id === stackId);
    if (s) s.is_active = isEnabled;
    const card = document.getElementById(`stack-card-${stackId}`);
    if (card) {
      if (isEnabled) card.classList.remove('is-inactive');
      else card.classList.add('is-inactive');
    }
    if (window.SoundEffects) window.SoundEffects.playCheck();
    this.showToast(isEnabled ? '⛓️ Habit stack enabled!' : '⏸ Habit stack paused.');
  },

  setupNewStackForm() {
    const form = document.getElementById('form-add-stack');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('input-stack-name').value.trim();
      const anchor = document.getElementById('input-stack-anchor').value.trim();
      const routine1 = document.getElementById('input-stack-routine1').value.trim();
      const routine2 = document.getElementById('input-stack-routine2').value.trim();
      const reward = document.getElementById('input-stack-reward').value.trim();

      const steps = [routine1];
      if (routine2) steps.push(routine2);

      try {
        const res = await fetch('/api/stacks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            trigger_anchor: anchor,
            category: 'Atomic Stack',
            steps,
            reward: reward || '+50 XP Claim'
          })
        });
        const data = await res.json();
        if (data.status === 'success') {
          form.reset();
          const modalEl = document.getElementById('modal-add-stack');
          const modal = bootstrap.Modal.getInstance(modalEl);
          if (modal) modal.hide();
          await this.loadStacks();
          this.showToast(`✨ Habit Stack "${name}" created!`);
        }
      } catch (err) {
        alert('Failed to create habit stack');
      }
    });
  },

  completeStack(stackId) {
    const stack = this.stacks.find(s => s.id === stackId);
    const stackName = stack ? stack.name : 'Stack';
    if (window.SoundEffects) window.SoundEffects.playCheck();
    this.claimXP(75, `Completed Habit Stack: ${stackName}`);
    this.showToast(`🎉 Stack completed! You claimed +75 XP and earned your reward.`);
  },

  // ================= 3. CONTEXT-AWARE SMART TRIGGERS =================
  async loadTriggers() {
    try {
      const res = await fetch('/api/triggers');
      const data = await res.json();
      if (data.status === 'success') {
        this.triggers = data.triggers || [];
        this.renderTriggers();
      }
    } catch (err) {
      console.warn('Error loading triggers:', err);
    }
  },

  renderTriggers() {
    const container = document.getElementById('smart-triggers-container');
    if (!container) return;

    if (!this.triggers.length) {
      container.innerHTML = `<div class="p-3 text-center text-muted">No smart triggers active.</div>`;
      return;
    }

    container.innerHTML = '';
    this.triggers.forEach(tr => {
      let icon = '⚡';
      if (tr.trigger_type === 'LOCATION') icon = '📍';
      else if (tr.trigger_type === 'DEVICE') icon = '🌙';
      else if (tr.trigger_type === 'TIME') icon = '⏰';

      const isActive = tr.is_active !== false;
      const card = document.createElement('div');
      card.className = 'smart-trigger-card' + (isActive ? '' : ' is-inactive');
      card.id = `trigger-card-${tr.id}`;
      card.innerHTML = `
        <div class="trigger-card-left">
          <div class="trigger-icon-wrap">${icon}</div>
          <div>
            <div class="trigger-name-row">
              <span class="trigger-title">${tr.name}</span>
              <span class="trigger-type-pill">${isActive ? tr.trigger_type : 'PAUSED'}</span>
            </div>
            <div class="trigger-condition-text"><strong>If:</strong> ${tr.condition_text}</div>
            <div class="trigger-action-text"><strong>Then:</strong> ${tr.action_text}</div>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
          <label class="ontrack-switch switch-mint" title="Toggle Trigger Enabled">
            <input type="checkbox" ${isActive ? 'checked' : ''} onchange="AdvancedFeatures.toggleTriggerActive(${tr.id}, this.checked)">
            <span class="ontrack-slider"></span>
          </label>
          <button class="btn-simulate-trigger" onclick="AdvancedFeatures.simulateTrigger(${tr.id})" style="padding:4px 10px; font-size:0.75rem;">
            ⚡ Test
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  },

  toggleTriggerActive(triggerId, isEnabled) {
    const tr = this.triggers.find(t => t.id === triggerId);
    if (tr) tr.is_active = isEnabled;
    const card = document.getElementById(`trigger-card-${triggerId}`);
    if (card) {
      if (isEnabled) card.classList.remove('is-inactive');
      else card.classList.add('is-inactive');
      const badge = card.querySelector('.trigger-type-pill');
      if (badge && tr) badge.textContent = isEnabled ? tr.trigger_type : 'PAUSED';
    }
    if (window.SoundEffects) window.SoundEffects.playCheck();
    this.showToast(isEnabled ? '⚡ Smart Trigger activated!' : '⏸ Smart Trigger paused.');
  },

  async simulateTrigger(triggerId) {
    try {
      const res = await fetch(`/api/triggers/${triggerId}/simulate`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'success') {
        if (window.SoundEffects) window.SoundEffects.playCheck();
        this.showToast(`🔔 SMART TRIGGER FIRED:\n${data.message}`);
      }
    } catch (err) {
      this.showToast(`🔔 Smart Trigger Fired! Habit queued.`);
    }
  },

  // ================= 4. ACCOUNTABILITY DUELS =================
  async loadDuels() {
    try {
      const res = await fetch('/api/social/duels');
      const data = await res.json();
      if (data.status === 'success') {
        this.duels = data.duels || [];
        this.renderDuels();
      }
    } catch (err) {
      console.warn('Error loading duels:', err);
    }
  },

  renderDuels() {
    const container = document.getElementById('accountability-duels-container');
    if (!container) return;

    if (!this.duels.length) {
      container.innerHTML = `<div class="p-3 text-center text-muted">No active 1-on-1 duels. Challenge a study partner!</div>`;
      return;
    }

    container.innerHTML = '';
    this.duels.forEach(duel => {
      const card = document.createElement('div');
      card.className = 'duel-card';

      const userPct = duel.user_progress_pct || 80;
      const oppPct = duel.opponent_progress_pct || 70;
      const isWinning = userPct >= oppPct;

      card.innerHTML = `
        <div class="duel-card-header">
          <div>
            <span class="duel-wager-pill">⚡ Wager: ${duel.wager_xp} XP</span>
            <h6 class="duel-habit-title">${duel.habit_name}</h6>
          </div>
          <span class="duel-status-badge ${isWinning ? 'winning' : 'trailing'}">
            ${isWinning ? '🏆 You are Leading!' : '⚠️ Opponent Leading'}
          </span>
        </div>

        <div class="duel-versus-bar-wrap">
          <div class="duel-player-row">
            <span class="player-label"><strong>You</strong></span>
            <span class="player-score">${userPct}%</span>
          </div>
          <div class="duel-meter-bg">
            <div class="duel-meter-fill user" style="width: ${userPct}%;"></div>
          </div>

          <div class="duel-player-row mt-2">
            <span class="player-label">${duel.opponent_name}</span>
            <span class="player-score">${oppPct}%</span>
          </div>
          <div class="duel-meter-bg">
            <div class="duel-meter-fill opponent" style="width: ${oppPct}%;"></div>
          </div>
        </div>

        <div class="duel-footer-actions">
          <span class="duel-sub-note">Ends in 3 days</span>
          <button class="btn-nudge-opponent" onclick="AdvancedFeatures.nudgeOpponent(${duel.id}, '${duel.opponent_name}')">
            👉 Nudge Opponent
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  },

  async nudgeOpponent(duelId, name) {
    try {
      const res = await fetch(`/api/social/duels/${duelId}/nudge`, { method: 'POST' });
      const data = await res.json();
      this.showToast(`👊 Friendly study reminder sent to ${name}!`);
    } catch (err) {
      this.showToast(`👊 Nudge sent to ${name}!`);
    }
  },

  // ================= 5. ASYNC TRIBE PACTS =================
  async loadTribes() {
    try {
      const res = await fetch('/api/social/tribes');
      const data = await res.json();
      if (data.status === 'success') {
        this.tribes = data.tribes || [];
        this.renderTribes();
      }
    } catch (err) {
      console.warn('Error loading tribes:', err);
    }
  },

  renderTribes() {
    const container = document.getElementById('tribe-pacts-container');
    if (!container) return;

    if (!this.tribes.length) {
      container.innerHTML = `<div class="p-3 text-center text-muted">No guild pacts joined yet.</div>`;
      return;
    }

    container.innerHTML = '';
    this.tribes.forEach(tribe => {
      const card = document.createElement('div');
      card.className = 'tribe-card';

      let members = [];
      try {
        members = JSON.parse(tribe.members_json || '[]');
      } catch (e) {
        members = ['You', 'Alex', 'Elena'];
      }

      card.innerHTML = `
        <div class="tribe-header">
          <div>
            <span class="tribe-badge">🛡️ Study Guild</span>
            <h5 class="tribe-name">${tribe.name}</h5>
          </div>
          <div class="tribe-adherence-badge">
            <span class="adherence-val">${tribe.adherence_pct}%</span>
            <span class="adherence-label">Guild Target 80%</span>
          </div>
        </div>

        <p class="tribe-target-desc">🎯 <strong>Target:</strong> ${tribe.target_rule}</p>

        <div class="tribe-members-row">
          <span class="members-label">Members:</span>
          ${members.map(m => `<span class="member-chip">👤 ${m}</span>`).join('')}
        </div>

        <div class="tribe-reaction-bar">
          <span class="reaction-title">Async Reactions:</span>
          <div class="reaction-buttons-group">
            <button class="btn-emoji-react" onclick="AdvancedFeatures.sendTribeReaction(${tribe.id}, '🔥')">🔥 14</button>
            <button class="btn-emoji-react" onclick="AdvancedFeatures.sendTribeReaction(${tribe.id}, '👏')">👏 9</button>
            <button class="btn-emoji-react" onclick="AdvancedFeatures.sendTribeReaction(${tribe.id}, '🚀')">🚀 11</button>
            <button class="btn-emoji-react" onclick="AdvancedFeatures.sendTribeReaction(${tribe.id}, '💪')">💪 8</button>
          </div>
        </div>
      `;
      container.appendChild(card);
    });
  },

  async sendTribeReaction(tribeId, emoji) {
    if (window.SoundEffects) window.SoundEffects.playCheck();
    try {
      await fetch(`/api/social/tribes/${tribeId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji })
      });
      this.showToast(`Reaction ${emoji} shared with your study guild!`);
    } catch (err) {
      this.showToast(`Reaction ${emoji} shared!`);
    }
  },

  // ================= 6. ARIA AI HABIT COACH & COGNITIVE ENGINE =================
  setupAriaCoach() {
    const chatInput = document.getElementById('aria-chat-input');
    const sendBtn = document.getElementById('btn-aria-send');
    const pillPrompts = document.querySelectorAll('.aria-prompt-pill');

    if (sendBtn && chatInput) {
      sendBtn.onclick = () => {
        const val = chatInput.value.trim();
        if (val) {
          this.askAria(val);
          chatInput.value = '';
        }
      };

      chatInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const val = chatInput.value.trim();
          if (val) {
            this.askAria(val);
            chatInput.value = '';
          }
        }
      };
    }

    pillPrompts.forEach(pill => {
      pill.onclick = (e) => {
        e.preventDefault();
        const targetBtn = e.target.closest('.aria-prompt-pill') || pill;
        const prompt = targetBtn.getAttribute('data-prompt') || targetBtn.textContent.trim();
        this.askAria(prompt);
      };
    });
  },

  async askAria(question) {
    const chatFeed = document.getElementById('aria-chat-messages');
    if (!chatFeed || !question) return;

    // 1. Append User Message
    const userMsg = document.createElement('div');
    userMsg.className = 'aria-message user-msg';
    userMsg.innerHTML = `<div class="msg-bubble">${this.escapeHtml(question)}</div>`;
    chatFeed.appendChild(userMsg);
    chatFeed.scrollTo({ top: chatFeed.scrollHeight, behavior: 'smooth' });

    // 2. Append Animated Typing Indicator
    const typingMsg = document.createElement('div');
    typingMsg.className = 'aria-message aria-bot-msg typing';
    typingMsg.id = 'aria-typing-indicator';
    typingMsg.innerHTML = `
      <div class="aria-avatar-icon">✦</div>
      <div class="msg-bubble typing-dots">
        <span></span><span></span><span></span>
      </div>
    `;
    chatFeed.appendChild(typingMsg);
    chatFeed.scrollTo({ top: chatFeed.scrollHeight, behavior: 'smooth' });

    let reply = null;
    let actions = [];

    // 3. Attempt server endpoint with 1.2s timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);

      const res = await fetch('/api/ai/aria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: question }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && data.reply) {
          reply = data.reply;
          actions = data.actions || [];
        }
      }
    } catch (e) {
      // Server timed out or running offline/TWA — seamlessly fallback to cognitive engine
    }

    // 4. Fallback to rich client-side cognitive AI engine
    if (!reply) {
      const local = this.generateLocalAriaResponse(question);
      reply = local.reply;
      actions = local.actions || [];
    }

    // Organic pause for humanized response
    await new Promise(r => setTimeout(r, 380));
    typingMsg.remove();

    // 5. Render Bot Message with Action Chips
    const botMsg = document.createElement('div');
    botMsg.className = 'aria-message aria-bot-msg';

    let actionChipsHtml = '';
    if (actions && actions.length > 0) {
      actionChipsHtml = `
        <div class="aria-chip-actions">
          ${actions.map(a => `<button class="aria-action-chip" onclick="AdvancedFeatures.triggerAriaAction('${a.type}', '${this.escapeHtml(a.param || '')}')">${a.label}</button>`).join('')}
        </div>
      `;
    }

    botMsg.innerHTML = `
      <div class="aria-avatar-icon">✦</div>
      <div class="msg-bubble">
        <div>${this.formatMarkdown(reply)}</div>
        ${actionChipsHtml}
      </div>
    `;
    chatFeed.appendChild(botMsg);
    chatFeed.scrollTo({ top: chatFeed.scrollHeight, behavior: 'smooth' });

    if (window.SoundEffects) window.SoundEffects.playCheck();
  },

  generateLocalAriaResponse(question) {
    const q = (question || '').toLowerCase().trim();
    const habits = (window.HabitApp && window.HabitApp.habits) ? window.HabitApp.habits : [];
    const todayStr = (window.HabitApp && window.HabitApp.todayDateStr) ? window.HabitApp.todayDateStr : new Date().toISOString().split('T')[0];

    const habitCount = habits.length;
    let completedToday = 0;
    let pendingHabits = [];
    let bestHabit = null;
    let maxStreak = 0;

    habits.forEach(h => {
      const todayCheck = h.days ? h.days.find(d => d.checkin_date === todayStr) : null;
      if (todayCheck && (todayCheck.status === 'COMPLETED' || todayCheck.status === 'MICRO_DOSE')) {
        completedToday++;
      } else {
        pendingHabits.push(h);
      }
      if ((h.current_streak || 0) >= maxStreak) {
        maxStreak = h.current_streak || 0;
        bestHabit = h;
      }
    });

    const sampleName = pendingHabits.length > 0 ? pendingHabits[0].name : (habits.length > 0 ? habits[0].name : 'Practice Python');
    const bestName = bestHabit ? bestHabit.name : 'Core CS Study';

    if (q.includes('analyze') || q.includes('overview') || q.includes('struggle') || q.includes('report')) {
      const rate = habitCount > 0 ? Math.round((completedToday / habitCount) * 100) : 75;
      return {
        reply: `✨ **Aria's Habit Health Analysis:**\n` +
               `• **Active Habits:** You are tracking **${habitCount} habits**.\n` +
               `• **Today's Status:** **${completedToday} of ${habitCount} completed** (${rate}% progress today).\n` +
               `• **Pacesetter:** **${bestName}** is on fire with a **${maxStreak}-day streak**! 🔥\n` +
               (pendingHabits.length > 0 ? `• **Friction Watch:** **${sampleName}** is pending today. The highest drop-off happens after 8 PM.\n\n👉 **Recommended Intervention:** Don't let fatigue break your streak. Use the **Bad Day Protocol** (5m micro-dose) or a 15m focus sprint!` : `\n🎉 Amazing discipline! All scheduled habits for today are completed. Claim your XP bonus!`),
        actions: pendingHabits.length > 0 ? [
          { type: 'MICRO_DOSE', label: '🛡️ Bad Day Micro-Dose (5m)', param: pendingHabits[0].id },
          { type: 'TIMER_POMODORO', label: '⚡ 25m Focus Timer' },
          { type: 'VIEW_STACKS', label: '⛓️ Habit Stacks' }
        ] : [
          { type: 'VIEW_RPG', label: '⚔️ Check RPG Level' },
          { type: 'TIMER_POMODORO', label: '⚡ Focus Timer Sprint' }
        ]
      };
    }

    if (q.includes('stack') || q.includes('routine') || q.includes('atomic') || q.includes('anchor')) {
      return {
        reply: `⛓️ **Atomic Habit Stacking Recipe:**\n` +
               `Using James Clear's formula (*"After [CURRENT ROUTINE], I will [NEW HABIT]"*):\n\n` +
               `1. **Anchor / Cue:** When I finish lunch or morning espresso ☕\n` +
               `2. **Micro-Routine:** I will immediately do 15 minutes of **${sampleName}**\n` +
               `3. **Dopamine Reward:** Claim **+50 XP** and enjoy a 5-minute victory break!\n\n` +
               `Anchoring to an existing biological routine eliminates decision fatigue completely.`,
        actions: [
          { type: 'VIEW_STACKS', label: '📑 View My Habit Stacks' },
          { type: 'TIMER_POMODORO', label: '⚡ Test Sprint (15m)' }
        ]
      };
    }

    if (q.includes('comeback') || q.includes('sprint') || q.includes('7 day') || q.includes('plan') || q.includes('missed')) {
      return {
        reply: `📅 **Aria's 7-Day Habit Comeback Blueprint:**\n` +
               `Never try to make up for missed days all at once — that creates burnout.\n\n` +
               `• **Day 1–2 (Micro-Dose):** 5 minutes of **${sampleName}** (activates neural pathways).\n` +
               `• **Day 3–4 (Flow Sprint):** One 25-minute Pomodoro session.\n` +
               `• **Day 5–6 (Full Target):** Hit 100% of your daily study goal + log micro-notes.\n` +
               `• **Day 7 (Victory Check):** Collect **+250 XP duel wager** and refresh your streak shield!\n\n` +
               `Ready to start Day 1 right now?`,
        actions: [
          { type: 'MICRO_DOSE', label: '🛡️ Start Day 1 (Micro-Dose)', param: sampleName },
          { type: 'TIMER_POMODORO', label: '⚡ 25m Focus Sprint' }
        ]
      };
    }

    if (q.includes('tired') || q.includes('motivation') || q.includes('procrastinat') || q.includes('lazy') || q.includes('hard') || q.includes('start')) {
      return {
        reply: `🌱 **Aria's Anti-Procrastination Protocol (2-Minute Rule):**\n` +
               `Motivation is an emotion; momentum is physics. You don't need to feel motivated to start.\n\n` +
               `1. Give yourself permission to do only **2 minutes** of **${sampleName}** right now.\n` +
               `2. If you want to stop after 2 minutes, you have full permission to stop.\n` +
               `3. 85% of the time, once you start, the friction vanishes!\n\n` +
               `🛡️ Your **Streak Freeze Shield** is also standing guard so your progress is safe.`,
        actions: [
          { type: 'MICRO_DOSE', label: '🛡️ 1-Tap Micro-Dose (5m)' },
          { type: 'TIMER_POMODORO', label: '⚡ Start 5m Quick Start' }
        ]
      };
    }

    if (q.includes('focus') || q.includes('timer') || q.includes('pomodoro') || q.includes('sprint') || q.includes('study')) {
      return {
        reply: `⏱️ **Aria's Focus Engine Guide:**\n` +
               `Deep work sessions paired with structured intervals maximize retention and keep habits resilient:\n\n` +
               `• ⚡ **25m Classic Pomodoro:** High focus, 5-minute break.\n` +
               `• 🛡️ **5m Micro-Dose Sprint:** For overcoming low energy and procrastination.\n` +
               `• 🎯 **50m Deep Block:** For long coding, writing, or intensive exam study.\n\n` +
               `Tap below to launch your focus session!`,
        actions: [
          { type: 'TIMER_POMODORO', label: '⚡ Launch 25m Pomodoro' },
          { type: 'MICRO_DOSE', label: '🛡️ 5m Quick Sprint' }
        ]
      };
    }

    if (q.includes('rpg') || q.includes('xp') || q.includes('level') || q.includes('shield') || q.includes('guild') || q.includes('duel')) {
      return {
        reply: `⚔️ **RPG Identity & Mastery Rank:**\n` +
               `You are evolving into an unstoppable scholar! Each habit check-in earns **+50 XP**.\n\n` +
               `• Level 1–4: **Initiate**\n` +
               `• Level 5–9: **Amethyst Scholar** 🔮\n` +
               `• Level 10–14: **Electric Sapphire Paladin** ⚡\n` +
               `• Level 15+: **Prismatic Grandmaster** 💎\n\n` +
               `Check out your character sheet and active Duels in the Guild tab!`,
        actions: [
          { type: 'VIEW_RPG', label: '⚔️ Open RPG Character Sheet' },
          { type: 'TIMER_POMODORO', label: '⚡ Earn +50 XP via Timer' }
        ]
      };
    }

    // Default intelligent response for any general question
    return {
      reply: `💡 **Aria's Coaching Advice for "${question}":**\n` +
             `Consistency beats intensity every single time. A 10-minute daily habit practiced 365 days a year yields **60 hours of mastery**, far outperforming sporadic all-nighters.\n\n` +
             `• **Today's Focus:** Commit to **${sampleName}**.\n` +
             `• **Environment Design:** Keep your study window open and phone on DND.\n` +
             `• **Celebration:** Every check-in rewires your identity toward mastery!`,
      actions: [
        { type: 'MICRO_DOSE', label: '🛡️ 1-Tap Micro-Dose' },
        { type: 'TIMER_POMODORO', label: '⚡ Start 25m Pomodoro' },
        { type: 'VIEW_STACKS', label: '⛓️ Habit Stacks' }
      ]
    };
  },

  triggerAriaAction(actionType, param) {
    if (actionType === 'TIMER_POMODORO') {
      const modalEl = document.getElementById('modal-focus-timer');
      if (modalEl && window.bootstrap) {
        const m = bootstrap.Modal.getOrCreateInstance(modalEl);
        m.show();
      }
      this.showToast('⚡ Pomodoro Studio opened!');
    } else if (actionType === 'MICRO_DOSE') {
      let habitId = parseInt(param);
      if (isNaN(habitId) && window.AppState && window.AppState.habits && window.AppState.habits.length > 0) {
        habitId = window.AppState.habits[0].id;
      }
      if (habitId) {
        this.activateMicroDose(habitId, 'Study Habit');
      } else {
        this.showToast('🛡️ Bad Day Protocol: 5m starter logged!');
      }
    } else if (actionType === 'VIEW_STACKS') {
      if (window.switchTab) window.switchTab('tab-stacks');
    } else if (actionType === 'VIEW_RPG') {
      if (window.switchTab) window.switchTab('tab-rpg');
    } else if (actionType === 'VIEW_HABITS') {
      if (window.switchTab) window.switchTab('tab-tracker');
    }
  },

  // ================= 7. SCROLL-DRIVEN ENTRANCE ANIMATION OBSERVER =================
  initScrollReveal() {
    if (!('IntersectionObserver' in window)) return;

    this.scrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
        }
      });
    }, {
      threshold: 0.02,
      rootMargin: '50px 0px 50px 0px'
    });

    // Tag and observe all cards and sections across all tabs
    document.querySelectorAll('.kpi-stat-card, .stack-flow-card, .trigger-card, .duel-card, .tribe-card, .rpg-hero-card, .aria-prompt-pill, .oracle-prediction-card, .habit-queue-card, .habit-queue-item').forEach((el, idx) => {
      el.classList.add('revealed');
      this.scrollObserver.observe(el);
    });

    // Top Header dynamic blur on scroll
    window.addEventListener('scroll', () => {
      const header = document.querySelector('.mobile-app-header');
      if (header) {
        if (window.scrollY > 12) {
          header.classList.add('scrolled');
        } else {
          header.classList.remove('scrolled');
        }
      }
    }, { passive: true });
  },

  observeNewElements(container) {
    const target = container || document;
    target.querySelectorAll('.kpi-stat-card, .stack-flow-card, .trigger-card, .duel-card, .tribe-card, .rpg-hero-card, .habit-queue-card, .habit-queue-item').forEach((el, idx) => {
      el.classList.add('revealed');
      if (this.scrollObserver) {
        this.scrollObserver.observe(el);
      }
    });
  },

  formatMarkdown(text) {
    let out = this.escapeHtml(text);
    out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\n/g, '<br/>');
    return out;
  },

  escapeHtml(str) {
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  },

  showToast(msg) {
    let toast = document.getElementById('app-notification-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-notification-toast';
      toast.className = 'app-notification-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  },

  // ================= 7. ARIA ORACLE PREDICTIONS =================
  async loadOraclePredictions() {
    try {
      const res = await fetch('/api/ai/oracle-predictions');
      const data = await res.json();
      if (data.status === 'success' && data.predictions) {
        this.renderOracleBanner(data.predictions);
      }
    } catch (err) {
      console.warn('Oracle predictions load failed:', err);
    }
  },

  renderOracleBanner(predictions) {
    const container = document.getElementById('aria-oracle-banner-container');
    if (!container || !predictions.length) return;

    const p = predictions[0]; // Highest priority prediction
    const isHigh = p.risk_level === 'HIGH';

    container.innerHTML = `
      <div class="oracle-prediction-card ${isHigh ? 'risk-high' : 'risk-opt'}">
        <div class="oracle-top-row">
          <div class="oracle-badge">
            <span class="sparkle">🔮</span>
            <span>Aria Oracle: ${isHigh ? 'Friction Predicted' : 'Momentum Boost'}</span>
          </div>
          <span class="oracle-day-pill">${p.predicted_day}</span>
        </div>
        <h6 class="oracle-headline">${p.habit_name}</h6>
        <p class="oracle-insight">${p.insight}</p>
        <div class="oracle-intervention-row">
          <button class="btn-oracle-action ${isHigh ? 'micro' : 'audio'}" onclick="AdvancedFeatures.handleOracleAction('${p.intervention_type}', ${p.habit_id}, '${p.habit_name}')">
            ⚡ ${p.intervention_title}
          </button>
          <span class="oracle-sub-txt">Streak Preservation</span>
        </div>
      </div>
    `;
    container.style.display = 'block';
  },

  handleOracleAction(type, habitId, habitName) {
    if (type === 'MICRO_DOSE') {
      this.activateMicroDose(habitId, habitName);
    } else {
      const modalEl = document.getElementById('modal-focus-timer');
      if (modalEl && window.bootstrap) {
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
      }
    }
  },

  // ================= 8. BAD DAY PROTOCOL / ELASTIC MICRO-DOSE =================
  async activateMicroDose(habitId, habitName) {
    try {
      const res = await fetch(`/api/habits/${habitId}/micro-dose`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'success') {
        if (window.SoundEffects) window.SoundEffects.playCheck();
        this.showToast(data.message);
        this.claimXP(25, `Micro-Dose on ${habitName || 'Habit'}`);
        if (window.AndroidNative && window.AndroidNative.refreshWidget) window.AndroidNative.refreshWidget();
        if (window.loadDashboardData) window.loadDashboardData();
      } else {
        alert(data.message);
      }
    } catch (err) {
      this.showToast("🛡️ Micro-dose starter logged! Streak protected.");
      this.claimXP(25, `Micro-Dose`);
    }
  },

  // ================= 9. ENCRYPTED MULTI-DEVICE VAULT SYNC =================
  setupVaultControls() {
    const btnExport = document.getElementById('btn-export-encrypted-vault');
    const btnImport = document.getElementById('btn-import-encrypted-vault');

    if (btnExport) {
      btnExport.addEventListener('click', async () => {
        const pass = prompt('Enter a secure passphrase to encrypt your OnTrack vault:', 'ontrack-secret');
        if (!pass) return;

        try {
          const res = await fetch('/api/backup/encrypted-export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passphrase: pass })
          });
          const data = await res.json();
          if (data.status === 'success') {
            const blob = new Blob([data.encrypted_vault], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = data.filename;
            a.click();
            URL.revokeObjectURL(url);
            this.showToast("🔐 Encrypted OnTrack Vault generated!");
          }
        } catch (e) {
          alert('Export failed');
        }
      });
    }

    if (btnImport) {
      btnImport.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.vault,.txt';
        fileInput.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onload = async (evt) => {
            const content = evt.target.result;
            const pass = prompt('Enter the passphrase used to encrypt this vault:');
            if (!pass) return;

            try {
              const res = await fetch('/api/backup/encrypted-import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ encrypted_vault: content, passphrase: pass })
              });
              const data = await res.json();
              if (data.status === 'success') {
                alert(data.message);
                location.reload();
              } else {
                alert(data.message);
              }
            } catch (err) {
              alert('Import failed');
            }
          };
          reader.readAsText(file);
        };
        fileInput.click();
      });
    }
  }
};

window.AdvancedFeatures = AdvancedFeatures;
window.AdvancedUI = AdvancedFeatures;
AdvancedFeatures.loadAllFeatures = function() {
  return AdvancedFeatures.loadAllData();
};
document.addEventListener('DOMContentLoaded', () => {
  AdvancedFeatures.init();
});

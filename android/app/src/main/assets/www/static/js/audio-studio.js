/**
 * OnTrack - Polyphonic Lo-Fi Chill Radio & Mood Music Studio
 * 100% Offline Web Audio API Synthesizer with Studio Dynamics Compression
 * 
 * Features:
 * - 7 Completely Distinct Mood Lo-Fi Songs with Individual Tempos, Chords, Rhythms & Instruments:
 *   1. ☕ Midnight Coffee (76 BPM - Lo-Fi Chillhop with Rhodes, walking bass & boombap swing)
 *   2. 🌧 Rainy Cafe Window (66 BPM - Cascading raindrop piano arpeggios, rain shower & rimshots)
 *   3. 🌅 Golden Hour Horizon (88 BPM - Upbeat acoustic guitar strums, continuous shaker & bouncy bass)
 *   4. 🌌 Neon Coding Odyssey (104 BPM - Driving 8th-note synthwave bassline pulse, dual-saw sweeps & 808s)
 *   5. 🧘 Zen Temple Lotus (52 BPM - Tibetan singing bowl chimes, Japanese koto plucks & creek, no harsh drums)
 *   6. 🍂 Autumn Sunset Wind-Down (72 BPM - Warm fingerpicked nylon guitar, fireside crackle & brush snare)
 *   7. 🎯 Exam Velocity Sprint (112 BPM - Fast jazz-funk clavinet stabs, 4-beat walking bass & breakbeat)
 * - Studio-grade DynamicsCompressorNode + phone speaker harmonic bass enhancement (crystal clear & loud)
 * - Full master gain (0.85) with bright 3200-4500 Hz resonant harmonic filters
 * - Canvas spectrum visualizer, rotating vinyl disc, mood filters, and background ambient texture toggles
 */

const FocusAudioStudio = {
  ctx: null,
  masterGain: null,
  compressor: null,
  analyser: null,
  visualizerAnimId: null,

  currentTrackIndex: 0,
  isPlaying: false,
  activeFilter: 'all',

  // Sequencer state
  stepTimer: null,
  currentBeat: 0,
  chordIndex: 0,
  activeOscillators: [],
  ambientNode: null,
  rainEnabled: true,
  vinylEnabled: true,
  loopEnabled: true,

  tracks: [
    {
      id: 'midnight-coffee',
      title: 'Midnight Coffee',
      mood: 'Deep Study',
      moodCategory: 'study',
      moodIcon: '☕',
      bpm: 76,
      bg: 'linear-gradient(135deg, #FDE68A 0%, #D97706 100%)',
      color: '#D97706',
      desc: 'Warm Rhodes jazz chords, vinyl crackle, walking upright bass & boombap swing',
      chords: [
        [146.83, 220.00, 261.63, 329.63], // Dm9 (D3, A3, C4, E4)
        [196.00, 246.94, 293.66, 329.63], // G13 (G3, B3, D4, E4)
        [130.81, 196.00, 246.94, 293.66], // Cmaj9 (C3, G3, B3, D4)
        [110.00, 164.81, 220.00, 261.63]  // Am9 (A2, E3, A3, C4)
      ],
      bass: [73.42, 98.00, 65.41, 55.00], // D2, G2, C2, A1
      melody: [440, 523.25, 493.88, 392, 329.63, 392, 440, 523.25],
      instrument: 'rhodes',
      ambience: 'vinyl',
      drums: 'boombap'
    },
    {
      id: 'rainy-window',
      title: 'Rainy Cafe Window',
      mood: 'Cozy Melancholy',
      moodCategory: 'rain',
      moodIcon: '🌧',
      bpm: 66,
      bg: 'linear-gradient(135deg, #BAE6FD 0%, #0284C7 100%)',
      color: '#0284C7',
      desc: 'Cascading raindrop piano arpeggios, gentle rain shower & mellow rimshot clicks',
      chords: [
        [164.81, 196.00, 246.94, 293.66], // Em9
        [130.81, 164.81, 196.00, 246.94], // Cmaj7
        [110.00, 130.81, 164.81, 196.00], // Am7
        [123.47, 146.83, 185.00, 220.00]  // Bm7
      ],
      bass: [82.41, 65.41, 55.00, 61.74], // E2, C2, A1, B1
      melody: [329.63, 392.00, 493.88, 440.00, 392.00, 329.63, 293.66, 329.63],
      instrument: 'piano',
      ambience: 'rain',
      drums: 'rimshot'
    },
    {
      id: 'golden-hour',
      title: 'Golden Hour Horizon',
      mood: 'Morning Energy',
      moodCategory: 'morning',
      moodIcon: '🌅',
      bpm: 88,
      bg: 'linear-gradient(135deg, #FED7AA 0%, #EA580C 100%)',
      color: '#EA580C',
      desc: 'Breezy acoustic guitar strums, continuous crisp shaker & upbeat lo-fi bounce',
      chords: [
        [174.61, 220.00, 261.63, 329.63], // Fmaj7
        [164.81, 196.00, 246.94, 293.66], // Em7
        [146.83, 174.61, 220.00, 261.63], // Dm7
        [130.81, 164.81, 196.00, 246.94]  // Cmaj7
      ],
      bass: [87.31, 82.41, 73.42, 65.41], // F2, E2, D2, C2
      melody: [349.23, 440.00, 523.25, 493.88, 392.00, 349.23, 329.63, 392.00],
      instrument: 'guitar',
      ambience: 'birds',
      drums: 'shaker'
    },
    {
      id: 'neon-coding',
      title: 'Neon Coding Odyssey',
      mood: 'Late Night Cyber',
      moodCategory: 'night',
      moodIcon: '🌌',
      bpm: 104,
      bg: 'linear-gradient(135deg, #DDD6FE 0%, #7C3AED 100%)',
      color: '#7C3AED',
      desc: 'Driving 8th-note synthwave bassline pulse, sweeping analog pads & 808 kick',
      chords: [
        [220.00, 261.63, 329.63, 392.00], // Am7
        [174.61, 220.00, 261.63, 329.63], // Fmaj7
        [130.81, 164.81, 196.00, 246.94], // Cmaj7
        [196.00, 246.94, 293.66, 392.00]  // G
      ],
      bass: [55.00, 43.65, 65.41, 49.00], // A1, F1, C2, G1
      melody: [659.25, 587.33, 523.25, 392.00, 440.00, 523.25, 659.25, 587.33],
      instrument: 'synthwave',
      ambience: 'space',
      drums: 'electronic'
    },
    {
      id: 'zen-temple',
      title: 'Zen Temple Lotus',
      mood: 'Meditation & Calm',
      moodCategory: 'zen',
      moodIcon: '🧘',
      bpm: 52,
      bg: 'linear-gradient(135deg, #A7F3D0 0%, #059669 100%)',
      color: '#059669',
      desc: 'Tibetan singing bowl chimes, Japanese koto plucks & mountain stream (zero drums)',
      chords: [
        [146.83, 220.00, 293.66, 440.00], // Dsus
        [174.61, 220.00, 261.63, 349.23], // F6
        [196.00, 246.94, 293.66, 392.00], // Gsus4
        [220.00, 261.63, 329.63, 440.00]  // Am9
      ],
      bass: [73.42, 87.31, 98.00, 110.00],
      melody: [440.00, 523.25, 587.33, 659.25, 880.00, 659.25, 587.33, 440.00],
      instrument: 'singing-bowl',
      ambience: 'creek',
      drums: 'none'
    },
    {
      id: 'autumn-sunset',
      title: 'Autumn Sunset Wind-Down',
      mood: 'Sunset Calm',
      moodCategory: 'sunset',
      moodIcon: '🍂',
      bpm: 72,
      bg: 'linear-gradient(135deg, #FDE68A 0%, #B45309 100%)',
      color: '#B45309',
      desc: 'Warm fingerpicked nylon guitar, crackling fireplace warmth & soft brush snare',
      chords: [
        [196.00, 246.94, 293.66, 370.00], // Gmaj7
        [123.47, 185.00, 246.94, 293.66], // Bm7
        [130.81, 164.81, 196.00, 246.94], // Cmaj7
        [146.83, 185.00, 220.00, 293.66]  // D7
      ],
      bass: [98.00, 61.74, 65.41, 73.42], // G2, B1, C2, D2
      melody: [370.00, 392.00, 440.00, 493.88, 392.00, 293.66, 370.00, 440.00],
      instrument: 'guitar',
      ambience: 'vinyl',
      drums: 'brush'
    },
    {
      id: 'exam-velocity',
      title: 'Exam Velocity Sprint',
      mood: 'High Focus Sprint',
      moodCategory: 'sprint',
      moodIcon: '🎯',
      bpm: 112,
      bg: 'linear-gradient(135deg, #FECDD3 0%, #E11D48 100%)',
      color: '#E11D48',
      desc: 'Syncopated funk organ stabs, fast 4-beat walking bass & driving sprint beat',
      chords: [
        [123.47, 185.00, 246.94, 293.66], // Bm7
        [164.81, 196.00, 246.94, 293.66], // Em7
        [110.00, 164.81, 220.00, 277.18], // A7
        [146.83, 185.00, 220.00, 277.18]  // Dmaj7
      ],
      bass: [61.74, 82.41, 55.00, 73.42], // B1, E2, A1, D2
      melody: [440.00, 493.88, 554.37, 587.33, 440.00, 370.00, 440.00, 493.88],
      instrument: 'organ',
      ambience: 'vinyl',
      drums: 'sprint'
    }
  ],

  init() {
    this.renderTracklist();
    this.setupUI();
    this.updatePlayerUI();
  },

  getAudioContext() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master Gain Stage: High clarity master volume (0.85)
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

      // Studio Dynamics Compressor (Prevents clipping while maximizing loudness & punch)
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-22, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(28, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(10, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.22, this.ctx.currentTime);

      // Spectrum Analyser for visualizer
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;

      // Audio Graph: MasterGain -> Compressor -> Analyser -> Speakers
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  },

  setVolume(vol) {
    if (this.masterGain && this.ctx) {
      const clamped = Math.max(0, Math.min(1, vol));
      this.masterGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
    }
  },

  // ================= PLAYBACK CONTROLS =================
  playTrack(index) {
    if (index < 0) index = this.tracks.length - 1;
    if (index >= this.tracks.length) index = 0;

    this.stopPlaybackInternal();
    this.currentTrackIndex = index;
    this.isPlaying = true;

    const track = this.tracks[this.currentTrackIndex];
    const ctx = this.getAudioContext();
    if (!ctx) return;

    // Start background atmosphere (vinyl crackle, rain, birds, creek)
    this.startAmbience(track.ambience);

    // Compute step interval (1 beat = 60 / bpm seconds)
    const beatIntervalSec = 60 / track.bpm;
    const beatIntervalMs = beatIntervalSec * 1000;

    this.currentBeat = 0;
    this.chordIndex = 0;

    // Trigger initial beat immediately
    this.stepBeat(track);

    // Run tempo-locked sequencer
    this.stepTimer = setInterval(() => {
      this.stepBeat(track);
    }, beatIntervalMs);

    this.updatePlayerUI();
    this.startVisualizer();

    if (window.AndroidNative && window.AndroidNative.setKeepScreenOn) {
      window.AndroidNative.setKeepScreenOn(true);
    }
  },

  togglePlayPause() {
    if (this.isPlaying) {
      this.stopAll();
    } else {
      this.playTrack(this.currentTrackIndex);
    }
  },

  nextTrack() {
    let nextIdx = (this.currentTrackIndex + 1) % this.tracks.length;
    this.playTrack(nextIdx);
  },

  prevTrack() {
    let prevIdx = (this.currentTrackIndex - 1 + this.tracks.length) % this.tracks.length;
    this.playTrack(prevIdx);
  },

  playTrackById(id) {
    const idx = this.tracks.findIndex(t => t.id === id);
    if (idx !== -1) {
      this.playTrack(idx);
    }
  },

  stopAll() {
    this.stopPlaybackInternal();
    this.isPlaying = false;
    this.updatePlayerUI();
    this.stopVisualizer();

    if (window.AndroidNative && window.AndroidNative.setKeepScreenOn) {
      window.AndroidNative.setKeepScreenOn(false);
    }
  },

  stopPlaybackInternal() {
    if (this.stepTimer) {
      clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
    if (this.ambientNode) {
      try { this.ambientNode.stop(); this.ambientNode.disconnect(); } catch (e) {}
      this.ambientNode = null;
    }
    if (this.activeOscillators && this.activeOscillators.length) {
      this.activeOscillators.forEach(osc => {
        try { osc.stop(); osc.disconnect(); } catch (e) {}
      });
      this.activeOscillators = [];
    }
  },

  // ================= PER-TRACK DISTINCT SEQUENCER ENGINE =================
  stepBeat(track) {
    const ctx = this.getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const beatLen = 60 / track.bpm;
    const beatInBar = this.currentBeat % 4; // 0, 1, 2, 3

    const chordsList = track.chords;
    const bassList = track.bass;
    const melodyList = track.melody;
    const currentChord = chordsList[this.chordIndex % chordsList.length];
    const currentBass = bassList[this.chordIndex % bassList.length];

    // Branch uniquely per track style to give each track its own unmistakable rhythm!
    switch (track.id) {

      // TRACK 1: MIDNIGHT COFFEE (Classic Boombap Lo-Fi, 76 BPM)
      case 'midnight-coffee': {
        if (beatInBar === 0) {
          this.playChord(currentChord, now, 'rhodes', beatLen * 2.3);
          this.playBass(currentBass, now, beatLen * 1.8, 'upright');
          this.playKick(now, 0.22, 0.44);
          this.playHiHat(now, 0.10);
        } else if (beatInBar === 1) {
          this.playHiHat(now, 0.08);
          const mel = melodyList[this.currentBeat % melodyList.length];
          this.playMelodyPluck(mel, now + (beatLen * 0.1), 'rhodes');
        } else if (beatInBar === 2) {
          this.playSnare(now, 0.32);
          this.playBass(currentBass * 1.25, now, beatLen * 1.6, 'upright');
          this.playHiHat(now, 0.11);
        } else if (beatInBar === 3) {
          // Offbeat syncopated chord stab & kick
          this.playHiHat(now, 0.08);
          this.playChord(currentChord, now + (beatLen * 0.4), 'rhodes', beatLen * 0.8);
          this.playKick(now + (beatLen * 0.5), 0.18, 0.38);
          const mel = melodyList[(this.currentBeat + 2) % melodyList.length];
          this.playMelodyPluck(mel, now + (beatLen * 0.5), 'rhodes');
          this.chordIndex++;
        }
        break;
      }

      // TRACK 2: RAINY CAFE WINDOW (Cascading Piano Raindrops, 66 BPM)
      case 'rainy-window': {
        // Continuous cascading raindrop piano arpeggio on each beat
        const noteIdx = beatInBar % currentChord.length;
        const pianoNote = currentChord[noteIdx];
        this.playChord([pianoNote], now, 'piano', beatLen * 1.5);

        if (beatInBar === 0) {
          // Deep mellow bass pad holding through the bar
          this.playBass(currentBass, now, beatLen * 3.4, 'mellow');
          this.playHiHat(now, 0.04);
        } else if (beatInBar === 1) {
          // Soft raindrop ripple on offbeat
          this.playChord([currentChord[(noteIdx + 2) % currentChord.length] * 1.5], now + (beatLen * 0.5), 'piano', beatLen * 0.7);
        } else if (beatInBar === 2) {
          this.playRimshot(now, 0.22);
          this.playHiHat(now, 0.05);
          const mel = melodyList[this.currentBeat % melodyList.length];
          this.playMelodyPluck(mel, now + (beatLen * 0.2), 'piano');
        } else if (beatInBar === 3) {
          this.playChord([currentChord[0] * 2], now + (beatLen * 0.5), 'piano', beatLen * 0.8);
          this.chordIndex++;
        }
        break;
      }

      // TRACK 3: GOLDEN HOUR HORIZON (Acoustic Guitar & Shaker Groove, 88 BPM)
      case 'golden-hour': {
        // Continuous crisp shaker on every beat and offbeat
        this.playHiHat(now, 0.07, true);
        this.playHiHat(now + (beatLen * 0.5), 0.06, true);

        if (beatInBar === 0) {
          this.playChord(currentChord, now, 'guitar', beatLen * 1.2);
          this.playBass(currentBass, now, beatLen * 1.5, 'bouncy');
          this.playKick(now, 0.20, 0.42);
        } else if (beatInBar === 1) {
          const mel = melodyList[this.currentBeat % melodyList.length];
          this.playMelodyPluck(mel, now, 'guitar');
          // Syncopated upbeat acoustic strum
          this.playChord(currentChord, now + (beatLen * 0.5), 'guitar', beatLen * 0.7);
        } else if (beatInBar === 2) {
          this.playSnare(now, 0.30);
          this.playBass(currentBass * 1.25, now, beatLen * 1.4, 'bouncy');
        } else if (beatInBar === 3) {
          this.playChord(currentChord, now, 'guitar', beatLen * 0.9);
          this.playKick(now + (beatLen * 0.5), 0.16, 0.36);
          const mel = melodyList[(this.currentBeat + 3) % melodyList.length];
          this.playMelodyPluck(mel, now + (beatLen * 0.4), 'guitar');
          this.chordIndex++;
        }
        break;
      }

      // TRACK 4: NEON CODING ODYSSEY (Synthwave Running Bass & 808s, 104 BPM)
      case 'neon-coding': {
        // Driving running synth bassline pulse (root on beat, octave on offbeat)
        this.playBass(currentBass, now, beatLen * 0.42, 'synth');
        this.playBass(currentBass * 2, now + (beatLen * 0.5), beatLen * 0.42, 'synth');

        // Crisp 16th-note electro hi-hats
        this.playHiHat(now, 0.09);
        this.playHiHat(now + (beatLen * 0.5), 0.08);

        if (beatInBar === 0) {
          this.play808Kick(now, 0.46);
          // Sweeping analog pad held for 2 beats
          this.playChord(currentChord, now, 'synthwave', beatLen * 1.9);
        } else if (beatInBar === 1) {
          const mel = melodyList[this.currentBeat % melodyList.length];
          this.playMelodyPluck(mel, now, 'synthwave');
        } else if (beatInBar === 2) {
          this.play808Kick(now, 0.42);
          this.playSnare(now, 0.32);
          this.playChord(currentChord, now, 'synthwave', beatLen * 1.9);
        } else if (beatInBar === 3) {
          this.playSnare(now + (beatLen * 0.5), 0.28);
          const mel = melodyList[(this.currentBeat + 2) % melodyList.length];
          this.playMelodyPluck(mel, now + (beatLen * 0.4), 'synthwave');
          this.chordIndex++;
        }
        break;
      }

      // TRACK 5: ZEN TEMPLE LOTUS (Tibetan Singing Bowl & Koto, 52 BPM, Zero Drums)
      case 'zen-temple': {
        if (beatInBar === 0) {
          // Rich lingering singing bowl chime resonance with deep gong bass
          this.playSingingBowl(currentChord[0], now, beatLen * 5.5);
          this.playChord(currentChord, now, 'harp', beatLen * 4.2);
          this.playBass(currentBass, now, beatLen * 4.0, 'gong');
        } else if (beatInBar === 1) {
          const mel = melodyList[this.currentBeat % melodyList.length];
          this.playMelodyPluck(mel, now + (beatLen * 0.1), 'harp');
        } else if (beatInBar === 2) {
          // Shimmering overtone chime
          this.playSingingBowl(currentChord[2] * 2, now, beatLen * 3.0);
        } else if (beatInBar === 3) {
          const mel = melodyList[(this.currentBeat + 1) % melodyList.length];
          this.playMelodyPluck(mel, now + (beatLen * 0.3), 'harp');
          this.chordIndex++;
        }
        break;
      }

      // TRACK 6: AUTUMN SUNSET WIND-DOWN (Fingerstyle Nylon & Brush Snare, 72 BPM)
      case 'autumn-sunset': {
        if (beatInBar === 0) {
          // Thumb bass pluck + low guitar root
          this.playBass(currentBass, now, beatLen * 1.8, 'mellow');
          this.playChord([currentChord[0], currentChord[1]], now, 'guitar', beatLen * 1.4);
          this.playHiHat(now, 0.05);
        } else if (beatInBar === 1) {
          // High nylon string fingerpluck
          this.playChord([currentChord[2], currentChord[3]], now, 'guitar', beatLen * 1.2);
          this.playBrushSnare(now + (beatLen * 0.5), 0.14);
        } else if (beatInBar === 2) {
          this.playBrushSnare(now, 0.22);
          this.playBass(currentBass * 1.25, now, beatLen * 1.4, 'mellow');
          this.playHiHat(now, 0.06);
        } else if (beatInBar === 3) {
          const mel = melodyList[this.currentBeat % melodyList.length];
          this.playMelodyPluck(mel, now + (beatLen * 0.2), 'guitar');
          this.playChord([currentChord[1], currentChord[2]], now + (beatLen * 0.5), 'guitar', beatLen * 0.7);
          this.chordIndex++;
        }
        break;
      }

      // TRACK 7: EXAM VELOCITY SPRINT (Jazz-Funk Clavinet Stabs & Walking Bass, 112 BPM)
      case 'exam-velocity': {
        // Fast 4-beat walking jazz bassline on every single beat!
        const walkingBassMultiplier = [1.0, 1.25, 1.5, 1.78][beatInBar];
        this.playBass(currentBass * walkingBassMultiplier, now, beatLen * 0.85, 'upright');

        // Upbeat open hi-hat
        this.playHiHat(now + (beatLen * 0.5), 0.10);

        if (beatInBar === 0) {
          this.playKick(now, 0.18, 0.44);
          this.playHiHat(now, 0.08);
        } else if (beatInBar === 1) {
          this.playSnare(now, 0.32);
          // Syncopated sharp organ funk stab
          this.playChord(currentChord, now + (beatLen * 0.4), 'organ', beatLen * 0.5);
          const mel = melodyList[this.currentBeat % melodyList.length];
          this.playMelodyPluck(mel, now, 'organ');
        } else if (beatInBar === 2) {
          this.playKick(now, 0.18, 0.42);
          this.playKick(now + (beatLen * 0.5), 0.16, 0.36);
        } else if (beatInBar === 3) {
          this.playSnare(now, 0.34);
          this.playChord(currentChord, now + (beatLen * 0.4), 'organ', beatLen * 0.5);
          const mel = melodyList[(this.currentBeat + 2) % melodyList.length];
          this.playMelodyPluck(mel, now + (beatLen * 0.2), 'organ');
          this.chordIndex++;
        }
        break;
      }

      default: {
        if (beatInBar === 0) {
          this.playChord(currentChord, now, track.instrument, beatLen * 3.5);
          this.playBass(currentBass, now, beatLen * 3.0, 'upright');
          this.playKick(now);
          this.chordIndex++;
        } else if (beatInBar === 2) {
          this.playSnare(now);
        }
        this.playHiHat(now);
      }
    }

    this.currentBeat++;
  },

  // ================= RICH POLYPHONIC INSTRUMENT SYNTHESIS =================
  playChord(freqs, now, instrument, duration) {
    const ctx = this.ctx;
    if (!ctx) return;

    freqs.forEach((freq, idx) => {
      // Primary Oscillator
      const osc1 = ctx.createOscillator();
      // Secondary Detuned Oscillator (+6 cents for rich chorus & natural room presence)
      const osc2 = ctx.createOscillator();

      const gainNode = ctx.createGain();
      const filterNode = ctx.createBiquadFilter();

      if (instrument === 'rhodes') {
        osc1.type = 'sine';
        osc2.type = 'triangle';
        osc2.detune.setValueAtTime(6, now);
        filterNode.type = 'lowpass';
        filterNode.frequency.setValueAtTime(3200, now);
        filterNode.Q.setValueAtTime(1.4, now);
      } else if (instrument === 'piano') {
        osc1.type = 'triangle';
        osc2.type = 'sine';
        osc2.detune.setValueAtTime(-5, now);
        filterNode.type = 'lowpass';
        filterNode.frequency.setValueAtTime(3800, now);
        filterNode.Q.setValueAtTime(1.2, now);
      } else if (instrument === 'guitar') {
        osc1.type = 'triangle';
        osc2.type = 'sawtooth';
        osc2.detune.setValueAtTime(7, now);
        filterNode.type = 'lowpass';
        filterNode.frequency.setValueAtTime(4200, now);
        filterNode.Q.setValueAtTime(2.0, now);
      } else if (instrument === 'synthwave') {
        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';
        osc2.detune.setValueAtTime(12, now);
        filterNode.type = 'lowpass';
        filterNode.frequency.setValueAtTime(1400, now);
        filterNode.frequency.linearRampToValueAtTime(4200, now + (duration * 0.4));
        filterNode.frequency.linearRampToValueAtTime(2200, now + duration);
        filterNode.Q.setValueAtTime(2.5, now);
      } else if (instrument === 'organ') {
        osc1.type = 'triangle';
        osc2.type = 'square';
        osc2.detune.setValueAtTime(4, now);
        filterNode.type = 'lowpass';
        filterNode.frequency.setValueAtTime(3400, now);
        filterNode.Q.setValueAtTime(1.6, now);
      } else { // harp / default
        osc1.type = 'sine';
        osc2.type = 'triangle';
        osc2.detune.setValueAtTime(5, now);
        filterNode.type = 'lowpass';
        filterNode.frequency.setValueAtTime(4000, now);
      }

      // Slight natural strum / arpeggiation delay per note
      const noteDelay = idx * 0.024;
      const t = now + noteDelay;

      osc1.frequency.setValueAtTime(freq, t);
      osc2.frequency.setValueAtTime(freq, t);

      // Studio Gain Envelope: Loud & Clear (Peak 0.28 vs old 0.065!)
      const peakGain = instrument === 'organ' ? 0.22 : (instrument === 'synthwave' ? 0.20 : 0.28);
      gainNode.gain.setValueAtTime(0.0001, t);
      gainNode.gain.linearRampToValueAtTime(peakGain, t + 0.06);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, t + duration);

      osc1.connect(filterNode);
      osc2.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(this.masterGain);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + duration);
      osc2.stop(t + duration);

      this.activeOscillators.push(osc1, osc2);
    });
  },

  // ================= PUNCHY DUAL-HARMONIC BASS (AUDIBLE ON PHONE SPEAKERS) =================
  playBass(freq, now, duration, style = 'upright') {
    const ctx = this.ctx;
    if (!ctx) return;

    // Sub oscillator (Fundamental low end)
    const subOsc = ctx.createOscillator();
    subOsc.type = style === 'synth' ? 'sawtooth' : 'sine';
    subOsc.frequency.setValueAtTime(freq, now);

    // Harmonic oscillator (2nd harmonic at freq * 2 for mobile phone speakers)
    const harmOsc = ctx.createOscillator();
    harmOsc.type = 'triangle';
    harmOsc.frequency.setValueAtTime(freq * 2, now);
    harmOsc.detune.setValueAtTime(4, now);

    const filterNode = ctx.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(style === 'synth' ? 850 : 520, now);
    filterNode.Q.setValueAtTime(1.8, now);

    const gainNode = ctx.createGain();
    const peakGain = style === 'synth' ? 0.32 : 0.38; // Much louder than old 0.22
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(peakGain, now + 0.04);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    subOsc.connect(filterNode);
    harmOsc.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(this.masterGain);

    subOsc.start(now);
    harmOsc.start(now);
    subOsc.stop(now + duration);
    harmOsc.stop(now + duration);

    this.activeOscillators.push(subOsc, harmOsc);
  },

  // ================= BRIGHT HARMONIC MELODY PLUCK =================
  playMelodyPluck(freq, now, instrument) {
    const ctx = this.ctx;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = (instrument === 'synthwave' || instrument === 'organ') ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(4200, now);
    filter.Q.setValueAtTime(2.2, now);

    // Loud, sparkling pluck (Peak 0.24 vs old 0.07!)
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.24, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + 0.90);
    this.activeOscillators.push(osc);
  },

  // ================= TIBETAN SINGING BOWL BELL RESONATOR =================
  playSingingBowl(freq, now, duration) {
    const ctx = this.ctx;
    if (!ctx) return;

    // Fundamental chime + 2.76x singing bowl metallic ratio
    [freq, freq * 2.76].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(f, now);
      filter.Q.setValueAtTime(4.0, now);

      const amp = idx === 0 ? 0.30 : 0.16;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(amp, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + duration);
      this.activeOscillators.push(osc);
    });
  },

  // ================= PERCUSSION SYNTHESIS =================
  playKick(now, dur = 0.22, punch = 0.45) {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + dur);

    g.gain.setValueAtTime(punch, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + dur + 0.01);
  },

  play808Kick(now, punch = 0.48) {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.frequency.setValueAtTime(130, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.36);

    g.gain.setValueAtTime(punch, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.40);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.42);
  },

  playSnare(now, punch = 0.32) {
    const ctx = this.ctx;
    if (!ctx) return;

    // Triangle tone snap
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, now);
    oscGain.gain.setValueAtTime(punch * 0.7, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.13);

    // Resonant noise body
    this.playFilteredNoise(now, 0.15, 'bandpass', 2200, punch * 0.85);
  },

  playRimshot(now, punch = 0.24) {
    this.playFilteredNoise(now, 0.07, 'bandpass', 2800, punch);
  },

  playBrushSnare(now, punch = 0.18) {
    this.playFilteredNoise(now, 0.24, 'lowpass', 1800, punch);
  },

  playHiHat(now, vol = 0.12, isShaker = false) {
    const filterFreq = isShaker ? 5500 : 7800;
    const dur = isShaker ? 0.06 : 0.04;
    this.playFilteredNoise(now, dur, 'highpass', filterFreq, vol);
  },

  playFilteredNoise(now, duration, filterType, freq, gainVal) {
    const ctx = this.ctx;
    if (!ctx) return;

    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, now);

    const g = ctx.createGain();
    g.gain.setValueAtTime(gainVal, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noise.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + duration + 0.01);
  },

  // ================= AMBIENT BACKGROUND LAYER =================
  startAmbience(type) {
    if ((type === 'rain' || type === 'creek') && !this.rainEnabled) return;
    if (type !== 'rain' && type !== 'creek' && !this.vinylEnabled) return;
    const ctx = this.ctx;
    if (!ctx) return;

    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      if (type === 'rain' || type === 'creek') {
        data[i] = (lastOut + (0.02 * white)) / 1.02; // Warm pink noise
      } else {
        // Vinyl crackle with subtle authentic pops
        data[i] = (Math.random() < 0.004) ? (Math.random() * 0.4 - 0.2) : ((Math.random() * 2 - 1) * 0.018);
      }
      lastOut = data[i];
    }

    this.ambientNode = ctx.createBufferSource();
    this.ambientNode.buffer = buffer;
    this.ambientNode.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = type === 'rain' ? 'lowpass' : (type === 'creek' ? 'bandpass' : 'highpass');
    filter.frequency.setValueAtTime(type === 'rain' ? 950 : (type === 'creek' ? 1100 : 2800), ctx.currentTime);

    const g = ctx.createGain();
    g.gain.setValueAtTime(type === 'rain' ? 0.09 : (type === 'creek' ? 0.08 : 0.05), ctx.currentTime);

    this.ambientNode.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);

    this.ambientNode.start();
  },

  // ================= CANVAS WAVEFORM VISUALIZER =================
  startVisualizer() {
    const canvas = document.getElementById('audio-visualizer-canvas');
    if (!canvas || !this.analyser) return;

    const ctx2d = canvas.getContext('2d');
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      this.visualizerAnimId = requestAnimationFrame(render);
      this.analyser.getByteFrequencyData(dataArray);

      ctx2d.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 1.8;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.88;

        const grad = ctx2d.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
        grad.addColorStop(0, '#C084FC');
        grad.addColorStop(1, '#7C3AED');

        ctx2d.fillStyle = grad;
        ctx2d.beginPath();
        ctx2d.roundRect(x, canvas.height - barHeight, barWidth - 2, barHeight, 3);
        ctx2d.fill();

        x += barWidth + 2;
      }
    };
    render();
  },

  stopVisualizer() {
    if (this.visualizerAnimId) {
      cancelAnimationFrame(this.visualizerAnimId);
      this.visualizerAnimId = null;
    }
    const canvas = document.getElementById('audio-visualizer-canvas');
    if (canvas) {
      const ctx2d = canvas.getContext('2d');
      ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    }
  },

  // ================= UI RENDERING & FILTERING =================
  renderTracklist() {
    const container = document.getElementById('lofi-tracklist-container');
    if (!container) return;

    const filtered = this.activeFilter === 'all'
      ? this.tracks
      : this.tracks.filter(t => t.moodCategory === this.activeFilter);

    container.innerHTML = filtered.map((track) => {
      const realIdx = this.tracks.findIndex(t => t.id === track.id);
      const isCurrent = this.currentTrackIndex === realIdx;
      const isCurrentlyPlaying = isCurrent && this.isPlaying;

      return `
        <div class="lofi-song-card ${isCurrent ? 'active' : ''}" onclick="FocusAudioStudio.playTrack(${realIdx})">
          <div class="lofi-song-icon-badge" style="background:${track.bg};">
            <span>${track.moodIcon}</span>
          </div>

          <div class="lofi-song-info">
            <div class="lofi-song-title">
              <span>${track.title}</span>
              ${isCurrentlyPlaying ? `
                <div class="equalizer-bars-wrap">
                  <span class="eq-bar"></span>
                  <span class="eq-bar"></span>
                  <span class="eq-bar"></span>
                  <span class="eq-bar"></span>
                </div>
              ` : ''}
            </div>
            <div class="lofi-song-desc">${track.desc}</div>
          </div>

          <div class="lofi-song-meta-right">
            <span class="lofi-bpm-tag">${track.bpm} BPM</span>
            <span style="font-size:0.68rem; color:var(--text-muted); font-weight:700;">${track.mood}</span>
          </div>
        </div>
      `;
    }).join('');
  },

  filterMood(moodCat) {
    this.activeFilter = moodCat;
    document.querySelectorAll('.lofi-mood-pill').forEach(pill => {
      if (pill.getAttribute('data-mood') === moodCat) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });
    this.renderTracklist();
  },

  updatePlayerUI() {
    const track = this.tracks[this.currentTrackIndex];
    if (!track) return;

    // Title & Mood Tag
    const titleEl = document.getElementById('lofi-player-current-title');
    if (titleEl) titleEl.textContent = track.title;

    const moodEl = document.getElementById('lofi-player-current-mood');
    if (moodEl) moodEl.textContent = `${track.moodIcon} ${track.mood} • ${track.bpm} BPM`;

    // Disc Spinning Animation
    const discEl = document.getElementById('lofi-vinyl-disc');
    if (discEl) {
      if (this.isPlaying) {
        discEl.classList.add('playing');
      } else {
        discEl.classList.remove('playing');
      }
    }

    // Play / Pause Button Icon
    const btnPlay = document.getElementById('btn-lofi-play-pause');
    if (btnPlay) {
      btnPlay.innerHTML = this.isPlaying ? '⏸' : '▶';
      btnPlay.title = this.isPlaying ? 'Pause Lo-Fi' : 'Play Lo-Fi';
    }

    // Header Tag Indicator
    const indicator = document.getElementById('audio-status-indicator');
    if (indicator) {
      if (this.isPlaying) {
        indicator.textContent = `🎧 Playing: ${track.title}`;
        indicator.className = 'audio-status-tag active';
      } else {
        indicator.textContent = 'Lo-Fi Radio Idle';
        indicator.className = 'audio-status-tag idle';
      }
    }

    this.renderTracklist();
  },

  setupUI() {
    const btnPlay = document.getElementById('btn-lofi-play-pause');
    if (btnPlay) {
      btnPlay.onclick = () => this.togglePlayPause();
    }

    const btnPrev = document.getElementById('btn-lofi-prev');
    if (btnPrev) {
      btnPrev.onclick = () => this.prevTrack();
    }

    const btnNext = document.getElementById('btn-lofi-next');
    if (btnNext) {
      btnNext.onclick = () => this.nextTrack();
    }

    // Mood filter pills
    document.querySelectorAll('.lofi-mood-pill').forEach(pill => {
      pill.onclick = () => {
        const cat = pill.getAttribute('data-mood');
        this.filterMood(cat);
      };
    });

    // Volume Slider
    const volSlider = document.getElementById('audio-volume-slider');
    const volText = document.getElementById('audio-volume-text');
    if (volSlider) {
      volSlider.oninput = (e) => {
        const val = parseFloat(e.target.value);
        this.setVolume(val);
        if (volText) volText.textContent = `${Math.round(val * 100)}%`;
      };
    }

    // Audio Layer Toggles
    const toggleRain = document.getElementById('toggle-audio-rain-layer');
    if (toggleRain) {
      toggleRain.checked = this.rainEnabled;
      toggleRain.onchange = (e) => {
        this.rainEnabled = e.target.checked;
        if (this.isPlaying) {
          const t = this.tracks[this.currentTrackIndex];
          if (t && (t.ambience === 'rain' || t.ambience === 'creek')) {
            if (this.ambientNode) {
              try { this.ambientNode.stop(); this.ambientNode.disconnect(); } catch (err) {}
              this.ambientNode = null;
            }
            if (this.rainEnabled) this.startAmbience(t.ambience);
          }
        }
      };
    }

    const toggleVinyl = document.getElementById('toggle-audio-vinyl-layer');
    if (toggleVinyl) {
      toggleVinyl.checked = this.vinylEnabled;
      toggleVinyl.onchange = (e) => {
        this.vinylEnabled = e.target.checked;
        if (this.isPlaying) {
          const t = this.tracks[this.currentTrackIndex];
          if (t && t.ambience !== 'rain' && t.ambience !== 'creek') {
            if (this.ambientNode) {
              try { this.ambientNode.stop(); this.ambientNode.disconnect(); } catch (err) {}
              this.ambientNode = null;
            }
            if (this.vinylEnabled) this.startAmbience(t.ambience);
          }
        }
      };
    }

    const toggleLoop = document.getElementById('toggle-audio-loop');
    if (toggleLoop) {
      toggleLoop.checked = this.loopEnabled;
      toggleLoop.onchange = (e) => {
        this.loopEnabled = e.target.checked;
      };
    }
  },

  // Backwards-compatibility aliases for Aria AI and widget triggers
  playGamma40Hz() { this.playTrackById('midnight-coffee'); },
  playAlpha10Hz() { this.playTrackById('rainy-window'); },
  playBrownNoise() { this.playTrackById('neon-coding'); },
  playRain() { this.playTrackById('rainy-window'); }
};

window.FocusAudioStudio = FocusAudioStudio;
document.addEventListener('DOMContentLoaded', () => {
  FocusAudioStudio.init();
});

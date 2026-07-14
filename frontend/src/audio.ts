/**
 * Web Audio API Synthesizer for cozy background music and sound effects.
 * Synthesizes audio dynamically in the browser, eliminating static file dependencies.
 */

import type { FishRarity } from "@bomio/shared";

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterVolume: GainNode | null = null;
  private bgmVolume: GainNode | null = null;
  private sfxVolume: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;

  private isMuted: boolean = false;
  private isBgmPlaying: boolean = false;
  private bgmIntervalId: any = null;
  private bgmBeatCount: number = 0;

  // "Goofy circus polka" progression — plain, bright major triads instead of the old moody jazz
  // 9th chords. Each entry is 1 low "OOM" bass note + 1 bright "PAH" chord stab (see
  // playGoofyOom/playGoofyPah below) — the classic oom-pah rhythm is what makes this read as
  // silly/cartoonish rather than ambient. Frequencies in Hz.
  private goofyChords: { bass: number; stab: number[] }[] = [
    { bass: 65.41, stab: [261.63, 329.63, 392.0] }, // C2 -> C4 E4 G4 (C major)
    { bass: 87.31, stab: [349.23, 440.0, 174.61] }, // F2 -> F4 A4 F3 (F major)
    { bass: 98.0, stab: [392.0, 493.88, 587.33] }, // G2 -> G4 B4 D5 (G major)
    { bass: 65.41, stab: [261.63, 329.63, 392.0] }, // back home to C major
  ];

  // Bright, plain major scale for the bouncy melody on top (no moody pentatonic gaps — a goofy
  // tune wants big, obvious jumps).
  private goofyScale = [
    261.63, // C4
    293.66, // D4
    329.63, // E4
    349.23, // F4
    392.0, // G4
    440.0, // A4
    493.88, // B4
    523.25, // C5
    587.33, // D5
    659.25, // E5
  ];

  constructor() {
    this.isMuted = localStorage.getItem("bomio.audio.muted") === "true";
  }

  /**
   * Initializes the AudioContext upon a user interaction.
   * Safe to call multiple times; ignores if already initialized.
   */
  public init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") {
        console.log("[Audio] AudioContext is suspended. Attempting to resume...");
        this.ctx.resume().then(() => {
          console.log("[Audio] AudioContext resumed successfully. State:", this.ctx?.state);
        }).catch(err => {
          console.error("[Audio] Failed to resume AudioContext:", err);
        });
      }
      return;
    }

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass();
      console.log("[Audio] Created AudioContext. Initial state:", this.ctx.state);
      
      if (this.ctx.state === "suspended") {
        console.log("[Audio] AudioContext initialized as suspended. Attempting auto-resume...");
        this.ctx.resume().catch(err => console.error("[Audio] Auto-resume failed:", err));
      }
      
      // Setup master control
      this.masterVolume = this.ctx.createGain();
      this.masterVolume.gain.setValueAtTime(this.isMuted ? 0 : 0.8, this.ctx.currentTime);
      this.masterVolume.connect(this.ctx.destination);

      // Setup BGM line — default volume was reduced twice per Vicent's request: 0.35 -> 0.175 (-50%)
      // -> 0.1225 (another -30% off).
      this.bgmVolume = this.ctx.createGain();
      this.bgmVolume.gain.setValueAtTime(0.1225, this.ctx.currentTime);
      this.bgmVolume.connect(this.masterVolume);

      // Setup SFX line
      this.sfxVolume = this.ctx.createGain();
      this.sfxVolume.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.sfxVolume.connect(this.masterVolume);

      // Setup global delay effect for BGM/melody to feel lush and spacious
      this.delayNode = this.ctx.createDelay(1.0);
      this.delayNode.delayTime.setValueAtTime(0.35, this.ctx.currentTime);
      this.delayFeedback = this.ctx.createGain();
      this.delayFeedback.gain.setValueAtTime(0.4, this.ctx.currentTime);

      this.delayNode.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delayNode); // loop
      this.delayNode.connect(this.bgmVolume); // output delay to bgm output node

      this.startBgmLoop();
    } catch (e) {
      console.warn("[Audio] Failed to initialize Web Audio API:", e);
    }
  }

  /** Clean up resources and stop audio */
  public dispose() {
    if (this.bgmIntervalId) {
      clearInterval(this.bgmIntervalId);
      this.bgmIntervalId = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.isBgmPlaying = false;
  }

  /**
   * Toggles the master mute state, saving it to localStorage.
   */
  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    localStorage.setItem("bomio.audio.muted", String(this.isMuted));

    if (this.ctx && this.masterVolume) {
      this.init(); // Make sure context is active
      const targetGain = this.isMuted ? 0 : 0.8;
      this.masterVolume.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  public getMuteState(): boolean {
    return this.isMuted;
  }

  // --- Background Music Synthesizer Loop ---
  //
  // Theme: "goofy circus polka", gentler & slowed down per Vicent's direct request after
  // auditioning the first version (132 BPM, full volume — too harsh/hectic). Still keeps the oom-pah structure + vibrato
  // kazoo + occasional "boioioing" (in the spirit of the original "goofy and comedic" feel), just lowers the tempo and
  // intensity of volume/timbre to sound more relaxing, no longer feeling rushed like a real circus.
  private startBgmLoop() {
    if (this.isBgmPlaying || !this.ctx) return;
    this.isBgmPlaying = true;
    this.bgmBeatCount = 0;

    // Slowed down: 84 BPM (previously 132) — still has a slight bouncy oom-pah beat but much more leisurely.
    const beatDuration = 60 / 84;

    const playBeat = () => {
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") return;

      const time = this.ctx.currentTime;
      const chordIndex = Math.floor(this.bgmBeatCount / 4) % this.goofyChords.length;
      const beatInChord = this.bgmBeatCount % 4;
      const chord = this.goofyChords[chordIndex];

      // Oom-pah: bass note ("oom") at beat 0, bright chord stab ("pah") at the remaining 3 beats.
      if (beatInChord === 0) {
        this.playGoofyOom(chord.bass, time, beatDuration * 0.9);
      } else {
        this.playGoofyPah(chord.stab, time, beatDuration * 0.55);
      }

      // Bouncy melody on top — reduce probability a bit to make it sparser/lighter instead of constantly bustling.
      if (Math.random() < 0.5) {
        const freq = this.goofyScale[Math.floor(Math.random() * this.goofyScale.length)];
        this.playGoofyMelodyNote(freq, time);
      }

      // "Boioioing" is rarer now (every 4 bars instead of 2, lower probability as well) — still has some humor
      // sprinkled in but not rushed.
      if (this.bgmBeatCount % 32 === 16 && Math.random() < 0.4) {
        this.playGoofyBoing(time);
      }

      this.bgmBeatCount++;
    };

    // Run first beat
    playBeat();
    // Schedule loop — use correct beatDuration (previously hard-coded 1000ms although beatDuration was not 1.0,
    // it ran correctly by chance = 1.0; now that BPM changed, it must be multiplied correctly by actual beatDuration).
    this.bgmIntervalId = setInterval(playBeat, beatDuration * 1000);
  }

  /** "OOM" — short, punchy bass note (not a long-ringing pad) to make the beat sound bouncy like a tuba
   * in a circus band instead of soft as before. */
  private playGoofyOom(freq: number, startTime: number, duration: number) {
    if (!this.ctx || !this.bgmVolume) return;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    // Sawtooth instead of triangle — still slightly "tuba/kazoo" but with a lower lowpass filter + quieter volume
    // than the first version to be less harsh, sounding rounder/warmer.
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, startTime);

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(420, startTime);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.bgmVolume);

    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.linearRampToValueAtTime(0.22, startTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  /** "PAH" — hợp âm sáng, ngắn (nhịp phách nhẹ của oom-pah), mỗi nốt lệch cao độ (detune) nhẹ +
   * high-resonance bandpass filter to sound like a nasal/funny "kazoo" instead of a clean, soft chord. */
  private playGoofyPah(freqs: number[], startTime: number, duration: number) {
    if (!this.ctx || !this.bgmVolume) return;

    freqs.forEach((freq, idx) => {
      if (!this.ctx || !this.bgmVolume) return;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(freq, startTime);
      osc.detune.setValueAtTime((idx - 1) * 8, startTime);

      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(freq * 1.5, startTime);
      filter.Q.setValueAtTime(2.2, startTime);

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.bgmVolume);

      const vol = idx === 0 ? 0.11 : 0.08;
      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.linearRampToValueAtTime(vol, startTime + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.02);
    });
  }

  /** Nốt giai điệu nảy có rung (vibrato ~7Hz qua 1 LFO điều biến detune) — sóng vuông + rung nhanh
   * is a classic formula for a funny-sounding "wobbly kazoo horn", completely different from the smooth sine flute
   * from before. */
  private playGoofyMelodyNote(freq: number, startTime: number) {
    if (!this.ctx || !this.bgmVolume || !this.delayNode) return;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = "square";
    osc.frequency.setValueAtTime(freq, startTime);

    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(5, startTime); // slower (previously 7Hz) — gentler vibrato
    lfoGain.gain.setValueAtTime(14, startTime); // ± 14 cents (previously 25) — less harsh wobble
    lfo.connect(lfoGain);
    lfoGain.connect(osc.detune);

    osc.connect(gainNode);
    gainNode.connect(this.bgmVolume);
    gainNode.connect(this.delayNode);

    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.linearRampToValueAtTime(0.1, startTime + 0.03);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.4);

    lfo.start(startTime);
    osc.start(startTime);
    lfo.stop(startTime + 0.42);
    osc.stop(startTime + 0.42);
  }

  /** Animated slide-whistle style "boioioing" — pitches up and down very quickly, randomly
   * inserted into BGM loop for fun, not an SFX triggered by the player. */
  private playGoofyBoing(startTime: number) {
    if (!this.ctx || !this.bgmVolume) return;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(220, startTime);
    osc.frequency.exponentialRampToValueAtTime(700, startTime + 0.16); // lower peak (previously 880) — less bright
    osc.frequency.exponentialRampToValueAtTime(330, startTime + 0.4);

    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.linearRampToValueAtTime(0.13, startTime + 0.04);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.48);

    osc.connect(gainNode);
    gainNode.connect(this.bgmVolume);

    osc.start(startTime);
    osc.stop(startTime + 0.5);
  }

  // --- Sound Effects (SFX) Synthesizers ---

  /** Create a helper white noise buffer for wind/water sounds */
  private getNoiseBuffer(): AudioBuffer {
    if (!this.ctx) throw new Error("AudioContext not ready");
    const bufferSize = this.ctx.sampleRate * 1.5; // 1.5 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /** Swing/Cast: Sweeping wind sound */
  public playCast() {
    this.init();
    if (!this.ctx || !this.sfxVolume) return;

    const time = this.ctx.currentTime;
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = this.getNoiseBuffer();

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.setValueAtTime(2.0, time);
    // Sweep frequency from 1500Hz down to 250Hz
    filter.frequency.setValueAtTime(1500, time);
    filter.frequency.exponentialRampToValueAtTime(250, time + 0.22);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.01, time);
    gainNode.gain.linearRampToValueAtTime(0.4, time + 0.06);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.25);

    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.sfxVolume);

    noiseSource.start(time);
    noiseSource.stop(time + 0.3);
  }

  /** Splash: Bobber hitting water — "ka-plunk" nghe như CỤC ĐÁ ném xuống nước (yêu cầu Vicent
   * 2026-07-14): low, heavy, pitch SINKING DOWN (opposite of the water droplet shooting up). 4 layers: fast-sinking
   * "gloop" body, extremely low sub-thump for the falling weight, a contact "pop" sound when hitting the surface, and
   * slightly louder water splash fizz because stones displace more water. */
  public playSplash() {
    this.init();
    if (!this.ctx || !this.sfxVolume) return;

    const time = this.ctx.currentTime;

    // 1. "gloop" body — sine sinking quickly from 320→55Hz: the sound of a stone sliding into a water cavity.
    const body = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    body.type = "sine";
    body.frequency.setValueAtTime(320, time);
    body.frequency.exponentialRampToValueAtTime(55, time + 0.13);
    bodyGain.gain.setValueAtTime(0.0001, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.5, time + 0.008);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.24);
    body.connect(bodyGain);
    bodyGain.connect(this.sfxVolume);
    body.start(time);
    body.stop(time + 0.26);

    // 2. Extremely low sub-thump (sine 95→42Hz) — the weight of the falling object, more felt than heard.
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(95, time);
    sub.frequency.exponentialRampToValueAtTime(42, time + 0.2);
    subGain.gain.setValueAtTime(0.34, time);
    subGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.28);
    sub.connect(subGain);
    subGain.connect(this.sfxVolume);
    sub.start(time);
    sub.stop(time + 0.3);

    // 3. "pop" sound when hitting the surface — short noise through lowpass, giving the impact a clear start.
    const knock = this.ctx.createBufferSource();
    knock.buffer = this.getNoiseBuffer();
    const knockFilter = this.ctx.createBiquadFilter();
    knockFilter.type = "lowpass";
    knockFilter.frequency.setValueAtTime(1200, time);
    const knockGain = this.ctx.createGain();
    knockGain.gain.setValueAtTime(0.18, time);
    knockGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    knock.connect(knockFilter);
    knockFilter.connect(knockGain);
    knockGain.connect(this.sfxVolume);
    knock.start(time);
    knock.stop(time + 0.06);

    // 4. Water splash fizz — bandpass noise ~550Hz, slightly louder than the old version (stones displace more water than a bobber).
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer();
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(550, time);
    filter.Q.setValueAtTime(0.7, time);
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.11, time + 0.02);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.sfxVolume);
    noise.start(time);
    noise.stop(time + 0.18);
  }

  /** Exclamation/Bite: Sharp double notification beep */
  public playBite() {
    this.init();
    if (!this.ctx || !this.sfxVolume) return;

    const time = this.ctx.currentTime;

    const playBeep = (freq: number, start: number, duration: number) => {
      if (!this.ctx || !this.sfxVolume) return;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);

      gainNode.gain.setValueAtTime(0.001, start);
      gainNode.gain.linearRampToValueAtTime(0.3, start + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gainNode);
      gainNode.connect(this.sfxVolume);

      osc.start(start);
      osc.stop(start + duration + 0.02);
    };

    // Quick double beep
    playBeep(880, time, 0.06);     // A5
    playBeep(1320, time + 0.08, 0.08); // E6
  }

  /** Footstep: Rustling sound */
  public playFootstep() {
    this.init();
    if (!this.ctx || !this.sfxVolume) return;

    const time = this.ctx.currentTime;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer();

    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(450, time);
    filter.Q.setValueAtTime(1.5, time);

    const gainNode = this.ctx.createGain();
    // Very quiet footstep so it doesn't annoy the user
    gainNode.gain.setValueAtTime(0.05, time);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.sfxVolume);

    noise.start(time);
    noise.stop(time + 0.08);
  }

  /** Reel click: Mechanical click sound */
  public playReelClick() {
    this.init();
    if (!this.ctx || !this.sfxVolume) return;

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(1600, time);
    osc.frequency.exponentialRampToValueAtTime(600, time + 0.015);

    gainNode.gain.setValueAtTime(0.12, time);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.015);

    osc.connect(gainNode);
    gainNode.connect(this.sfxVolume);

    osc.start(time);
    osc.stop(time + 0.02);
  }

  /** High Tension Warning Chirp */
  public playTensionAlarm() {
    this.init();
    if (!this.ctx || !this.sfxVolume) return;

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    // Sharp warning square wave
    osc.type = "square";
    osc.frequency.setValueAtTime(1760, time); // A6 warning beep

    gainNode.gain.setValueAtTime(0.08, time);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.07);

    osc.connect(gainNode);
    gainNode.connect(this.sfxVolume);

    osc.start(time);
    osc.stop(time + 0.08);
  }

  /** Catch Fanfare: Celebratory ascending melody */
  public playCatch(rarity: FishRarity) {
    this.init();
    if (!this.ctx || !this.sfxVolume) return;

    const time = this.ctx.currentTime;

    const playTone = (freq: number, start: number, duration: number, vol = 0.25, type: OscillatorType = "triangle") => {
      if (!this.ctx || !this.sfxVolume) return;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);

      gainNode.gain.setValueAtTime(0.001, start);
      gainNode.gain.linearRampToValueAtTime(vol, start + 0.04);
      gainNode.gain.setValueAtTime(vol, start + duration - 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gainNode);
      gainNode.connect(this.sfxVolume);

      osc.start(start);
      osc.stop(start + duration + 0.05);
    };

    if (rarity === "legendary") {
      // Epic fanfare: multiple voices, fast arpeggio + vibrato + chords
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.5]; // C4, E4, G4, C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const noteStart = time + idx * 0.06;
        const dur = idx === notes.length - 1 ? 1.2 : 0.25;
        playTone(freq, noteStart, dur, 0.15, "triangle");
        // Harmony note
        if (idx === notes.length - 1) {
          playTone(1318.51, noteStart, dur, 0.1, "sine"); // E6 harmony
          playTone(1567.98, noteStart, dur, 0.08, "sine"); // G6 harmony
        }
      });
    } else if (rarity === "rare") {
      // Sparky rare catch arpeggio
      const notes = [329.63, 392.00, 523.25, 659.25, 783.99]; // E4, G4, C5, E5, G5
      notes.forEach((freq, idx) => {
        const noteStart = time + idx * 0.08;
        const dur = idx === notes.length - 1 ? 0.8 : 0.25;
        playTone(freq, noteStart, dur, 0.2, "triangle");
      });
    } else if (rarity === "uncommon") {
      // A clean triad + octaves
      const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
      notes.forEach((freq, idx) => {
        const noteStart = time + idx * 0.1;
        const dur = idx === notes.length - 1 ? 0.6 : 0.25;
        playTone(freq, noteStart, dur, 0.22, "sine");
      });
    } else {
      // Common catch: 3-note short arpeggio
      const notes = [261.63, 392.00, 523.25]; // C4, G4, C5
      notes.forEach((freq, idx) => {
        const noteStart = time + idx * 0.12;
        const dur = idx === notes.length - 1 ? 0.5 : 0.2;
        playTone(freq, noteStart, dur, 0.22, "sine");
      });
    }
  }

  /** Fish Escaped: sad sliding tone */
  public playEscape() {
    this.init();
    if (!this.ctx || !this.sfxVolume) return;

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc.type = "sawtooth";
    // Slide from 280Hz down to 110Hz
    osc.frequency.setValueAtTime(280, time);
    osc.frequency.linearRampToValueAtTime(110, time + 0.45);

    // Low-pass filter to make it sound muffled and sad
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(400, time);

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.sfxVolume);

    gainNode.gain.setValueAtTime(0.2, time);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.5);

    osc.start(time);
    osc.stop(time + 0.52);
  }

  /** Line Snapped: snap sound + rumble */
  public playSnap() {
    this.init();
    if (!this.ctx || !this.sfxVolume) return;

    const time = this.ctx.currentTime;

    // 1. High frequency snap (loud noise burst)
    const snapNoise = this.ctx.createBufferSource();
    snapNoise.buffer = this.getNoiseBuffer();
    const snapFilter = this.ctx.createBiquadFilter();
    snapFilter.type = "highpass";
    snapFilter.frequency.setValueAtTime(3000, time);

    const snapGain = this.ctx.createGain();
    snapGain.gain.setValueAtTime(0.4, time);
    snapGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

    snapNoise.connect(snapFilter);
    snapFilter.connect(snapGain);
    snapGain.connect(this.sfxVolume);

    snapNoise.start(time);
    snapNoise.stop(time + 0.06);

    // 2. Low-pitched rumble
    const rumbleOsc = this.ctx.createOscillator();
    const rumbleGain = this.ctx.createGain();

    rumbleOsc.type = "triangle";
    rumbleOsc.frequency.setValueAtTime(80, time);
    rumbleOsc.frequency.linearRampToValueAtTime(30, time + 0.35);

    rumbleGain.gain.setValueAtTime(0.3, time);
    rumbleGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.35);

    rumbleOsc.connect(rumbleGain);
    rumbleGain.connect(this.sfxVolume);

    rumbleOsc.start(time);
    rumbleOsc.stop(time + 0.36);
  }

  /** Cast Rejected: buzz sound */
  public playReject() {
    this.init();
    if (!this.ctx || !this.sfxVolume) return;

    const time = this.ctx.currentTime;

    const playBuzzOsc = (freq: number) => {
      if (!this.ctx || !this.sfxVolume) return;
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, time);

      gainNode.gain.setValueAtTime(0.12, time);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(220, time);

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.sfxVolume);

      osc.start(time);
      osc.stop(time + 0.2);
    };

    // Detuned sawtooth buzz
    playBuzzOsc(100);
    playBuzzOsc(103);
  }
}

export const audioManager = new AudioManager();

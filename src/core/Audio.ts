import { CONFIG } from '../config';

export type Sfx = 'jump' | 'dash' | 'splashSmall' | 'splashBig' | 'hit' | 'click' | 'pickup' | 'bonus' | 'crate' | 'peep' | 'peepSad' | 'doubleJump' | 'boing' | 'ribbit' | 'fanfare' | 'revive' | 'unlock';

/** Ignore repeats of the same effect closer together than this (s). */
const MIN_REPEAT = 0.04;

/**
 * Small Web Audio sound player. Effects are synthesised (no files to load), soft and short.
 * The AudioContext is created on the first user gesture, so autoplay rules are respected.
 * When real audio files arrive (docs/ASSET_SPEC.md) they can replace the synth recipes below.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private readonly lastPlayed = new Map<Sfx, number>();
  private hidden = false;
  private adPlaying = false;

  constructor(private muted: boolean) {
    const unlock = () => {
      this.ensureContext();
      if (this.ctx?.state === 'running') {
        window.removeEventListener('pointerdown', unlock, true);
        window.removeEventListener('keydown', unlock, true);
      }
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
  }

  get isMuted(): boolean {
    return this.muted;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolume();
  }

  /** Silence everything while the tab is hidden. */
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.applySuspend();
  }

  /** Silence everything while an ad plays (portal requirement). */
  setAdPlaying(playing: boolean): void {
    this.adPlaying = playing;
    this.applySuspend();
  }

  private get silenced(): boolean {
    return this.hidden || this.adPlaying;
  }

  private applySuspend(): void {
    if (!this.ctx) return;
    if (this.silenced) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  play(name: Sfx): void {
    const ctx = this.ctx;
    if (!ctx || this.muted || this.silenced || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (now - (this.lastPlayed.get(name) ?? -1) < MIN_REPEAT) return;
    this.lastPlayed.set(name, now);

    switch (name) {
      case 'jump':
        this.tone('sine', 420, 820, 0.14, 0.22);
        this.tone('triangle', 840, 1300, 0.08, 0.05);
        break;
      case 'dash':
        this.noiseBurst(0.2, 0.2, 'bandpass', 700, 3200, 1.2);
        this.tone('sine', 300, 620, 0.12, 0.05);
        break;
      case 'splashSmall':
        this.noiseBurst(0.14, 0.1, 'lowpass', 2200, 900);
        break;
      case 'splashBig':
        this.noiseBurst(0.34, 0.2, 'lowpass', 3000, 450);
        this.tone('sine', 180, 70, 0.14, 0.16);
        break;
      case 'hit':
        this.tone('triangle', 320, 90, 0.28, 0.26);
        this.noiseBurst(0.06, 0.12, 'highpass', 1500, 1500);
        this.tone('sine', 900, 1500, 0.09, 0.07, 0.06);
        break;
      case 'click':
        this.tone('sine', 620, 980, 0.07, 0.14);
        break;
      case 'pickup':
        this.tone('sine', 900, 1350, 0.09, 0.13);
        this.tone('triangle', 1350, 1800, 0.07, 0.05, 0.04);
        break;
      case 'bonus':
        this.tone('sine', 660, 700, 0.09, 0.13);
        this.tone('sine', 880, 920, 0.09, 0.13, 0.07);
        this.tone('sine', 1320, 1400, 0.16, 0.13, 0.14);
        break;
      case 'peep':
        // Cheerful double chirp: a duckling joined.
        this.tone('sine', 1500, 2100, 0.07, 0.13);
        this.tone('sine', 1700, 2400, 0.08, 0.12, 0.09);
        break;
      case 'peepSad':
        // Falling double chirp: a duckling was knocked off.
        this.tone('sine', 1600, 1000, 0.12, 0.13);
        this.tone('sine', 1300, 750, 0.16, 0.11, 0.14);
        break;
      case 'fanfare':
        // Beat-your-best flag: a bright rising arpeggio.
        this.tone('triangle', 523, 523, 0.12, 0.16);
        this.tone('triangle', 659, 659, 0.12, 0.16, 0.09);
        this.tone('triangle', 784, 784, 0.12, 0.16, 0.18);
        this.tone('sine', 1047, 1047, 0.3, 0.14, 0.27);
        break;
      case 'revive':
        // Back in the water: a long upward sweep with a sparkle on top.
        this.tone('sine', 260, 1040, 0.45, 0.2);
        this.tone('triangle', 780, 1560, 0.2, 0.06, 0.25);
        break;
      case 'unlock':
        // New skin bought.
        this.tone('sine', 660, 990, 0.1, 0.16);
        this.tone('sine', 990, 1320, 0.18, 0.14, 0.08);
        this.noiseBurst(0.15, 0.04, 'highpass', 4000, 7000);
        break;
      case 'doubleJump':
        // Lighter, higher hop with a little air whoosh.
        this.tone('sine', 640, 1250, 0.12, 0.18);
        this.noiseBurst(0.12, 0.06, 'highpass', 2500, 5000);
        break;
      case 'boing':
        // Springy lily-pad launch.
        this.tone('sine', 220, 760, 0.22, 0.22);
        this.tone('triangle', 330, 990, 0.16, 0.06, 0.03);
        break;
      case 'ribbit':
        // Two short croaks.
        this.tone('square', 210, 150, 0.07, 0.05);
        this.tone('square', 230, 160, 0.08, 0.05, 0.1);
        break;
      case 'crate':
        this.noiseBurst(0.2, 0.22, 'bandpass', 1300, 380, 1.4);
        this.tone('triangle', 230, 110, 0.13, 0.15);
        break;
    }
  }

  private ensureContext(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.noise = this.makeNoise(this.ctx);
        this.applyVolume();
      }
      if (this.ctx.state === 'suspended' && !this.silenced) void this.ctx.resume();
    } catch {
      this.ctx = null; // audio unavailable — the game stays silent
    }
  }

  private applyVolume(): void {
    if (this.master) this.master.gain.value = this.muted ? 0 : CONFIG.audio.masterVolume;
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** Pitch-swept oscillator with a quick attack and exponential decay. */
  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    this.envelope(gain, t, dur, vol);
    osc.connect(gain).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** Filtered noise with a swept cutoff — splashes and whooshes. */
  private noiseBurst(dur: number, vol: number, filterType: BiquadFilterType, f0: number, f1: number, q = 0.7): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(f0, t);
    filter.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const gain = ctx.createGain();
    this.envelope(gain, t, dur, vol);
    src.connect(filter).connect(gain).connect(this.master!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private envelope(gain: GainNode, t: number, dur: number, vol: number): void {
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
}

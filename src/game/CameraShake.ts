import { CONFIG } from '../config';

const C = CONFIG.camera.shake;

/**
 * Trauma-based camera shake. `add()` bumps trauma (0..1); each frame it decays and produces a small,
 * smooth offset (maxOffset × trauma²) for the camera centre. Off when the player prefers reduced motion.
 */
export class CameraShake {
  x = 0;
  y = 0;
  private trauma = 0;
  private time = 0;
  private readonly enabled: boolean;

  constructor() {
    let reduced = false;
    try {
      reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      /* matchMedia unavailable */
    }
    this.enabled = C.enabled && !reduced;
  }

  add(amount: number): void {
    if (this.enabled) this.trauma = Math.min(1, this.trauma + amount);
  }

  reset(): void {
    this.trauma = this.x = this.y = 0;
  }

  update(dt: number): void {
    this.time += dt;
    this.trauma = Math.max(0, this.trauma - C.decay * dt);
    const amp = C.maxOffset * this.trauma * this.trauma;
    // Sum of out-of-phase sines: smooth, non-repeating-looking jitter without allocation.
    const t = this.time * C.frequency * Math.PI * 2;
    this.x = amp * (Math.sin(t) + 0.5 * Math.sin(t * 2.3 + 1.7)) / 1.5;
    this.y = amp * (Math.sin(t * 1.3 + 0.6) + 0.5 * Math.sin(t * 2.9 + 4.1)) / 1.5;
  }
}

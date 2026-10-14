const MAX_STEP = 1 / 120;

/**
 * Damped spring for visual motion. Tuned by natural frequency (Hz) and damping ratio
 * (< 1 overshoots and wobbles; 1 settles without overshoot). Sub-steps internally so it stays
 * stable at any frame rate.
 */
export class Spring {
  value = 0;
  velocity = 0;
  private k = 0;
  private c = 0;

  constructor(frequency: number, dampingRatio: number) {
    this.tune(frequency, dampingRatio);
  }

  tune(frequency: number, dampingRatio: number): void {
    const omega = Math.PI * 2 * frequency;
    this.k = omega * omega;
    this.c = 2 * dampingRatio * omega;
  }

  step(target: number, dt: number): number {
    const steps = Math.max(1, Math.ceil(dt / MAX_STEP));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.velocity += (this.k * (target - this.value) - this.c * this.velocity) * h;
      this.value += this.velocity * h;
    }
    return this.value;
  }

  reset(value = 0): void {
    this.value = value;
    this.velocity = 0;
  }
}

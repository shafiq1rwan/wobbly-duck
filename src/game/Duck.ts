import { CONFIG } from '../config';
import type { Water } from './Water';

const D = CONFIG.duck;

function wrapAngle(a: number): number {
  return a - Math.PI * 2 * Math.floor((a + Math.PI) / (Math.PI * 2));
}

export interface Circle {
  x: number;
  y: number;
  r: number;
}

/**
 * Duck character controller: physics, states and the (fixed-size) collision circle.
 * Visual deformation lives in DuckView and never affects this.
 *
 * States are kept as flags rather than one enum, because they overlap (you can dash mid-air):
 *   swimming = !airborne, jumping = airborne, dashing = dashTime > 0, hurt = !alive
 */
export class Duck {
  x: number;
  y = 0;
  vy = 0;
  rotation = 0;
  airborne = false;
  alive = true;
  /** Remaining dash time. */
  dashTime = 0;
  /** Remaining cooldown before the next dash. */
  dashCooldown = 0;
  /** Remaining time a buffered jump stays valid. */
  jumpBuffer = 0;
  /** Forward screen nudge from dashing. */
  offsetX = 0;
  time = 0;

  /** Set for one step when something notable happens — consumed by the view/effects. */
  justJumped = false;
  justLanded = false;
  justDashed = false;
  landingSpeed = 0;

  readonly collider: Circle = { x: 0, y: 0, r: D.colliderRadius };

  constructor(readonly anchorX: number) {
    this.x = anchorX;
  }

  get dashing(): boolean {
    return this.dashTime > 0;
  }

  /** 0 → just dashed, 1 → ready. */
  get dashReadiness(): number {
    return 1 - Math.max(0, this.dashCooldown) / D.dash.cooldown;
  }

  reset(water: Water): void {
    this.x = this.anchorX;
    this.y = water.heightAt(this.x) - D.floatOffset;
    this.vy = 0;
    this.rotation = 0;
    this.airborne = false;
    this.alive = true;
    this.dashTime = 0;
    this.dashCooldown = 0;
    this.jumpBuffer = 0;
    this.offsetX = 0;
    this.time = 0;
    this.clearEvents();
    this.updateCollider();
  }

  clearEvents(): void {
    this.justJumped = this.justLanded = this.justDashed = false;
  }

  requestJump(): void {
    if (this.alive) this.jumpBuffer = D.jump.bufferTime;
  }

  /** Starts a dash if allowed; returns false while cooling down. */
  requestDash(): boolean {
    if (!this.alive || this.dashCooldown > 0) return false;
    this.dashTime = D.dash.duration;
    this.dashCooldown = D.dash.cooldown;
    this.justDashed = true;
    return true;
  }

  /** Extra world scroll speed contributed by the dash (strong at start, eases out). */
  dashSpeedBoost(): number {
    if (this.dashTime <= 0) return 0;
    const f = this.dashTime / D.dash.duration; // 1 → 0
    return D.dash.speedBoost * f * (2 - f);
  }

  kill(): void {
    if (!this.alive) return;
    this.alive = false;
    this.airborne = true;
    this.vy = -D.hurt.popVelocity;
    this.dashTime = 0;
    this.jumpBuffer = 0;
  }

  step(h: number, water: Water): void {
    this.time += h;
    this.dashTime = Math.max(0, this.dashTime - h);
    this.dashCooldown = Math.max(0, this.dashCooldown - h);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - h);

    // Forward nudge: snap out quickly while dashing, spring back afterwards.
    const offsetTarget = this.dashing ? D.dash.forwardOffset : 0;
    const offsetRate = this.dashing ? 25 : D.dash.offsetReturnRate;
    this.offsetX += (offsetTarget - this.offsetX) * Math.min(1, offsetRate * h);
    this.x = this.anchorX + this.offsetX;

    const b = D.buoyancy;
    const bob = b.bobAmplitude * Math.sin(this.time * b.bobFrequency * Math.PI * 2);
    const floatY = water.heightAt(this.x) - D.floatOffset + bob;

    if (this.jumpBuffer > 0 && this.canJump(floatY)) this.jump();

    if (this.airborne) {
      const j = D.jump;
      let g = j.gravity;
      if (this.vy > 0) g *= j.fallMultiplier;
      if (Math.abs(this.vy) < j.apexThreshold) g *= j.apexMultiplier;
      this.vy = Math.min(this.vy + g * h, j.maxFallSpeed);
      this.y += this.vy * h;

      const ceiling = CONFIG.water.restY - D.floatOffset - j.maxHeight;
      if (this.y < ceiling) {
        this.y = ceiling;
        this.vy = Math.max(this.vy, 0);
      }
      if (this.vy > 0 && this.y >= floatY) this.land();
    } else {
      // Spring-damper buoyancy toward the float line — soft, never a rigid snap.
      const disp = this.y - floatY;
      this.vy += (-b.stiffness * disp - b.damping * this.vy) * h;
      this.y += this.vy * h;
      const clamped = Math.max(-b.maxDisplacement, Math.min(b.maxDisplacement, this.y - floatY));
      if (clamped !== this.y - floatY) {
        this.y = floatY + clamped;
        if (Math.sign(this.vy) === Math.sign(clamped)) this.vy *= 0.3;
      }
    }

    this.updateRotation(h, water);
    this.updateCollider();
  }

  private canJump(floatY: number): boolean {
    if (!this.alive) return false;
    if (!this.airborne) return true;
    // Forgiveness: falling and almost back on the water.
    return this.vy > 0 && this.y >= floatY - D.jump.surfaceForgiveness;
  }

  private jump(): void {
    this.vy = -D.jump.velocity;
    this.airborne = true;
    this.jumpBuffer = 0;
    this.justJumped = true;
  }

  private land(): void {
    this.airborne = false;
    this.landingSpeed = this.vy;
    this.vy *= D.buoyancy.landingVelocityKeep;
    this.justLanded = true;
  }

  private updateRotation(h: number, water: Water): void {
    const r = D.rotation;
    let target: number;
    if (!this.alive && this.airborne) {
      this.rotation += D.hurt.spin * h;
      return;
    } else if (!this.alive) {
      target = 0.35; // dazed, nose-down
      this.rotation = wrapAngle(this.rotation);
    } else if (this.airborne) {
      target = this.vy * r.airFactor;
    } else {
      target = Math.atan(water.slopeAt(this.x)) * r.slopeFactor;
    }
    target = Math.max(-r.max, Math.min(r.max, target));
    this.rotation += (target - this.rotation) * Math.min(1, r.smoothing * h);
  }

  private updateCollider(): void {
    this.collider.x = this.x + D.colliderOffsetX;
    this.collider.y = this.y + D.colliderOffsetY;
  }
}

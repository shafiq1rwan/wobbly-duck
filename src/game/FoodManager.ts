import Phaser from 'phaser';
import { CONFIG } from '../config';
import type { ViewBounds } from '../core/Viewport';
import type { Circle } from './Duck';
import type { Water } from './Water';

const F = CONFIG.food;

export type FoodKind = keyof typeof F.kinds;

class Food {
  active = false;
  collecting = false;
  pickupTime = 0;
  kind: FoodKind = 'yellow';
  x = 0;
  y = 0;
  /** Height of the duck's centre (above its swimming position) at which this food sits. */
  height = 0;
  /** How much it rides the waves (1 = floats on them, 0 = hovers at a fixed height). */
  follow = 1;
  /** Resting on top of an obstacle (collected when that crate is smashed). */
  onTop = false;
  phase = 0;

  constructor(readonly sprite: Phaser.GameObjects.Image) {}
}

/**
 * Pooled corn-kernel collectibles (eight kinds, see CONFIG.food.kinds). Food on the water and on top of obstacles
 * rides the waves; food along a jump arc hovers at a fixed height. All of it bobs and pulses gently,
 * and is purely optional.
 */
export class FoodManager {
  private readonly pool: Food[] = [];
  private time = 0;

  constructor(scene: Phaser.Scene, depth: number) {
    for (let i = 0; i < F.poolSize; i++) {
      const sprite = scene.add.image(0, 0, F.kinds.yellow.key).setDepth(depth).setVisible(false);
      this.pool.push(new Food(sprite));
    }
  }

  clear(): void {
    for (const f of this.pool) this.deactivate(f);
  }

  spawn(kind: FoodKind, x: number, height: number, follow: number, onTop: boolean, water: Water): void {
    const f = this.pool.find((p) => !p.active && !p.collecting);
    if (!f) return;
    f.active = true;
    f.kind = kind;
    f.x = x;
    f.height = height;
    f.follow = follow;
    f.onTop = onTop;
    f.phase = Math.random() * Math.PI * 2;
    f.sprite.setTexture(F.kinds[kind].key).setAlpha(1).setVisible(true);
    this.place(f, water);
  }

  update(dt: number, dx: number, water: Water, view: ViewBounds): void {
    this.time += dt;
    for (const f of this.pool) {
      if (f.collecting) {
        f.pickupTime += dt;
        const t = Math.min(1, f.pickupTime / F.pickup.duration);
        if (t >= 1) {
          this.deactivate(f);
          continue;
        }
        f.x -= dx;
        const scale = F.kinds[f.kind].scale * (1 + F.pickup.popAmount * Math.sin(t * Math.PI) - F.pickup.shrink * t * t);
        f.sprite.setPosition(f.x, f.y - F.pickup.rise * t).setScale(scale).setAlpha(1 - t * t);
        continue;
      }
      if (!f.active) continue;
      f.x -= dx;
      if (f.x < view.left - 100) this.deactivate(f);
      else this.place(f, water);
    }
  }

  /** Collects everything the circle touches; returns the points gained. */
  collect(c: Circle, onPickup: (x: number, y: number, kind: FoodKind) => void): number {
    let points = 0;
    const r = c.r + F.pickupRadius;
    for (const f of this.pool) {
      if (!f.active) continue;
      const dx = f.x - c.x;
      const dy = f.y - c.y;
      if (dx * dx + dy * dy > r * r) continue;
      points += F.kinds[f.kind].points;
      onPickup(f.x, f.y, f.kind);
      this.beginPickup(f);
    }
    return points;
  }

  /** Collects food resting on top of an obstacle centred at `x` (e.g. a crate that was just smashed). */
  collectOnTop(x: number, halfW: number, onPickup: (x: number, y: number, kind: FoodKind) => void): number {
    let points = 0;
    for (const f of this.pool) {
      if (!f.active || !f.onTop || Math.abs(f.x - x) > halfW + 10) continue;
      points += F.kinds[f.kind].points;
      onPickup(f.x, f.y, f.kind);
      this.beginPickup(f);
    }
    return points;
  }

  forEachActive(fn: (x: number, y: number) => void): void {
    for (const f of this.pool) if (f.active) fn(f.x, f.y);
  }

  private place(f: Food, water: Water): void {
    const restY = CONFIG.water.restY;
    const surface = restY + (water.heightAt(f.x) - restY) * f.follow;
    const wave = Math.sin(this.time * F.bobFrequency * Math.PI * 2 + f.phase);
    // Food resting on an obstacle moves with it, so it bobs less.
    f.y = surface - CONFIG.duck.floatOffset - f.height + wave * F.bobAmplitude * (f.onTop ? 0.4 : 1);
    const pulse = F.pulseAmplitude * Math.sin(this.time * F.pulseFrequency * Math.PI * 2 + f.phase);
    const s = F.kinds[f.kind].scale;
    f.sprite.setPosition(f.x, f.y).setScale(s * (1 - pulse), s * (1 + pulse)).setRotation(wave * 0.12);
  }

  private beginPickup(f: Food): void {
    // Stop collision immediately, while keeping this pooled image for its brief pop.
    f.active = false;
    f.collecting = true;
    f.pickupTime = 0;
  }

  private deactivate(f: Food): void {
    f.active = false;
    f.collecting = false;
    f.sprite.setVisible(false).setAlpha(1);
  }
}

import Phaser from 'phaser';
import { CONFIG } from '../config';
import type { ViewBounds } from '../core/Viewport';
import type { Circle } from './Duck';
import type { Water } from './Water';

const F = CONFIG.food;

export type FoodKind = keyof typeof F.kinds;

class Food {
  active = false;
  kind: FoodKind = 'seed';
  x = 0;
  y = 0;
  /** Height of the duck's centre (above its swimming position) at which this food sits. */
  height = 0;
  phase = 0;

  constructor(readonly sprite: Phaser.GameObjects.Image) {}
}

/**
 * Pooled collectibles (seed, peas, corn). Low food rides the waves; food placed along a jump arc
 * hovers at a fixed height. All of it bobs and pulses gently, and is purely optional.
 */
export class FoodManager {
  private readonly pool: Food[] = [];
  private time = 0;

  constructor(scene: Phaser.Scene, depth: number) {
    for (let i = 0; i < F.poolSize; i++) {
      const sprite = scene.add.image(0, 0, F.kinds.seed.key).setDepth(depth).setVisible(false);
      this.pool.push(new Food(sprite));
    }
  }

  clear(): void {
    for (const f of this.pool) this.deactivate(f);
  }

  spawn(kind: FoodKind, x: number, height: number, water: Water): void {
    const f = this.pool.find((p) => !p.active);
    if (!f) return;
    f.active = true;
    f.kind = kind;
    f.x = x;
    f.height = height;
    f.phase = Math.random() * Math.PI * 2;
    f.sprite.setTexture(F.kinds[kind].key).setVisible(true);
    this.place(f, water);
  }

  update(dt: number, dx: number, water: Water, view: ViewBounds): void {
    this.time += dt;
    for (const f of this.pool) {
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
      this.deactivate(f);
    }
    return points;
  }

  forEachActive(fn: (x: number, y: number) => void): void {
    for (const f of this.pool) if (f.active) fn(f.x, f.y);
  }

  private place(f: Food, water: Water): void {
    const swimY = (f.height < 1 ? water.heightAt(f.x) : CONFIG.water.restY) - CONFIG.duck.floatOffset;
    const wave = Math.sin(this.time * F.bobFrequency * Math.PI * 2 + f.phase);
    f.y = swimY - f.height + wave * F.bobAmplitude;
    const s = F.kinds[f.kind].scale * (1 + 0.06 * Math.sin(this.time * 5 + f.phase));
    f.sprite.setPosition(f.x, f.y).setScale(s).setRotation(wave * 0.12);
  }

  private deactivate(f: Food): void {
    f.active = false;
    f.sprite.setVisible(false);
  }
}

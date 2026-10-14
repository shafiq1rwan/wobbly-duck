import Phaser from 'phaser';
import { CONFIG } from '../config';
import { TEX, TEX_RES } from '../art/textures';
import type { ViewBounds } from '../core/Viewport';
import type { Circle } from './Duck';
import type { Water } from './Water';

export type ObstacleType = 'log';

/** Axis-aligned hit box (world units), kept separate from the rendered sprite. */
interface Box {
  x: number;
  y: number;
  halfW: number;
  halfH: number;
}

class Obstacle {
  active = false;
  type: ObstacleType = 'log';
  x = 0;
  y = 0;
  readonly box: Box = { x: 0, y: 0, halfW: 0, halfH: 0 };

  constructor(readonly sprite: Phaser.GameObjects.Image) {}
}

const O = CONFIG.obstacles;

/**
 * Pooled obstacles. Phase 1 only spawns floating logs at fair, speed-scaled gaps;
 * Phase 3 replaces the spawner with handcrafted patterns and adds rocks/crates.
 */
export class ObstacleManager {
  private readonly pool: Obstacle[] = [];
  /** World distance at which the next obstacle spawns. */
  private nextSpawnAt = 0;
  spawning = false;

  constructor(scene: Phaser.Scene, depth: number) {
    for (let i = 0; i < O.poolSize; i++) {
      const sprite = scene.add
        .image(0, 0, TEX.log)
        .setScale(1 / TEX_RES)
        .setDepth(depth)
        .setVisible(false);
      this.pool.push(new Obstacle(sprite));
    }
  }

  reset(distance: number): void {
    for (const o of this.pool) this.deactivate(o);
    this.nextSpawnAt = distance + O.firstSpawnDistance;
  }

  update(dx: number, distance: number, speed: number, water: Water, view: ViewBounds): void {
    for (const o of this.pool) {
      if (!o.active) continue;
      o.x -= dx;
      if (o.x < view.left - O.despawnMargin) {
        this.deactivate(o);
        continue;
      }
      this.place(o, water);
    }

    if (this.spawning && distance >= this.nextSpawnAt) {
      this.spawn('log', view.right + O.spawnMargin, water);
      const gapTime = Phaser.Math.FloatBetween(O.minGapTime, O.maxGapTime);
      this.nextSpawnAt = distance + Math.max(speed, CONFIG.world.baseSpeed) * gapTime;
    }
  }

  /** Returns the first obstacle hit by the circle, if any. */
  hitTest(c: Circle): Obstacle | null {
    for (const o of this.pool) {
      if (o.active && circleIntersectsBox(c, o.box)) return o;
    }
    return null;
  }

  forEachActive(fn: (box: Box) => void): void {
    for (const o of this.pool) if (o.active) fn(o.box);
  }

  private spawn(type: ObstacleType, x: number, water: Water): void {
    const o = this.pool.find((p) => !p.active);
    if (!o) return;
    o.active = true;
    o.type = type;
    o.x = x;
    o.sprite.setVisible(true);
    this.place(o, water);
  }

  /** Floating obstacles ride the water surface and tilt with it. */
  private place(o: Obstacle, water: Water): void {
    const log = O.log;
    o.y = water.heightAt(o.x) + log.floatOffset;
    o.sprite.setPosition(o.x, o.y);
    o.sprite.setRotation(Math.atan(water.slopeAt(o.x)) * log.tiltFactor);
    o.box.x = o.x;
    o.box.y = o.y;
    o.box.halfW = log.width / 2 - log.hitInsetX;
    o.box.halfH = log.height / 2 - log.hitInsetY;
  }

  private deactivate(o: Obstacle): void {
    o.active = false;
    o.sprite.setVisible(false);
  }
}

function circleIntersectsBox(c: Circle, b: Box): boolean {
  const nx = Math.max(b.x - b.halfW, Math.min(c.x, b.x + b.halfW));
  const ny = Math.max(b.y - b.halfH, Math.min(c.y, b.y + b.halfH));
  const dx = c.x - nx;
  const dy = c.y - ny;
  return dx * dx + dy * dy < c.r * c.r;
}

import Phaser from 'phaser';
import { CONFIG } from '../config';
import type { ViewBounds } from '../core/Viewport';
import type { Circle } from './Duck';
import type { Water } from './Water';

const O = CONFIG.obstacles;

export type ObstacleType = keyof typeof O.types;

/** Axis-aligned hit box (world units), kept separate from the rendered sprite. */
export interface Box {
  x: number;
  y: number;
  halfW: number;
  halfH: number;
}

export class Obstacle {
  active = false;
  type: ObstacleType = 'log';
  x = 0;
  y = 0;
  rippleTimer = 0;
  readonly box: Box = { x: 0, y: 0, halfW: 0, halfH: 0 };

  constructor(readonly sprite: Phaser.GameObjects.Image) {}
}

/**
 * Pooled obstacles (log, crate, rock — see CONFIG.obstacles.types). They drift left with the world,
 * ride the water surface as configured, and expose fixed hit boxes. What to spawn and when is decided
 * by the pattern Spawner.
 */
export class ObstacleManager {
  private readonly pool: Obstacle[] = [];

  /** Vertical origin of each type's texture (stacks: the bottom crate's centre). */
  private readonly originY = new Map<ObstacleType, number>();

  constructor(scene: Phaser.Scene, depth: number) {
    for (const [type, t] of Object.entries(O.types) as [ObstacleType, (typeof O.types)[ObstacleType]][]) {
      this.originY.set(type, 'stack' in t ? buildStack(scene, t.key, O.types[t.stack.of].key, t.stack.count) : t.originY);
    }
    for (let i = 0; i < O.poolSize; i++) {
      const sprite = scene.add.image(0, 0, O.types.log.key).setDepth(depth).setVisible(false);
      this.pool.push(new Obstacle(sprite));
    }
  }

  clear(): void {
    for (const o of this.pool) this.deactivate(o);
  }

  spawn(type: ObstacleType, x: number, water: Water): void {
    const o = this.pool.find((p) => !p.active);
    if (!o) return;
    const t = O.types[type];
    o.active = true;
    o.type = type;
    o.x = x;
    o.rippleTimer = Math.random() * O.rockRippleInterval;
    o.sprite.setTexture(t.key).setOrigin(t.originX, this.originY.get(type)!).setScale(t.scale).setVisible(true);
    o.box.halfW = t.hit.halfW;
    o.box.halfH = t.hit.halfH;
    this.place(o, water);
  }

  update(dt: number, dx: number, water: Water, view: ViewBounds): void {
    for (const o of this.pool) {
      if (!o.active) continue;
      o.x -= dx;
      if (o.x < view.left - O.despawnMargin) {
        this.deactivate(o);
        continue;
      }
      this.place(o, water);
      if (o.type === 'rock') {
        o.rippleTimer -= dt;
        if (o.rippleTimer <= 0) {
          o.rippleTimer = O.rockRippleInterval;
          water.disturb(o.x - o.box.halfW - 6, O.rockRipple, 18);
          water.disturb(o.x + o.box.halfW + 6, O.rockRipple, 18);
        }
      }
    }
  }

  /** Returns the first obstacle hit by the circle, if any. */
  hitTest(c: Circle): Obstacle | null {
    for (const o of this.pool) {
      if (o.active && circleIntersectsBox(c, o.box)) return o;
    }
    return null;
  }

  /** Breaks a (breakable) obstacle and frees its slot. */
  smash(o: Obstacle): void {
    this.deactivate(o);
  }

  /** Removes every obstacle left of `maxX` (revive clears the river ahead); reports each one. */
  clearBefore(maxX: number, fn: (x: number, y: number) => void): void {
    for (const o of this.pool) {
      if (!o.active || o.x > maxX) continue;
      fn(o.x, o.y);
      this.deactivate(o);
    }
  }

  forEachActive(fn: (box: Box) => void): void {
    for (const o of this.pool) if (o.active) fn(o.box);
  }

  /** Floats on the surface (blended with the rest line by `waveFollow`) and tilts with the slope. */
  private place(o: Obstacle, water: Water): void {
    const t = O.types[o.type];
    const restY = CONFIG.water.restY;
    o.y = restY + (water.heightAt(o.x) - restY) * t.waveFollow + t.floatOffset;
    o.sprite.setPosition(o.x, o.y);
    o.sprite.setRotation(t.tilt ? Math.atan(water.slopeAt(o.x)) * t.tilt : 0);
    o.box.x = o.x;
    o.box.y = o.y + t.hit.offsetY;
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

/**
 * Builds a texture of `count` copies of `baseKey` stacked on top of each other (each one a few pixels
 * off-centre, like a hand-made pile). Returns the vertical origin that puts the bottom one's centre
 * at the sprite's position, so a stack floats exactly like a single one.
 */
function buildStack(scene: Phaser.Scene, key: string, baseKey: string, count: number): number {
  const img = scene.textures.get(baseKey).getSourceImage() as HTMLImageElement;
  const w = img.width;
  const h = img.height;
  const pad = 8; // transparent margin around the crate face in the art
  const step = h - pad * 2; // each crate sits right on the face below it
  const shift = 4;
  const height = h + step * (count - 1);
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, w + shift, height)!;
    for (let i = 0; i < count; i++) {
      // Bottom first; every other crate nudged right.
      tex.context.drawImage(img, i % 2 === 1 ? shift : 0, height - h - i * step);
    }
    tex.refresh();
  }
  return (height - h / 2) / height;
}

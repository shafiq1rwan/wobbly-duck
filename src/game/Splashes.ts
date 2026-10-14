import Phaser from 'phaser';
import { CONFIG } from '../config';
import type { Water } from './Water';

const S = CONFIG.splash;

type Kind = 'drop' | 'line';

interface Particle {
  active: boolean;
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: number;
}

/**
 * Pooled water droplets and dash speed lines, drawn with one Graphics object.
 * Particles live in world space and drift left with the scrolling world; droplets that fall back
 * into the water leave a tiny ripple.
 */
export class Splashes {
  private readonly pool: Particle[] = [];
  private readonly gfx: Phaser.GameObjects.Graphics;
  private cursor = 0;

  constructor(scene: Phaser.Scene, depth: number) {
    for (let i = 0; i < S.poolSize; i++) {
      this.pool.push({ active: false, kind: 'drop', x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, color: 0xffffff });
    }
    this.gfx = scene.add.graphics().setDepth(depth);
  }

  clear(): void {
    for (const p of this.pool) p.active = false;
  }

  /**
   * Burst of droplets from (x, y). Angles in radians (0 = right, −π/2 = up).
   */
  burst(x: number, y: number, count: number, speedMin: number, speedMax: number, angleMin: number, angleMax: number, sizeMin = 3, sizeMax = 6): void {
    for (let i = 0; i < count; i++) {
      const p = this.take();
      const a = Phaser.Math.FloatBetween(angleMin, angleMax);
      const v = Phaser.Math.FloatBetween(speedMin, speedMax);
      p.kind = 'drop';
      p.x = x + Phaser.Math.FloatBetween(-6, 6);
      p.y = y;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.maxLife = p.life = Phaser.Math.FloatBetween(0.5, 0.9);
      p.size = Phaser.Math.FloatBetween(sizeMin, sizeMax);
      p.color = S.dropColors[(Math.random() * S.dropColors.length) | 0];
    }
  }

  /** A short white streak flying backwards (dash speed line). */
  speedLine(x: number, y: number): void {
    const p = this.take();
    p.kind = 'line';
    p.x = x;
    p.y = y;
    p.vx = -Phaser.Math.FloatBetween(500, 800);
    p.vy = 0;
    p.maxLife = p.life = Phaser.Math.FloatBetween(0.12, 0.2);
    p.size = Phaser.Math.FloatBetween(26, 48);
    p.color = 0xffffff;
  }

  update(dt: number, worldDx: number, water: Water): void {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt - worldDx;
      p.y += p.vy * dt;
      if (p.kind === 'drop') {
        p.vy += S.dropGravity * dt;
        if (p.vy > 0 && p.y > water.heightAt(p.x) + 2) {
          water.disturb(p.x, 18 * p.size, 14);
          p.active = false;
        }
      }
    }
  }

  draw(): void {
    const g = this.gfx;
    g.clear();
    for (const p of this.pool) {
      if (!p.active) continue;
      const fade = Math.min(1, (p.life / p.maxLife) * 3);
      if (p.kind === 'drop') {
        g.fillStyle(p.color, 0.95 * fade);
        g.fillCircle(p.x, p.y, p.size * (0.6 + 0.4 * fade));
      } else {
        g.fillStyle(p.color, 0.75 * (p.life / p.maxLife));
        g.fillRoundedRect(p.x, p.y - 2, p.size, 4, 2);
      }
    }
  }

  /** Next free particle, or recycle the oldest slot when the pool is full. */
  private take(): Particle {
    for (let n = 0; n < this.pool.length; n++) {
      const p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % this.pool.length;
      if (!p.active) {
        p.active = true;
        return p;
      }
    }
    const p = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % this.pool.length;
    p.active = true;
    return p;
  }
}

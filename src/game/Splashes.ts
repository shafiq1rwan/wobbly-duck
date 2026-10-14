import Phaser from 'phaser';
import { CONFIG } from '../config';
import type { Water } from './Water';

const S = CONFIG.splash;

type Kind = 'drop' | 'line' | 'spark' | 'chunk';

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
 * Pooled particles drawn with one Graphics object: water droplets, dash speed lines, pickup sparkles
 * and crate wood chunks. They live in world space and drift left with the scrolling world; droplets
 * and chunks that fall back into the water leave a tiny ripple.
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

  /** Little sparkles bursting outwards (food pickup). */
  sparkle(x: number, y: number, count: number, colors: readonly number[]): void {
    for (let i = 0; i < count; i++) {
      const p = this.take();
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const v = Phaser.Math.FloatBetween(90, 200);
      p.kind = 'spark';
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.maxLife = p.life = Phaser.Math.FloatBetween(0.3, 0.45);
      p.size = Phaser.Math.FloatBetween(3, 5);
      p.color = colors[i % colors.length];
    }
  }

  /** Wood pieces flying out of a smashed crate. */
  chunks(x: number, y: number, count: number, colors: readonly number[]): void {
    for (let i = 0; i < count; i++) {
      const p = this.take();
      const a = Phaser.Math.FloatBetween(-2.9, -0.25);
      const v = Phaser.Math.FloatBetween(180, 420);
      p.kind = 'chunk';
      p.x = x + Phaser.Math.FloatBetween(-18, 18);
      p.y = y + Phaser.Math.FloatBetween(-18, 12);
      p.vx = Math.cos(a) * v + 120; // thrown forward by the dash
      p.vy = Math.sin(a) * v;
      p.maxLife = p.life = Phaser.Math.FloatBetween(0.7, 1);
      p.size = Phaser.Math.FloatBetween(6, 11);
      p.color = colors[i % colors.length];
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
      if (p.kind === 'drop' || p.kind === 'chunk') {
        p.vy += S.dropGravity * dt;
        if (p.vy > 0 && p.y > water.heightAt(p.x) + 2) {
          water.disturb(p.x, (p.kind === 'chunk' ? 10 : 18) * p.size, 14);
          p.active = false;
        }
      } else if (p.kind === 'spark') {
        const drag = Math.max(0, 1 - 5 * dt);
        p.vx *= drag;
        p.vy *= drag;
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
      } else if (p.kind === 'spark') {
        // Four-point twinkle: two crossed bars.
        const r = p.size * (0.5 + p.life / p.maxLife);
        g.fillStyle(p.color, fade);
        g.fillRect(p.x - r, p.y - r * 0.28, r * 2, r * 0.56);
        g.fillRect(p.x - r * 0.28, p.y - r, r * 0.56, r * 2);
      } else if (p.kind === 'chunk') {
        g.fillStyle(0x6e4524, fade);
        g.fillRoundedRect(p.x - p.size / 2 - 1.5, p.y - p.size * 0.3 - 1.5, p.size + 3, p.size * 0.6 + 3, 2.5);
        g.fillStyle(p.color, fade);
        g.fillRoundedRect(p.x - p.size / 2, p.y - p.size * 0.3, p.size, p.size * 0.6, 2);
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

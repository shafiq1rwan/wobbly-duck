import Phaser from 'phaser';
import { CONFIG } from '../config';
import type { ViewBounds } from '../core/Viewport';

interface Wave {
  amplitude: number;
  k: number; // 2π / wavelength
  omega: number; // phase speed (rad/s)
}

/**
 * Procedural water surface: a few small travelling sine waves that scroll with the world.
 * Cheap to sample anywhere (height + slope), and redrawn each frame as simple polygons.
 *
 * Phase 2 will add spring-based local ripples/splashes on top of `heightAt`.
 */
export class Water {
  private time = 0;
  /** Total world distance scrolled — waves are anchored to the world, so they scroll with it. */
  private scroll = 0;
  private readonly waves: Wave[];
  /** Opaque ocean body behind the duck and obstacles. */
  private readonly back: Phaser.GameObjects.Graphics;
  /** Translucent tint + surface highlight in front of them. */
  private readonly front: Phaser.GameObjects.Graphics;
  private heights = new Float32Array(256);

  constructor(scene: Phaser.Scene, backDepth: number, frontDepth: number) {
    this.waves = CONFIG.water.waves.map((w) => ({
      amplitude: w.amplitude,
      k: (Math.PI * 2) / w.wavelength,
      omega: w.speed,
    }));
    this.back = scene.add.graphics().setDepth(backDepth);
    this.front = scene.add.graphics().setDepth(frontDepth);
  }

  reset(): void {
    this.time = 0;
    this.scroll = 0;
  }

  update(dt: number, worldDx: number): void {
    this.time += dt;
    this.scroll += worldDx;
  }

  /** Surface y at world x. */
  heightAt(x: number): number {
    const u = x + this.scroll;
    let h = CONFIG.water.restY;
    for (const w of this.waves) h += w.amplitude * Math.sin(u * w.k + this.time * w.omega);
    return h;
  }

  /** dy/dx of the surface at world x. */
  slopeAt(x: number): number {
    const u = x + this.scroll;
    let s = 0;
    for (const w of this.waves) s += w.amplitude * w.k * Math.cos(u * w.k + this.time * w.omega);
    return s;
  }

  draw(view: ViewBounds): void {
    const w = CONFIG.water;
    const step = w.renderStep;
    const x0 = view.left - step;
    const count = Math.ceil((view.right + step - x0) / step) + 1;
    if (this.heights.length < count) this.heights = new Float32Array(count * 2);
    const hs = this.heights;
    for (let i = 0; i < count; i++) hs[i] = this.heightAt(x0 + i * step);
    const bottom = view.bottom + 20;

    // Behind: opaque ocean, plus a deeper band that follows the surface softly (depth without gradients).
    const b = this.back;
    b.clear();
    this.fillBelow(b, w.oceanColor, 1, x0, count, bottom, 0, 1);
    this.fillBelow(b, w.deepColor, 1, x0, count, bottom, 70, 0.4);

    // In front: light tint over submerged parts, then the surface highlight.
    const f = this.front;
    f.clear();
    this.fillBelow(f, w.color, w.alpha, x0, count, bottom, 0, 1);
    f.fillStyle(w.highlightColor, 1);
    f.beginPath();
    f.moveTo(x0, hs[0] - 1);
    for (let i = 1; i < count; i++) f.lineTo(x0 + i * step, hs[i] - 1);
    for (let i = count - 1; i >= 0; i--) f.lineTo(x0 + i * step, hs[i] + w.highlightThickness);
    f.closePath();
    f.fillPath();
  }

  /** Fills from a (scaled, offset) copy of the surface down to `bottom`. */
  private fillBelow(
    g: Phaser.GameObjects.Graphics,
    color: number,
    alpha: number,
    x0: number,
    count: number,
    bottom: number,
    offset: number,
    waveScale: number,
  ): void {
    const { renderStep: step, restY } = CONFIG.water;
    const hs = this.heights;
    g.fillStyle(color, alpha);
    g.beginPath();
    g.moveTo(x0, restY + offset + (hs[0] - restY) * waveScale);
    for (let i = 1; i < count; i++) g.lineTo(x0 + i * step, restY + offset + (hs[i] - restY) * waveScale);
    g.lineTo(x0 + (count - 1) * step, bottom);
    g.lineTo(x0, bottom);
    g.closePath();
    g.fillPath();
  }
}

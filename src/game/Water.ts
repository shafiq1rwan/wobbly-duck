import Phaser from 'phaser';
import { CONFIG } from '../config';
import type { ViewBounds } from '../core/Viewport';
import { lerpColor } from './Background';

interface Wave {
  amplitude: number;
  k: number; // 2π / wavelength
  omega: number; // phase speed (rad/s)
}

/**
 * Procedural water surface: a few small travelling sine waves that scroll with the world, plus
 * local spring ripples (splashes, wakes). Cheap to sample anywhere (height + slope) and redrawn
 * each frame as simple polygons.
 *
 * Ripples are a ring buffer of spring columns indexed by absolute world position, so they drift
 * left with the scenery. Only columns inside the view (plus a margin) are simulated.
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
  /** Current colours: the tropical palette blended towards the lake one (setBlend). */
  private readonly colors = {
    oceanColor: CONFIG.water.oceanColor as number,
    deepColor: CONFIG.water.deepColor as number,
    color: CONFIG.water.color as number,
    highlightColor: CONFIG.water.highlightColor as number,
  };
  private blend = 0;

  private readonly rippleH: Float32Array;
  private readonly rippleV: Float32Array;
  /** Absolute column range currently simulated, and the newest column that has been cleared. */
  private firstCol = 0;
  private lastCol = -1;
  private clearedTo = -Infinity;

  constructor(
    scene: Phaser.Scene,
    backDepth: number,
    frontDepth: number,
    /** Live view bounds (updated in place by the camera framing). */
    private readonly view: ViewBounds,
  ) {
    this.rippleH = new Float32Array(CONFIG.water.ripples.columns);
    this.rippleV = new Float32Array(CONFIG.water.ripples.columns);
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

  /** Water colours: 0 = tropical sea, 1 = lake. */
  setBlend(t: number): void {
    if (t === this.blend) return;
    this.blend = t;
    const lake = CONFIG.lake.water;
    for (const k of Object.keys(this.colors) as (keyof typeof this.colors)[]) {
      this.colors[k] = lerpColor(CONFIG.water[k], lake[k], t);
    }
  }

  update(dt: number, worldDx: number): void {
    this.time += dt;
    this.scroll += worldDx;
    this.stepRipples(dt);
  }

  /** Surface y at world x. */
  heightAt(x: number): number {
    const u = x + this.scroll;
    let h = CONFIG.water.restY;
    for (const w of this.waves) h += w.amplitude * Math.sin(u * w.k + this.time * w.omega);
    return h + this.rippleAt(u);
  }

  /** dy/dx of the surface at world x. */
  slopeAt(x: number): number {
    const u = x + this.scroll;
    let s = 0;
    for (const w of this.waves) s += w.amplitude * w.k * Math.cos(u * w.k + this.time * w.omega);
    const spacing = CONFIG.water.ripples.spacing;
    return s + (this.rippleAt(u + spacing * 0.5) - this.rippleAt(u - spacing * 0.5)) / spacing;
  }

  /**
   * Pushes the surface around world x. `impulse` is a column velocity (+ pushes down, − lifts);
   * it fades to zero at `radius` with a smooth cosine falloff.
   */
  disturb(x: number, impulse: number, radius: number): void {
    const spacing = CONFIG.water.ripples.spacing;
    const u = x + this.scroll;
    const from = Math.max(this.firstCol, Math.ceil((u - radius) / spacing));
    const to = Math.min(this.lastCol, Math.floor((u + radius) / spacing));
    for (let j = from; j <= to; j++) {
      const d = Math.abs(j * spacing - u) / radius;
      this.rippleV[this.slot(j)] += impulse * 0.5 * (1 + Math.cos(Math.PI * Math.min(1, d)));
    }
  }

  private slot(col: number): number {
    const n = this.rippleH.length;
    return ((col % n) + n) % n;
  }

  /** Ripple height at absolute coordinate u (linear between columns; 0 outside the simulated range). */
  private rippleAt(u: number): number {
    const f = u / CONFIG.water.ripples.spacing;
    const j = Math.floor(f);
    if (j < this.firstCol || j + 1 > this.lastCol) return 0;
    const a = this.rippleH[this.slot(j)];
    return a + (this.rippleH[this.slot(j + 1)] - a) * (f - j);
  }

  private stepRipples(dt: number): void {
    const r = CONFIG.water.ripples;
    const h = this.rippleH;
    const v = this.rippleV;
    const margin = 160;
    const n = h.length;
    let first = Math.floor((this.view.left - margin + this.scroll) / r.spacing);
    const last = Math.ceil((this.view.right + margin + this.scroll) / r.spacing);
    first = Math.max(first, last - n + 3);

    // Columns entering on the right (or after a big jump) start flat.
    if (last - this.clearedTo > n || first > this.clearedTo) this.clearedTo = first - 1;
    for (let j = this.clearedTo + 1; j <= last; j++) {
      h[this.slot(j)] = 0;
      v[this.slot(j)] = 0;
    }
    this.clearedTo = Math.max(this.clearedTo, last);
    this.firstCol = first;
    this.lastCol = last;

    for (let j = first; j <= last; j++) {
      const i = this.slot(j);
      const left = j > first ? h[this.slot(j - 1)] : 0;
      const right = j < last ? h[this.slot(j + 1)] : 0;
      v[i] += (-r.stiffness * h[i] - r.damping * v[i] + r.spread * (left + right - 2 * h[i])) * dt;
    }
    for (let j = first; j <= last; j++) {
      const i = this.slot(j);
      h[i] = Math.max(-r.maxHeight, Math.min(r.maxHeight, h[i] + v[i] * dt));
    }
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
    const c = this.colors;
    const b = this.back;
    b.clear();
    this.fillBelow(b, c.oceanColor, 1, x0, count, bottom, 0, 1);
    this.fillBelow(b, c.deepColor, 1, x0, count, bottom, 70, 0.4);

    // In front: light tint over submerged parts, then the surface highlight.
    const f = this.front;
    f.clear();
    this.fillBelow(f, c.color, w.alpha, x0, count, bottom, 0, 1);
    f.fillStyle(c.highlightColor, 1);
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

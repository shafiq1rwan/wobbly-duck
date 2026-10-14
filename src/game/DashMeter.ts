import Phaser from 'phaser';
import { CONFIG } from '../config';
import type { Duck } from './Duck';

const M = CONFIG.duck.dash.meter;
const TRACK = 0x13266a;
const FILL = 0xffffff;
const READY = 0xffd93f;
const DENIED = 0xff8f6b;

/**
 * Subtle dash cooldown meter that floats above the duck. Hidden while dash is ready; after a dash it
 * fills up, pops in yellow when ready, then fades. Flashes if the player dashes too early.
 */
export class DashMeter {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private wasCharging = false;
  private popTime = 0;
  private deniedTime = 0;

  constructor(scene: Phaser.Scene, depth: number) {
    this.gfx = scene.add.graphics().setDepth(depth);
  }

  /** The player tried to dash during cooldown. */
  denied(): void {
    this.deniedTime = 0.25;
  }

  reset(): void {
    this.wasCharging = false;
    this.popTime = this.deniedTime = 0;
    this.gfx.clear();
  }

  draw(duck: Duck, dt: number): void {
    const g = this.gfx;
    g.clear();
    if (!duck.alive) return;

    const charging = duck.dashCooldown > 0;
    if (this.wasCharging && !charging) this.popTime = M.readyPop;
    this.wasCharging = charging;
    this.popTime = Math.max(0, this.popTime - dt);
    this.deniedTime = Math.max(0, this.deniedTime - dt);
    if (!charging && this.popTime <= 0) return;

    const progress = charging ? duck.dashReadiness : 1;
    // Ready pop: grow slightly and fade out.
    const pop = this.popTime > 0 ? this.popTime / M.readyPop : 1;
    const scale = charging ? 1 : 1 + 0.25 * (1 - pop);
    const alpha = charging ? 0.85 : pop;
    const shake = this.deniedTime > 0 ? Math.sin(this.deniedTime * 90) * 3 : 0;

    const w = M.width * scale;
    const h = M.height * scale;
    const x = duck.x + M.offsetX - w / 2 + shake;
    const y = duck.y + M.offsetY - h / 2;
    const r = h / 2;

    g.fillStyle(TRACK, 0.55 * alpha);
    g.fillRoundedRect(x - 2, y - 2, w + 4, h + 4, r + 2);
    const fillW = Math.max(h, w * progress);
    const color = !charging ? READY : this.deniedTime > 0 ? DENIED : FILL;
    g.fillStyle(color, alpha);
    g.fillRoundedRect(x, y, fillW, h, r);
  }
}

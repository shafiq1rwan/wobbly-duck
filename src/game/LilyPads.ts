import Phaser from 'phaser';
import { CONFIG } from '../config';
import type { ViewBounds } from '../core/Viewport';
import type { Duck } from './Duck';
import { Spring } from './Spring';
import type { Water } from './Water';

const L = CONFIG.lilyPads;
const F = CONFIG.frog;
const FROG_ANIM = 'frog-leap';

type FrogState = 'none' | 'sitting' | 'leaping';

class Pad {
  active = false;
  x = 0;
  y = 0;
  frog: FrogState = 'none';
  frogT = 0;
  frogX = 0;
  frogY = 0;
  readonly squash = new Spring(4.5, 0.3);

  constructor(
    readonly sprite: Phaser.GameObjects.Sprite,
    readonly frogSprite: Phaser.GameObjects.Sprite,
  ) {}
}

export interface LilyPadEvents {
  bounced(x: number, y: number, mother: boolean): void;
  frogLeapt(x: number, y: number): void;
  frogSplash(x: number, y: number): void;
}

/**
 * Lily pads float on the river; swimming onto one launches the duck (and each duckling) high into
 * the air. Some pads carry a frog that leaps off into the water as the duck gets close — scenery,
 * never an obstacle.
 */
export class LilyPads {
  private readonly pool: Pad[] = [];

  constructor(
    scene: Phaser.Scene,
    padDepth: number,
    frogDepth: number,
    private readonly events: LilyPadEvents,
  ) {
    if (!scene.anims.exists(FROG_ANIM)) {
      scene.anims.create({
        key: FROG_ANIM,
        frames: scene.anims.generateFrameNumbers(F.key, { start: 1, end: 5 }),
        duration: F.leapTime * 1000,
        repeat: 0,
      });
    }
    for (let i = 0; i < L.poolSize; i++) {
      const sprite = scene.add.sprite(0, 0, L.key, 0).setOrigin(0.5, 1).setScale(L.scale).setDepth(padDepth).setVisible(false);
      const frogSprite = scene.add.sprite(0, 0, F.key, 0).setScale(F.scale).setDepth(frogDepth).setVisible(false);
      this.pool.push(new Pad(sprite, frogSprite));
    }
  }

  clear(): void {
    for (const p of this.pool) this.release(p);
  }

  spawn(x: number, water: Water): void {
    const p = this.pool.find((q) => !q.active);
    if (!p) return;
    p.active = true;
    p.x = x;
    p.squash.reset();
    p.sprite.setFrame(Math.floor(Math.random() * L.variants)).setVisible(true);
    p.frog = Math.random() < L.frogChance ? 'sitting' : 'none';
    p.frogSprite.setFrame(0).setFlipX(false).setVisible(p.frog === 'sitting');
    this.place(p, water);
  }

  update(h: number, dx: number, water: Water, view: ViewBounds, mother: Duck): void {
    for (const p of this.pool) {
      if (!p.active) continue;
      p.x -= dx;
      if (p.x < view.left - 160 && p.frog !== 'leaping') {
        this.release(p);
        continue;
      }
      this.place(p, water);
      if (p.frog === 'sitting' && p.x - mother.x < L.frogScatterDistance) this.leap(p);
      else if (p.frog === 'leaping') this.stepLeap(p, h, dx, water);
    }
  }

  /**
   * Bounces the duck if it is swimming (or falling) onto a pad. Returns true when it bounced.
   * Used for the mother and for each duckling.
   */
  tryBounce(duck: Duck, mother: boolean): boolean {
    if (!duck.alive || (duck.airborne && duck.vy <= 0)) return false;
    const c = duck.collider;
    for (const p of this.pool) {
      if (!p.active || Math.abs(c.x - p.x) > L.halfW) continue;
      const padTop = p.y - L.topOffset;
      if (c.y + c.r < padTop - L.catchHeight) continue; // still too high above it
      duck.bounce(L.bounceVelocity);
      p.squash.velocity -= 7;
      this.events.bounced(p.x, padTop, mother);
      return true;
    }
    return false;
  }

  /** Per frame: pad squash. */
  sync(dt: number): void {
    for (const p of this.pool) {
      if (!p.active) continue;
      const s = Phaser.Math.Clamp(p.squash.step(0, dt), -0.35, 0.25);
      p.sprite.setScale(L.scale * (1 - s * 0.5), L.scale * (1 + s));
    }
  }

  forEachPad(fn: (x: number, top: number, halfW: number) => void): void {
    for (const p of this.pool) if (p.active) fn(p.x, p.y - L.topOffset, L.halfW);
  }

  setFrozen(frozen: boolean): void {
    for (const p of this.pool) {
      if (frozen) p.frogSprite.anims.pause();
      else p.frogSprite.anims.resume();
    }
  }

  private place(p: Pad, water: Water): void {
    p.y = water.heightAt(p.x) + L.sink;
    p.sprite.setPosition(p.x, p.y).setRotation(Math.atan(water.slopeAt(p.x)) * 0.6);
    if (p.frog === 'sitting') {
      p.frogX = p.x - 8;
      p.frogY = p.y - L.topOffset - F.sitOffset;
      p.frogSprite.setPosition(p.frogX, p.frogY);
    }
  }

  private leap(p: Pad): void {
    p.frog = 'leaping';
    p.frogT = 0;
    p.frogSprite.play(FROG_ANIM);
    this.events.frogLeapt(p.frogX, p.frogY);
  }

  /** Arc forward (away from the duck) and down into the water, then splash and vanish. */
  private stepLeap(p: Pad, h: number, dx: number, water: Water): void {
    p.frogT += h;
    const t = Math.min(1, p.frogT / F.leapTime);
    const startX = p.x - 8;
    const startY = p.y - L.topOffset - F.sitOffset;
    const x = startX + F.leapDistance * t;
    const endY = water.heightAt(x) - 4;
    const y = startY + (endY - startY) * t - F.leapHeight * 4 * t * (1 - t);
    p.frogSprite.setPosition(x, y);
    void dx; // the pad (and so the leap origin) already moves with the world
    if (t >= 1) {
      p.frog = 'none';
      p.frogSprite.setVisible(false);
      this.events.frogSplash(x, water.heightAt(x));
    }
  }

  private release(p: Pad): void {
    p.active = false;
    p.frog = 'none';
    p.sprite.setVisible(false);
    p.frogSprite.setVisible(false);
  }
}

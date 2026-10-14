import Phaser from 'phaser';
import { CONFIG } from '../config';
import type { ViewBounds } from '../core/Viewport';
import { Duck } from './Duck';
import { DuckView } from './DuckView';
import type { ObstacleManager } from './ObstacleManager';
import type { Water } from './Water';

const P = CONFIG.ducklings;
const M = CONFIG.duck;

type State = 'idle' | 'lost' | 'following' | 'leaving';

/** World position (distance scrolled, screen x) where the mother jumped. */
interface JumpMark {
  distance: number;
  x: number;
}

class Duckling {
  state: State = 'idle';
  /** Place in line: 1 = right behind the mother. */
  slot = 0;
  leaveTime = 0;
  jumps: JumpMark[] = [];
  /** Countdown to the copied jump (< 0 = none pending). */
  jumpDelay = -1;

  constructor(
    readonly duck: Duck,
    readonly view: DuckView,
  ) {}
}

export interface ParadeEvents {
  joined(x: number, y: number, count: number): void;
  lost(x: number, y: number, count: number): void;
  landed(x: number, strength: number): void;
}

/**
 * The Duckling Parade: lost ducklings bob on the river; swimming into one adds it to a line behind
 * the mother duck. Followers copy the mother's jumps at the same world position she jumped, plus
 * `extraLag` per place in line — so a well-timed jump saves everyone, a late one loses the tail.
 * A follower hit by an obstacle tumbles away; the run goes on. Ducklings reuse the duck's controller
 * and squishy view, scaled down.
 */
export class Parade {
  private readonly all: Duckling[] = [];
  private readonly rings: Phaser.GameObjects.Graphics;
  private time = 0;

  constructor(
    scene: Phaser.Scene,
    depth: number,
    private readonly events: ParadeEvents,
  ) {
    for (let i = 0; i < P.max + 4; i++) {
      const duck = new Duck(0, {
        floatOffset: M.floatOffset * P.size,
        colliderRadius: M.colliderRadius * P.size,
        colliderOffsetX: M.colliderOffsetX * P.size,
        colliderOffsetY: M.colliderOffsetY * P.size,
      });
      const view = new DuckView(scene, depth, P.size, P.tint);
      view.setVisible(false);
      this.all.push(new Duckling(duck, view));
    }
    this.rings = scene.add.graphics().setDepth(depth - 1);
  }

  /** Ducklings currently following. */
  get count(): number {
    let n = 0;
    for (const d of this.all) if (d.state === 'following') n++;
    return n;
  }

  /** Food score multiplier. */
  get multiplier(): number {
    return 1 + this.count;
  }

  /** Lost ducklings on the river plus followers — used to avoid offering more than fit. */
  get total(): number {
    let n = 0;
    for (const d of this.all) if (d.state === 'following' || d.state === 'lost') n++;
    return n;
  }

  clear(): void {
    for (const d of this.all) this.release(d);
    this.rings.clear();
  }

  spawnLost(x: number, water: Water): void {
    const d = this.all.find((p) => p.state === 'idle');
    if (!d) return;
    d.state = 'lost';
    d.duck.anchorX = x;
    d.duck.reset(water);
    d.view.reset();
    d.view.setVisible(true);
  }

  /** Records a mother jump; each follower copies it when it reaches the same spot. */
  onMotherJump(distance: number, motherX: number): void {
    for (const d of this.all) if (d.state === 'following') d.jumps.push({ distance, x: motherX });
  }

  /** The mother crashed: everyone tumbles off. */
  scatter(): void {
    for (const d of this.all) if (d.state === 'following') this.leave(d);
  }

  setFrozen(frozen: boolean): void {
    for (const d of this.all) if (d.state !== 'idle') d.view.setFrozen(frozen);
  }

  /** Physics sub-step. `distance` is the total world distance scrolled. */
  update(h: number, dx: number, distance: number, mother: Duck, water: Water, obstacles: ObstacleManager, view: ViewBounds): void {
    // Fit a full parade between the mother and the left edge of the view (narrow phones).
    const spacing = Math.max(P.minSpacing, Math.min(P.spacing, (mother.anchorX - view.left - 30) / P.max));
    for (const d of this.all) {
      const duck = d.duck;
      switch (d.state) {
        case 'lost': {
          duck.anchorX -= dx;
          duck.step(h, water);
          const c = mother.collider;
          const r = c.r + duck.collider.r + P.pickupRadius;
          if (mother.alive && (c.x - duck.collider.x) ** 2 + (c.y - duck.collider.y) ** 2 < r * r) this.join(d);
          else if (duck.x < view.left - 80) this.release(d);
          break;
        }
        case 'following': {
          const target = mother.anchorX - spacing * d.slot;
          duck.anchorX += (target - duck.anchorX) * Math.min(1, P.follow * h);
          // Reached the spot where the mother jumped? Then jump after this duckling's extra lag.
          while (d.jumps.length && distance >= d.jumps[0].distance + d.jumps[0].x - duck.x) {
            d.jumps.shift();
            d.jumpDelay = P.extraLag * d.slot;
          }
          if (d.jumpDelay >= 0) {
            d.jumpDelay -= h;
            if (d.jumpDelay < 0) duck.requestJump();
          }
          duck.step(h, water);
          if (obstacles.hitTest(duck.collider)) {
            this.leave(d);
            this.resequence();
            this.events.lost(duck.x, duck.y, this.count);
          }
          break;
        }
        case 'leaving':
          duck.anchorX -= dx;
          duck.step(h, water);
          d.leaveTime += h;
          if (d.leaveTime > P.leaveTime || duck.x < view.left - 80) this.release(d);
          break;
      }
    }
  }

  /** Per frame: squash & stretch, views, and the glow ring around lost ducklings. */
  sync(dt: number): void {
    this.time += dt;
    const g = this.rings;
    g.clear();
    for (const d of this.all) {
      if (d.state === 'idle') continue;
      const duck = d.duck;
      if (duck.justJumped) d.view.onJump();
      if (duck.justLanded) {
        const strength = Math.min(1.2, duck.landingSpeed / M.jump.velocity);
        d.view.onLand(strength * 0.8);
        this.events.landed(duck.x, strength);
      }
      d.view.sync(duck, dt);
      duck.clearEvents();
      if (d.state === 'lost') {
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 5);
        g.lineStyle(3, 0xffffff, 0.35 + 0.35 * pulse);
        g.strokeCircle(duck.x, duck.y - 4, 24 + 4 * pulse);
      }
    }
  }

  forEachCollider(fn: (x: number, y: number, r: number) => void): void {
    for (const d of this.all) if (d.state === 'following' || d.state === 'lost') fn(d.duck.collider.x, d.duck.collider.y, d.duck.collider.r);
  }

  private join(d: Duckling): void {
    d.state = 'following';
    d.slot = this.count; // count already includes this one
    d.jumps.length = 0;
    d.jumpDelay = -1;
    d.view.onLand(0.7); // happy squish
    this.events.joined(d.duck.x, d.duck.y, this.count);
  }

  private leave(d: Duckling): void {
    d.state = 'leaving';
    d.leaveTime = 0;
    d.jumps.length = 0;
    d.jumpDelay = -1;
    d.duck.kill();
    d.view.onHurt();
  }

  /** Closes the gap after a loss: followers keep their order, slots become 1..n. */
  private resequence(): void {
    const followers = this.all.filter((d) => d.state === 'following').sort((a, b) => a.slot - b.slot);
    followers.forEach((d, i) => (d.slot = i + 1));
  }

  private release(d: Duckling): void {
    d.state = 'idle';
    d.jumps.length = 0;
    d.jumpDelay = -1;
    d.view.setVisible(false);
  }
}

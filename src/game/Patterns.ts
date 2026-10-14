import Phaser from 'phaser';
import { CONFIG } from '../config';

/** What a pattern asks for; the actual kernel is picked by weight (CONFIG.food.roles). */
export type FoodRole = keyof typeof CONFIG.food.roles;
import type { ObstacleType } from './ObstacleManager';

/**
 * Handcrafted obstacle/food patterns combined procedurally.
 *
 * Times are in seconds of travel at the speed when the pattern is scheduled, so spacing — and so
 * reaction time — stays the same as the world speeds up. Fairness rules for new patterns:
 *   - obstacles that must be jumped are ≥ 1.3 s apart (jump air time ≈ 0.8 s + reaction);
 *   - after a crate (which may be dashed through, skipping ahead) leave ≥ 1.5 s;
 *   - food is always optional and never placed inside an obstacle;
 *   - food can only rest on crates (`lid`): smashing the crate collects it. Logs and rocks are too low
 *     for a jump to reach food resting on them, so use `crown` (food right above, at jump height).
 */
export interface Entry {
  t: number;
  obstacle?: ObstacleType;
  food?: FoodRole;
  /** Food along a jump: the duck's centre above its swimming position. Omitted = floating on the water. */
  h?: number;
  /** Food resting on top of this obstacle type (spawned with it, at the same time). */
  on?: ObstacleType;
  /** A lost duckling to rescue (Duckling Parade). */
  duckling?: boolean;
  /** A lily pad that bounces the duck high. */
  pad?: boolean;
  /** Food only reachable with a double jump (used for the first-time hint). */
  sky?: boolean;
}

interface Pattern {
  name: string;
  /** First difficulty tier (index into CONFIG.spawner.tiers) where it can appear. */
  minTier: number;
  weight: number;
  entries: Entry[];
  length: number;
}

// ------------------------------------------------------------------ jump arc

/**
 * Simulates a flight with the duck's physics (gravity, apex hang, height cap), so food arcs match
 * the real trajectory. `doubleAtApex` adds the mid-air second jump at the top of the first.
 */
function simulateFlight(v0: number, doubleAtApex: boolean) {
  const j = CONFIG.duck.jump;
  const dt = 1 / 240;
  const heights = [0];
  let y = 0;
  let vy = -v0;
  let doubled = !doubleAtApex;
  for (;;) {
    if (!doubled && vy >= 0) {
      vy = -j.velocity * j.doubleJumpFactor;
      doubled = true;
    }
    let g = j.gravity;
    if (vy > 0) g *= j.fallMultiplier;
    if (Math.abs(vy) < j.apexThreshold) g *= j.apexMultiplier;
    vy = Math.min(vy + g * dt, j.maxFallSpeed);
    y += vy * dt;
    if (-y > j.maxHeight) {
      y = -j.maxHeight;
      vy = Math.max(vy, 0);
    }
    if (vy > 0 && y >= 0) break;
    heights.push(-y);
  }
  return {
    airtime: heights.length * dt,
    heightAt: (tau: number) => heights[Math.max(0, Math.min(heights.length - 1, Math.round(tau / dt)))],
    /** First and last time the flight is above `h`. */
    above(h: number): [number, number] {
      const first = heights.findIndex((v) => v >= h);
      let last = heights.length - 1;
      while (last > 0 && heights[last] < h) last--;
      return [first * dt, last * dt];
    },
  };
}

const JUMP = simulateFlight(CONFIG.duck.jump.velocity, false);
const DOUBLE = simulateFlight(CONFIG.duck.jump.velocity, true);
const BOUNCE = simulateFlight(CONFIG.lilyPads.bounceVelocity, false);
/** A single jump (plus pickup reach) can't get this high — sky food needs the double jump. */
const SKY_HEIGHT = 250;

// ------------------------------------------------------------------ builders

const ob = (t: number, obstacle: ObstacleType): Entry => ({ t, obstacle });

/** `n` food items floating on the water in a row. */
function line(t0: number, n: number, kind: FoodRole, step = 0.12): Entry[] {
  return Array.from({ length: n }, (_, i) => ({ t: t0 + i * step, food: kind }));
}

/** Food resting on top of the crate at time `t` (collected by smashing it). */
function lid(t: number, ...kinds: FoodRole[]): Entry[] {
  const step = kinds.length > 2 ? 0.075 : 0.09;
  return kinds.map((kind, i) => ({ t: t + (i - (kinds.length - 1) / 2) * step, food: kind, on: 'crate' as const }));
}

/** A tight cluster right above the obstacle at time `tCenter`, where a well-timed jump passes. */
function crown(tCenter: number, n: number, kind: FoodRole, apexKind?: FoodRole): Entry[] {
  const T = JUMP.airtime;
  return Array.from({ length: n }, (_, i) => {
    const tau = T * (0.38 + (0.24 * i) / Math.max(1, n - 1));
    const isApex = apexKind && i === Math.floor(n / 2);
    return { t: tCenter - T / 2 + tau, food: isApex ? apexKind : kind, h: JUMP.heightAt(tau) };
  });
}

/** `n` food items along a jump whose apex is at time `tCenter` (over an obstacle, or open water). */
function arc(tCenter: number, n: number, kind: FoodRole, apexKind?: FoodRole): Entry[] {
  const T = JUMP.airtime;
  return Array.from({ length: n }, (_, i) => {
    const tau = T * (0.14 + (0.72 * i) / Math.max(1, n - 1));
    const isApex = apexKind && i === Math.floor(n / 2);
    return { t: tCenter - T / 2 + tau, food: isApex ? apexKind : kind, h: JUMP.heightAt(tau) };
  });
}

/** `n` food items high in the sky along a double jump taken off at `tTakeoff`. */
function skyArc(tTakeoff: number, n: number, kind: FoodRole): Entry[] {
  const [a, b] = DOUBLE.above(SKY_HEIGHT);
  return Array.from({ length: n }, (_, i) => {
    const tau = a + ((b - a) * i) / Math.max(1, n - 1);
    return { t: tTakeoff + tau, food: kind, h: DOUBLE.heightAt(tau), sky: true };
  });
}

const pad = (t: number): Entry => ({ t, pad: true });

/** `n` food items along the lily-pad bounce from the pad at time `tPad`. */
function bounceArc(tPad: number, n: number, kind: FoodRole): Entry[] {
  const T = BOUNCE.airtime;
  const lead = 0.08; // the bounce starts as the duck reaches the pad's edge, a moment before its centre
  return Array.from({ length: n }, (_, i) => {
    const tau = T * (0.2 + (0.6 * i) / Math.max(1, n - 1));
    return { t: tPad - lead + tau, food: kind, h: BOUNCE.heightAt(tau) };
  });
}

function pattern(name: string, minTier: number, weight: number, ...parts: (Entry | Entry[])[]): Pattern {
  const entries = parts.flat();
  // Normalise so the first entry is at t = 0 (nothing pops in on screen).
  const t0 = Math.min(...entries.map((e) => e.t));
  for (const e of entries) e.t -= t0;
  entries.sort((a, b) => a.t - b.t);
  return { name, minTier, weight, entries, length: entries[entries.length - 1].t };
}

// ------------------------------------------------------------------ patterns

const PATTERNS: Pattern[] = [
  // Tier 0 — single obstacles, big gaps, easy food.
  pattern('log', 0, 3, ob(0, 'log')),
  pattern('rock', 0, 2, ob(0, 'rock')),
  pattern('crate', 0, 1, ob(0, 'crate')),
  pattern('crate-lid', 0, 2, ob(0, 'crate'), lid(0, 'common', 'common')),
  pattern('log-crown', 0, 2, ob(0, 'log'), crown(0, 3, 'common')),
  pattern('corn-line', 0, 2, line(0, 5, 'common')),
  pattern('log-arc', 0, 3, ob(0, 'log'), arc(0, 5, 'common')),
  // Double jump and lily pads.
  pattern('sky-arc', 0, 3, line(0, 3, 'common'), skyArc(0.5, 6, 'mid')),
  pattern('lily-bounce', 0, 3, line(0, 3, 'common'), pad(0.55), bounceArc(0.55, 6, 'rare')),
  pattern('crate-peas', 0, 1, ob(0, 'crate'), line(0.55, 3, 'mid')),

  // Tier 1 — variety and some two-obstacle patterns.
  pattern('rock-arc-bonus', 1, 2, ob(0, 'rock'), arc(0, 5, 'common', 'rare')),
  pattern('log-log', 1, 2, ob(0, 'log'), ob(1.4, 'log'), arc(1.4, 3, 'mid')),
  pattern('crate-log', 1, 2, ob(0, 'crate'), lid(0, 'common', 'common'), ob(1.6, 'log')),
  pattern('crate-lid-bonus', 1, 1, ob(0, 'crate'), lid(0, 'rare')),
  pattern('rock-crown', 1, 1, ob(0, 'rock'), crown(0, 3, 'common', 'rare')),
  pattern('log-rock', 1, 2, ob(0, 'log'), ob(1.5, 'rock'), arc(1.5, 3, 'mid')),
  pattern('rock-crate', 1, 1, ob(0, 'rock'), ob(1.45, 'crate'), line(1.95, 3, 'common')),
  pattern('log-sky', 1, 2, ob(0, 'log'), skyArc(-0.4, 5, 'rare')),
  pattern('lily-log', 1, 2, pad(0), bounceArc(0, 5, 'mid'), ob(1.9, 'log')),
  pattern('open-arc', 1, 1, line(0, 3, 'common'), arc(0.9, 6, 'mid', 'rare')),

  // Tier 2 — faster, longer combinations, more reward.
  pattern('log-crate-rock', 2, 2, ob(0, 'log'), ob(1.4, 'crate'), ob(2.95, 'rock'), arc(2.95, 5, 'common', 'rare')),
  pattern('rock-rock', 2, 2, ob(0, 'rock'), arc(0, 3, 'common'), ob(1.35, 'rock'), arc(1.35, 3, 'common')),
  pattern('triple-log', 2, 1, ob(0, 'log'), ob(1.3, 'log'), ob(2.6, 'log'), arc(1.3, 5, 'mid')),
  // Two quick crates: dash through both (cooldown 0.7 s) — or jump them with good timing.
  pattern('lily-chain', 2, 1, pad(0), bounceArc(0, 5, 'rare'), pad(1.85), bounceArc(1.85, 5, 'rare')),
  pattern('crate-crate', 2, 1, ob(0, 'crate'), lid(0, 'common'), ob(1.05, 'crate'), lid(1.05, 'common'), line(1.55, 4, 'common')),
  pattern('seed-run', 2, 1, ob(0, 'log'), arc(0, 5, 'rare'), ob(1.5, 'rock')),
];

// ------------------------------------------------------------------ spawner

interface Scheduled {
  at: number; // world distance at which the entry enters on the right
  entry: Entry;
}

/** How far ahead (seconds of travel) patterns are planned. */
const LOOKAHEAD = 3;

export class Spawner {
  active = false;
  private queue: Scheduled[] = [];
  /** World distance where the next pattern starts (before the fairness shift). */
  private nextPatternAt = 0;
  /** World distance where the previous pattern ended (start of the open water to fill). */
  private prevEnd = 0;
  /** Last scheduled obstacle that must be cleared, for cross-pattern fairness. */
  private lastObstacleAt = -Infinity;
  private lastObstacleType: ObstacleType | 'pad' | null = null;
  private last: Pattern | null = null;
  /** Scripted opening (pattern names, or null for a random pick) — teaches new players. */
  private intro: (string | null)[] = [];
  /** Run distance (m) after which the next lost duckling may appear. */
  private nextDucklingMetres = 0;

  /** `intro` forces the first patterns of a run by name (null = random), e.g. for new players. */
  reset(distance: number, intro: (string | null)[] = []): void {
    this.intro = [...intro];
    this.queue.length = 0;
    this.nextPatternAt = distance + CONFIG.spawner.firstPatternDistance;
    this.prevEnd = distance + 250; // a corn trail leads into the first pattern
    this.lastObstacleAt = -Infinity;
    this.lastObstacleType = null;
    this.last = null;
    this.nextDucklingMetres = CONFIG.ducklings.firstAtMetres;
  }

  /** After a duckling is lost, offer the next one sooner. */
  hurryDuckling(metres: number): void {
    this.nextDucklingMetres = Math.min(this.nextDucklingMetres, metres + CONFIG.ducklings.afterLossMetres);
  }

  /**
   * Plans patterns a few seconds ahead and hands out entries whose time has come.
   * `spawn` receives how far (world units) the entry is overdue so it can be placed exactly.
   * `wantDuckling` is false while the parade is full.
   */
  update(
    distance: number,
    metres: number,
    speed: number,
    wantDuckling: boolean,
    spawn: (entry: Entry, overdue: number) => void,
  ): void {
    // Plan ahead so filler trails and shifted patterns are queued before they reach the screen edge.
    const lookahead = LOOKAHEAD * speed;
    while (this.active && distance >= this.nextPatternAt - lookahead) this.schedule(metres, speed, wantDuckling);
    while (this.queue.length && this.queue[0].at <= distance) {
      const s = this.queue.shift()!;
      spawn(s.entry, distance - s.at);
    }
  }

  private schedule(metres: number, speed: number, wantDuckling: boolean): void {
    const cfg = CONFIG.spawner;
    const tiers = cfg.tiers;
    let tier = 0;
    for (let i = 0; i < tiers.length; i++) if (metres >= tiers[i].fromMetres) tier = i;

    // Weighted pick; patterns of the current tier are favoured, and never the same one twice in a row.
    const options = PATTERNS.filter((p) => p.minTier <= tier && p !== this.last);
    const weightOf = (p: Pattern) => p.weight * (p.minTier === tier ? 1.5 : 1);
    let r = Math.random() * options.reduce((sum, p) => sum + weightOf(p), 0);
    let picked = options[0];
    for (const p of options) {
      r -= weightOf(p);
      if (r <= 0) {
        picked = p;
        break;
      }
    }
    const scripted = this.intro.length ? this.intro.shift() : null;
    if (scripted) picked = PATTERNS.find((p) => p.name === scripted) ?? picked;
    this.last = picked;

    // Fairness across patterns: the first obstacle must come far enough after the previous one.
    // Obstacles and lily pads both count for spacing (after a pad the duck lands far ahead).
    const obstacles = picked.entries.filter((e) => e.obstacle || e.pad);
    let start = this.nextPatternAt;
    if (obstacles.length) {
      const gap = this.lastObstacleType === 'crate' ? cfg.afterCrateGap : this.lastObstacleType === 'pad' ? cfg.afterPadGap : cfg.minObstacleGap;
      const need = gap * speed;
      start = Math.max(start, this.lastObstacleAt + need - obstacles[0].t * speed);
    }

    // Fill the open water between the previous pattern and this one.
    this.fillGap(this.prevEnd, start, obstacles.length ? start + obstacles[0].t * speed : Infinity, metres, speed, wantDuckling);

    for (const entry of picked.entries) this.queue.push({ at: start + entry.t * speed, entry });
    if (obstacles.length) {
      const lastObstacle = obstacles[obstacles.length - 1];
      this.lastObstacleAt = start + lastObstacle.t * speed;
      this.lastObstacleType = lastObstacle.pad ? 'pad' : lastObstacle.obstacle!;
    }
    this.queue.sort((a, b) => a.at - b.at);

    const gap = Phaser.Math.FloatBetween(tiers[tier].gapMin, tiers[tier].gapMax);
    this.prevEnd = start + picked.length * speed;
    this.nextPatternAt = this.prevEnd + gap * speed;
  }

  /**
   * Corn trail (and maybe a lost duckling) in the open water [from, to). Food keeps `clearance`
   * from the previous obstacle and the next pattern; the duckling sits in the middle of the free
   * water, at least 0.25 s from any obstacle.
   */
  private fillGap(from: number, to: number, nextObstacleAt: number, metres: number, speed: number, wantDuckling: boolean): void {
    const trail = CONFIG.spawner.trail;
    const clearance = trail.clearance * speed;
    const start = Math.max(from, this.lastObstacleAt + clearance);
    const end = to - clearance;
    if (end <= start) return;

    let ducklingAt = -Infinity;
    const freeStart = Math.max(from, this.lastObstacleAt + 0.25 * speed);
    const freeEnd = Math.min(to, nextObstacleAt - 0.25 * speed);
    if (wantDuckling && metres >= this.nextDucklingMetres && freeEnd - freeStart >= 0.5 * speed) {
      ducklingAt = (freeStart + freeEnd) / 2;
      this.queue.push({ at: ducklingAt, entry: { t: 0, duckling: true } });
      const d = CONFIG.ducklings;
      this.nextDucklingMetres = metres + Phaser.Math.FloatBetween(d.everyMin, d.everyMax);
    }

    const step = trail.step * speed;
    for (let at = start; at <= end; at += step) {
      if (Math.abs(at - ducklingAt) < 0.22 * speed) continue; // leave room around the duckling
      const food: FoodRole = Math.random() < trail.peasChance ? 'mid' : 'common';
      this.queue.push({ at, entry: { t: 0, food } });
    }
  }
}

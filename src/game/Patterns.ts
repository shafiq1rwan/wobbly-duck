import Phaser from 'phaser';
import { CONFIG } from '../config';
import type { FoodKind } from './FoodManager';
import type { ObstacleType } from './ObstacleManager';

/**
 * Handcrafted obstacle/food patterns combined procedurally.
 *
 * Times are in seconds of travel at the speed when the pattern is scheduled, so spacing — and so
 * reaction time — stays the same as the world speeds up. Fairness rules for new patterns:
 *   - obstacles that must be jumped are ≥ 1.3 s apart (jump air time ≈ 0.8 s + reaction);
 *   - after a crate (which may be dashed through, skipping ahead) leave ≥ 1.5 s;
 *   - food is always optional and never placed inside an obstacle.
 */
export interface Entry {
  t: number;
  obstacle?: ObstacleType;
  food?: FoodKind;
  /** Food height: the duck's centre above its swimming position (0 = on the water). */
  h?: number;
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

/** Simulates a full-height jump with the duck's physics, so food arcs match the real trajectory. */
const JUMP = (() => {
  const j = CONFIG.duck.jump;
  const dt = 1 / 240;
  const heights = [0];
  let y = 0;
  let vy = -j.velocity;
  for (;;) {
    let g = j.gravity;
    if (vy > 0) g *= j.fallMultiplier;
    if (Math.abs(vy) < j.apexThreshold) g *= j.apexMultiplier;
    vy = Math.min(vy + g * dt, j.maxFallSpeed);
    y += vy * dt;
    if (vy > 0 && y >= 0) break;
    heights.push(-y);
  }
  return {
    airtime: heights.length * dt,
    heightAt: (tau: number) => heights[Math.max(0, Math.min(heights.length - 1, Math.round(tau / dt)))],
  };
})();

// ------------------------------------------------------------------ builders

const ob = (t: number, obstacle: ObstacleType): Entry => ({ t, obstacle });

/** `n` food items on the water in a row. */
function line(t0: number, n: number, kind: FoodKind, step = 0.12, h = 0): Entry[] {
  return Array.from({ length: n }, (_, i) => ({ t: t0 + i * step, food: kind, h }));
}

/** `n` food items along a jump whose apex is at time `tCenter` (over an obstacle, or open water). */
function arc(tCenter: number, n: number, kind: FoodKind, apexKind?: FoodKind): Entry[] {
  const T = JUMP.airtime;
  return Array.from({ length: n }, (_, i) => {
    const tau = T * (0.14 + (0.72 * i) / Math.max(1, n - 1));
    const isApex = apexKind && i === Math.floor(n / 2);
    return { t: tCenter - T / 2 + tau, food: isApex ? apexKind : kind, h: JUMP.heightAt(tau) };
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
  pattern('crate', 0, 2, ob(0, 'crate')),
  pattern('seed-line', 0, 2, line(0, 5, 'seed')),
  pattern('log-arc', 0, 3, ob(0, 'log'), arc(0, 5, 'seed')),
  pattern('crate-peas', 0, 1, ob(0, 'crate'), line(0.55, 3, 'peas')),

  // Tier 1 — variety and some two-obstacle patterns.
  pattern('rock-arc-corn', 1, 2, ob(0, 'rock'), arc(0, 5, 'seed', 'corn')),
  pattern('log-log', 1, 2, ob(0, 'log'), ob(1.4, 'log'), arc(1.4, 3, 'peas')),
  pattern('crate-log', 1, 2, ob(0, 'crate'), ob(1.6, 'log')),
  pattern('log-rock', 1, 2, ob(0, 'log'), ob(1.5, 'rock'), arc(1.5, 3, 'peas')),
  pattern('rock-crate', 1, 1, ob(0, 'rock'), ob(1.45, 'crate'), line(1.95, 3, 'seed')),
  pattern('open-arc', 1, 1, line(0, 3, 'seed'), arc(0.9, 6, 'peas', 'corn')),

  // Tier 2 — faster, longer combinations, more reward.
  pattern('log-crate-rock', 2, 2, ob(0, 'log'), ob(1.4, 'crate'), ob(2.95, 'rock'), arc(2.95, 5, 'seed', 'corn')),
  pattern('rock-rock', 2, 2, ob(0, 'rock'), arc(0, 3, 'seed'), ob(1.35, 'rock'), arc(1.35, 3, 'seed')),
  pattern('triple-log', 2, 1, ob(0, 'log'), ob(1.3, 'log'), ob(2.6, 'log'), arc(1.3, 5, 'peas')),
  // Two quick crates: dash through both (cooldown 0.7 s) — or jump them with good timing.
  pattern('crate-crate', 2, 1, ob(0, 'crate'), ob(1.05, 'crate'), line(1.55, 4, 'seed')),
  pattern('corn-run', 2, 1, ob(0, 'log'), arc(0, 5, 'corn'), ob(1.5, 'rock')),
];

// ------------------------------------------------------------------ spawner

interface Scheduled {
  at: number; // world distance at which the entry enters on the right
  entry: Entry;
}

export class Spawner {
  active = false;
  private queue: Scheduled[] = [];
  private nextPatternAt = 0;
  private last: Pattern | null = null;

  reset(distance: number): void {
    this.queue.length = 0;
    this.nextPatternAt = distance + CONFIG.spawner.firstPatternDistance;
    this.last = null;
  }

  /**
   * Schedules the next pattern when due and hands out entries whose time has come.
   * `spawn` receives how far (world units) the entry is overdue so it can be placed exactly.
   */
  update(distance: number, metres: number, speed: number, spawn: (entry: Entry, overdue: number) => void): void {
    if (this.active && distance >= this.nextPatternAt) this.schedule(metres, speed);
    while (this.queue.length && this.queue[0].at <= distance) {
      const s = this.queue.shift()!;
      spawn(s.entry, distance - s.at);
    }
  }

  private schedule(metres: number, speed: number): void {
    const tiers = CONFIG.spawner.tiers;
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
    this.last = picked;

    for (const entry of picked.entries) this.queue.push({ at: this.nextPatternAt + entry.t * speed, entry });
    this.queue.sort((a, b) => a.at - b.at);
    const gap = Phaser.Math.FloatBetween(tiers[tier].gapMin, tiers[tier].gapMax);
    this.nextPatternAt += (picked.length + gap) * speed;
  }
}

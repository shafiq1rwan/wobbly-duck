import Phaser from 'phaser';
import { CONFIG } from '../config';
import type { ViewBounds } from '../core/Viewport';

const C = CONFIG.celebration;
const PAPER = 'confetti-paper';
const FEATHER = 'confetti-feather';
const POPPER = 'party-popper';
/** Popper texture size (px); the cone's tip is at the bottom, its mouth at the top. */
const POP_W = 128;
const POP_H = 176;
/** Corn kernels mixed into the confetti — it's a duck party. */
const KERNELS = ['kernel-yellow', 'kernel-orange', 'kernel-pink', 'kernel-rainbow'];
/** Popper timeline (s): slide in, pop, hold, slide out. */
const IN = 0.18;
const POP = 0.24;
const OUT = 1.35;
const END = 1.65;

type Kind = 'paper' | 'feather' | 'kernel';

class Piece {
  active = false;
  kind: Kind = 'paper';
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  rot = 0;
  spin = 0;
  t = 0;
  life = 0;
  scale = 1;
  sway = 0;
  swayF = 0;
  flipF = 0;

  constructor(readonly img: Phaser.GameObjects.Image) {}
}

class Popper {
  /** Time since start (negative while waiting for its turn), or null when idle. */
  t: number | null = null;
  popped = false;
  colors: readonly number[] = [];

  constructor(
    readonly img: Phaser.GameObjects.Image,
    readonly side: -1 | 1,
  ) {}
}

/**
 * Celebration effects in screen-fixed world space (the camera doesn't scroll, so pieces that ignore
 * the world's scroll stay put on screen): party poppers that spring out of the bottom corners, and
 * pooled confetti — paper, feathers and corn kernels — that flutters down. Sizes scale with the view.
 */
export class Confetti {
  private readonly pieces: Piece[] = [];
  private readonly poppers: Popper[];

  constructor(
    scene: Phaser.Scene,
    depth: number,
    private readonly onPop: () => void,
  ) {
    makeTextures(scene);
    for (let i = 0; i < C.pieces; i++) {
      const img = scene.add.image(0, 0, PAPER).setDepth(depth).setVisible(false);
      this.pieces.push(new Piece(img));
    }
    this.poppers = ([-1, 1] as const).map((side) => {
      const img = scene.add.image(0, 0, POPPER).setOrigin(0.5, 0.97).setDepth(depth).setVisible(false);
      return new Popper(img.setFlipX(side === 1), side);
    });
  }

  /** New record: a popper springs out of each bottom corner, one after the other, and pops. */
  partyPoppers(colors: readonly number[]): void {
    this.poppers.forEach((p, i) => {
      p.t = -i * 0.22;
      p.popped = false;
      p.colors = colors;
    });
  }

  /** Confetti erupting upwards from a point (skin unlock, best-distance flag). */
  fountain(x: number, y: number, view: ViewBounds, colors: readonly number[], count: number, reachUnits: number): void {
    const u = unit(view);
    this.emit(x, y, -Math.PI / 2, 0.55, count, colors, reachUnits * u, u);
  }

  update(dt: number, view: ViewBounds): void {
    const u = unit(view);
    const g = C.gravity * 660 * u;
    const maxFall = C.maxFall * 660 * u;
    const drag = Math.exp(-C.drag * dt);
    for (const p of this.pieces) {
      if (!p.active) continue;
      p.t += dt;
      p.vx *= drag;
      p.vy = p.vy * drag + g * dt;
      // Paper and feathers flutter down slowly; kernels fall a bit faster.
      const cap = p.kind === 'kernel' ? maxFall * 1.8 : maxFall;
      if (p.vy > cap) p.vy += (cap - p.vy) * Math.min(1, dt * 6);
      p.x += (p.vx + Math.sin(p.t * p.swayF) * p.sway) * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      const fade = Math.min(1, (p.life - p.t) / 0.5);
      if (fade <= 0 || p.y > view.bottom + 60) {
        p.active = false;
        p.img.setVisible(false);
        continue;
      }
      // Paper turning over in the air: squash one axis with a cosine.
      const flip = p.kind === 'kernel' ? 1 : Math.cos(p.t * p.flipF);
      p.img.setPosition(p.x, p.y).setRotation(p.rot).setScale(p.scale, p.scale * flip).setAlpha(fade);
    }
    for (const pop of this.poppers) this.updatePopper(pop, dt, view, u);
  }

  clear(): void {
    for (const p of this.pieces) {
      p.active = false;
      p.img.setVisible(false);
    }
    for (const pop of this.poppers) {
      pop.t = null;
      pop.img.setVisible(false);
    }
  }

  private updatePopper(pop: Popper, dt: number, view: ViewBounds, u: number): void {
    if (pop.t === null) return;
    pop.t += dt;
    const t = pop.t;
    if (t < 0) return;
    if (t >= END) {
      pop.t = null;
      pop.img.setVisible(false);
      return;
    }
    const size = C.popperHeight * 660 * u;
    const s = size / POP_H;
    // Tilted so the mouth points up and in towards the middle of the screen.
    const tilt = 0.55 * -pop.side;
    const cornerX = pop.side < 0 ? view.left + size * 0.45 : view.right - size * 0.45;
    const cornerY = view.bottom - size * 0.05;
    // Slide in from (and back out of) the corner along the cone's axis.
    let hidden = 0;
    if (t < IN) hidden = 1 - easeOutBack(t / IN);
    else if (t > OUT) hidden = ((t - OUT) / (END - OUT)) ** 2;
    const ax = Math.sin(tilt);
    const ay = -Math.cos(tilt);
    const x = cornerX - ax * hidden * size * 1.1;
    const y = cornerY - ay * hidden * size * 1.1;
    // Squash and stretch around the pop.
    let sx = 1;
    let sy = 1;
    const k = t - POP;
    if (k > -0.06 && k < 0) {
      sy = 1 + (k / 0.06) * 0.18; // wind-up: squash down
      sx = 1 - (k / 0.06) * 0.1;
    } else if (k >= 0 && k < 0.35) {
      const w = Math.exp(-k * 9) * Math.cos(k * 32);
      sy = 1 + 0.22 * w;
      sx = 1 - 0.12 * w;
    }
    pop.img.setVisible(true).setPosition(x, y).setRotation(tilt).setScale(s * sx, s * sy);

    if (!pop.popped && t >= POP) {
      pop.popped = true;
      const mx = x + ax * size * 0.95;
      const my = y + ay * size * 0.95;
      const angle = Math.atan2(ay, ax);
      this.emit(mx, my, angle, 0.32, C.perPopper, pop.colors, (view.bottom - view.top) * C.popperReach, u);
      this.onPop();
    }
  }

  private emit(
    x: number,
    y: number,
    angle: number,
    spread: number,
    count: number,
    colors: readonly number[],
    reach: number,
    u: number,
  ): void {
    const g = C.gravity * 660 * u;
    // Launch speed for the target height, a little extra for the drag.
    const v0 = Math.sqrt(2 * g * reach) * 1.25;
    for (let i = 0; i < count; i++) {
      const p = this.pieces.find((q) => !q.active);
      if (!p) return;
      const r = Math.random();
      p.kind = r < 0.62 ? 'paper' : r < 0.86 ? 'feather' : 'kernel';
      const a = angle + (Math.random() * 2 - 1) * spread;
      const v = v0 * (0.55 + Math.random() * 0.55);
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.t = 0;
      p.life = C.life[0] + Math.random() * (C.life[1] - C.life[0]);
      p.rot = Math.random() * Math.PI * 2;
      p.spin = (Math.random() - 0.5) * (p.kind === 'kernel' ? 8 : 14);
      p.sway = (25 + Math.random() * 45) * u;
      p.swayF = 2 + Math.random() * 2.5;
      p.flipF = 5 + Math.random() * 8;
      const tint = colors[Math.floor(Math.random() * colors.length)];
      if (p.kind === 'kernel') {
        p.img.setTexture(KERNELS[Math.floor(Math.random() * KERNELS.length)]).clearTint();
        p.scale = (0.14 + Math.random() * 0.06) * u;
      } else {
        p.img.setTexture(p.kind === 'paper' ? PAPER : FEATHER).setTint(tint);
        p.scale = (0.8 + Math.random() * 0.5) * u;
      }
      p.img.setVisible(true).setAlpha(1).setPosition(x, y);
    }
  }
}

/** World units per reference unit: confetti keeps the same on-screen size on any screen. */
function unit(view: ViewBounds): number {
  return Math.min(view.width, view.height) / 660;
}

function easeOutBack(t: number): number {
  const c = 1.7;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}

function makeTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists(PAPER)) return;
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 1).fillRoundedRect(0, 0, 18, 10, 3);
  g.generateTexture(PAPER, 18, 10);
  g.clear();
  // A small rounded feather: white vane (tinted per piece) with a faint shaft.
  g.fillStyle(0xffffff, 1).fillEllipse(13, 6, 24, 10);
  g.fillStyle(0xffffff, 1).fillTriangle(0, 6, 4, 3, 4, 9);
  g.lineStyle(1.5, 0xd8d8d8, 1).lineBetween(1, 6, 23, 6);
  g.generateTexture(FEATHER, 26, 12);
  g.destroy();

  // Party popper: a striped yellow/orange cone with a navy outline, like the UI.
  const tex = scene.textures.createCanvas(POPPER, POP_W, POP_H)!;
  const ctx = tex.context;
  const cx = POP_W / 2;
  const mouthY = 34;
  const tipY = POP_H - 6;
  const cone = new Path2D();
  cone.moveTo(cx - 50, mouthY);
  cone.lineTo(cx, tipY);
  cone.lineTo(cx + 50, mouthY);
  cone.closePath();
  ctx.save();
  ctx.clip(cone);
  for (let i = -6; i < 12; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#ffd93f' : '#ff994a';
    ctx.beginPath();
    ctx.moveTo(0, mouthY + i * 26);
    ctx.lineTo(POP_W, mouthY + i * 26 - 40);
    ctx.lineTo(POP_W, mouthY + (i + 1) * 26 - 40);
    ctx.lineTo(0, mouthY + (i + 1) * 26);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#13266a';
  ctx.stroke(cone);
  // Mouth: a rim with a dark inside.
  ctx.beginPath();
  ctx.ellipse(cx, mouthY, 52, 16, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#ff6fa8';
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, mouthY, 38, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#13266a';
  ctx.fill();
  tex.refresh();
}

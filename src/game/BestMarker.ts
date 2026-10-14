import Phaser from 'phaser';
import { CONFIG } from '../config';
import type { ViewBounds } from '../core/Viewport';
import type { Water } from './Water';

const B = CONFIG.bestMarker;
const TEXTURE = 'best-flag';
/** The flag is drawn at 2× and shown at half scale, so the text stays crisp when zoomed. */
const FLAG_W = 300;
const FLAG_H = 168;
const FLAG_SCALE = 0.5;
const INK = '#13266a';

/**
 * "Beat your best": a flag planted in the river at the best distance so far. It scrolls with the
 * world and never collides; when the duck swims past it, `onPassed` fires once.
 */
export class BestMarker {
  private readonly root: Phaser.GameObjects.Container;
  private readonly flag: Phaser.GameObjects.Image;
  private readonly canvas: Phaser.Textures.CanvasTexture;
  private active = false;
  private passed = false;
  /** World distance (total scrolled) at which the duck reaches the flag. */
  private at = 0;
  private time = 0;
  /** Pop after being passed (s remaining). */
  private popTime = 0;
  private drawnMetres = -1;

  constructor(
    scene: Phaser.Scene,
    depth: number,
    private readonly onPassed: (x: number, y: number) => void,
  ) {
    this.canvas = scene.textures.createCanvas(TEXTURE, FLAG_W, FLAG_H)!;
    const pole = scene.add.graphics();
    pole.fillStyle(0x13266a, 1).fillRoundedRect(-5, -B.poleHeight - 6, 10, B.poleHeight + B.poleSink + 6, 4);
    pole.fillStyle(0xffffff, 1).fillRoundedRect(-2.5, -B.poleHeight - 3, 5, B.poleHeight + B.poleSink, 2.5);
    pole.fillStyle(0xffd93f, 1).lineStyle(3, 0x13266a, 1);
    pole.fillCircle(0, -B.poleHeight - 8, 8).strokeCircle(0, -B.poleHeight - 8, 8);
    // Origin at the pole: the flag hangs from the top and flies to the right.
    this.flag = scene.add.image(2, -B.poleHeight, TEXTURE).setOrigin(0, 0).setScale(FLAG_SCALE);
    this.root = scene.add.container(0, 0, [pole, this.flag]).setDepth(depth).setVisible(false);
  }

  /** At run start: plant the flag at `bestMetres` from `runStart`, or hide it if the best is short. */
  start(runStart: number, bestMetres: number): void {
    this.active = bestMetres >= B.minMetres;
    this.passed = false;
    this.popTime = 0;
    this.root.setVisible(false);
    if (!this.active) return;
    this.at = runStart + bestMetres * CONFIG.world.unitsPerMetre;
    if (bestMetres !== this.drawnMetres) this.draw(bestMetres);
  }

  hide(): void {
    this.active = false;
    this.root.setVisible(false);
  }

  update(dt: number, worldDistance: number, anchorX: number, duckX: number, water: Water, view: ViewBounds): void {
    if (!this.active) return;
    const x = anchorX + (this.at - worldDistance);
    if (x < view.left - 200) {
      this.hide();
      return;
    }
    const visible = x < view.right + FLAG_W;
    this.root.setVisible(visible);
    if (!visible) return;

    this.time += dt;
    const y = water.heightAt(x);
    this.root.setPosition(x, y).setRotation(Math.atan(water.slopeAt(x)) * 0.3);
    // Gentle flutter, plus a pop when passed.
    let s = FLAG_SCALE * (1 + 0.03 * Math.sin(this.time * 7));
    if (this.popTime > 0) {
      this.popTime = Math.max(0, this.popTime - dt);
      s *= 1 + 0.35 * Math.sin((1 - this.popTime / 0.4) * Math.PI);
    }
    this.flag.setScale(s, FLAG_SCALE);

    if (!this.passed && x <= duckX) {
      this.passed = true;
      this.popTime = 0.4;
      this.onPassed(x + (FLAG_W * FLAG_SCALE) / 2, y - B.poleHeight + (FLAG_H * FLAG_SCALE) / 2);
    }
  }

  /** Yellow swallowtail pennant: "BEST" over the distance, in the UI's navy-outlined style. */
  private draw(metres: number): void {
    this.drawnMetres = metres;
    const ctx = this.canvas.context;
    ctx.clearRect(0, 0, FLAG_W, FLAG_H);
    const m = 8;
    ctx.beginPath();
    ctx.moveTo(m, m);
    ctx.lineTo(FLAG_W - m, m);
    ctx.lineTo(FLAG_W - 54, FLAG_H / 2);
    ctx.lineTo(FLAG_W - m, FLAG_H - m);
    ctx.lineTo(m, FLAG_H - m);
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#ffd93f';
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = INK;
    ctx.stroke();

    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = (FLAG_W - 54) / 2 + 4;
    ctx.font = `700 34px Fredoka, 'Trebuchet MS', sans-serif`;
    ctx.fillText('BEST', cx, 52);
    ctx.font = `700 46px Fredoka, 'Trebuchet MS', sans-serif`;
    ctx.fillText(`${new Intl.NumberFormat('en-US').format(metres)} m`, cx, 112);
    this.canvas.refresh();
  }
}

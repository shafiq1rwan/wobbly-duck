import Phaser from 'phaser';
import { COLORS, CONFIG } from '../config';

/**
 * Obstacle art, drawn procedurally with Canvas 2D into textures.
 * Every texture is centred: local (0,0) maps to the texture centre, so images use origin 0.5.
 * Textures are rendered at TEX_RES× world size (power-of-two canvases) for crisp scaling.
 */
export const TEX_RES = 2;
const OUTLINE = 3.5;

export const TEX = {
  log: 'log',
} as const;

function nextPow2(n: number): number {
  return 2 ** Math.ceil(Math.log2(Math.max(1, n)));
}

function makeTexture(
  scene: Phaser.Scene,
  key: string,
  worldW: number,
  worldH: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): void {
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement('canvas');
  canvas.width = nextPow2(worldW * TEX_RES);
  canvas.height = nextPow2(worldH * TEX_RES);
  const ctx = canvas.getContext('2d')!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(TEX_RES, TEX_RES);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx);
  scene.textures.addCanvas(key, canvas);
}

/** Fill with an outline of `OUTLINE` that only shows outside the shape (stroke first, fill on top). */
function outlined(ctx: CanvasRenderingContext2D, path: () => void, fill: string, width = OUTLINE): void {
  ctx.beginPath();
  path();
  ctx.lineWidth = width * 2;
  ctx.strokeStyle = COLORS.outline;
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fill();
}

// ---------------------------------------------------------------------------- Obstacles

function drawLog(ctx: CanvasRenderingContext2D): void {
  const { width: w, height: h } = CONFIG.obstacles.log;
  outlined(ctx, () => ctx.roundRect(-w / 2, -h / 2, w, h, h / 2), COLORS.log);

  // Bark lines
  ctx.strokeStyle = COLORS.logDark;
  ctx.lineWidth = 3;
  for (const [x0, x1, y] of [
    [-44, -14, -6],
    [-30, 8, 6],
    [-2, 26, -7],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
  }

  // Cut end with rings
  const ex = w / 2 - 12;
  outlined(ctx, () => ctx.ellipse(ex, 0, 10, h / 2 - 1, 0, 0, Math.PI * 2), COLORS.logEnd, OUTLINE * 0.75);
  ctx.strokeStyle = COLORS.logDark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(ex, 0, 5, 9, 0, 0, Math.PI * 2);
  ctx.stroke();
}

export function generateTextures(scene: Phaser.Scene): void {
  makeTexture(scene, TEX.log, 160, 64, drawLog);
}


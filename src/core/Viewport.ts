import Phaser from 'phaser';
import { CONFIG } from '../config';

/** Visible world rectangle, in world units. */
export interface ViewBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

/** CSS size of the page area the game occupies. */
function cssSize(): { w: number; h: number } {
  const vv = window.visualViewport;
  const w = Math.max(1, Math.round(vv?.width ?? window.innerWidth));
  const h = Math.max(1, Math.round(vv?.height ?? window.innerHeight));
  return { w, h };
}

/**
 * Backbuffer size = CSS size × device pixel ratio, capped for performance.
 * The canvas is then CSS-scaled back down by Phaser's FIT mode (same aspect, so no letterboxing).
 */
export function computeRenderSize(): { width: number; height: number } {
  const { w, h } = cssSize();
  let ratio = Math.min(window.devicePixelRatio || 1, CONFIG.view.maxPixelRatio);
  const pixels = w * h * ratio * ratio;
  if (pixels > CONFIG.view.maxRenderPixels) ratio *= Math.sqrt(CONFIG.view.maxRenderPixels / pixels);
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

/** Keeps the canvas matched to the window and notifies listeners after each resize. */
export function installResizeHandling(game: Phaser.Game): void {
  let pending = 0;
  const apply = () => {
    pending = 0;
    const { width, height } = computeRenderSize();
    if (width !== game.scale.width || height !== game.scale.height) {
      game.scale.setGameSize(width, height);
    }
  };
  const schedule = () => {
    if (!pending) pending = requestAnimationFrame(apply);
  };
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', () => setTimeout(apply, 120));
  window.visualViewport?.addEventListener('resize', schedule);
}

/**
 * Frames the side-view camera: keeps the 720-unit gameplay band visible, keeps at least
 * `minViewWidth` of world visible on narrow screens, and places the duck at `duckScreenX`.
 * Never stretches — extra space on tall screens is mostly sky, with the water line kept low.
 */
export function frameCamera(camera: Phaser.Cameras.Scene2D.Camera, duckAnchorX: number, out: ViewBounds): ViewBounds {
  const { refHeight, minViewWidth, duckScreenX, minWaterFraction } = CONFIG.view;
  const restY = CONFIG.water.restY;
  const gw = camera.width;
  const gh = camera.height;
  const zoom = Math.min(gh / refHeight, gw / minViewWidth);
  const viewW = gw / zoom;
  const viewH = gh / zoom;
  const centerX = duckAnchorX + (0.5 - duckScreenX) * viewW;
  // At 16:9 this shows exactly the 0–720 band; taller views add sky above and keep the water low.
  const waterBelow = Math.max(refHeight - restY, viewH * minWaterFraction);
  const centerY = restY + waterBelow - viewH / 2;

  camera.setZoom(zoom);
  camera.centerOn(centerX, centerY);

  out.width = viewW;
  out.height = viewH;
  out.left = centerX - viewW / 2;
  out.right = centerX + viewW / 2;
  out.top = centerY - viewH / 2;
  out.bottom = centerY + viewH / 2;
  return out;
}

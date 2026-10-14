import Phaser from 'phaser';

/**
 * Layout of public/assets/duck-sheet.png (built by tools/process-duck-strip.py):
 * 256×256 cells in one row, every frame aligned on the eye so the head stays steady.
 *
 *   0 wing folded, foot forward   1 wing folded, feet back    2 wing raised
 *   3 wing folded, feet paddling  4 wing down (stretched)     5 wing swept back
 */
export const DUCK_SHEET = {
  key: 'duck',
  url: 'assets/duck-sheet.png',
  frameSize: 256,
  frameCount: 6,
  /** World units per sheet pixel (≈112 units wide on screen). */
  scale: 0.46,
  /** Pivot inside a cell (pixels) — the body's centre of mass, so rotation/squash look natural. */
  pivotX: 131,
  pivotY: 146,
} as const;

export type DuckAnim = 'swim' | 'rise' | 'fall' | 'dash' | 'land' | 'hurt';

const ANIMS: Record<DuckAnim, { frames: number[]; fps: number; repeat: number }> = {
  swim: { frames: [0, 1, 0, 3], fps: 7, repeat: -1 },
  rise: { frames: [2, 4], fps: 12, repeat: -1 },
  fall: { frames: [2], fps: 1, repeat: 0 },
  dash: { frames: [5], fps: 1, repeat: 0 },
  land: { frames: [4, 0], fps: 10, repeat: 0 },
  hurt: { frames: [2, 4], fps: 16, repeat: -1 },
};

export function animKey(anim: DuckAnim): string {
  return `${DUCK_SHEET.key}-${anim}`;
}

export function loadDuckSheet(scene: Phaser.Scene): void {
  scene.load.spritesheet(DUCK_SHEET.key, `${import.meta.env.BASE_URL}${DUCK_SHEET.url}`, {
    frameWidth: DUCK_SHEET.frameSize,
    frameHeight: DUCK_SHEET.frameSize,
    endFrame: DUCK_SHEET.frameCount - 1,
  });
}

export function createDuckAnims(scene: Phaser.Scene): void {
  for (const [name, a] of Object.entries(ANIMS)) {
    const key = animKey(name as DuckAnim);
    if (scene.anims.exists(key)) continue;
    scene.anims.create({
      key,
      frames: scene.anims.generateFrameNumbers(DUCK_SHEET.key, { frames: a.frames }),
      frameRate: a.fps,
      repeat: a.repeat,
    });
  }
}

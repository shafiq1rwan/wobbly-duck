import Phaser from 'phaser';
import { createDuckAnims, loadDuckSheet, skinTexture } from '../art/duckSprite';
import { CONFIG } from '../config';
import { Skins } from '../game/Skins';

/** Loads all artwork (pre-optimised WebPs listed in config). */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    loadDuckSheet(this); // classic: the fallback and every view's first texture
    // The worn skin loads up front so the duck appears dressed; other skins load when picked.
    const worn = new Skins().equipped;
    if (worn !== 'classic') loadDuckSheet(this, worn);
    const base = `${import.meta.env.BASE_URL}assets/`;
    // Stacked obstacles (crate stack) are built from their base texture at runtime, not loaded.
    const obstacles = Object.values(CONFIG.obstacles.types).filter((t) => !('stack' in t));
    const images = [...CONFIG.background.layers, ...obstacles, ...Object.values(CONFIG.food.kinds)];
    const pads = CONFIG.lilyPads;
    this.load.spritesheet(pads.key, base + pads.file, { frameWidth: pads.frameWidth, frameHeight: pads.frameHeight });
    const frog = CONFIG.frog;
    this.load.spritesheet(frog.key, base + frog.file, { frameWidth: frog.frameSize, frameHeight: frog.frameSize });
    const seen = new Set<string>(); // several kinds may share one texture
    for (const { key, file } of images) {
      if (seen.has(key)) continue;
      seen.add(key);
      this.load.image(key, base + file);
    }
  }

  create(): void {
    createDuckAnims(this);
    const worn = new Skins().equipped;
    if (worn !== 'classic') createDuckAnims(this, skinTexture(worn));
    this.scene.start('Game');
  }
}

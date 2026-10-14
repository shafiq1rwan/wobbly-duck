import Phaser from 'phaser';
import { createDuckAnims, loadDuckSheet } from '../art/duckSprite';
import { CONFIG } from '../config';

/** Loads all artwork (pre-optimised WebPs listed in config). */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    loadDuckSheet(this);
    const base = `${import.meta.env.BASE_URL}assets/`;
    const images = [...CONFIG.background.layers, ...Object.values(CONFIG.obstacles.types), ...Object.values(CONFIG.food.kinds)];
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
    this.scene.start('Game');
  }
}

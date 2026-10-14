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
    const seen = new Set<string>(); // several kinds may share one texture (e.g. corn / big corn)
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

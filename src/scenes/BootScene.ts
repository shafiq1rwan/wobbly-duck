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
    for (const layer of CONFIG.background.layers) this.load.image(layer.key, base + layer.file);
    for (const o of Object.values(CONFIG.obstacles.types)) this.load.image(o.key, base + o.file);
    for (const f of Object.values(CONFIG.food.kinds)) this.load.image(f.key, base + f.file);
  }

  create(): void {
    createDuckAnims(this);
    this.scene.start('Game');
  }
}

import Phaser from 'phaser';
import { generateTextures } from '../art/textures';
import { createDuckAnims, loadDuckSheet } from '../art/duckSprite';
import { CONFIG } from '../config';
import { setLoadProgress } from '../ui/loader';

/** Loads artwork and creates the remaining procedural obstacle texture. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    setLoadProgress(0);
    this.load.on(Phaser.Loader.Events.PROGRESS, setLoadProgress);
    loadDuckSheet(this);
    for (const layer of CONFIG.background.layers) {
      this.load.image(layer.key, `${import.meta.env.BASE_URL}assets/${layer.file}`);
    }
  }

  create(): void {
    createDuckAnims(this);
    generateTextures(this);
    this.scene.start('Game');
  }
}

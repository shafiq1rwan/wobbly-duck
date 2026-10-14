import Phaser from 'phaser';
import { CONFIG } from '../config';
import type { ViewBounds } from '../core/Viewport';

const SKY_TEXTURE = 'sky-gradient';

interface Layer {
  scene: Phaser.Scene;
  key: string;
  depth: number;
  images: Phaser.GameObjects.Image[];
  y: number;
  scale: number;
  /** Distance between repeats (image width + gap), world units. */
  period: number;
  parallax: number;
}

/**
 * Sky gradient plus repeating parallax scenery (clouds, distant rocks, palm islands).
 * Repeats are anchored to the world and spaced by a gap, so the scenery stays sparse and doesn't
 * jump when the view resizes. The ocean below the water line is drawn by Water.
 */
export class Background {
  private readonly sky: Phaser.GameObjects.Image;
  private readonly layers: Layer[] = [];
  private distance = 0;

  constructor(scene: Phaser.Scene, depth: number) {
    const bg = CONFIG.background;
    if (!scene.textures.exists(SKY_TEXTURE)) {
      const canvas = document.createElement('canvas');
      canvas.width = 2;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, hex(bg.skyTop));
      grad.addColorStop(1, hex(bg.skyHorizon));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 2, 256);
      scene.textures.addCanvas(SKY_TEXTURE, canvas);
    }
    this.sky = scene.add.image(0, 0, SKY_TEXTURE).setOrigin(0).setDepth(depth);

    bg.layers.forEach((spec, i) => {
      const source = scene.textures.get(spec.key).getSourceImage();
      const scale = spec.height / source.height;
      this.layers.push({
        scene,
        key: spec.key,
        depth: depth + 1 + i,
        images: [],
        y: CONFIG.water.restY + spec.sink - spec.height,
        scale,
        period: source.width * scale + spec.gap,
        parallax: spec.parallax,
      });
    });
  }

  update(dx: number, view: ViewBounds): void {
    this.distance += dx;
    // The gradient spans the whole visible sky, so tall screens get the same horizon haze.
    const skyBottom = CONFIG.water.restY + 10;
    this.sky.setPosition(view.left, view.top).setDisplaySize(view.width, Math.max(1, skyBottom - view.top));

    for (const layer of this.layers) {
      const offset = this.distance * layer.parallax;
      const first = Math.floor((view.left + offset) / layer.period);
      const needed = Math.ceil(view.width / layer.period) + 1;
      while (layer.images.length < needed) {
        layer.images.push(
          layer.scene.add.image(0, layer.y, layer.key).setOrigin(0).setScale(layer.scale).setDepth(layer.depth),
        );
      }
      layer.images.forEach((img, i) => {
        img.setVisible(i < needed);
        img.x = (first + i) * layer.period - offset;
      });
    }
  }
}

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

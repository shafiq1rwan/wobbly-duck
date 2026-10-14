import Phaser from 'phaser';
import { CONFIG } from '../config';
import type { ViewBounds } from '../core/Viewport';

const SKY_TEXTURE = 'sky-gradient';
const LAKE_SKY_TEXTURE = 'sky-gradient-lake';

/** One look of a layer (tropical or lake): texture, scale and top edge. */
interface Look {
  key: string;
  scale: number;
  y: number;
}

interface Layer {
  scene: Phaser.Scene;
  depth: number;
  images: Phaser.GameObjects.Image[];
  /** Which look each image currently shows (true = lake). */
  showsLake: boolean[];
  tropical: Look;
  lake: Look | null;
  alpha: number;
  /** Distance between repeats (image width + gap), world units. */
  period: number;
  parallax: number;
  /** Repeats from this index on show the lake look (Infinity = all tropical). */
  lakeFrom: number;
}

/**
 * Sky gradient plus repeating parallax scenery (clouds, distant rocks, palm islands).
 * Repeats are anchored to the world and spaced by a gap, so the scenery stays sparse and doesn't
 * jump when the view resizes. The ocean below the water line is drawn by Water.
 *
 * Biomes: each run starts tropical. `startLake` switches every repeat that is still off-screen to
 * the lake art, so the lake scenery scrolls in from the right while the palms drift away (each layer
 * at its own parallax speed); `setBlend` crossfades the sky and haze colours alongside.
 */
export class Background {
  private readonly sky: Phaser.GameObjects.Image;
  private readonly lakeSky: Phaser.GameObjects.Image;
  private readonly haze: Phaser.GameObjects.Rectangle;
  private readonly layers: Layer[] = [];
  private distance = 0;
  private blend = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    depth: number,
  ) {
    const bg = CONFIG.background;
    const lake = CONFIG.lake;
    makeGradient(scene, SKY_TEXTURE, bg.skyTop, bg.skyHorizon);
    makeGradient(scene, LAKE_SKY_TEXTURE, lake.sky.top, lake.sky.horizon);
    this.sky = scene.add.image(0, 0, SKY_TEXTURE).setOrigin(0).setDepth(depth);
    this.lakeSky = scene.add.image(0, 0, LAKE_SKY_TEXTURE).setOrigin(0).setDepth(depth).setAlpha(0);

    bg.layers.forEach((spec, i) => {
      const tropical = this.look(spec.key, spec.height, spec);
      this.layers.push({
        scene,
        depth: depth + 1 + i,
        images: [],
        showsLake: [],
        tropical,
        lake: null,
        alpha: 'alpha' in spec ? spec.alpha : 1,
        period: scene.textures.get(spec.key).getSourceImage().width * tropical.scale + spec.gap,
        parallax: spec.parallax,
        lakeFrom: Infinity,
      });
    });
    // Above the scenery, below obstacles and water.
    this.haze = scene.add
      .rectangle(0, 0, 1, 1, bg.skyHorizon, bg.hazeAlpha)
      .setOrigin(0)
      .setDepth(depth + 1 + bg.layers.length);
  }

  /** Lake textures load in the background after boot (see GameScene); true once they're all here. */
  get lakeReady(): boolean {
    return CONFIG.background.layers.every((spec) => this.scene.textures.exists(spec.lake.key));
  }

  /**
   * Starts the change to the lake: every repeat not yet on screen will show the lake art.
   * Returns false (and changes nothing) if the lake textures haven't loaded yet.
   */
  startLake(view: ViewBounds): boolean {
    if (!this.lakeReady) return false;
    CONFIG.background.layers.forEach((spec, i) => {
      const layer = this.layers[i];
      layer.lake ??= this.look(spec.lake.key, spec.lake.height, spec);
      const offset = this.distance * layer.parallax;
      layer.lakeFrom = Math.ceil((view.right + offset) / layer.period);
    });
    return true;
  }

  /** Back to the tropics at once (new run, menu). */
  resetBiome(): void {
    for (const layer of this.layers) layer.lakeFrom = Infinity;
    this.setBlend(0);
  }

  /** Sky and haze colours: 0 = tropical, 1 = lake. */
  setBlend(t: number): void {
    if (t === this.blend) return;
    this.blend = t;
    this.lakeSky.setAlpha(t);
    this.haze.setFillStyle(lerpColor(CONFIG.background.skyHorizon, CONFIG.lake.sky.horizon, t), CONFIG.background.hazeAlpha);
  }

  update(dx: number, view: ViewBounds): void {
    this.distance += dx;
    // The gradient spans the whole visible sky, so tall screens get the same horizon haze.
    const skyBottom = CONFIG.water.restY + 10;
    const skyH = Math.max(1, skyBottom - view.top);
    this.sky.setPosition(view.left, view.top).setDisplaySize(view.width, skyH);
    this.lakeSky.setPosition(view.left, view.top).setDisplaySize(view.width, skyH).setVisible(this.blend > 0);
    this.haze.setPosition(view.left, view.top).setSize(view.width, skyH);

    for (const layer of this.layers) {
      const offset = this.distance * layer.parallax;
      const first = Math.floor((view.left + offset) / layer.period);
      const needed = Math.ceil(view.width / layer.period) + 1;
      while (layer.images.length < needed) {
        const t = layer.tropical;
        layer.images.push(
          layer.scene.add.image(0, t.y, t.key).setOrigin(0).setScale(t.scale).setAlpha(layer.alpha).setDepth(layer.depth),
        );
        layer.showsLake.push(false);
      }
      layer.images.forEach((img, i) => {
        img.setVisible(i < needed);
        img.x = (first + i) * layer.period - offset;
        const lake = first + i >= layer.lakeFrom && layer.lake !== null;
        if (lake !== layer.showsLake[i]) {
          layer.showsLake[i] = lake;
          const look = lake ? layer.lake! : layer.tropical;
          img.setTexture(look.key).setScale(look.scale).setY(look.y);
        }
      });
    }
  }

  private look(key: string, height: number, spec: (typeof CONFIG.background.layers)[number]): Look {
    const scale = height / this.scene.textures.get(key).getSourceImage().height;
    const bottom = 'baseline' in spec ? spec.baseline : CONFIG.water.restY + spec.sink;
    return { key, scale, y: bottom - height };
  }
}

function makeGradient(scene: Phaser.Scene, key: string, top: number, horizon: number): void {
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, hex(top));
  grad.addColorStop(1, hex(horizon));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  scene.textures.addCanvas(key, canvas);
}

/** Blends two 0xRRGGBB colours. */
export function lerpColor(a: number, b: number, t: number): number {
  const ch = (shift: number) => Math.round(((a >> shift) & 255) + ((((b >> shift) & 255) - ((a >> shift) & 255)) * t));
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

function hex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

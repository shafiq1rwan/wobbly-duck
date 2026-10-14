import Phaser from 'phaser';
import { animKey, DUCK_SHEET, type DuckAnim } from '../art/duckSprite';
import type { Duck } from './Duck';

/** How long the landing frames play before returning to the swim cycle. */
const LAND_TIME = 0.2;

/** The sprite duck follows the controller; visual motion never changes its collider. */
export class DuckView {
  readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Sprite;
  private current: DuckAnim | null = null;
  private landTimer = 0;
  private hurtFlash = 0;

  constructor(scene: Phaser.Scene, depth: number) {
    const s = DUCK_SHEET;
    this.body = scene.add
      .sprite(0, 0, s.key, 0)
      .setOrigin(s.pivotX / s.frameSize, s.pivotY / s.frameSize)
      .setScale(s.scale);
    this.root = scene.add.container(0, 0, [this.body]).setDepth(depth);
    this.play('swim');
  }

  reset(): void {
    this.hurtFlash = 0;
    this.landTimer = 0;
    this.body.clearTint();
    this.root.setScale(1);
    this.play('swim');
  }

  sync(duck: Duck, dt: number): void {
    this.root.setPosition(duck.x, duck.y).setRotation(duck.rotation);
    const squash = duck.dashing ? 0.07 : duck.airborne ? -0.035 : Math.sin(duck.time * 5) * 0.012;
    this.root.setScale(1 + squash, 1 - squash);

    if (duck.justLanded) this.landTimer = LAND_TIME;
    this.landTimer = Math.max(0, this.landTimer - dt);
    this.play(this.pickAnim(duck));

    if (!duck.alive) {
      this.hurtFlash += dt;
      const on = this.hurtFlash < 0.5 && Math.floor(this.hurtFlash * 16) % 2 === 0;
      this.body.setTint(on ? 0xff8f8f : 0xffffff);
    }
  }

  private pickAnim(duck: Duck): DuckAnim {
    if (!duck.alive) return duck.airborne ? 'hurt' : 'fall';
    if (duck.dashing) return 'dash';
    if (duck.airborne) return duck.vy < 0 ? 'rise' : 'fall';
    if (this.landTimer > 0) return 'land';
    return 'swim';
  }

  private play(anim: DuckAnim): void {
    if (anim === this.current) return;
    this.current = anim;
    this.body.play(animKey(anim));
  }
}

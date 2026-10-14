import Phaser from 'phaser';
import { animKey, DUCK_SHEET, type DuckAnim } from '../art/duckSprite';
import { CONFIG } from '../config';
import type { Duck } from './Duck';
import { Spring } from './Spring';

/** How long the landing frames play before returning to the swim cycle. */
const LAND_TIME = 0.2;
/** Duration of the double-jump somersault. */
const FLIP_TIME = 0.38;
const J = CONFIG.duck.jiggle;

/**
 * The duck's visuals. Reads the controller each frame and layers spring-driven squash & stretch,
 * tilt wobble and hurt shake on top of the sprite animation. Purely cosmetic: the collider in
 * Duck never changes.
 *
 * Hierarchy: root (position, rotation) → squasher (scale, pivot at the waterline) → sprite.
 */
export class DuckView {
  readonly root: Phaser.GameObjects.Container;
  private readonly squasher: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Sprite;
  private readonly stretch = new Spring(J.wobbleFrequency, J.wobbleDamping);
  private readonly tilt = new Spring(J.tiltFrequency, J.tiltDamping);
  private current: DuckAnim | null = null;
  private landTimer = 0;
  private hurtTime = -1;
  private shakeTime = 0;
  /** Remaining time of the double-jump somersault (s). */
  private flipTime = 0;
  private readonly baseTint: number;

  /** `size` scales the whole duck (ducklings); `tint` colours it (placeholder duckling art). */
  constructor(scene: Phaser.Scene, depth: number, size = 1, tint = 0xffffff) {
    const s = DUCK_SHEET;
    this.baseTint = tint;
    this.body = scene.add
      .sprite(0, -J.anchorY * size, s.key, 0)
      .setOrigin(s.pivotX / s.frameSize, s.pivotY / s.frameSize)
      .setScale(s.scale * size)
      .setTint(tint);
    this.squasher = scene.add.container(0, J.anchorY * size, [this.body]);
    this.root = scene.add.container(0, 0, [this.squasher]).setDepth(depth);
    this.play('swim');
  }

  setVisible(visible: boolean): void {
    this.root.setVisible(visible);
  }

  reset(): void {
    this.hurtTime = -1;
    this.shakeTime = 0;
    this.flipTime = 0;
    this.landTimer = 0;
    this.stretch.reset();
    this.tilt.reset();
    this.body.setTint(this.baseTint);
    this.play('swim');
  }

  /** Stops/starts the sprite animation (pause and game over freeze the scene). */
  setFrozen(frozen: boolean): void {
    if (frozen) this.body.anims.pause();
    else this.body.anims.resume();
  }

  // ------------------------------------------------------------------ impulses

  onJump(): void {
    // Quick squash, then kicked upward into a stretch.
    this.stretch.value = -J.jumpSquash;
    this.stretch.velocity = J.jumpKick;
  }

  /** `strength` 0..1 — landing speed relative to a full jump. */
  onLand(strength: number): void {
    this.landTimer = LAND_TIME;
    this.stretch.velocity -= J.landingImpact * strength;
    this.tilt.velocity += J.tiltLandingKick * strength * (Math.random() < 0.5 ? -1 : 1);
  }

  /** Mid-air second jump: a quick forward somersault with a squash-and-stretch kick. */
  onDoubleJump(): void {
    this.flipTime = FLIP_TIME;
    this.stretch.value = -J.jumpSquash * 0.8;
    this.stretch.velocity = J.jumpKick * 0.9;
  }

  /** Launched by a lily pad: a big stretch. */
  onBounce(): void {
    this.stretch.value = -J.jumpSquash;
    this.stretch.velocity = J.jumpKick * 1.3;
  }

  onDash(): void {
    this.stretch.velocity -= J.dashKick;
  }

  onHurt(): void {
    this.hurtTime = 0;
    this.shakeTime = J.hurtShakeTime;
    this.stretch.velocity -= J.hurtKick;
    this.tilt.velocity += J.tiltLandingKick * 2;
  }

  // ------------------------------------------------------------------ per frame

  sync(duck: Duck, dt: number): void {
    // Deformation target from the current state; impulses above add the bounce.
    let target: number;
    let lean = 0;
    if (!duck.alive) {
      target = 0;
    } else if (duck.dashing) {
      target = J.dashStretch;
      lean = J.dashLean;
    } else if (duck.airborne) {
      const jump = CONFIG.duck.jump;
      target = duck.vy < 0 ? (-duck.vy / jump.velocity) * J.riseStretch : (duck.vy / jump.maxFallSpeed) * J.fallStretch;
    } else {
      target = J.swimWobble * Math.sin(duck.time * J.swimWobbleFrequency * Math.PI * 2);
    }

    const s = Phaser.Math.Clamp(this.stretch.step(target, dt), -J.maxSquash, J.maxStretch);
    // Preserve area: taller ⇒ thinner, squashed ⇒ wider.
    this.squasher.setScale(1 / (1 + s), 1 + s);

    const tilt = Phaser.Math.Clamp(this.tilt.step(lean, dt), -J.tiltMax, J.tiltMax);
    // Somersault: one full forward turn, easing out, so it ends exactly where it started.
    let flip = 0;
    if (this.flipTime > 0) {
      this.flipTime = Math.max(0, this.flipTime - dt);
      const t = 1 - this.flipTime / FLIP_TIME;
      flip = Math.PI * 2 * (1 - (1 - t) ** 3);
    }
    this.root.setRotation(duck.rotation + tilt + flip);

    let shakeX = 0;
    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      shakeX = Math.sin(this.shakeTime * 70) * J.hurtShake * (this.shakeTime / J.hurtShakeTime);
    }
    this.root.setPosition(duck.x + shakeX, duck.y);

    this.landTimer = Math.max(0, this.landTimer - dt);
    this.play(this.pickAnim(duck));

    if (this.hurtTime >= 0) {
      this.hurtTime += dt;
      const on = this.hurtTime < 0.5 && Math.floor(this.hurtTime * 16) % 2 === 0;
      this.body.setTint(on ? 0xff8f8f : this.baseTint);
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

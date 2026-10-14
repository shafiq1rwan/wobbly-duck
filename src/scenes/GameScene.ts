import Phaser from 'phaser';
import { CONFIG } from '../config';
import { AudioManager } from '../core/Audio';
import { InputManager } from '../core/InputManager';
import { loadNumber, saveNumber } from '../core/Storage';
import { frameCamera, type ViewBounds } from '../core/Viewport';
import { Background } from '../game/Background';
import { CameraShake } from '../game/CameraShake';
import { DashMeter } from '../game/DashMeter';
import { Duck } from '../game/Duck';
import { DuckView } from '../game/DuckView';
import { FoodManager, type FoodKind } from '../game/FoodManager';
import { LilyPads, type LilyPadEvents } from '../game/LilyPads';
import { ObstacleManager, type Obstacle } from '../game/ObstacleManager';
import { Parade, type ParadeEvents } from '../game/Parade';
import { Spawner, type Entry, type FoodRole } from '../game/Patterns';
import { ScorePopups } from '../game/ScorePopups';
import { Splashes } from '../game/Splashes';
import { Water } from '../game/Water';
import { platform } from '../platform/Platform';
import { UI } from '../ui/UI';

type State = 'menu' | 'playing' | 'paused' | 'crashed' | 'gameover';

/** Background uses 0–4 (sky + parallax layers); the ocean body sits behind obstacles, the water tint in front. */
const DEPTH = { background: 0, waterBack: 5, pads: 9, obstacles: 10, frogs: 11, food: 12, ducklings: 19, duck: 20, water: 30, splashes: 35, meter: 36, popups: 37, debug: 100 };
const DEBUG = new URLSearchParams(window.location.search).has('debug');
/** Ignore restart input for a moment after the game-over screen appears (prevents mash-restarts). */
const RESTART_LOCKOUT = 0.35;
/** Picks a kernel for a pattern role, by the weights in CONFIG.food.roles. */
function pickKernel(role: FoodRole): FoodKind {
  const weights = CONFIG.food.roles[role] as Partial<Record<FoodKind, number>>;
  let r = Math.random() * Object.values(weights).reduce((sum, w) => sum + (w ?? 0), 0);
  for (const [kind, w] of Object.entries(weights) as [FoodKind, number][]) {
    r -= w;
    if (r <= 0) return kind;
  }
  return 'yellow';
}
const CRATE_CHUNKS = [0xf3b65a, 0xe09a3e, 0xc77e36];

export class GameScene extends Phaser.Scene {
  private state: State = 'menu';
  private readonly view: ViewBounds = { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 };

  private controls!: InputManager;
  private ui!: UI;
  private water!: Water;
  private duck!: Duck;
  private duckView!: DuckView;
  private obstacles!: ObstacleManager;
  private food!: FoodManager;
  private readonly spawner = new Spawner();
  private background!: Background;
  private splashes!: Splashes;
  private parade!: Parade;
  private pads!: LilyPads;
  private popups!: ScorePopups;
  private dashMeter!: DashMeter;
  private readonly shake = new CameraShake();
  private audio!: AudioManager;
  private debugGfx?: Phaser.GameObjects.Graphics;

  /** Current world scroll speed (units/s). */
  private speed = 0;
  /** Total world distance scrolled since boot (never reset; drives waves and spawning). */
  private worldDistance = 0;
  private runStart = 0;
  private stateTime = 0;
  private best = 0;
  /** Run score (food points × parade multiplier), best score, and the bank of all scores (for skins). */
  private score = 0;
  private bestScore = 0;
  private scoreBank = 0;
  /** Biggest parade this run, and ever. */
  private maxParade = 0;
  private bestParade = 0;
  /** Mother jump counter last seen, and world distance scrolled this frame (for popups). */
  private lastJumpCount = 0;
  private frameDx = 0;
  /** Deceleration after a crash, chosen so the world has stopped before the game-over panel. */
  private crashDecel: number = CONFIG.world.crashDecel;
  /** Runs started on this device (drives the first-visit controls hint). */
  private runs = 0;
  /** Accumulators for continuous effects (swim wake, dash spray, speed lines). */
  private swimRippleTimer = 0;
  private sprayAcc = 0;
  private linesAcc = 0;

  constructor() {
    super('Game');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(CONFIG.background.skyTop);

    this.background = new Background(this, DEPTH.background);
    this.obstacles = new ObstacleManager(this, DEPTH.obstacles);
    this.food = new FoodManager(this, DEPTH.food);
    this.duckView = new DuckView(this, DEPTH.duck);
    this.water = new Water(this, DEPTH.waterBack, DEPTH.water, this.view);
    this.splashes = new Splashes(this, DEPTH.splashes);
    this.parade = new Parade(this, DEPTH.ducklings, this.paradeEvents);
    this.pads = new LilyPads(this, DEPTH.pads, DEPTH.frogs, this.padEvents);
    this.popups = new ScorePopups(this, DEPTH.popups);
    this.dashMeter = new DashMeter(this, DEPTH.meter);
    this.audio = new AudioManager(loadNumber('muted') === 1);
    this.duck = new Duck(0);
    if (DEBUG) {
      this.debugGfx = this.add.graphics().setDepth(DEPTH.debug);
      (window as unknown as { __scene: GameScene }).__scene = this;
    }

    this.controls = new InputManager(this.game.canvas);
    this.ui = new UI({
      onPlay: () => this.startRun(),
      onPause: () => this.pause(),
      onResume: () => this.resume(),
      onRestart: () => this.startRun(),
      onHome: () => this.goHome(),
      onToggleSound: () => this.toggleSound(),
      onButton: () => this.audio.play('click'),
    });
    this.ui.setMuted(this.audio.isMuted);

    this.best = loadNumber('best');
    this.runs = loadNumber('runs');
    this.bestScore = loadNumber('bestScore');
    this.scoreBank = loadNumber('scoreBank');
    this.bestParade = loadNumber('bestParade');

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.layout();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
      this.audio.setHidden(document.hidden);
    });

    this.duck.reset(this.water);
    this.toMenu();
    platform.loadingFinished();
  }

  // ------------------------------------------------------------------ state changes

  private setState(state: State): void {
    // Paused and game over freeze the whole scene (world, water, sprite animation).
    this.duckView.setFrozen(state === 'paused' || state === 'gameover');
    this.parade.setFrozen(state === 'paused' || state === 'gameover');
    this.pads.setFrozen(state === 'paused' || state === 'gameover');
    this.state = state;
    this.stateTime = 0;
    this.ui.show(state === 'crashed' ? 'playing' : state);
  }

  /** Removes everything from the river and stops spawning. */
  private clearRiver(): void {
    this.obstacles.clear();
    this.food.clear();
    this.parade.clear();
    this.pads.clear();
    this.popups.clear();
    this.spawner.reset(this.worldDistance);
    this.spawner.active = false;
  }

  private toMenu(): void {
    this.clearRiver();
    this.ui.setMenuBest(this.bestScore);
    this.ui.setMenuBank(this.scoreBank);
    this.ui.setHintVisible(this.runs === 0);
    this.speed = CONFIG.world.menuSpeed;
    this.setState('menu');
  }

  private startRun(): void {
    if (this.state !== 'menu') {
      // Restart: fresh duck and clear the river.
      this.duck.reset(this.water);
      this.duckView.reset();
    }
    this.dashMeter.reset();
    this.shake.reset();
    this.clearRiver();
    // New players (first 3 runs): a lily pad and a double-jump sky arc early on, so both hints show.
    if (this.runs < 3) this.spawner.reset(this.worldDistance, [null, 'lily-bounce', null, 'sky-arc']);
    this.spawner.active = true;
    this.runStart = this.worldDistance;
    this.speed = this.baseSpeed();
    this.score = 0;
    this.maxParade = 0;
    this.lastJumpCount = this.duck.jumpCount;
    this.controls.clear();
    this.ui.setDistance(0);
    this.ui.setScore(0);
    this.ui.setParade(0, 'reset');
    saveNumber('runs', ++this.runs);
    this.setState('playing');
    if (this.runs <= 3) this.ui.showTouchZones();
    platform.gameplayStarted();
  }

  /** Back to the main menu from pause or game over. */
  private goHome(): void {
    if (this.state !== 'paused' && this.state !== 'gameover') return;
    this.duck.reset(this.water);
    this.duckView.reset();
    this.dashMeter.reset();
    this.shake.reset();
    this.toMenu();
  }

  private pause(): void {
    if (this.state !== 'playing') return;
    this.setState('paused');
    platform.gameplayStopped();
  }

  private resume(): void {
    if (this.state !== 'paused') return;
    this.controls.clear();
    this.setState('playing');
    platform.gameplayStarted();
  }

  private toggleSound(): void {
    const muted = !this.audio.isMuted;
    this.audio.setMuted(muted);
    saveNumber('muted', muted ? 1 : 0);
    this.ui.setMuted(muted);
  }

  private crash(): void {
    this.duck.kill();
    this.crashDecel = Math.max(CONFIG.world.crashDecel, this.speed / (CONFIG.gameOverDelay * 0.7));
    this.duckView.onHurt();
    this.shake.add(CONFIG.camera.shake.crash);
    this.audio.play('hit');
    this.splashes.burst(this.duck.x + 20, this.duck.y, 8, 180, 360, -2.4, -0.7, 3, 5);
    this.parade.scatter();
    this.ui.setParade(0, 'reset');
    this.spawner.active = false;
    this.setState('crashed');
  }

  private showGameOver(): void {
    const metres = this.runMetres();
    if (metres > this.best) {
      this.best = metres;
      saveNumber('best', metres); // best distance is still kept as a secondary record
    }
    const isNewBest = this.score > this.bestScore;
    if (isNewBest) {
      this.bestScore = this.score;
      saveNumber('bestScore', this.score);
    }
    if (this.maxParade > this.bestParade) {
      this.bestParade = this.maxParade;
      saveNumber('bestParade', this.maxParade);
    }
    this.scoreBank += this.score;
    saveNumber('scoreBank', this.scoreBank);
    this.ui.setGameOver(this.score, metres, this.bestScore, isNewBest, this.maxParade);
    this.ui.setMenuBest(this.bestScore);
    this.ui.setMenuBank(this.scoreBank);
    this.setState('gameover');
    platform.gameplayStopped();
  }

  private runMetres(): number {
    return Math.floor((this.worldDistance - this.runStart) / CONFIG.world.unitsPerMetre);
  }

  /** Scroll speed for the current run distance (before any dash boost). */
  private baseSpeed(): number {
    const w = CONFIG.world;
    return w.baseSpeed + (w.maxSpeed - w.baseSpeed) * Math.min(1, this.runMetres() / w.speedRampMetres);
  }

  // ------------------------------------------------------------------ input

  private handleInput(): void {
    for (const action of this.controls.consume()) {
      switch (this.state) {
        case 'menu':
          if (action === 'confirm' || action === 'jump' || action === 'dash') this.startRun(); // any tap starts
          break;
        case 'playing':
          if (action === 'jump') this.duck.requestJump();
          else if (action === 'dash' && !this.duck.requestDash()) this.dashMeter.denied();
          else if (action === 'pause') this.pause();
          break;
        case 'paused':
          if (action === 'pause' || action === 'confirm') this.resume();
          break;
        case 'gameover':
          if (action === 'confirm' && this.stateTime > RESTART_LOCKOUT) this.startRun();
          break;
      }
    }
  }

  // ------------------------------------------------------------------ loop

  update(_time: number, deltaMs: number): void {
    this.handleInput();
    const dt = Math.min(deltaMs / 1000, CONFIG.maxFrameTime);
    if (this.state === 'paused') return;
    this.stateTime += dt;
    if (this.state === 'gameover') return; // frozen behind the panel; stateTime still drives the restart lockout

    // Sub-step so springs and collisions behave the same at 30, 60 or 144 Hz.
    const steps = Math.max(1, Math.ceil(dt / CONFIG.maxSubStep));
    const h = dt / steps;
    this.frameDx = 0;
    for (let i = 0; i < steps; i++) this.step(h);

    this.duckEffects(dt);
    this.duckView.sync(this.duck, dt);
    this.parade.sync(dt);
    this.pads.sync(dt);
    this.popups.update(dt, this.frameDx);
    // Events can be raised by input (dash) or physics (jump, landing); consume them once per frame.
    this.duck.clearEvents();
    this.water.draw(this.view);
    this.splashes.draw();
    this.dashMeter.draw(this.duck, dt);
    this.applyShake(dt);

    if (this.state === 'playing' || this.state === 'crashed') this.ui.setDistance(this.runMetres());
    if (this.state === 'crashed' && this.stateTime >= CONFIG.gameOverDelay) this.showGameOver();
    if (this.debugGfx) this.drawDebug(this.debugGfx);
  }

  private step(h: number): void {
    switch (this.state) {
      case 'menu':
        this.speed = CONFIG.world.menuSpeed;
        break;
      case 'playing':
        this.speed = this.baseSpeed() + this.duck.dashSpeedBoost();
        break;
      default:
        this.speed = Math.max(0, this.speed - this.crashDecel * h);
    }

    const dx = this.speed * h;
    this.worldDistance += dx;
    this.frameDx += dx;

    this.water.update(h, dx);
    this.splashes.update(h, dx, this.water);
    this.background.update(dx, this.view);
    this.obstacles.update(h, dx, this.water, this.view);
    this.food.update(h, dx, this.water, this.view);
    this.pads.update(h, dx, this.water, this.view, this.duck);
    const wantDuckling = this.parade.total < CONFIG.ducklings.max;
    this.spawner.update(this.worldDistance, this.runMetres(), this.baseSpeed(), wantDuckling, this.spawnEntry);
    this.duck.step(h, this.water);
    if (this.state === 'playing') this.pads.tryBounce(this.duck, true);
    if (this.duck.jumpCount !== this.lastJumpCount) {
      this.lastJumpCount = this.duck.jumpCount;
      this.parade.onMotherJump(this.worldDistance, this.duck.x);
    }
    this.parade.update(h, dx, this.worldDistance, this.duck, this.water, this.obstacles, this.pads, this.view);

    if (this.state !== 'playing') return;
    const hit = this.obstacles.hitTest(this.duck.collider);
    if (hit) {
      if (CONFIG.obstacles.types[hit.type].breakable && this.duck.canSmash) this.smash(hit);
      else this.crash();
    }
    this.food.collect(this.duck.collider, this.onPickup);
  }

  /** Places a pattern entry just beyond the right edge (minus how far it is overdue). */
  private readonly spawnEntry = (entry: Entry, overdue: number): void => {
    const x = this.view.right + CONFIG.obstacles.spawnMargin - overdue;
    if (entry.obstacle) {
      this.obstacles.spawn(entry.obstacle, x, this.water);
    } else if (entry.pad) {
      this.pads.spawn(x, this.water);
      this.hintOnce('seenLilyPad', 'Swim onto lily pads to bounce high!');
    } else if (entry.duckling) {
      this.parade.spawnLost(x, this.water);
      if (!loadNumber('seenDuckling')) {
        saveNumber('seenDuckling', 1);
        this.ui.showToast('Swim into ducklings — they follow you and multiply your score!');
      }
    } else if (entry.food) {
      const F = CONFIG.food;
      const kind = pickKernel(entry.food);
      if (entry.on) {
        // Resting on the obstacle: just above its top (heights are relative to the duck's swim position).
        const t = CONFIG.obstacles.types[entry.on];
        const halfFood = 40 * F.kinds[kind].scale; // ≈ half the kernel body (80 px in the 160 px texture)
        const h = t.top + F.onTopGap + halfFood - CONFIG.duck.floatOffset;
        this.food.spawn(kind, x, h, t.waveFollow, true, this.water);
      } else if (entry.h !== undefined) {
        this.food.spawn(kind, x, entry.h, 0, false, this.water); // along a jump arc
        if (entry.sky) this.hintOnce('seenDoubleJump', 'Jump again in the air to double jump!');
      } else {
        this.food.spawn(kind, x, F.lowHeight, 1, false, this.water); // floating on the water
      }
    }
  };

  private readonly onPickup = (x: number, y: number, kind: FoodKind): void => {
    const base = CONFIG.food.kinds[kind].points;
    const points = base * this.parade.multiplier;
    this.score += points;
    this.ui.setScore(this.score);
    const bonus = base >= CONFIG.food.bonusPoints;
    this.popups.show(x, y, points, bonus || this.parade.count >= 3);
    const effect = CONFIG.food.pickup;
    this.splashes.sparkle(x, y, bonus ? effect.bonusSparkCount : effect.sparkCount, CONFIG.food.kinds[kind].sparkle);
    this.splashes.pickupRing(x, y, CONFIG.food.kinds[kind].sparkle[1], bonus);
    this.audio.play(bonus ? 'bonus' : 'pickup');
  };

  /** Parade feedback: sounds, sparkles, HUD, and offering the next duckling sooner after a loss. */
  private readonly paradeEvents: ParadeEvents = {
    joined: (x, y, count) => {
      this.audio.play('peep');
      this.splashes.sparkle(x, y - 10, 8, [0xffffff, 0xfff3b0, 0xffe45c]);
      this.maxParade = Math.max(this.maxParade, count);
      this.ui.setParade(count, 'join');
    },
    lost: (x, y, count) => {
      this.audio.play('peepSad');
      this.splashes.burst(x, y, 6, 140, 280, -2.4, -0.7, 2.5, 4);
      this.ui.setParade(count, 'lost');
      this.spawner.hurryDuckling(this.runMetres());
    },
    landed: (x, strength) => {
      const surface = this.water.heightAt(x);
      this.water.disturb(x, 60 * strength, 26);
      this.splashes.burst(x, surface, Math.round(4 * strength), 110 * strength, 240 * strength, -2.5, -0.6, 2, 3.5);
    },
  };

  /** Lily pad and frog feedback. */
  private readonly padEvents: LilyPadEvents = {
    bounced: (x, y, mother) => {
      this.water.disturb(x, mother ? 120 : 60, 50);
      this.splashes.burst(x, y + 10, mother ? 10 : 4, 150, 320, -2.6, -0.5, 2.5, 4.5);
      if (mother) {
        this.audio.play('boing');
        this.shake.add(CONFIG.camera.shake.landing * 0.6);
      }
    },
    frogLeapt: () => this.audio.play('ribbit'),
    frogSplash: (x, y) => {
      this.water.disturb(x, 90, 30);
      this.splashes.burst(x, y, 6, 120, 260, -2.4, -0.7, 2.5, 4);
      this.audio.play('splashSmall');
    },
  };

  /** Shows a first-time hint once per device. */
  private hintOnce(key: string, message: string): void {
    if (loadNumber(key)) return;
    saveNumber(key, 1);
    this.ui.showToast(message);
  }

  /** Dash through a crate: it bursts into wood pieces, and any food on its lid is collected. */
  private smash(o: Obstacle): void {
    const { x, y } = o;
    this.food.collectOnTop(x, o.box.halfW, this.onPickup);
    this.obstacles.smash(o);
    this.splashes.chunks(x, y, 12, CRATE_CHUNKS);
    this.splashes.burst(x, this.water.heightAt(x), 6, 160, 320, -2.4, -0.7, 3, 5);
    this.water.disturb(x, 140, 50);
    this.shake.add(CONFIG.camera.shake.crate);
    this.audio.play('crate');
  }

  /** Turns the duck's one-frame events and ongoing states into deformation, water and sound. */
  private duckEffects(dt: number): void {
    const d = this.duck;
    const sp = CONFIG.splash;
    const surface = this.water.heightAt(d.x);

    if (d.justDoubleJumped) {
      // Mid-air: a puff of air instead of a water splash.
      this.duckView.onDoubleJump();
      this.splashes.sparkle(d.x - 6, d.y + 22, 8, [0xffffff, 0xeaf8ff, 0xd6f1ff]);
      this.audio.play('doubleJump');
    } else if (d.justJumped) {
      this.duckView.onJump();
      this.water.disturb(d.x, sp.takeoffRipple, 36);
      this.splashes.burst(d.x, surface, sp.takeoffDrops, 150, 300, -2.3, -0.9, 2.5, 4.5);
      this.audio.play('jump');
      this.audio.play('splashSmall');
    }
    if (d.justBounced) this.duckView.onBounce();
    if (d.justLanded) {
      const strength = Phaser.Math.Clamp(d.landingSpeed / CONFIG.duck.jump.velocity, 0, 1.3);
      this.duckView.onLand(strength);
      this.shake.add(CONFIG.camera.shake.landing * strength);
      this.water.disturb(d.x, d.landingSpeed * sp.landingRipple, 60);
      const n = Math.round((sp.landingDrops * strength) / 2);
      this.splashes.burst(d.x - 22, surface, n, 180 * strength, 420 * strength, -2.6, -1.8, 3.5, 7);
      this.splashes.burst(d.x + 22, surface, n, 180 * strength, 420 * strength, -1.35, -0.55, 3.5, 7);
      this.audio.play('splashBig');
    }
    if (d.justDashed) {
      this.duckView.onDash();
      this.shake.add(CONFIG.camera.shake.dash);
      this.audio.play('dash');
    }

    if (d.dashing) {
      this.linesAcc += dt * sp.speedLinesPerSecond;
      for (; this.linesAcc >= 1; this.linesAcc--) {
        this.splashes.speedLine(d.x - 60 - Math.random() * 50, d.y + Phaser.Math.FloatBetween(-38, 18));
      }
      if (!d.airborne) {
        this.sprayAcc += dt * sp.dashDropsPerSecond;
        for (; this.sprayAcc >= 1; this.sprayAcc--) {
          this.splashes.burst(d.x - 36, surface, 1, 220, 400, -2.9, -2.3, 2.5, 4.5);
        }
        this.water.disturb(d.x - 30, sp.dashRipple * dt * 60, 30);
      }
    }

    // Gentle wake while swimming.
    if (!d.airborne) {
      this.swimRippleTimer -= dt;
      if (this.swimRippleTimer <= 0) {
        this.swimRippleTimer = sp.swimRippleInterval;
        this.water.disturb(d.x - 34, sp.swimRipple, 22);
      }
    }
  }

  /** Offsets the camera from its framed position by the current shake (view bounds stay unshaken). */
  private applyShake(dt: number): void {
    this.shake.update(dt);
    const v = this.view;
    this.cameras.main.centerOn((v.left + v.right) / 2 + this.shake.x, (v.top + v.bottom) / 2 + this.shake.y);
  }

  private layout(): void {
    const cam = this.cameras.main;
    cam.setSize(this.scale.width, this.scale.height);
    frameCamera(cam, this.duck.anchorX, this.view);
  }

  private drawDebug(g: Phaser.GameObjects.Graphics): void {
    g.clear();
    g.lineStyle(2, 0xff2266, 1);
    const c = this.duck.collider;
    g.strokeCircle(c.x, c.y, c.r);
    this.obstacles.forEachActive((b) => g.strokeRect(b.x - b.halfW, b.y - b.halfH, b.halfW * 2, b.halfH * 2));
    this.parade.forEachCollider((x, y, r) => g.strokeCircle(x, y, r));
    g.lineStyle(2, 0x22cc66, 0.9);
    this.pads.forEachPad((x, top, halfW) => g.strokeRect(x - halfW, top - CONFIG.lilyPads.catchHeight, halfW * 2, CONFIG.lilyPads.catchHeight + 20));
    const pickup = c.r + CONFIG.food.pickupRadius;
    g.lineStyle(1, 0x22aa44, 0.8);
    this.food.forEachActive((x, y) => g.strokeCircle(x, y, pickup - c.r));
  }
}

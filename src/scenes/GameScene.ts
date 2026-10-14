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
import { ObstacleManager } from '../game/ObstacleManager';
import { Splashes } from '../game/Splashes';
import { Water } from '../game/Water';
import { platform } from '../platform/Platform';
import { UI } from '../ui/UI';

type State = 'menu' | 'playing' | 'paused' | 'crashed' | 'gameover';

/** Background uses 0–4 (sky + parallax layers); the ocean body sits behind obstacles, the water tint in front. */
const DEPTH = { background: 0, waterBack: 5, obstacles: 10, duck: 20, water: 30, splashes: 35, meter: 36, debug: 100 };
const DEBUG = new URLSearchParams(window.location.search).has('debug');
/** Ignore restart input for a moment after the game-over screen appears (prevents mash-restarts). */
const RESTART_LOCKOUT = 0.35;

export class GameScene extends Phaser.Scene {
  private state: State = 'menu';
  private readonly view: ViewBounds = { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 };

  private controls!: InputManager;
  private ui!: UI;
  private water!: Water;
  private duck!: Duck;
  private duckView!: DuckView;
  private obstacles!: ObstacleManager;
  private background!: Background;
  private splashes!: Splashes;
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
    this.duckView = new DuckView(this, DEPTH.duck);
    this.water = new Water(this, DEPTH.waterBack, DEPTH.water, this.view);
    this.splashes = new Splashes(this, DEPTH.splashes);
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
    this.state = state;
    this.stateTime = 0;
    this.ui.show(state === 'crashed' ? 'playing' : state);
  }

  private toMenu(): void {
    this.obstacles.spawning = false;
    this.obstacles.reset(this.worldDistance);
    this.ui.setMenuBest(this.best);
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
    this.obstacles.reset(this.worldDistance);
    this.obstacles.spawning = true;
    this.runStart = this.worldDistance;
    this.speed = CONFIG.world.baseSpeed;
    this.controls.clear();
    this.ui.setDistance(0);
    saveNumber('runs', ++this.runs);
    this.setState('playing');
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
    this.obstacles.spawning = false;
    this.setState('crashed');
  }

  private showGameOver(): void {
    const metres = this.runMetres();
    const isNewBest = metres > this.best;
    if (isNewBest) {
      this.best = metres;
      saveNumber('best', metres);
    }
    this.ui.setGameOver(metres, this.best, isNewBest);
    this.ui.setMenuBest(this.best);
    this.setState('gameover');
    platform.gameplayStopped();
  }

  private runMetres(): number {
    return Math.floor((this.worldDistance - this.runStart) / CONFIG.world.unitsPerMetre);
  }

  // ------------------------------------------------------------------ input

  private handleInput(): void {
    for (const action of this.controls.consume()) {
      switch (this.state) {
        case 'menu':
          if (action === 'confirm' || action === 'jump') this.startRun();
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
    for (let i = 0; i < steps; i++) this.step(h);

    this.duckEffects(dt);
    this.duckView.sync(this.duck, dt);
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
        this.speed = CONFIG.world.baseSpeed + this.duck.dashSpeedBoost();
        break;
      default:
        this.speed = Math.max(0, this.speed - this.crashDecel * h);
    }

    const dx = this.speed * h;
    this.worldDistance += dx;

    this.water.update(h, dx);
    this.splashes.update(h, dx, this.water);
    this.background.update(dx, this.view);
    this.obstacles.update(dx, this.worldDistance, this.speed, this.water, this.view);
    this.duck.step(h, this.water);

    if (this.state === 'playing' && this.obstacles.hitTest(this.duck.collider)) this.crash();
  }

  /** Turns the duck's one-frame events and ongoing states into deformation, water and sound. */
  private duckEffects(dt: number): void {
    const d = this.duck;
    const sp = CONFIG.splash;
    const surface = this.water.heightAt(d.x);

    if (d.justJumped) {
      this.duckView.onJump();
      this.water.disturb(d.x, sp.takeoffRipple, 36);
      this.splashes.burst(d.x, surface, sp.takeoffDrops, 150, 300, -2.3, -0.9, 2.5, 4.5);
      this.audio.play('jump');
      this.audio.play('splashSmall');
    }
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
  }
}

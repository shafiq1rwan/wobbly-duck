import Phaser from 'phaser';
import { CONFIG } from '../config';
import { InputManager } from '../core/InputManager';
import { loadNumber, saveNumber } from '../core/Storage';
import { frameCamera, type ViewBounds } from '../core/Viewport';
import { Background } from '../game/Background';
import { Duck } from '../game/Duck';
import { DuckView } from '../game/DuckView';
import { ObstacleManager } from '../game/ObstacleManager';
import { Water } from '../game/Water';
import { platform } from '../platform/Platform';
import { UI } from '../ui/UI';

type State = 'menu' | 'playing' | 'paused' | 'crashed' | 'gameover';

/** Background uses 0–4 (sky + parallax layers); the ocean body sits behind obstacles, the water tint in front. */
const DEPTH = { background: 0, waterBack: 5, obstacles: 10, duck: 20, water: 30, debug: 100 };
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
  private debugGfx?: Phaser.GameObjects.Graphics;

  /** Current world scroll speed (units/s). */
  private speed = 0;
  /** Total world distance scrolled since boot (never reset; drives waves and spawning). */
  private worldDistance = 0;
  private runStart = 0;
  private stateTime = 0;
  private best = 0;
  /** Runs started on this device (drives the first-visit controls hint). */
  private runs = 0;

  constructor() {
    super('Game');
  }

  create(): void {
    this.cameras.main.setBackgroundColor(CONFIG.background.skyTop);

    this.background = new Background(this, DEPTH.background);
    this.obstacles = new ObstacleManager(this, DEPTH.obstacles);
    this.duckView = new DuckView(this, DEPTH.duck);
    this.water = new Water(this, DEPTH.waterBack, DEPTH.water);
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
    });

    this.best = loadNumber('best');
    this.runs = loadNumber('runs');

    this.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.layout();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause();
    });

    this.duck.reset(this.water);
    this.toMenu();
    platform.loadingFinished();
  }

  // ------------------------------------------------------------------ state changes

  private setState(state: State): void {
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

  private crash(): void {
    this.duck.kill();
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
          else if (action === 'dash') this.duck.requestDash();
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
    if (this.state === 'paused') return;

    const dt = Math.min(deltaMs / 1000, CONFIG.maxFrameTime);
    this.stateTime += dt;
    this.duck.clearEvents();

    // Sub-step so springs and collisions behave the same at 30, 60 or 144 Hz.
    const steps = Math.max(1, Math.ceil(dt / CONFIG.maxSubStep));
    const h = dt / steps;
    for (let i = 0; i < steps; i++) this.step(h);

    this.duckView.sync(this.duck, dt);
    this.water.draw(this.view);

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
        this.speed = Math.max(0, this.speed - CONFIG.world.crashDecel * h);
    }

    const dx = this.speed * h;
    this.worldDistance += dx;

    this.water.update(h, dx);
    this.background.update(dx, this.view);
    this.obstacles.update(dx, this.worldDistance, this.speed, this.water, this.view);
    this.duck.step(h, this.water);

    if (this.state === 'playing' && this.obstacles.hitTest(this.duck.collider)) this.crash();
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

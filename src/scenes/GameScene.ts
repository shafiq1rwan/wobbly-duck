import Phaser from 'phaser';
import { createDuckAnims, loadDuckSheet, skinTexture, type SkinId } from '../art/duckSprite';
import { CONFIG } from '../config';
import { AudioManager } from '../core/Audio';
import { InputManager } from '../core/InputManager';
import { loadNumber, saveNumber } from '../core/Storage';
import { frameCamera, type ViewBounds } from '../core/Viewport';
import { Background } from '../game/Background';
import { Analytics } from '../game/Analytics';
import { BestMarker } from '../game/BestMarker';
import { CameraShake } from '../game/CameraShake';
import { Confetti } from '../game/Confetti';
import { DashMeter } from '../game/DashMeter';
import { Duck } from '../game/Duck';
import { DuckView } from '../game/DuckView';
import { FoodManager, type FoodKind } from '../game/FoodManager';
import { LilyPads, type LilyPadEvents } from '../game/LilyPads';
import { ObstacleManager, type Obstacle } from '../game/ObstacleManager';
import { Parade, type ParadeEvents } from '../game/Parade';
import { Spawner, type Entry, type FoodRole } from '../game/Patterns';
import { ScorePopups } from '../game/ScorePopups';
import { isSkin, Skins } from '../game/Skins';
import { Splashes } from '../game/Splashes';
import { Water } from '../game/Water';
import { platform } from '../platform/Platform';
import { UI } from '../ui/UI';

type State = 'menu' | 'playing' | 'paused' | 'crashed' | 'revive' | 'gameover';

/** Background uses 0–4 (sky + parallax layers); the ocean body sits behind obstacles, the water tint in front. */
const DEPTH = { background: 0, waterBack: 5, marker: 7, pads: 9, obstacles: 10, frogs: 11, food: 12, ducklings: 19, duck: 20, water: 30, splashes: 35, meter: 36, popups: 37, confetti: 38, debug: 100 };
/** `?debug` draws hit boxes and exposes the scene; never in the Poki build (no dev tools allowed). */
const DEBUG = import.meta.env.MODE !== 'poki' && new URLSearchParams(window.location.search).has('debug');
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
  private marker!: BestMarker;
  private readonly analytics = new Analytics();
  private confetti!: Confetti;
  /** Best score when the run started, and whether beating it has been celebrated yet. */
  private recordToBeat = 0;
  private recordCelebrated = false;
  private readonly skins = new Skins();
  /** Shop: open on the menu; the skin selected (worn, or tried on); the skin last asked to show. */
  private shopOpen = false;
  private shopSkin: SkinId = 'classic';
  private wantedSkin: SkinId = 'classic';
  /** Revive: already used this run; the ad is playing; invulnerable time left after reviving. */
  private revived = false;
  private adPlaying = false;
  private graceTime = 0;
  /**
   * First-run coach: the river slows to a stop before the first log (jump) and the first crate
   * (dash) until the player does the move. Each lesson is remembered once learned.
   */
  private coach: 'jump' | 'dash' | null = null;
  private timeScale = 1;
  private readonly learned = { jump: loadNumber('learnedJump') === 1, dash: loadNumber('learnedDash') === 1 };
  /** The run has started changing into the lake biome. */
  private lakeStarted = false;
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
    this.marker = new BestMarker(this, DEPTH.marker, this.onBestPassed);
    this.confetti = new Confetti(this, DEPTH.confetti, () => this.audio.play('popper'));
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
      onShop: () => {
        this.analytics.shopOpened();
        this.openShop();
      },
      onShopBack: () => this.closeShop(),
      onShopPick: (id) => this.pickSkin(id),
      onShopAction: () => this.shopAction(),
      onRevive: () => this.watchReviveAd(),
      onReviveSkip: () => this.skipRevive(),
      onAction: (action) => this.controls.press(action),
      onPause: () => this.pause(),
      onResume: () => this.resume(),
      onRestart: () => {
        if (this.state === 'gameover') this.analytics.gameOverButton('play-again');
        this.startRun();
      },
      onHome: () => {
        if (this.state === 'gameover') this.analytics.gameOverButton('home');
        this.goHome();
      },
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
    this.showSkin(this.skins.equipped);
    this.loadLakeArt();
    this.toMenu();
    platform.loadingFinished();
  }

  // ------------------------------------------------------------------ state changes

  private setState(state: State): void {
    // Paused, the revive offer and game over freeze the whole scene (world, water, sprite animation).
    const frozen = state === 'paused' || state === 'revive' || state === 'gameover';
    this.duckView.setFrozen(frozen);
    this.parade.setFrozen(frozen);
    this.pads.setFrozen(frozen);
    this.state = state;
    this.stateTime = 0;
    this.ui.show(state === 'crashed' ? 'playing' : state === 'menu' && this.shopOpen ? 'shop' : state);
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
    this.ui.setShopDot(this.skins.canAffordNew(this.scoreBank));
    this.ui.setHintVisible(this.runs === 0);
    this.marker.hide();
    this.resetBiome();
    this.speed = CONFIG.world.menuSpeed;
    this.setState('menu');
    this.analytics.menuShown();
  }

  /** Every way into a run passes a commercial break first (the portal decides whether an ad shows). */
  private startRun(): void {
    this.afterBreak(() => this.beginRun());
  }

  /** Offers the portal an ad break, muted and with input ignored while it plays, then continues. */
  private afterBreak(then: () => void): void {
    if (this.adPlaying) return;
    this.adPlaying = true;
    void platform.commercialBreak(() => this.audio.setAdPlaying(true)).then(() => {
      this.adPlaying = false;
      this.audio.setAdPlaying(false);
      this.controls.clear();
      then();
    });
  }

  private beginRun(): void {
    if (this.shopOpen) this.closeShop();
    if (this.state !== 'menu') {
      // Restart: fresh duck and clear the river.
      this.duck.reset(this.water);
      this.duckView.reset();
    }
    this.dashMeter.reset();
    this.shake.reset();
    this.clearRiver();
    // New players (first 3 runs): a lily pad and a double-jump sky arc early on, so both hints show.
    // New players: a log (jump lesson), a corn line to breathe, a crate (dash lesson), then a lily pad
    // and a double-jump sky arc.
    if (!this.learned.jump || !this.learned.dash) this.spawner.reset(this.worldDistance, ['log', 'corn-line', 'crate', 'lily-bounce', null, 'sky-arc']);
    else if (this.runs < 3) this.spawner.reset(this.worldDistance, [null, 'lily-bounce', null, 'sky-arc']);
    this.endCoach();
    this.spawner.active = true;
    this.runStart = this.worldDistance;
    this.resetBiome();
    this.marker.start(this.runStart, this.best);
    this.recordToBeat = this.bestScore;
    this.recordCelebrated = false;
    this.revived = false;
    this.graceTime = 0;
    this.speed = this.baseSpeed();
    this.score = 0;
    this.maxParade = 0;
    this.lastJumpCount = this.duck.jumpCount;
    this.controls.clear();
    this.ui.setDistance(0);
    this.ui.setScore(0);
    this.ui.setParade(0, 'reset');
    saveNumber('runs', ++this.runs);
    this.analytics.runStarted();
    this.setState('playing');
    this.hintOnce('seenAutoSwim', 'Your duck swims by itself! Just jump and dash.');
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
    this.afterBreak(() => {
      if (this.state !== 'paused') return;
      this.setState('playing');
      platform.gameplayStarted();
    });
  }

  private toggleSound(): void {
    const muted = !this.audio.isMuted;
    this.audio.setMuted(muted);
    saveNumber('muted', muted ? 1 : 0);
    this.ui.setMuted(muted);
  }

  private crash(obstacle: string): void {
    this.endCoach();
    this.analytics.crashed(obstacle);
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
    const stillPlaying = this.state !== 'revive'; // the revive offer already stopped gameplay
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
    if (stillPlaying) platform.gameplayStopped();
    this.analytics.runEnded();
  }

  // ------------------------------------------------------------------ biomes

  /** Lake scenery isn't needed for the first ~450 m, so it loads after boot instead of delaying it. */
  private loadLakeArt(): void {
    const base = `${import.meta.env.BASE_URL}assets/`;
    for (const spec of CONFIG.background.layers) {
      if (!this.textures.exists(spec.lake.key)) this.load.image(spec.lake.key, base + spec.lake.file);
    }
    this.load.start();
  }

  private resetBiome(): void {
    this.lakeStarted = false;
    this.background.resetBiome();
    this.water.setBlend(0);
  }

  /** Drifts from the tropical sea into the lake as the run goes on. */
  private updateBiome(): void {
    if (this.state === 'menu') return;
    const L = CONFIG.lake;
    const metres = this.runMetres();
    if (metres < L.fromMetres) return;
    if (!this.lakeStarted) this.lakeStarted = this.background.startLake(this.view);
    if (!this.lakeStarted) return; // lake art still loading: try again next frame
    const t = Math.min(1, (metres - L.fromMetres) / L.blendMetres);
    const eased = t * t * (3 - 2 * t);
    this.background.setBlend(eased);
    this.water.setBlend(eased);
  }

  // ------------------------------------------------------------------ revive (one rewarded ad per run)

  private canRevive(): boolean {
    return !this.revived && this.runMetres() >= CONFIG.revive.minMetres;
  }

  private offerRevive(): void {
    this.ui.showRevive(this.score);
    this.setState('revive');
    this.analytics.reviveOffered();
    platform.gameplayStopped();
  }

  private watchReviveAd(): void {
    if (this.state !== 'revive' || this.adPlaying) return;
    this.analytics.reviveChosen();
    this.adPlaying = true;
    this.ui.setReviveBusy(true);
    void platform.rewardedBreak(() => this.audio.setAdPlaying(true)).then((rewarded) => {
      this.adPlaying = false;
      this.audio.setAdPlaying(false);
      if (this.state !== 'revive') return;
      if (rewarded) this.revive();
      else this.showGameOver();
    });
  }

  private skipRevive(): void {
    if (this.state !== 'revive' || this.adPlaying) return;
    this.analytics.reviveDeclined(false);
    this.showGameOver();
  }

  /** Back in the water where the duck crashed: river ahead cleared, a moment of invulnerability. */
  private revive(): void {
    const R = CONFIG.revive;
    this.revived = true;
    this.duck.reset(this.water);
    this.duckView.reset();
    this.duckView.blink(R.graceSeconds);
    this.graceTime = R.graceSeconds;
    this.lastJumpCount = this.duck.jumpCount;
    this.dashMeter.reset();
    this.obstacles.clearBefore(this.duck.x + R.clearAhead, (x, y) => {
      this.splashes.sparkle(x, y, 10, [0xffffff, 0xeaf8ff, 0xd6f1ff]);
      this.water.disturb(x, 80, 40);
    });
    this.spawner.reset(this.worldDistance);
    this.spawner.active = true;
    this.speed = this.baseSpeed();
    this.controls.clear();
    this.setState('playing');
    this.water.disturb(this.duck.x, 160, 60);
    this.splashes.sparkle(this.duck.x, this.duck.y, 14, [0xffffff, 0xfff3b0, 0xffe45c]);
    this.audio.play('revive');
    this.ui.showToast('Revived! Keep going!', 2, 'info');
    platform.gameplayStarted();
  }

  // ------------------------------------------------------------------ skins shop

  private openShop(): void {
    if (this.state !== 'menu' || this.shopOpen) return;
    this.shopOpen = true;
    this.shopSkin = this.skins.equipped;
    this.refreshShop();
    this.setState('menu');
  }

  private closeShop(): void {
    if (!this.shopOpen) return;
    this.shopOpen = false;
    this.showSkin(this.skins.equipped); // drop any try-on
    this.ui.setMenuBank(this.scoreBank);
    this.ui.setShopDot(this.skins.canAffordNew(this.scoreBank));
    this.setState('menu');
  }

  /** Owned: wear it. Locked: try it on (the main button then offers to unlock it). */
  private pickSkin(id: string): void {
    if (!this.shopOpen || !isSkin(id)) return;
    this.shopSkin = id;
    if (this.skins.isOwned(id)) this.skins.equip(id);
    this.showSkin(id);
    this.refreshShop();
  }

  private shopAction(): void {
    if (!this.shopOpen) return;
    const id = this.shopSkin;
    if (this.skins.isOwned(id)) {
      this.startRun();
      return;
    }
    const price = this.skins.info(id).price;
    if (price > this.scoreBank) {
      this.ui.shopDenied();
      return;
    }
    this.scoreBank -= price;
    saveNumber('scoreBank', this.scoreBank);
    this.skins.unlock(id);
    this.skins.equip(id);
    this.refreshShop();
    this.celebrateUnlock(id);
    this.analytics.skinUnlocked(id);
  }

  /** Every unlock: confetti in the skin's own colours bursts from the duck, which hops and flips. */
  private celebrateUnlock(id: SkinId): void {
    const colors = this.skins.info(id).colors;
    this.ui.shopUnlocked(id);
    this.audio.play('popper');
    this.audio.play('unlock');
    this.confetti.fountain(this.duck.x, this.duck.y - 30, this.view, colors, 70, 300);
    this.splashes.sparkle(this.duck.x, this.duck.y - 20, 18, colors);
    this.water.disturb(this.duck.x, 140, 50);
    // A happy hop with a somersault at the top (the duck's own double jump).
    this.duck.requestJump();
    this.time.delayedCall(330, () => {
      if (this.state === 'menu') this.duck.requestJump();
    });
  }

  private refreshShop(): void {
    this.ui.setShop({
      bank: this.scoreBank,
      items: this.skins.list.map((s) => ({ id: s.id, name: s.name, file: s.file, price: s.price, owned: this.skins.isOwned(s.id) })),
      equipped: this.skins.equipped,
      selected: this.shopSkin,
    });
  }

  /** Dresses the duck and ducklings in a skin, loading its sheet first if needed. */
  private showSkin(id: SkinId): void {
    this.wantedSkin = id;
    const texture = skinTexture(id);
    const apply = () => {
      if (this.wantedSkin !== id) return; // another skin was picked while this one loaded
      createDuckAnims(this, texture);
      this.duckView.setSkin(texture);
      this.parade.setSkin(texture);
    };
    if (this.textures.exists(texture)) {
      apply();
      return;
    }
    loadDuckSheet(this, id);
    this.load.once(`filecomplete-spritesheet-${texture}`, apply);
    this.load.start();
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
    if (this.adPlaying) {
      this.controls.consume(); // no input while an ad plays (or is being requested)
      return;
    }
    for (const action of this.controls.consume()) {
      switch (this.state) {
        case 'menu':
          if (this.shopOpen) {
            if (action === 'pause') this.closeShop();
          } else if (action === 'confirm' || action === 'jump' || action === 'dash') {
            this.startRun(); // any tap starts
          }
          break;
        case 'revive':
          if (action === 'confirm') this.watchReviveAd();
          else if (action === 'pause') this.skipRevive();
          break;
        case 'playing':
          if (this.coach) {
            // The coach waits for its move; everything else (except pause) is ignored meanwhile.
            if (action === 'pause') this.pause();
            if (action !== this.coach) break;
            this.learnCoach();
          }
          if (action === 'jump') this.duck.requestJump();
          else if (action === 'dash' && !this.duck.requestDash()) this.dashMeter.denied();
          else if (action === 'pause') this.pause();
          break;
        case 'paused':
          if (action === 'pause' || action === 'confirm') this.resume();
          break;
        case 'gameover':
          if (action === 'confirm' && this.stateTime > RESTART_LOCKOUT) {
            this.analytics.gameOverButton('play-again');
            this.startRun();
          }
          break;
      }
    }
  }

  // ------------------------------------------------------------------ loop

  update(_time: number, deltaMs: number): void {
    this.handleInput();
    const dt = Math.min(deltaMs / 1000, CONFIG.maxFrameTime);
    if (this.state === 'paused') return;
    if (this.state === 'revive') {
      this.updateReviveOffer(dt);
      return;
    }
    this.stateTime += dt;
    if (this.state === 'gameover') return; // frozen behind the panel; stateTime still drives the restart lockout

    // The coach eases the river to a stop; everything else keeps animating.
    this.timeScale = this.coach ? Math.max(0, this.timeScale - dt * 6) : 1;
    const gdt = dt * this.timeScale;

    // Sub-step so springs and collisions behave the same at 30, 60 or 144 Hz.
    const steps = Math.max(1, Math.ceil(gdt / CONFIG.maxSubStep));
    const h = gdt / steps;
    this.frameDx = 0;
    for (let i = 0; i < steps; i++) this.step(h);
    this.updateCoachAndCues();
    this.marker.update(gdt, this.worldDistance, this.duck.anchorX, this.duck.x, this.water, this.view);
    this.confetti.update(dt, this.view);
    this.updateBiome();

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
    if (this.state === 'playing') this.analytics.tick(gdt, this.runMetres());
    if (this.state === 'crashed' && this.stateTime >= CONFIG.gameOverDelay) {
      if (this.canRevive()) this.offerRevive();
      else this.showGameOver();
    }
    if (this.debugGfx) this.drawDebug(this.debugGfx);
  }

  // ------------------------------------------------------------------ first-run coach + button cues

  /** Starts a coach lesson when its obstacle is close enough that doing the move now works. */
  private updateCoachAndCues(): void {
    const playing = this.state === 'playing';
    const next = playing ? this.obstacles.nextAhead(this.duck.x) : null;
    const dist = next ? next.x - this.duck.x : Infinity;
    const v = this.speed;
    const breakable = next ? CONFIG.obstacles.types[next.type].breakable : false;
    const dashReady = this.duck.dashReadiness >= 1;
    this.ui.setActionCues(!playing || dashReady, breakable && dist < v * 1.1);

    if (!playing || this.coach || !next || this.duck.airborne) return;
    // Trigger distances allow for the ~0.17 s the river takes to slow down.
    if (!this.learned.dash && next.type === 'crate' && dashReady && dist < v * 0.3 + 60) this.beginCoach('dash');
    else if (!this.learned.jump && !breakable && dist < v * 0.47 + 10) this.beginCoach('jump');
  }

  private beginCoach(action: 'jump' | 'dash'): void {
    this.coach = action;
    this.ui.showCoach(action);
  }

  /** The player did the move: remember it, and let the river flow again at once. */
  private learnCoach(): void {
    if (!this.coach) return;
    this.learned[this.coach] = true;
    saveNumber(this.coach === 'jump' ? 'learnedJump' : 'learnedDash', 1);
    this.endCoach();
  }

  private endCoach(): void {
    this.coach = null;
    this.timeScale = 1;
    this.ui.showCoach(null);
  }

  /** The offer counts down (held while the ad plays), then becomes game over. */
  private updateReviveOffer(dt: number): void {
    if (this.adPlaying) return;
    this.stateTime += dt;
    const left = 1 - this.stateTime / CONFIG.revive.offerSeconds;
    this.ui.setReviveTimer(left);
    if (left <= 0) {
      this.analytics.reviveDeclined(true);
      this.showGameOver();
    }
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
    this.graceTime = Math.max(0, this.graceTime - h);
    const hit = this.obstacles.hitTest(this.duck.collider);
    if (hit) {
      if (CONFIG.obstacles.types[hit.type].breakable && this.duck.canSmash) this.smash(hit);
      else if (this.graceTime <= 0) this.crash(hit.type); // just revived: swim through
    }
    this.food.collect(this.duck.collider, this.onPickup);
  }

  /** Places a pattern entry just beyond the right edge (minus how far it is overdue). */
  private readonly spawnEntry = (entry: Entry, overdue: number): void => {
    const x = this.view.right + CONFIG.obstacles.spawnMargin - overdue;
    if (entry.obstacle) {
      this.obstacles.spawn(entry.obstacle, x, this.water);
      if (entry.obstacle === 'crateStack') this.hintOnce('seenStack', 'Too tall to jump! Double jump over it, or dash to smash it!');
    } else if (entry.pad) {
      this.pads.spawn(x, this.water);
      this.hintOnce('seenLilyPad', 'Swim onto lily pads to bounce high!');
    } else if (entry.duckling) {
      this.parade.spawnLost(x, this.water);
      if (!loadNumber('seenDuckling')) {
        saveNumber('seenDuckling', 1);
        this.ui.showToast('Swim into ducklings: they follow you and multiply your score!', 4.5);
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
    if (!this.recordCelebrated && this.recordToBeat > 0 && this.score > this.recordToBeat) this.celebrateRecord();
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

  /** Swam past the best-distance flag. */
  private readonly onBestPassed = (x: number, y: number): void => {
    if (this.state !== 'playing') return;
    this.ui.showToast('New best distance!', 2.5, 'info');
    this.splashes.sparkle(x, y, 18, [0xffffff, 0xffe45c, 0xff994a]);
    this.confetti.fountain(x, y, this.view, CONFIG.celebration.colors, 30, 160);
    this.audio.play('fanfare');
  };

  /** The run's score just passed the best score: banner, party poppers, fanfare (once per run). */
  private celebrateRecord(): void {
    this.recordCelebrated = true;
    this.ui.showRecord();
    this.confetti.partyPoppers(CONFIG.celebration.colors);
    this.audio.play('fanfare');
  }

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
    const t = CONFIG.obstacles.types[o.type];
    const count = 'stack' in t ? t.stack.count : 1;
    const each = (t.hit.halfH * 2) / count; // one crate's height
    for (let i = 0; i < count; i++) this.splashes.chunks(x, y - i * each, 12, CRATE_CHUNKS);
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

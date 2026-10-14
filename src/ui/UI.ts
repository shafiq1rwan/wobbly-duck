export type Screen = 'menu' | 'playing' | 'paused' | 'gameover';

export interface UIHandlers {
  onPlay(): void;
  onPause(): void;
  onResume(): void;
  onRestart(): void;
  onHome(): void;
  onToggleSound(): void;
  /** Called for every button press (UI click sound). */
  onButton(): void;
}

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

const numberFormat = new Intl.NumberFormat('en-US');
/** Lets the release wobble start before the screen changes (still feels instant). */
const ACTION_DELAY_MS = 110;
const fmt = (n: number): string => numberFormat.format(n);

/**
 * DOM overlay for menus and HUD — crisp text at any DPR, safe-area aware via CSS,
 * and works with mouse and touch. Game rendering stays in the canvas underneath.
 * Layout and styling follow docs/UI_SPEC.md.
 */
export class UI {
  private readonly screens: Record<string, HTMLElement> = {
    hud: $('hud'),
    menu: $('menu'),
    pause: $('pause'),
    gameover: $('gameover'),
  };
  private readonly distanceEl = $('hud-distance');
  private lastDistance = -1;

  constructor(handlers: UIHandlers) {
    const bind = (id: string, fn: () => void) => {
      const el = $(id);
      let pending = false;
      // Squishy feedback: squash while held, jelly wobble on release (see .pressed / .jelly in CSS).
      el.addEventListener('pointerdown', (e) => {
        e.stopPropagation(); // keep button presses from being read as swipes
        el.classList.remove('jelly');
        el.classList.add('pressed');
        handlers.onButton();
      });
      const release = () => {
        if (!el.classList.contains('pressed')) return;
        el.classList.remove('pressed');
        void el.offsetWidth; // restart the animation
        el.classList.add('jelly');
      };
      el.addEventListener('pointerup', release);
      el.addEventListener('pointercancel', release);
      el.addEventListener('pointerleave', release);
      el.addEventListener('animationend', () => el.classList.remove('jelly'));
      el.addEventListener('click', (e) => {
        e.preventDefault();
        (el as HTMLButtonElement).blur();
        if (pending) return;
        pending = true;
        setTimeout(() => {
          pending = false;
          fn();
          // If the button's screen just closed, drop the class so it doesn't replay when shown again.
          if (!el.offsetParent) el.classList.remove('jelly');
        }, ACTION_DELAY_MS);
      });
    };
    bind('btn-play', handlers.onPlay);
    bind('btn-pause', handlers.onPause);
    bind('btn-resume', handlers.onResume);
    bind('btn-restart', handlers.onRestart);
    bind('btn-home', handlers.onHome);
    bind('btn-home-pause', handlers.onHome);
    bind('btn-sound-menu', handlers.onToggleSound);
    bind('btn-sound-pause', handlers.onToggleSound);
  }

  setMuted(muted: boolean): void {
    for (const id of ['btn-sound-menu', 'btn-sound-pause']) {
      const el = $(id);
      el.setAttribute('aria-pressed', String(!muted));
      el.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on');
    }
  }

  show(screen: Screen): void {
    const s = this.screens;
    s.menu.hidden = screen !== 'menu';
    s.hud.hidden = screen !== 'playing' && screen !== 'paused';
    s.pause.hidden = screen !== 'paused';
    s.gameover.hidden = screen !== 'gameover';
  }

  setMenuBest(best: number): void {
    $('menu-best').textContent = fmt(best);
  }

  /** Controls hint on the main menu — shown until the player has started a run. */
  setHintVisible(visible: boolean): void {
    $('menu-hint').style.visibility = visible ? 'visible' : 'hidden';
  }

  setDistance(metres: number): void {
    if (metres === this.lastDistance) return;
    this.lastDistance = metres;
    this.distanceEl.textContent = fmt(metres);
  }

  /** Corn collected across all runs (the currency for unlocking skins). */
  setMenuBank(total: number): void {
    $('menu-bank').textContent = fmt(total);
  }

  setGameOver(distance: number, best: number, isNewBest: boolean, food: number): void {
    $('go-distance').textContent = fmt(distance);
    $('go-food').textContent = `+${fmt(food)}`;
    $('go-best').textContent = fmt(best);
    $('go-best-label').textContent = isNewBest ? 'New Best!' : 'Best Distance';
    $('go-best-badge').classList.toggle('is-new', isNewBest);
  }
}

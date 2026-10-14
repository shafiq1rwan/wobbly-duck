export type Action = 'jump' | 'dash' | 'confirm' | 'pause';

const KEY_ACTIONS: Record<string, Action> = {
  Space: 'jump',
  KeyW: 'jump',
  ArrowUp: 'jump',
  KeyD: 'dash',
  ArrowRight: 'dash',
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  Escape: 'pause',
  KeyP: 'pause',
};

interface Gesture {
  startX: number;
  startY: number;
  fired: boolean;
}

/**
 * Engine-independent input: keyboard on the window, swipes on the game canvas.
 * Produces discrete actions that the game consumes once per frame.
 */
export class InputManager {
  private queue: Action[] = [];
  private drained: Action[] = [];
  private gestures = new Map<number, Gesture>();

  constructor(private readonly surface: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    surface.addEventListener('pointerdown', this.onPointerDown);
    surface.addEventListener('pointermove', this.onPointerMove);
    surface.addEventListener('pointerup', this.onPointerEnd);
    surface.addEventListener('pointercancel', this.onPointerEnd);
    surface.addEventListener('contextmenu', (e) => e.preventDefault());
    // Block page scroll / pull-to-refresh / pinch while touching the game.
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  /** Returns the actions received since the last call. The returned array is reused. */
  consume(): readonly Action[] {
    const out = this.queue;
    this.queue = this.drained;
    this.queue.length = 0;
    this.drained = out;
    return out;
  }

  clear(): void {
    this.queue.length = 0;
  }

  private push(action: Action): void {
    this.queue.push(action);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const action = KEY_ACTIONS[e.code];
    if (!action) return;
    // Also stops Space/Enter from activating a focused button and arrows from scrolling.
    e.preventDefault();
    if (e.repeat) return;
    this.push(action);
  };

  /** Swipe threshold in CSS pixels; scales a little with screen size. */
  private threshold(): number {
    return Math.max(24, Math.min(60, Math.min(window.innerWidth, window.innerHeight) * 0.06));
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.gestures.set(e.pointerId, { startX: e.clientX, startY: e.clientY, fired: false });
    try {
      this.surface.setPointerCapture(e.pointerId);
    } catch {
      /* not supported — fine */
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    const g = this.gestures.get(e.pointerId);
    if (!g || g.fired) return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (dx * dx + dy * dy < this.threshold() ** 2) return;

    // Fire as soon as the threshold is crossed (more responsive than waiting for release).
    // A gesture fires at most once.
    g.fired = true;
    if (-dy > Math.abs(dx) * 0.8) this.push('jump');
    else if (dx > Math.abs(dy)) this.push('dash');
  };

  private onPointerEnd = (e: PointerEvent): void => {
    this.gestures.delete(e.pointerId);
  };
}

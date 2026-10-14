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

/** Keys that would scroll the portal's page around the game: always swallowed. */
const SCROLL_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End']);

/**
 * Engine-independent input: keyboard on the window, taps on the game canvas — left half jumps,
 * right half dashes (like Cookie Run). Taps fire on touch-down, each finger on its own, so both
 * thumbs work at once. Produces discrete actions that the game consumes once per frame.
 */
export class InputManager {
  private queue: Action[] = [];
  private drained: Action[] = [];

  constructor(private readonly surface: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    surface.addEventListener('pointerdown', this.onPointerDown);
    surface.addEventListener('contextmenu', (e) => e.preventDefault());
    // Block page scroll / pull-to-refresh / pinch while touching the game.
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    // The mouse wheel must not scroll the page either (the shop list scrolls itself, see UI.ts).
    window.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
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
    if (SCROLL_KEYS.has(e.code)) e.preventDefault();
    const action = KEY_ACTIONS[e.code];
    if (!action) return;
    // Also stops Space/Enter from activating a focused button and arrows from scrolling.
    e.preventDefault();
    if (e.repeat) return;
    this.push(action);
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    const rect = this.surface.getBoundingClientRect();
    this.push(e.clientX < rect.left + rect.width / 2 ? 'jump' : 'dash');
  };
}

import { PokiPlatform } from './PokiPlatform';

/**
 * Platform adapter. Gameplay code only talks to this interface, never to a portal SDK directly.
 *
 * The local implementation does nothing (and fakes ads), so the game runs standalone during
 * development. `vite build --mode poki` selects PokiPlatform, which implements these hooks with the
 * official Poki HTML5 SDK — the method names here are our own, not the SDK's.
 */
export interface Platform {
  init(): Promise<void>;
  /** Assets are loaded and the game is interactive. */
  loadingFinished(): void;
  /** A run has started or resumed. */
  gameplayStarted(): void;
  /** A run has ended or been paused (menus, game over). */
  gameplayStopped(): void;
  /**
   * A chance for an ad before returning to gameplay (run start, resume). The portal decides whether
   * one shows; `onStart` runs only if it does (mute audio there). Resolves when the game may go on.
   */
  commercialBreak(onStart: () => void): Promise<void>;
  /**
   * Plays a rewarded ad (the player chose to watch one, e.g. to revive). `onStart` runs when the ad
   * starts (mute audio). Resolves true if the reward was earned. Call it with gameplay stopped.
   */
  rewardedBreak(onStart: () => void): Promise<boolean>;
  /** A Game Event for the portal's dashboard (see src/game/Analytics.ts). */
  measure(category: string, what: string, action: string): void;
}

class LocalPlatform implements Platform {
  async init(): Promise<void> {}
  loadingFinished(): void {}
  gameplayStarted(): void {}
  gameplayStopped(): void {}

  async commercialBreak(): Promise<void> {}

  /** Game Events are only logged locally, with `?debug`. */
  measure(category: string, what: string, action: string): void {
    if (new URLSearchParams(window.location.search).has('debug')) console.info('[measure]', category, what, action);
  }

  /** Stand-in for an ad so the revive flow can be played locally: a short placeholder, always rewarded. */
  rewardedBreak(onStart: () => void): Promise<boolean> {
    onStart();
    return new Promise((resolve) => {
      const el = document.createElement('div');
      el.textContent = 'Ad placeholder';
      el.style.cssText =
        'position:fixed;inset:0;z-index:50;display:grid;place-items:center;background:rgba(10,20,40,0.9);' +
        'color:#fff;font:600 20px system-ui,sans-serif';
      document.body.append(el);
      setTimeout(() => {
        el.remove();
        resolve(true);
      }, 1500);
    });
  }
}

export const platform: Platform = import.meta.env.MODE === 'poki' ? new PokiPlatform() : new LocalPlatform();

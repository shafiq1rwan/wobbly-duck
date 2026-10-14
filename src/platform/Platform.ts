/**
 * Platform adapter. Gameplay code only talks to this interface, never to a portal SDK directly.
 *
 * The local implementation does nothing, so the game runs standalone during development.
 * In Phase 5 a portal adapter (e.g. Poki) will implement these hooks using the official
 * SDK documentation — the method names here are our own, not the SDK's.
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
   * Plays a rewarded ad (the player chose to watch one, e.g. to revive). Resolves true if the reward
   * was earned. Call it with gameplay stopped; the game mutes its own audio while it runs.
   */
  rewardedBreak(): Promise<boolean>;
}

class LocalPlatform implements Platform {
  async init(): Promise<void> {}
  loadingFinished(): void {}
  gameplayStarted(): void {}
  gameplayStopped(): void {}

  /** Stand-in for an ad so the revive flow can be played locally: a short placeholder, always rewarded. */
  rewardedBreak(): Promise<boolean> {
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

export const platform: Platform = new LocalPlatform();

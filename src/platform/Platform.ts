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
}

class LocalPlatform implements Platform {
  async init(): Promise<void> {}
  loadingFinished(): void {}
  gameplayStarted(): void {}
  gameplayStopped(): void {}
}

export const platform: Platform = new LocalPlatform();

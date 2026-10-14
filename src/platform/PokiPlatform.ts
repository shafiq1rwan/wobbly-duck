import type { Platform } from './Platform';

/**
 * The parts of the Poki HTML5 SDK we use, as documented at
 * https://developers.poki.com/guide/sdk-html5 (loaded by the script tag that `vite build --mode poki`
 * adds to index.html). Nothing here is guessed: only documented calls.
 */
interface PokiSDKApi {
  init(): Promise<void>;
  gameLoadingFinished(): void;
  gameplayStart(): void;
  gameplayStop(): void;
  /** `onStart` runs when an ad actually starts (mute audio there). */
  commercialBreak(onStart?: () => void): Promise<void>;
  /** Resolves true if the video was shown, so the reward may be given. */
  rewardedBreak(onStart?: () => void): Promise<boolean>;
  /** Game Events (https://developers.poki.com/guide/game-events). */
  measure(category: string, what: string, action: string): void;
}

declare global {
  interface Window {
    PokiSDK?: PokiSDKApi;
  }
}

/**
 * Poki adapter. If the SDK is missing (ad blocker, offline) the game still plays: calls become no-ops,
 * commercial breaks resolve at once and rewarded breaks give no reward (Poki's rule).
 */
export class PokiPlatform implements Platform {
  /** Mirrors gameplayStart/Stop so neither is ever sent twice in a row (Poki requirement). */
  private playing = false;

  private get sdk(): PokiSDKApi | undefined {
    return window.PokiSDK;
  }

  async init(): Promise<void> {
    try {
      await this.sdk?.init();
    } catch {
      // Poki: "load your game anyway" (e.g. an ad blocker is active).
    }
  }

  loadingFinished(): void {
    this.call((s) => s.gameLoadingFinished());
  }

  gameplayStarted(): void {
    if (this.playing) return;
    this.playing = true;
    this.call((s) => s.gameplayStart());
  }

  gameplayStopped(): void {
    if (!this.playing) return;
    this.playing = false;
    this.call((s) => s.gameplayStop());
  }

  async commercialBreak(onStart: () => void): Promise<void> {
    const sdk = this.sdk;
    if (!sdk) return;
    try {
      await sdk.commercialBreak(onStart);
    } catch {
      /* no ad: just continue */
    }
  }

  async rewardedBreak(onStart: () => void): Promise<boolean> {
    const sdk = this.sdk;
    if (!sdk) return false;
    try {
      return Boolean(await sdk.rewardedBreak(onStart));
    } catch {
      return false;
    }
  }

  measure(category: string, what: string, action: string): void {
    this.call((s) => s.measure(category, what, action));
  }

  private call(fn: (sdk: PokiSDKApi) => void): void {
    const sdk = this.sdk;
    if (!sdk) return;
    try {
      fn(sdk);
    } catch {
      /* never let the portal break the game */
    }
  }
}

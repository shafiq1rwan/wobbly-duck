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

/** Longest we wait for `PokiSDK.init()` before using the SDK anyway (it can take seconds). */
const INIT_WAIT_MS = 10000;

/**
 * Poki adapter. If the SDK is missing (ad blocker, offline) the game still plays: calls become no-ops,
 * commercial breaks resolve at once and rewarded breaks give no reward (Poki's rule).
 *
 * `PokiSDK.init()` can take several seconds, so the game doesn't wait for it: it boots and loads in
 * parallel, and every SDK call is queued behind init so the order Poki sees is always
 * init → gameLoadingFinished → commercialBreak → gameplayStart.
 */
export class PokiPlatform implements Platform {
  /** Mirrors gameplayStart/Stop so neither is ever sent twice in a row (Poki requirement). */
  private playing = false;
  /** Resolves once the SDK is initialised (or failed, or took too long). */
  private ready: Promise<void> = Promise.resolve();

  private get sdk(): PokiSDKApi | undefined {
    return window.PokiSDK;
  }

  /** Starts the SDK and returns at once, so the game loads in parallel (see the class comment). */
  async init(): Promise<void> {
    const sdk = this.sdk;
    if (!sdk) return;
    let started: Promise<void>;
    try {
      started = sdk.init();
    } catch {
      return; // Poki: "load your game anyway"
    }
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, INIT_WAIT_MS));
    this.ready = Promise.race([started.catch(() => undefined), timeout]);
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
    await this.ready;
    try {
      await sdk.commercialBreak(onStart);
    } catch {
      /* no ad: just continue */
    }
  }

  async rewardedBreak(onStart: () => void): Promise<boolean> {
    const sdk = this.sdk;
    if (!sdk) return false;
    await this.ready;
    try {
      return Boolean(await sdk.rewardedBreak(onStart));
    } catch {
      return false;
    }
  }

  measure(category: string, what: string, action: string): void {
    this.call((s) => s.measure(category, what, action));
  }

  /** Runs an SDK call once init is done; calls keep their order because they share one promise. */
  private call(fn: (sdk: PokiSDKApi) => void): void {
    const sdk = this.sdk;
    if (!sdk) return;
    void this.ready.then(() => {
      try {
        fn(sdk);
      } catch {
        /* never let the portal break the game */
      }
    });
  }
}

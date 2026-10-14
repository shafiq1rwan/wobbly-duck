import { platform } from '../platform/Platform';

/** Active-play milestones (minutes, per page session). */
const PLAYTIME_MINUTES = [1, 3, 5, 10, 20];
/** Run-distance milestones (metres, per run). */
const DISTANCES = [100, 250, 500, 1000, 2000];

/**
 * Game Events for Poki (`measure(category, what, action)`, see docs/ANALYTICS.md), kept to seven
 * groups: playtime, runs, distance, deaths, game-over buttons, shop/skins and the revive offer.
 * Gameplay code reports what happened; this class owns the "once per session / per run" rules.
 * Values never contain `/` or `^` (reserved by Poki), and ads themselves are not measured — the SDK
 * tracks those.
 */
export class Analytics {
  private playSeconds = 0;
  private nextPlaytime = 0;
  private runs = 0;
  private nextDistance = 0;

  /** Active gameplay time (call only while playing: menus, pauses and ads don't count). */
  tick(dt: number, runMetres: number): void {
    this.playSeconds += dt;
    while (this.nextPlaytime < PLAYTIME_MINUTES.length && this.playSeconds >= PLAYTIME_MINUTES[this.nextPlaytime] * 60) {
      this.send('session', `${PLAYTIME_MINUTES[this.nextPlaytime]}min`, 'reached');
      this.nextPlaytime++;
    }
    while (this.nextDistance < DISTANCES.length && runMetres >= DISTANCES[this.nextDistance]) {
      this.send('distance', `${DISTANCES[this.nextDistance]}m`, 'reached');
      this.nextDistance++;
    }
  }

  runStarted(): void {
    this.runs++;
    this.nextDistance = 0;
    this.send('run', runBucket(this.runs), 'start');
  }

  crashed(obstacle: string): void {
    this.send('death', obstacle, 'hit');
  }

  /** The run is over (game over shown): the run funnel's fail, and the game-over buttons are visible. */
  runEnded(): void {
    this.send('run', runBucket(this.runs), 'fail');
    this.send('gameover', 'play-again', 'visible');
    this.send('gameover', 'home', 'visible');
  }

  gameOverButton(which: 'play-again' | 'home'): void {
    this.send('gameover', which, 'interact');
  }

  menuShown(): void {
    this.send('button', 'shop', 'visible');
  }

  shopOpened(): void {
    this.send('button', 'shop', 'interact');
  }

  skinUnlocked(id: string): void {
    this.send('cosmetic', id, 'unlocked');
  }

  /** The in-game placement that leads to the rewarded break (the ad itself is tracked by the SDK). */
  reviveOffered(): void {
    this.send('rewarded', 'revive', 'visible');
  }

  reviveChosen(): void {
    this.send('rewarded', 'revive', 'interact');
  }

  reviveDeclined(timedOut: boolean): void {
    this.send('rewarded', 'revive', timedOut ? 'timeout' : 'skip');
  }

  private send(category: string, what: string, action: string): void {
    const clean = (s: string) => s.replace(/[/^]/g, '-');
    platform.measure(clean(category), clean(what), clean(action));
  }
}

/** Run number within the session: 1–5 one by one, then grouped. */
function runBucket(n: number): string {
  return n <= 5 ? String(n) : n <= 10 ? '6-10' : '11+';
}

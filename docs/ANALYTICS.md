# Analytics plan

What we want to learn from players on Poki, and exactly which events give us each answer.
Implemented in Phase 5 together with the Poki SDK. Sources: Poki developer docs (SDK overview,
Game Events, requirements), checked October 2026 — re-check them when integrating.

## Ground rules

- **Use Poki's own analytics only.** Poki blocks external requests by default; third-party
  analytics (GameAnalytics, Google Analytics, in-house servers) need Poki's prior written approval
  and a privacy statement. We don't need them: the dashboard plus Game Events covers our questions.
- **No personal data.** Events carry only game facts (distance bucket, obstacle type, …).
- Event values must be **stable across versions** and must not contain `/` or `^`.
- **Don't duplicate ad events** — ad breaks are tracked automatically by the ad calls.
- Gameplay code never calls the SDK directly: it calls `src/platform/` (see AGENTS.md), and the
  Poki adapter forwards to `PokiSDK.measure(category, what, action)`.

## What Poki tracks automatically

From the lifecycle calls we already have hooks for (`loadingFinished`, `gameplayStarted`,
`gameplayStopped` in `src/platform/Platform.ts`, mapped to `gameLoadingFinished`,
`gameplayStart`, `gameplayStop`):

| Question | Dashboard metric |
| --- | --- |
| How many people loaded the page vs actually played? | Playing users / conversion to play |
| How long does loading take? How long do people play? | Engagement: average time in game, time loading, time in ads |
| How much does it earn? | Earnings, impression types |
| Is anything crashing? | Error scanner (last 24 h) |
| Do players like it? | Player feedback (ratings, comments) |

So **"who loads and who plays"** comes for free once `gameLoadingFinished` and `gameplayStart`
are wired correctly (gameplay starts on Play; stops on pause, game over and Home).

## Custom Game Events

`measure(category, what, action)`. Special actions: `start` / `complete` / `fail` make a progress
funnel; `visible` / `interact` measure UI exposure vs use; any other action is a custom event,
reported as the percentage of gameplays that reached it.

### 1. Session playtime milestones — "who played more than 3 and 5 minutes"

Fired **once per page session** when total *active gameplay* time (not menus, pauses or ads)
crosses each threshold:

| Event | Answers |
| --- | --- |
| `measure('session', '1min', 'reached')` | % of players still playing after 1 minute |
| `measure('session', '3min', 'reached')` | **% who played 3+ minutes** |
| `measure('session', '5min', 'reached')` | **% who played 5+ minutes** |
| `measure('session', '10min', 'reached')` | % of very engaged players |
| `measure('session', '20min', 'reached')` | % of hooked players |

### 2. Runs per session — "do they come back for one more run?"

A funnel on the run number within the page session (each run starts, and ends in a fail):

`measure('run', '<n>', 'start')` and `measure('run', '<n>', 'fail')`, with `<n>` = `1`, `2`, `3`,
`4`, `5`, `6-10`, `11+`.

Drop-off between run 1 → 2 → 3 shows whether "Play Again" works. A big drop after run 1 means the
first run is too hard, too long or not fun.

### 3. Run depth

| Event | Answers |
| --- | --- |
| `measure('distance', '100m' / '250m' / '500m' / '1000m' / '2000m', 'reached')` | How far runs get; whether difficulty tiers (200 m, 800 m) cause a cliff |
| `measure('death', 'log' / 'rock' / 'crate', 'hit')` | Which obstacle kills most — tuning target |
| `measure('death', 'under30s', 'hit')` | Very short runs (first-time frustration) |

### 4. The twist — Duckling Parade

| Event | Answers |
| --- | --- |
| `measure('parade', 'first-duckling', 'rescued')` | Do players notice and pick up ducklings? |
| `measure('parade', '3', 'reached')`, `('parade', '6', 'reached')` | How many build a big parade |
| `measure('parade', 'duckling', 'lost')` (first loss per run) | Is the lag mechanic understood or frustrating? |
| `measure('crate', 'smash', 'first')` (once per session) | Do players discover dash-smashing? |

### 5. Onboarding and UI

| Event | Answers |
| --- | --- |
| `measure('tutorial', 'controls-hint', 'visible')` → first jump: `interact` | Do new players learn to jump? |
| `measure('tutorial', 'duckling-hint', 'visible')` → first rescue: `interact` | Is the duckling hint working? |
| `measure('gameover', 'play-again', 'interact')` / `measure('gameover', 'home', 'interact')` (with `visible` on the screen) | Restart vs leave |
| `measure('menu', 'sound-toggle', 'interact')` | How many mute (sound too loud or annoying?) |
| `measure('menu', 'pause', 'interact')` | Pausing a lot can mean the game is too fast |
| `measure('shop', 'skins', 'visible')`, `measure('shop', '<skin id>', 'unlock')` | Do players open the shop, and which skins do they save up for? |
| `measure('revive', 'offer', 'visible')` → `('revive', 'ad', 'interact')` / `('revive', 'offer', 'skip')` | How often the revive is taken (rewarded-ad uptake) |
| `measure('best', 'flag', 'passed')` | How often players beat their best distance |

### 6. Returning players (rough, on-device)

Poki's dashboard docs don't mention retention. A privacy-safe approximation uses only data the
game already stores on the device (best score, run count): once per session,
`measure('visit', 'first' / 'same-day' / '1-2-days' / '3-7-days' / '7+days', 'start')`, from the
time since the stored last visit. **Confirm with Poki** that this use of local storage is
acceptable before shipping it.

## How we'll use it

| Metric | Healthy sign | If it's bad, try |
| --- | --- | --- |
| Conversion to play | High | Faster load, clearer Play button |
| 3-min / 5-min reached | Rising across versions | Duck Rush, beat-your-best marker, missions |
| Run 1 → run 2 drop-off | Small | Easier first 30 s, instant restart, shorter death delay |
| Deaths by obstacle | Roughly even | Re-tune the one that dominates (size, timing window) |
| First duckling rescued | Most players | Make lost ducklings more visible, earlier hint |
| Mute rate | Low | Softer, less repetitive sounds |

## Implementation notes (Phase 5)

- Add `measure(category, what, action)` to the `Platform` interface; the local adapter logs to the
  console when `?debug` is on, the Poki adapter forwards to `PokiSDK.measure`.
- A small `Analytics` helper in gameplay code tracks active playtime (only while `playing`),
  milestone flags (so each fires once), and the run counter, and calls `platform.measure`.
- Test with the Poki Inspector's event log before going live.

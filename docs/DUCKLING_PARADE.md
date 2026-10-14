# Duckling Parade — the twist

**One line:** Rescue lost ducklings on the river. They follow you in a wobbly line and copy
your jumps a beat later. Every duckling multiplies the corn you earn, so don't lose them.

The mother duck is the existing duck sprite — only the ducklings need new art.

Status: **built** with a placeholder duckling (the duck sprite at 55% size, tinted lighter) until
the duckling art arrives. Tuning lives in `src/config.ts` (`ducklings`, `food.kinds`); the code is
`src/game/Parade.ts`.

Tested with an in-game bot: a full parade of 6 survives every difficulty tier when jumping slightly
early (0 losses up to 2,000 m); jumping 60 ms late loses tail ducklings at low speed without
killing the mother.

## How it plays

1. **Lost ducklings** float on the river, bobbing and peeping, with a soft glow ring so they read
   as "pick me up". Swim (or jump) into one and it joins the parade.
2. **The parade** follows behind you in a line, about 40 units apart, each one bobbing and
   squishing on its own. Up to **6** ducklings.
3. **They copy your jumps** — each one jumps a moment after the one in front. They don't dash.
4. **If an obstacle hits a duckling**, only that duckling is lost: it tumbles off with a sad peep
   and a splash, floats away behind, and the line closes the gap. The run continues.
5. **If you (the mother duck) crash**, the run ends as now and the parade scatters.
6. **Crates you smash** are gone for the whole parade — dashing through crates protects them.

The skill: with a long parade, **jump a little earlier** so the whole line clears the obstacle.
Late, barely-made jumps catch the tail.

## Fairness (why it's never unfair)

Each duckling copies the jump of the one in front of it, plus a fixed **18 ms** extra delay.
Compared with you, duckling #6 is 108 ms late in total.

The jump-timing windows we measured for the duck itself are 229–304 ms at the starting speed
and 419–462 ms at top speed. So even with a full parade of 6, there is always at least a
**121 ms** window where a single jump saves everyone, at any speed. A perfectly centred jump
is enough for 3–4 ducklings; for 5–6 you need to jump slightly early.

Ducklings use their own small hit circles and the same obstacles as you. Food is never placed
where a duckling would be forced into an obstacle.

## Scoring and UI (Cookie Run style)

- **Score per pickup:** corn kernel **50**, peas **100**, seed **150** (rarest), each
  × `(1 + ducklings)` — ×2 with one duckling, up to ×7 with six.
- **HUD:** the run score, big at the top centre; distance chip and a parade chip (`×N`) at the top
  left. The parade chip pops when a duckling joins, shakes red when one is lost, and hides with an
  empty parade. Each pickup shows a floating `+N` (yellow for seeds or big multipliers).
- **Game Over:** the score in big yellow numbers, rows Distance and Ducklings (biggest parade),
  and the Best Score badge.
- **Records (saved):** `bestScore` is the main record (menu + Game Over); `best` (distance) and
  `bestParade` are kept too.
- **Currency:** every run's score is added to `scoreBank` (shown on the menu with a star), to be
  spent on **duck skins** later (mallard, Pekin and khaki already exist in `assets-src/duck-variants-v1/`).
- **First time only:** a small hint when the first duckling appears: "Swim into ducklings — they
  follow you!"

## Where ducklings appear

- They are pattern entries, like food, placed only in **safe water** — at least 0.6 s before the
  next obstacle, so picking one up never forces a bad jump.
- First duckling after about **150 m**, then one every **300–500 m** while the parade is
  below 6. A little more often after you lose one, so a bad moment isn't the end of the parade.
- Late in a run (800 m+), some ducklings sit just after an obstacle, as a small reward for
  clearing it.

## Feel and feedback

- Join: bright "peep" (synth), sparkle, the duckling hops into line with a squash.
- Loss: sad descending "peep-peep", splash, the duckling spins and floats off backwards.
- Ducklings reuse the duck's squash-and-stretch springs, scaled down and a bit bouncier.
- When you dash, the line stretches out behind you and springs back together.

## Art needed (Codex)

Same style as `assets-src/duck-sheet.png` (navy outline, flat shading, faces right), smaller and
cuter: bigger head-to-body ratio, tiny beak, fluffier tuft on the head.

| File (in `assets-src/ducklings-v1/`) | Content |
| --- | --- |
| `duckling-strip.png` | One row of frames on a transparent (or white) background, same layout rules as the duck strip: **swim ×4** (paddling), **jump ×2** (wings up / wings down), **hurt ×2** (spinning, dizzy eyes). Duckling about 55% of the duck's size. |
| `duckling-lost.png` | A single "lost" pose: looking around or peeping with its beak open, for the pickup on the river. |
| `duckling-icon.png` | Small head-and-shoulders icon for the HUD chip (square, about 96×96). |

Optional: a short peep sound and a sad peep sound (`peep.mp3`, `peep-sad.mp3`), otherwise I
synthesise them.

## Build plan

1. Duckling logic with a placeholder (the duck sprite scaled down and tinted lighter), so we can
   play and tune before the art arrives.
2. Spawning in patterns, multiplier, HUD chip, Game Over row, saved best parade.
3. Sounds and effects; first-time hint.
4. Swap in Codex's duckling art.
5. Bot test: confirm a well-timed jump saves a full parade at every difficulty tier.

## Open questions (current defaults)

- Max parade **6** — more stops fitting on portrait phones.
- Multiplier **×(1 + ducklings)** — or gentler, e.g. +0.5 per duckling?
- Should ducklings also collect food they swim through? Default: **no**, keeps it readable.

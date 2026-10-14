# UI and HUD spec

Source of truth for menus, HUD and game-over screens. Visual reference:
[reference/ui-reference.png](reference/ui-reference.png) (desktop 16:9 on the left, mobile 9:16
on the right). Match its layout and feel; exact pixels may vary.

The UI is a **DOM overlay** on top of the Phaser canvas (`index.html`, `src/style.css`,
`src/ui/UI.ts`). Sizes below are CSS px at a 1280×720 desktop viewport; mobile values are for a
390×844 portrait viewport. Everything sits inside the safe area (`env(safe-area-inset-*)`) with a
16 px gutter.

## Design tokens

Colours sampled from the reference; replace the current `:root` values in `style.css`.

| Token | Value | Use |
| --- | --- | --- |
| `--ink` | `#13266A` | Outlines, text on yellow, icons on light buttons |
| `--yellow` | `#FFD93F` | Primary buttons, "DUCK" logo fill |
| `--white` | `#FFFFFF` | Titles, HUD text, icons on navy |
| `--navy-btn` | `#265184` | Pause and sound buttons |
| `--chip` | `rgba(30, 70, 125, 0.78)` | HUD chips |
| `--card` | `rgba(226, 242, 252, 0.9)` | Game-over stats card |
| `--secondary` | `#99B4D1` | Home button fill |
| `--overlay` | `rgba(23, 62, 110, 0.55)` + `backdrop-filter: blur(3px)` | Game-over / pause dim |
| `--star` | `#FFE45C` | Star and crown icons |

**Fluid sizing.** Sizes are CSS variables on `:root` (`--hud-h`, `--btn-h`, `--modal-w`, `--title`, …)
defined with `clamp(min, N vmin, max)`, so the HUD and the pause/game-over cards scale with the
screen's smaller side. Desktop/tablet hit the max (the sizes listed below); phones scale down — the
cards are ~78% of a portrait phone's width with ~40 px buttons. Use these variables instead of fixed
pixel sizes or per-device breakpoints. The in-game pause button is exactly `--hud-h` square, the
same height as the distance chip.

**Type.** Chunky rounded sans. Fredoka 600/700 is already bundled and is close; headings in the
reference are heavier, so `Lilita One` (OFL, available as `@fontsource/lilita-one`) is an option
for titles and big numbers only. Large text on top of the scene is white with a navy stroke
(`-webkit-text-stroke` + `paint-order: stroke fill`) and a small navy drop shadow.

**Numbers** use thousands separators: `1,286 m` (`Intl.NumberFormat('en-US')`). Use
`font-variant-numeric: tabular-nums` in the HUD so values don't jitter.

## Shared components

**Primary button.** Yellow pill, 4 px `--ink` border, 6 px solid `--ink` bottom shadow. Content
is either the ▶ icon (menu) or a text label (`Play Again`, `Resume`, 26 px, weight 700, `--ink`).
States: hover (desktop) lifts 2 px and scales 1.03; active presses down 5 px and the shadow
shrinks to 1 px. Minimum touch target 48×48.

**Secondary button.** Rounded rectangle (radius 18), `--secondary` fill, 3 px `--ink` border,
same shadow and press behaviour, holding an icon (home).

**Icon button.** 52×52, `--navy-btn` fill, white icon, 2 px darker border. The pause button is a
rounded square (radius 12); the sound button is a circle. Mobile: 46×46.

**Best Distance badge.** Crown icon (36 px) to the left of two lines: a "Best Distance" label
(16 px, weight 600, white with a 3 px `--ink` stroke) over the value (`1,286 m`, 28 px, weight
700, same stroke). Used on the main menu and the game-over screen.

**HUD chip.** `--chip` fill, radius 10, padding 6×14, no border, min-width 104, white text 26 px
weight 700. An optional 28 px icon on the left.

**Icons.** Phosphor Icons, "fill" weight (MIT, `@phosphor-icons/core`): play, pause, replay,
home, sound on/off, crown, star. `src/ui/icons.ts` imports only the icons used and injects them as
an SVG sprite; markup uses `<svg class="icon"><use href="#i-name" /></svg>` and colours them with
CSS `color`. The crown gets its navy outline from stacked `drop-shadow` filters. Add new icons the
same way rather than hand-drawing SVG.

## Screens

### Main menu

The live scene runs behind the menu: the duck swims and the world scrolls slowly with no
obstacles. There is no dim overlay.

| Element | Desktop | Mobile (portrait) |
| --- | --- | --- |
| Menu stack (logo, Play, badge) | Centred on screen, horizontally and vertically | Same. On tall screens the camera keeps the water line ≈75% down (`CONFIG.view.minWaterFraction`), so the centred stack never covers the duck |
| Logo (image) | Width ≈ 30% of viewport (max 440 px) | Width ≈ 72% |
| Play button (▶) | Centred below the logo, 190×66 | 52% width, 60 tall |
| Best Distance badge | Centred under Play | Centred under Play |
| Sound toggle | Top-right corner | Top-right corner |
| Controls hint | Small, low-contrast text at the bottom; first visit only | Swipe hint at the bottom; first visit only |

Logo: "WOBBLY" in white over "DUCK" in yellow, heavy navy outline, slight arch and tilt, water
splash droplets either side. It is an image asset (`logo.png`), not CSS text.

### Gameplay HUD

| Element | Position | Content |
| --- | --- | --- |
| ~~Food chip~~ | — | Removed: corn is a currency, shown on the main menu (corn bank) and on Game Over (`Corn +45`) |
| Distance chip | Top-left, below the star chip (gap 6) | `512 m` |
| Pause button | Top-right | Pause bars |

- The HUD stays minimal: nothing else on screen, and no sound toggle during play (it lives on the menu and pause screens).
- On food pickup the food chip pops: scale 1 → 1.2 → 1 over 180 ms.
- Distance updates once per whole metre (already the case).
- Mobile: chips at 85% size.

### Pause (not in the reference — derived)

Same overlay and layout language as game over: a "Paused" title, then a row of Home (secondary)
and Resume (primary), plus the sound toggle top-right. Esc / P / Enter resumes. If the tab is
hidden during play, the game auto-pauses (already implemented).

### Game over

| Element | Desktop | Mobile |
| --- | --- | --- |
| Dim overlay | Full screen `--overlay` with blur | Same |
| Title | "Game Over", 64 px white, navy stroke 6 px, centred near the top | 44 px |
| Stats card | `--card`, radius 14, ~330×84, rows `Distance … 742 m` (flag icon) and `Food … 28` (corn-kernel image) (labels left, 22 px weight 500; values right, 24 px weight 700; `--ink`) | Full width minus 48 px |
| Best Distance badge | Centred under the card | Same |
| New best | Not in the reference. Show a small "New best!" ribbon on the badge with a sparkle when beaten | Same |
| Buttons | Row: Home (84×56 secondary) + Play Again (200×56 primary), centred | Same, Play Again flexes wider |

On mobile the whole block sits inside a translucent navy panel (`rgba(40, 80, 130, 0.55)`,
radius 20) — see the reference.

Enter = Play Again (after a 0.35 s lockout, already implemented). Home returns to the main menu.

## Behaviour

- Show screens via `UI.show(screen)`; screens are `hidden`-toggled sections in `index.html`.
- Buttons stop pointer propagation so taps are never read as swipes (already implemented).
- The overlay root has `pointer-events: none`; only buttons and cards take pointer events, so
  swipes on empty space reach the canvas.
- Sound toggle: persists `muted` via `src/core/Storage.ts`; its icon reflects state; audio starts
  only after the first user interaction.
- Transitions: screens fade in over 150 ms; the game-over card rises 12 px while fading in. No
  transitions longer than 250 ms — restarting must feel instant.
- Accessibility: buttons have `aria-label`s; text never drops below 14 px; contrast of white on
  `--chip` is AA at HUD sizes.

## Current implementation vs reference

| Element | Reference | Now | When |
| --- | --- | --- | --- |
| Logo | Image, WOBBLY white / DUCK yellow, splashes | CSS text in the same colours, no splashes | Phase 4 (needs `logo.png`) |
| Play button | Yellow pill with ▶ | Done | — |
| Best Distance badge | Crown + label + value | Done (SVG crown) | — |
| Sound toggle | Top-right navy circle | Done — menu and pause screens; saved as `muted` | — |
| Corn (stars in the mockup) | Star chip + Stars row | No HUD chip; Game Over `Corn +N`; menu corn bank pill under Best Distance | — |
| Distance chip | Navy translucent chip | Done | — |
| Pause button | Navy rounded square | Done | — |
| Pause screen | (derived) | Done — Home + Resume | — |
| Game over | Title, stats card, badge, Home + Play Again | Done (Distance + Food rows) | — |
| New best | (derived) | Done — orange ribbon beside the badge | — |
| Number format | `1,286 m` | Done | — |
| Controls hint | First visit only | Done — hidden after the first run (`runs` in storage) | — |

## Open questions

- **Duck position on the portrait menu.** The reference centres the duck on the mobile menu;
  gameplay keeps it at 27% of the width. Either accept the difference or ease the camera between
  the menu and gameplay framing.
- **Title font.** Keep Fredoka, or add Lilita One for headings (+~20 KB)?

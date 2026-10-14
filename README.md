# Wobbly Duck

A cute physics-flavoured endless runner for desktop and mobile browsers. Built with Phaser 3, TypeScript and Vite.

## Run

```bash
npm install
npm run dev        # http://localhost:5173  (also printed as a LAN URL for phone testing)
npm run build      # production build → dist/
npm run preview    # serve the production build
```

Add `?debug` to the URL to draw the collision shapes and expose the scene as `window.__scene`.

## Controls

| Action  | Desktop                | Touch          |
| ------- | ---------------------- | -------------- |
| Jump    | Space / W / ↑          | Swipe up       |
| Dash    | D / →                  | Swipe right    |
| Start   | Enter (or a jump key)  | Play button    |
| Restart | Enter                  | Play again     |
| Pause   | Esc / P                | Pause button   |

## Docs

| Doc | For |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Architecture rules, file layout, gotchas, phase status — read first (Claude Code loads it via `CLAUDE.md`) |
| [docs/UI_SPEC.md](docs/UI_SPEC.md) | Menus, HUD and game-over spec from the [UI reference](docs/reference/ui-reference.png) |
| [docs/ASSET_SPEC.md](docs/ASSET_SPEC.md) | Art and audio: style guide, sizes, pivots, what's still needed |
| [docs/ASSET_LOG.md](docs/ASSET_LOG.md) | Source and licence of every shipped asset |

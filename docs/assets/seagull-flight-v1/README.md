# Seagull flight animation v1

Built-in image generation, using `assets-src/seagull-swoop-v1/seagull.png` as the identity
and style reference. Exact prompts: [prompt.txt](prompt.txt) and [cleanup-prompt.txt](cleanup-prompt.txt).

## Files

- `assets-src/seagull-flight-v1/seagull-flight-sheet.png`: transparent 1536 x 256 PNG,
  six 256 x 256 cells in a single row, ordered left to right.
- `assets-src/seagull-flight-v1/seagull-flight-sheet.json`: frame size, sequence count,
  suggested frame rate and eye anchor.
- `assets-src/seagull-flight-v1/seagull-flight-source.png`: original generated 3 x 2 layout.

Frames: high wings, half raised, level, down, half down, raised recovery. Start with
frames 0 through 5 at 10 fps, looping. The bird faces left in every frame. All six eyes
are aligned at (62, 145) in each cell using one uniform scale; wing motion does not
change the collider. [preview.html](preview.html) plays the loop with a speed control.

Packing is reproducible:

```powershell
python tools/pack-seagull-flight.py assets-src/seagull-flight-v1/seagull-flight-source.png assets-src/seagull-flight-v1/seagull-flight-sheet.png
```

The script only crops transparent padding, scales and translates generated poses.
It does not redraw the bird. The sheet was visually inspected and dimensions, alpha,
frame count and clipping were checked. Typecheck and production build pass.

Unused art deliverable: no runtime code or active assets changed. On integration,
export a WebP preserving all six cells through the image optimiser and load with
Phaser frameWidth/frameHeight both 256. Keep the shadow and preceding warning separate.

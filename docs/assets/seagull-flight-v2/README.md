# Seagull flight v2 - both wings

Corrected with the built-in image tool using the v1 generated source as an edit target.
Exact correction instructions: [prompt.txt](prompt.txt).

The small far wing now follows the main wing: level in frame 2, pointing below the belly
in frames 3 and 4, and raised again in frame 5. The erroneous raised wing behind the head
has been removed from both downstroke frames. The original v1 remains available.

- Sheet: `assets-src/seagull-flight-v2/seagull-flight-sheet.png`, transparent 1536 x 256.
- Six equal 256 x 256 cells, left to right; suggested playback 10 fps, looping.
- All eyes aligned at (62, 145); one uniform scale across all poses.
- Original 3 x 2 generated source and adjacent sheet JSON metadata retained.
- [Animated preview](preview.html) includes playback and speed controls.

Packed with `tools/pack-seagull-flight.py`. The source and final sheet were visually
checked, specifically the far-wing silhouettes in level and downstroke frames.
Packing checks prevent clipped cells. Typecheck and production build pass.

Unused art deliverable; no runtime assets or gameplay code changed. Keep collision
bounds independent of animation and the shadow/warning as separate effects.

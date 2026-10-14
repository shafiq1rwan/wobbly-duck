/**
 * All gameplay tuning lives here. Units are "world units" — 1 unit ≈ 1 px at the
 * 1280×720 reference resolution. Times are in seconds, speeds in units/second.
 */
export const CONFIG = {
  view: {
    /** Logical reference resolution. */
    refWidth: 1280,
    /** Visible gameplay height in world units — lower zooms in (bigger duck, less empty sky). */
    refHeight: 660,
    /** On narrow/portrait screens we zoom out so at least this much world width is visible. */
    minViewWidth: 900,
    /**
     * Duck's horizontal position as a fraction of the visible width: further right on wide screens
     * (room for the duckling parade), further left on narrow ones (enough look-ahead at top speed).
     */
    duckScreenXNarrow: 0.27,
    duckScreenXWide: 0.33,
    /** View widths (world units) between which the duck position blends from narrow to wide. */
    narrowViewWidth: 900,
    wideViewWidth: 1150,
    /**
     * On tall screens, the water below the surface fills at least this fraction of the view, so the
     * water line sits low (≈75% down) and the centred menu stays clear of the duck.
     */
    minWaterFraction: 0.25,
    /** Render-resolution caps (performance). */
    maxPixelRatio: 2,
    maxRenderPixels: 2560 * 1440,
  },

  world: {
    /** Starting scroll speed; ramps linearly to `maxSpeed` over `speedRampMetres` of a run. */
    baseSpeed: 440,
    maxSpeed: 700,
    speedRampMetres: 1400,
    /** Slow scroll used behind the main menu. */
    menuSpeed: 180,
    /** Speed decay after a crash (units/s²). */
    crashDecel: 900,
    /** World units per displayed metre. */
    unitsPerMetre: 50,
  },

  water: {
    /** Resting water line (world y). Sky is above, water below. */
    restY: 470,
    /** Sum-of-sines surface. Keep amplitudes small so obstacles stay readable. */
    waves: [
      { amplitude: 5.0, wavelength: 540, speed: 1.1 },
      { amplitude: 2.6, wavelength: 230, speed: -1.7 },
      { amplitude: 1.2, wavelength: 96, speed: 2.6 },
    ],
    /** Horizontal sampling step for rendering the surface. */
    renderStep: 14,
    /** Opaque ocean body, drawn behind the duck and obstacles. */
    oceanColor: 0x1cc3f4,
    deepColor: 0x12ade6,
    /** Translucent tint drawn in front, over the submerged half of the duck/obstacles. */
    color: 0x43bdf0,
    alpha: 0.28,
    highlightColor: 0xddf8ff,
    highlightThickness: 6,

    /**
     * Local ripples: a row of spring columns anchored to the world (they scroll with it), added on
     * top of the sine waves. Kept small and quickly damped so obstacles stay readable.
     */
    ripples: {
      spacing: 12,
      columns: 384,
      /** Pull back to flat, wave travel between neighbours, and energy loss. */
      stiffness: 28,
      spread: 900,
      damping: 3.2,
      maxHeight: 16,
    },
  },

  /** Water reactions. Impulses are column velocities (units/s, + = push the surface down). */
  splash: {
    swimRippleInterval: 0.32,
    swimRipple: 26,
    takeoffRipple: 90,
    takeoffDrops: 7,
    landingRipple: 0.32, // × landing speed
    landingDrops: 16,
    dashRipple: 60,
    dashDropsPerSecond: 70,
    speedLinesPerSecond: 40,
    dropGravity: 1500,
    poolSize: 180,
    dropColors: [0xffffff, 0xd8f6ff, 0xa9e8ff],
  },

  audio: {
    masterVolume: 0.7,
  },

  /**
   * Subtle camera shake ("trauma" model): events add trauma (0..1), which decays over time; the
   * offset is maxOffset × trauma², so small events stay tiny and only big ones are noticeable.
   * Disabled automatically when the player prefers reduced motion.
   */
  camera: {
    shake: {
      enabled: true,
      maxOffset: 12,
      decay: 2.6, // trauma lost per second
      frequency: 22, // Hz — fast, small jitter
      landing: 0.4, // × landing strength
      dash: 0.35,
      crash: 0.7,
      crate: 0.4, // Phase 3
    },
  },

  background: {
    /** Vertical sky gradient from the top of the gameplay band down to the water line. */
    skyTop: 0x3ac3fd,
    skyHorizon: 0xbdebfd,
    /** Light horizon-coloured haze over the scenery so obstacles always stand out against it. */
    hazeAlpha: 0.3,
    /**
     * Parallax scenery, back to front. Files are pre-cropped WebPs whose bottom row is the art's
     * baseline (built from assets-src/ by tools/optimize-images.py).
     * `height` is the drawn height in world units, `gap` the empty space between repeats, and the
     * bottom sits `sink` units below the water line. Keep scenery small and sparse so it never
     * competes with obstacles. `lake` is the same layer in the lake biome (loaded after boot).
     */
    layers: [
      // High, sparse clouds fill the upper sky (`baseline` = world y of the layer's bottom edge).
      { key: 'bg-clouds', file: 'bg-clouds.webp', height: 95, gap: 640, baseline: 230, alpha: 0.75, parallax: 0.012,
        lake: { key: 'bg-lake-clouds', file: 'bg-lake-clouds.webp', height: 103 } },
      { key: 'bg-clouds', file: 'bg-clouds.webp', height: 200, gap: 120, sink: 8, parallax: 0.025,
        lake: { key: 'bg-lake-clouds', file: 'bg-lake-clouds.webp', height: 216 } },
      { key: 'bg-rocks', file: 'bg-rocks.webp', height: 165, gap: 150, sink: 8, parallax: 0.06,
        lake: { key: 'bg-lake-mountains', file: 'bg-lake-mountains.webp', height: 190 } },
      { key: 'bg-palms', file: 'bg-palms.webp', height: 270, gap: 220, sink: 8, parallax: 0.12,
        lake: { key: 'bg-lake-pines', file: 'bg-lake-pines.webp', height: 280 } },
    ],
  },

  /**
   * Lake biome. Every run starts on the tropical sea; from `fromMetres` the lake scenery scrolls in
   * from the right (each parallax layer at its own pace) while the sky and water colours blend from
   * the tropical palette to these over `blendMetres`.
   */
  lake: {
    fromMetres: 450,
    blendMetres: 150,
    sky: { top: 0x67cdf2, horizon: 0xe0f7f4 },
    water: { oceanColor: 0x2ec4c6, deepColor: 0x1aa6b4, color: 0x4cc9c8, highlightColor: 0xdafcf2 },
  },

  duck: {
    /** Collision circle — deliberately a bit smaller than the art (forgiving). Never scaled by squash/stretch. */
    colliderRadius: 26,
    colliderOffsetX: 4,
    colliderOffsetY: 2,
    /** Distance from the duck's pivot down to the water line while floating. */
    floatOffset: 14,

    buoyancy: {
      stiffness: 140,
      damping: 11,
      /** Max distance the spring may pull the duck away from its float target. */
      maxDisplacement: 22,
      /** Extra gentle bob on top of the waves. */
      bobAmplitude: 2.5,
      bobFrequency: 1.6, // Hz
      /** Fraction of downward velocity kept when landing (feeds the spring). */
      landingVelocityKeep: 0.28,
    },

    jump: {
      velocity: 1060,
      gravity: 2700,
      /** Gravity multiplier while falling — snappier arcs. */
      fallMultiplier: 1.25,
      /** Gravity multiplier near the apex — brief floaty hang. */
      apexMultiplier: 0.6,
      apexThreshold: 140,
      maxFallSpeed: 1500,
      /** Hard cap on height above the rest water line (double jumps and lily-pad bounces go high). */
      maxHeight: 390,
      /** Second jump in mid-air: strength relative to the first. */
      doubleJumpFactor: 0.85,
      /** Jump input is remembered this long (s). */
      bufferTime: 0.1,
      /** While falling, a jump is allowed this close above the float line. */
      surfaceForgiveness: 30,
    },

    dash: {
      duration: 0.2,
      /** Measured from dash start. */
      cooldown: 0.7,
      /** Extra world scroll speed during the dash (eased out). */
      speedBoost: 950,
      /** How far the duck nudges forward on screen. */
      forwardOffset: 46,
      /** Rate at which the forward nudge returns to 0 (1/s). */
      offsetReturnRate: 4,
      /** Cooldown meter above the duck: shown while recharging, pops when ready. */
      meter: {
        offsetX: -4,
        offsetY: -66,
        width: 46,
        height: 8,
        readyPop: 0.3, // s
      },
    },

    rotation: {
      /** How strongly the duck tilts with the wave slope while swimming. */
      slopeFactor: 1.4,
      /** Tilt per unit of vertical speed while airborne. */
      airFactor: 0.00018,
      max: 0.32,
      /** Exponential smoothing rate (1/s). */
      smoothing: 12,
    },

    hurt: {
      popVelocity: 620,
      spin: 7,
    },

    /**
     * Visual squash & stretch (DuckView only — never touches the collider). `stretch` > 0 is taller
     * and thinner, < 0 is squashed and wider; area is preserved. Springs are set by frequency and
     * damping ratio: lower damping = more wobbles before settling.
     */
    jiggle: {
      /** Main deformation spring (also the "recovery speed"). */
      wobbleFrequency: 3.4, // Hz
      wobbleDamping: 0.26, // ≈ 2–3 visible oscillations after an impact
      maxStretch: 0.3,
      maxSquash: 0.26,
      /** Instant squash on takeoff, then this upward kick into a stretch. */
      jumpSquash: 0.2,
      jumpKick: 7,
      /** Stretch while rising (at full jump speed) and while falling (at max fall speed). */
      riseStretch: 0.16,
      fallStretch: 0.07,
      /** Landing squash kick at full landing speed. */
      landingImpact: 6.5,
      /** Wide, flat shape while dashing, with a forward lean. */
      dashStretch: -0.14,
      dashKick: 3.5,
      dashLean: 0.1,
      /** Gentle idle wobble while swimming. */
      swimWobble: 0.025,
      swimWobbleFrequency: 1.6, // Hz
      /** Extra tilt spring layered on the controller's rotation (radians). */
      tiltFrequency: 2.6,
      tiltDamping: 0.3,
      tiltLandingKick: 1.6,
      tiltMax: 0.3,
      /** Hurt: squash + tilt kick + short shake. */
      hurtKick: 7,
      hurtShake: 5,
      hurtShakeTime: 0.3,
      /** Squash pivot below the duck's centre (≈ its waterline), so it compresses into the water. */
      anchorY: 20,
    },
  },

  obstacles: {
    spawnMargin: 140,
    despawnMargin: 240,
    poolSize: 16,
    /** After a dash ends, crates still smash for this long (forgiving timing). */
    smashGrace: 0.1,
    /**
     * Per type: pre-optimised WebP, display scale (world units per source px), origin = the point
     * placed at `floatOffset` from the water surface, how much it follows the waves (0..1), tilt with
     * the wave slope, and a forgiving hit box (half sizes) relative to that point.
     */
    types: {
      log: {
        key: 'obstacle-log',
        file: 'obstacle-log-v3.webp',
        scale: 0.645, // ≈160×57 units (the art's body is 248×89 px) — chubby, about 40% above water
        originX: 0.5,
        originY: 0.5,
        floatOffset: 10,
        top: 19, // visual top above the water line
        waveFollow: 1,
        tilt: 1,
        // Top edge ≈10 above the water line, the same as the old thin log, so jump timing is unchanged.
        hit: { halfW: 70, halfH: 20, offsetY: 0 },
        breakable: false,
      },
      crate: {
        key: 'obstacle-crate',
        file: 'obstacle-box-v3.webp',
        scale: 0.722, // flat square face ≈104×104 units (144 px in the art), about a third under water
        originX: 0.5,
        originY: 0.5,
        floatOffset: -18,
        top: 70,
        waveFollow: 1,
        tilt: 0.5,
        hit: { halfW: 47, halfH: 47, offsetY: 0 }, // top ≈65 above water, as before
        breakable: true,
      },
      /**
       * Two crates stacked: too tall for a single jump, cleared by a double jump or smashed by a dash.
       * The texture is built at runtime from the crate (`stack`). It floats higher than a single
       * crate and bobs less, so a single jump can't clear it even from a wave crest (checked with the
       * real jump physics and in-game bots), while a double jump clears it with ~0.5 s to spare.
       */
      crateStack: {
        key: 'obstacle-crate-stack',
        file: 'obstacle-box-v3.webp',
        stack: { of: 'crate', count: 2 },
        scale: 0.722,
        originX: 0.5,
        originY: 0.5, // replaced by the built texture's bottom-crate centre
        floatOffset: -44, // bottom crate's centre, 44 above the water (it sits on the surface)
        top: 200,
        waveFollow: 0.4,
        tilt: 0.25,
        hit: { halfW: 47, halfH: 100, offsetY: -53 }, // top ≈197 above water
        breakable: true,
      },
      rock: {
        key: 'obstacle-rock',
        file: 'obstacle-rock-v2.webp',
        scale: 0.634, // ≈130 units wide, ≈62 above the water line
        originX: 0.5,
        originY: 136 / 192, // the art's waterline
        floatOffset: 0,
        top: 62,
        waveFollow: 0.15,
        tilt: 0,
        hit: { halfW: 48, halfH: 27, offsetY: -27 }, // narrower than the base: the top is rounded
        breakable: false,
      },
    },
    /** Small ripples lapping around rocks. */
    rockRippleInterval: 0.55,
    rockRipple: 16,
  },

  /** Collectibles. Heights are measured as the duck's centre above its swimming position. */
  food: {
    poolSize: 90,
    /**
     * Corn-kernel collectibles (assets-src/kernels-v1). Points are per pickup, before the parade
     * multiplier (× 1 + ducklings); `sparkle` colours the pickup effect.
     */
    kinds: {
      yellow: { key: 'kernel-yellow', file: 'kernel-yellow.webp', scale: 0.5, points: 50, sparkle: [0xffffff, 0xffe45c, 0xffcf3a] },
      orange: { key: 'kernel-orange', file: 'kernel-orange.webp', scale: 0.5, points: 75, sparkle: [0xffffff, 0xffc04a, 0xff9a2e] },
      honey: { key: 'kernel-honey', file: 'kernel-honey.webp', scale: 0.52, points: 100, sparkle: [0xffffff, 0xffd36b, 0xe89a1e] },
      pink: { key: 'kernel-pink', file: 'kernel-pink.webp', scale: 0.52, points: 150, sparkle: [0xffffff, 0xffb3c8, 0xff6f96] },
      purple: { key: 'kernel-purple', file: 'kernel-purple.webp', scale: 0.55, points: 200, sparkle: [0xffffff, 0xd6b3ff, 0xffe45c] },
      ice: { key: 'kernel-ice', file: 'kernel-ice.webp', scale: 0.55, points: 250, sparkle: [0xffffff, 0xbfeaff, 0x7cc8ff] },
      rainbow: { key: 'kernel-rainbow', file: 'kernel-rainbow.webp', scale: 0.58, points: 500, sparkle: [0xff8a8a, 0xffe45c, 0x7cd67c, 0x7cc8ff] },
      crown: { key: 'kernel-crown', file: 'kernel-crown.webp', scale: 0.62, points: 1000, sparkle: [0xffffff, 0xffe45c, 0xff5a5a] },
    },
    /**
     * Patterns ask for a role; the actual kernel is picked by weight. Trails use `common`, jump arcs
     * `mid`, the best spots (arc tops, crowns, crate lids) `rare`.
     */
    roles: {
      common: { yellow: 80, orange: 20 },
      mid: { honey: 50, pink: 50 },
      rare: { purple: 40, ice: 40, rainbow: 17, crown: 3 },
    },
    /** Pickups worth at least this many base points get the bigger sparkle and chime. */
    bonusPoints: 200,
    /** Added to the duck's collider radius. Generous: missing food should feel like a choice. */
    pickupRadius: 24,
    /** Food on the water floats this high (duck-centre units) — a small gap above the surface. */
    lowHeight: 20,
    /** Gap between an obstacle's top and food resting on it. */
    onTopGap: 6,
    bobAmplitude: 4,
    bobFrequency: 1.3,
    pulseAmplitude: 0.055,
    pulseFrequency: 0.8,
    pickup: {
      duration: 0.26,
      popAmount: 0.28,
      rise: 28,
      shrink: 0.55,
      sparkCount: 7,
      bonusSparkCount: 12,
      ringDuration: 0.24,
      ringStartRadius: 6,
      ringEndRadius: 26,
      bonusRingEndRadius: 38,
      ringWidth: 2.5,
    },
  },

  /** Lily pads: swimming onto one launches the duck (and each duckling) high into the air. */
  lilyPads: {
    key: 'lily-pads',
    file: 'lily-pads.webp',
    frameWidth: 256,
    frameHeight: 160,
    variants: 4,
    /** World units per sheet pixel (≈116 units wide). */
    scale: 0.47,
    /**
     * The sprite's origin is its bottom edge. `topOffset` = pad top above that edge (≈56 units);
     * `sink` = how far the bottom edge sits below the water line (so the top is ~16 above it).
     */
    topOffset: 56,
    sink: 40,
    /** Bounce trigger: half width around the pad centre, and how far above it a falling duck still counts. */
    halfW: 48,
    catchHeight: 40,
    bounceVelocity: 1350,
    /** Chance a pad has a frog sitting on it. */
    frogChance: 0.5,
    /** The frog leaps off when the duck is this close (world units). */
    frogScatterDistance: 260,
    poolSize: 4,
  },

  /** Scenery frogs (not obstacles). */
  frog: {
    key: 'frog-hop',
    file: 'frog-hop.webp',
    frameSize: 192,
    scale: 0.36,
    /** Sprite centre above the pad top when sitting (frame 0's feet rest on the pad). */
    sitOffset: 16,
    /** Leap off the pad into the water: forward distance, peak height and duration. */
    leapDistance: 150,
    leapHeight: 95,
    leapTime: 0.55,
  },

  /**
   * Duckling Parade (docs/DUCKLING_PARADE.md): lost ducklings join a line behind the duck, copy its
   * jumps along the same path plus `extraLag` per place in line, and multiply food score ×(1 + count).
   */
  ducklings: {
    max: 6,
    /** Size relative to the duck (sprite and physics). */
    size: 0.68,
    /** Placeholder colouring until the duckling art arrives. */
    tint: 0xfff3b0,
    /**
     * Centre-to-centre distances. The first duckling sits clear of the mother's tail (her back edge
     * is ~57 units behind her centre, a duckling's beak ~37 ahead of its centre). Between ducklings
     * the gap shrinks on narrow screens so a full parade stays on screen.
     */
    firstGap: 90,
    spacing: 62,
    minSpacing: 40,
    /** Extra jump delay per place in line (s). 6 × 18 ms still leaves a ≥ 121 ms window for everyone. */
    extraLag: 0.018,
    /** How quickly followers slide into their slot (1/s). */
    follow: 6,
    /** Added to the duck's collider radius when picking up a lost duckling. */
    pickupRadius: 12,
    /** Spawning: first one at this distance, then every `every` metres while the parade isn't full. */
    firstAtMetres: 80,
    everyMin: 220,
    everyMax: 380,
    /** After losing one, the next lost duckling comes sooner. */
    afterLossMetres: 150,
    /** A knocked-off duckling tumbles away for this long. */
    leaveTime: 1.6,
  },

  /** Endless pattern spawning (see src/game/Patterns.ts). Gaps are seconds of travel between patterns. */
  spawner: {
    firstPatternDistance: 700,
    tiers: [
      { fromMetres: 0, gapMin: 0.9, gapMax: 1.5 },
      { fromMetres: 200, gapMin: 0.8, gapMax: 1.3 },
      { fromMetres: 800, gapMin: 0.7, gapMax: 1.1 },
    ],
    /**
     * Fairness, enforced across patterns whatever the gaps: obstacles you must jump are at least this
     * many seconds apart, more after a crate (dashing through one skips you ahead).
     */
    minObstacleGap: 1.3,
    afterCrateGap: 1.55,
    /** After a lily pad the duck is in the air for ~1.1 s and lands far ahead: keep that water clear. */
    afterPadGap: 1.7,
    /**
     * Crate stacks: the double jump takes off 0.45–1 s before one and lands up to ~0.9 s after it,
     * so leave room on both sides.
     */
    beforeStackGap: 1.6,
    afterStackGap: 1.7,
    /** Corn trail filling open water (Cookie Run style), kept clear of obstacles and ducklings. */
    trail: { step: 0.13, clearance: 0.3, peasChance: 0.08 },
  },

  /**
   * Duck skins, bought with the score bank (every run's score added up). Each file is a duck sheet
   * with the same layout as duck-sheet.webp (see src/art/duckSprite.ts). The first skin is free.
   * Order here is the shop order. A typical 30–60 s run scores ~15k–35k. `colors` is the skin's
   * palette, used for its unlock confetti.
   */
  skins: [
    { id: 'classic', name: 'Classic', file: 'duck-sheet.webp', price: 0, colors: [0xffd93f, 0xff994a, 0xfff3b0] },
    { id: 'pekin', name: 'Pekin', file: 'duck-pekin.webp', price: 15_000, colors: [0xffffff, 0xf3ead8, 0xff8a3d, 0xd9dde6] },
    { id: 'khaki', name: 'Khaki', file: 'duck-khaki.webp', price: 40_000, colors: [0xc98b55, 0x7a4a2e, 0xf2dcb5, 0xff8a3d] },
    { id: 'tufted', name: 'Tufted', file: 'duck-tufted.webp', price: 70_000, colors: [0x575d78, 0xffffff, 0xbfc3d0, 0xff8a3d] },
    { id: 'wigeon', name: 'Wigeon', file: 'duck-wigeon.webp', price: 100_000, colors: [0xb5653f, 0xf6e7c8, 0x9aa3b5, 0xe3a1a0] },
    { id: 'mallard', name: 'Mallard', file: 'duck-mallard.webp', price: 150_000, colors: [0x1f7a4a, 0x8a3b24, 0xd0d0d0, 0xfff3d6] },
    { id: 'mandarin', name: 'Mandarin', file: 'duck-mandarin.webp', price: 250_000, colors: [0xe8762c, 0xfff0d6, 0xb8442e, 0x6b6fb8, 0xf2b63a] },
  ],

  /** Party poppers and confetti (new record, skin unlocks). Lengths are in 660-unit view heights. */
  celebration: {
    pieces: 180,
    /** Gravity and the slowest fall of fluttering paper, × 660 units (scaled to the view). */
    gravity: 2.4,
    maxFall: 0.36,
    drag: 1.4,
    /** Seconds each piece lives. */
    life: [2.4, 3.6],
    /** Popper height, and how high its confetti flies (fraction of the view height). */
    popperHeight: 0.2,
    popperReach: 0.8,
    perPopper: 70,
    /** Party colours for the record poppers. */
    colors: [0xffd93f, 0xff994a, 0xff6fa8, 0x7fe0c4, 0x7cc8ff, 0xffffff],
  },

  /** "Beat your best" flag on the river at the best distance so far. */
  bestMarker: {
    /** Only once the best is at least this far (a 10 m flag is no goal). */
    minMetres: 40,
    /** Flag pole height above the water line, and how far the pole sinks below it. */
    poleHeight: 250,
    poleSink: 30,
  },

  /** One watch-an-ad revive per run, offered after a crash. */
  revive: {
    /** Only offered once the run is worth saving. */
    minMetres: 60,
    /** How long the offer stays up before it becomes game over. */
    offerSeconds: 6,
    /** After reviving: obstacles are ignored this long, and the river ahead is cleared. */
    graceSeconds: 2,
    clearAhead: 900,
  },

  gameOverDelay: 0.75,

  /** Physics sub-step limit so springs stay stable at any frame rate. */
  maxSubStep: 1 / 120,
  /** Clamp for very long frames (tab switches, hitches). */
  maxFrameTime: 1 / 20,
} as const;

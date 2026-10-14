/**
 * All gameplay tuning lives here. Units are "world units" — 1 unit ≈ 1 px at the
 * 1280×720 reference resolution. Times are in seconds, speeds in units/second.
 */
export const CONFIG = {
  view: {
    /** Logical reference resolution. */
    refWidth: 1280,
    refHeight: 720,
    /** On narrow/portrait screens we zoom out so at least this much world width is visible. */
    minViewWidth: 900,
    /** Duck's horizontal position as a fraction of the visible width. */
    duckScreenX: 0.27,
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
    /** Starting scroll speed. */
    baseSpeed: 360,
    /** Slow scroll used behind the main menu. */
    menuSpeed: 140,
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
  },

  background: {
    /** Vertical sky gradient from the top of the gameplay band down to the water line. */
    skyTop: 0x3ac3fd,
    skyHorizon: 0xbdebfd,
    /**
     * Parallax scenery, back to front (public/assets/parallax-no-outline-v2: 1536×1024 PNGs with
     * transparent left/right edges). `cropTop`/`cropBottom` are the opaque rows of the source;
     * `height` is the drawn height in world units, `gap` the empty space between repeats, and the
     * bottom sits `sink` units below the water line. Keep scenery small and sparse so it never
     * competes with obstacles.
     */
    layers: [
      { key: 'bg-clouds', file: 'parallax-no-outline-v2/clouds.png', cropTop: 489, cropBottom: 748, height: 150, gap: 160, sink: 8, parallax: 0.025 },
      { key: 'bg-rocks', file: 'parallax-no-outline-v2/distant-rocks.png', cropTop: 431, cropBottom: 658, height: 115, gap: 260, sink: 8, parallax: 0.06 },
      { key: 'bg-palms', file: 'parallax-no-outline-v2/palm-islands.png', cropTop: 307, cropBottom: 752, height: 195, gap: 420, sink: 8, parallax: 0.12 },
    ],
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
      /** Hard cap on height above the rest water line. */
      maxHeight: 260,
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
  },

  obstacles: {
    /** Grace distance before the first obstacle of a run. */
    firstSpawnDistance: 900,
    /** Spacing between obstacles, expressed in seconds of travel at current speed. */
    minGapTime: 1.35,
    maxGapTime: 2.5,
    spawnMargin: 120,
    despawnMargin: 220,
    poolSize: 12,
    log: {
      width: 124,
      height: 36,
      /** Collision box inset (forgiving). */
      hitInsetX: 10,
      hitInsetY: 6,
      /** Log centre relative to the local water height. */
      floatOffset: 2,
      tiltFactor: 1.0,
    },
  },

  gameOverDelay: 0.75,

  /** Physics sub-step limit so springs stay stable at any frame rate. */
  maxSubStep: 1 / 120,
  /** Clamp for very long frames (tab switches, hitches). */
  maxFrameTime: 1 / 20,
} as const;

export const COLORS = {
  sky: 0x8ed8ff,
  duck: '#FFE078',
  duckShade: '#F5C64F',
  beak: '#FF994A',
  outline: '#263B59',
  cheek: '#FFB08A',
  log: '#B9794B',
  logDark: '#94593A',
  logEnd: '#E2AE7E',
  cloud: '#FFFFFF',
  island: '#9ADBD0',
  islandShade: '#86CFC6',
} as const;

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure deterministic mathematics for 30° Isometric 2.5D projection,
 * SSR (Scale-Shear-Rotate) face construction, Z-sorting by screen Y,
 * spring-overshoot building growth choreography, and 1:0.8:0.6 camera parallax.
 */

export const FPS = 30;
export const DURATION_SECONDS = 10.0;
export const TOTAL_FRAMES = 300;
export const constCOS_30 = Math.cos(Math.PI / 6); // 0.8660254037844387 (86.6025%)
export const SIN_30 = 0.5;
export const TAN_30 = Math.tan(Math.PI / 6); // 0.5773502691896257

export interface Vec2 {
  x: number;
  y: number;
}

export interface AffineMatrix2D {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export interface BuildingGrowthState {
  active: boolean;
  baseDropOffsetZ: number;
  baseScale: number;
  baseContactShadow: number;
  facadeScaleY: number;
  roofCapScale: number;
  roofCapOffsetZ: number;
  windowLightProgress: number;
  constructionLiftGlow: number;
}

export interface CameraState {
  panX: number;
  panY: number;
  zoom: number;
  rotationDeg: 0; // Strictly locked to 0° (pure parallel pan/slide only)
  parallax: {
    foreground: Vec2; // 1.0x speed ratio
    midground: Vec2;  // 0.8x speed ratio
    background: Vec2; // 0.6x speed ratio
  };
  titleRevealProgress: number;
  islandPullbackProgress: number;
}

/**
 * Deterministic seeded PRNG (Mulberry32).
 * Guarantees identical random sequences on every render pass.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Clamp value to [min, max]
 */
export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Normalized progress inside [t0, t1] clamped to [0, 1]
 */
export function remap01(t: number, t0: number, t1: number): number {
  if (t1 <= t0) return t >= t1 ? 1 : 0;
  return clamp((t - t0) / (t1 - t0), 0, 1);
}

/**
 * Intentional easing curves (no generic linear transitions except mechanical motion)
 */
export function easeOutCubic(x: number): number {
  const u = clamp(x, 0, 1);
  return 1 - Math.pow(1 - u, 3);
}

export function easeInOutCubic(x: number): number {
  const u = clamp(x, 0, 1);
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}

export function easeOutQuint(x: number): number {
  const u = clamp(x, 0, 1);
  return 1 - Math.pow(1 - u, 5);
}

/**
 * Damped spring with intentional overshoot for building facade growth & sphere pops.
 * Peaks at ~1.088 around u=0.42 before settling cleanly to 1.0 at u=1.0.
 */
export function easeOutBackOvershoot(x: number, overshoot = 1.65): number {
  const u = clamp(x, 0, 1);
  if (u === 0 || u === 1) return u;
  const c1 = overshoot;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
}

/**
 * Underdamped analytical spring for sphere pops and tile bounces.
 */
export function easeOutSpring(x: number, freq = 2.2, damping = 4.2): number {
  const u = clamp(x, 0, 1);
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  return 1 - Math.exp(-damping * u) * Math.cos(freq * Math.PI * u);
}

/**
 * Tile landing drop with tiny physical bounce on impact.
 */
export function tileDropBounce(x: number): { dropZ: number; scale: number; rippleIntensity: number } {
  const u = clamp(x, 0, 1);
  if (u <= 0) {
    return { dropZ: 95, scale: 0, rippleIntensity: 0 };
  }
  if (u < 0.42) {
    // Fast gravity drop
    const p = u / 0.42;
    const fall = p * p;
    return {
      dropZ: 95 * (1 - fall),
      scale: easeOutCubic(p),
      rippleIntensity: 0,
    };
  }
  // Tiny physical rebound bounce + settle
  const b = (u - 0.42) / 0.58;
  const bounceZ = Math.sin(b * Math.PI * 2.0) * Math.exp(-4.5 * b) * 14;
  const ripple = Math.sin(b * Math.PI) * Math.exp(-2.2 * b);
  return {
    dropZ: Math.max(0, bounceZ),
    scale: 1 + Math.sin(b * Math.PI * 2.0) * Math.exp(-5.0 * b) * 0.035,
    rippleIntensity: Math.max(0, ripple),
  };
}

/**
 * 1. MANDATORY SIGNATURE TECHNIQUE: SSR Isometric Face Formula
 * Scale Y 86.60254% (cos 30°) -> Shear ±30° -> Rotate ∓30°
 * Assembles the 3 canonical faces ('top', 'left', 'right') of an isometric solid.
 */
export function multiplyAffine(m1: AffineMatrix2D, m2: AffineMatrix2D): AffineMatrix2D {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    e: m1.a * m2.e + m1.c * m2.f + m1.e,
    f: m1.b * m2.e + m1.d * m2.f + m1.f,
  };
}

export function getSSRFaceMatrix(
  face: 'top' | 'left' | 'right',
  originX = 0,
  originY = 0
): AffineMatrix2D {
  // Step 1: Scale Y by cos(30°) = 86.60254%
  const scaleStep: AffineMatrix2D = {
    a: 1,
    b: 0,
    c: 0,
    d: constCOS_30,
    e: 0,
    f: 0,
  };

  // Step 2 & 3: Shear ±30° then Rotate ∓30°
  let shearAngleDeg: number;
  let rotateAngleDeg: number;

  if (face === 'top') {
    // Top plane: Shear X by -30°, Rotate by +30° (or +30° shear / -30° rotate)
    shearAngleDeg = -30;
    rotateAngleDeg = 30;
  } else if (face === 'left') {
    // Left vertical face: Shear X by -30°, Rotate by -30°
    shearAngleDeg = -30;
    rotateAngleDeg = -30;
  } else {
    // Right vertical face: Shear X by +30°, Rotate by +30°
    shearAngleDeg = 30;
    rotateAngleDeg = 30;
  }

  const shearRad = (shearAngleDeg * Math.PI) / 180;
  const rotRad = (rotateAngleDeg * Math.PI) / 180;

  // Shear matrix along X by tan(±30°)
  const shearStep: AffineMatrix2D = {
    a: 1,
    b: 0,
    c: Math.tan(shearRad),
    d: 1,
    e: 0,
    f: 0,
  };

  // Rotate matrix by ±30°
  const rotateStep: AffineMatrix2D = {
    a: Math.cos(rotRad),
    b: Math.sin(rotRad),
    c: -Math.sin(rotRad),
    d: Math.cos(rotRad),
    e: originX,
    f: originY,
  };

  // Compose: Rotate * Shear * Scale
  return multiplyAffine(rotateStep, multiplyAffine(shearStep, scaleStep));
}

/**
 * Transform a 2D local face point (u, v) using an SSR matrix
 */
export function applySSR(matrix: AffineMatrix2D, u: number, v: number): Vec2 {
  return {
    x: matrix.a * u + matrix.c * v + matrix.e,
    y: matrix.b * u + matrix.d * v + matrix.f,
  };
}

/**
 * Project 3D isometric world grid coordinates (gx, gy, gz) into 2D screen coordinates.
 * Uses exact 30° axonometric projection built from the SSR top-plane basis vectors:
 * +gx moves along (+cos 30°, +sin 30°), +gy moves along (-cos 30°, +sin 30°), +gz moves straight up (0, -1).
 */
export function projectIsoPoint(
  gx: number,
  gy: number,
  gz: number,
  originX: number,
  originY: number,
  tileUnit: number
): Vec2 {
  const x = originX + (gx - gy) * constCOS_30 * tileUnit;
  const y = originY + (gx + gy) * SIN_30 * tileUnit - gz * tileUnit;
  return { x, y };
}

/**
 * 2. MANDATORY SIGNATURE TECHNIQUE: Fake 3D by Layer Z-Sorting
 * Derives Z-order directly from the projected ground screen Y coordinate (gx + gy),
 * with sub-layer bias so foundations < viaducts/roads < buildings/trains < foreground clouds.
 */
export function computeScreenYZOrder(
  gx: number,
  gy: number,
  originY = 540,
  tileUnit = 44,
  layerBias = 0
): number {
  const groundScreenY = originY + (gx + gy) * SIN_30 * tileUnit;
  return groundScreenY + layerBias * 0.001;
}

/**
 * 3. MANDATORY SIGNATURE TECHNIQUE: Building Grow Choreography
 * - Base lands first (0.00s -> 0.14s)
 * - Facade extrudes scaleY from 0 with spring overshoot (0.07s -> 0.56s)
 * - Roof cap delayed by 2.5 frames (0.0833s = 2.5 / 30s) after facade rise
 */
export function computeBuildingGrowth(
  t: number,
  startTime: number,
  growDuration = 0.54
): BuildingGrowthState {
  const elapsed = t - startTime;
  if (elapsed <= 0) {
    return {
      active: false,
      baseDropOffsetZ: 1.2,
      baseScale: 0,
      baseContactShadow: 0,
      facadeScaleY: 0,
      roofCapScale: 0,
      roofCapOffsetZ: 0.35,
      windowLightProgress: 0,
      constructionLiftGlow: 0,
    };
  }

  // Stage 1: Base lands first (first 0.14s)
  const baseProgress = remap01(elapsed, 0, 0.14);
  const baseDropOffsetZ = (1 - easeOutCubic(baseProgress)) * 0.85;
  const baseScale = easeOutBackOvershoot(baseProgress, 1.35);
  const baseContactShadow = easeOutCubic(baseProgress);

  // Stage 2: Facade scaleY from 0 with overshoot (starts at +0.07s after base initiates)
  const facadeRaw = remap01(elapsed, 0.07, 0.07 + growDuration);
  const facadeScaleY =
    facadeRaw <= 0 ? 0 : Math.max(0, easeOutBackOvershoot(facadeRaw, 1.75));

  // Stage 3: Roof cap delayed by 2.5 frames (~0.083s = 2-3 frames @ 30fps) after facade nears peak
  const roofDelayFrames = 2.5;
  const roofStart = 0.07 + growDuration * 0.62 + roofDelayFrames / FPS;
  const roofRaw = remap01(elapsed, roofStart, roofStart + 0.24);
  const roofCapScale = roofRaw <= 0 ? 0 : easeOutBackOvershoot(roofRaw, 1.9);
  const roofCapOffsetZ = (1 - easeOutCubic(roofRaw)) * 0.28;

  // Stage 4: Tiny facade window lights flicker on sequentially after extrusion
  const windowLightProgress = easeOutCubic(
    remap01(elapsed, 0.07 + growDuration * 0.55, 0.07 + growDuration + 0.95)
  );

  // Construction lift line glow on new towers during 5-8s hero segment
  const liftRise = remap01(t, Math.max(startTime + 0.4, 4.6), 8.2);
  const constructionLiftGlow =
    t >= startTime + 0.35 && t <= 8.6
      ? Math.sin(liftRise * Math.PI) * 0.9
      : 0;

  return {
    active: true,
    baseDropOffsetZ,
    baseScale,
    baseContactShadow,
    facadeScaleY,
    roofCapScale,
    roofCapOffsetZ,
    windowLightProgress,
    constructionLiftGlow,
  };
}

/**
 * 4. MANDATORY SIGNATURE TECHNIQUE: Camera Pure Parallel Pan / Slide & 1 : 0.8 : 0.6 Parallax
 * Strictly zero rotation. Computes camera translation, zoom, and exact parallax layer offsets.
 */
export function computeCameraState(t: number): CameraState {
  const time = clamp(t, 0, DURATION_SECONDS);

  // Base camera trajectory across the 4 narrative acts:
  // 0-2s: Focused on central Lujiazui grid as foundation tiles ripple out
  // 2-5s: Gentle vertical rise tracking the growing skyscrapers & Oriental Pearl Tower
  // 5-8s: Smooth parallel lateral slide across the skyline (Hero Moment)
  // 8-10s: Slow parallel pull-back to reveal the floating Lujiazui island & iso title card
  let panX = 0;
  let panY = 0;
  let zoom = 1.18;

  if (time < 2.0) {
    const p = easeInOutCubic(remap01(time, 0, 2.0));
    panX = -18 + p * 18;
    panY = -75 + p * 15;
    zoom = 1.24 - p * 0.06;
  } else if (time < 5.0) {
    const p = easeInOutCubic(remap01(time, 2.0, 5.0));
    panX = 0 - p * 55;
    panY = -60 + p * 115; // Pan up to frame the rising Oriental Pearl Tower spire
    zoom = 1.18 - p * 0.1;
  } else if (time < 8.0) {
    // 5-8s: Hero smooth parallel slide across the skyline
    const p = easeInOutCubic(remap01(time, 5.0, 8.0));
    panX = -55 + p * 145; // Parallel horizontal slide of 200px
    panY = 55 - p * 25;
    zoom = 1.08 + Math.sin(p * Math.PI) * 0.04;
  } else {
    // 8-10s: Slow parallel pull-back (settles by 8.95s so final 1.05s is a composed held frame with subtle drift)
    const p = easeOutQuint(remap01(time, 8.0, 9.15));
    const microDrift = remap01(time, 9.15, 10.0) * 4.5;
    panX = 90 * (1 - p) - 24 * p + microDrift;
    panY = 30 * (1 - p) + 38 * p;
    zoom = 1.08 * (1 - p) + 0.78 * p;
  }

  // Exact 1 : 0.8 : 0.6 speed ratio across parallax layers
  const foreground: Vec2 = { x: panX * 1.0, y: panY * 1.0 };
  const midground: Vec2 = { x: panX * 0.8, y: panY * 0.8 };
  const background: Vec2 = { x: panX * 0.6, y: panY * 0.6 };

  const islandPullbackProgress = easeInOutCubic(remap01(time, 8.0, 9.1));
  const titleRevealProgress = easeOutCubic(remap01(time, 8.15, 8.95));

  return {
    panX,
    panY,
    zoom,
    rotationDeg: 0,
    parallax: {
      foreground,
      midground,
      background,
    },
    titleRevealProgress,
    islandPullbackProgress,
  };
}

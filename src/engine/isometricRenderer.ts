/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Deterministic 2.5D Isometric Renderer for 「天际生长 · 上海 | SHANGHAI RISING SKYLINE」
 * Works identically in HTML5 Canvas (browser) and @napi-rs/canvas (Node.js offline render).
 */

import {
  FPS,
  constCOS_30,
  SIN_30,
  clamp,
  remap01,
  easeOutCubic,
  easeInOutCubic,
  easeOutBackOvershoot,
  easeOutSpring,
  tileDropBounce,
  getSSRFaceMatrix,
  projectIsoPoint,
  computeScreenYZOrder,
  computeBuildingGrowth,
  computeCameraState,
  mulberry32,
} from './isoMath';
import {
  FoundationTile,
  SkyscraperDef,
  generateFoundationTiles,
  generateSkyscrapers,
} from './shanghaiScene';

export interface RenderOptions {
  width?: number;
  height?: number;
  motionBlurSamples?: number;
  showDebugGrid?: boolean;
  showZOrderLabels?: boolean;
  showParallaxVectors?: boolean;
  showSafeMargin?: boolean;
}

// Precomputed deterministic scene geometry
const SCENE_TILES: FoundationTile[] = generateFoundationTiles();
const SCENE_TOWERS: SkyscraperDef[] = generateSkyscrapers();

interface ZSortableItem {
  zOrder: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

/**
 * Draw an isometric 3-face box (prism) at world grid coordinates (gx, gy, gz)
 * with dimensions (w, d, h) in grid units.
 * Uses exact 30° isometric projection derived from SSR face math.
 */
function drawIsoPrism(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  gz: number,
  w: number,
  d: number,
  h: number,
  originX: number,
  originY: number,
  tileUnit: number,
  topColor: string | CanvasGradient,
  leftColor: string | CanvasGradient,
  rightColor: string | CanvasGradient,
  strokeColor?: string,
  strokeWidth = 0.75
): void {
  if (h <= 0.001 || w <= 0.001 || d <= 0.001) return;

  const x0 = gx - w / 2;
  const x1 = gx + w / 2;
  const y0 = gy - d / 2;
  const y1 = gy + d / 2;
  const z0 = gz;
  const z1 = gz + h;

  // Top face vertices
  const t00 = projectIsoPoint(x0, y0, z1, originX, originY, tileUnit);
  const t10 = projectIsoPoint(x1, y0, z1, originX, originY, tileUnit);
  const t11 = projectIsoPoint(x1, y1, z1, originX, originY, tileUnit);
  const t01 = projectIsoPoint(x0, y1, z1, originX, originY, tileUnit);

  // Bottom visible vertices
  const b01 = projectIsoPoint(x0, y1, z0, originX, originY, tileUnit);
  const b11 = projectIsoPoint(x1, y1, z0, originX, originY, tileUnit);
  const b10 = projectIsoPoint(x1, y0, z0, originX, originY, tileUnit);

  // Left visible face: (x0, y1) -> (x1, y1)
  ctx.beginPath();
  ctx.moveTo(t01.x, t01.y);
  ctx.lineTo(t11.x, t11.y);
  ctx.lineTo(b11.x, b11.y);
  ctx.lineTo(b01.x, b01.y);
  ctx.closePath();
  ctx.fillStyle = leftColor;
  ctx.fill();
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }

  // Right visible face: (x1, y1) -> (x1, y0)
  ctx.beginPath();
  ctx.moveTo(t11.x, t11.y);
  ctx.lineTo(t10.x, t10.y);
  ctx.lineTo(b10.x, b10.y);
  ctx.lineTo(b11.x, b11.y);
  ctx.closePath();
  ctx.fillStyle = rightColor;
  ctx.fill();
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }

  // Top face
  ctx.beginPath();
  ctx.moveTo(t00.x, t00.y);
  ctx.lineTo(t10.x, t10.y);
  ctx.lineTo(t11.x, t11.y);
  ctx.lineTo(t01.x, t01.y);
  ctx.closePath();
  ctx.fillStyle = topColor;
  ctx.fill();
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
}

/**
 * Draw soft directional drop shadow cast along the 30° south-east sun vector.
 */
function drawSoftDropShadow(
  ctx: CanvasRenderingContext2D,
  gx: number,
  gy: number,
  gz: number,
  w: number,
  d: number,
  shadowLen: number,
  originX: number,
  originY: number,
  tileUnit: number,
  alpha = 0.14
): void {
  if (shadowLen <= 0.01 || alpha <= 0.005) return;
  const x0 = gx - w / 2;
  const x1 = gx + w / 2;
  const y0 = gy - d / 2;
  const y1 = gy + d / 2;

  const p01 = projectIsoPoint(x0, y1, gz, originX, originY, tileUnit);
  const p11 = projectIsoPoint(x1, y1, gz, originX, originY, tileUnit);
  const p10 = projectIsoPoint(x1, y0, gz, originX, originY, tileUnit);
  const s01 = projectIsoPoint(x0 + shadowLen * 0.65, y1 + shadowLen * 0.22, gz, originX, originY, tileUnit);
  const s11 = projectIsoPoint(x1 + shadowLen * 0.65, y1 + shadowLen * 0.22, gz, originX, originY, tileUnit);
  const s10 = projectIsoPoint(x1 + shadowLen * 0.65, y0 + shadowLen * 0.22, gz, originX, originY, tileUnit);

  const grad = ctx.createLinearGradient(p11.x, p11.y, s11.x, s11.y);
  grad.addColorStop(0, `rgba(45, 68, 98, ${alpha})`);
  grad.addColorStop(1, 'rgba(45, 68, 98, 0)');

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(p01.x, p01.y);
  ctx.lineTo(p11.x, p11.y);
  ctx.lineTo(p10.x, p10.y);
  ctx.lineTo(s10.x, s10.y);
  ctx.lineTo(s11.x, s11.y);
  ctx.lineTo(s01.x, s01.y);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();
}

/**
 * Draw facade architectural windows and mullions using SSR face coordinates
 */
function drawBuildingFacadeDetails(
  ctx: CanvasRenderingContext2D,
  tower: SkyscraperDef,
  gx: number,
  gy: number,
  gzBase: number,
  w: number,
  d: number,
  currentH: number,
  windowProgress: number,
  liftGlow: number,
  t: number,
  originX: number,
  originY: number,
  tileUnit: number
): void {
  if (currentH < 0.35) return;

  const x0 = gx - w / 2;
  const x1 = gx + w / 2;
  const y0 = gy - d / 2;
  const y1 = gy + d / 2;

  // Horizontal architectural floor bands
  const floors = Math.max(3, Math.floor(tower.height * 4.5));
  ctx.save();
  ctx.lineWidth = 0.8;

  for (let f = 1; f < floors; f++) {
    const fFrac = f / floors;
    const zFloor = gzBase + currentH * fFrac;
    const isSkyLobby = f % 6 === 0;

    const l0 = projectIsoPoint(x0, y1, zFloor, originX, originY, tileUnit);
    const l1 = projectIsoPoint(x1, y1, zFloor, originX, originY, tileUnit);
    const r1 = projectIsoPoint(x1, y0, zFloor, originX, originY, tileUnit);

    ctx.strokeStyle = isSkyLobby
      ? 'rgba(255, 255, 255, 0.55)'
      : 'rgba(130, 155, 185, 0.26)';
    ctx.beginPath();
    ctx.moveTo(l0.x, l0.y);
    ctx.lineTo(l1.x, l1.y);
    ctx.lineTo(r1.x, r1.y);
    ctx.stroke();
  }

  // Tiny warm champagne facade window lights flickering on sequentially
  if (windowProgress > 0.02) {
    const rng = mulberry32(tower.windowSeed);
    const cols = 3;
    for (let f = 1; f < floors - 1; f++) {
      const fFrac = f / floors;
      if (fFrac > windowProgress) continue;

      for (let c = 0; c < cols; c++) {
        const spark = rng();
        // Flicker threshold
        const threshold = 0.42 + 0.25 * Math.sin(t * 3.2 + spark * 12);
        if (spark > threshold) {
          const u0 = (c + 0.2) / cols;
          const u1 = (c + 0.78) / cols;
          const zW0 = gzBase + currentH * (fFrac + 0.015);
          const zW1 = gzBase + currentH * (fFrac + 0.055);

          // Left face window
          const wl0 = projectIsoPoint(x0 + w * u0, y1, zW0, originX, originY, tileUnit);
          const wl1 = projectIsoPoint(x0 + w * u1, y1, zW0, originX, originY, tileUnit);
          const wl2 = projectIsoPoint(x0 + w * u1, y1, zW1, originX, originY, tileUnit);
          const wl3 = projectIsoPoint(x0 + w * u0, y1, zW1, originX, originY, tileUnit);

          ctx.fillStyle =
            spark > 0.82
              ? 'rgba(255, 241, 196, 0.92)'
              : 'rgba(255, 232, 168, 0.68)';
          ctx.beginPath();
          ctx.moveTo(wl0.x, wl0.y);
          ctx.lineTo(wl1.x, wl1.y);
          ctx.lineTo(wl2.x, wl2.y);
          ctx.lineTo(wl3.x, wl3.y);
          ctx.closePath();
          ctx.fill();
        }

        // Right face window
        const sparkR = rng();
        if (sparkR > 0.56) {
          const v0 = (c + 0.2) / cols;
          const v1 = (c + 0.78) / cols;
          const zW0 = gzBase + currentH * (fFrac + 0.015);
          const zW1 = gzBase + currentH * (fFrac + 0.055);

          const wr0 = projectIsoPoint(x1, y1 - d * v0, zW0, originX, originY, tileUnit);
          const wr1 = projectIsoPoint(x1, y1 - d * v1, zW0, originX, originY, tileUnit);
          const wr2 = projectIsoPoint(x1, y1 - d * v1, zW1, originX, originY, tileUnit);
          const wr3 = projectIsoPoint(x1, y1 - d * v0, zW1, originX, originY, tileUnit);

          ctx.fillStyle = 'rgba(246, 218, 152, 0.58)';
          ctx.beginPath();
          ctx.moveTo(wr0.x, wr0.y);
          ctx.lineTo(wr1.x, wr1.y);
          ctx.lineTo(wr2.x, wr2.y);
          ctx.lineTo(wr3.x, wr3.y);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  // Faint glowing vertical construction lift lines on new towers (5–8s Hero Segment)
  if (tower.hasConstructionLift && liftGlow > 0.05) {
    const cornerBot = projectIsoPoint(x1, y1, gzBase + 0.1, originX, originY, tileUnit);
    const cornerTop = projectIsoPoint(x1, y1, gzBase + currentH, originX, originY, tileUnit);

    ctx.strokeStyle = `rgba(125, 211, 252, ${liftGlow * 0.78})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cornerBot.x, cornerBot.y);
    ctx.lineTo(cornerTop.x, cornerTop.y);
    ctx.stroke();

    // Ascending elevator hoist pod along the lift line
    const podProgress = ((t * 0.45 + tower.startTime) % 1.0);
    const podZ = gzBase + 0.15 + (currentH - 0.25) * podProgress;
    const podPt = projectIsoPoint(x1, y1, podZ, originX, originY, tileUnit);

    ctx.fillStyle = `rgba(254, 240, 138, ${liftGlow * 0.95})`;
    ctx.beginPath();
    ctx.arc(podPt.x, podPt.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draw the Hero Landmark: Oriental Pearl Tower (东方明珠) at Lujiazui riverfront
 * Sequence: Podium Base -> Tripod Struts -> Central Columns -> 3 Spheres Pop One-by-One -> Spire
 */
function drawOrientalPearlTower(
  ctx: CanvasRenderingContext2D,
  t: number,
  originX: number,
  originY: number,
  tileUnit: number
): void {
  const gx = -0.75;
  const gy = 0.55;
  const gzBase = 0.22;

  if (t < 2.90) return;

  // 1. Stepped Circular/Octagonal White Marble Podium Base (2.92s - 3.25s)
  const podiumProg = easeOutBackOvershoot(remap01(t, 2.92, 3.22), 1.4);
  if (podiumProg > 0) {
    drawSoftDropShadow(
      ctx,
      gx,
      gy,
      gzBase,
      1.35 * podiumProg,
      1.35 * podiumProg,
      1.8 * remap01(t, 3.1, 4.3),
      originX,
      originY,
      tileUnit,
      0.18
    );

    drawIsoPrism(
      ctx,
      gx,
      gy,
      gzBase,
      1.32 * podiumProg,
      1.32 * podiumProg,
      0.24 * podiumProg,
      originX,
      originY,
      tileUnit,
      '#F8FAFC',
      '#E2E8F0',
      '#C3D0DF',
      'rgba(148, 163, 184, 0.45)',
      0.8
    );
    drawIsoPrism(
      ctx,
      gx,
      gy,
      gzBase + 0.24 * podiumProg,
      0.96 * podiumProg,
      0.96 * podiumProg,
      0.18 * podiumProg,
      originX,
      originY,
      tileUnit,
      '#FFFFFF',
      '#E8EEF5',
      '#CBD5E1',
      'rgba(148, 163, 184, 0.45)',
      0.8
    );
  }

  // 2. Main Central Tri-Column Shaft (3.12s - 3.68s) with spring overshoot
  const shaftRaw = remap01(t, 3.12, 3.68);
  const shaftScaleY = shaftRaw <= 0 ? 0 : easeOutBackOvershoot(shaftRaw, 1.65);
  const fullShaftH = 4.95;
  const curShaftH = fullShaftH * shaftScaleY;

  // 3. Tripod Angled Support Struts (3.05s - 3.45s)
  const strutProg = easeOutCubic(remap01(t, 3.05, 3.45));
  if (strutProg > 0) {
    const anchorZ = gzBase + 0.4 + Math.min(curShaftH, 1.55) * strutProg;
    const topAnchor = projectIsoPoint(gx, gy, anchorZ, originX, originY, tileUnit);
    const feet = [
      projectIsoPoint(gx - 0.62, gy + 0.45, gzBase + 0.35, originX, originY, tileUnit),
      projectIsoPoint(gx + 0.58, gy + 0.52, gzBase + 0.35, originX, originY, tileUnit),
      projectIsoPoint(gx + 0.48, gy - 0.58, gzBase + 0.35, originX, originY, tileUnit),
    ];

    ctx.save();
    ctx.lineCap = 'round';
    feet.forEach((foot, idx) => {
      ctx.strokeStyle = idx === 0 ? '#E2E8F0' : idx === 1 ? '#CBD5E1' : '#94A3B8';
      ctx.lineWidth = 4.2 * (tileUnit / 44);
      ctx.beginPath();
      ctx.moveTo(foot.x, foot.y);
      ctx.lineTo(
        foot.x + (topAnchor.x - foot.x) * strutProg,
        foot.y + (topAnchor.y - foot.y) * strutProg
      );
      ctx.stroke();
    });
    ctx.restore();
  }

  // Draw the 3 central vertical columns & horizontal cross-rings
  if (curShaftH > 0.1) {
    const colOffsets = [
      { dx: -0.11, dy: 0.08, top: '#F8FAFC', left: '#E2E8F0', right: '#CBD5E1' },
      { dx: 0.11, dy: 0.08, top: '#F8FAFC', left: '#D8E2EE', right: '#B8C7D8' },
      { dx: 0.0, dy: -0.11, top: '#F8FAFC', left: '#CBD5E1', right: '#A3B4C8' },
    ];
    for (const col of colOffsets) {
      drawIsoPrism(
        ctx,
        gx + col.dx,
        gy + col.dy,
        gzBase + 0.42,
        0.13,
        0.13,
        curShaftH,
        originX,
        originY,
        tileUnit,
        col.top,
        col.left,
        col.right
      );
    }

    // Horizontal structural rings along the shaft
    for (let r = 1; r <= 5; r++) {
      const rz = gzBase + 0.42 + (curShaftH * r) / 6;
      drawIsoPrism(
        ctx,
        gx,
        gy,
        rz,
        0.34,
        0.34,
        0.06,
        originX,
        originY,
        tileUnit,
        '#F1F5F9',
        '#CBD5E1',
        '#94A3B8'
      );
    }
  }

  // Helper to draw an iconic Oriental Pearl sphere with squash-and-stretch pop & champagne-coral shading
  const drawPearlSphere = (
    centerZ: number,
    radiusUnits: number,
    popStartTime: number,
    hasObservationRing: boolean
  ) => {
    const elapsed = t - popStartTime;
    if (elapsed <= 0) return;
    const u = remap01(elapsed, 0, 0.48);
    const springScale = easeOutSpring(u, 2.5, 4.0);
    // Squash-and-stretch volume modulation during pop
    const stretch = Math.sin(u * Math.PI * 2.5) * Math.exp(-4.5 * u) * 0.14;
    const rx = radiusUnits * tileUnit * (springScale - stretch * 0.5);
    const ry = radiusUnits * tileUnit * (springScale + stretch);

    const pt = projectIsoPoint(gx, gy, centerZ, originX, originY, tileUnit);

    ctx.save();
    ctx.translate(pt.x, pt.y);

    // Subtle outer champagne aura
    const glow = ctx.createRadialGradient(0, 0, rx * 0.6, 0, 0, rx * 1.45);
    glow.addColorStop(0, 'rgba(229, 193, 133, 0.28)');
    glow.addColorStop(1, 'rgba(229, 193, 133, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, rx * 1.45, 0, Math.PI * 2);
    ctx.fill();

    // Main sphere body with 3D pearl-champagne-coral directional gradient
    const sphereGrad = ctx.createRadialGradient(
      -rx * 0.32,
      -ry * 0.32,
      rx * 0.08,
      0,
      0,
      Math.max(rx, ry)
    );
    sphereGrad.addColorStop(0, '#FFFDF9');
    sphereGrad.addColorStop(0.32, '#F4D5B8');
    sphereGrad.addColorStop(0.68, '#DF9E7E');
    sphereGrad.addColorStop(1, '#B36E56');

    ctx.fillStyle = sphereGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 1.1;
    ctx.stroke();

    // Geodesic latitude ring & observation deck windows
    if (hasObservationRing && rx > 3) {
      ctx.strokeStyle = 'rgba(255, 248, 225, 0.88)';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      ctx.ellipse(0, ry * 0.06, rx * 0.98, ry * 0.28, 0, 0, Math.PI);
      ctx.stroke();
    }

    ctx.restore();
  };

  // 4. Three Spheres Pop Sequentially (Delayed after main shaft rises):
  // Sphere 1: Lower Large Sphere (t = 3.55s)
  drawPearlSphere(gzBase + 1.85, 0.56, 3.55, true);

  // Small intermediate connector spheres along the shaft (t = 3.72s)
  drawPearlSphere(gzBase + 2.75, 0.19, 3.70, false);
  drawPearlSphere(gzBase + 3.35, 0.18, 3.78, false);

  // Sphere 2: Upper Medium Sphere (t = 3.85s)
  drawPearlSphere(gzBase + 4.15, 0.44, 3.85, true);

  // Sphere 3: Top Space Capsule Sphere (t = 4.10s)
  drawPearlSphere(gzBase + 5.35, 0.27, 4.10, false);

  // 5. Ultra-slender Champagne Broadcast Antenna Spire (t = 4.25s - 4.65s)
  const spireProg = easeOutBackOvershoot(remap01(t, 4.25, 4.62), 1.5);
  if (spireProg > 0) {
    const spireBase = projectIsoPoint(gx, gy, gzBase + 5.55, originX, originY, tileUnit);
    const spireTip = projectIsoPoint(
      gx,
      gy,
      gzBase + 5.55 + 1.65 * spireProg,
      originX,
      originY,
      tileUnit
    );

    ctx.save();
    ctx.strokeStyle = '#D4A359';
    ctx.lineWidth = 2.6 * (tileUnit / 44);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(spireBase.x, spireBase.y);
    ctx.lineTo(spireTip.x, spireTip.y);
    ctx.stroke();

    // Glowing champagne beacon at tip
    const pulse = 0.65 + 0.35 * Math.sin(t * 6.0);
    ctx.fillStyle = `rgba(253, 224, 71, ${pulse})`;
    ctx.beginPath();
    ctx.arc(spireTip.x, spireTip.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Draw an individual high-rise tower with its 3-stage growth choreography:
 * Base lands first -> Facade scaleY from 0 with overshoot -> Roof cap delayed 2-3 frames
 */
function drawSkyscraper(
  ctx: CanvasRenderingContext2D,
  tower: SkyscraperDef,
  t: number,
  originX: number,
  originY: number,
  tileUnit: number
): void {
  const growth = computeBuildingGrowth(t, tower.startTime, tower.growDuration);
  if (!growth.active) return;

  const gzGround = 0.22;
  const w = tower.footprintW;
  const d = tower.footprintD;
  const curH = tower.height * growth.facadeScaleY;

  // Color palette selection
  let topCol = '#F8FAFC';
  let leftCol = '#DDE6F0';
  let rightCol = '#B4C4D6';

  if (tower.tint === 'champagne') {
    topCol = '#FDFBF7';
    leftCol = '#EFE4D2';
    rightCol = '#CBB799';
  } else if (tower.tint === 'sky_blue') {
    topCol = '#F4F9FF';
    leftCol = '#D2E4F6';
    rightCol = '#9FBCD9';
  } else if (tower.tint === 'pearl') {
    topCol = '#FFFFFF';
    leftCol = '#E8EEF4';
    rightCol = '#C0CEDE';
  }

  // Soft directional drop shadow on the plaza deck
  drawSoftDropShadow(
    ctx,
    tower.gx,
    tower.gy,
    gzGround,
    w,
    d,
    Math.max(0.2, curH * 0.38),
    originX,
    originY,
    tileUnit,
    0.13 * growth.baseContactShadow
  );

  // Stage 1: Base pad lands first with ambient occlusion contact collar
  const baseW = w * 1.12 * growth.baseScale;
  const baseD = d * 1.12 * growth.baseScale;
  const baseZ = gzGround + growth.baseDropOffsetZ;

  // Ambient occlusion contact pad on ground
  if (growth.baseContactShadow > 0.05) {
    drawIsoPrism(
      ctx,
      tower.gx,
      tower.gy,
      gzGround,
      w * 1.22 * growth.baseContactShadow,
      d * 1.22 * growth.baseContactShadow,
      0.02,
      originX,
      originY,
      tileUnit,
      'rgba(51, 65, 85, 0.16)',
      'rgba(51, 65, 85, 0.16)',
      'rgba(51, 65, 85, 0.16)'
    );
  }

  // Building podium base
  drawIsoPrism(
    ctx,
    tower.gx,
    tower.gy,
    baseZ,
    baseW,
    baseD,
    0.16,
    originX,
    originY,
    tileUnit,
    '#F8FAFC',
    '#E2E8F0',
    '#CBD5E1',
    'rgba(148, 163, 184, 0.45)',
    0.7
  );

  // Stage 2: Main Facade Extrusion (scaleY from 0 with spring overshoot)
  if (curH > 0.02) {
    const shaftZ = baseZ + 0.16;

    if (tower.style === 'supertall_stepped') {
      // Multi-tier stepped Art-Deco supertall (Jin-Crown style)
      const tiers = 4;
      let zCursor = shaftZ;
      for (let i = 0; i < tiers; i++) {
        const tierH = curH * (i === 0 ? 0.42 : i === 1 ? 0.26 : i === 2 ? 0.18 : 0.14);
        const shrink = 1 - i * 0.15;
        drawIsoPrism(
          ctx,
          tower.gx,
          tower.gy,
          zCursor,
          w * shrink,
          d * shrink,
          tierH,
          originX,
          originY,
          tileUnit,
          topCol,
          leftCol,
          rightCol,
          'rgba(255,255,255,0.55)',
          0.75
        );
        zCursor += tierH;
      }
    } else if (tower.style === 'supertall_twisted') {
      // 5 segmented offset stacked volumes (Shanghai Tower style)
      const segs = 5;
      const segH = curH / segs;
      for (let s = 0; s < segs; s++) {
        const taper = 1 - s * 0.08;
        const twistOffset = Math.sin(s * 0.7) * 0.03;
        drawIsoPrism(
          ctx,
          tower.gx + twistOffset,
          tower.gy - twistOffset,
          shaftZ + s * segH,
          w * taper,
          d * taper,
          segH * 0.97,
          originX,
          originY,
          tileUnit,
          topCol,
          leftCol,
          rightCol,
          'rgba(255,255,255,0.6)',
          0.75
        );
      }
    } else if (tower.style === 'terrace_cluster') {
      // Main tower + asymmetric side terrace wing
      drawIsoPrism(
        ctx,
        tower.gx - w * 0.12,
        tower.gy + d * 0.12,
        shaftZ,
        w * 0.65,
        d * 0.65,
        curH * 0.68,
        originX,
        originY,
        tileUnit,
        topCol,
        leftCol,
        rightCol,
        'rgba(255,255,255,0.5)',
        0.65
      );
      drawIsoPrism(
        ctx,
        tower.gx + w * 0.08,
        tower.gy - d * 0.08,
        shaftZ,
        w * 0.78,
        d * 0.78,
        curH,
        originX,
        originY,
        tileUnit,
        topCol,
        leftCol,
        rightCol,
        'rgba(255,255,255,0.55)',
        0.75
      );
    } else {
      // Clean monolithic / champagne prism / sky-portal tower
      drawIsoPrism(
        ctx,
        tower.gx,
        tower.gy,
        shaftZ,
        w,
        d,
        curH,
        originX,
        originY,
        tileUnit,
        topCol,
        leftCol,
        rightCol,
        'rgba(255, 255, 255, 0.55)',
        0.75
      );
    }

    // Facade windows & construction lift glow
    drawBuildingFacadeDetails(
      ctx,
      tower,
      tower.gx,
      tower.gy,
      shaftZ,
      w * 0.88,
      d * 0.88,
      curH,
      growth.windowLightProgress,
      growth.constructionLiftGlow,
      t,
      originX,
      originY,
      tileUnit
    );

    // Stage 3: Roof Cap Delayed by 2–3 frames after facade growth
    if (growth.roofCapScale > 0.02) {
      const roofZ = shaftZ + curH + growth.roofCapOffsetZ;
      const capW = w * 0.68 * growth.roofCapScale;
      const capD = d * 0.68 * growth.roofCapScale;

      drawIsoPrism(
        ctx,
        tower.gx,
        tower.gy,
        roofZ,
        capW,
        capD,
        0.14 * growth.roofCapScale,
        originX,
        originY,
        tileUnit,
        '#FFFFFF',
        '#F3E8D2',
        '#D4B483',
        'rgba(212, 163, 89, 0.6)',
        0.8
      );

      // Spire or Helipad detail on the roof cap
      if (tower.roofStyle === 'spire' || tower.roofStyle === 'twin_antenna') {
        const basePt = projectIsoPoint(
          tower.gx,
          tower.gy,
          roofZ + 0.14 * growth.roofCapScale,
          originX,
          originY,
          tileUnit
        );
        const tipPt = projectIsoPoint(
          tower.gx,
          tower.gy,
          roofZ + (0.14 + 0.55) * growth.roofCapScale,
          originX,
          originY,
          tileUnit
        );
        ctx.save();
        ctx.strokeStyle = '#D4A359';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(basePt.x, basePt.y);
        ctx.lineTo(tipPt.x, tipPt.y);
        ctx.stroke();
        ctx.restore();
      } else if (tower.roofStyle === 'helipad') {
        const padCenter = projectIsoPoint(
          tower.gx,
          tower.gy,
          roofZ + 0.15 * growth.roofCapScale,
          originX,
          originY,
          tileUnit
        );
        ctx.save();
        ctx.strokeStyle = '#E5C185';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(
          padCenter.x,
          padCenter.y,
          capW * tileUnit * 0.34,
          capD * tileUnit * 0.19,
          0,
          0,
          Math.PI * 2
        );
        ctx.stroke();
        ctx.restore();
      }
    }
  }
}

/**
 * Draw isometric elevated metro viaduct pillar & deck segment, plus articulated mini-trains
 * moving strictly along the 2:1 isometric grid slope during 5–10s.
 */
function populateMetroAndFlowItems(
  items: ZSortableItem[],
  t: number,
  originX: number,
  originY: number,
  tileUnit: number
): void {
  const viaductAppear = easeOutCubic(remap01(t, 1.65, 2.35));
  if (viaductAppear <= 0.01) return;

  // Scenic Foreground Elevated Metro Viaduct running along gy = 3.35 (front-left boulevard)
  // AND gx = 3.35 (front-right boulevard) so mini-trains are 100% visible in the hero foreground!
  const trackY = 3.35;
  const trackX = 3.35;
  const deckZ = 0.62 * viaductAppear;

  for (let seg = -3.5; seg <= 3.5; seg += 1.0) {
    // Front-left corridor (along gx at gy = 3.35)
    const zKeyA = computeScreenYZOrder(seg, trackY, originY, tileUnit, -1);
    items.push({
      zOrder: zKeyA,
      draw: (ctx) => {
        drawIsoPrism(
          ctx,
          seg,
          trackY,
          0.18,
          0.14,
          0.14,
          deckZ - 0.18,
          originX,
          originY,
          tileUnit,
          '#E2E8F0',
          '#CBD5E1',
          '#94A3B8'
        );
        drawIsoPrism(
          ctx,
          seg,
          trackY,
          deckZ,
          1.02,
          0.28,
          0.07,
          originX,
          originY,
          tileUnit,
          '#F8FAFC',
          '#D8E3EE',
          '#B0C0D2',
          'rgba(148, 163, 184, 0.45)',
          0.6
        );
      },
    });

    // Front-right corridor (along gy at gx = 3.35)
    if (seg < 2.8) {
      const zKeyB = computeScreenYZOrder(trackX, seg, originY, tileUnit, -1);
      items.push({
        zOrder: zKeyB,
        draw: (ctx) => {
          drawIsoPrism(
            ctx,
            trackX,
            seg,
            0.18,
            0.14,
            0.14,
            deckZ - 0.18,
            originX,
            originY,
            tileUnit,
            '#E2E8F0',
            '#CBD5E1',
            '#94A3B8'
          );
          drawIsoPrism(
            ctx,
            trackX,
            seg,
            deckZ,
            0.28,
            1.02,
            0.07,
            originX,
            originY,
            tileUnit,
            '#F8FAFC',
            '#D8E3EE',
            '#B0C0D2',
            'rgba(148, 163, 184, 0.45)',
            0.6
          );
        },
      });
    }
  }

  // Mini elevated metro trains running along foreground viaducts (4.5s - 10.0s)
  if (t >= 4.4) {
    // Train 1: Gliding along foreground-left viaduct (gy = 3.35) on 2:1 isometric slope
    const train1HeadGx = -3.8 + ((t - 4.4) * 2.15) % 8.2;
    const cars = 4;
    const carLen = 0.46;
    const carGap = 0.52;

    for (let c = 0; c < cars; c++) {
      const cgx = train1HeadGx - c * carGap;
      if (cgx < -3.9 || cgx > 3.5) continue;

      const zKey = computeScreenYZOrder(cgx, trackY, originY, tileUnit, 4);
      items.push({
        zOrder: zKey,
        draw: (ctx) => {
          drawIsoPrism(
            ctx,
            cgx,
            trackY,
            deckZ + 0.072,
            carLen * 1.05,
            0.22,
            0.015,
            originX,
            originY,
            tileUnit,
            'rgba(15, 23, 42, 0.25)',
            'rgba(15, 23, 42, 0.25)',
            'rgba(15, 23, 42, 0.25)'
          );
          drawIsoPrism(
            ctx,
            cgx,
            trackY,
            deckZ + 0.08,
            carLen,
            0.21,
            0.15,
            originX,
            originY,
            tileUnit,
            '#FFFFFF',
            '#E0F2FE',
            '#38BDF8',
            '#0284C7',
            0.75
          );
        },
      });
    }

    // Train 2: Gliding along foreground-right viaduct (gx = 3.35)
    const train2HeadGy = 3.2 - ((t - 4.4) * 1.95) % 7.6;
    for (let c = 0; c < 3; c++) {
      const cgy = train2HeadGy + c * carGap;
      if (cgy < -3.8 || cgy > 3.2) continue;

      const zKey = computeScreenYZOrder(trackX, cgy, originY, tileUnit, 4);
      items.push({
        zOrder: zKey,
        draw: (ctx) => {
          drawIsoPrism(
            ctx,
            trackX,
            cgy,
            deckZ + 0.08,
            0.21,
            carLen,
            0.15,
            originX,
            originY,
            tileUnit,
            '#FFFBEB',
            '#FDE68A',
            '#F59E0B',
            '#D97706',
            0.75
          );
        },
      });
    }

    // Slow drifting urban flow light streaks along boulevards (strictly clamped within [-3.4, +3.4] on island)
    const streakCount = 8;
    for (let s = 0; s < streakCount; s++) {
      const dir = s % 2 === 0 ? 1 : -1;
      const laneOffset = s % 2 === 0 ? -0.16 : 0.16;
      const cycle = (((t * 1.45 + s * 0.95) * dir) % 6.8 + 6.8) % 6.8;
      const rawPos = -3.4 + cycle;
      const zKey = computeScreenYZOrder(laneOffset, rawPos, originY, tileUnit, 1);

      items.push({
        zOrder: zKey,
        draw: (ctx) => {
          const p0 = projectIsoPoint(laneOffset, rawPos - 0.28, 0.24, originX, originY, tileUnit);
          const p1 = projectIsoPoint(laneOffset, rawPos + 0.28, 0.24, originX, originY, tileUnit);
          ctx.save();
          ctx.strokeStyle =
            s % 2 === 0
              ? 'rgba(251, 191, 36, 0.92)'
              : 'rgba(56, 189, 248, 0.92)';
          ctx.lineWidth = 2.8 * (tileUnit / 44);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
          ctx.stroke();
          ctx.restore();
        },
      });
    }
  }
}

/**
 * Draw precision geometric vector strokes for the Chinese title 「天际生长 · 上海」
 * inside the SSR-transformed isometric coordinate frame.
 * Guarantees 100% crisp typography with zero tofu even in environments without CJK fonts,
 * and layers cleanly with the registered Noto Sans CJK SC font.
 */
function drawIsometricTitleCard(
  ctx: CanvasRenderingContext2D,
  t: number,
  originX: number,
  originY: number,
  tileUnit: number
): void {
  const reveal = easeOutCubic(remap01(t, 8.10, 8.95));
  if (reveal <= 0.01) return;

  // Position the title plaque flat on the foreground isometric plane with clean separation from the island corner
  const plaqueAnchor = projectIsoPoint(1.85, 6.55, -0.25, originX, originY, tileUnit);
  const ssrTop = getSSRFaceMatrix('top', plaqueAnchor.x, plaqueAnchor.y);

  ctx.save();
  ctx.globalAlpha = reveal;

  // Apply the exact SSR Isometric Top-Face Matrix:
  // Scale Y 86.6025% -> Shear -30° -> Rotate +30°
  ctx.transform(ssrTop.a, ssrTop.b, ssrTop.c, ssrTop.d, ssrTop.e, ssrTop.f);

  // Subtle slide-in along the isometric u-axis
  const slideOffsetU = (1 - reveal) * -45;
  ctx.translate(slideOffsetU, 0);

  const scaleFactor = tileUnit / 36;
  ctx.scale(scaleFactor, scaleFactor);

  // Architectural glass-pearl title plaque lying flat in isometric space
  const plaqueW = 390;
  const plaqueH = 96;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.65)';
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.rect(-plaqueW / 2, -plaqueH / 2, plaqueW, plaqueH);
  ctx.fill();
  ctx.stroke();

  // Champagne architectural corner registration marks
  ctx.strokeStyle = '#C89646';
  ctx.lineWidth = 2.4;
  const cornerLen = 14;
  // Top-left corner
  ctx.beginPath();
  ctx.moveTo(-plaqueW / 2, -plaqueH / 2 + cornerLen);
  ctx.lineTo(-plaqueW / 2, -plaqueH / 2);
  ctx.lineTo(-plaqueW / 2 + cornerLen, -plaqueH / 2);
  // Bottom-right corner
  ctx.moveTo(plaqueW / 2, plaqueH / 2 - cornerLen);
  ctx.lineTo(plaqueW / 2, plaqueH / 2);
  ctx.lineTo(plaqueW / 2 - cornerLen, plaqueH / 2);
  ctx.stroke();

  // Primary Bilingual Title laid flat into the isometric plane:
  // 天际生长 · 上海 | SHANGHAI RISING SKYLINE
  ctx.fillStyle = '#0F172A';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 25px "Noto Sans SC", "Noto Sans CJK SC", sans-serif';
  ctx.fillText('天际生长 · 上海', 0, -14);

  // Subtle champagne divider rule
  ctx.strokeStyle = 'rgba(200, 150, 70, 0.55)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-145, 5);
  ctx.lineTo(145, 5);
  ctx.stroke();

  // English architectural subtitle
  ctx.fillStyle = '#334155';
  ctx.font = '600 13.5px "Outfit", "Liberation Sans", sans-serif';
  ctx.fillText('SHANGHAI RISING SKYLINE  ·  30° AXONOMETRIC', 0, 23);

  ctx.restore();
}

/**
 * Draw volumetric isometric clouds on a given parallax plane
 */
function drawParallaxClouds(
  ctx: CanvasRenderingContext2D,
  t: number,
  parallaxOffset: { x: number; y: number },
  originX: number,
  originY: number,
  tileUnit: number,
  layer: 'foreground' | 'background'
): void {
  const clouds =
    layer === 'foreground'
      ? [
          { gx: -4.2, gy: 3.2, gz: 3.8, w: 2.1, d: 0.75, speed: 0.16, alpha: 0.68 },
          { gx: 3.6, gy: -2.6, gz: 4.5, w: 2.4, d: 0.82, speed: -0.14, alpha: 0.62 },
          { gx: -2.6, gy: -3.8, gz: 3.2, w: 1.7, d: 0.65, speed: 0.12, alpha: 0.52 },
        ]
      : [
          { gx: -5.5, gy: -4.5, gz: 2.2, w: 2.8, d: 0.9, speed: 0.08, alpha: 0.42 },
          { gx: 4.8, gy: -4.8, gz: 2.8, w: 2.5, d: 0.8, speed: -0.07, alpha: 0.38 },
        ];

  const appear = easeInOutCubic(remap01(t, 4.2, 5.4));
  if (appear <= 0.01) return;

  ctx.save();
  for (const c of clouds) {
    const curGx = c.gx + (t - 4.0) * c.speed;
    const alpha = c.alpha * appear;
    drawIsoPrism(
      ctx,
      curGx,
      c.gy,
      c.gz,
      c.w,
      c.d,
      0.16,
      originX + parallaxOffset.x,
      originY + parallaxOffset.y,
      tileUnit,
      `rgba(255, 255, 255, ${alpha})`,
      `rgba(241, 245, 249, ${alpha * 0.9})`,
      `rgba(218, 228, 240, ${alpha * 0.85})`
    );
  }
  ctx.restore();
}

/**
 * Render a single sub-frame at exact time `t` (in seconds).
 */
function renderSubFrame(
  ctx: CanvasRenderingContext2D,
  t: number,
  width: number,
  height: number,
  options: RenderOptions
): void {
  const cam = computeCameraState(t);
  const baseTileUnit = (width / 1920) * 58 * cam.zoom;
  const centerOriginX = width * 0.5;
  const centerOriginY = height * (0.58 - cam.islandPullbackProgress * 0.065);

  // 1. Sky Background Gradient (Soft Shanghai Sky-Blue to Pearl Grey)
  const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
  skyGrad.addColorStop(0, '#EAF1F8');
  skyGrad.addColorStop(0.52, '#E1EBF5');
  skyGrad.addColorStop(1, '#D5E0EC');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Background Layer (0.6x Parallax Speed Ratio): Distant Bund Horizon & Subtle Iso Grid
  const bgOriginX = centerOriginX + cam.parallax.background.x;
  const bgOriginY = centerOriginY + cam.parallax.background.y;

  // Subtle architectural isometric grid lines in background void
  ctx.save();
  ctx.strokeStyle = 'rgba(130, 152, 178, 0.11)';
  ctx.lineWidth = 1;
  for (let g = -12; g <= 12; g += 2) {
    const pA = projectIsoPoint(g, -12, -0.5, bgOriginX, bgOriginY, baseTileUnit);
    const pB = projectIsoPoint(g, 12, -0.5, bgOriginX, bgOriginY, baseTileUnit);
    ctx.beginPath();
    ctx.moveTo(pA.x, pA.y);
    ctx.lineTo(pB.x, pB.y);
    ctx.stroke();

    const pC = projectIsoPoint(-12, g, -0.5, bgOriginX, bgOriginY, baseTileUnit);
    const pD = projectIsoPoint(12, g, -0.5, bgOriginX, bgOriginY, baseTileUnit);
    ctx.beginPath();
    ctx.moveTo(pC.x, pC.y);
    ctx.lineTo(pD.x, pD.y);
    ctx.stroke();
  }
  ctx.restore();

  // Distant Puxi / Bund silhouette blocks on the 0.6x background layer (visible during 2-10s)
  const bgAppear = easeOutCubic(remap01(t, 1.8, 3.2)) * (1 - cam.islandPullbackProgress * 0.55);
  if (bgAppear > 0.02) {
    ctx.save();
    ctx.globalAlpha = bgAppear * 0.48;
    const bundBlocks = [
      { gx: -6.8, gy: -2.5, w: 0.9, d: 0.9, h: 1.4 },
      { gx: -6.8, gy: -1.1, w: 0.85, d: 1.1, h: 1.85 },
      { gx: -6.8, gy: 0.3, w: 0.9, d: 0.9, h: 1.25 },
      { gx: -5.8, gy: -3.8, w: 0.9, d: 0.9, h: 1.55 },
      { gx: -4.2, gy: -5.6, w: 1.0, d: 0.9, h: 1.7 },
    ];
    for (const b of bundBlocks) {
      drawIsoPrism(
        ctx,
        b.gx,
        b.gy,
        0,
        b.w,
        b.d,
        b.h,
        bgOriginX,
        bgOriginY,
        baseTileUnit,
        '#E2EBF3',
        '#CFDCE8',
        '#B8C8D8'
      );
    }
    ctx.restore();
  }

  drawParallaxClouds(ctx, t, cam.parallax.background, centerOriginX, centerOriginY, baseTileUnit, 'background');

  // 3. Midground Layer (0.8x Parallax Speed Ratio): Main Lujiazui Diorama Island
  const midOriginX = centerOriginX + cam.parallax.midground.x;
  const midOriginY = centerOriginY + cam.parallax.midground.y;

  // Floating Lujiazui Island Plinth Base (revealed progressively from t = 0.02s so hook frame is anchored)
  const plinthAppear = easeOutCubic(remap01(t, 0.02, 1.25));
  if (plinthAppear > 0.01) {
    // Soft ambient shadow floating in the pale void below the island
    const shadowCenter = projectIsoPoint(0, 0, -1.15, midOriginX, midOriginY, baseTileUnit);
    ctx.save();
    const voidShadow = ctx.createRadialGradient(
      shadowCenter.x,
      shadowCenter.y,
      baseTileUnit * 1.2,
      shadowCenter.x,
      shadowCenter.y,
      baseTileUnit * 8.2
    );
    voidShadow.addColorStop(0, `rgba(71, 95, 126, ${0.22 * plinthAppear})`);
    voidShadow.addColorStop(1, 'rgba(71, 95, 126, 0)');
    ctx.fillStyle = voidShadow;
    ctx.beginPath();
    ctx.ellipse(
      shadowCenter.x,
      shadowCenter.y,
      baseTileUnit * 8.2,
      baseTileUnit * 4.4,
      0,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.restore();

    // Sub-surface architectural island plinth strata
    drawIsoPrism(
      ctx,
      0,
      0,
      -0.58 * plinthAppear,
      9.25 * plinthAppear,
      9.25 * plinthAppear,
      0.34 * plinthAppear,
      midOriginX,
      midOriginY,
      baseTileUnit,
      '#DDE5EE',
      '#B8C6D6',
      '#94A6BC'
    );
    drawIsoPrism(
      ctx,
      0,
      0,
      -0.24 * plinthAppear,
      9.08 * plinthAppear,
      9.08 * plinthAppear,
      0.24 * plinthAppear,
      midOriginX,
      midOriginY,
      baseTileUnit,
      '#EBF0F6',
      '#CBD6E2',
      '#A8B8CC',
      'rgba(148, 163, 184, 0.45)',
      0.8
    );
  }

  // Collect all Z-sortable midground entities (81 foundation tiles, viaducts, metro trains, 24 skyscrapers, Oriental Pearl Tower)
  const zSortableItems: ZSortableItem[] = [];

  // 3A. 81 Urban Foundation Tiles (0–2s radial drop & ripple outward with tiny bounces)
  for (const tile of SCENE_TILES) {
    // Allow pre-drop mid-air entry starting 0.24s before tile.startTime so kf_01 (0.30s) shows a rich concentric wave
    const localProgress = remap01(t, tile.startTime - 0.18, tile.startTime + 0.44);
    if (localProgress <= 0) continue;

    const bounce = tileDropBounce(localProgress);
    const tileZOrder = computeScreenYZOrder(tile.gx, tile.gy, midOriginY, baseTileUnit, -10);

    zSortableItems.push({
      zOrder: tileZOrder,
      draw: (ctx) => {
        const dropZ = (bounce.dropZ / 58);
        const w = 0.94 * bounce.scale;
        const d = 0.94 * bounce.scale;
        const h = tile.elevation;

        let topCol = '#F3F6FA';
        let leftCol = '#DCE4EE';
        let rightCol = '#C2CEDE';

        if (tile.tileType === 'river') {
          // Animated Huangpu River cerulean water shimmer
          const wave = 0.5 + 0.5 * Math.sin(t * 3.2 + tile.gx * 0.9 + tile.gy * 0.7);
          topCol = wave > 0.5 ? '#C5DCF0' : '#B9D3EB';
          leftCol = '#9EC0DF';
          rightCol = '#84ACCFE6';
        } else if (tile.tileType === 'park') {
          topCol = '#D1E7DD';
          leftCol = '#B4D6C6';
          rightCol = '#95BFA9';
        } else if (tile.tileType === 'avenue') {
          topCol = '#E4ECF5';
          leftCol = '#CBD7E6';
          rightCol = '#B0C0D4';
        } else if (tile.tileType === 'podium') {
          topCol = '#F8FAFC';
          leftCol = '#E2E8F0';
          rightCol = '#C6D2E1';
        }

        drawIsoPrism(
          ctx,
          tile.gx,
          tile.gy,
          dropZ,
          w,
          d,
          h,
          midOriginX,
          midOriginY,
          baseTileUnit,
          topCol,
          leftCol,
          rightCol,
          'rgba(148, 163, 184, 0.32)',
          0.65
        );

        // Landing ripple highlight ring on impact
        if (bounce.rippleIntensity > 0.08) {
          const topPt = projectIsoPoint(
            tile.gx,
            tile.gy,
            dropZ + h + 0.01,
            midOriginX,
            midOriginY,
            baseTileUnit
          );
          ctx.save();
          ctx.strokeStyle = `rgba(212, 163, 89, ${bounce.rippleIntensity * 0.65})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.ellipse(
            topPt.x,
            topPt.y,
            baseTileUnit * 0.42,
            baseTileUnit * 0.24,
            0,
            0,
            Math.PI * 2
          );
          ctx.stroke();
          ctx.restore();
        }
      },
    });
  }

  // 3B. Elevated Metro Viaducts, Mini-Trains & Drifting Light Streaks
  populateMetroAndFlowItems(zSortableItems, t, midOriginX, midOriginY, baseTileUnit);

  // 3C. 24 Surrounding Annual High-Rise Skyscrapers
  for (const tower of SCENE_TOWERS) {
    if (t < tower.startTime) continue;
    const zKey = computeScreenYZOrder(tower.gx, tower.gy, midOriginY, baseTileUnit, 0);
    zSortableItems.push({
      zOrder: zKey,
      draw: (ctx) => {
        drawSkyscraper(ctx, tower, t, midOriginX, midOriginY, baseTileUnit);
        if (options.showZOrderLabels) {
          const pt = projectIsoPoint(
            tower.gx,
            tower.gy,
            tower.height + 0.5,
            midOriginX,
            midOriginY,
            baseTileUnit
          );
          ctx.fillStyle = '#1E293B';
          ctx.font = '600 10px "JetBrains Mono", monospace';
          ctx.fillText(`Z:${Math.round(zKey)}`, pt.x - 14, pt.y);
        }
      },
    });
  }

  // 3D. Hero Landmark: The Oriental Pearl Tower at prominent unobstructed riverfront plaza (gx: -1.65, gy: 2.05)
  if (t >= 2.90) {
    const pearlZKey = computeScreenYZOrder(-1.65, 2.05, midOriginY, baseTileUnit, 2);
    zSortableItems.push({
      zOrder: pearlZKey,
      draw: (ctx) => {
        drawOrientalPearlTower(ctx, t, midOriginX, midOriginY, baseTileUnit);
      },
    });
  }

  // Sort all midground entities strictly back-to-front by screen-Y Z-order
  zSortableItems.sort((a, b) => a.zOrder - b.zOrder);
  for (const item of zSortableItems) {
    item.draw(ctx);
  }

  // 4. Foreground Layer (1.0x Parallax Speed Ratio): Volumetric Clouds & Isometric Title Card
  drawParallaxClouds(ctx, t, cam.parallax.foreground, centerOriginX, centerOriginY, baseTileUnit, 'foreground');

  // 8–10s Isometric Title Card laid flat into the isometric plane
  drawIsometricTitleCard(ctx, t, midOriginX, midOriginY, baseTileUnit);

  // Optional Interactive Studio Overlays (for Web Workstation inspection mode only; off during video.mp4 render)
  if (options.showDebugGrid) {
    ctx.save();
    const ssrDemo = getSSRFaceMatrix('top', 140, 120);
    ctx.strokeStyle = 'rgba(37, 99, 235, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(width * 0.05, height * 0.05, width * 0.9, height * 0.9);
    ctx.setLineDash([]);
    ctx.fillStyle = '#1E293B';
    ctx.font = '500 12px "JetBrains Mono", monospace';
    ctx.fillText(
      `SSR TOP MATRIX: [${ssrDemo.a.toFixed(3)}, ${ssrDemo.b.toFixed(3)}, ${ssrDemo.c.toFixed(3)}, ${ssrDemo.d.toFixed(3)}] | 5% SAFE MARGIN`,
      width * 0.05 + 12,
      height * 0.05 + 22
    );
    ctx.restore();
  }

  if (options.showParallaxVectors) {
    ctx.save();
    const hudX = width * 0.05 + 16;
    const hudY = height * 0.84;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.fillRect(hudX, hudY, 320, 86);
    ctx.fillStyle = '#F8FAFC';
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillText(`PARALLAX SPEED RATIO (FG : MID : BG = 1 : 0.8 : 0.6)`, hudX + 12, hudY + 22);
    ctx.fillStyle = '#38BDF8';
    ctx.fillText(`FG  (1.0x): dX = ${cam.parallax.foreground.x.toFixed(1)}px`, hudX + 12, hudY + 42);
    ctx.fillStyle = '#FBBF24';
    ctx.fillText(`MID (0.8x): dX = ${cam.parallax.midground.x.toFixed(1)}px`, hudX + 12, hudY + 60);
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(`BG  (0.6x): dX = ${cam.parallax.background.x.toFixed(1)}px`, hudX + 12, hudY + 78);
    ctx.restore();
  }
}

/**
 * Main deterministic entry point: Render frame `frameIndex` (0..299) or exact time `t` (0..10.0s).
 * Supports multi-sample temporal motion blur for fast drops, pops, and camera slides.
 */
export function renderIsometricFrame(
  ctx: CanvasRenderingContext2D,
  frameIndex: number,
  options: RenderOptions = {}
): void {
  const width = options.width ?? 1920;
  const height = options.height ?? 1080;
  const subSamples = options.motionBlurSamples ?? 1;
  const baseTime = clamp(frameIndex / FPS, 0, 10.0);

  if (subSamples <= 1) {
    renderSubFrame(ctx, baseTime, width, height, options);
  } else {
    // Shutter angle 180° (0.5 / FPS) multi-sample accumulation
    const shutterDuration = 0.5 / FPS;
    ctx.save();
    for (let s = 0; s < subSamples; s++) {
      const offset = (s / (subSamples - 1) - 0.5) * shutterDuration;
      const sampleTime = clamp(baseTime + offset, 0, 10.0);
      ctx.globalAlpha = s === 0 ? 1.0 : 1.0 / (s + 1);
      renderSubFrame(ctx, sampleTime, width, height, options);
    }
    ctx.restore();
  }

  // Subtle deterministic micro-grain / vignette finishing pass to prevent 8-bit H.264 gradient banding
  const vig = ctx.createRadialGradient(
    width * 0.5,
    height * 0.5,
    width * 0.32,
    width * 0.5,
    height * 0.5,
    width * 0.68
  );
  vig.addColorStop(0, 'rgba(15, 23, 42, 0)');
  vig.addColorStop(1, 'rgba(15, 23, 42, 0.045)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, width, height);
}

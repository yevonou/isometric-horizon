/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  constCOS_30,
  SIN_30,
  mulberry32,
  getSSRFaceMatrix,
  applySSR,
  projectIsoPoint,
  computeScreenYZOrder,
  computeBuildingGrowth,
  computeCameraState,
  tileDropBounce,
} from './isoMath';
import {
  generateFoundationTiles,
  generateSkyscrapers,
  CUE_SHEET,
  KEYFRAME_SPECS,
} from './shanghaiScene';

test('SSR isometric top-face formula matches exact 30° axonometric projection', () => {
  const topMatrix = getSSRFaceMatrix('top', 0, 0);
  // Unit step along +u should project to (+cos 30°, +sin 30°)
  const uVec = applySSR(topMatrix, 1, 0);
  assert.ok(Math.abs(uVec.x - constCOS_30) < 1e-6, `Expected uVec.x ≈ ${constCOS_30}, got ${uVec.x}`);
  assert.ok(Math.abs(uVec.y - SIN_30) < 1e-6, `Expected uVec.y ≈ ${SIN_30}, got ${uVec.y}`);

  // Unit step along +v should project to (-cos 30°, +sin 30°)
  const vVec = applySSR(topMatrix, 0, 1);
  assert.ok(Math.abs(vVec.x - -constCOS_30) < 1e-6, `Expected vVec.x ≈ ${-constCOS_30}, got ${vVec.x}`);
  assert.ok(Math.abs(vVec.y - SIN_30) < 1e-6, `Expected vVec.y ≈ ${SIN_30}, got ${vVec.y}`);
});

test('Fake 3D Z-sorting derives strictly from screen Y coordinate along 2:1 slope', () => {
  const backZ = computeScreenYZOrder(-3, -3, 540, 44, 0);
  const midZ = computeScreenYZOrder(0, 0, 540, 44, 0);
  const frontZ = computeScreenYZOrder(3, 3, 540, 44, 0);
  assert.ok(backZ < midZ, 'Back tile must have smaller Z-order than center tile');
  assert.ok(midZ < frontZ, 'Center tile must have smaller Z-order than front tile');
});

test('Building grow choreography enforces base-first landing, facade overshoot, and 2-3 frame roof delay', () => {
  const startTime = 2.0;
  const growDur = 0.54;

  // Before start
  const pre = computeBuildingGrowth(1.9, startTime, growDur);
  assert.equal(pre.active, false);
  assert.equal(pre.facadeScaleY, 0);

  // At +0.05s: Base is landing, facade has NOT started extruding yet
  const baseStage = computeBuildingGrowth(startTime + 0.05, startTime, growDur);
  assert.equal(baseStage.active, true);
  assert.ok(baseStage.baseScale > 0.3, 'Base must be scaling in first');
  assert.equal(baseStage.facadeScaleY, 0, 'Facade must wait for base landing');
  assert.equal(baseStage.roofCapScale, 0, 'Roof cap must still be 0');

  // Near facade peak (+0.38s): Facade overshoots > 1.04 while roof cap is delayed by 2.5 frames
  const peakStage = computeBuildingGrowth(startTime + 0.38, startTime, growDur);
  assert.ok(peakStage.facadeScaleY > 1.04, `Expected facade overshoot > 1.04, got ${peakStage.facadeScaleY}`);
  assert.equal(peakStage.roofCapScale, 0, 'Roof cap must remain delayed while facade hits initial peak');

  // After roof delay (+0.58s): Roof cap pops in with overshoot
  const roofStage = computeBuildingGrowth(startTime + 0.58, startTime, growDur);
  assert.ok(roofStage.roofCapScale > 0.5, 'Roof cap must pop in after 2.5-frame delay');

  // Settled (+1.8s): All scales settle cleanly to 1.0
  const settled = computeBuildingGrowth(startTime + 1.8, startTime, growDur);
  assert.equal(settled.facadeScaleY, 1);
  assert.equal(settled.roofCapScale, 1);
  assert.equal(settled.windowLightProgress, 1);
});

test('Camera enforces zero rotation and exact 1 : 0.8 : 0.6 parallax ratios across all 300 frames', () => {
  for (let frame = 0; frame < 300; frame++) {
    const t = frame / 30;
    const cam = computeCameraState(t);
    assert.equal(cam.rotationDeg, 0, 'Camera rotation must remain strictly 0');
    assert.ok(
      Math.abs(cam.parallax.midground.x - cam.parallax.foreground.x * 0.8) < 1e-6,
      'Midground X parallax must be exactly 0.8x foreground'
    );
    assert.ok(
      Math.abs(cam.parallax.background.x - cam.parallax.foreground.x * 0.6) < 1e-6,
      'Background X parallax must be exactly 0.6x foreground'
    );
  }
});

test('Scene data and cue sheet satisfy hook (<0.3s) and 10.000s timeline constraints', () => {
  const tiles = generateFoundationTiles();
  assert.equal(tiles.length, 81);
  const earliestTile = Math.min(...tiles.map((t) => t.startTime));
  assert.ok(earliestTile < 0.1, `Opening hook must start within 0.1s, got ${earliestTile}`);

  const towers = generateSkyscrapers();
  assert.equal(towers.length, 24);

  const rng1 = mulberry32(42);
  const rng2 = mulberry32(42);
  assert.equal(rng1(), rng2(), 'Seeded PRNG must be 100% deterministic');

  assert.ok(CUE_SHEET.length >= 10);
  assert.equal(KEYFRAME_SPECS.length, 8);
});

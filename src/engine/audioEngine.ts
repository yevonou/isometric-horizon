/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Deterministic 48kHz Stereo Audio Synthesis & Sound Design Engine
 * for 「天际生长 · 上海 | SHANGHAI RISING SKYLINE」
 *
 * Synthesizes:
 * 1. Bright, spacious FM marimba / glassy synth pluck melody in F Lydian (120 BPM)
 * 2. Crisp ceramic/wood clicks synced to the 0–2s foundation tile ripple
 * 3. Deep architectural sub-thuds + crystalline chimes synced to 2–5s building growth
 * 4. Three signature resonant glassy bell pops synced to the Oriental Pearl Tower spheres (3.55s, 3.85s, 4.10s)
 * 5. Rhythmic pulse & high-tech rail glide for 5–8s city micro-life
 * 6. Wide stereo airy whoosh + Fmaj9(#11) harmonic resolution on the 8–10s island pull-back
 */

import { clamp, mulberry32 } from './isoMath';
import { generateFoundationTiles, generateSkyscrapers } from './shanghaiScene';

export const SAMPLE_RATE = 48000;
export const AUDIO_DURATION = 10.0;
export const TOTAL_SAMPLES = SAMPLE_RATE * AUDIO_DURATION; // 480,000 stereo frames

export interface StemLevels {
  marimbaMelody: number;
  tileAndBuildingHits: number;
  sphereAndWindowSparkles: number;
  padAndAiryWhoosh: number;
  masterLufsMomentary: number;
}

// F Lydian scale frequencies (F, G, A, B, C, D, E) across octaves 3..6
const NOTE_FREQ: Record<string, number> = {
  F2: 87.31,
  G2: 98.0,
  A2: 110.0,
  C3: 130.81,
  F3: 174.61,
  G3: 196.0,
  A3: 220.0,
  B3: 246.94,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  B4: 493.88,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
  A5: 880.0,
  B5: 987.77,
  C6: 1046.5,
  E6: 1318.51,
};

interface MelodyNote {
  time: number;
  note: string;
  vel: number;
  pan: number;
  dur: number;
}

/**
 * Compose the F-Lydian architectural FM marimba / glassy synth pluck score (120 BPM, 16th = 0.125s)
 */
export function getScoreNotes(): MelodyNote[] {
  const notes: MelodyNote[] = [
    // Act I (0-2s): Spacious opening pluck motif synced with radial tile ripple
    { time: 0.04, note: 'F4', vel: 0.78, pan: 0.0, dur: 0.45 },
    { time: 0.29, note: 'C5', vel: 0.65, pan: -0.25, dur: 0.4 },
    { time: 0.54, note: 'G4', vel: 0.7, pan: 0.25, dur: 0.4 },
    { time: 0.79, note: 'A4', vel: 0.72, pan: -0.3, dur: 0.45 },
    { time: 1.04, note: 'B4', vel: 0.76, pan: 0.3, dur: 0.45 },
    { time: 1.29, note: 'C5', vel: 0.8, pan: -0.2, dur: 0.5 },
    { time: 1.54, note: 'E5', vel: 0.74, pan: 0.2, dur: 0.5 },
    { time: 1.79, note: 'D5', vel: 0.68, pan: 0.0, dur: 0.45 },

    // Act II (2-5s): Ascending architectural arpeggios rising with the skyscrapers
    { time: 2.02, note: 'F4', vel: 0.82, pan: -0.35, dur: 0.45 },
    { time: 2.25, note: 'A4', vel: 0.74, pan: 0.35, dur: 0.4 },
    { time: 2.50, note: 'C5', vel: 0.78, pan: -0.25, dur: 0.45 },
    { time: 2.75, note: 'E5', vel: 0.82, pan: 0.25, dur: 0.5 },
    { time: 3.00, note: 'G5', vel: 0.85, pan: -0.3, dur: 0.55 },
    { time: 3.25, note: 'F5', vel: 0.78, pan: 0.3, dur: 0.45 },
    // Oriental Pearl Tower sphere climax notes
    { time: 3.55, note: 'C5', vel: 0.92, pan: -0.15, dur: 0.65 },
    { time: 3.85, note: 'E5', vel: 0.94, pan: 0.15, dur: 0.65 },
    { time: 4.10, note: 'B5', vel: 0.96, pan: 0.0, dur: 0.75 },
    { time: 4.30, note: 'C6', vel: 0.88, pan: 0.2, dur: 0.8 },
    { time: 4.62, note: 'G5', vel: 0.74, pan: -0.25, dur: 0.5 },
    { time: 4.85, note: 'E5', vel: 0.72, pan: 0.25, dur: 0.5 },

    // Act III (5-8s): Hero City Micro-Life — driving, uplifting 8th/16th interlocking glassy marimba pattern
    { time: 5.00, note: 'F4', vel: 0.86, pan: -0.4, dur: 0.45 },
    { time: 5.125, note: 'C5', vel: 0.68, pan: 0.4, dur: 0.35 },
    { time: 5.25, note: 'E5', vel: 0.78, pan: -0.25, dur: 0.4 },
    { time: 5.50, note: 'G5', vel: 0.85, pan: 0.3, dur: 0.45 },
    { time: 5.75, note: 'A5', vel: 0.88, pan: -0.3, dur: 0.5 },
    { time: 6.00, note: 'B5', vel: 0.9, pan: 0.35, dur: 0.55 },
    { time: 6.25, note: 'G5', vel: 0.78, pan: -0.35, dur: 0.45 },
    { time: 6.50, note: 'E5', vel: 0.82, pan: 0.25, dur: 0.45 },
    { time: 6.75, note: 'C5', vel: 0.76, pan: -0.25, dur: 0.45 },
    { time: 7.00, note: 'D5', vel: 0.84, pan: 0.3, dur: 0.5 },
    { time: 7.25, note: 'E5', vel: 0.86, pan: -0.3, dur: 0.5 },
    { time: 7.50, note: 'G5', vel: 0.88, pan: 0.2, dur: 0.55 },
    { time: 7.75, note: 'B5', vel: 0.84, pan: -0.2, dur: 0.6 },

    // Act IV (8-10s): Spacious pull-back & final luminous Fmaj9(#11) chord resolution
    { time: 8.15, note: 'C5', vel: 0.78, pan: -0.35, dur: 1.2 },
    { time: 8.35, note: 'G5', vel: 0.76, pan: 0.35, dur: 1.2 },
    { time: 8.60, note: 'F4', vel: 0.88, pan: -0.2, dur: 1.35 },
    { time: 8.62, note: 'A4', vel: 0.82, pan: 0.2, dur: 1.35 },
    { time: 8.64, note: 'E5', vel: 0.85, pan: -0.3, dur: 1.32 },
    { time: 8.66, note: 'G5', vel: 0.84, pan: 0.3, dur: 1.3 },
    { time: 8.68, note: 'B5', vel: 0.8, pan: 0.0, dur: 1.28 },
  ];
  return notes;
}

/**
 * Compute real-time stem envelope levels at time `t` for the Studio UI audio visualizer
 */
export function getAudioEnvelopeAtTime(t: number): StemLevels {
  const time = clamp(t, 0, AUDIO_DURATION);
  const notes = getScoreNotes();

  let marimba = 0.08;
  for (const n of notes) {
    const dt = time - n.time;
    if (dt >= 0 && dt < n.dur) {
      marimba = Math.max(marimba, n.vel * Math.exp(-4.5 * dt));
    }
  }

  let hits = 0.04;
  if (time < 2.0) {
    hits = 0.45 + 0.35 * Math.abs(Math.sin(time * 18));
  } else if (time >= 2.0 && time <= 4.7) {
    hits = 0.55 + 0.4 * Math.abs(Math.cos(time * 10));
  }

  let sparkles = 0.05;
  if (time >= 3.5 && time <= 8.2) {
    sparkles = 0.4 + 0.5 * Math.abs(Math.sin((time - 3.5) * 9.5));
  }

  let padWhoosh = 0.25 + 0.2 * Math.sin((time / 10) * Math.PI);
  if (time >= 7.9 && time <= 9.1) {
    padWhoosh = 0.88 * Math.sin(((time - 7.9) / 1.2) * Math.PI) + 0.25;
  }

  return {
    marimbaMelody: clamp(marimba, 0, 1),
    tileAndBuildingHits: clamp(hits, 0, 1),
    sphereAndWindowSparkles: clamp(sparkles, 0, 1),
    padAndAiryWhoosh: clamp(padWhoosh, 0, 1),
    masterLufsMomentary: -15.2 + (marimba * 1.4 + hits * 1.1 + padWhoosh * 0.8),
  };
}

/**
 * Synthesize the complete 10.000s stereo 48kHz audio buffer deterministically.
 * Returns interleaved Float32Array [L0, R0, L1, R1, ...] of length TOTAL_SAMPLES * 2.
 */
export function synthesizeMasterAudio(): { left: Float32Array; right: Float32Array } {
  const left = new Float32Array(TOTAL_SAMPLES);
  const right = new Float32Array(TOTAL_SAMPLES);

  const addStereoSample = (idx: number, valL: number, valR: number) => {
    if (idx >= 0 && idx < TOTAL_SAMPLES) {
      left[idx] += valL;
      right[idx] += valR;
    }
  };

  // Helper: Synthesize an FM Glassy Marimba / Pluck note with stereo ping-pong echo
  const renderFMPluck = (
    startTime: number,
    freq: number,
    vel: number,
    pan: number,
    duration: number
  ) => {
    const startIdx = Math.floor(startTime * SAMPLE_RATE);
    const lenSamples = Math.floor(duration * SAMPLE_RATE);
    const gainL = vel * 0.22 * Math.cos(((pan + 1) * Math.PI) / 4);
    const gainR = vel * 0.22 * Math.sin(((pan + 1) * Math.PI) / 4);

    // 2-operator FM: carrier = freq, modulator = freq * 4.0 (woody/glassy marimba harmonic)
    const modFreq = freq * 4.0;
    for (let i = 0; i < lenSamples; i++) {
      const t = i / SAMPLE_RATE;
      const env = Math.min(1, t / 0.003) * Math.exp(-5.8 * t);
      const modEnv = Math.exp(-28.0 * t) * 2.4;
      const mod = Math.sin(2 * Math.PI * modFreq * t) * modEnv;
      // Add fundamental + warm 2nd harmonic + transient mallet click
      const click = Math.exp(-180 * t) * Math.sin(2 * Math.PI * 2400 * t) * 0.25;
      const sig =
        (Math.sin(2 * Math.PI * freq * t + mod) * 0.82 +
          Math.sin(2 * Math.PI * freq * 2 * t) * 0.18 +
          click) *
        env;

      addStereoSample(startIdx + i, sig * gainL, sig * gainR);

      // Dotted-16th stereo ping-pong delay (0.1875s) for spacious architectural depth
      const delaySamples = Math.floor(0.1875 * SAMPLE_RATE);
      addStereoSample(
        startIdx + i + delaySamples,
        sig * gainR * 0.28,
        sig * gainL * 0.32
      );
      addStereoSample(
        startIdx + i + delaySamples * 2,
        sig * gainL * 0.14,
        sig * gainR * 0.14
      );
    }
  };

  // 1. Render all F-Lydian FM Marimba Score Notes
  const scoreNotes = getScoreNotes();
  for (const n of scoreNotes) {
    const freq = NOTE_FREQ[n.note] ?? 440;
    renderFMPluck(n.time, freq, n.vel, n.pan, n.dur);
  }

  // 2. Render 0–2s Urban Foundation Tile Landing Clicks (synced to radial tile ripple)
  const tiles = generateFoundationTiles();
  // Select 28 representative radial wave hits so clicks sound crisp and musical, never muddy
  const sortedTiles = [...tiles].sort((a, b) => a.startTime - b.startTime);
  for (let idx = 0; idx < sortedTiles.length; idx += 3) {
    const tile = sortedTiles[idx];
    const startIdx = Math.floor(tile.startTime * SAMPLE_RATE);
    const bounceDelayIdx = Math.floor((tile.startTime + 0.21) * SAMPLE_RATE);
    const pan = clamp(tile.gx / 4.5, -0.75, 0.75);
    const pitch = 680 + tile.distFromCenter * 145;
    const gainL = 0.11 * (1 - pan * 0.5);
    const gainR = 0.11 * (1 + pan * 0.5);

    const clickLen = Math.floor(0.065 * SAMPLE_RATE);
    for (let i = 0; i < clickLen; i++) {
      const t = i / SAMPLE_RATE;
      const env = Math.exp(-75 * t);
      const sig =
        (Math.sin(2 * Math.PI * pitch * t) +
          0.5 * Math.sin(2 * Math.PI * pitch * 2.71 * t)) *
        env;
      addStereoSample(startIdx + i, sig * gainL, sig * gainR);
      // Tiny rebound bounce tick
      addStereoSample(bounceDelayIdx + i, sig * gainL * 0.32, sig * gainR * 0.32);
    }
  }

  // 3. Render 2–5s Skyscraper Base Landing Deep Thuds & Roof Cap Micro-Pops
  const towers = generateSkyscrapers();
  for (const tw of towers) {
    const startIdx = Math.floor(tw.startTime * SAMPLE_RATE);
    const pan = clamp((tw.gx - tw.gy) / 6.0, -0.65, 0.65);
    const isSupertall = tw.height > 4.2;
    const thudGain = isSupertall ? 0.24 : 0.13;
    const gainL = thudGain * (1 - pan * 0.4);
    const gainR = thudGain * (1 + pan * 0.4);

    // Deep pitch-envelope sub-thud + crisp architectural snap
    const thudLen = Math.floor(0.22 * SAMPLE_RATE);
    for (let i = 0; i < thudLen; i++) {
      const t = i / SAMPLE_RATE;
      const env = Math.min(1, t / 0.002) * Math.exp(-18 * t);
      const instPhase = 2 * Math.PI * (58 * t + 3.5 * (1 - Math.exp(-35 * t)));
      const snap = Math.exp(-120 * t) * Math.sin(2 * Math.PI * 1100 * t) * 0.35;
      const sig = (Math.sin(instPhase) + snap) * env;
      addStereoSample(startIdx + i, sig * gainL, sig * gainR);
    }

    // Delayed roof-cap micro-chime
    const roofStart = tw.startTime + 0.07 + tw.growDuration * 0.62 + 2.5 / 30;
    const roofIdx = Math.floor(roofStart * SAMPLE_RATE);
    const chimeFreq = 1046.5 + (tw.cohortYear - 2021) * 110;
    const chimeLen = Math.floor(0.14 * SAMPLE_RATE);
    for (let i = 0; i < chimeLen; i++) {
      const t = i / SAMPLE_RATE;
      const env = Math.exp(-32 * t);
      const sig = Math.sin(2 * Math.PI * chimeFreq * t) * env * 0.055;
      addStereoSample(roofIdx + i, sig * (1 - pan * 0.4), sig * (1 + pan * 0.4));
    }
  }

  // 4. Render Oriental Pearl Tower Climax: 3 Sequential Sphere Pops (3.55s, 3.85s, 4.10s) + Spire Shimmer (4.28s)
  const spherePops = [
    { time: 3.55, f0: 523.25, f1: 783.99, pan: -0.15 },
    { time: 3.85, f0: 659.25, f1: 987.77, pan: 0.15 },
    { time: 4.10, f0: 783.99, f1: 1174.66, pan: 0.0 },
    { time: 4.28, f0: 1046.5, f1: 1567.98, pan: 0.05 },
  ];
  for (const sp of spherePops) {
    const startIdx = Math.floor(sp.time * SAMPLE_RATE);
    const popLen = Math.floor(0.38 * SAMPLE_RATE);
    for (let i = 0; i < popLen; i++) {
      const t = i / SAMPLE_RATE;
      const env = Math.min(1, t / 0.002) * Math.exp(-11 * t);
      // Upward pitch-bend bubble/bell pop + crystalline harmonic
      const freqGlide = sp.f0 + (sp.f1 - sp.f0) * (1 - Math.exp(-42 * t));
      const sig =
        (Math.sin(2 * Math.PI * freqGlide * t) * 0.7 +
          Math.sin(2 * Math.PI * sp.f1 * 2 * t) * 0.3 * Math.exp(-20 * t)) *
        env *
        0.24;
      addStereoSample(
        startIdx + i,
        sig * (1 - sp.pan * 0.4),
        sig * (1 + sp.pan * 0.4)
      );
    }
  }

  // 5. Warm Architectural F-Lydian Pad Bed (0.0s - 10.0s) + 8-10s Stereo Airy Whoosh
  const rng = mulberry32(90210);
  let lpNoiseL = 0;
  let lpNoiseR = 0;
  let bpStateL = 0;
  let bpStateR = 0;

  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;

    // Fade in in first 0.08s, smooth fade out in last 0.18s
    const masterFade =
      clamp(t / 0.08, 0, 1) * clamp((AUDIO_DURATION - t) / 0.18, 0, 1);

    // Warm Fmaj9(#11) harmonic pad bed (F2 + C3 + G3 + A3 + B3 + E4)
    const padEnv =
      0.065 *
      (0.55 + 0.45 * Math.sin((t / AUDIO_DURATION) * Math.PI)) *
      masterFade;
    const padL =
      (Math.sin(2 * Math.PI * NOTE_FREQ.F2 * t) * 0.38 +
        Math.sin(2 * Math.PI * NOTE_FREQ.C3 * t) * 0.26 +
        Math.sin(2 * Math.PI * NOTE_FREQ.A3 * t + 0.3) * 0.2 +
        Math.sin(2 * Math.PI * NOTE_FREQ.E4 * t + 0.7) * 0.16) *
      padEnv;
    const padR =
      (Math.sin(2 * Math.PI * NOTE_FREQ.F2 * t) * 0.38 +
        Math.sin(2 * Math.PI * NOTE_FREQ.G3 * t + 0.2) * 0.26 +
        Math.sin(2 * Math.PI * NOTE_FREQ.B3 * t + 0.5) * 0.2 +
        Math.sin(2 * Math.PI * NOTE_FREQ.E4 * t + 1.1) * 0.16) *
      padEnv;

    left[i] += padL;
    right[i] += padR;

    // 5-8s Subtle Metro Rail Harmonic Hum & City Flow Shimmer
    if (t >= 4.8 && t <= 8.4) {
      const flowEnv = Math.sin(((t - 4.8) / 3.6) * Math.PI) * 0.032;
      const panMod = Math.sin((t - 5.0) * 1.2);
      const railSig =
        Math.sin(2 * Math.PI * 261.63 * t) * 0.6 +
        Math.sin(2 * Math.PI * 523.25 * t) * 0.4;
      left[i] += railSig * flowEnv * (1 - panMod * 0.4);
      right[i] += railSig * flowEnv * (1 + panMod * 0.4);
    }

    // 8.0s - 9.2s Wide Stereo Airy Whoosh on the Final Parallel Pull-Back
    if (t >= 7.85 && t <= 9.35) {
      const u = (t - 7.85) / 1.5;
      const whooshEnv = Math.sin(u * Math.PI) * Math.pow(1 - u * 0.4, 1.5) * 0.14;
      const whiteL = rng() * 2 - 1;
      const whiteR = rng() * 2 - 1;

      // Swept resonant low-pass / band-pass filter
      const cutoff = 0.04 + 0.14 * Math.sin(u * Math.PI);
      lpNoiseL += cutoff * (whiteL - lpNoiseL);
      lpNoiseR += cutoff * (whiteR - lpNoiseR);
      bpStateL += cutoff * 0.5 * (lpNoiseL - bpStateL);
      bpStateR += cutoff * 0.5 * (lpNoiseR - bpStateR);

      const bandL = lpNoiseL - bpStateL;
      const bandR = lpNoiseR - bpStateR;

      left[i] += bandL * whooshEnv * masterFade;
      right[i] += bandR * whooshEnv * masterFade;
    }

    left[i] *= masterFade;
    right[i] *= masterFade;
  }

  return { left, right };
}

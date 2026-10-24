/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Procedural Shanghai Lujiazui Diorama Scene Architecture, Cue Sheet,
 * Keyframe Specifications, and Self-Critique / QC Metadata.
 */

import { mulberry32 } from './isoMath';

export interface FoundationTile {
  id: string;
  gx: number;
  gy: number;
  distFromCenter: number;
  startTime: number;
  tileType: 'plaza' | 'park' | 'river' | 'avenue' | 'podium';
  elevation: number;
}

export interface SkyscraperDef {
  id: string;
  name: string;
  cohortYear: number;
  gx: number;
  gy: number;
  footprintW: number;
  footprintD: number;
  height: number;
  startTime: number;
  growDuration: number;
  style:
    | 'supertall_twisted'
    | 'supertall_aperture'
    | 'supertall_stepped'
    | 'champagne_prism'
    | 'silver_fin'
    | 'terrace_cluster'
    | 'glass_monolith';
  roofStyle: 'helipad' | 'spire' | 'sloped' | 'crown_ring' | 'twin_antenna';
  tint: 'silver' | 'champagne' | 'sky_blue' | 'pearl';
  hasConstructionLift: boolean;
  windowSeed: number;
}

export interface OrientalPearlState {
  podiumProgress: number;
  strutsProgress: number;
  shaftScaleY: number;
  lowerSphereScale: number;
  midSphereScale: number;
  topSphereScale: number;
  spireScaleY: number;
  beaconPulse: number;
}

export interface CueEvent {
  id: string;
  timecode: string;
  timeSeconds: number;
  frame: number;
  section: '0–2s Foundation' | '2–5s Skyscraper Growth' | '5–8s City Micro-Life' | '8–10s Island Reveal';
  visualAction: string;
  soundAction: string;
  signatureTechnique: string;
  audioFreqHz: number;
  audioType: 'tile_click' | 'building_thud' | 'sphere_pop' | 'marimba_melody' | 'metro_glide' | 'airy_whoosh' | 'chord_resolve';
}

export interface KeyframeSpec {
  id: string;
  index: number;
  timeSeconds: number;
  frame: number;
  timecode: string;
  titleCn: string;
  titleEn: string;
  caption: string;
  compositionNote: string;
  imagePath: string;
}

export const GRID_HALF_SIZE = 4; // -4 to +4 = 9x9 = 81 isometric foundation tiles

/**
 * Generate the 81 deterministic foundation tiles of the Lujiazui & Huangpu River island grid.
 * Tiles ripple outward from the center between t = 0.04s and t = 1.65s.
 */
export function generateFoundationTiles(): FoundationTile[] {
  const tiles: FoundationTile[] = [];
  for (let gx = -GRID_HALF_SIZE; gx <= GRID_HALF_SIZE; gx++) {
    for (let gy = -GRID_HALF_SIZE; gy <= GRID_HALF_SIZE; gy++) {
      const dist = Math.hypot(gx, gy);
      // Hook starts at t = 0.02s so inner 5x5 ring is actively cascading & bouncing at t = 0.30s!
      const angle = Math.atan2(gy, gx);
      const spiralOffset = ((angle + Math.PI) / (2 * Math.PI)) * 0.06;
      const startTime = 0.02 + Math.pow(dist / 5.7, 1.15) * 1.38 + spiralOffset;

      let tileType: FoundationTile['tileType'] = 'plaza';
      let elevation = 0.16;

      // Huangpu River curve wrapping the western/southern riverfront edge
      if (gx <= -3 && gy >= -1) {
        tileType = 'river';
        elevation = 0.08;
      } else if (gy <= -3 && gx <= 0) {
        tileType = 'river';
        elevation = 0.08;
      } else if (gx === 0 || gy === 0 || gx === 3 || gy === 3) {
        tileType = 'avenue'; // Century Avenue & Scenic Perimeter Transit Ring
        elevation = 0.17;
      } else if (
        (Math.abs(gx - -1.5) <= 1.1 && Math.abs(gy - 1.5) <= 1.1) ||
        (gx === 1 && gy === -2)
      ) {
        tileType = 'park'; // Oriental Pearl Riverfront Green Plaza
        elevation = 0.19;
      } else if (Math.abs(gx) <= 2 && Math.abs(gy) <= 2) {
        tileType = 'podium';
        elevation = 0.22;
      }

      tiles.push({
        id: `tile_${gx}_${gy}`,
        gx,
        gy,
        distFromCenter: dist,
        startTime,
        tileType,
        elevation,
      });
    }
  }
  return tiles;
}

/**
 * Generate the 24 surrounding skyscrapers representing Shanghai's annual new tower cohorts.
 * Leaves the prominent Lujiazui riverfront plaza around (-1.55, 1.55) open as a visual stage
 * for the Oriental Pearl Tower tripod and spheres.
 */
export function generateSkyscrapers(): SkyscraperDef[] {
  const specs: Omit<SkyscraperDef, 'windowSeed'>[] = [
    // Cohort 2021-2022: Early perimeter & river-view towers (2.02s - 2.62s)
    {
      id: 'tw_01',
      name: 'Qiantan North Plaza',
      cohortYear: 2021,
      gx: -2.2,
      gy: -1.9,
      footprintW: 0.74,
      footprintD: 0.74,
      height: 2.55,
      startTime: 2.02,
      growDuration: 0.48,
      style: 'glass_monolith',
      roofStyle: 'helipad',
      tint: 'sky_blue',
      hasConstructionLift: false,
    },
    {
      id: 'tw_02',
      name: 'Pujiang Financial Tower',
      cohortYear: 2021,
      gx: -1.1,
      gy: -2.6,
      footprintW: 0.76,
      footprintD: 0.76,
      height: 2.85,
      startTime: 2.12,
      growDuration: 0.5,
      style: 'silver_fin',
      roofStyle: 'sloped',
      tint: 'silver',
      hasConstructionLift: false,
    },
    {
      id: 'tw_03',
      name: 'Harbor Gate West',
      cohortYear: 2021,
      gx: -2.6,
      gy: -0.6,
      footprintW: 0.72,
      footprintD: 0.72,
      height: 2.35,
      startTime: 2.20,
      growDuration: 0.46,
      style: 'terrace_cluster',
      roofStyle: 'crown_ring',
      tint: 'pearl',
      hasConstructionLift: false,
    },
    {
      id: 'tw_04',
      name: 'Binhai Exchange',
      cohortYear: 2022,
      gx: 0.2,
      gy: -2.8,
      footprintW: 0.78,
      footprintD: 0.78,
      height: 3.15,
      startTime: 2.28,
      growDuration: 0.52,
      style: 'champagne_prism',
      roofStyle: 'spire',
      tint: 'champagne',
      hasConstructionLift: true,
    },
    {
      id: 'tw_05',
      name: 'Century Link North',
      cohortYear: 2022,
      gx: 1.6,
      gy: -2.7,
      footprintW: 0.74,
      footprintD: 0.74,
      height: 2.75,
      startTime: 2.36,
      growDuration: 0.48,
      style: 'glass_monolith',
      roofStyle: 'twin_antenna',
      tint: 'sky_blue',
      hasConstructionLift: false,
    },
    {
      id: 'tw_06',
      name: 'Riverbend Atrium',
      cohortYear: 2022,
      gx: -1.2,
      gy: -0.8,
      footprintW: 0.75,
      footprintD: 0.75,
      height: 2.95,
      startTime: 2.44,
      growDuration: 0.5,
      style: 'silver_fin',
      roofStyle: 'helipad',
      tint: 'silver',
      hasConstructionLift: true,
    },
    {
      id: 'tw_07',
      name: 'Maritime Silk Plaza',
      cohortYear: 2022,
      gx: 2.7,
      gy: -2.1,
      footprintW: 0.72,
      footprintD: 0.72,
      height: 2.55,
      startTime: 2.54,
      growDuration: 0.48,
      style: 'terrace_cluster',
      roofStyle: 'sloped',
      tint: 'pearl',
      hasConstructionLift: false,
    },

    // Cohort 2023-2024: Supertall Trio & Lujiazui Core (2.62s - 3.38s)
    {
      id: 'tw_08',
      name: 'Jin-Crown Stepped Supertall',
      cohortYear: 2023,
      gx: 0.35,
      gy: -0.75,
      footprintW: 0.94,
      footprintD: 0.94,
      height: 4.85,
      startTime: 2.62,
      growDuration: 0.58,
      style: 'supertall_stepped',
      roofStyle: 'spire',
      tint: 'silver',
      hasConstructionLift: true,
    },
    {
      id: 'tw_09',
      name: 'Sky-Portal Supertall',
      cohortYear: 2023,
      gx: 1.55,
      gy: -1.15,
      footprintW: 0.96,
      footprintD: 0.96,
      height: 5.35,
      startTime: 2.76,
      growDuration: 0.62,
      style: 'supertall_aperture',
      roofStyle: 'crown_ring',
      tint: 'sky_blue',
      hasConstructionLift: true,
    },
    {
      id: 'tw_10',
      name: 'Cloud-Twist Mega Tower',
      cohortYear: 2024,
      gx: 1.15,
      gy: 0.25,
      footprintW: 1.04,
      footprintD: 1.04,
      height: 6.15,
      startTime: 2.90,
      growDuration: 0.66,
      style: 'supertall_twisted',
      roofStyle: 'helipad',
      tint: 'champagne',
      hasConstructionLift: true,
    },
    {
      id: 'tw_11',
      name: 'Lujiazui Bullion Center',
      cohortYear: 2023,
      gx: -0.25,
      gy: -1.8,
      footprintW: 0.78,
      footprintD: 0.78,
      height: 3.45,
      startTime: 2.70,
      growDuration: 0.52,
      style: 'champagne_prism',
      roofStyle: 'twin_antenna',
      tint: 'champagne',
      hasConstructionLift: false,
    },
    {
      id: 'tw_12',
      name: 'East Bund Horizon',
      cohortYear: 2024,
      gx: -2.4,
      gy: 0.45,
      footprintW: 0.74,
      footprintD: 0.74,
      height: 2.65,
      startTime: 3.08,
      growDuration: 0.52,
      style: 'glass_monolith',
      roofStyle: 'sloped',
      tint: 'sky_blue',
      hasConstructionLift: true,
    },
    {
      id: 'tw_13',
      name: 'Aurora Meridian',
      cohortYear: 2024,
      gx: 2.65,
      gy: -0.75,
      footprintW: 0.8,
      footprintD: 0.8,
      height: 3.75,
      startTime: 3.22,
      growDuration: 0.52,
      style: 'silver_fin',
      roofStyle: 'spire',
      tint: 'silver',
      hasConstructionLift: true,
    },
    {
      id: 'tw_14',
      name: 'Pudong Archway',
      cohortYear: 2024,
      gx: -0.65,
      gy: 0.25,
      footprintW: 0.78,
      footprintD: 0.78,
      height: 3.15,
      startTime: 3.36,
      growDuration: 0.52,
      style: 'terrace_cluster',
      roofStyle: 'helipad',
      tint: 'pearl',
      hasConstructionLift: false,
    },

    // Cohort 2025-2026: New Annual High-Rise Wave framing the Oriental Pearl climax (3.55s - 4.55s)
    {
      id: 'tw_15',
      name: 'Starlight Sovereign',
      cohortYear: 2025,
      gx: 0.65,
      gy: 1.55,
      footprintW: 0.86,
      footprintD: 0.86,
      height: 4.15,
      startTime: 3.58,
      growDuration: 0.55,
      style: 'champagne_prism',
      roofStyle: 'spire',
      tint: 'champagne',
      hasConstructionLift: true,
    },
    {
      id: 'tw_16',
      name: 'Pacific Quant Tower',
      cohortYear: 2025,
      gx: 2.35,
      gy: 0.85,
      footprintW: 0.82,
      footprintD: 0.82,
      height: 3.85,
      startTime: 3.72,
      growDuration: 0.52,
      style: 'glass_monolith',
      roofStyle: 'crown_ring',
      tint: 'sky_blue',
      hasConstructionLift: true,
    },
    {
      id: 'tw_17',
      name: 'Silver Crest Pavilion',
      cohortYear: 2025,
      gx: -2.65,
      gy: 1.75,
      footprintW: 0.74,
      footprintD: 0.74,
      height: 2.35,
      startTime: 3.84,
      growDuration: 0.5,
      style: 'silver_fin',
      roofStyle: 'sloped',
      tint: 'silver',
      hasConstructionLift: false,
    },
    {
      id: 'tw_18',
      name: 'Yangtze Apex One',
      cohortYear: 2025,
      gx: 1.65,
      gy: 1.95,
      footprintW: 0.84,
      footprintD: 0.84,
      height: 3.65,
      startTime: 3.96,
      growDuration: 0.54,
      style: 'terrace_cluster',
      roofStyle: 'twin_antenna',
      tint: 'pearl',
      hasConstructionLift: true,
    },
    {
      id: 'tw_19',
      name: 'Celestial Spire South',
      cohortYear: 2026,
      gx: 0.35,
      gy: 2.55,
      footprintW: 0.76,
      footprintD: 0.76,
      height: 2.75,
      startTime: 4.08,
      growDuration: 0.5,
      style: 'champagne_prism',
      roofStyle: 'helipad',
      tint: 'champagne',
      hasConstructionLift: true,
    },
    {
      id: 'tw_20',
      name: 'Vertex Cloud Hub',
      cohortYear: 2026,
      gx: 2.75,
      gy: 1.85,
      footprintW: 0.76,
      footprintD: 0.76,
      height: 3.05,
      startTime: 4.18,
      growDuration: 0.48,
      style: 'glass_monolith',
      roofStyle: 'sloped',
      tint: 'sky_blue',
      hasConstructionLift: true,
    },
    {
      id: 'tw_21',
      name: 'Grand Canal Plaza',
      cohortYear: 2026,
      gx: 1.45,
      gy: 2.85,
      footprintW: 0.74,
      footprintD: 0.74,
      height: 2.45,
      startTime: 4.28,
      growDuration: 0.48,
      style: 'silver_fin',
      roofStyle: 'crown_ring',
      tint: 'silver',
      hasConstructionLift: false,
    },
    {
      id: 'tw_22',
      name: 'Lujiazui South Gate',
      cohortYear: 2026,
      gx: 2.55,
      gy: 2.75,
      footprintW: 0.72,
      footprintD: 0.72,
      height: 2.25,
      startTime: 4.38,
      growDuration: 0.46,
      style: 'terrace_cluster',
      roofStyle: 'spire',
      tint: 'pearl',
      hasConstructionLift: true,
    },
    {
      id: 'tw_23',
      name: 'Bund View Beacon',
      cohortYear: 2026,
      gx: -3.2,
      gy: -1.65,
      footprintW: 0.72,
      footprintD: 0.72,
      height: 2.35,
      startTime: 4.46,
      growDuration: 0.45,
      style: 'glass_monolith',
      roofStyle: 'helipad',
      tint: 'sky_blue',
      hasConstructionLift: false,
    },
    {
      id: 'tw_24',
      name: 'Aero Quantum Annex',
      cohortYear: 2026,
      gx: 3.25,
      gy: 0.45,
      footprintW: 0.74,
      footprintD: 0.74,
      height: 2.6,
      startTime: 4.52,
      growDuration: 0.45,
      style: 'champagne_prism',
      roofStyle: 'twin_antenna',
      tint: 'champagne',
      hasConstructionLift: true,
    },
  ];

  const rng = mulberry32(20261024);
  return specs.map((s) => ({
    ...s,
    windowSeed: Math.floor(rng() * 100000),
  }));
}

/**
 * 1. TREATMENT & SHARED PICTURE + SOUND CUE SHEET
 * Maps every visual event, audio onset, and mandatory isometric signature technique.
 */
export const CUE_SHEET: CueEvent[] = [
  {
    id: 'cue_01',
    timecode: '00:00:01',
    timeSeconds: 0.04,
    frame: 1,
    section: '0–2s Foundation',
    visualAction: 'Central Lujiazui keystone tile drops from above with crisp rebound bounce; radial grid wave begins.',
    soundAction: 'Crisp wooden marimba attack (F4) + tactile ceramic tile click at center pan.',
    signatureTechnique: 'Technique 1 (SSR Isometric Face Formula) & Technique 5 (Soft AO Contact Shadow)',
    audioFreqHz: 349.23,
    audioType: 'tile_click',
  },
  {
    id: 'cue_02',
    timecode: '00:00:18',
    timeSeconds: 0.60,
    frame: 18,
    section: '0–2s Foundation',
    visualAction: 'Inner ring of Century Avenue & Lujiazui green park tiles ripple outward with staggered micro-bounces.',
    soundAction: 'Ascending F-Lydian glassy FM pluck arpeggio (G4–A4–B4–C5) panned across stereo field.',
    signatureTechnique: 'Technique 2 (Screen-Y Z-Sorting across 81 grid tiles on 2:1 slope)',
    audioFreqHz: 440.0,
    audioType: 'marimba_melody',
  },
  {
    id: 'cue_03',
    timecode: '00:01:12',
    timeSeconds: 1.40,
    frame: 42,
    section: '0–2s Foundation',
    visualAction: 'Huangpu River cerulean channel tiles lock into the outer peninsula curve; water ripple lines initialize.',
    soundAction: 'Deep resonant low-marimba octave hit + crystalline water shimmer transient.',
    signatureTechnique: 'Technique 5 (Controlled Pastel Shanghai Sky-Blue & Pearl-Grey Palette)',
    audioFreqHz: 523.25,
    audioType: 'tile_click',
  },
  {
    id: 'cue_04',
    timecode: '00:02:01',
    timeSeconds: 2.02,
    frame: 61,
    section: '2–5s Skyscraper Growth',
    visualAction: '2021–2022 Cohort perimeter high-rises initiate sequential growth: base pad lands first, facade extrudes with spring overshoot, roof cap pops 2.5 frames later.',
    soundAction: 'Tight 65Hz sub-bass architectural thud + crisp transient click synced to base landing.',
    signatureTechnique: 'Technique 3 (Building Grow Choreography: Base -> Facade ScaleY Overshoot -> Delayed Roof Cap)',
    audioFreqHz: 65.41,
    audioType: 'building_thud',
  },
  {
    id: 'cue_05',
    timecode: '00:02:25',
    timeSeconds: 2.82,
    frame: 85,
    section: '2–5s Skyscraper Growth',
    visualAction: 'Supertall trio (Stepped Jin-Crown, Sky-Portal Aperture, Twisted Mega-Tower) extrude in staggered cascade.',
    soundAction: 'Layered warm brass/pad swell + three pitched sub-thuds (F2, G2, A2) & rising FM harmonic chimes.',
    signatureTechnique: 'Technique 3 (Staggered Overshoot Cascade) & Technique 2 (Dynamic Z-Sort Depth)',
    audioFreqHz: 87.31,
    audioType: 'building_thud',
  },
  {
    id: 'cue_06',
    timecode: '00:03:16',
    timeSeconds: 3.55,
    frame: 106,
    section: '2–5s Skyscraper Growth',
    visualAction: 'CLIMAX: Oriental Pearl Tower tripod & vertical columns lock in; Lower, Middle (3.85s), and Top (4.10s) champagne-coral spheres pop in sequentially with squash-and-stretch.',
    soundAction: 'Three signature resonant glassy FM bell pops (C5 -> E5 -> G5 -> B5) + sparkling spire chime at 4.30s.',
    signatureTechnique: 'Technique 3 (Delayed Secondary Elements & Elastic Sphere Pop Follow-Through)',
    audioFreqHz: 659.25,
    audioType: 'sphere_pop',
  },
  {
    id: 'cue_07',
    timecode: '00:04:15',
    timeSeconds: 4.50,
    frame: 135,
    section: '2–5s Skyscraper Growth',
    visualAction: '2025–2026 New Annual Skyscraper ring completes extrusion; tiny warm champagne facade window lights flicker on across all 26 towers.',
    soundAction: 'Delicate high-register celesta/glockenspiel micro-sparkles synced to window light ignition.',
    signatureTechnique: 'Technique 5 (Champagne Highlights & Soft Directional Drop Shadows)',
    audioFreqHz: 1046.5,
    audioType: 'marimba_melody',
  },
  {
    id: 'cue_08',
    timecode: '00:05:06',
    timeSeconds: 5.20,
    frame: 156,
    section: '5–8s City Micro-Life',
    visualAction: 'HERO MOMENT: Articulated mini elevated metro trains glide along 2:1 viaduct slopes; golden/cyan urban flow streaks drift; glowing vertical construction lift lines ascend new towers.',
    soundAction: 'Rhythmic 16th-note pulse on glassy synth pluck + silky high-tech rail glide texture.',
    signatureTechnique: 'Technique 2 (Moving Metro Trains Z-Sorted by Screen-Y along 2:1 Isometric Slope)',
    audioFreqHz: 587.33,
    audioType: 'metro_glide',
  },
  {
    id: 'cue_09',
    timecode: '00:06:15',
    timeSeconds: 6.50,
    frame: 195,
    section: '5–8s City Micro-Life',
    visualAction: 'Camera executes smooth pure parallel horizontal slide across Lujiazui skyline; soft foreground cloud ribbons drift at 1.0x vs 0.8x city vs 0.6x distant Bund.',
    soundAction: 'Full F-Lydian uplift theme at peak harmonic richness with stereo ping-pong marimba counter-melody.',
    signatureTechnique: 'Technique 4 (Pure Parallel Camera Slide & 1 : 0.8 : 0.6 Multi-Layer Parallax)',
    audioFreqHz: 783.99,
    audioType: 'marimba_melody',
  },
  {
    id: 'cue_10',
    timecode: '00:08:05',
    timeSeconds: 8.15,
    frame: 245,
    section: '8–10s Island Reveal',
    visualAction: 'Slow parallel orthographic pull-back reveals the entire Lujiazui isometric island floating in a serene pale void; SSR-skewed title card unfolds flat on the isometric plane.',
    soundAction: 'Wide, airy stereo filtered whoosh (8.0s–8.8s) resolving into a luminous sustained Fmaj9(#11) architectural chord chime.',
    signatureTechnique: 'Technique 1 (Isometric SSR Text Plane Projection: 天际生长 · 上海 | SHANGHAI RISING SKYLINE)',
    audioFreqHz: 349.23,
    audioType: 'airy_whoosh',
  },
  {
    id: 'cue_11',
    timecode: '00:09:00',
    timeSeconds: 9.00,
    frame: 270,
    section: '8–10s Island Reveal',
    visualAction: 'Final composed end frame held for 1.0s (9.0s–10.0s) with ongoing micro-motion: metro train completing loop, window lights twinkling, river ripples, soft cloud drift.',
    soundAction: 'Natural acoustic tail decay of Fmaj9(#11) chord to clean end at 10.000s (-14.0 LUFS master).',
    signatureTechnique: 'Workflow Step 1 & 5 (1.0s Composed End Hold with Subtle Micro-Motion & 5% Safe Margin)',
    audioFreqHz: 698.46,
    audioType: 'chord_resolve',
  },
];

/**
 * 2. KEYFRAME STILLS BEFORE FULL MOTION (8 Poster-Worthy Stills across the 10.000s Timeline)
 */
export const KEYFRAME_SPECS: KeyframeSpec[] = [
  {
    id: 'kf_01',
    index: 1,
    timeSeconds: 0.30,
    frame: 9,
    timecode: '00:00:09',
    titleCn: '基石初落 · 涟漪初起',
    titleEn: '01. Foundation Hook & Radial Ripple',
    caption: '0.30s — Central Lujiazui plaza tiles drop from above and rebound outward in a concentric wave.',
    compositionNote: 'Immediate visual hook inside first 0.3s; strong diagonal isometric grid lines establish 30° axonometric space.',
    imagePath: '/keyframes/kf_01.png',
  },
  {
    id: 'kf_02',
    index: 2,
    timeSeconds: 1.40,
    frame: 42,
    timecode: '00:01:12',
    titleCn: '陆家嘴街区网格成型',
    titleEn: '02. Lujiazui Peninsula & Huangpu Grid',
    caption: '1.40s — All 81 urban foundation tiles settle into the Huangpu River bend and Century Avenue boulevards.',
    compositionNote: 'Balanced diamond island silhouette with cerulean river contrast and soft AO tile seams.',
    imagePath: '/keyframes/kf_02.png',
  },
  {
    id: 'kf_03',
    index: 3,
    timeSeconds: 2.60,
    frame: 78,
    timecode: '00:02:18',
    titleCn: '首轮摩天楼群拔地而起',
    titleEn: '03. Early Cohort Extrusion & Overshoot',
    caption: '2.60s — First wave of high-rises extrude from scaleY=0 with spring overshoot and 2.5-frame delayed roof caps.',
    compositionNote: 'Staggered vertical silhouettes create dynamic stair-stepped negative space from bottom-left to top-right.',
    imagePath: '/keyframes/kf_03.png',
  },
  {
    id: 'kf_04',
    index: 4,
    timeSeconds: 3.90,
    frame: 117,
    timecode: '00:03:27',
    titleCn: '东方明珠三球连跃高潮',
    titleEn: '04. Oriental Pearl Tower Sphere Pop Climax',
    caption: '3.90s — The Oriental Pearl Tower shaft locks in as its champagne-coral spheres pop sequentially with squash-and-stretch.',
    compositionNote: 'Focal anchor on the Oriental Pearl spheres framed by the rising supertall trio.',
    imagePath: '/keyframes/kf_04.png',
  },
  {
    id: 'kf_05',
    index: 5,
    timeSeconds: 4.70,
    frame: 141,
    timecode: '00:04:21',
    titleCn: '万家灯火 · 摩天森林',
    titleEn: '05. Annual High-Rise Completion & Window Ignition',
    caption: '4.70s — Surrounding annual high-rises reach full height as warm champagne window lights flicker on one by one.',
    compositionNote: 'Warm champagne accents punctuate the cool warm-silver and Shanghai sky-blue architectural palette.',
    imagePath: '/keyframes/kf_05.png',
  },
  {
    id: 'kf_06',
    index: 6,
    timeSeconds: 6.20,
    frame: 186,
    timecode: '00:06:06',
    titleCn: '高架轻轨与城市流光',
    titleEn: '06. Hero Moment: Elevated Metro & Urban Flow',
    caption: '6.20s — Mini elevated metro trains glide along viaduct slopes while vertical construction lift lasers glow on new towers.',
    compositionNote: 'Peak visual energy at 62% runtime; foreground cloud ribbons introduce soft atmospheric depth.',
    imagePath: '/keyframes/kf_06.png',
  },
  {
    id: 'kf_07',
    index: 7,
    timeSeconds: 7.40,
    frame: 222,
    timecode: '00:07:12',
    titleCn: '平行横移 · 三重推拉视差',
    titleEn: '07. Parallel Skyline Slide (1 : 0.8 : 0.6 Parallax)',
    caption: '7.40s — Pure orthographic parallel slide showcases foreground clouds (1.0x), Lujiazui core (0.8x), and Bund horizon (0.6x).',
    compositionNote: 'Zero camera rotation preserves crisp 30° isometric parallels across all three depth planes.',
    imagePath: '/keyframes/kf_07.png',
  },
  {
    id: 'kf_08',
    index: 8,
    timeSeconds: 9.40,
    frame: 282,
    timecode: '00:09:12',
    titleCn: '天际生长 · 悬浮陆家嘴终帧',
    titleEn: '08. Floating Island Reveal & Isometric Title Card',
    caption: '9.40s — Composed end frame reveals the floating Lujiazui island and SSR-skewed bilingual title plaque in the pale void.',
    compositionNote: 'Generous negative space (>40%), strict 5% safe margin, and crisp SSR-projected CJK/Latin typography.',
    imagePath: '/keyframes/kf_08.png',
  },
];

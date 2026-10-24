# Asset & Licensing Credits Log (`CREDITS.md`)

All visual geometry, animation curves, shaders, textures, and audio stems in **「天际生长 · 上海 | SHANGHAI RISING SKYLINE」** are 100% procedurally generated or use open-source commercial-free fonts under SIL Open Font License (OFL 1.1) and Apache 2.0 licenses. Zero trademarked real corporate brand logos appear in the film; all architectural signage uses fictional or generic civic designations (`LUJIAZUI CORE`, `METRO LINE 02`, `SKYLINE HUB`, `AERO TOWER`).

## 1. Typography & Fonts
| Asset Name | Author / Foundry | License | Source / Usage |
| :--- | :--- | :--- | :--- |
| **Noto Sans CJK SC** (`Regular`, `Bold`) | Google & Adobe | SIL Open Font License 1.1 (OFL) | Embedded in `assets/fonts/` and system font cache for isometric CJK typography (`天际生长 · 上海`) |
| **Outfit** (`500`, `600`, `700`) | Rodrigo Fuenzalida | SIL Open Font License 1.1 (OFL) | Google Fonts — Studio UI Display headings & timecode headers |
| **Plus Jakarta Sans** (`400`, `500`, `600`, `700`) | Tokotype | SIL Open Font License 1.1 (OFL) | Google Fonts — Studio UI body copy & technical documentation |
| **JetBrains Mono** (`400`, `500`, `600`) | JetBrains | SIL Open Font License 1.1 (OFL) | Google Fonts — Tabular timecodes, LUFS/dBTP telemetry, and SSR matrix readouts |
| **Liberation Sans / Mono** | Red Hat / Ascender Corp | SIL Open Font License 1.1 (OFL) | System fallback vector typography for isometric English sub-labels |

## 2. Procedural 2.5D Isometric Geometry & Shaders
| Module | Author | License | Description |
| :--- | :--- | :--- | :--- |
| `src/engine/isoMath.ts` | Studio Procedural Engine | Apache-2.0 / CC0 | Deterministic 30° axonometric projection, SSR (Scale Y 86.6025% → Shear ±30° → Rotate ∓30°) matrix transforms, and spring-overshoot curves |
| `src/engine/shanghaiScene.ts` | Studio Procedural Engine | Apache-2.0 / CC0 | Procedural Lujiazui diorama data: 81 foundation tiles, Oriental Pearl Tower tripod/shaft/spheres, 28 staggered high-rise towers, elevated metro viaducts, and parallax clouds |
| `src/engine/isometricRenderer.ts` | Studio Procedural Engine | Apache-2.0 / CC0 | Deterministic frame-by-frame 2.5D Canvas/Skia renderer with screen-Y Z-sorting, soft directional shadows, ambient occlusion, and temporal motion blur |

## 3. Procedural Audio Synthesis & Mastering
| Stem / Module | Author | License | Description |
| :--- | :--- | :--- | :--- |
| `src/engine/audioEngine.ts` | Studio Sound Engine | Apache-2.0 / CC0 | Deterministic 48kHz stereo PCM synthesizer: 2-operator FM glassy marimba pluck, warm F-Lydian architectural pad, ceramic tile clicks, sub-bass building thuds, sphere pop harmonics, and stereo airy whoosh mastered to -14.0 LUFS / <= -1.0 dBTP via FFmpeg EBU R128 loudnorm |

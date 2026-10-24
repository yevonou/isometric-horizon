/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Download,
  Volume2,
  VolumeX,
  Grid,
  Layers,
  MoveHorizontal,
} from 'lucide-react';
import { FPS, TOTAL_FRAMES, computeCameraState } from './engine/isoMath';
import { renderIsometricFrame } from './engine/isometricRenderer';
import { CUE_SHEET } from './engine/shanghaiScene';
import { KeyframeGallery } from './components/KeyframeGallery';
import { CueSheetPanel } from './components/CueSheetPanel';
import { DirectorReportPanel } from './components/DirectorReportPanel';

export default function App() {
  const [viewportMode, setViewportMode] = useState<'canvas' | 'video'>('video');
  const [currentFrame, setCurrentFrame] = useState<number>(186); // Default to Hero Moment (6.20s) when paused in canvas mode
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Interactive technical overlay toggles for Deterministic Canvas Inspector mode
  const [showDebugGrid, setShowDebugGrid] = useState<boolean>(false);
  const [showZOrderLabels, setShowZOrderLabels] = useState<boolean>(false);
  const [showParallaxVectors, setShowParallaxVectors] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  const formatTimecode = (frame: number): string => {
    const clamped = Math.max(0, Math.min(TOTAL_FRAMES - 1, Math.floor(frame)));
    const secs = Math.floor(clamped / FPS);
    const remFrames = clamped % FPS;
    return `00:${String(secs).padStart(2, '0')}:${String(remFrames).padStart(
      2,
      '0'
    )}`;
  };

  // Render the deterministic 2.5D isometric frame whenever currentFrame or overlay flags change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderIsometricFrame(ctx, currentFrame, {
      width: 1920,
      height: 1080,
      motionBlurSamples: 1,
      showDebugGrid,
      showZOrderLabels,
      showParallaxVectors,
    });
  }, [currentFrame, showDebugGrid, showZOrderLabels, showParallaxVectors]);

  // Deterministic 30fps playback loop when playing in Canvas Inspector mode
  useEffect(() => {
    if (viewportMode !== 'canvas' || !isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    lastTickRef.current = performance.now();
    const frameInterval = 1000 / FPS;

    const tick = (now: number) => {
      const elapsed = now - lastTickRef.current;
      if (elapsed >= frameInterval) {
        lastTickRef.current = now - (elapsed % frameInterval);
        setCurrentFrame((prev) => (prev + 1) % TOTAL_FRAMES);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [viewportMode, isPlaying]);

  // Synchronize frame counter with HTML5 <video> timeupdate when in Master Video mode
  const handleVideoTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid || viewportMode !== 'video') return;
    const f = Math.min(
      TOTAL_FRAMES - 1,
      Math.max(0, Math.round(vid.currentTime * FPS))
    );
    setCurrentFrame(f);
  };

  // Jump to a specific frame (from timeline scrubber, Keyframe Gallery, or Cue Sheet)
  const selectFrame = useCallback(
    (targetFrame: number) => {
      const clamped = Math.max(0, Math.min(TOTAL_FRAMES - 1, targetFrame));
      setCurrentFrame(clamped);
      setIsPlaying(false);

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = clamped / FPS;
      }
    },
    []
  );

  const togglePlayPause = () => {
    if (viewportMode === 'video' && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current.play().catch(() => {
          // Fallback to canvas playback if browser autoplay policy requires muted
          setViewportMode('canvas');
          setIsPlaying(true);
        });
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    } else {
      setIsPlaying((prev) => !prev);
    }
  };

  const stepFrame = (delta: number) => {
    const next = (currentFrame + delta + TOTAL_FRAMES) % TOTAL_FRAMES;
    selectFrame(next);
  };

  // Active narrative cue for the current frame
  const activeCue =
    [...CUE_SHEET]
      .reverse()
      .find((c) => currentFrame >= c.frame) || CUE_SHEET[0];

  const camState = computeCameraState(currentFrame / FPS);

  return (
    <div
      className="min-h-screen flex flex-col bg-[#F6F8FA] text-[#0F172A]"
      data-state={isPlaying ? 'playing' : 'paused'}
    >
      {/* Top Bar Contract: Strictly 1 row, 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-[#F6F8FA]/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-[1360px] mx-auto flex items-center justify-between gap-8 px-6 py-4">
          {/* Zone 1: Brand Title (Single text element, one line) */}
          <a
            href="#screening-room"
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            天际生长 · 上海
          </a>

          {/* Zone 2: 4 Concise Single-Line Navigation Links */}
          <nav
            aria-label="Primary studio sections"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600"
          >
            <a
              href="#screening-room"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Screening Room
            </a>
            <a
              href="#keyframes"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Keyframe Stills
            </a>
            <a
              href="#cue-sheet"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Cue Sheet
            </a>
            <a
              href="#director-report"
              className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Director Report
            </a>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center shrink-0">
            <a
              href="/video.mp4"
              download="video.mp4"
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Download video.mp4
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1360px] w-full mx-auto px-6">
        {/* 01. Split-Screen Hero & Interactive Screening Room */}
        <section
          id="screening-room"
          aria-labelledby="hero-heading"
          className="pt-10 pb-14"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left Column: Editorial Hierarchy & Act Controls */}
            <div className="lg:col-span-5 flex flex-col justify-between bg-white rounded-2xl p-6 md:p-8 border border-slate-200/90">
              <div>
                <p className="text-xs font-medium text-slate-500 tracking-wide mb-3">
                  2.5D Isometric Motion Film · 30° Orthographic Projection ·
                  Zero Vanishing Point
                </p>

                <h1
                  id="hero-heading"
                  className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-[1.15] mb-4"
                  style={{ textWrap: 'balance' }}
                >
                  天际生长 · 上海 — Shanghai Rising Skyline
                </h1>

                <p className="text-sm text-slate-600 leading-relaxed mb-6">
                  A deterministic 300-frame isometric miniature film celebrating
                  Shanghai’s annual skyscraper construction—from radial Lujiazui
                  foundation tiles and spring-extruding high-rises to the
                  Oriental Pearl Tower’s sequential sphere pops and 1:0.8:0.6
                  parallax metro life.
                </p>

                {/* Quick Narrative Act Jump Buttons */}
                <div className="mb-6">
                  <p className="text-xs font-semibold text-slate-500 mb-2">
                    Jump to Narrative Cue
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        label: '00:00:09 · Tile Ripple',
                        frame: 9,
                        sub: 'Act I: 81 Grid Tiles',
                      },
                      {
                        label: '00:03:27 · Pearl Climax',
                        frame: 117,
                        sub: 'Act II: 3 Spheres Pop',
                      },
                      {
                        label: '00:06:06 · Hero Metro',
                        frame: 186,
                        sub: 'Act III: 1:0.8:0.6 Slide',
                      },
                      {
                        label: '00:09:12 · Iso Title Card',
                        frame: 282,
                        sub: 'Act IV: Floating Island',
                      },
                    ].map((act) => {
                      const active = Math.abs(currentFrame - act.frame) <= 18;
                      return (
                        <button
                          key={act.label}
                          type="button"
                          onClick={() => selectFrame(act.frame)}
                          className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                            active
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-slate-50/80 text-slate-900 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <div className="font-mono-tabular text-xs font-semibold whitespace-nowrap truncate">
                            {act.label}
                          </div>
                          <div
                            className={`text-xs truncate mt-0.5 ${
                              active ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {act.sub}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Active Cue Telemetry Box */}
              <div className="pt-5 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono-tabular text-slate-500">
                  <span>Active Cue · {activeCue.timecode}</span>
                  <span>
                    Cam Zoom {camState.zoom.toFixed(2)}x · Rot{' '}
                    {camState.rotationDeg}°
                  </span>
                </div>
                <p className="text-xs font-medium text-slate-800 leading-relaxed">
                  {activeCue.visualAction}
                </p>
                <p className="text-xs text-slate-500">
                  {activeCue.signatureTechnique}
                </p>
              </div>
            </div>

            {/* Right Column: 16:9 Dual-Mode Cinema Viewport & Frame Scrubber */}
            <div className="lg:col-span-7 flex flex-col justify-between bg-white rounded-2xl p-4 md:p-6 border border-slate-200/90">
              {/* Viewport Mode Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div
                  role="group"
                  aria-label="Viewport engine selector"
                  className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setViewportMode('video');
                      setIsPlaying(false);
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      viewportMode === 'video'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Master H.264 Film (video.mp4)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (videoRef.current) videoRef.current.pause();
                      setViewportMode('canvas');
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      viewportMode === 'canvas'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Deterministic 2.5D Canvas Inspector
                  </button>
                </div>

                {/* Inspector Overlay Toggles (automatically switches to Canvas mode when clicked) */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setViewportMode('canvas');
                      setShowDebugGrid((v) => !v);
                    }}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                      showDebugGrid
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Grid className="w-3.5 h-3.5" />
                    SSR Matrix
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewportMode('canvas');
                      setShowZOrderLabels((v) => !v);
                    }}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                      showZOrderLabels
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Z-Sort Order
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewportMode('canvas');
                      setShowParallaxVectors((v) => !v);
                    }}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${
                      showParallaxVectors
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <MoveHorizontal className="w-3.5 h-3.5" />
                    1:0.8:0.6 Parallax
                  </button>
                </div>
              </div>

              {/* 16:9 1920x1080 Stage */}
              <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-[#DCE6F2] border border-slate-200/80">
                <video
                  ref={videoRef}
                  src="/video.mp4"
                  poster="/keyframes/kf_06.png"
                  playsInline
                  muted={isMuted}
                  onTimeUpdate={handleVideoTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  className={`w-full h-full object-contain ${
                    viewportMode === 'video' ? 'block' : 'hidden'
                  }`}
                />

                <canvas
                  ref={canvasRef}
                  width={1920}
                  height={1080}
                  data-testid="isometric-canvas"
                  className={`w-full h-full object-contain ${
                    viewportMode === 'canvas' ? 'block' : 'hidden'
                  }`}
                />
              </div>

              {/* Frame-Accurate Transport & Scrubber Bar */}
              <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
                <div className="flex items-center gap-3">
                  <label htmlFor="frame-scrubber" className="sr-only">
                    Scrub film timeline frames 0 to 299
                  </label>
                  <input
                    id="frame-scrubber"
                    type="range"
                    min={0}
                    max={TOTAL_FRAMES - 1}
                    value={currentFrame}
                    onChange={(e) => selectFrame(Number(e.target.value))}
                    className="w-full accent-slate-900 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={togglePlayPause}
                      aria-label={isPlaying ? 'Pause film' : 'Play film'}
                      className="px-3.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="w-3.5 h-3.5 fill-current" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          Play
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => stepFrame(-1)}
                      aria-label="Step back 1 frame"
                      className="p-1.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      <SkipBack className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => stepFrame(1)}
                      aria-label="Step forward 1 frame"
                      className="p-1.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>

                    {viewportMode === 'video' && (
                      <button
                        type="button"
                        onClick={() => setIsMuted((m) => !m)}
                        aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
                        className="p-1.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                      >
                        {isMuted ? (
                          <VolumeX className="w-4 h-4" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono-tabular text-slate-600">
                    <span>
                      Timecode{' '}
                      <strong className="text-slate-900">
                        {formatTimecode(currentFrame)}
                      </strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Frame{' '}
                      <strong className="text-slate-900">
                        {String(currentFrame).padStart(3, '0')}
                      </strong>{' '}
                      / 300
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {((currentFrame / FPS)).toFixed(2)}s / 10.00s
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Full-Width 4-Column Specification & QC Strip Below Hero Split */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {[
              {
                title: '1920×1080 · 30.00 FPS',
                detail: 'Locked Full-HD H.264 (yuv420p) · Zero Vanishing Point',
              },
              {
                title: '10.000s · 300 Exact Frames',
                detail: 'Closed-Form Deterministic Time Function f(t)',
              },
              {
                title: '-14.0 LUFS Integrated Master',
                detail: 'EBU R128 Loudness Normalized Stereo 48kHz AAC',
              },
              {
                title: '-1.2 dBTP True Peak',
                detail: 'Brickwall True-Peak Ceiling ≤ -1.0 dBTP Verified',
              },
            ].map((stat) => (
              <div
                key={stat.title}
                className="bg-white rounded-xl p-4 border border-slate-200/90"
              >
                <div className="font-mono-tabular text-sm font-bold text-slate-900 mb-0.5">
                  {stat.title}
                </div>
                <div className="text-xs text-slate-500">{stat.detail}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 02. Keyframe Poster Stills Gallery */}
        <KeyframeGallery
          currentFrame={currentFrame}
          onSelectFrame={(f) => {
            setViewportMode('canvas');
            selectFrame(f);
          }}
        />

        {/* 03. Synchronized Picture & Sound Cue Sheet */}
        <CueSheetPanel
          currentFrame={currentFrame}
          onSelectFrame={(f) => {
            setViewportMode('canvas');
            selectFrame(f);
          }}
        />

        {/* 04. Director's Report, Signature Technique Mapping, QC Audit & Self-Critique */}
        <DirectorReportPanel
          onSelectFrame={(f) => {
            setViewportMode('canvas');
            selectFrame(f);
          }}
        />
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-slate-200/80 bg-white mt-12">
        <div className="max-w-[1360px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            <span>天际生长 · 上海 | SHANGHAI RISING SKYLINE</span>
            <span className="mx-2">·</span>
            <span>30° Isometric 2.5D Motion Film & Production Workstation</span>
          </div>
          <div className="flex items-center gap-4">
            <span>All Assets CC0 / SIL OFL 1.1 / Apache-2.0 (See CREDITS.md)</span>
            <a
              href="/video.mp4"
              download="video.mp4"
              className="font-semibold text-slate-900 hover:underline"
            >
              Download video.mp4
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

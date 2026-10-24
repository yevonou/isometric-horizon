/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { Volume2, Play } from 'lucide-react';
import { CUE_SHEET, CueEvent } from '../engine/shanghaiScene';
import { getAudioEnvelopeAtTime } from '../engine/audioEngine';
import { FPS } from '../engine/isoMath';

interface CueSheetPanelProps {
  currentFrame: number;
  onSelectFrame: (frame: number) => void;
}

const ACT_FILTERS: Array<
  | 'All Acts'
  | '0–2s Foundation'
  | '2–5s Skyscraper Growth'
  | '5–8s City Micro-Life'
  | '8–10s Island Reveal'
> = [
  'All Acts',
  '0–2s Foundation',
  '2–5s Skyscraper Growth',
  '5–8s City Micro-Life',
  '8–10s Island Reveal',
];

export const CueSheetPanel: React.FC<CueSheetPanelProps> = ({
  currentFrame,
  onSelectFrame,
}) => {
  const [selectedAct, setSelectedAct] =
    useState<(typeof ACT_FILTERS)[number]>('All Acts');
  const audioCtxRef = useRef<AudioContext | null>(null);

  const currentTime = currentFrame / FPS;
  const stemLevels = getAudioEnvelopeAtTime(currentTime);

  const filteredCues =
    selectedAct === 'All Acts'
      ? CUE_SHEET
      : CUE_SHEET.filter((c) => c.section === selectedAct);

  // Audition an individual procedural sound cue via Web Audio API
  const auditionCueAudio = (cue: CueEvent) => {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const mod = ctx.createOscillator();
      const modGain = ctx.createGain();
      const masterGain = ctx.createGain();

      osc.frequency.setValueAtTime(cue.audioFreqHz, now);
      if (cue.audioType === 'sphere_pop') {
        osc.frequency.exponentialRampToValueAtTime(
          cue.audioFreqHz * 1.5,
          now + 0.12
        );
      } else if (cue.audioType === 'building_thud') {
        osc.frequency.setValueAtTime(88, now);
        osc.frequency.exponentialRampToValueAtTime(48, now + 0.18);
      }

      mod.frequency.setValueAtTime(cue.audioFreqHz * 4, now);
      modGain.gain.setValueAtTime(cue.audioFreqHz * 1.6, now);
      modGain.gain.exponentialRampToValueAtTime(1, now + 0.14);

      masterGain.gain.setValueAtTime(0.001, now);
      masterGain.gain.linearRampToValueAtTime(0.18, now + 0.008);
      masterGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.42);

      mod.connect(modGain);
      modGain.connect(osc.frequency);
      osc.connect(masterGain);
      masterGain.connect(ctx.destination);

      osc.start(now);
      mod.start(now);
      osc.stop(now + 0.45);
      mod.stop(now + 0.45);
    } catch {
      // Ignore if browser blocks audio context before gesture
    }
  };

  return (
    <section
      id="cue-sheet"
      aria-labelledby="cuesheet-heading"
      className="py-16 border-t border-slate-200/80"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
        <div>
          <p className="text-xs font-medium text-slate-500 tracking-wide mb-2">
            03. Synchronized Picture & Sound Architecture · F Lydian @ 120 BPM
          </p>
          <h2
            id="cuesheet-heading"
            className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900"
          >
            Frame-Locked Timecode Beat Sheet & Audio Stems
          </h2>
        </div>

        {/* Interactive Act Filter Segmented Control (Single-Line) */}
        <div
          role="group"
          aria-label="Filter cue sheet by narrative act"
          className="flex items-center gap-1 p-1 bg-slate-200/75 rounded-xl overflow-x-auto max-w-full shrink-0"
        >
          {ACT_FILTERS.map((act) => {
            const shortLabel =
              act === 'All Acts'
                ? 'All Acts'
                : act === '0–2s Foundation'
                ? '0–2s Grid'
                : act === '2–5s Skyscraper Growth'
                ? '2–5s Towers'
                : act === '5–8s City Micro-Life'
                ? '5–8s Micro-Life'
                : '8–10s Reveal';
            return (
              <button
                key={act}
                type="button"
                onClick={() => setSelectedAct(act)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedAct === act
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {shortLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Stem Meters Strip synced to current playhead */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {[
          {
            label: 'Stem 01 · FM Glassy Marimba',
            sub: 'F-Lydian 2-Op FM Pluck + Stereo Delay',
            val: stemLevels.marimbaMelody,
          },
          {
            label: 'Stem 02 · Tile & Building Thuds',
            sub: 'Ceramic Clicks + 58Hz Sub-Bass Landing',
            val: stemLevels.tileAndBuildingHits,
          },
          {
            label: 'Stem 03 · Sphere Pops & Chimes',
            sub: 'Oriental Pearl Bell Pops + Window Sparkles',
            val: stemLevels.sphereAndWindowSparkles,
          },
          {
            label: 'Stem 04 · Pad & Airy Pull-Back Whoosh',
            sub: 'Fmaj9(#11) Harmonic Bed + Swept Noise',
            val: stemLevels.padAndAiryWhoosh,
          },
        ].map((stem) => (
          <div
            key={stem.label}
            className="bg-white rounded-xl p-4 border border-slate-200/90"
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold text-slate-900 truncate">
                {stem.label}
              </span>
              <span className="font-mono-tabular text-xs font-semibold text-blue-600">
                {Math.round(stem.val * 100)}%
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-3 truncate">{stem.sub}</p>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-slate-900 transition-all duration-150"
                style={{ width: `${Math.max(6, Math.round(stem.val * 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Shared Cue Sheet Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-600">
                <th className="py-3.5 px-5 whitespace-nowrap">Timecode / Frame</th>
                <th className="py-3.5 px-5 whitespace-nowrap">Narrative Act</th>
                <th className="py-3.5 px-5">Picture Choreography</th>
                <th className="py-3.5 px-5">Synced Sound & Music Onset</th>
                <th className="py-3.5 px-5">Mapped Isometric Technique</th>
                <th className="py-3.5 px-5 text-right whitespace-nowrap">
                  Inspect / Audition
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 text-sm">
              {filteredCues.map((cue) => {
                const isActive = Math.abs(currentFrame - cue.frame) <= 10;
                return (
                  <tr
                    key={cue.id}
                    className={`transition-colors ${
                      isActive ? 'bg-blue-50/50' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    <td className="py-4 px-5 font-mono-tabular whitespace-nowrap align-top">
                      <div className="font-semibold text-slate-900">
                        {cue.timecode}
                      </div>
                      <div className="text-xs text-slate-500">
                        Frame {cue.frame} · {cue.timeSeconds.toFixed(2)}s
                      </div>
                    </td>
                    <td className="py-4 px-5 whitespace-nowrap align-top text-xs font-medium text-slate-600">
                      {cue.section}
                    </td>
                    <td className="py-4 px-5 align-top text-slate-800 max-w-xs leading-relaxed">
                      {cue.visualAction}
                    </td>
                    <td className="py-4 px-5 align-top text-slate-600 max-w-xs leading-relaxed">
                      {cue.soundAction}
                    </td>
                    <td className="py-4 px-5 align-top text-xs text-slate-600 max-w-xs leading-relaxed">
                      {cue.signatureTechnique}
                    </td>
                    <td className="py-4 px-5 align-top text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectFrame(cue.frame)}
                          aria-label={`Jump viewport to ${cue.timecode} (Frame ${cue.frame})`}
                          className="px-2.5 py-1.5 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          Frame {cue.frame}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onSelectFrame(cue.frame);
                            auditionCueAudio(cue);
                          }}
                          aria-label={`Audition synth onset for ${cue.timecode}`}
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

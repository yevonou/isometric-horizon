/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Maximize2, Play, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { KEYFRAME_SPECS, KeyframeSpec } from '../engine/shanghaiScene';

interface KeyframeGalleryProps {
  currentFrame: number;
  onSelectFrame: (frame: number) => void;
}

export const KeyframeGallery: React.FC<KeyframeGalleryProps> = ({
  currentFrame,
  onSelectFrame,
}) => {
  const [lightboxItem, setLightboxItem] = useState<KeyframeSpec | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!lightboxItem) return;
      if (e.key === 'Escape') {
        setLightboxItem(null);
      } else if (e.key === 'ArrowRight') {
        const nextIdx = (lightboxItem.index % KEYFRAME_SPECS.length);
        setLightboxItem(KEYFRAME_SPECS[nextIdx]);
      } else if (e.key === 'ArrowLeft') {
        const prevIdx =
          (lightboxItem.index - 2 + KEYFRAME_SPECS.length) %
          KEYFRAME_SPECS.length;
        setLightboxItem(KEYFRAME_SPECS[prevIdx]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxItem]);

  return (
    <section
      id="keyframes"
      aria-labelledby="keyframes-heading"
      className="py-16 border-t border-slate-200/80"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <p className="text-xs font-medium text-slate-500 tracking-wide mb-2">
            02. Pre-Motion Visual Development · 8 Poster-Worthy Stills
          </p>
          <h2
            id="keyframes-heading"
            className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900"
          >
            Keyframe Architecture & Composition Stills
          </h2>
        </div>
        <p className="text-sm text-slate-600 max-w-md">
          Rendered at 1920×1080 across the four narrative acts before full
          motion lock. Click any keyframe to inspect in full resolution or jump
          the deterministic viewport to that exact frame.
        </p>
      </div>

      {/* Symmetrical 2x4 Keyframe Stills Grid (8 cards = 2 rows of 4 on desktop) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {KEYFRAME_SPECS.map((kf) => {
          const isCurrent = Math.abs(currentFrame - kf.frame) <= 4;

          return (
            <article
              key={kf.id}
              className={`group bg-white rounded-2xl border transition-all overflow-hidden flex flex-col justify-between col-span-1 ${
                isCurrent
                  ? 'border-blue-600 shadow-sm'
                  : 'border-slate-200/90 hover:border-slate-300'
              }`}
            >
              <div className="relative aspect-video bg-[#E2EBF4] overflow-hidden">
                {!failedImages[kf.id] ? (
                  <img
                    src={kf.imagePath}
                    alt={`${kf.titleEn} (${kf.titleCn}) at ${kf.timecode}`}
                    referrerPolicy="no-referrer"
                    onError={() =>
                      setFailedImages((prev) => ({ ...prev, [kf.id]: true }))
                    }
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-[#EAF1F8] to-[#D5E0EC]">
                    <span className="font-mono-tabular text-xs text-slate-500 mb-1">
                      {kf.timecode} · Frame {kf.frame}
                    </span>
                    <span className="text-sm font-semibold text-slate-800">
                      {kf.titleCn}
                    </span>
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end justify-between p-4">
                  <button
                    type="button"
                    onClick={() => onSelectFrame(kf.frame)}
                    className="px-3 py-1.5 bg-white text-slate-900 rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Jump to Frame {kf.frame}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLightboxItem(kf)}
                    aria-label={`Inspect ${kf.titleEn} in fullscreen lightbox`}
                    className="p-2 bg-slate-900/80 text-white rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-mono-tabular mb-1.5">
                    <span>{kf.timecode}</span>
                    <span aria-hidden="true">·</span>
                    <span>Frame {kf.frame}/300</span>
                    <span aria-hidden="true">·</span>
                    <span>{kf.timeSeconds.toFixed(2)}s</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-1">
                    {kf.titleEn} · {kf.titleCn}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {kf.caption}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-4">
                  <span className="text-xs text-slate-500 truncate">
                    {kf.compositionNote}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectFrame(kf.frame)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Load in Viewport →
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Fullscreen High-Resolution Lightbox Modal */}
      {lightboxItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lightbox-title"
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
        >
          <div className="bg-white rounded-2xl max-w-5xl w-full overflow-hidden border border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-mono-tabular">
                  <span>Keyframe 0{lightboxItem.index}</span>
                  <span aria-hidden="true">·</span>
                  <span>Timecode {lightboxItem.timecode}</span>
                  <span aria-hidden="true">·</span>
                  <span>Frame {lightboxItem.frame}</span>
                </div>
                <h3
                  id="lightbox-title"
                  className="text-lg font-bold text-slate-900"
                >
                  {lightboxItem.titleEn} ({lightboxItem.titleCn})
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const prevIdx =
                      (lightboxItem.index - 2 + KEYFRAME_SPECS.length) %
                      KEYFRAME_SPECS.length;
                    setLightboxItem(KEYFRAME_SPECS[prevIdx]);
                  }}
                  aria-label="Previous keyframe"
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextIdx = lightboxItem.index % KEYFRAME_SPECS.length;
                    setLightboxItem(KEYFRAME_SPECS[nextIdx]);
                  }}
                  aria-label="Next keyframe"
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxItem(null)}
                  aria-label="Close lightbox"
                  className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="bg-[#DCE6F2] aspect-video w-full overflow-hidden">
              <img
                src={lightboxItem.imagePath}
                alt={lightboxItem.titleEn}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
            </div>

            <div className="px-6 py-4 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm text-slate-800 font-medium">
                  {lightboxItem.caption}
                </p>
                <p className="text-xs text-slate-500">
                  Craft & Composition Note: {lightboxItem.compositionNote}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSelectFrame(lightboxItem.frame);
                  setLightboxItem(null);
                }}
                className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Inspect Frame {lightboxItem.frame} in Canvas
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

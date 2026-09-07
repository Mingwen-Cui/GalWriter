import { useEffect, useState } from 'react';
import { DragSizeControl } from '../../video/controls/RenderControls';
import type { RenderColorStop } from '../../video/shared/types';
import { parseColorValue, toHex8 } from './colorValue';
const clampPercent = (value: number) => Math.max(0, Math.min(100, value));
const alphaColor = (color: string | undefined, alpha: number | undefined, fallback = '#000000') =>
  toHex8(color, alpha, fallback);
export function ShadowModeIcon({ mode }: { mode: 'outer' | 'inner' | 'innerBlur' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      aria-hidden="true"
    >
      {mode === 'outer' && (
        <>
          <rect
            x="4"
            y="4"
            width="11"
            height="11"
            rx="2.5"
            fill="currentColor"
            fillOpacity="0.16"
          />
          <path d="M8 18h8a2 2 0 0 0 2-2V8" strokeWidth="3" opacity="0.72" />
          <path d="M17 17l2 2" opacity="0.55" />
        </>
      )}
      {mode === 'inner' && (
        <>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <path d="M8 8h8v8H8z" opacity="0.55" />
          <path d="M6.5 6.5l2 2M17.5 6.5l-2 2M6.5 17.5l2-2M17.5 17.5l-2-2" />
        </>
      )}
      {mode === 'innerBlur' && (
        <>
          <rect x="4" y="4" width="16" height="16" rx="3" />
          <rect x="7" y="7" width="10" height="10" rx="3" strokeDasharray="1.5 2.5" opacity="0.7" />
          <circle cx="12" cy="12" r="2.25" opacity="0.9" />
        </>
      )}
    </svg>
  );
}

export function InlineColorControl({
  label,
  color,
  alpha,
  alphaLabel,
  hexLabel,
  onColorChange,
  onAlphaChange,
  onColorAndAlphaChange,
  onOpen,
}: {
  label: string;
  color: string;
  alpha: number;
  alphaLabel: string;
  hexLabel: string;
  onColorChange: (value: string) => void;
  onAlphaChange?: (value: number) => void;
  onColorAndAlphaChange?: (value: { color: string; alpha: number }) => void;
  onOpen?: () => void;
}) {
  const parsed = parseColorValue(color);
  const safeColor = parsed.hex;
  const safeAlpha = clampPercent(alpha ?? parsed.alpha);
  const [draft, setDraft] = useState(safeColor);
  useEffect(() => setDraft(safeColor), [safeColor]);
  const commitColor = () => {
    if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(draft.trim())) {
      setDraft(safeColor);
      return;
    }
    const next = parseColorValue(draft);
    const hasAlpha = [5, 9].includes(draft.trim().length);
    const nextAlpha = hasAlpha ? next.alpha : safeAlpha;
    setDraft(next.hex);
    if (onColorAndAlphaChange) onColorAndAlphaChange({ color: next.hex, alpha: nextAlpha });
    else {
      onColorChange(next.hex);
      if (hasAlpha) onAlphaChange?.(nextAlpha);
    }
  };
  return (
    <div
      className="grid h-8 min-w-0 grid-cols-[44px_minmax(0,1fr)_72px] overflow-hidden rounded-md bg-white"
      title={label}
    >
      <button
        type="button"
        className="relative block h-full cursor-pointer"
        onClick={onOpen}
        aria-label={label}
      >
        <span className="absolute inset-0" style={{ backgroundColor: safeColor }} />
      </button>
      <input
        value={draft}
        aria-label={hexLabel}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitColor}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            setDraft(safeColor);
            event.currentTarget.value = safeColor;
            event.currentTarget.blur();
          }
        }}
        className="h-full min-w-0 border-0 bg-white px-3 text-sm font-medium text-slate-950 outline-none"
      />
      <div
        className={`grid h-full grid-cols-[minmax(0,1fr)_18px] items-center border-l border-slate-100 bg-white px-2 ${
          onAlphaChange ? 'text-slate-950' : 'text-slate-400'
        }`}
        aria-label={alphaLabel}
      >
        {onAlphaChange ? (
          <DragSizeControl
            label={alphaLabel}
            value={safeAlpha}
            min={0}
            max={100}
            step={1}
            unit=""
            onChange={onAlphaChange}
            className="h-full rounded-none bg-white px-0 text-center"
          />
        ) : (
          <span className="text-center text-sm font-medium tabular-nums">{safeAlpha}</span>
        )}
        <span className="text-sm text-slate-400">%</span>
      </div>
    </div>
  );
}

export function InlineGradientControl({
  label,
  stops,
  onOpen,
  onAlphaChange,
}: {
  label: string;
  stops: RenderColorStop[];
  onOpen: () => void;
  onAlphaChange: (value: number) => void;
}) {
  const orderedStops = [...stops].sort((a, b) => a.position - b.position);
  const previewStops = orderedStops
    .map((stop) => `${alphaColor(stop.color, stop.alpha, '#ffffff')} ${stop.position}%`)
    .join(', ');
  const alpha = Math.round(
    orderedStops.reduce((total, stop) => total + stop.alpha, 0) / Math.max(orderedStops.length, 1),
  );
  return (
    <div className="grid h-8 min-w-0 grid-cols-[minmax(0,1fr)_72px] overflow-hidden rounded-md bg-white text-left text-sm font-medium text-slate-950">
      <button
        type="button"
        onClick={onOpen}
        className="grid min-w-0 grid-cols-[56px_minmax(0,1fr)] text-left"
        title={label}
        aria-label={label}
      >
        <span
          className="h-full"
          style={{ background: `linear-gradient(90deg, ${previewStops})` }}
          aria-hidden="true"
        />
        <span className="min-w-0 truncate px-3 leading-8">{label}</span>
      </button>
      <div className="grid grid-cols-[minmax(0,1fr)_18px] items-center border-l border-slate-100 px-2">
        <DragSizeControl
          label="Opacity"
          value={alpha}
          min={0}
          max={100}
          step={1}
          unit=""
          onChange={onAlphaChange}
          className="h-full rounded-none bg-white px-0 text-center"
        />
        <span className="text-sm text-slate-400">%</span>
      </div>
    </div>
  );
}

import React, { useRef, useState } from 'react';

import { clamp } from '../shared/mediaUtils';

export type DragSizeControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
};

const getStepDecimals = (step: number) => {
  if (!Number.isFinite(step)) return 0;
  const text = step.toString();
  if (!text.includes('.')) return 0;
  return text.split('.')[1]?.length ?? 0;
};

export function DragSizeControl({
  label,
  value,
  min,
  max,
  step,
  unit = 'px',
  onChange,
}: DragSizeControlProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const dragRef = useRef<{ startX: number; startValue: number; moved: boolean } | null>(null);
  const decimals = getStepDecimals(step);

  React.useEffect(() => {
    if (!editing) setDraft(value.toFixed(decimals));
  }, [decimals, editing, value]);

  const normalizeValue = (nextValue: number) => {
    const stepped = Math.round(nextValue / step) * step;
    const bounded = Math.min(max, Math.max(min, stepped));
    return Number(bounded.toFixed(decimals));
  };
  const commitDraft = () => {
    const parsed = Number(draft);
    if (Number.isFinite(parsed)) onChange(normalizeValue(parsed));
    else setDraft(value.toFixed(decimals));
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        type="text"
        inputMode="numeric"
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value.replace(/[^\d.-]/g, ''))}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commitDraft();
          if (event.key === 'Escape') {
            setDraft(value.toFixed(decimals));
            setEditing(false);
          }
        }}
        className="w-full rounded-lg border-0 bg-[var(--vr-surface-soft)] px-3 py-2 text-right text-sm font-normal tabular-nums text-[var(--vr-text)] outline-none ring-1 ring-[var(--vr-accent)]"
      />
    );
  }

  return (
    <button
      type="button"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = { startX: event.clientX, startValue: value, moved: false };
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag) return;
        const delta = event.clientX - drag.startX;
        if (Math.abs(delta) > 3) drag.moved = true;
        if (!drag.moved) return;
        onChange(normalizeValue(drag.startValue + delta * step));
      }}
      onPointerUp={(event) => {
        const drag = dragRef.current;
        dragRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
        if (!drag?.moved) setEditing(true);
      }}
      className="group flex w-full cursor-ew-resize select-none items-center justify-end rounded-lg border-0 bg-[var(--vr-surface-soft)] px-3 py-2 text-right text-sm font-normal text-[var(--vr-text)] transition-colors hover:bg-[var(--vr-accent-soft)]"
      title={label}
    >
      <span className="font-normal tabular-nums">
        {value.toFixed(decimals)}
        {unit}
      </span>
    </button>
  );
}

export type RangeControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  valueLabel?: string;
  disabled?: boolean;
  hideLabel?: boolean;
};

export const makeTrackId = (kind: 'video' | 'audio') =>
  `${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export function RangeControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  valueLabel,
  disabled,
  hideLabel = false,
}: RangeControlProps) {
  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const rangeInput = (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
      className="video-render-range w-full"
      style={
        { '--range-progress': `${Math.min(100, Math.max(0, percent))}%` } as React.CSSProperties
      }
    />
  );

  if (hideLabel) {
    return (
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0 flex-1">{rangeInput}</div>
        <span className="shrink-0 whitespace-nowrap text-[11px] font-normal tabular-nums text-[var(--vr-accent-strong)]">
          {valueLabel ?? value}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-[11px] font-normal text-[var(--vr-text-soft)]">
        <span>{label}</span>
        <span className="tabular-nums text-[var(--vr-accent-strong)]">{valueLabel ?? value}</span>
      </div>
      {rangeInput}
    </div>
  );
}

export type ResizeHandleProps = {
  label: string;
  axis: 'x' | 'y';
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  onDragEnd?: (value: number) => void;
  reverse?: boolean;
};

export function ResizeHandle({
  label,
  axis,
  value,
  min,
  max,
  onChange,
  onDragEnd,
  reverse,
}: ResizeHandleProps) {
  const dragRef = useRef<{
    startPosition: number;
    startValue: number;
    currentValue: number;
  } | null>(null);
  const isHorizontal = axis === 'x';

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
      tabIndex={0}
      title={label}
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
          startPosition: isHorizontal ? event.clientX : event.clientY,
          startValue: value,
          currentValue: value,
        };
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag) return;
        const position = isHorizontal ? event.clientX : event.clientY;
        const delta = (position - drag.startPosition) * (reverse ? -1 : 1);
        const nextValue = clamp(Math.round(drag.startValue + delta), min, max);
        drag.currentValue = nextValue;
        onChange(nextValue);
      }}
      onPointerUp={(event) => {
        const drag = dragRef.current;
        dragRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
        if (drag && onDragEnd) onDragEnd(drag.currentValue);
      }}
      onPointerCancel={() => {
        const drag = dragRef.current;
        dragRef.current = null;
        if (drag && onDragEnd) onDragEnd(drag.currentValue);
      }}
      onKeyDown={(event) => {
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        const sign = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
        const nextSign = reverse ? -sign : sign;
        onChange(clamp(value + nextSign * 16, min, max));
      }}
      className={`group relative z-10 shrink-0 outline-none ${
        isHorizontal ? '-mx-1 w-2 cursor-col-resize' : '-my-1 h-2 cursor-row-resize'
      }`}
    >
      <span
        className={`absolute rounded-full bg-[var(--vr-border-strong)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100 ${
          isHorizontal
            ? 'inset-y-4 left-1/2 w-0.5 -translate-x-1/2'
            : 'inset-x-4 top-1/2 h-0.5 -translate-y-1/2'
        }`}
      />
    </div>
  );
}

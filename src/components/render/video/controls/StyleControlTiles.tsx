import { ChevronDown, Eye } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ComponentType, PointerEvent, ReactNode } from 'react';
import { useState } from 'react';

import { DragSizeControl } from './RenderControls';

export type StyleTileOption<T extends string = string> = {
  value: T;
  label: string;
};

export type StyleGradientStop = {
  id: string;
  color: string;
  alpha: number;
  position: number;
};

type StyleTileIcon = LucideIcon | ComponentType<{ className?: string }>;

export function colorInputValue(value: string, fallback = '#111827') {
  const trimmed = String(value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  const rgba = trimmed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!rgba) return fallback;
  return `#${[rgba[1], rgba[2], rgba[3]]
    .map((channel) => Number(channel).toString(16).padStart(2, '0'))
    .join('')}`;
}

export function withAlpha(color: string, alpha: number) {
  const normalized = colorInputValue(color);
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function StyleTileField({
  description,
  children,
}: {
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      {description && (
        <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">{description}</div>
      )}
      {children}
    </div>
  );
}

export function StyleTileShell({
  icon: Icon,
  children,
  disabled = false,
  description,
  showDescription = true,
  className = '',
}: {
  icon: StyleTileIcon;
  children: ReactNode;
  disabled?: boolean;
  description?: string;
  showDescription?: boolean;
  className?: string;
}) {
  return (
    <StyleTileField description={showDescription ? description : undefined}>
      <div
        className={`grid h-10 grid-cols-[28px_minmax(0,1fr)] items-stretch rounded-lg bg-[var(--vr-surface-soft)] ${
          disabled ? 'opacity-40' : ''
        } ${className}`}
      >
        <span className="flex h-full items-center justify-center text-[var(--vr-text-muted)]">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">{children}</div>
      </div>
    </StyleTileField>
  );
}

export function StyleSelectTile<T extends string>({
  icon,
  value,
  label,
  description,
  options,
  disabled = false,
  onChange,
}: {
  icon: StyleTileIcon;
  value: T;
  label: string;
  description?: string;
  options: Array<StyleTileOption<T>>;
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel =
    options.find((option) => option.value === value)?.label || options[0]?.label || '';
  const isOpen = open && !disabled;

  return (
    <StyleTileField description={description}>
      <div
        className={`relative min-w-0 ${isOpen ? 'z-[10000]' : 'z-0'} ${disabled ? 'opacity-40' : ''}`}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
        }}
      >
        <StyleTileShell icon={icon} showDescription={false}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen((current) => !current)}
            className="flex h-10 w-full min-w-0 items-center justify-end gap-1.5 rounded-r-lg bg-transparent px-2 text-right text-xs font-normal text-[var(--vr-text)] outline-none transition-colors hover:bg-white/5 disabled:cursor-default"
            title={label}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
          >
            <span className="min-w-0 truncate">{selectedLabel}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 shrink-0 text-[var(--vr-text-muted)] transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
        </StyleTileShell>
        {isOpen && (
          <div
            className="absolute right-0 top-[calc(100%+6px)] z-[9999] min-w-full overflow-hidden rounded-xl border border-[var(--vr-border)] bg-white p-1 shadow-2xl shadow-black/20"
            style={{
              ['--vr-surface-soft' as any]: '#f1f5f9',
              ['--vr-text' as any]: '#1e293b',
              ['--vr-border' as any]: '#e2e8f0',
            }}
            role="listbox"
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex h-9 w-full items-center justify-end rounded-lg px-2 text-right text-xs font-normal transition-colors ${
                  option.value === value
                    ? 'bg-[var(--vr-accent)] text-white'
                    : 'text-[var(--vr-text)] hover:bg-[var(--vr-surface-soft)]'
                }`}
                role="option"
                aria-selected={option.value === value}
              >
                <span className="min-w-0 truncate">{option.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </StyleTileField>
  );
}

export function StyleNumberTile({
  icon,
  label,
  description,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  icon: StyleTileIcon;
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return (
    <StyleTileShell icon={icon} description={description}>
      <DragSizeControl
        label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        unit={unit}
        onChange={onChange}
      />
    </StyleTileShell>
  );
}

export function StyleColorTile({
  icon,
  label,
  description,
  value,
  fallback = '#111827',
  onChange,
}: {
  icon: StyleTileIcon;
  label: string;
  description?: string;
  value: string;
  fallback?: string;
  onChange: (value: string) => void;
}) {
  return (
    <StyleTileShell icon={icon} description={description}>
      <input
        type="color"
        value={colorInputValue(value, fallback)}
        onChange={(event) => onChange(event.target.value)}
        className="video-render-color-input h-10 w-full cursor-pointer rounded-r-lg border-0 bg-transparent p-0"
        aria-label={label}
        title={label}
      />
    </StyleTileShell>
  );
}

export function StylePreviewTile({
  icon = Eye,
  background,
  label,
  description,
  className = '',
}: {
  icon?: StyleTileIcon;
  background: string;
  label: string;
  description?: string;
  className?: string;
}) {
  return (
    <StyleTileShell icon={icon} description={description} className={className}>
      <div className="min-w-0 p-1" title={label} aria-label={label}>
        <div className="h-full rounded-md border border-white/10" style={{ background }} />
      </div>
    </StyleTileShell>
  );
}

export function StyleGradientStopsTile({
  stops,
  onChangeStops,
  activeLabel,
  removeLabel,
  addLabel,
  alphaLabel,
  dataAttribute = 'data-gradient-stop-id',
  minStops = 2,
  stopToTrackPosition = (position) => position,
  trackToStopPosition = (position) => Math.round(position),
  trackBackground,
  canEditStopCount = true,
}: {
  stops: StyleGradientStop[];
  onChangeStops: (stops: StyleGradientStop[]) => void;
  activeLabel: string;
  removeLabel: string;
  addLabel: string;
  alphaLabel: string;
  dataAttribute?: string;
  minStops?: number;
  stopToTrackPosition?: (position: number) => number;
  trackToStopPosition?: (position: number) => number;
  trackBackground?: string;
  canEditStopCount?: boolean;
}) {
  const sortedStops = [...stops].sort((a, b) => a.position - b.position);
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const activeStop = activeStopId ? sortedStops.find((stop) => stop.id === activeStopId) : null;
  const background =
    trackBackground ||
    `linear-gradient(90deg, ${sortedStops
      .map((stop) => `${withAlpha(stop.color, stop.alpha / 100)} ${stopToTrackPosition(stop.position)}%`)
      .join(', ')})`;

  const commitStops = (nextStops: StyleGradientStop[]) =>
    onChangeStops([...nextStops].sort((a, b) => a.position - b.position));

  const updateStop = (id: string, patch: Partial<StyleGradientStop>) => {
    commitStops(sortedStops.map((stop) => (stop.id === id ? { ...stop, ...patch } : stop)));
  };

  const removeStop = (id = activeStop?.id || sortedStops[sortedStops.length - 1]?.id) => {
    if (!canEditStopCount || !id || sortedStops.length <= minStops) return;
    const nextStops = sortedStops.filter((stop) => stop.id !== id);
    commitStops(nextStops);
    setActiveStopId(nextStops[0]?.id ?? null);
  };

  const addStopAt = (trackPosition: number) => {
    if (!canEditStopCount) return;
    const position = trackToStopPosition(trackPosition);
    const previousStop =
      [...sortedStops].reverse().find((stop) => stop.position <= position) || sortedStops[0];
    const nextStop = sortedStops.find((stop) => stop.position >= position) || previousStop;
    const span = Math.max(1, nextStop.position - previousStop.position);
    const ratio = Math.min(1, Math.max(0, (position - previousStop.position) / span));
    const nextId = `stop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const nextAlpha = Math.round(previousStop.alpha + (nextStop.alpha - previousStop.alpha) * ratio);
    const nextColor = ratio < 0.5 ? previousStop.color : nextStop.color;
    commitStops([
      ...sortedStops,
      {
        id: nextId,
        color: nextColor,
        alpha: nextAlpha,
        position,
      },
    ]);
    setActiveStopId(nextId);
  };

  const getPointerPosition = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
  };

  return (
    <div className="grid grid-cols-[32px_minmax(0,1fr)_32px] items-center gap-2">
      <button
        type="button"
        disabled={!canEditStopCount || sortedStops.length <= minStops}
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          removeStop();
        }}
        className="h-8 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] text-sm font-bold text-[var(--vr-text-soft)] hover:bg-[var(--vr-accent-soft)] disabled:opacity-30"
        title={removeLabel}
      >
        -
      </button>
      <div
        className="relative h-10 rounded-lg"
        style={{ background }}
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).getAttribute(dataAttribute)) return;
          if (canEditStopCount) addStopAt(getPointerPosition(event));
        }}
      >
        {sortedStops.map((stop) => (
          <button
            key={stop.id}
            type="button"
            {...{ [dataAttribute]: stop.id }}
            className={`absolute top-1/2 h-6 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border shadow ${
              activeStop?.id === stop.id
                ? 'border-white ring-2 ring-[var(--vr-accent)]'
                : 'border-white/80'
            }`}
            style={{
              left: `${stopToTrackPosition(stop.position)}%`,
              backgroundColor: withAlpha(stop.color, stop.alpha / 100),
            }}
            onClick={(event) => {
              event.stopPropagation();
              setActiveStopId(stop.id);
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              setActiveStopId(stop.id);
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
              const track = event.currentTarget.parentElement;
              if (!track) return;
              const rect = track.getBoundingClientRect();
              const trackPosition = Math.min(
                100,
                Math.max(0, ((event.clientX - rect.left) / rect.width) * 100),
              );
              updateStop(stop.id, { position: trackToStopPosition(trackPosition) });
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            aria-label={activeLabel}
          />
        ))}
        {activeStop && (
          <div
            className="absolute top-[calc(100%+6px)] z-[9999] rounded-xl border border-[var(--vr-border)] bg-white p-2 shadow-lg"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            style={{
              left: `max(8px, min(calc(${stopToTrackPosition(
                activeStop.position,
              )}% - 105px), calc(100% - 218px)))`,
              width: '210px',
              maxWidth: 'calc(100% - 16px)',
              ['--vr-surface' as any]: '#ffffff',
              ['--vr-surface-soft' as any]: '#f1f5f9',
              ['--vr-text' as any]: '#1e293b',
              ['--vr-border' as any]: '#e2e8f0',
            }}
          >
            <div
              className="absolute -top-1 h-2 w-2 rotate-45 border-l border-t border-[var(--vr-border)] bg-white"
              style={{
                left: `calc(${stopToTrackPosition(activeStop.position)}% - max(8px, min(calc(${stopToTrackPosition(
                  activeStop.position,
                )}% - 105px), calc(100% - 218px))))`,
              }}
            />
            <div className="grid grid-cols-[42px_1fr_28px] items-center gap-2">
              <input
                type="color"
                value={colorInputValue(activeStop.color)}
                onPointerDown={(event) => event.stopPropagation()}
                onChange={(event) => updateStop(activeStop.id, { color: event.target.value })}
                className="h-8 w-full cursor-pointer rounded-lg border-0 bg-transparent p-0"
              />
              <DragSizeControl
                label={alphaLabel}
                value={activeStop.alpha}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={(value) => updateStop(activeStop.id, { alpha: value })}
              />
              <button
                type="button"
                disabled={!canEditStopCount || sortedStops.length <= minStops}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  removeStop(activeStop.id);
                }}
                className="h-8 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] text-sm font-bold text-[var(--vr-text-muted)] disabled:opacity-30"
              >
                -
              </button>
            </div>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() =>
          canEditStopCount &&
          addStopAt(Math.min(100, Math.max(0, stopToTrackPosition(activeStop?.position ?? 50) + 10)))
        }
        disabled={!canEditStopCount}
        className="h-8 rounded-lg bg-[var(--vr-surface-soft)] text-sm font-normal text-[var(--vr-text-soft)] hover:bg-[var(--vr-accent-soft)]"
        title={addLabel}
      >
        +
      </button>
    </div>
  );
}

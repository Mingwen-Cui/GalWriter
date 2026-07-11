import { Blend, ChevronDown, Image as ImageIcon, Plus, RotateCcw, RotateCw, Trash2, Upload } from 'lucide-react';
import { useRef } from 'react';

import type { RenderColorStop, RenderFillStyle } from '../shared/types';

type PopoverTone = 'fill' | 'stroke' | 'shadow';

const toneClass: Record<PopoverTone, string> = {
  fill: 'bg-sky-50 border-sky-200 text-sky-950',
  stroke: 'bg-violet-50 border-violet-200 text-violet-950',
  shadow: 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-950',
};

type Text = {
  solidTitle: string;
  gradientTitle: string;
  imageTitle: string;
  upload: string;
  replace: string;
  remove: string;
  addStop: string;
  removeStop: string;
  reverse: string;
  hex: string;
  fit: string;
  max: string;
  crop: string;
  rotation: string;
  opacity: string;
  resetCrop: string;
};

function ScrubbableNumber({
  value,
  min,
  max,
  label,
  suffix,
  icon,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  label: string;
  suffix: string;
  icon: React.ReactNode;
  onChange: (value: number) => void;
}) {
  const dragRef = useRef<{ x: number; value: number } | null>(null);
  const clamp = (next: number) => Math.max(min ?? -Infinity, Math.min(max ?? Infinity, next));
  return (
    <label className="flex h-10 min-w-0 items-center gap-2 rounded-xl bg-white px-3" title={label}>
      <span className="shrink-0" aria-hidden="true">{icon}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(clamp(Number(event.target.value) || 0))}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          dragRef.current = { x: event.clientX, value };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
          const delta = Math.round((event.clientX - drag.x) / 2);
          if (delta) onChange(clamp(drag.value + delta));
        }}
        onPointerUp={(event) => {
          dragRef.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { dragRef.current = null; }}
        className="min-w-0 flex-1 cursor-ew-resize bg-transparent text-right text-sm font-bold outline-none"
        aria-label={label}
      />
      <span className="text-xs text-slate-400">{suffix}</span>
    </label>
  );
}

export function SolidColorPopover({
  tone,
  text,
  color,
  alpha,
  onColorChange,
  onAlphaChange,
}: {
  tone: PopoverTone;
  text: Text;
  color: string;
  alpha: number;
  onColorChange: (value: string) => void;
  onAlphaChange: (value: number) => void;
}) {
  return (
    <div className={`rounded-xl border p-3 shadow-xl ${toneClass[tone]}`}>
      <div className="mb-3 text-xs font-black">{text.solidTitle}</div>
      <div className="grid grid-cols-[44px_minmax(0,1fr)_56px] items-center gap-2">
        <input type="color" value={color} onChange={(event) => onColorChange(event.target.value)} />
        <input
          value={color}
          onChange={(event) => onColorChange(event.target.value)}
          className="h-9 min-w-0 rounded-lg border border-white/70 bg-white px-2 text-xs outline-none"
          aria-label={text.hex}
        />
        <input
          type="number"
          min={0}
          max={100}
          value={alpha}
          onChange={(event) => onAlphaChange(Math.max(0, Math.min(100, Number(event.target.value) || 0)))}
          className="h-9 rounded-lg border border-white/70 bg-white px-1 text-center text-xs outline-none"
        />
      </div>
    </div>
  );
}

export function GradientPopover({
  tone,
  text,
  angle,
  stops,
  onAngleChange,
  onStopsChange,
}: {
  tone: PopoverTone;
  text: Text;
  angle: number;
  stops: RenderColorStop[];
  onAngleChange: (value: number) => void;
  onStopsChange: (value: RenderColorStop[]) => void;
}) {
  const orderedStops = [...stops].sort((a, b) => a.position - b.position);
  const cssStops = orderedStops.map((stop) => `${stop.color} ${stop.position}%`).join(', ');
  const updateStop = (id: string, updates: Partial<RenderColorStop>) =>
    onStopsChange(orderedStops.map((stop) => (stop.id === id ? { ...stop, ...updates } : stop)));
  const addStop = () =>
    onStopsChange([
      ...orderedStops,
      { id: `stop-${Date.now().toString(36)}`, color: orderedStops.at(-1)?.color || '#ffffff', alpha: 100, position: 50 },
    ]);
  return (
    <div className={`rounded-xl border p-3 shadow-xl ${toneClass[tone]}`}>
      <div className="mb-3 flex items-center justify-between gap-2 text-xs font-black">
        <span>{text.gradientTitle}</span>
        <button type="button" onClick={() => onStopsChange([...orderedStops].reverse().map((stop) => ({ ...stop, position: 100 - stop.position })))} className="rounded-lg bg-white px-2 py-1">
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mb-3 h-8 rounded-lg border border-white/80" style={{ background: `linear-gradient(90deg, ${cssStops})` }} />
      <div className="mb-3 grid grid-cols-[1fr_64px] gap-2">
        <input
          type="range"
          min={0}
          max={360}
          value={angle}
          onChange={(event) => onAngleChange(Number(event.target.value))}
        />
        <input
          type="number"
          min={0}
          max={360}
          value={angle}
          onChange={(event) => onAngleChange(Number(event.target.value) || 0)}
          className="h-8 rounded-lg border border-white/70 bg-white px-1 text-center text-xs outline-none"
        />
      </div>
      <div className="space-y-2">
        {orderedStops.map((stop) => (
          <div key={stop.id} className="grid grid-cols-[32px_1fr_48px_28px] items-center gap-2">
            <input type="color" value={stop.color} onChange={(event) => updateStop(stop.id, { color: event.target.value })} />
            <input
              type="number"
              min={0}
              max={100}
              value={stop.position}
              onChange={(event) => updateStop(stop.id, { position: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })}
              className="h-8 rounded-lg border border-white/70 bg-white px-1 text-center text-xs outline-none"
            />
            <input
              type="number"
              min={0}
              max={100}
              value={stop.alpha}
              onChange={(event) => updateStop(stop.id, { alpha: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })}
              className="h-8 rounded-lg border border-white/70 bg-white px-1 text-center text-xs outline-none"
            />
            <button
              type="button"
              disabled={orderedStops.length <= 2}
              onClick={() => onStopsChange(orderedStops.filter((item) => item.id !== stop.id))}
              className="grid h-8 place-items-center rounded-lg bg-white disabled:opacity-40"
              aria-label={text.removeStop}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addStop} className="mt-3 flex h-8 w-full items-center justify-center gap-2 rounded-lg bg-white text-xs font-bold">
        <Plus className="h-3.5 w-3.5" />
        {text.addStop}
      </button>
    </div>
  );
}

export function ImageFillPopover({
  tone,
  text,
  value,
  onChange,
  supportsFit = true,
  supportsCrop = true,
  supportsRotation = true,
  supportsOpacity = true,
}: {
  tone: PopoverTone;
  text: Text;
  value: Pick<RenderFillStyle, 'imageUrl' | 'imageFit' | 'imageAngle' | 'imageAlpha' | 'imageScale' | 'imageOffsetX' | 'imageOffsetY'>;
  onChange: (updates: Partial<RenderFillStyle>) => void;
  supportsFit?: boolean;
  supportsCrop?: boolean;
  supportsRotation?: boolean;
  supportsOpacity?: boolean;
}) {
  const fitOptions = [
    ...(supportsFit ? [{ value: 'fit' as const, label: text.fit }] : []),
    ...(supportsFit ? [{ value: 'max' as const, label: text.max }] : []),
    ...(supportsCrop ? [{ value: 'crop' as const, label: text.crop }] : []),
  ];
  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onChange({
      imageUrl: String(reader.result || ''),
      imageScale: 100,
      imageOffsetX: 0,
      imageOffsetY: 0,
    });
    reader.readAsDataURL(file);
  };

  return (
    <div className={`relative rounded-[22px] border p-3 shadow-xl ${toneClass[tone]}`}>
      <div className={`mb-3 grid gap-2 ${supportsFit || supportsCrop ? 'grid-cols-[minmax(0,1.35fr)_minmax(0,.85fr)_minmax(92px,1.15fr)_40px]' : 'grid-cols-[minmax(0,.85fr)_minmax(112px,1.15fr)]'}`}>
        {(supportsFit || supportsCrop) && (
          <label className="relative flex h-10 min-w-0 items-center gap-2 rounded-xl bg-white px-3 text-xs font-bold">
            <ImageIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <select
              value={value.imageFit}
              onChange={(event) => onChange({ imageFit: event.target.value as RenderFillStyle['imageFit'] })}
              className="absolute inset-0 cursor-pointer appearance-none opacity-0"
              aria-label={text.imageTitle}
            >
              {fitOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <span className="min-w-0 flex-1 truncate">{fitOptions.find((option) => option.value === value.imageFit)?.label || text.crop}</span>
            <ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" />
          </label>
        )}
        {supportsRotation && (
          <ScrubbableNumber value={value.imageAngle} label={text.rotation} suffix="°" icon={<RotateCw className="h-4 w-4" />} onChange={(imageAngle) => onChange({ imageAngle })} />
        )}
        {supportsOpacity && (
          <ScrubbableNumber value={value.imageAlpha} min={0} max={100} label={text.opacity} suffix="%" icon={<Blend className="h-4 w-4" />} onChange={(imageAlpha) => onChange({ imageAlpha })} />
        )}
        {(supportsFit || supportsCrop) && (
          <button type="button" onClick={() => onChange({ imageAngle: 0, imageScale: 100, imageOffsetX: 0, imageOffsetY: 0 })} className="grid h-10 w-10 place-items-center rounded-xl bg-white" title={text.resetCrop} aria-label={text.resetCrop}>
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
      </div>
      <label
        className="group relative grid min-h-44 cursor-pointer place-items-center overflow-hidden rounded-[18px] border border-white/80"
        style={{ backgroundColor: '#f8fafc', backgroundImage: 'linear-gradient(45deg,#e5e7eb 25%,transparent 25%),linear-gradient(-45deg,#e5e7eb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e7eb 75%),linear-gradient(-45deg,transparent 75%,#e5e7eb 75%)', backgroundSize: '24px 24px', backgroundPosition: '0 0,0 12px,12px -12px,-12px 0' }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); handleFile(event.dataTransfer.files?.[0]); }}
      >
        {value.imageUrl && <img src={value.imageUrl} alt="" className="absolute inset-0 h-full w-full object-contain" draggable={false} />}
        <span className="relative z-10 flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-transform group-hover:scale-[1.02]">
          <Upload className="h-4 w-4" aria-hidden="true" />
          {value.imageUrl ? text.replace : text.upload}
        </span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
            event.target.value = '';
          }}
        />
      </label>
    </div>
  );
}

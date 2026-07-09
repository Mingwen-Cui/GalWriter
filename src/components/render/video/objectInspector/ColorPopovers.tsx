import { ImagePlus, Plus, RotateCcw, Trash2 } from 'lucide-react';

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
};

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
}: {
  tone: PopoverTone;
  text: Text;
  value: Pick<RenderFillStyle, 'imageUrl' | 'imageFit' | 'imageAngle' | 'imageAlpha'>;
  onChange: (updates: Partial<RenderFillStyle>) => void;
}) {
  return (
    <div className={`rounded-xl border p-3 shadow-xl ${toneClass[tone]}`}>
      <div className="mb-3 text-xs font-black">{text.imageTitle}</div>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {(['fit', 'max', 'crop'] as const).map((fit) => (
          <button
            key={fit}
            type="button"
            onClick={() => onChange({ imageFit: fit })}
            className={`h-8 rounded-lg text-xs font-bold ${value.imageFit === fit ? 'bg-indigo-500 text-white' : 'bg-white'}`}
          >
            {fit}
          </button>
        ))}
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <input type="number" value={value.imageAngle} onChange={(event) => onChange({ imageAngle: Number(event.target.value) || 0 })} className="h-8 rounded-lg border border-white/70 bg-white px-2 text-xs outline-none" />
        <input type="number" min={0} max={100} value={value.imageAlpha} onChange={(event) => onChange({ imageAlpha: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })} className="h-8 rounded-lg border border-white/70 bg-white px-2 text-xs outline-none" />
      </div>
      <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg bg-white text-xs font-bold">
        <ImagePlus className="h-3.5 w-3.5" />
        {value.imageUrl ? text.replace : text.upload}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => onChange({ imageUrl: String(reader.result || '') });
            reader.readAsDataURL(file);
            event.target.value = '';
          }}
        />
      </label>
      {value.imageUrl && (
        <button type="button" onClick={() => onChange({ imageUrl: '' })} className="mt-2 flex h-8 w-full items-center justify-center gap-2 rounded-lg bg-white text-xs font-bold text-rose-600">
          <Trash2 className="h-3.5 w-3.5" />
          {text.remove}
        </button>
      )}
    </div>
  );
}

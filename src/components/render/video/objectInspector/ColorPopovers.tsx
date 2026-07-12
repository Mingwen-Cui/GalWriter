import { Blend, ChevronDown, Image as ImageIcon, Pipette, Plus, RotateCcw, RotateCw, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { RenderColorStop, RenderFillStyle } from '../shared/types';
import { parseColorValue, toHex8 } from '../shared/colorValue';

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
        className="min-w-0 flex-1 cursor-ew-resize bg-transparent text-right text-xs font-medium outline-none"
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
  const parsed = parseColorValue(color);
  const displayValue = toHex8(color, alpha);
  const hsv = hexToHsv(parsed.hex);
  const saturationRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const opacityRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(displayValue);
  const [format, setFormat] = useState<ColorFormat>('HEX');
  const [formatOpen, setFormatOpen] = useState(false);
  useEffect(() => setDraft(formatColor(parsed.hex, alpha, format)), [alpha, format, parsed.hex]);
  const commitTextColor = (value: string) => {
    const next = parseColorValue(value, displayValue);
    onColorChange(next.hex);
    onAlphaChange(next.alpha);
  };
  const commitHsv = (hue: number, saturation: number, brightness: number) =>
    onColorChange(hsvToHex(hue, saturation, brightness));
  const updateSaturation = (clientX: number, clientY: number) => {
    const rect = saturationRef.current?.getBoundingClientRect();
    if (!rect) return;
    const saturation = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const brightness = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    commitHsv(hsv.h, saturation, brightness);
  };
  const updateHue = (clientX: number) => {
    const rect = hueRef.current?.getBoundingClientRect();
    if (!rect) return;
    commitHsv(Math.max(0, Math.min(359.999, ((clientX - rect.left) / rect.width) * 360)), hsv.s, hsv.v);
  };
  const updateOpacity = (clientX: number) => {
    const rect = opacityRef.current?.getBoundingClientRect();
    if (!rect) return;
    onAlphaChange(Math.round(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * 100));
  };
  const eyeDropperSupported = typeof window !== 'undefined' && 'EyeDropper' in window;
  return (
    <div className={`rounded-[22px] border p-2.5 shadow-xl ${toneClass[tone]}`}>
      <div
        ref={saturationRef}
        className="relative h-32 touch-none overflow-hidden rounded-2xl bg-red-500 shadow-inner"
        style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          updateSaturation(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) updateSaturation(event.clientX, event.clientY);
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        aria-label={text.solidTitle}
      >
        <span className="absolute inset-0 bg-gradient-to-r from-white to-transparent" />
        <span className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
        <span
          className="pointer-events-none absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white shadow-[0_1px_5px_#00000080]"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
        />
      </div>

      <div className="mt-2.5 grid grid-cols-[40px_minmax(0,1fr)] items-center gap-2.5">
        <button
          type="button"
          disabled={!eyeDropperSupported}
          onClick={async () => {
            const EyeDropper = (window as unknown as { EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
            if (!EyeDropper) return;
            try {
              const result = await new EyeDropper().open();
              onColorChange(result.sRGBHex.toLowerCase());
            } catch {
              // The user cancelled the system eyedropper.
            }
          }}
          className="grid h-10 w-10 place-items-center rounded-xl bg-white text-slate-950 disabled:cursor-not-allowed disabled:opacity-35"
          title="Eyedropper"
          aria-label="Eyedropper"
        >
          <Pipette className="h-5 w-5" />
        </button>
        <div className="space-y-2.5">
          <div
            ref={hueRef}
            className="relative h-5 touch-none rounded-full"
            style={{ background: 'linear-gradient(90deg,#ff0000 0%,#ffff00 16.67%,#00ff00 33.33%,#00ffff 50%,#0000ff 66.67%,#ff00ff 83.33%,#ff0000 100%)' }}
            onPointerDown={(event) => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); updateHue(event.clientX); }}
            onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) updateHue(event.clientX); }}
            onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
            aria-label="Hue"
          >
            <span className="pointer-events-none absolute left-0 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-[4px] border-white shadow-[0_1px_5px_#00000060]" style={{ left: `${hsv.h / 360 * 100}%`, backgroundColor: `hsl(${hsv.h} 100% 50%)` }} />
          </div>
          <div
            ref={opacityRef}
            className="relative h-5 touch-none rounded-full"
            style={{
              backgroundColor: '#ffffff',
              backgroundImage: `linear-gradient(90deg,transparent,${parsed.hex}),linear-gradient(45deg,#d1d5db 25%,transparent 25%),linear-gradient(-45deg,#d1d5db 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#d1d5db 75%),linear-gradient(-45deg,transparent 75%,#d1d5db 75%)`,
              backgroundPosition: '0 0,0 0,0 6px,6px -6px,-6px 0',
              backgroundSize: 'auto,12px 12px,12px 12px,12px 12px,12px 12px',
            }}
            onPointerDown={(event) => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); updateOpacity(event.clientX); }}
            onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) updateOpacity(event.clientX); }}
            onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
            aria-label={text.opacity}
          >
            <span className="pointer-events-none absolute top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-[4px] border-white shadow-[0_1px_5px_#00000060]" style={{ left: `${alpha}%`, backgroundColor: displayValue }} />
          </div>
        </div>
      </div>

      <div className="relative mt-2.5 grid h-10 grid-cols-[78px_minmax(0,1fr)_76px] rounded-xl bg-white text-slate-950">
        <button type="button" onClick={() => setFormatOpen((open) => !open)} className="flex items-center justify-center gap-2 rounded-l-xl border-r border-slate-100 text-xs font-medium" title={format} aria-expanded={formatOpen}>
          {format} <ChevronDown className={`h-4 w-4 transition-transform ${formatOpen ? 'rotate-180' : ''}`} />
        </button>
        {formatOpen && (
          <div className="absolute bottom-[calc(100%+8px)] left-0 z-20 w-32 overflow-hidden rounded-2xl bg-slate-950 p-1.5 text-white shadow-2xl">
            {COLOR_FORMATS.map((item) => (
              <button key={item} type="button" onClick={() => { setFormat(item); setFormatOpen(false); setDraft(formatColor(parsed.hex, alpha, item)); }} className={`flex h-9 w-full items-center gap-2 rounded-xl px-3 text-left text-xs font-medium ${format === item ? 'bg-white/12' : 'hover:bg-white/8'}`}>
                <span className="w-4">{format === item ? '✓' : ''}</span>{item}
              </button>
            ))}
          </div>
        )}
        <div className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)]">
          <span className="h-full" style={{ backgroundColor: displayValue }} aria-hidden="true" />
          <input
            value={draft}
            onChange={(event) => {
              const next = event.target.value;
              setDraft(next);
              if (format === 'HEX' && /^#[0-9a-f]{8}$/i.test(next)) commitTextColor(next);
              if ((format === 'RGB' || format === 'CSS') && /^rgba?\(/i.test(next)) commitTextColor(next);
            }}
            onBlur={() => {
              commitTextColor(draft);
              setDraft(formatColor(parsed.hex, alpha, format));
            }}
            className="h-full min-w-0 border-0 bg-white px-3 text-sm font-medium outline-none"
            aria-label={text.hex}
          />
        </div>
        <label className="flex h-full items-center justify-center border-l border-slate-100">
          <input
            type="number"
            min={0}
            max={100}
            value={alpha}
            onChange={(event) => onAlphaChange(Math.max(0, Math.min(100, Number(event.target.value) || 0)))}
            className="w-12 border-0 bg-transparent text-right text-sm outline-none"
            aria-label={text.opacity}
          />
          <span className="ml-1 text-xs text-slate-400">%</span>
        </label>
      </div>
    </div>
  );
}

type ColorFormat = 'HEX' | 'RGB' | 'CSS' | 'HSL' | 'HSB';
const COLOR_FORMATS: ColorFormat[] = ['HEX', 'RGB', 'CSS', 'HSL', 'HSB'];

function formatColor(hex: string, alpha: number, format: ColorFormat) {
  const source = parseColorValue(hex).hex.slice(1);
  const red = Number.parseInt(source.slice(0, 2), 16);
  const green = Number.parseInt(source.slice(2, 4), 16);
  const blue = Number.parseInt(source.slice(4, 6), 16);
  if (format === 'HEX') return toHex8(hex, alpha);
  if (format === 'RGB') return `rgba(${red}, ${green}, ${blue}, ${(alpha / 100).toFixed(2)})`;
  if (format === 'CSS') return `rgb(${red} ${green} ${blue} / ${alpha}%)`;
  const hsv = hexToHsv(hex);
  if (format === 'HSB') return `hsb(${Math.round(hsv.h)}, ${Math.round(hsv.s * 100)}%, ${Math.round(hsv.v * 100)}%, ${alpha}%)`;
  const lightness = hsv.v * (1 - hsv.s / 2);
  const hslSaturation = lightness === 0 || lightness === 1 ? 0 : (hsv.v - lightness) / Math.min(lightness, 1 - lightness);
  return `hsl(${Math.round(hsv.h)} ${Math.round(hslSaturation * 100)}% ${Math.round(lightness * 100)}% / ${alpha}%)`;
}

function hexToHsv(hex: string) {
  const source = parseColorValue(hex).hex.slice(1);
  const red = Number.parseInt(source.slice(0, 2), 16) / 255;
  const green = Number.parseInt(source.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(source.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  return { h: hue < 0 ? hue + 360 : hue, s: max ? delta / max : 0, v: max };
}

function hsvToHex(hue: number, saturation: number, brightness: number) {
  const chroma = brightness * saturation;
  const sector = hue / 60;
  const x = chroma * (1 - Math.abs((sector % 2) - 1));
  const [r1, g1, b1] = sector < 1 ? [chroma, x, 0] : sector < 2 ? [x, chroma, 0] : sector < 3 ? [0, chroma, x] : sector < 4 ? [0, x, chroma] : sector < 5 ? [x, 0, chroma] : [chroma, 0, x];
  const match = brightness - chroma;
  return `#${[r1, g1, b1].map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, '0')).join('')}`;
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
      <div className={`mb-3 grid gap-2 ${supportsFit || supportsCrop ? 'grid-cols-[minmax(0,1.2fr)_minmax(0,.8fr)_minmax(78px,1fr)_36px]' : 'grid-cols-[minmax(0,.8fr)_minmax(96px,1fr)]'}`}>
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
          <button type="button" onClick={() => onChange({ imageAngle: 0, imageScale: 100, imageOffsetX: 0, imageOffsetY: 0 })} className="grid h-10 w-9 place-items-center rounded-xl bg-white" title={text.resetCrop} aria-label={text.resetCrop}>
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
      </div>
      <label
        className="group relative grid min-h-32 cursor-pointer place-items-center overflow-hidden rounded-[18px] border border-white/80"
        style={{ backgroundColor: '#f8fafc', backgroundImage: 'linear-gradient(45deg,#e5e7eb 25%,transparent 25%),linear-gradient(-45deg,#e5e7eb 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e5e7eb 75%),linear-gradient(-45deg,transparent 75%,#e5e7eb 75%)', backgroundSize: '24px 24px', backgroundPosition: '0 0,0 12px,12px -12px,-12px 0' }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); handleFile(event.dataTransfer.files?.[0]); }}
      >
        {value.imageUrl && <img src={value.imageUrl} alt="" className="absolute inset-0 h-full w-full object-contain" draggable={false} />}
        <span className="relative z-10 flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg transition-transform group-hover:scale-[1.02]">
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

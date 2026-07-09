import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Box,
  Eye,
  EyeOff,
  Image,
  Minus,
  PaintBucket,
  Palette,
  RotateCw,
  Sparkles,
  Type,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

import type { Language } from '../../../../lib/i18n';
import { getRenderObjects, isTextRenderObject, updateRenderObject } from '../shared/renderObjects';
import type {
  RenderEditableObject,
  RenderEditableObjectKind,
  RenderEditableTextObject,
  RenderFillStyle,
  RenderStyle,
  TextAlign,
  TextAnimation,
  TypewriterMode,
} from '../shared/types';
import { GradientPopover, ImageFillPopover, SolidColorPopover } from './ColorPopovers';
import { renderObjectText } from './i18n';

type Surface = 'video' | 'web' | 'playtest';
type Popover = null | { group: 'fill' | 'stroke' | 'shadow'; type: 'solid' | 'gradient' | 'image' };

const objectKinds: RenderEditableObjectKind[] = ['dialogBox', 'title', 'body', 'nameplate'];
const fonts = [
  { label: 'Microsoft YaHei', value: '"Microsoft YaHei", "Noto Sans SC", Arial, sans-serif' },
  { label: 'SimSun', value: 'SimSun, "Noto Serif SC", serif' },
  { label: 'SimHei', value: 'SimHei, "Noto Sans SC", sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
];

const groupTone = {
  position: 'bg-emerald-50',
  text: 'bg-green-50',
  fill: 'bg-sky-50',
  stroke: 'bg-indigo-50',
  shadow: 'bg-fuchsia-50',
  animation: 'bg-pink-50',
  extra: 'bg-slate-50',
};

export function RenderObjectInspector({
  language,
  renderStyle,
  updateRenderStyle,
  surface = 'web',
}: {
  language: Language;
  renderStyle: RenderStyle;
  updateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
  surface?: Surface;
}) {
  const text = renderObjectText(language);
  const objects = getRenderObjects(renderStyle);
  const selectedKind = renderStyle.selectedRenderObject || 'dialogBox';
  const selected = objects[selectedKind];
  const textObject = isTextRenderObject(selectedKind) ? (selected as RenderEditableTextObject) : null;
  const [popover, setPopover] = useState<Popover>(null);

  const setSelectedKind = (kind: RenderEditableObjectKind) => {
    updateRenderStyle('selectedRenderObject', kind);
  };

  const setObject = (updates: Partial<RenderEditableObject | RenderEditableTextObject>) => {
    const nextObjects = updateRenderObject(renderStyle, selectedKind, updates);
    updateRenderStyle('renderObjects', nextObjects);
    syncLegacyFields(selectedKind, nextObjects[selectedKind], updateRenderStyle);
  };

  const setFill = (updates: Partial<RenderFillStyle>) => {
    const nextFill = { ...selected.fill, ...updates };
    setObject({ fill: nextFill });
  };

  const advancedVideoDisabled = surface === 'video';

  return (
    <div className="space-y-3 text-[12px] text-slate-900">
      <div className="grid grid-cols-2 gap-2">
        {objectKinds.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => setSelectedKind(kind)}
            className={`h-9 rounded-lg px-2 text-left font-bold transition-colors ${
              selectedKind === kind ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {text.object[kind]}
          </button>
        ))}
      </div>

      <InspectorGroup title={text.group.position} icon={<Box className="h-3.5 w-3.5" />} className={groupTone.position}>
        <div className="grid grid-cols-2 gap-2">
          <ToggleButton
            active={selected.visible}
            label={text.field.visible}
            onClick={() => setObject({ visible: !selected.visible })}
            activeIcon={<Eye className="h-3.5 w-3.5" />}
            inactiveIcon={<EyeOff className="h-3.5 w-3.5" />}
          />
          <NumberField label={text.field.radius} value={selected.radius} min={0} max={200} onChange={(value) => setObject({ radius: value })} />
          <NumberField label={text.field.x} value={selected.x} min={-200} max={200} onChange={(value) => setObject({ x: value })} />
          <NumberField label={text.field.y} value={selected.y} min={-200} max={200} onChange={(value) => setObject({ y: value })} />
          <NumberField label={text.field.width} value={selected.width} min={0} max={200} onChange={(value) => setObject({ width: value })} />
          <NumberField label={text.field.height} value={selected.height} min={0} max={200} onChange={(value) => setObject({ height: value })} />
          <NumberField label={text.field.rotation} value={selected.rotation} min={-180} max={180} onChange={(value) => setObject({ rotation: value })} />
          <div className="grid grid-cols-2 gap-2">
            <ToggleButton active={selected.flipX} label={text.field.flipX} onClick={() => setObject({ flipX: !selected.flipX })} compact />
            <ToggleButton active={selected.flipY} label={text.field.flipY} onClick={() => setObject({ flipY: !selected.flipY })} compact />
          </div>
        </div>
      </InspectorGroup>

      {textObject && (
        <InspectorGroup title={text.group.text} icon={<Type className="h-3.5 w-3.5" />} className={groupTone.text}>
          <div className="grid grid-cols-2 gap-2">
            <SelectField label={text.field.font} value={textObject.fontFamily} options={fonts} onChange={(value) => setObject({ fontFamily: value })} />
            <ToggleButton active={textObject.underline} label={text.field.underline} onClick={() => setObject({ underline: !textObject.underline })} compact />
            <NumberField label={text.field.fontSize} value={textObject.fontSize} min={8} max={160} onChange={(value) => setObject({ fontSize: value })} />
            <NumberField label={text.field.fontWeight} value={textObject.fontWeight} min={100} max={900} step={100} onChange={(value) => setObject({ fontWeight: value })} />
            <NumberField label={text.field.letterSpacing} value={textObject.letterSpacing} min={-10} max={60} step={0.5} onChange={(value) => setObject({ letterSpacing: value })} />
            <NumberField label={text.field.lineHeight} value={textObject.lineHeight} min={0.6} max={3} step={0.05} onChange={(value) => setObject({ lineHeight: value })} />
          </div>
          <AlignButtons value={textObject.textAlign} onChange={(value) => setObject({ textAlign: value, horizontalAlign: value })} />
        </InspectorGroup>
      )}

      <InspectorGroup title={text.group.fill} icon={<PaintBucket className="h-3.5 w-3.5" />} className={groupTone.fill}>
        <TypeTabs value={selected.fill.type} text={text} onChange={(type) => setFill({ type })} />
        <ColorSummary
          color={selected.fill.color}
          alpha={selected.fill.alpha}
          onClick={() => setPopover(popover?.group === 'fill' ? null : { group: 'fill', type: selected.fill.type })}
        />
        {popover?.group === 'fill' && selected.fill.type === 'solid' && (
          <SolidColorPopover tone="fill" text={text.popover} color={selected.fill.color} alpha={selected.fill.alpha} onColorChange={(color) => setFill({ color })} onAlphaChange={(alpha) => setFill({ alpha })} />
        )}
        {popover?.group === 'fill' && selected.fill.type === 'gradient' && (
          <GradientPopover tone="fill" text={text.popover} angle={selected.fill.gradientAngle} stops={selected.fill.gradientStops} onAngleChange={(gradientAngle) => setFill({ gradientAngle })} onStopsChange={(gradientStops) => setFill({ gradientStops })} />
        )}
        {popover?.group === 'fill' && selected.fill.type === 'image' && (
          <ImageFillPopover tone="fill" text={text.popover} value={selected.fill} onChange={setFill} />
        )}
      </InspectorGroup>

      <InspectorGroup title={text.group.stroke} icon={<Minus className="h-3.5 w-3.5" />} className={groupTone.stroke}>
        <DisabledNotice show={advancedVideoDisabled} label={text.disabled.videoOnly} />
        <div className={advancedVideoDisabled ? 'pointer-events-none opacity-45' : ''}>
          <div className="grid grid-cols-2 gap-2">
            <ToggleButton active={selected.stroke.enabled} label={text.group.stroke} onClick={() => setObject({ stroke: { ...selected.stroke, enabled: !selected.stroke.enabled } })} compact />
            <NumberField label={text.field.strokeWidth} value={selected.stroke.width} min={0} max={40} onChange={(width) => setObject({ stroke: { ...selected.stroke, width } })} />
          </div>
          <ColorSummary color={selected.stroke.color} alpha={selected.stroke.alpha} onClick={() => setPopover(popover?.group === 'stroke' ? null : { group: 'stroke', type: 'solid' })} />
          {popover?.group === 'stroke' && (
            <SolidColorPopover tone="stroke" text={text.popover} color={selected.stroke.color} alpha={selected.stroke.alpha} onColorChange={(color) => setObject({ stroke: { ...selected.stroke, color } })} onAlphaChange={(alpha) => setObject({ stroke: { ...selected.stroke, alpha } })} />
          )}
        </div>
      </InspectorGroup>

      <InspectorGroup title={text.group.shadow} icon={<Palette className="h-3.5 w-3.5" />} className={groupTone.shadow}>
        <DisabledNotice show={advancedVideoDisabled} label={text.disabled.videoOnly} />
        <div className={`grid grid-cols-2 gap-2 ${advancedVideoDisabled ? 'pointer-events-none opacity-45' : ''}`}>
          <ToggleButton active={selected.shadow.enabled} label={text.group.shadow} onClick={() => setObject({ shadow: { ...selected.shadow, enabled: !selected.shadow.enabled } })} compact />
          <NumberField label={text.field.blur} value={selected.shadow.blur} min={0} max={120} onChange={(blur) => setObject({ shadow: { ...selected.shadow, blur } })} />
          <NumberField label={text.field.x} value={selected.shadow.x} min={-120} max={120} onChange={(x) => setObject({ shadow: { ...selected.shadow, x } })} />
          <NumberField label={text.field.y} value={selected.shadow.y} min={-120} max={120} onChange={(y) => setObject({ shadow: { ...selected.shadow, y } })} />
        </div>
      </InspectorGroup>

      <InspectorGroup title={text.group.animation} icon={<Sparkles className="h-3.5 w-3.5" />} className={groupTone.animation}>
        <SelectField
          label={text.group.animation}
          value={selected.animation.animation}
          options={[
            { value: 'none', label: text.option.none },
            { value: 'fade', label: text.option.fade },
            { value: 'slideUp', label: text.option.slideUp },
            { value: 'typewriter', label: text.option.typewriter },
          ]}
          onChange={(value) => setObject({ animation: { ...selected.animation, animation: value as TextAnimation } })}
        />
        <div className="mt-2 grid grid-cols-2 gap-2">
          <NumberField label={text.field.duration} value={selected.animation.durationMs} min={0} max={10000} step={50} onChange={(durationMs) => setObject({ animation: { ...selected.animation, durationMs } })} />
          <SelectField
            label={text.field.typewriter}
            value={selected.animation.typewriterMode}
            options={[
              { value: 'character', label: text.option.character },
              { value: 'sentence', label: text.option.sentence },
              { value: 'line', label: text.option.line },
            ]}
            onChange={(value) => setObject({ animation: { ...selected.animation, typewriterMode: value as TypewriterMode } })}
          />
        </div>
      </InspectorGroup>

      {selectedKind === 'nameplate' && (
        <InspectorGroup title={text.group.extra} icon={<RotateCw className="h-3.5 w-3.5" />} className={groupTone.extra}>
          <div className="grid grid-cols-2 gap-2">
            <ToggleButton active={renderStyle.nameplateInside} label={text.field.insideDialog} onClick={() => updateRenderStyle('nameplateInside', !renderStyle.nameplateInside)} compact />
            <ToggleButton active={renderStyle.nameplateFollowCharacter} label={text.field.followCharacter} onClick={() => updateRenderStyle('nameplateFollowCharacter', !renderStyle.nameplateFollowCharacter)} compact />
            <NumberField label={text.field.textGap} value={renderStyle.nameplateTextGap ?? 8} min={-60} max={80} onChange={(value) => updateRenderStyle('nameplateTextGap', value)} />
          </div>
        </InspectorGroup>
      )}
    </div>
  );
}

function syncLegacyFields(
  kind: RenderEditableObjectKind,
  object: RenderEditableObject | RenderEditableTextObject,
  updateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void,
) {
  if (kind === 'dialogBox') {
    updateRenderStyle('dialogVisible', object.visible);
    updateRenderStyle('dialogOffsetX', object.x);
    updateRenderStyle('dialogOffsetY', object.y);
    updateRenderStyle('dialogWidth', object.width);
    updateRenderStyle('dialogHeight', object.height);
    updateRenderStyle('dialogRadius', object.radius);
    updateRenderStyle('dialogBackgroundType', object.fill.type);
    updateRenderStyle('panelColor', object.fill.color);
    updateRenderStyle('panelColorAlpha', object.fill.alpha);
    updateRenderStyle('dialogGradientAngle', object.fill.gradientAngle);
    updateRenderStyle('dialogGradientStops', object.fill.gradientStops);
    updateRenderStyle('dialogImageUrl', object.fill.imageUrl);
  }
  if (kind === 'title' || kind === 'body') {
    const textObject = object as RenderEditableTextObject;
    const prefix = kind;
    if (kind === 'title') updateRenderStyle('titleVisible', textObject.visible);
    updateRenderStyle(`${prefix}FontFamily` as keyof RenderStyle, textObject.fontFamily as never);
    updateRenderStyle(`${prefix}FontSize` as keyof RenderStyle, textObject.fontSize as never);
    updateRenderStyle(`${prefix}Color` as keyof RenderStyle, textObject.fill.color as never);
    updateRenderStyle(`${prefix}ColorAlpha` as keyof RenderStyle, textObject.fill.alpha as never);
    updateRenderStyle(`${prefix}StrokeColor` as keyof RenderStyle, textObject.stroke.color as never);
    updateRenderStyle(`${prefix}StrokeWidth` as keyof RenderStyle, textObject.stroke.width as never);
    updateRenderStyle(`${prefix}Align` as keyof RenderStyle, textObject.textAlign as never);
    updateRenderStyle(`${prefix}LetterSpacing` as keyof RenderStyle, textObject.letterSpacing as never);
    updateRenderStyle(`${prefix}LineHeight` as keyof RenderStyle, textObject.lineHeight as never);
    updateRenderStyle(`${prefix}Animation` as keyof RenderStyle, textObject.animation.animation as never);
    updateRenderStyle(`${prefix}TypewriterMode` as keyof RenderStyle, textObject.animation.typewriterMode as never);
  }
  if (kind === 'nameplate') {
    const textObject = object as RenderEditableTextObject;
    updateRenderStyle('nameplateVisible', textObject.visible);
    updateRenderStyle('nameplateOffsetX', textObject.x);
    updateRenderStyle('nameplateOffsetY', textObject.y);
    updateRenderStyle('nameplateScale', textObject.width);
    updateRenderStyle('nameplateRadius', textObject.radius);
    updateRenderStyle('nameplateFontFamily', textObject.fontFamily);
    updateRenderStyle('nameplateFontSize', textObject.fontSize);
    updateRenderStyle('nameplateTextColor', textObject.fill.color);
    updateRenderStyle('nameplateTextColorAlpha', textObject.fill.alpha);
    updateRenderStyle('nameplateBackgroundType', textObject.fill.type);
    updateRenderStyle('nameplateColor', textObject.fill.color);
    updateRenderStyle('nameplateColorAlpha', textObject.fill.alpha);
    updateRenderStyle('nameplateGradientAngle', textObject.fill.gradientAngle);
    updateRenderStyle('nameplateGradientStops', textObject.fill.gradientStops);
    updateRenderStyle('nameplateImageUrl', textObject.fill.imageUrl);
  }
}

function InspectorGroup({ title, icon, className, children }: { title: string; icon: React.ReactNode; className: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-xl p-3 ${className}`}>
      <div className="mb-2 flex items-center gap-2 text-xs font-black">
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}

function NumberField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (value: number) => void }) {
  return (
    <label className="grid h-9 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg bg-white px-2">
      <span className="text-xs font-bold text-slate-600">{label}</span>
      <input type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || 0)))} className="min-w-0 bg-transparent text-right text-xs outline-none" />
    </label>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: Array<{ label: string; value: string }>; onChange: (value: string) => void }) {
  return (
    <label className="grid h-9 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg bg-white px-2">
      <span className="text-xs font-bold text-slate-600">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 bg-transparent text-right text-xs outline-none">
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleButton({ active, label, onClick, activeIcon, inactiveIcon, compact = false }: { active: boolean; label: string; onClick: () => void; activeIcon?: React.ReactNode; inactiveIcon?: React.ReactNode; compact?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`flex h-9 items-center ${compact ? 'justify-center' : 'justify-start'} gap-2 rounded-lg px-2 text-xs font-bold ${active ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'}`}>
      {active ? activeIcon : inactiveIcon}
      <span className="truncate">{label}</span>
    </button>
  );
}

function AlignButtons({ value, onChange }: { value: TextAlign; onChange: (value: TextAlign) => void }) {
  return (
    <div className="mt-2 grid grid-cols-3 overflow-hidden rounded-lg bg-white">
      {[
        ['left', <AlignLeft className="h-4 w-4" />],
        ['center', <AlignCenter className="h-4 w-4" />],
        ['right', <AlignRight className="h-4 w-4" />],
      ].map(([align, icon]) => (
        <button key={align as string} type="button" onClick={() => onChange(align as TextAlign)} className={`grid h-9 place-items-center ${value === align ? 'bg-indigo-600 text-white' : 'text-slate-700'}`}>
          {icon as React.ReactNode}
        </button>
      ))}
    </div>
  );
}

function TypeTabs({ value, text, onChange }: { value: RenderFillStyle['type']; text: ReturnType<typeof renderObjectText>; onChange: (value: RenderFillStyle['type']) => void }) {
  return (
    <div className="mb-2 grid grid-cols-3 overflow-hidden rounded-lg bg-white">
      {[
        ['solid', text.option.solid, <Palette className="h-3.5 w-3.5" />],
        ['gradient', text.option.gradient, <Box className="h-3.5 w-3.5" />],
        ['image', text.option.image, <Image className="h-3.5 w-3.5" />],
      ].map(([type, label, icon]) => (
        <button key={type as string} type="button" onClick={() => onChange(type as RenderFillStyle['type'])} className={`flex h-9 items-center justify-center gap-1 text-xs font-bold ${value === type ? 'bg-indigo-600 text-white' : 'text-slate-700'}`}>
          {icon as React.ReactNode}
          {label as string}
        </button>
      ))}
    </div>
  );
}

function ColorSummary({ color, alpha, onClick }: { color: string; alpha: number; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="grid h-9 w-full grid-cols-[44px_1fr_58px] overflow-hidden rounded-lg bg-white text-left text-xs font-bold">
      <span style={{ background: color }} />
      <span className="flex items-center px-2">{color}</span>
      <span className="flex items-center justify-center text-slate-500">{alpha}%</span>
    </button>
  );
}

function DisabledNotice({ show, label }: { show: boolean; label: string }) {
  if (!show) return null;
  return <div className="mb-2 rounded-lg bg-white/75 px-2 py-1 text-[11px] font-bold text-slate-500">{label}</div>;
}

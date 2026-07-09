import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Baseline,
  Blend,
  Box,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Palette,
  Type,
} from 'lucide-react';
import type React from 'react';
import { useState } from 'react';

import type { Language } from '../../../lib/i18n';
import { DragSizeControl } from '../video/controls/RenderControls';
import {
  GradientPopover,
  ImageFillPopover,
  SolidColorPopover,
} from '../video/objectInspector/ColorPopovers';
import { renderObjectText } from '../video/objectInspector/i18n';
import type { RenderFillType, TextAlign, WebMenuElement } from '../video/shared/types';
import { normalizeGradientStops } from './webGradientStops';

type InspectorProps = {
  element: WebMenuElement;
  language: Language;
  showDescriptions: boolean;
  onUpdate: (patch: Partial<WebMenuElement>) => void;
};

type Popover =
  | null
  | {
      group: 'text' | 'fill' | 'stroke' | 'image';
      type: RenderFillType;
    };

const FONT_OPTIONS = [
  { label: 'Microsoft YaHei', value: '"Microsoft YaHei", "Noto Sans SC", Arial, sans-serif' },
  { label: 'SimSun', value: 'SimSun, "Noto Serif SC", serif' },
  { label: 'SimHei', value: 'SimHei, "Noto Sans SC", sans-serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
];

const BLEND_OPTIONS = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
];

export function StartMenuElementInspector({
  element,
  language,
  showDescriptions: _showDescriptions,
  onUpdate,
}: InspectorProps) {
  const text = renderObjectText(language);
  const [popover, setPopover] = useState<Popover>(null);
  const backgroundType = element.backgroundType || 'solid';
  const gradientStops = normalizeGradientStops(
    element.backgroundGradientStops,
    element.backgroundGradientStart || '#0ea5e9',
    element.backgroundGradientEnd || '#0f172a',
  );
  const hasTextControls = element.kind !== 'image';
  const hasFillControls = element.kind !== 'text';

  return (
    <div className="space-y-3 text-[12px] text-slate-900">
      <Group title={text.group.position} icon={<Box className="h-3.5 w-3.5" />} tone="position">
        <button
          type="button"
          onClick={() => onUpdate({ visible: element.visible === false })}
          className={`mb-2 flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-xs font-bold ${
            element.visible === false ? 'bg-white text-slate-500' : 'bg-[#4f46e5] text-white'
          }`}
        >
          {element.visible === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {text.field.visible}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label={text.field.x} value={element.x} min={-200} max={200} onChange={(x) => onUpdate({ x })} />
          <NumberField label={text.field.y} value={element.y} min={-200} max={200} onChange={(y) => onUpdate({ y })} />
          <NumberField label={text.field.width} value={element.width} min={1} max={200} onChange={(width) => onUpdate({ width })} />
          <NumberField label={text.field.height} value={element.height} min={1} max={200} onChange={(height) => onUpdate({ height })} />
          <NumberField label={text.field.rotation} value={element.rotation || 0} min={-180} max={180} onChange={(rotation) => onUpdate({ rotation })} />
          <NumberField label={text.field.opacity} value={element.opacity ?? 100} min={0} max={100} onChange={(opacity) => onUpdate({ opacity })} />
        </div>
      </Group>

      {hasTextControls && (
        <Group title={text.group.text} icon={<Type className="h-3.5 w-3.5" />} tone="text">
          <div className="grid grid-cols-2 gap-2">
            <SelectField
              label={text.field.font}
              value={element.fontFamily || FONT_OPTIONS[0].value}
              options={FONT_OPTIONS}
              onChange={(fontFamily) => onUpdate({ fontFamily })}
            />
            <NumberField
              label={text.field.fontSize}
              value={element.fontSize ?? (element.kind === 'button' ? 14 : 28)}
              min={8}
              max={120}
              onChange={(fontSize) => onUpdate({ fontSize })}
            />
            <NumberField
              label={text.field.letterSpacing}
              value={element.letterSpacing ?? 0}
              min={-8}
              max={48}
              step={0.5}
              onChange={(letterSpacing) => onUpdate({ letterSpacing })}
            />
            <NumberField
              label={text.field.lineHeight}
              value={element.lineHeight ?? 1.25}
              min={0.6}
              max={3}
              step={0.05}
              onChange={(lineHeight) => onUpdate({ lineHeight })}
            />
          </div>
          <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
            <button
              type="button"
              onClick={() => setPopover(popover?.group === 'text' ? null : { group: 'text', type: 'solid' })}
              className="h-9 rounded-lg bg-white text-xs font-bold"
            >
              {text.field.color}
            </button>
            <AlignButtons
              value={element.textAlign || (element.kind === 'button' ? 'center' : 'left')}
              onChange={(textAlign) => onUpdate({ textAlign })}
            />
          </div>
          {popover?.group === 'text' && (
            <FloatingPopover>
              <SolidColorPopover
                tone="fill"
                text={text.popover}
                color={element.textColor || '#ffffff'}
                alpha={element.textColorAlpha ?? 100}
                onColorChange={(textColor) => onUpdate({ textColor })}
                onAlphaChange={(textColorAlpha) => onUpdate({ textColorAlpha })}
              />
            </FloatingPopover>
          )}
        </Group>
      )}

      {hasFillControls && (
        <Group title={text.group.fill} icon={<Palette className="h-3.5 w-3.5" />} tone="fill">
          <FillTabs
            value={backgroundType}
            text={text}
            onChange={(type) => {
              onUpdate({ backgroundType: type });
              setPopover({ group: 'fill', type });
            }}
          />
          {popover?.group === 'fill' && backgroundType === 'solid' && (
            <FloatingPopover>
              <SolidColorPopover
                tone="fill"
                text={text.popover}
                color={element.backgroundColor || '#0ea5e9'}
                alpha={100}
                onColorChange={(backgroundColor) => onUpdate({ backgroundColor, backgroundType: 'solid' })}
                onAlphaChange={() => undefined}
              />
            </FloatingPopover>
          )}
          {popover?.group === 'fill' && backgroundType === 'gradient' && (
            <FloatingPopover>
              <GradientPopover
                tone="fill"
                text={text.popover}
                angle={element.backgroundGradientAngle ?? 135}
                stops={gradientStops}
                onAngleChange={(backgroundGradientAngle) =>
                  onUpdate({ backgroundGradientAngle, backgroundType: 'gradient' })
                }
                onStopsChange={(stops) => {
                  const sorted = [...stops].sort((a, b) => a.position - b.position);
                  const start = sorted[0];
                  const end = sorted[sorted.length - 1];
                  onUpdate({
                    backgroundType: 'gradient',
                    backgroundGradientStops: sorted,
                    backgroundGradientStart: start?.color || '#0ea5e9',
                    backgroundGradientEnd: end?.color || '#0f172a',
                  });
                }}
              />
            </FloatingPopover>
          )}
          {popover?.group === 'fill' && backgroundType === 'image' && (
            <FloatingPopover>
              <ImageFillPopover
                tone="fill"
                text={text.popover}
                value={{
                  imageUrl: element.backgroundImageUrl || '',
                  imageFit: 'crop',
                  imageAngle: 0,
                  imageAlpha: 100,
                }}
                onChange={(updates) => {
                  if (updates.imageUrl !== undefined) {
                    onUpdate({ backgroundImageUrl: updates.imageUrl, backgroundType: 'image' });
                  }
                }}
              />
            </FloatingPopover>
          )}
        </Group>
      )}

      {element.kind === 'image' && (
        <Group title={text.group.fill} icon={<ImageIcon className="h-3.5 w-3.5" />} tone="fill">
          <button
            type="button"
            onClick={() => setPopover(popover?.group === 'image' ? null : { group: 'image', type: 'image' })}
            className="h-9 w-full rounded-lg bg-white text-xs font-bold"
          >
            {element.imageUrl ? text.popover.replace : text.popover.upload}
          </button>
          {popover?.group === 'image' && (
            <FloatingPopover>
              <ImageFillPopover
                tone="fill"
                text={text.popover}
                value={{
                  imageUrl: element.imageUrl || '',
                  imageFit: 'crop',
                  imageAngle: element.rotation || 0,
                  imageAlpha: element.opacity ?? 100,
                }}
                onChange={(updates) =>
                  onUpdate({
                    ...(updates.imageUrl !== undefined ? { imageUrl: updates.imageUrl } : {}),
                    ...(updates.imageAngle !== undefined ? { rotation: updates.imageAngle } : {}),
                    ...(updates.imageAlpha !== undefined ? { opacity: updates.imageAlpha } : {}),
                  })
                }
              />
            </FloatingPopover>
          )}
        </Group>
      )}

      <Group title={text.group.stroke} icon={<Baseline className="h-3.5 w-3.5" />} tone="stroke">
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label={text.field.strokeWidth}
            value={element.kind === 'image' ? (element.borderWidth ?? 0) : (element.borderWidth ?? 1)}
            min={0}
            max={24}
            step={0.5}
            onChange={(borderWidth) => onUpdate({ borderWidth })}
          />
          <button
            type="button"
            onClick={() => setPopover(popover?.group === 'stroke' ? null : { group: 'stroke', type: 'solid' })}
            className="h-9 rounded-lg bg-white text-xs font-bold"
          >
            {text.field.color}
          </button>
        </div>
        {popover?.group === 'stroke' && (
          <FloatingPopover>
            <SolidColorPopover
              tone="stroke"
              text={text.popover}
              color={element.borderColor || '#ffffff'}
              alpha={100}
              onColorChange={(borderColor) => onUpdate({ borderColor })}
              onAlphaChange={() => undefined}
            />
          </FloatingPopover>
        )}
      </Group>

      <Group title={text.field.blendMode} icon={<Blend className="h-3.5 w-3.5" />} tone="extra">
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label={text.field.radius}
            value={element.borderRadius ?? 12}
            min={0}
            max={120}
            onChange={(borderRadius) => onUpdate({ borderRadius })}
          />
          <SelectField
            label={text.field.blendMode}
            value={element.blendMode || 'normal'}
            options={BLEND_OPTIONS.map((value) => ({ label: value, value }))}
            onChange={(blendMode) => onUpdate({ blendMode })}
          />
        </div>
      </Group>
    </div>
  );
}

function Group({
  title,
  icon,
  tone,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  tone: 'position' | 'text' | 'fill' | 'stroke' | 'extra';
  children: React.ReactNode;
}) {
  const toneClass = {
    position: 'bg-emerald-50',
    text: 'bg-green-50',
    fill: 'bg-sky-50',
    stroke: 'bg-indigo-50',
    extra: 'bg-slate-50',
  }[tone];
  return (
    <section className={`relative rounded-xl p-3 ${toneClass}`}>
      <div className="mb-2 flex items-center gap-2 text-xs font-black">
        {icon}
        {title}
      </div>
      {children}
    </section>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid h-9 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg bg-white px-2">
      <span className="text-xs font-bold text-slate-600">{label}</span>
      <DragSizeControl
        label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        unit=""
        onChange={onChange}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid h-9 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg bg-white px-2">
      <span className="text-xs font-bold text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 bg-transparent text-right text-xs outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function AlignButtons({
  value,
  onChange,
}: {
  value: TextAlign;
  onChange: (value: TextAlign) => void;
}) {
  return (
    <div className="grid grid-cols-3 overflow-hidden rounded-lg bg-white">
      {[
        ['left', <AlignLeft className="h-4 w-4" />],
        ['center', <AlignCenter className="h-4 w-4" />],
        ['right', <AlignRight className="h-4 w-4" />],
      ].map(([align, icon]) => (
        <button
          key={align as string}
          type="button"
          onClick={() => onChange(align as TextAlign)}
          className={`grid h-9 w-9 place-items-center ${
            value === align ? 'bg-indigo-600 text-white' : 'text-slate-700'
          }`}
        >
          {icon as React.ReactNode}
        </button>
      ))}
    </div>
  );
}

function FillTabs({
  value,
  text,
  onChange,
}: {
  value: RenderFillType;
  text: ReturnType<typeof renderObjectText>;
  onChange: (value: RenderFillType) => void;
}) {
  return (
    <div className="grid grid-cols-3 overflow-hidden rounded-lg bg-white">
      {(['solid', 'gradient', 'image'] as RenderFillType[]).map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onChange(type)}
          className={`flex h-9 items-center justify-center gap-1 text-xs font-bold ${
            value === type ? 'bg-indigo-600 text-white' : 'text-slate-700'
          }`}
        >
          <Palette className="h-3.5 w-3.5" />
          {type === 'solid'
            ? text.option.solid
            : type === 'gradient'
              ? text.option.gradient
              : text.option.image}
        </button>
      ))}
    </div>
  );
}

function FloatingPopover({ children }: { children: React.ReactNode }) {
  return <div className="absolute left-3 right-3 top-[calc(100%-4px)] z-[90]">{children}</div>;
}

import {
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Baseline,
  Blend,
  Box,
  CaseSensitive,
  ChevronDown,
  Eye,
  EyeOff,
  Image as ImageIcon,
  MoveHorizontal,
  MoveVertical,
  Palette,
  Radius,
  RotateCw,
  Ruler,
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

type Popover = null | {
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
  showDescriptions,
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
      <Group
        title={text.group.position}
        icon={<Box className="h-3.5 w-3.5" />}
        tone="position"
        secondary={
          <VisibilityButton
            visible={element.visible !== false}
            label={text.field.visible}
            onClick={() => onUpdate({ visible: element.visible === false })}
          />
        }
      >
        <ControlRow>
          <NumberField
            icon={<MoveHorizontal className="h-4 w-4" />}
            label={text.field.x}
            description={showDescriptions ? text.field.x : undefined}
            value={element.x}
            min={-200}
            max={200}
            onChange={(x) => onUpdate({ x })}
          />
          <NumberField
            icon={<MoveVertical className="h-4 w-4" />}
            label={text.field.y}
            description={showDescriptions ? text.field.y : undefined}
            value={element.y}
            min={-200}
            max={200}
            onChange={(y) => onUpdate({ y })}
          />
        </ControlRow>
        <ControlRow className="mt-2">
          <NumberField
            icon={<Ruler className="h-4 w-4" />}
            label={text.field.width}
            description={showDescriptions ? text.field.width : undefined}
            value={element.width}
            min={1}
            max={200}
            onChange={(width) => onUpdate({ width })}
          />
          <NumberField
            icon={<Box className="h-4 w-4" />}
            label={text.field.height}
            description={showDescriptions ? text.field.height : undefined}
            value={element.height}
            min={1}
            max={200}
            onChange={(height) => onUpdate({ height })}
          />
        </ControlRow>
        <ControlRow className="mt-2">
          <NumberField
            icon={<RotateCw className="h-4 w-4" />}
            label={text.field.rotation}
            description={showDescriptions ? text.field.rotation : undefined}
            value={element.rotation || 0}
            min={-180}
            max={180}
            onChange={(rotation) => onUpdate({ rotation })}
          />
          <NumberField
            icon={<Blend className="h-4 w-4" />}
            label={text.field.opacity}
            description={showDescriptions ? text.field.opacity : undefined}
            value={element.opacity ?? 100}
            min={0}
            max={100}
            onChange={(opacity) => onUpdate({ opacity })}
          />
        </ControlRow>
        <PositionAlignButtons
          className="mt-2"
          onAlign={(axis, value) => {
            if (axis === 'x') {
              onUpdate({
                x:
                  value === 'start'
                    ? 0
                    : value === 'center'
                      ? (100 - element.width) / 2
                      : 100 - element.width,
              });
            } else {
              onUpdate({
                y:
                  value === 'start'
                    ? 0
                    : value === 'center'
                      ? (100 - element.height) / 2
                      : 100 - element.height,
              });
            }
          }}
        />
      </Group>

      {hasTextControls && (
        <Group
          title={text.group.text}
          icon={<Type className="h-3.5 w-3.5" />}
          tone="text"
          secondary={
            <HeaderSelect
              icon={<Type className="h-4 w-4" />}
              label={text.field.font}
              value={element.fontFamily || FONT_OPTIONS[0].value}
              options={FONT_OPTIONS}
              onChange={(fontFamily) => onUpdate({ fontFamily })}
            />
          }
        >
          <ControlRow>
            <NumberField
              icon={<CaseSensitive className="h-4 w-4" />}
              label={text.field.fontSize}
              description={showDescriptions ? text.field.fontSize : undefined}
              value={element.fontSize ?? (element.kind === 'button' ? 14 : 28)}
              min={8}
              max={120}
              onChange={(fontSize) => onUpdate({ fontSize })}
            />
            <NumberField
              icon={<MoveHorizontal className="h-4 w-4" />}
              label={text.field.letterSpacing}
              description={showDescriptions ? text.field.letterSpacing : undefined}
              value={element.letterSpacing ?? 0}
              min={-8}
              max={48}
              step={0.5}
              onChange={(letterSpacing) => onUpdate({ letterSpacing })}
            />
          </ControlRow>
          <ControlRow className="mt-2">
            <NumberField
              icon={<MoveVertical className="h-4 w-4" />}
              label={text.field.lineHeight}
              description={showDescriptions ? text.field.lineHeight : undefined}
              value={element.lineHeight ?? 1.25}
              min={0.6}
              max={3}
              step={0.05}
              onChange={(lineHeight) => onUpdate({ lineHeight })}
            />
            <button
              type="button"
              onClick={() =>
                setPopover(popover?.group === 'text' ? null : { group: 'text', type: 'solid' })
              }
              className="flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl bg-white px-3 text-xs font-bold"
              title={text.field.color}
              aria-label={text.field.color}
            >
              <Palette className="h-4 w-4" />
              {showDescriptions && <span className="min-w-0 truncate">{text.field.color}</span>}
            </button>
          </ControlRow>
          <ControlRow className="mt-2">
            <AlignButtons
              value={element.textAlign || (element.kind === 'button' ? 'center' : 'left')}
              onChange={(textAlign) => onUpdate({ textAlign })}
            />
            <div aria-hidden="true" />
          </ControlRow>
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
        <Group
          title={text.group.fill}
          icon={<Palette className="h-3.5 w-3.5" />}
          tone="fill"
          secondary={
            <FillTabs
              value={backgroundType}
              text={text}
              onChange={(type) => {
                onUpdate({ backgroundType: type });
                setPopover({ group: 'fill', type });
              }}
            />
          }
        >
          {popover?.group === 'fill' && backgroundType === 'solid' && (
            <FloatingPopover>
              <SolidColorPopover
                tone="fill"
                text={text.popover}
                color={element.backgroundColor || '#0ea5e9'}
                alpha={100}
                onColorChange={(backgroundColor) =>
                  onUpdate({ backgroundColor, backgroundType: 'solid' })
                }
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
        <Group
          title={text.group.fill}
          icon={<ImageIcon className="h-3.5 w-3.5" />}
          tone="fill"
          secondary={
            <HeaderAction
              icon={<ImageIcon className="h-4 w-4" />}
              label={element.imageUrl ? text.popover.replace : text.popover.upload}
              onClick={() =>
                setPopover(popover?.group === 'image' ? null : { group: 'image', type: 'image' })
              }
            />
          }
        >
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

      <Group
        title={text.group.stroke}
        icon={<Baseline className="h-3.5 w-3.5" />}
        tone="stroke"
        secondary={
          <HeaderAction
            icon={<Palette className="h-4 w-4" />}
            label={text.field.color}
            onClick={() =>
              setPopover(popover?.group === 'stroke' ? null : { group: 'stroke', type: 'solid' })
            }
          />
        }
      >
        <ControlRow>
          <NumberField
            icon={<Baseline className="h-4 w-4" />}
            label={text.field.strokeWidth}
            description={showDescriptions ? text.field.strokeWidth : undefined}
            value={
              element.kind === 'image' ? (element.borderWidth ?? 0) : (element.borderWidth ?? 1)
            }
            min={0}
            max={24}
            step={0.5}
            onChange={(borderWidth) => onUpdate({ borderWidth })}
          />
          <div aria-hidden="true" />
        </ControlRow>
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

      <Group
        title={text.field.blendMode}
        icon={<Blend className="h-3.5 w-3.5" />}
        tone="extra"
        secondary={
          <HeaderSelect
            icon={<Blend className="h-4 w-4" />}
            label={text.field.blendMode}
            value={element.blendMode || 'normal'}
            options={BLEND_OPTIONS.map((value) => ({ label: value, value }))}
            onChange={(blendMode) => onUpdate({ blendMode })}
          />
        }
      >
        <ControlRow>
          <NumberField
            icon={<Radius className="h-4 w-4" />}
            label={text.field.radius}
            description={showDescriptions ? text.field.radius : undefined}
            value={element.borderRadius ?? 12}
            min={0}
            max={120}
            onChange={(borderRadius) => onUpdate({ borderRadius })}
          />
          <div aria-hidden="true" />
        </ControlRow>
      </Group>
    </div>
  );
}

function ControlRow({
  className = '',
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-3 ${className}`}>
      {children}
      <div className="h-10 w-11" aria-hidden="true" />
    </div>
  );
}

function Group({
  title,
  icon,
  tone,
  secondary,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  tone: 'position' | 'text' | 'fill' | 'stroke' | 'extra';
  secondary: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const toneClass = {
    position: 'bg-emerald-50/80',
    text: 'bg-emerald-50/80',
    fill: 'bg-sky-50/80',
    stroke: 'bg-indigo-50/80',
    extra: 'bg-fuchsia-50/80',
  }[tone];
  const titleClass = {
    position: 'bg-emerald-100 text-slate-900',
    text: 'bg-emerald-50 text-slate-900',
    fill: 'bg-sky-100 text-slate-900',
    stroke: 'bg-indigo-100 text-slate-900',
    extra: 'bg-fuchsia-100 text-slate-900',
  }[tone];
  const toggleClass = {
    position: 'bg-emerald-100 text-slate-900',
    text: 'bg-emerald-50 text-slate-900',
    fill: 'bg-sky-100 text-slate-900',
    stroke: 'bg-indigo-100 text-slate-900',
    extra: 'bg-fuchsia-100 text-slate-900',
  }[tone];
  return (
    <section className={`relative rounded-[22px] p-3 ${toneClass}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-3">
        <div
          className={`flex h-10 min-w-0 items-center gap-2 rounded-xl px-3 text-sm font-bold ${titleClass}`}
          title={title}
          aria-label={title}
        >
          <span className="shrink-0">{icon}</span>
          <span className="min-w-0 truncate">{title}</span>
        </div>
        <div className="min-w-0">{secondary}</div>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={`grid h-10 w-11 place-items-center rounded-xl ${toggleClass}`}
          title={open ? 'Collapse' : 'Expand'}
          aria-label={open ? 'Collapse' : 'Expand'}
          aria-expanded={open}
        >
          <ChevronDown className={`h-5 w-5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {open && <div className="mt-3">{children}</div>}
    </section>
  );
}

function HeaderAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-xl bg-white px-3 text-sm font-normal text-slate-900"
      title={label}
      aria-label={label}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

function HeaderSelect({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  const selectedLabel =
    options.find((option) => option.value === value)?.label || options[0]?.label || '';
  return (
    <label
      className="relative grid h-10 min-w-0 grid-cols-[28px_minmax(0,1fr)_18px] items-center rounded-xl bg-white px-2 text-sm font-normal text-slate-900"
      title={label}
    >
      <span className="flex justify-center text-slate-900" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0 truncate px-1">{selectedLabel}</span>
      <ChevronDown className="h-4 w-4 text-slate-900" aria-hidden="true" />
      <select
        value={value}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
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

function VisibilityButton({
  visible,
  label,
  onClick,
}: {
  visible: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold ${
        visible ? 'bg-[#4f46e5] text-white' : 'bg-white text-slate-500'
      }`}
      title={label}
      aria-label={label}
      aria-pressed={visible}
    >
      {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      <span className="min-w-0 truncate">{label}</span>
    </button>
  );
}

function NumberField({
  icon,
  label,
  description,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      {description && (
        <div className="px-1 text-[10px] leading-4 text-slate-500">{description}</div>
      )}
      <div
        className="grid h-10 grid-cols-[34px_minmax(0,1fr)] items-center overflow-hidden rounded-xl bg-white"
        title={label}
      >
        <span className="flex h-full items-center justify-center text-slate-600" aria-hidden="true">
          {icon}
        </span>
        <DragSizeControl
          label={label}
          value={value}
          min={min}
          max={max}
          step={step}
          unit=""
          onChange={onChange}
          className="h-full rounded-l-none rounded-r-xl px-3 py-0"
          editingClassName="ring-inset"
        />
      </div>
    </div>
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
    <div className="grid h-10 grid-cols-3 overflow-hidden rounded-xl bg-white">
      {[
        ['left', <AlignLeft className="h-4 w-4" />],
        ['center', <AlignCenter className="h-4 w-4" />],
        ['right', <AlignRight className="h-4 w-4" />],
      ].map(([align, icon]) => (
        <button
          key={align as string}
          type="button"
          onClick={() => onChange(align as TextAlign)}
          className={`grid h-10 min-w-0 place-items-center ${
            value === align ? 'bg-indigo-600 text-white' : 'text-slate-700'
          }`}
        >
          {icon as React.ReactNode}
        </button>
      ))}
    </div>
  );
}

function PositionAlignButtons({
  className = '',
  onAlign,
}: {
  className?: string;
  onAlign: (axis: 'x' | 'y', value: 'start' | 'center' | 'end') => void;
}) {
  const horizontalItems: Array<{
    key: string;
    value: 'start' | 'center' | 'end';
    icon: React.ReactNode;
  }> = [
    {
      key: 'left',
      value: 'start',
      icon: <AlignHorizontalJustifyStart className="h-5 w-5" />,
    },
    {
      key: 'center-x',
      value: 'center',
      icon: <AlignHorizontalJustifyCenter className="h-5 w-5" />,
    },
    {
      key: 'right',
      value: 'end',
      icon: <AlignHorizontalJustifyEnd className="h-5 w-5" />,
    },
  ];

  const verticalItems: Array<{
    key: string;
    value: 'start' | 'center' | 'end';
    icon: React.ReactNode;
  }> = [
    {
      key: 'top',
      value: 'start',
      icon: <AlignVerticalJustifyStart className="h-5 w-5" />,
    },
    {
      key: 'center-y',
      value: 'center',
      icon: <AlignVerticalJustifyCenter className="h-5 w-5" />,
    },
    {
      key: 'bottom',
      value: 'end',
      icon: <AlignVerticalJustifyEnd className="h-5 w-5" />,
    },
  ];

  return (
    <div className={`${className}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-3">
        <div className="grid h-10 grid-cols-3 overflow-hidden rounded-xl bg-white">
          {horizontalItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onAlign('x', item.value)}
              className="grid h-10 min-w-0 place-items-center text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
            >
              {item.icon}
            </button>
          ))}
        </div>
        <div className="grid h-10 grid-cols-3 overflow-hidden rounded-xl bg-white">
          {verticalItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onAlign('y', item.value)}
              className="grid h-10 min-w-0 place-items-center text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
            >
              {item.icon}
            </button>
          ))}
        </div>
        <div aria-hidden="true" />
      </div>
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
  const options: Array<{ type: RenderFillType; label: string; icon: React.ReactNode }> = [
    { type: 'solid', label: text.option.solid, icon: <Palette className="h-3.5 w-3.5" /> },
    { type: 'gradient', label: text.option.gradient, icon: <GradientIcon /> },
    { type: 'image', label: text.option.image, icon: <ImageIcon className="h-3.5 w-3.5" /> },
  ];
  return (
    <div className="grid h-10 grid-cols-3 overflow-hidden rounded-xl bg-white">
      {options.map(({ type, label, icon }) => (
        <button
          key={type}
          type="button"
          onClick={() => onChange(type)}
          className={`flex h-10 min-w-0 items-center justify-center px-2 text-xs font-bold ${
            value === type ? 'bg-indigo-600 text-white' : 'text-slate-700'
          }`}
          title={label}
          aria-label={label}
          aria-pressed={value === type}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

function GradientIcon() {
  return (
    <span
      className="block h-3.5 w-3.5 rounded-full border border-current/30"
      style={{ background: 'linear-gradient(135deg, currentColor 0%, transparent 100%)' }}
      aria-hidden="true"
    />
  );
}

function FloatingPopover({ children }: { children: React.ReactNode }) {
  return <div className="absolute left-3 right-3 top-[calc(100%-4px)] z-[90]">{children}</div>;
}

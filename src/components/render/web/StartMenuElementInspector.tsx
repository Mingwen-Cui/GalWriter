import {
  Baseline,
  Blend,
  Box,
  CaseSensitive,
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
import {
  GradientPopover,
  ImageFillPopover,
  SolidColorPopover,
} from '../video/objectInspector/ColorPopovers';
import { renderObjectText } from '../video/objectInspector/i18n';
import type { RenderFillType, WebMenuElement } from '../video/shared/types';
import { normalizeGradientStops } from './webGradientStops';
import {
  AlignButtons,
  ControlRow,
  FillTabs,
  FloatingPopover,
  HeaderAction,
  HeaderSelect,
  InspectorGroup as Group,
  NumberField,
  PositionAlignButtons,
  VisibilityButton,
} from './webStyleInspectorControls';

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
          onTitleClick={() => onUpdate({ textVisible: element.textVisible === false })}
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
              icon={<Baseline className="h-4 w-4" />}
              label={text.field.fontWeight}
              description={showDescriptions ? text.field.fontWeight : undefined}
              value={element.fontWeight ?? (element.kind === 'button' ? 700 : 500)}
              min={100}
              max={900}
              step={100}
              onChange={(fontWeight) => onUpdate({ fontWeight })}
            />
          </ControlRow>
          <ControlRow className="mt-2">
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
          </ControlRow>
          <ControlRow className="mt-2">
            <AlignButtons
              value={element.textAlign || (element.kind === 'button' ? 'center' : 'left')}
              onChange={(textAlign) => onUpdate({ textAlign })}
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
              labels={text.option}
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

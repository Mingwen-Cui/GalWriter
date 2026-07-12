import {
  Baseline,
  Blend,
  Box,
  CaseSensitive,
  Check,
  ChevronDown,
  Circle,
  Diamond,
  Image as ImageIcon,
  Layers,
  Link2,
  MoveHorizontal,
  MoveVertical,
  MousePointerClick,
  Palette,
  Plus,
  Radius,
  RotateCw,
  Ruler,
  Trash2,
  Type,
  Volume2,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';

import type { Language } from '../../../lib/i18n';
import { DragSizeControl } from '../video/controls/RenderControls';
import { ImageFillPopover, SolidColorPopover } from '../video/objectInspector/ColorPopovers';
import { renderObjectText } from '../video/objectInspector/i18n';
import type { RenderColorStop, RenderFillType, WebMenuElement } from '../video/shared/types';
import { parseColorValue, toHex8 } from '../video/shared/colorValue';
import { normalizeGradientStops } from './webGradientStops';
import {
  AlignButtons,
  ControlRow,
  FillTabs,
  FloatingPopover,
  GradientIcon,
  HeaderAction,
  HeaderSelect,
  InspectorGroup as Group,
  NumberField,
  PositionAlignButtons,
} from './webStyleInspectorControls';

type InspectorProps = {
  element: WebMenuElement;
  language: Language;
  surface?: 'start' | 'archive' | 'settings' | 'game';
  selectedElementIds?: string[];
  showDescriptions: boolean;
  onUpdate: (patch: Partial<WebMenuElement>) => void;
  onAlignSelected?: (axis: 'x' | 'y', value: 'start' | 'center' | 'end') => void;
  onImageCropEditingChange?: (elementId: string | null) => void;
};

type Popover = null | {
  group: 'text' | 'fill' | 'stroke' | 'shadow' | 'image';
  type: RenderFillType;
  shadowIndex?: number;
};

type InspectorHistoryKey = 'fill' | 'stroke' | 'shadow';
type InspectorSnapshot = Partial<WebMenuElement>;

const inspectorToggleHistory = new Map<string, Record<InspectorHistoryKey, InspectorSnapshot[]>>();

const pushInspectorSnapshot = (
  elementId: string,
  key: InspectorHistoryKey,
  snapshot: InspectorSnapshot,
) => {
  const history = inspectorToggleHistory.get(elementId) || { fill: [], stroke: [], shadow: [] };
  history[key] = [snapshot, ...history[key]].slice(0, 10);
  inspectorToggleHistory.set(elementId, history);
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

type ButtonFunction = NonNullable<WebMenuElement['role']>;

const BUTTON_FUNCTIONS_BY_SURFACE: Record<
  NonNullable<InspectorProps['surface']>,
  ButtonFunction[]
> = {
  start: ['custom', 'save', 'new', 'settings', 'link', 'volume'],
  archive: ['custom', 'slot', 'new', 'back', 'settings', 'link', 'volume'],
  settings: ['custom', 'back', 'auto', 'speed', 'controls', 'volume', 'link'],
  game: ['custom', 'audio', 'fullscreen', 'return', 'mainMenu', 'controlsToggle', 'volume', 'link'],
};

const buttonFunctionCopy = (language: Language): Record<ButtonFunction, string> => {
  if (language === 'ja') {
    return {
      custom: '機能なし', save: 'セーブ画面', new: '新規ゲーム', settings: '設定画面',
      back: '戻る', slot: 'セーブを読む', auto: '自動再生', speed: '文字速度',
      controls: '操作表示', audio: '音声リスト', fullscreen: '全画面', return: '一つ戻る',
      mainMenu: 'メイン画面', controlsToggle: '操作を隠す', link: 'リンクを開く', volume: '音量を設定',
      title: 'タイトル', subtitle: 'サブタイトル',
    };
  }
  if (language === 'en') {
    return {
      custom: 'No action', save: 'Open saves', new: 'New game', settings: 'Open settings',
      back: 'Back', slot: 'Load save', auto: 'Toggle auto play', speed: 'Text speed',
      controls: 'Show controls', audio: 'Audio playlist', fullscreen: 'Fullscreen', return: 'Go back',
      mainMenu: 'Main menu', controlsToggle: 'Toggle controls', link: 'Open link', volume: 'Set volume',
      title: 'Title', subtitle: 'Subtitle',
    };
  }
  return {
    custom: '无功能', save: '打开存档页', new: '新游戏', settings: '打开设置页',
    back: '返回', slot: '读取存档', auto: '自动播放开关', speed: '打字速度',
    controls: '显示控制栏', audio: '音频播放列表', fullscreen: '全屏', return: '返回上一页',
    mainMenu: '返回主界面', controlsToggle: '显示/隐藏控制栏', link: '打开超链接', volume: '设置音量',
    title: '标题', subtitle: '副标题',
  };
};

const buttonFunctionDefaultText = (role: ButtonFunction, language: Language) => {
  const copy = buttonFunctionCopy(language);
  return role === 'custom' ? '' : copy[role];
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const alphaColor = (color: string | undefined, alpha: number | undefined, fallback = '#000000') => {
  const safeColor = color || fallback;
  const safeAlpha = Math.max(0, Math.min(100, alpha ?? 100)) / 100;
  const match = safeColor.match(/^#([0-9a-f]{6})$/i);
  if (!match) return safeColor;
  const hex = match[1];
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
};

const hexColor = (color: string | undefined, fallback = '#000000') => {
  const source = String(color || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(source)) return source.toLowerCase();
  const rgb = source.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!rgb) return fallback;
  const channels = rgb.slice(1, 4).map((channel) => Math.max(0, Math.min(255, Number(channel))));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
};

export function StartMenuElementInspector({
  element,
  language,
  surface = 'start',
  selectedElementIds = [],
  showDescriptions,
  onUpdate,
  onAlignSelected,
  onImageCropEditingChange,
}: InspectorProps) {
  const text = renderObjectText(language);
  const [popover, setPopover] = useState<Popover>(null);
  const [radiusPopoverOpen, setRadiusPopoverOpen] = useState(false);
  const [fillBlendMenuOpen, setFillBlendMenuOpen] = useState(false);
  const [textBlendMenuOpen, setTextBlendMenuOpen] = useState(false);

  useEffect(() => {
    if (!popover) return;
    const dismissPopover = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-web-style-popover]')) return;
      setPopover(null);
    };
    document.addEventListener('pointerdown', dismissPopover);
    return () => document.removeEventListener('pointerdown', dismissPopover);
  }, [popover]);
  const backgroundType = element.backgroundType || 'solid';
  const imageCropEditing =
    popover?.group === 'fill' &&
    backgroundType === 'image' &&
    (element.backgroundImageFit || 'crop') === 'crop' &&
    Boolean(element.backgroundImageUrl);
  useEffect(() => {
    onImageCropEditingChange?.(imageCropEditing ? element.id : null);
    return () => onImageCropEditingChange?.(null);
  }, [element.id, imageCropEditing, onImageCropEditingChange]);
  const textColorType = element.textColorType || 'solid';
  const textGradientStops = normalizeGradientStops(
    element.textGradientStops,
    element.textGradientStart || element.textColor || '#ffffff',
    element.textGradientEnd || '#0ea5e9',
  );
  const gradientStops = normalizeGradientStops(
    element.backgroundGradientStops,
    element.backgroundGradientStart || '#0ea5e9',
    element.backgroundGradientEnd || '#0f172a',
  );
  const hasTextControls = element.kind !== 'image';
  const hasFillControls = element.kind !== 'text';
  const textStrokeTarget = element.textStrokeTarget || 'text';
  const strokeIsText = element.kind === 'text' && textStrokeTarget === 'text';
  const strokeColor = strokeIsText
    ? element.textStrokeColor || '#000000'
    : element.borderColor || '#ffffff';
  const strokeWidth = strokeIsText ? (element.textStrokeWidth ?? 0) : (element.borderWidth ?? 1);
  const strokeType = element.borderType || 'solid';
  const borderGradientStops = normalizeGradientStops(
    element.borderGradientStops,
    element.borderGradientStart || strokeColor,
    element.borderGradientEnd || '#4f46e5',
  );
  const strokePosition = element.borderPosition || 'center';
  const shadowType = element.shadowType || 'outer';
  const shadows = element.shadows?.length
    ? element.shadows.slice(0, 6)
    : [{
        id: 'shadow-1',
        type: shadowType,
        color: element.shadowColor || '#000000',
        opacity: element.shadowOpacity ?? 0,
        blur: element.shadowBlur ?? 18,
        offsetX: element.shadowOffsetX ?? 0,
        offsetY: element.shadowOffsetY ?? (element.kind === 'text' ? 2 : 8),
      }];
  const updateShadow = (index: number, patch: Partial<(typeof shadows)[number]>) => {
    const next = shadows.map((shadow, shadowIndex) => shadowIndex === index ? { ...shadow, ...patch } : shadow);
    const first = next[0];
    onUpdate({
      shadows: next,
      ...(index === 0 && first ? {
        shadowType: first.type,
        shadowColor: first.color,
        shadowOpacity: first.opacity,
        shadowBlur: first.blur,
        shadowOffsetX: first.offsetX,
        shadowOffsetY: first.offsetY,
      } : {}),
    });
  };
  const addShadow = () => {
    if (shadows.length >= 6) return;
    onUpdate({
      shadows: [...shadows, {
        id: `shadow-${Date.now().toString(36)}`,
        type: 'outer',
        color: '#000000',
        opacity: 35,
        blur: 18,
        offsetX: 0,
        offsetY: element.kind === 'text' ? 2 : 8,
      }],
      shadowEnabled: true,
    });
  };
  const removeShadow = (index: number) => {
    if (index === 0) return;
    onUpdate({ shadows: shadows.filter((_, shadowIndex) => shadowIndex !== index) });
    setPopover(null);
  };
  const functionCopy = buttonFunctionCopy(language);
  const buttonFunctionOptions = BUTTON_FUNCTIONS_BY_SURFACE[surface].map((role) => ({
    label: functionCopy[role],
    value: role,
  }));
  const buttonFunction = (element.role || 'custom') as ButtonFunction;
  const inspectorCopy =
    language === 'zh'
      ? {
          expand: '展开',
          collapse: '收起',
          radius: '圆角',
          zIndex: 'Z轴',
          allCorners: '总圆角',
          topLeft: '左上',
          topRight: '右上',
          bottomRight: '右下',
          bottomLeft: '左下',
          solid: '纯色',
          gradient: '渐变',
          inside: '内侧',
          center: '中央',
          outside: '外侧',
          outerShadow: '外阴影',
          innerShadow: '内阴影',
          innerBlur: '内部模糊',
        }
      : language === 'ja'
        ? {
            expand: '展開',
            collapse: '折りたたむ',
            radius: '角丸',
            zIndex: 'Z軸',
            allCorners: '全体',
            topLeft: '左上',
            topRight: '右上',
            bottomRight: '右下',
            bottomLeft: '左下',
            solid: '単色',
            gradient: 'グラデ',
            inside: '内側',
            center: '中央',
            outside: '外側',
            outerShadow: '外側',
            innerShadow: '内側',
            innerBlur: '内ぼかし',
          }
        : {
            expand: 'Expand',
            collapse: 'Collapse',
            radius: 'Radius',
            zIndex: 'Z axis',
            allCorners: 'All',
            topLeft: 'Top left',
            topRight: 'Top right',
            bottomRight: 'Bottom right',
            bottomLeft: 'Bottom left',
            solid: 'Solid',
            gradient: 'Gradient',
            inside: 'Inside',
            center: 'Center',
            outside: 'Outside',
            outerShadow: 'Outer',
            innerShadow: 'Inner',
            innerBlur: 'Inner blur',
          };
  const fillHasValue =
    element.kind !== 'text' &&
    !(
      (element.backgroundType || 'solid') === 'solid' &&
      (!element.backgroundColor || element.backgroundColor === 'transparent')
    );
  const strokeHasValue = strokeWidth > 0;
  const shadowHasValue = shadows.some((shadow) => shadow.opacity > 0);
  const fillEnabled = element.fillEnabled ?? fillHasValue;
  const strokeEnabled = element.strokeEnabled ?? strokeHasValue;
  const shadowEnabled = element.shadowEnabled ?? shadowHasValue;
  const toggleFill = () => {
    if (element.kind === 'text') return;
    pushInspectorSnapshot(element.id, 'fill', {
      fillEnabled: element.fillEnabled,
      backgroundType: element.backgroundType,
      backgroundColor: element.backgroundColor,
      backgroundGradientStart: element.backgroundGradientStart,
      backgroundGradientEnd: element.backgroundGradientEnd,
      backgroundGradientAngle: element.backgroundGradientAngle,
      backgroundGradientStops: element.backgroundGradientStops,
      backgroundImageUrl: element.backgroundImageUrl,
    });
    onUpdate({
      fillEnabled: !fillEnabled,
      ...(fillHasValue
        ? {}
        : {
            backgroundType: 'solid',
            backgroundColor: '#0ea5e9',
          }),
    });
    setPopover({ group: 'fill', type: 'solid' });
  };
  const toggleStroke = () => {
    pushInspectorSnapshot(element.id, 'stroke', {
      strokeEnabled: element.strokeEnabled,
      textStrokeWidth: element.textStrokeWidth,
      textStrokeColor: element.textStrokeColor,
      borderWidth: element.borderWidth,
      borderColor: element.borderColor,
      borderType: element.borderType,
      borderGradientStart: element.borderGradientStart,
      borderGradientEnd: element.borderGradientEnd,
      borderGradientAngle: element.borderGradientAngle,
      borderGradientStops: element.borderGradientStops,
      borderPosition: element.borderPosition,
    });
    onUpdate(
      strokeIsText
        ? {
            strokeEnabled: !strokeEnabled,
            ...(strokeHasValue
              ? {}
              : { textStrokeWidth: 1, textStrokeColor: element.textStrokeColor || '#000000' }),
          }
        : {
            strokeEnabled: !strokeEnabled,
            ...(strokeHasValue
              ? {}
              : {
                  borderWidth: 1,
                  borderType: element.borderType || 'solid',
                  borderColor: element.borderColor || '#ffffff',
                }),
          },
    );
    setPopover({ group: 'stroke', type: 'solid' });
  };
  const toggleShadow = () => {
    pushInspectorSnapshot(element.id, 'shadow', {
      shadowEnabled: element.shadowEnabled,
      shadowColor: element.shadowColor,
      shadowType: element.shadowType,
      shadowOpacity: element.shadowOpacity,
      shadowBlur: element.shadowBlur,
      shadowOffsetX: element.shadowOffsetX,
      shadowOffsetY: element.shadowOffsetY,
      shadows: element.shadows,
    });
    const nextShadows = shadowHasValue
      ? shadows
      : shadows.map((shadow, index) => index === 0 ? { ...shadow, opacity: 35 } : shadow);
    onUpdate({
      shadowEnabled: !shadowEnabled,
      shadows: nextShadows,
      ...(shadowHasValue
        ? {}
        : {
            shadowColor: element.shadowColor || '#000000',
            shadowType: element.shadowType || 'outer',
            shadowOpacity: 35,
            shadowBlur: element.shadowBlur ?? 18,
            shadowOffsetX: element.shadowOffsetX ?? 0,
            shadowOffsetY: element.shadowOffsetY ?? (element.kind === 'text' ? 2 : 8),
          }),
    });
    setPopover({ group: 'shadow', type: 'solid', shadowIndex: 0 });
  };

  return (
    <div className="space-y-3 text-[12px] text-slate-900">
      <Group
        title={text.group.position}
        icon={<Box className="h-3.5 w-3.5" />}
        tone="position"
        onTitleClick={() => onUpdate({ visible: element.visible === false })}
        titleActive={element.visible !== false}
        expandLabel={inspectorCopy.expand}
        collapseLabel={inspectorCopy.collapse}
        secondary={
          <NumberField
            icon={<Layers className="h-4 w-4" />}
            label={inspectorCopy.zIndex}
            value={element.zIndex ?? 0}
            min={-100}
            max={100}
            onChange={(zIndex) => onUpdate({ zIndex })}
          />
        }
      >
        <div className="relative grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-3">
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
          <button
            type="button"
            onClick={() => setRadiusPopoverOpen((current) => !current)}
            className="grid h-10 w-11 place-items-center rounded-xl bg-white text-slate-700 transition-colors hover:bg-emerald-100 hover:text-slate-950"
            title={inspectorCopy.radius}
            aria-label={inspectorCopy.radius}
            aria-pressed={radiusPopoverOpen}
          >
            <CornerRadiusIcon corner="all" />
          </button>
          {radiusPopoverOpen && (
            <div className="absolute left-0 right-[56px] top-[calc(100%+8px)] z-[10020]">
              <RadiusPopover copy={inspectorCopy} element={element} onUpdate={onUpdate} />
            </div>
          )}
        </div>
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
            if (selectedElementIds.length > 1 && onAlignSelected) {
              onAlignSelected(axis, value);
              return;
            }
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
          titleActive={element.textVisible !== false}
          expandLabel={inspectorCopy.expand}
          collapseLabel={inspectorCopy.collapse}
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
            <TwoSegmentControl
              value={textColorType}
              options={[
                { value: 'solid', label: inspectorCopy.solid, icon: <Palette className="h-4 w-4" /> },
                { value: 'gradient', label: inspectorCopy.gradient, icon: <GradientIcon /> },
              ]}
              onChange={(type) => {
                onUpdate({ textColorType: type });
                setPopover({ group: 'text', type });
              }}
            />
          </ControlRow>
          <div className="relative mt-2 grid grid-cols-[minmax(0,1fr)_44px] gap-3">
            {textColorType === 'solid' ? (
              <InlineColorControl
                label={text.popover.solidTitle}
                color={element.textColor || '#ffffff'}
                alpha={element.textColorAlpha ?? 100}
                alphaLabel={text.field.opacity}
                hexLabel={text.popover.hex}
                onColorChange={(textColor) => onUpdate({ textColor })}
                onAlphaChange={(textColorAlpha) => onUpdate({ textColorAlpha })}
                onOpen={() => setPopover({ group: 'text', type: 'solid' })}
              />
            ) : (
              <InlineGradientControl
                label={text.popover.gradientTitle}
                stops={textGradientStops}
                onOpen={() => setPopover({ group: 'text', type: 'gradient' })}
                onAlphaChange={(alpha) =>
                  onUpdate({ textGradientStops: textGradientStops.map((stop) => ({ ...stop, alpha })) })
                }
              />
            )}
            <button
              type="button"
              onClick={() => setTextBlendMenuOpen((open) => !open)}
              className="grid h-10 w-11 place-items-center rounded-xl bg-white text-slate-700 transition-colors hover:bg-violet-100"
              title={text.field.blendMode}
              aria-label={text.field.blendMode}
            >
              <Blend className="h-4 w-4" />
            </button>
            {textBlendMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] z-[10030] w-44 overflow-hidden rounded-xl border border-violet-100 bg-white py-1 shadow-xl">
                {BLEND_OPTIONS.map((blendMode) => (
                  <button key={blendMode} type="button" onClick={() => { onUpdate({ textBlendMode: blendMode }); setTextBlendMenuOpen(false); }} className={`flex h-8 w-full items-center justify-between px-3 text-left text-xs ${element.textBlendMode === blendMode || (!element.textBlendMode && blendMode === 'normal') ? 'bg-violet-50 text-violet-700' : 'text-slate-700 hover:bg-slate-50'}`}>
                    <span>{blendMode}</span>
                    {(element.textBlendMode === blendMode || (!element.textBlendMode && blendMode === 'normal')) && <Check className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          {popover?.group === 'text' && popover.type === 'solid' && (
            <FloatingPopover popoverKey="solid">
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
          {popover?.group === 'text' && popover.type === 'gradient' && (
            <PortaledGradientPopover>
              <GradientEditorPopover
                language={language}
                angle={element.textGradientAngle ?? 90}
                stops={textGradientStops}
                onAngleChange={(textGradientAngle) => onUpdate({ textGradientAngle, textColorType: 'gradient' })}
                onStopsChange={(stops) => {
                  const sorted = [...stops].sort((a, b) => a.position - b.position);
                  onUpdate({
                    textColorType: 'gradient',
                    textGradientStops: sorted,
                    textGradientStart: sorted[0]?.color || '#ffffff',
                    textGradientEnd: sorted.at(-1)?.color || '#0ea5e9',
                  });
                }}
              />
            </PortaledGradientPopover>
          )}
        </Group>
      )}

      {element.kind === 'button' && (
        <Group
          title={language === 'zh' ? '功能' : language === 'ja' ? '機能' : 'Function'}
          icon={<MousePointerClick className="h-3.5 w-3.5" />}
          tone="position"
          expandLabel={inspectorCopy.expand}
          collapseLabel={inspectorCopy.collapse}
          secondary={
            <HeaderSelect
              icon={<MousePointerClick className="h-4 w-4" />}
              label={language === 'zh' ? '按钮功能' : language === 'ja' ? 'ボタン機能' : 'Button action'}
              value={buttonFunction}
              options={buttonFunctionOptions}
              onChange={(value) => {
                const role = value as ButtonFunction;
                onUpdate({
                  role,
                  ...(element.text.trim() ? {} : { text: buttonFunctionDefaultText(role, language) }),
                });
              }}
            />
          }
        >
          {buttonFunction === 'link' && (
            <div className="mt-2 space-y-2">
              <label className="block space-y-1 px-1 text-[10px] font-bold text-slate-500">
                <span>{language === 'zh' ? '链接地址' : language === 'ja' ? 'リンク先' : 'Link URL'}</span>
                <span className="grid h-10 grid-cols-[34px_minmax(0,1fr)] items-center overflow-hidden rounded-xl bg-white text-sm font-normal text-slate-900">
                  <Link2 className="mx-auto h-4 w-4 text-slate-600" />
                  <input
                    type="url"
                    value={element.linkUrl || ''}
                    onChange={(event) => onUpdate({ linkUrl: event.target.value })}
                    placeholder="https://"
                    className="h-full min-w-0 bg-transparent pr-3 outline-none placeholder:text-slate-300"
                  />
                </span>
              </label>
              <HeaderSelect
                icon={<Link2 className="h-4 w-4" />}
                label={language === 'zh' ? '打开方式' : language === 'ja' ? '開き方' : 'Open in'}
                value={element.linkTarget || '_blank'}
                options={[
                  { value: '_blank', label: language === 'zh' ? '新标签页' : language === 'ja' ? '新しいタブ' : 'New tab' },
                  { value: '_self', label: language === 'zh' ? '当前页面' : language === 'ja' ? '現在のページ' : 'Current page' },
                ]}
                onChange={(linkTarget) => onUpdate({ linkTarget: linkTarget as '_blank' | '_self' })}
              />
            </div>
          )}
          {buttonFunction === 'volume' && (
            <div className="mt-2">
              <NumberField
                icon={<Volume2 className="h-4 w-4" />}
                label={language === 'zh' ? '菜单音乐音量' : language === 'ja' ? 'メニュー音量' : 'Menu music volume'}
                value={element.actionValue ?? 70}
                min={0}
                max={100}
                onChange={(actionValue) => onUpdate({ actionValue })}
              />
            </div>
          )}
        </Group>
      )}

      {hasFillControls && (
        <Group
          title={text.group.fill}
          icon={<Palette className="h-3.5 w-3.5" />}
          tone="fill"
          onTitleClick={toggleFill}
          titleActive={fillEnabled}
          expandLabel={inspectorCopy.expand}
          collapseLabel={inspectorCopy.collapse}
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
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_44px] gap-3">
            <div className="min-w-0">
              {backgroundType === 'solid' && (
                <InlineColorControl
                  label={text.popover.solidTitle}
                  color={element.backgroundColor || '#0ea5e9'}
                  alpha={100}
                  alphaLabel={text.field.opacity}
                  hexLabel={text.popover.hex}
                  onColorChange={(backgroundColor) =>
                    onUpdate({ backgroundColor, backgroundType: 'solid' })
                  }
                  onAlphaChange={(opacity) => onUpdate({ opacity })}
                  onOpen={() => setPopover({ group: 'fill', type: 'solid' })}
                />
              )}
              {backgroundType === 'gradient' && (
                <InlineGradientControl
                  label={text.popover.gradientTitle}
                  stops={gradientStops}
                  onOpen={() => setPopover({ group: 'fill', type: 'gradient' })}
                  onAlphaChange={(alpha) =>
                    onUpdate({
                      backgroundGradientStops: gradientStops.map((stop) => ({ ...stop, alpha })),
                    })
                  }
                />
              )}
              {backgroundType === 'image' && (
                <InlineImageControl
                  label={element.backgroundImageUrl ? text.popover.replace : text.popover.upload}
                  imageUrl={element.backgroundImageUrl || ''}
                  onImageChange={() => {}}
                  onOpen={() => setPopover({ group: 'fill', type: 'image' })}
                />
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setFillBlendMenuOpen((open) => !open)}
                className="grid h-10 w-11 place-items-center rounded-xl bg-white text-slate-700 transition-colors hover:bg-sky-100 hover:text-slate-950"
                title={text.field.blendMode}
                aria-label={text.field.blendMode}
                aria-expanded={fillBlendMenuOpen}
              >
                <Blend className="h-4 w-4" />
              </button>
              {fillBlendMenuOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-[10030] w-44 overflow-hidden rounded-xl border border-sky-100 bg-white py-1 shadow-xl shadow-slate-950/15">
                  {BLEND_OPTIONS.map((blendMode) => {
                    const selected = (element.blendMode || 'normal') === blendMode;
                    return (
                      <button
                        key={blendMode}
                        type="button"
                        onClick={() => {
                          onUpdate({ blendMode });
                          setFillBlendMenuOpen(false);
                        }}
                        className={`flex h-8 w-full items-center justify-between px-3 text-left text-xs font-medium transition-colors ${
                          selected ? 'bg-sky-50 text-sky-700' : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{blendMode}</span>
                        {selected && <Check className="h-4 w-4" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          {popover?.group === 'fill' && backgroundType === 'solid' && (
            <FloatingPopover popoverKey="solid">
              <SolidColorPopover
                tone="fill"
                text={text.popover}
                color={element.backgroundColor || '#0ea5e9'}
                alpha={element.opacity ?? 100}
                onColorChange={(backgroundColor) =>
                  onUpdate({ backgroundColor, backgroundType: 'solid' })
                }
                onAlphaChange={(opacity) => onUpdate({ opacity })}
              />
            </FloatingPopover>
          )}
          {popover?.group === 'fill' && backgroundType === 'gradient' && (
            <PortaledGradientPopover>
              <GradientEditorPopover
                language={language}
                angle={element.backgroundGradientAngle ?? 135}
                shape={element.backgroundGradientShape || 'linear'}
                stops={gradientStops}
                onAngleChange={(backgroundGradientAngle) =>
                  onUpdate({ backgroundGradientAngle, backgroundType: 'gradient' })
                }
                onShapeChange={(backgroundGradientShape) =>
                  onUpdate({ backgroundGradientShape, backgroundType: 'gradient' })
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
            </PortaledGradientPopover>
          )}
          {popover?.group === 'fill' && backgroundType === 'image' && (
            <FloatingPopover popoverKey="image">
              <ImageFillPopover
                tone="fill"
                text={text.popover}
                value={{
                  imageUrl: element.backgroundImageUrl || '',
                  imageFit: element.backgroundImageFit || 'crop',
                  imageAngle: element.backgroundImageRotation ?? 0,
                  imageAlpha: element.backgroundImageAlpha ?? 100,
                  imageScale: element.backgroundImageScale ?? 100,
                  imageOffsetX: element.backgroundImageOffsetX ?? 0,
                  imageOffsetY: element.backgroundImageOffsetY ?? 0,
                }}
                onChange={(updates) => {
                  onUpdate({
                    backgroundType: 'image',
                    ...(updates.imageUrl !== undefined ? { backgroundImageUrl: updates.imageUrl } : {}),
                    ...(updates.imageFit !== undefined ? { backgroundImageFit: updates.imageFit } : {}),
                    ...(updates.imageAlpha !== undefined ? { backgroundImageAlpha: updates.imageAlpha } : {}),
                    ...(updates.imageAngle !== undefined ? { backgroundImageRotation: updates.imageAngle } : {}),
                    ...(updates.imageScale !== undefined ? { backgroundImageScale: updates.imageScale } : {}),
                    ...(updates.imageOffsetX !== undefined ? { backgroundImageOffsetX: updates.imageOffsetX } : {}),
                    ...(updates.imageOffsetY !== undefined ? { backgroundImageOffsetY: updates.imageOffsetY } : {}),
                  });
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
          onTitleClick={toggleFill}
          titleActive={fillEnabled}
          expandLabel={inspectorCopy.expand}
          collapseLabel={inspectorCopy.collapse}
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
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_44px] gap-3">
            <InlineImageControl
              label={element.imageUrl ? text.popover.replace : text.popover.upload}
              imageUrl={element.imageUrl || ''}
              onImageChange={(imageUrl) => onUpdate({ imageUrl })}
            />
            <button
              type="button"
              onClick={() =>
                setPopover(popover?.group === 'image' ? null : { group: 'image', type: 'image' })
              }
              className="grid h-10 w-11 place-items-center rounded-xl bg-white text-slate-700 transition-colors hover:bg-sky-100 hover:text-slate-950"
              title={element.imageUrl ? text.popover.replace : text.popover.upload}
              aria-label={element.imageUrl ? text.popover.replace : text.popover.upload}
            >
              <ImageIcon className="h-4 w-4" />
            </button>
          </div>
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
                supportsFit={false}
                supportsCrop={false}
              />
            </FloatingPopover>
          )}
        </Group>
      )}

      <Group
        title={text.group.stroke}
        icon={<Baseline className="h-3.5 w-3.5" />}
        tone="stroke"
        onTitleClick={toggleStroke}
        titleActive={strokeEnabled}
        expandLabel={inspectorCopy.expand}
        collapseLabel={inspectorCopy.collapse}
        secondary={
          strokeIsText ? (
            <HeaderAction
              icon={<Palette className="h-4 w-4" />}
              label={text.field.color}
              onClick={() =>
                setPopover(popover?.group === 'stroke' ? null : { group: 'stroke', type: 'solid' })
              }
            />
          ) : (
            <TwoSegmentControl
              value={strokeType}
              options={[
                { value: 'solid', label: inspectorCopy.solid, icon: <Palette className="h-4 w-4" /> },
                { value: 'gradient', label: inspectorCopy.gradient, icon: <GradientIcon /> },
              ]}
              onChange={(value) => {
                onUpdate({ borderType: value });
                setPopover({ group: 'stroke', type: value });
              }}
            />
          )
        }
      >
        <ControlRow>
          <NumberField
            icon={<Baseline className="h-4 w-4" />}
            label={text.field.strokeWidth}
            description={showDescriptions ? text.field.strokeWidth : undefined}
            value={strokeWidth}
            min={0}
            max={24}
            step={0.5}
            onChange={(value) =>
              onUpdate(strokeIsText ? { textStrokeWidth: value } : { borderWidth: value })
            }
          />
          {element.kind === 'text' ? (
            <TwoSegmentControl
              value={textStrokeTarget}
              options={[
                {
                  value: 'text',
                  label: language === 'zh' ? '文字描边' : language === 'ja' ? '文字縁取り' : 'Text stroke',
                  icon: <Type className="h-4 w-4" />,
                },
                {
                  value: 'box',
                  label: language === 'zh' ? '文字框描边' : language === 'ja' ? '文字枠線' : 'Text frame',
                  icon: <Box className="h-4 w-4" />,
                },
              ]}
              onChange={(textStrokeTarget) => onUpdate({ textStrokeTarget: textStrokeTarget as 'text' | 'box' })}
            />
          ) : (
            <SegmentedIconControl
              value={strokePosition}
              options={[
                { value: 'inside', label: inspectorCopy.inside, icon: <StrokePositionIcon position="inside" /> },
                { value: 'center', label: inspectorCopy.center, icon: <StrokePositionIcon position="center" /> },
                { value: 'outside', label: inspectorCopy.outside, icon: <StrokePositionIcon position="outside" /> },
              ]}
              onChange={(borderPosition) => onUpdate({ borderPosition })}
            />
          )}
        </ControlRow>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_44px] gap-3">
          <div className="min-w-0">
            {strokeType === 'gradient' && !strokeIsText ? (
              <InlineGradientControl
                label={text.popover.gradientTitle}
                stops={borderGradientStops}
                onOpen={() => setPopover({ group: 'stroke', type: 'gradient' })}
                onAlphaChange={(alpha) =>
                  onUpdate({ borderGradientStops: borderGradientStops.map((stop) => ({ ...stop, alpha })) })
                }
              />
            ) : (
              <InlineColorControl
                label={text.field.color}
                color={strokeColor}
                alpha={100}
                alphaLabel={text.field.opacity}
                hexLabel={text.popover.hex}
                onColorChange={(value) =>
                  onUpdate(strokeIsText ? { textStrokeColor: value } : { borderColor: value })
                }
                onAlphaChange={(opacity) => onUpdate({ opacity })}
                onOpen={() => setPopover({ group: 'stroke', type: 'solid' })}
              />
            )}
          </div>
          <div className="h-10 w-11" aria-hidden="true" />
        </div>
        {popover?.group === 'stroke' && popover.type === 'solid' && (
          <FloatingPopover>
            <SolidColorPopover
              tone="stroke"
              text={text.popover}
              color={strokeColor}
              alpha={element.opacity ?? 100}
              onColorChange={(value) =>
                onUpdate(strokeIsText ? { textStrokeColor: value } : { borderColor: value })
              }
              onAlphaChange={(opacity) => onUpdate({ opacity })}
            />
          </FloatingPopover>
        )}
        {popover?.group === 'stroke' && popover.type === 'gradient' && !strokeIsText && (
          <PortaledGradientPopover>
            <GradientEditorPopover
              language={language}
              angle={element.borderGradientAngle ?? 135}
              stops={borderGradientStops}
              onAngleChange={(borderGradientAngle) =>
                onUpdate({ borderGradientAngle, borderType: 'gradient' })
              }
              onStopsChange={(stops) => {
                const sorted = [...stops].sort((a, b) => a.position - b.position);
                const start = sorted[0];
                const end = sorted[sorted.length - 1];
                onUpdate({
                  borderType: 'gradient',
                  borderGradientStops: sorted,
                  borderGradientStart: start?.color || strokeColor,
                  borderGradientEnd: end?.color || '#4f46e5',
                });
              }}
            />
          </PortaledGradientPopover>
        )}
      </Group>

      {shadows.map((shadow, index) => {
        const numberLabel = language === 'zh'
          ? ['', '二', '三', '四', '五', '六'][index] || String(index + 1)
          : ` ${index + 1}`;
        const title = index === 0 ? text.group.shadow : `${text.group.shadow}${numberLabel}`;
        return (
          <Group
            key={shadow.id}
            title={title}
            icon={<Blend className="h-3.5 w-3.5" />}
            tone="shadow"
            onTitleClick={index === 0 ? toggleShadow : undefined}
            titleActive={shadowEnabled}
            expandLabel={inspectorCopy.expand}
            collapseLabel={inspectorCopy.collapse}
            secondary={
              <SegmentedIconControl
                value={shadow.type}
                options={[
                  { value: 'outer', label: inspectorCopy.outerShadow, icon: <ShadowModeIcon mode="outer" /> },
                  { value: 'inner', label: inspectorCopy.innerShadow, icon: <ShadowModeIcon mode="inner" /> },
                  { value: 'innerBlur', label: inspectorCopy.innerBlur, icon: <ShadowModeIcon mode="innerBlur" /> },
                ]}
                onChange={(type) => updateShadow(index, { type })}
              />
            }
          >
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-3">
              <NumberField icon={<Blend className="h-4 w-4" />} label={text.field.opacity} value={shadow.opacity} min={0} max={100} onChange={(opacity) => updateShadow(index, { opacity })} />
              <NumberField icon={<Radius className="h-4 w-4" />} label={text.field.blur} value={shadow.blur} min={0} max={80} onChange={(blur) => updateShadow(index, { blur })} />
              <button type="button" onClick={addShadow} disabled={shadows.length >= 6} className="grid h-10 w-11 place-items-center rounded-xl bg-white text-slate-700 transition-colors hover:bg-fuchsia-100 disabled:opacity-35" title="Add shadow" aria-label="Add shadow"><Plus className="h-5 w-5" /></button>
            </div>
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-3">
              <NumberField icon={<MoveHorizontal className="h-4 w-4" />} label={text.field.x} value={shadow.offsetX} min={-80} max={80} onChange={(offsetX) => updateShadow(index, { offsetX })} />
              <NumberField icon={<MoveVertical className="h-4 w-4" />} label={text.field.y} value={shadow.offsetY} min={-80} max={80} onChange={(offsetY) => updateShadow(index, { offsetY })} />
              {index > 0 ? (
                <button type="button" onClick={() => removeShadow(index)} className="grid h-10 w-11 place-items-center rounded-xl bg-white text-rose-600 transition-colors hover:bg-rose-50" title="Remove shadow" aria-label="Remove shadow"><span className="text-xl leading-none">−</span></button>
              ) : <div className="h-10 w-11" aria-hidden="true" />}
            </div>
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_44px] gap-3">
              <InlineColorControl
                label={text.field.color}
                color={shadow.color}
                alpha={shadow.opacity}
                alphaLabel={text.field.opacity}
                hexLabel={text.popover.hex}
                onColorChange={(color) => updateShadow(index, { color })}
                onAlphaChange={(opacity) => updateShadow(index, { opacity })}
                onOpen={() => setPopover({ group: 'shadow', type: 'solid', shadowIndex: index })}
              />
              <div className="h-10 w-11" aria-hidden="true" />
            </div>
            {popover?.group === 'shadow' && popover.shadowIndex === index && (
              <FloatingPopover>
                <SolidColorPopover tone="shadow" text={text.popover} color={shadow.color} alpha={shadow.opacity} onColorChange={(color) => updateShadow(index, { color })} onAlphaChange={(opacity) => updateShadow(index, { opacity })} />
              </FloatingPopover>
            )}
          </Group>
        );
      })}

    </div>
  );
}

function TwoSegmentControl<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
}: {
  value: T;
  options: Array<{ value: T; label: string; icon: React.ReactNode }>;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`grid h-10 grid-cols-2 overflow-hidden rounded-xl bg-white ${disabled ? 'opacity-45' : ''}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={`grid h-10 min-w-0 place-items-center ${
            value === option.value ? 'bg-indigo-600 text-white' : 'text-slate-700'
          } disabled:cursor-not-allowed`}
          title={option.label}
          aria-label={option.label}
          aria-pressed={value === option.value}
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}

function SegmentedIconControl<T extends string>({
  className = '',
  value,
  options,
  onChange,
}: {
  className?: string;
  value: T;
  options: Array<{ value: T; label: string; icon: React.ReactNode }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className={`grid h-10 grid-cols-3 overflow-hidden rounded-xl bg-white ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`grid h-10 min-w-0 place-items-center ${
            value === option.value ? 'bg-indigo-600 text-white' : 'text-slate-700'
          }`}
          title={option.label}
          aria-label={option.label}
          aria-pressed={value === option.value}
        >
          {option.icon}
        </button>
      ))}
    </div>
  );
}

function StrokePositionIcon({ position }: { position: 'inside' | 'center' | 'outside' }) {
  const inset = position === 'inside' ? 7 : position === 'center' ? 5 : 3;
  const dash = position === 'center' ? '3 3' : undefined;
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
      <rect x="5" y="5" width="14" height="14" rx="2" opacity="0.35" />
      <rect
        x={inset}
        y={inset}
        width={24 - inset * 2}
        height={24 - inset * 2}
        rx="2"
        strokeDasharray={dash}
      />
    </svg>
  );
}

function ShadowModeIcon({ mode }: { mode: 'outer' | 'inner' | 'innerBlur' }) {
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
          <rect x="4" y="4" width="11" height="11" rx="2.5" fill="currentColor" fillOpacity="0.16" />
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
  onOpen,
}: {
  label: string;
  color: string;
  alpha: number;
  alphaLabel: string;
  hexLabel: string;
  onColorChange: (value: string) => void;
  onAlphaChange?: (value: number) => void;
  onOpen?: () => void;
}) {
  const parsed = parseColorValue(color);
  const safeColor = parsed.hex;
  const safeAlpha = clampPercent(alpha ?? parsed.alpha);
  return (
    <div
      className="grid h-10 min-w-0 grid-cols-[44px_minmax(0,1fr)_72px] overflow-hidden rounded-xl bg-white"
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
        value={toHex8(color, safeAlpha)}
        aria-label={hexLabel}
        onChange={(event) => {
          const next = parseColorValue(event.target.value, toHex8(color, safeAlpha));
          onColorChange(next.hex);
          onAlphaChange?.(next.alpha);
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
    <div className="grid h-10 min-w-0 grid-cols-[minmax(0,1fr)_72px] overflow-hidden rounded-xl bg-white text-left text-sm font-medium text-slate-950">
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
        <span className="min-w-0 truncate px-3 leading-10">{label}</span>
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

function InlineImageControl({
  label,
  imageUrl,
  onImageChange,
  onOpen,
}: {
  label: string;
  imageUrl: string;
  onImageChange: (value: string) => void;
  onOpen?: () => void;
}) {
  if (onOpen) {
    return (
      <button type="button" onClick={onOpen} className="grid h-10 w-full min-w-0 grid-cols-[56px_minmax(0,1fr)] overflow-hidden rounded-xl bg-white text-left text-sm font-medium text-slate-950" title={label}>
        <span className="h-full bg-slate-100 bg-cover bg-center" style={imageUrl ? { backgroundImage: `url("${imageUrl.replace(/"/g, '\\"')}")` } : undefined} aria-hidden="true">{!imageUrl && <span className="grid h-full place-items-center text-slate-500"><ImageIcon className="h-4 w-4" /></span>}</span>
        <span className="min-w-0 truncate px-3 leading-10">{label}</span>
      </button>
    );
  }
  return (
    <label
      className="grid h-10 min-w-0 cursor-pointer grid-cols-[56px_minmax(0,1fr)] overflow-hidden rounded-xl bg-white text-sm font-medium text-slate-950"
      title={label}
    >
      <span
        className="h-full bg-slate-100 bg-cover bg-center"
        style={imageUrl ? { backgroundImage: `url("${imageUrl.replace(/"/g, '\\"')}")` } : undefined}
        aria-hidden="true"
      >
        {!imageUrl && (
          <span className="grid h-full place-items-center text-slate-500">
            <ImageIcon className="h-4 w-4" />
          </span>
        )}
      </span>
      <span className="min-w-0 truncate px-3 leading-10">{label}</span>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => onImageChange(String(reader.result || ''));
          reader.readAsDataURL(file);
          event.target.value = '';
        }}
      />
    </label>
  );
}

function RadiusPopover({
  copy,
  element,
  onUpdate,
}: {
  copy: {
    radius: string;
    allCorners: string;
    topLeft: string;
    topRight: string;
    bottomRight: string;
    bottomLeft: string;
  };
  element: WebMenuElement;
  onUpdate: (patch: Partial<WebMenuElement>) => void;
}) {
  const baseRadius = element.borderRadius ?? 12;
  const topLeft = element.borderTopLeftRadius ?? baseRadius;
  const topRight = element.borderTopRightRadius ?? baseRadius;
  const bottomRight = element.borderBottomRightRadius ?? baseRadius;
  const bottomLeft = element.borderBottomLeftRadius ?? baseRadius;
  const setAllCorners = (borderRadius: number) =>
    onUpdate({
      borderRadius,
      borderTopLeftRadius: borderRadius,
      borderTopRightRadius: borderRadius,
      borderBottomRightRadius: borderRadius,
      borderBottomLeftRadius: borderRadius,
    });

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/98 p-3 text-slate-900 shadow-2xl shadow-black/15 backdrop-blur-xl">
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          icon={<CornerRadiusIcon corner="all" />}
          label={copy.allCorners}
          description={copy.allCorners}
          value={baseRadius}
          min={0}
          max={120}
          onChange={setAllCorners}
        />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <NumberField
          icon={<CornerRadiusIcon corner="top-left" />}
          label={copy.topLeft}
          description={copy.topLeft}
          value={topLeft}
          min={0}
          max={120}
          onChange={(borderTopLeftRadius) => onUpdate({ borderTopLeftRadius })}
        />
        <NumberField
          icon={<CornerRadiusIcon corner="top-right" />}
          label={copy.topRight}
          description={copy.topRight}
          value={topRight}
          min={0}
          max={120}
          onChange={(borderTopRightRadius) => onUpdate({ borderTopRightRadius })}
        />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <NumberField
          icon={<CornerRadiusIcon corner="bottom-left" />}
          label={copy.bottomLeft}
          description={copy.bottomLeft}
          value={bottomLeft}
          min={0}
          max={120}
          onChange={(borderBottomLeftRadius) => onUpdate({ borderBottomLeftRadius })}
        />
        <NumberField
          icon={<CornerRadiusIcon corner="bottom-right" />}
          label={copy.bottomRight}
          description={copy.bottomRight}
          value={bottomRight}
          min={0}
          max={120}
          onChange={(borderBottomRightRadius) => onUpdate({ borderBottomRightRadius })}
        />
      </div>
    </div>
  );
}

function CornerRadiusIcon({
  corner,
}: {
  corner: 'all' | 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';
}) {
  const paths = {
    all: (
      <>
        <path d="M8 4h8a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z" />
        <path d="M9 12h6" />
        <path d="M12 9v6" />
      </>
    ),
    'top-left': <path d="M6 20V11a5 5 0 0 1 5-5h9" />,
    'top-right': <path d="M4 6h9a5 5 0 0 1 5 5v9" />,
    'bottom-right': <path d="M18 4v9a5 5 0 0 1-5 5H4" />,
    'bottom-left': <path d="M20 18h-9a5 5 0 0 1-5-5V4" />,
  } satisfies Record<typeof corner, React.ReactNode>;

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
      {paths[corner]}
    </svg>
  );
}

function OutsideDismissPopover({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[10000]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="absolute right-5 top-[252px] w-[min(336px,calc(100vw-2.5rem))]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function PortaledGradientPopover({ children }: { children: React.ReactNode }) {
  return <FloatingPopover popoverKey="gradient">{children}</FloatingPopover>;
}

export function GradientEditorPopover({
  language,
  angle,
  stops,
  shape = 'linear',
  onAngleChange,
  onStopsChange,
  onShapeChange,
}: {
  language: Language;
  angle: number;
  stops: RenderColorStop[];
  shape?: GradientShape;
  onAngleChange: (value: number) => void;
  onStopsChange: (value: RenderColorStop[]) => void;
  onShapeChange?: (value: GradientShape) => void;
}) {
  const copy =
    language === 'zh'
      ? {
          angle: '角度',
          color: '颜色',
          position: '位置',
          opacity: '透明度',
          addStop: '添加色标',
          reverse: '反转',
          deleteStop: '删除色标',
          shape: '渐变类型', linear: '线性', radial: '圆形', diamond: '菱形',
        }
      : language === 'ja'
        ? {
            angle: '角度',
            color: '色',
            position: '位置',
            opacity: '透明度',
            addStop: '色を追加',
            reverse: '反転',
            deleteStop: '色を削除',
            shape: 'グラデーション', linear: '線形', radial: '円形', diamond: '菱形',
          }
        : {
            angle: 'Angle',
            color: 'Color',
            position: 'Position',
            opacity: 'Opacity',
            addStop: 'Add stop',
            reverse: 'Reverse',
            deleteStop: 'Delete stop',
            shape: 'Gradient type', linear: 'Linear', radial: 'Radial', diamond: 'Diamond',
          };
  const orderedStops = [...stops].sort((a, b) => a.position - b.position);
  const [activeStopId, setActiveStopId] = useState(orderedStops[0]?.id || '');
  const [colorPopoverStopId, setColorPopoverStopId] = useState<string | null>(null);
  const activeStop = orderedStops.find((stop) => stop.id === activeStopId) || orderedStops[0];
  const colorPopoverStop = orderedStops.find((stop) => stop.id === colorPopoverStopId);
  const colorText = renderObjectText(language).popover;
  useEffect(() => {
    if (colorPopoverStopId && !colorPopoverStop) setColorPopoverStopId(null);
  }, [colorPopoverStop, colorPopoverStopId]);
  const previewStops = orderedStops
    .map((stop) => `${alphaColor(stop.color, stop.alpha, '#ffffff')} ${stop.position}%`)
    .join(', ');
  const trackPreview = shape === 'radial'
    ? `radial-gradient(circle at center, ${previewStops})`
    : shape === 'diamond'
      ? `conic-gradient(from 45deg at center, ${previewStops})`
      : `linear-gradient(90deg, ${previewStops})`;
  const commitStops = (nextStops: RenderColorStop[]) => {
    onStopsChange([...nextStops].sort((a, b) => a.position - b.position));
  };
  const updateStop = (id: string, updates: Partial<RenderColorStop>) => {
    commitStops(orderedStops.map((stop) => (stop.id === id ? { ...stop, ...updates } : stop)));
  };
  const mixHexColors = (left: string, right: string) => {
    const leftHex = hexColor(left, '#ffffff').slice(1);
    const rightHex = hexColor(right, '#ffffff').slice(1);
    const channels = [0, 2, 4].map((index) =>
      Math.round((Number.parseInt(leftHex.slice(index, index + 2), 16) + Number.parseInt(rightHex.slice(index, index + 2), 16)) / 2),
    );
    return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
  };
  const addStopAt = (requestedPosition?: number) => {
    const largestGap = orderedStops.reduce(
      (current, stop, index) => {
        const next = orderedStops[index + 1];
        if (!next) return current;
        const gap = next.position - stop.position;
        return gap > current.gap ? { gap, left: stop, right: next } : current;
      },
      { gap: -1, left: orderedStops[0], right: orderedStops[1] },
    );
    const position = clampPercent(
      requestedPosition ?? (largestGap.left.position + largestGap.right.position) / 2,
    );
    const left = [...orderedStops].reverse().find((stop) => stop.position <= position) || orderedStops[0];
    const right = orderedStops.find((stop) => stop.position >= position) || orderedStops.at(-1) || left;
    const newStop = {
      id: `stop-${Date.now().toString(36)}`,
      color: mixHexColors(left?.color || '#ffffff', right?.color || '#ffffff'),
      alpha: Math.round(((left?.alpha ?? 100) + (right?.alpha ?? 100)) / 2),
      position,
    };
    setActiveStopId(newStop.id);
    commitStops([...orderedStops, newStop]);
  };
  const removeStop = (id: string) => {
    if (orderedStops.length <= 2) return;
    const nextStops = orderedStops.filter((stop) => stop.id !== id);
    setActiveStopId(nextStops[0]?.id || '');
    commitStops(nextStops);
  };

  return (
    <div className="relative rounded-2xl border border-sky-200 bg-sky-50/98 p-3 text-sky-950 shadow-2xl shadow-black/25 backdrop-blur-xl">
      <div className="ml-auto w-[366px] max-w-full">
      <div className="grid grid-cols-[112px_minmax(0,1fr)_40px_40px] gap-2">
        <label className="relative flex h-9 min-w-0 items-center gap-2 rounded-lg bg-white px-2 text-xs font-bold text-sky-950" title={copy.shape}>
          {shape === 'radial' ? <Circle className="h-4 w-4 shrink-0" /> : shape === 'diamond' ? <Diamond className="h-4 w-4 shrink-0" /> : <MoveHorizontal className="h-4 w-4 shrink-0" />}
          <span className="min-w-0 flex-1 truncate">{copy[shape]}</span>
          <ChevronDown className="h-4 w-4 shrink-0" />
          <select value={shape} onChange={(event) => onShapeChange?.(event.target.value as GradientShape)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={copy.shape}>
            <option value="linear">{copy.linear}</option>
            <option value="radial">{copy.radial}</option>
            <option value="diamond">{copy.diamond}</option>
          </select>
        </label>
        <div className="grid h-9 grid-cols-[34px_minmax(0,1fr)] items-center overflow-hidden rounded-lg border border-white/70 bg-white" title={copy.angle}>
          <RotateCw className="justify-self-center h-3.5 w-3.5 text-sky-900/70" aria-hidden="true" />
          <DragSizeControl
            label={copy.angle}
            value={angle}
            min={0}
            max={360}
            step={1}
            unit="°"
            onChange={onAngleChange}
            className="h-full rounded-none bg-white px-2 text-center text-xs"
          />
        </div>
        <button
          type="button"
          onClick={() =>
            commitStops(
              orderedStops
                .map((stop) => ({ ...stop, position: 100 - stop.position }))
                .reverse(),
            )
          }
          className="grid h-9 w-10 place-items-center rounded-lg bg-white text-sky-900 transition-colors hover:bg-sky-100"
          title={copy.reverse}
          aria-label={copy.reverse}
        >
          <RotateCw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => addStopAt()}
          className="grid h-9 w-10 place-items-center rounded-lg bg-white text-sky-900 transition-colors hover:bg-sky-100"
          title={copy.addStop}
          aria-label={copy.addStop}
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
      <div
        className="relative mt-3 h-12 cursor-crosshair overflow-hidden rounded-xl border border-sky-200 bg-slate-950"
        style={{ backgroundImage: `linear-gradient(${angle}deg, ${previewStops})` }}
        title={copy.angle}
        onPointerDown={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const updateAngle = (clientX: number, clientY: number) => {
            const x = clientX - rect.left - rect.width / 2;
            const y = clientY - rect.top - rect.height / 2;
            onAngleChange(Math.round((Math.atan2(y, x) * 180 / Math.PI + 90 + 360) % 360));
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          updateAngle(event.clientX, event.clientY);
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const x = event.clientX - rect.left - rect.width / 2;
          const y = event.clientY - rect.top - rect.height / 2;
          onAngleChange(Math.round((Math.atan2(y, x) * 180 / Math.PI + 90 + 360) % 360));
        }}
      >
        <span className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/80" />
        <span className="pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-indigo-600 shadow" />
      </div>
      <div
        className="relative mt-3 h-12 w-full rounded-xl border border-white/80 shadow-inner"
        style={{
          backgroundImage: `${trackPreview}, linear-gradient(45deg, #dbeafe 25%, transparent 25%), linear-gradient(-45deg, #dbeafe 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #dbeafe 75%), linear-gradient(-45deg, transparent 75%, #dbeafe 75%)`,
          backgroundPosition: '0 0, 0 0, 0 6px, 6px -6px, -6px 0',
          backgroundSize: 'auto, 12px 12px, 12px 12px, 12px 12px, 12px 12px',
          backgroundColor: '#ffffff',
        }}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          addStopAt(((event.clientX - rect.left) / rect.width) * 100);
        }}
      >
        {orderedStops.map((stop) => (
          <button
            key={stop.id}
            type="button"
            className={`absolute top-1/2 h-8 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow ${
              activeStop?.id === stop.id ? 'border-sky-950 bg-white' : 'border-white bg-sky-950'
            }`}
            style={{ left: `${stop.position}%` }}
            onClick={(event) => {
              event.stopPropagation();
              setActiveStopId(stop.id);
            }}
            aria-label={`${copy.position} ${stop.position}%`}
          />
        ))}
      </div>
      <div className="mt-3 grid gap-2">
        {orderedStops.map((stop) => {
          const color = hexColor(stop.color, '#ffffff');
          return (
            <div key={stop.id} className="grid h-10 grid-cols-[58px_minmax(0,1fr)_64px_40px] items-center gap-2">
              <DragSizeControl
                label={copy.position}
                value={stop.position}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={(position) => updateStop(stop.id, { position })}
                className="h-10 rounded-xl bg-white px-2 text-center text-xs"
              />
              <div className="grid h-10 min-w-0 grid-cols-[48px_minmax(0,1fr)] overflow-hidden rounded-xl border border-white/70 bg-white">
              <button
                type="button"
                title={copy.color}
                aria-label={copy.color}
                onClick={() => {
                  setActiveStopId(stop.id);
                  setColorPopoverStopId(stop.id);
                }}
                className="m-1 rounded-lg border border-slate-200 shadow-inner"
                style={{ backgroundColor: color }}
              />
              <input
                value={toHex8(color, stop.alpha)}
                onChange={(event) => {
                  const next = event.target.value.trim();
                  if (/^#[0-9a-f]{6,8}$/i.test(next)) {
                    const parsed = parseColorValue(next);
                    updateStop(stop.id, { color: parsed.hex, alpha: parsed.alpha });
                  }
                }}
                onFocus={() => setActiveStopId(stop.id)}
                className="h-full min-w-0 border-0 bg-white px-3 text-xs font-medium outline-none"
              />
              </div>
              <DragSizeControl
                label={copy.opacity}
                value={stop.alpha}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={(alpha) => updateStop(stop.id, { alpha })}
                className="h-10 rounded-xl bg-white px-2 text-center text-xs"
              />
              <button
                type="button"
                disabled={orderedStops.length <= 2}
                onClick={() => removeStop(stop.id)}
                className="grid h-10 w-10 place-items-center rounded-xl bg-white text-rose-600 disabled:opacity-35"
                title={copy.deleteStop}
                aria-label={copy.deleteStop}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
      </div>
      {colorPopoverStop && (
        <div className="absolute left-3 top-[calc(100%+8px)] z-20 w-[min(340px,calc(100vw-24px))]">
          <SolidColorPopover
            tone="fill"
            text={colorText}
            color={colorPopoverStop.color}
            alpha={colorPopoverStop.alpha}
            onColorChange={(color) => updateStop(colorPopoverStop.id, { color })}
            onAlphaChange={(alpha) => updateStop(colorPopoverStop.id, { alpha })}
          />
        </div>
      )}
    </div>
  );
}

export type GradientShape = 'linear' | 'radial' | 'diamond';

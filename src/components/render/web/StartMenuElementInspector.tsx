import { playerControlCatalog } from './playerSettingsPanelConfig';
import {
  CornerEditor,
  getLayerOrderChanges,
  LayerOrderMenu,
  normalizeLayerEntries,
  type LayerChange,
} from '../shared/inspectors/GeometryPopovers';
import { AppearanceStackInspector } from '../shared/inspectors/AppearanceStackInspector';
import { webAppearance } from '../shared/paint/appearance';
import {
  Baseline,
  Blend,
  Box,
  CaseSensitive,
  Check,
  Image as ImageIcon,
  Layers,
  Link2,
  MousePointerClick,
  MoveHorizontal,
  MoveVertical,
  Palette,
  Plus,
  Radius,
  RotateCw,
  Ruler,
  Sparkles,
  Type,
  Volume2,
} from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { GradientEditorPopover } from '../shared/paint/GradientEditorPopover';
import {
  InlineColorControl,
  InlineGradientControl,
  ShadowModeIcon,
} from '../shared/paint/InlinePaintControls';
export {
  InlineColorControl,
  InlineGradientControl,
  ShadowModeIcon,
} from '../shared/paint/InlinePaintControls';

import type { Language } from '../../../lib/i18n';
import { DraggableNumberInput } from '../../DraggableNumberInput';
import {
  AlignButtons,
  ControlRow,
  FillTabs,
  FloatingPopover,
  GradientIcon,
  InspectorGroup as Group,
  HeaderAction,
  HeaderSelect,
  NumberField,
  PositionAlignButtons,
} from '../shared/inspectors/InspectorControls';
import { ImageFillPopover, SolidColorPopover } from '../shared/paint/ColorPopovers';
import { parseColorValue, toHex8 } from '../shared/paint/colorValue';
import { CustomFontUploadButton } from '../video/shared/CustomFontUploadButton';
import { renderObjectText } from '../video/objectInspector/i18n';
import type {
  RenderCustomFont,
  RenderFillType,
  RenderFontFamilyOption,
  WebButtonMotion,
  WebButtonMotionState,
  WebMenuElement,
} from '../video/shared/types';
import { formatWebText, getWebShadowOrdinal, getWebStructuredText } from './i18n';
import { resolveWebButtonMotion, type ResolvedWebButtonMotionState } from './webButtonMotion';
import { webImageFillBackgroundColor } from './webElementStyle';
import { normalizeGradientStops } from './webGradientStops';

type InspectorProps = {
  element: WebMenuElement;
  layerElements?: WebMenuElement[];
  onLayerUpdate?: (id: string, patch: Partial<WebMenuElement>) => void;
  onLayerReorder?: (changes: LayerChange[]) => void;
  onLayerSelect?: (id: string) => void;
  language: Language;
  surface?: 'start' | 'archive' | 'settings' | 'game' | 'flow';
  /** Restricts button actions when the inspector is embedded by another workspace. */
  buttonFunctions?: ButtonFunction[];
  selectedElementIds?: string[];
  /** Omitting this removes the practical upper limit for text-size entry. */
  fontSizeMax?: number;
  /** Upper limit for stroke width; use Number.MAX_SAFE_INTEGER for unconstrained entry. */
  strokeWidthMax?: number;
  showDescriptions: boolean;
  onUpdate: (patch: Partial<WebMenuElement>) => void;
  onAlignSelected?: (axis: 'x' | 'y', value: 'start' | 'center' | 'end') => void;
  onImageCropEditingChange?: (elementId: string | null) => void;
  onGradientEditingChange?: (group: 'text' | 'fill' | 'stroke' | null) => void;
  /** Shows the button motion editor only in the Web and Code workspaces. */
  showButtonMotion?: boolean;
  fontFamilyManager?: {
    options: RenderFontFamilyOption[];
    onSelect: (value: string) => void;
    onPresetsChange: (options: RenderFontFamilyOption[]) => void;
    onUploaded: (font: RenderCustomFont) => void;
  };
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
  start: ['custom', 'flowOverview', 'continue', 'save', 'new', 'settings', 'link', 'volume'],
  archive: [
    'custom',
    'slot',
    'slotContinue',
    'slotDelete',
    'new',
    'back',
    'settings',
    'link',
    'volume',
  ],
  settings: [
    'custom',
    'mode',
    'preview',
    'reset',
    'back',
    'auto',
    'speed',
    'textSize',
    'animationSpeed',
    'sound',
    'controls',
    'volume',
    'link',
  ],
  game: [
    'custom',
    'settings',
    'mode',
    'speed',
    'textSize',
    'auto',
    'animationSpeed',
    'sound',
    'controls',
    'preview',
    'reset',
    'history',
    'audio',
    'fullscreen',
    'return',
    'mainMenu',
    'controlsToggle',
    'volume',
    'link',
  ],
  flow: ['flowDirection', 'flowFitView', 'flowBranch', 'flowMinimap', 'custom', 'link', 'volume'],
};

const buttonFunctionCopy = (language: Language): Record<ButtonFunction, string> => {
  if (language === 'ja') {
    return {
      mode: '文字の表示',
      preview: '読み方のプレビュー',
      reset: '初期設定に戻す',
      custom: '機能なし',
      flowOverview: 'フロー概要',
      flowDirection: 'フロー方向を切り替え',
      flowFitView: '全体を表示',
      flowBranch: '現在の分岐',
      flowMinimap: 'ミニマップ',
      continue: 'ゲームを続ける',
      save: 'セーブ画面',
      new: '新規ゲーム',
      settings: '設定画面',
      back: '戻る',
      slot: 'セーブを読む',
      slotContinue: 'セーブを続ける',
      slotDelete: 'セーブを削除',
      auto: '自動再生',
      speed: '文字速度',
      textSize: '文字サイズ',
      animationSpeed: 'アニメーション速度',
      sound: 'サウンド',
      controls: '操作表示',
      history: '会話履歴',
      audio: '音声リスト',
      fullscreen: '全画面',
      return: '一つ戻る',
      mainMenu: 'メイン画面',
      controlsToggle: '操作を隠す',
      link: 'リンクを開く',
      volume: '音量を設定',
      title: 'タイトル',
      subtitle: 'サブタイトル',
    };
  }
  if (language === 'en') {
    return {
      mode: 'Text display',
      preview: 'Reading preview',
      reset: 'Restore defaults',
      custom: 'No action',
      flowOverview: 'Flow overview',
      flowDirection: 'Cycle flow direction',
      flowFitView: 'Fit flow view',
      flowBranch: 'Current branch',
      flowMinimap: 'Flow minimap',
      continue: 'Continue game',
      save: 'Open saves',
      new: 'New game',
      settings: 'Open settings',
      back: 'Back',
      slot: 'Load save',
      slotContinue: 'Continue save',
      slotDelete: 'Delete save',
      auto: 'Toggle auto play',
      speed: 'Text speed',
      textSize: 'Text size',
      animationSpeed: 'Animation speed',
      sound: 'Sound',
      controls: 'Show controls',
      history: 'Dialogue history',
      audio: 'Audio playlist',
      fullscreen: 'Fullscreen',
      return: 'Go back',
      mainMenu: 'Main menu',
      controlsToggle: 'Toggle controls',
      link: 'Open link',
      volume: 'Set volume',
      title: 'Title',
      subtitle: 'Subtitle',
    };
  }
  return {
    mode: '文字呈现',
    preview: '阅读效果预览',
    reset: '恢复默认',
    custom: '无功能',
    flowOverview: '流程图总览',
    flowDirection: '切换流程方向',
    flowFitView: '适应流程图',
    flowBranch: '当前分支提示',
    flowMinimap: '流程图导航',
    continue: '继续游戏',
    save: '打开存档页',
    new: '新游戏',
    settings: '打开设置页',
    back: '返回',
    slot: '读取存档',
    slotContinue: '继续此存档',
    slotDelete: '删除此存档',
    auto: '自动播放开关',
    speed: '打字速度',
    textSize: '文本大小',
    animationSpeed: '动画速度',
    sound: '音效开关',
    controls: '显示控制栏',
    history: '对话历史',
    audio: '音频播放列表',
    fullscreen: '最大化 / 最小化',
    return: '回退',
    mainMenu: '主菜单',
    controlsToggle: '显示/隐藏控制栏',
    link: '打开超链接',
    volume: '设置音量',
    title: '标题',
    subtitle: '副标题',
  };
};

const buttonFunctionDefaultText = (role: ButtonFunction, language: Language) => {
  const copy = buttonFunctionCopy(language);
  return role === 'custom' ? '' : copy[role];
};

function NumericButtonActionControl({
  role,
  language,
  value,
  inputMode = 'drag',
  onChange,
  onModeChange,
}: {
  role: 'speed' | 'textSize' | 'animationSpeed';
  language: Language;
  value?: number;
  inputMode?: 'drag' | 'slider';
  onChange: (value: number) => void;
  onModeChange: (mode: 'drag' | 'slider') => void;
}) {
  const config =
    role === 'speed'
      ? { min: 10, max: 200, step: 5, fallback: 65, unit: 'ms' }
      : role === 'textSize'
        ? { min: 85, max: 130, step: 5, fallback: 100, unit: '%' }
        : { min: 0.5, max: 2, step: 0.5, fallback: 1, unit: '×' };
  const label =
    role === 'speed'
      ? formatWebText(language, 'componentsrenderwebStartMenuElementInspectorConditionalText228')
      : formatWebText(language, 'componentsrenderwebStartMenuElementInspectorConditionalText229');
  const current = value ?? config.fallback;
  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center justify-between px-1 text-[10px] font-bold text-slate-500">
        <span>{label}</span>
        <div className="flex overflow-hidden rounded-lg bg-slate-100 text-slate-600">
          <button
            type="button"
            className={`px-2 py-1 ${inputMode === 'drag' ? 'bg-indigo-600 text-white' : ''}`}
            onClick={() => onModeChange('drag')}
          >
            ↔
          </button>
          <button
            type="button"
            className={`px-2 py-1 ${inputMode === 'slider' ? 'bg-indigo-600 text-white' : ''}`}
            onClick={() => onModeChange('slider')}
          >
            ━
          </button>
        </div>
      </div>
      {inputMode === 'drag' ? (
        <DraggableNumberInput
          value={current}
          onChange={onChange}
          min={config.min}
          max={config.max}
          step={config.step}
          unit={config.unit}
        />
      ) : (
        <input
          className="w-full accent-indigo-600"
          type="range"
          min={config.min}
          max={config.max}
          step={config.step}
          value={current}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      )}
    </div>
  );
}

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
  layerElements,
  onLayerUpdate,
  onLayerReorder,
  onLayerSelect,
  language,
  surface = 'start',
  buttonFunctions,
  selectedElementIds = [],
  fontSizeMax = 120,
  strokeWidthMax = 24,
  showDescriptions,
  onUpdate,
  onAlignSelected,
  onImageCropEditingChange,
  onGradientEditingChange,
  fontFamilyManager,
  showButtonMotion = false,
}: InspectorProps) {
  const text = renderObjectText(language);
  const [popover, setPopover] = useState<Popover>(null);
  const [radiusPopoverOpen, setRadiusPopoverOpen] = useState(false);
  const [fillBlendMenuOpen, setFillBlendMenuOpen] = useState(false);
  const [textBlendMenuOpen, setTextBlendMenuOpen] = useState(false);
  const buttonMotion = resolveWebButtonMotion(element.buttonMotion);
  const layerEntries = (layerElements || [element]).map((item) => ({
    id: item.id,
    name: item.text || item.kind,
    z: item.zIndex ?? 0,
  }));
  const normalizedLayerEntries = normalizeLayerEntries(layerEntries);
  const normalizedZIndex = normalizedLayerEntries.find((item) => item.id === element.id)?.z ?? 0;
  const commitLayerZIndex = (zIndex: number) => {
    const changes = getLayerOrderChanges(layerEntries, element.id, zIndex);
    if (onLayerReorder && changes.length > 0) onLayerReorder(changes);
    else if (onLayerUpdate && changes.length > 0)
      changes.forEach((change) => onLayerUpdate(change.id, { zIndex: change.z }));
    else if (changes.length > 0) onUpdate({ zIndex: changes[0].z });
  };
  const updateButtonMotionState = (
    stateKey: ButtonMotionStateKey,
    patch: Partial<WebButtonMotionState>,
  ) =>
    onUpdate({
      buttonMotion: {
        ...(element.buttonMotion || {}),
        [stateKey]: { ...buttonMotion[stateKey], ...patch },
      },
    });

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
  const openImageFillPopover = () => {
    onUpdate({ backgroundType: 'image' });
    setPopover({ group: 'fill', type: 'image' });
  };
  const imageCropEditing =
    popover?.group === 'fill' &&
    backgroundType === 'image' &&
    (element.backgroundImageFit || 'crop') === 'crop' &&
    Boolean(element.backgroundImageUrl);
  useEffect(() => {
    onImageCropEditingChange?.(imageCropEditing ? element.id : null);
    return () => onImageCropEditingChange?.(null);
  }, [element.id, imageCropEditing, onImageCropEditingChange]);
  useEffect(() => {
    const group =
      popover?.type === 'gradient' &&
      (popover.group === 'text' || popover.group === 'fill' || popover.group === 'stroke')
        ? popover.group
        : null;
    onGradientEditingChange?.(group);
    return () => onGradientEditingChange?.(null);
  }, [onGradientEditingChange, popover]);
  const gradientStops = normalizeGradientStops(
    element.backgroundGradientStops,
    element.backgroundGradientStart || '#0ea5e9',
    element.backgroundGradientEnd || '#0f172a',
  );
  const buttonTextColorType = element.textColorType || 'solid';
  const buttonTextGradientStops = normalizeGradientStops(
    element.textGradientStops,
    element.textGradientStart || element.textColor || '#ffffff',
    element.textGradientEnd || '#0ea5e9',
  );
  const updateButtonTextGradientStops = (stops: typeof buttonTextGradientStops) =>
    onUpdate({
      textColorType: 'gradient',
      textGradientStops: stops,
      textGradientStart: stops[0]?.color || element.textGradientStart || '#ffffff',
      textGradientEnd: stops.at(-1)?.color || element.textGradientEnd || '#0ea5e9',
    });
  const hasTextControls = element.kind !== 'image';
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
    : [
        {
          id: 'shadow-1',
          type: shadowType,
          color: element.shadowColor || '#000000',
          opacity: element.shadowOpacity ?? 0,
          blur: element.shadowBlur ?? 18,
          offsetX: element.shadowOffsetX ?? 0,
          offsetY: element.shadowOffsetY ?? (element.kind === 'text' ? 2 : 8),
        },
      ];
  const updateShadow = (index: number, patch: Partial<(typeof shadows)[number]>) => {
    const next = shadows.map((shadow, shadowIndex) =>
      shadowIndex === index ? { ...shadow, ...patch } : shadow,
    );
    const first = next[0];
    onUpdate({
      shadows: next,
      ...(index === 0 && first
        ? {
            shadowType: first.type,
            shadowColor: first.color,
            shadowOpacity: first.opacity,
            shadowBlur: first.blur,
            shadowOffsetX: first.offsetX,
            shadowOffsetY: first.offsetY,
          }
        : {}),
    });
  };
  const addShadow = () => {
    if (shadows.length >= 6) return;
    onUpdate({
      shadows: [
        ...shadows,
        {
          id: `shadow-${Date.now().toString(36)}`,
          type: 'outer',
          color: '#000000',
          opacity: 35,
          blur: 18,
          offsetX: 0,
          offsetY: element.kind === 'text' ? 2 : 8,
        },
      ],
      shadowEnabled: true,
    });
  };
  const removeShadow = (index: number) => {
    if (index === 0) return;
    onUpdate({ shadows: shadows.filter((_, shadowIndex) => shadowIndex !== index) });
    setPopover(null);
  };
  const functionCopy = buttonFunctionCopy(language);
  const buttonFunctionOptions = (buttonFunctions || BUTTON_FUNCTIONS_BY_SURFACE[surface]).map(
    (role) => ({
      label: functionCopy[role],
      value: role,
    }),
  );
  const buttonFunction = (element.role || 'custom') as ButtonFunction;
  const inspectorCopy = getWebStructuredText(
    language,
    'componentsrenderwebStartMenuElementInspectorStructuredText408',
  );
  const descriptionCopy = getWebStructuredText(
    language,
    'componentsrenderwebStartMenuElementInspectorStructuredText468',
  );
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
  const elementHidden = element.visible === false;
  const hiddenLabel = formatWebText(
    language,
    'componentsrenderwebStartMenuElementInspectorConditionalText532',
  );
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
      : shadows.map((shadow, index) => (index === 0 ? { ...shadow, opacity: 35 } : shadow));
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
        title={elementHidden ? hiddenLabel : text.group.position}
        icon={
          elementHidden ? (
            <SlashedIcon>
              <Box className="h-3.5 w-3.5" />
            </SlashedIcon>
          ) : (
            <Box className="h-3.5 w-3.5" />
          )
        }
        tone="position"
        onTitleClick={() => onUpdate({ visible: elementHidden })}
        titleActive
        expandLabel={inspectorCopy.expand}
        collapseLabel={inspectorCopy.collapse}
        showDescriptions={showDescriptions}
        secondary={null}
      >
        <ControlRow>
          <NumberField
            icon={<Layers className="h-4 w-4" />}
            label={inspectorCopy.zIndex}
            value={normalizedZIndex}
            min={0}
            max={999}
            onChange={commitLayerZIndex}
          />
          <div className="min-w-0 flex-1">
            <LayerOrderMenu
              language={language}
              className="w-full justify-start"
              items={layerEntries}
              selectedId={element.id}
              onSelect={onLayerSelect}
              onReorder={onLayerReorder}
              onChange={(id, zIndex) =>
                onLayerUpdate ? onLayerUpdate(id, { zIndex }) : onUpdate({ zIndex })
              }
            />
          </div>
        </ControlRow>
        <div className="relative grid grid-cols-2 gap-3">
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
        </div>
        <div className="relative mt-2">
          <NumberField
            icon={<CornerRadiusIcon corner="all" />}
            label={`${inspectorCopy.radius} · px`}
            value={element.borderRadius ?? 12}
            min={0}
            max={999}
            onChange={(radius) =>
              onUpdate({
                borderRadius: radius,
                borderTopLeftRadius: radius,
                borderTopRightRadius: radius,
                borderBottomRightRadius: radius,
                borderBottomLeftRadius: radius,
              })
            }
            action={
              <button
                type="button"
                onClick={() => setRadiusPopoverOpen((current) => !current)}
                className="property-number grid h-8 w-8 shrink-0 place-items-center rounded-md bg-white text-slate-700 hover:bg-emerald-100 hover:text-slate-950"
                title={inspectorCopy.radius}
                aria-label={inspectorCopy.radius}
                aria-expanded={radiusPopoverOpen}
              >
                <CornerRadiusIcon corner="all" />
              </button>
            }
          />
          {radiusPopoverOpen && (
            <FloatingPopover
              language={language}
              popoverKey="corners"
              onClose={() => setRadiusPopoverOpen(false)}
            >
              <RadiusPopover
                language={language}
                copy={inspectorCopy}
                element={element}
                onUpdate={onUpdate}
              />
            </FloatingPopover>
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
          showDescriptions={showDescriptions}
          horizontalLabel={descriptionCopy.horizontalAlign}
          verticalLabel={descriptionCopy.verticalAlign}
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
          showDescriptions={showDescriptions}
          secondaryDescription={text.field.font}
          secondary={
            <div className="flex min-w-0 gap-1">
              <div className="min-w-0 flex-1">
                <HeaderSelect
                  icon={<Type className="h-4 w-4" />}
                  label={text.field.font}
                  value={element.fontFamily || FONT_OPTIONS[0].value}
                  options={fontFamilyManager?.options || FONT_OPTIONS}
                  onChange={(fontFamily) =>
                    fontFamilyManager
                      ? fontFamilyManager.onSelect(fontFamily)
                      : onUpdate({ fontFamily })
                  }
                />
              </div>
              {fontFamilyManager ? (
                <div className="w-24 shrink-0">
                  <CustomFontUploadButton
                    language={language}
                    currentValue={element.fontFamily || FONT_OPTIONS[0].value}
                    options={fontFamilyManager.options}
                    onSelect={fontFamilyManager.onSelect}
                    onPresetsChange={fontFamilyManager.onPresetsChange}
                    onUploaded={fontFamilyManager.onUploaded}
                  />
                </div>
              ) : null}
            </div>
          }
        >
          <ControlRow>
            <NumberField
              icon={<CaseSensitive className="h-4 w-4" />}
              label={text.field.fontSize}
              description={showDescriptions ? text.field.fontSize : undefined}
              value={element.fontSize ?? (element.kind === 'button' ? 14 : 28)}
              min={8}
              max={fontSizeMax}
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
            <SettingDescription show={showDescriptions} label={descriptionCopy.textAlign}>
              <AlignButtons
                value={element.textAlign || (element.kind === 'button' ? 'center' : 'left')}
                onChange={(textAlign) => onUpdate({ textAlign })}
              />
            </SettingDescription>
            <SettingDescription show={showDescriptions} label={descriptionCopy.blendMode}>
              <button
                type="button"
                onClick={() => setTextBlendMenuOpen((open) => !open)}
                className="grid h-10 w-11 place-items-center rounded-xl bg-white text-slate-700 transition-colors hover:bg-violet-100"
                title={text.field.blendMode}
                aria-label={text.field.blendMode}
              >
                <Blend className="h-4 w-4" />
              </button>
            </SettingDescription>
            {textBlendMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+8px)] z-[10030] w-44 overflow-hidden rounded-xl border border-violet-100 bg-white py-1 shadow-xl">
                {BLEND_OPTIONS.map((blendMode) => (
                  <button
                    key={blendMode}
                    type="button"
                    onClick={() => {
                      onUpdate({ textBlendMode: blendMode });
                      setTextBlendMenuOpen(false);
                    }}
                    className={`flex h-8 w-full items-center justify-between px-3 text-left text-xs ${element.textBlendMode === blendMode || (!element.textBlendMode && blendMode === 'normal') ? 'bg-violet-50 text-violet-700' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    <span>{blendMode}</span>
                    {(element.textBlendMode === blendMode ||
                      (!element.textBlendMode && blendMode === 'normal')) && (
                      <Check className="h-4 w-4" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </ControlRow>
        </Group>
      )}

      {element.kind === 'button' && (
        <Group
          title={descriptionCopy.textColor}
          icon={<Palette className="h-3.5 w-3.5" />}
          tone="text"
          expandLabel={inspectorCopy.expand}
          collapseLabel={inspectorCopy.collapse}
          showDescriptions={showDescriptions}
          secondary={null}
        >
          {buttonTextColorType === 'gradient' ? (
            <InlineGradientControl
              label={descriptionCopy.textColor}
              stops={buttonTextGradientStops}
              onOpen={() =>
                setPopover(popover?.group === 'text' ? null : { group: 'text', type: 'gradient' })
              }
              onAlphaChange={(alpha) =>
                updateButtonTextGradientStops(
                  buttonTextGradientStops.map((stop) => ({ ...stop, alpha })),
                )
              }
            />
          ) : (
            (() => {
              const parsed = parseColorValue(element.textColor || '#ffffff');
              return (
                <InlineColorControl
                  label={descriptionCopy.textColor}
                  color={parsed.hex}
                  alpha={parsed.alpha}
                  hexLabel="HEX"
                  alphaLabel="%"
                  onColorChange={(color) => onUpdate({ textColor: color, textColorType: 'solid' })}
                  onAlphaChange={(alpha) =>
                    onUpdate({ textColor: toHex8(parsed.hex, alpha), textColorType: 'solid' })
                  }
                  onColorAndAlphaChange={({ color, alpha }) =>
                    onUpdate({ textColor: toHex8(color, alpha), textColorType: 'solid' })
                  }
                  onOpen={() =>
                    setPopover(popover?.group === 'text' ? null : { group: 'text', type: 'solid' })
                  }
                />
              );
            })()
          )}
          {popover?.group === 'text' &&
            (popover.type === 'solid' || popover.type === 'gradient') && (
              <FloatingPopover
                language={language}
                popoverKey={popover.type}
                title={descriptionCopy.textColor}
                onClose={() => setPopover(null)}
              >
                <div className="property-editor-popover space-y-3">
                  <div className="grid h-10 grid-cols-2 overflow-hidden rounded-xl bg-slate-100">
                    {[
                      {
                        value: 'solid' as const,
                        label: text.popover.solidTitle,
                        icon: <Palette className="h-3.5 w-3.5" />,
                      },
                      {
                        value: 'gradient' as const,
                        label: text.popover.gradientTitle,
                        icon: <GradientIcon />,
                      },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`flex h-10 min-w-0 items-center justify-center gap-1 px-2 text-xs font-bold ${popover.type === option.value ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-white'}`}
                        title={option.label}
                        aria-label={option.label}
                        aria-pressed={popover.type === option.value}
                        onClick={() => {
                          onUpdate({ textColorType: option.value });
                          setPopover({ group: 'text', type: option.value });
                        }}
                      >
                        {option.icon}
                        <span className="truncate">{option.label}</span>
                      </button>
                    ))}
                  </div>
                  {popover.type === 'gradient' ? (
                    <GradientEditorPopover
                      language={language}
                      angle={element.textGradientAngle ?? 90}
                      stops={buttonTextGradientStops}
                      onAngleChange={(textGradientAngle) =>
                        onUpdate({ textColorType: 'gradient', textGradientAngle })
                      }
                      onStopsChange={updateButtonTextGradientStops}
                    />
                  ) : (
                    <SolidColorPopover
                      tone="fill"
                      text={text.popover}
                      color={parseColorValue(element.textColor || '#ffffff').hex}
                      alpha={parseColorValue(element.textColor || '#ffffff').alpha}
                      onColorChange={(color) =>
                        onUpdate({ textColor: color, textColorType: 'solid' })
                      }
                      onAlphaChange={(alpha) => {
                        const parsed = parseColorValue(element.textColor || '#ffffff');
                        onUpdate({ textColor: toHex8(parsed.hex, alpha), textColorType: 'solid' });
                      }}
                      onColorAndAlphaChange={({ color, alpha }) =>
                        onUpdate({ textColor: toHex8(color, alpha), textColorType: 'solid' })
                      }
                    />
                  )}
                </div>
              </FloatingPopover>
            )}
        </Group>
      )}

      {element.kind === 'button' && (
        <Group
          title={formatWebText(
            language,
            'componentsrenderwebStartMenuElementInspectorConditionalText941',
          )}
          icon={<MousePointerClick className="h-3.5 w-3.5" />}
          tone="position"
          expandLabel={inspectorCopy.expand}
          collapseLabel={inspectorCopy.collapse}
          showDescriptions={showDescriptions}
          titleDescription={formatWebText(
            language,
            'componentsrenderwebStartMenuElementInspectorConditionalText948',
          )}
          secondaryDescription={formatWebText(
            language,
            'componentsrenderwebStartMenuElementInspectorConditionalText951',
          )}
          secondary={
            <HeaderSelect
              icon={<MousePointerClick className="h-4 w-4" />}
              label={formatWebText(
                language,
                'componentsrenderwebStartMenuElementInspectorConditionalText957',
              )}
              value={buttonFunction}
              options={buttonFunctionOptions}
              onChange={(value) => {
                const role = value as ButtonFunction;
                onUpdate({
                  role,
                  ...(element.text.trim()
                    ? {}
                    : { text: buttonFunctionDefaultText(role, language) }),
                });
              }}
            />
          }
        >
          {(surface === 'settings' || surface === 'game') &&
            (() => {
              const forms =
                playerControlCatalog(language).find((item) => item.id === buttonFunction)?.forms ||
                [];
              if (!forms.length) return null;
              const formLabel = {
                switch: '开关 / Switch',
                segmented: '分段按钮 / Segments',
                slider: '滑块 / Slider',
                stepper: '步进输入 / Stepper',
                select: '下拉选择 / Dropdown',
              };
              return (
                <label className="mb-3 block space-y-1">
                  <span className="property-field-label">
                    {language === 'zh' ? '控件形式' : language === 'ja' ? '形式' : 'Control form'}
                  </span>
                  <select
                    className="h-8 w-full rounded-md bg-[var(--inspector-field)] px-2 text-xs"
                    value={
                      element.settingsControlForm && forms.includes(element.settingsControlForm)
                        ? element.settingsControlForm
                        : forms[0]
                    }
                    onChange={(event) =>
                      onUpdate({
                        settingsControlForm: event.target
                          .value as WebMenuElement['settingsControlForm'],
                      })
                    }
                  >
                    {forms.map((form) => (
                      <option key={form} value={form}>
                        {formLabel[form]}
                      </option>
                    ))}
                  </select>
                </label>
              );
            })()}
          {buttonFunction === 'link' && (
            <div className="mt-2 space-y-2">
              <label className="block space-y-1 px-1 text-[10px] font-bold text-slate-500">
                <span>
                  {formatWebText(
                    language,
                    'componentsrenderwebStartMenuElementInspectorConditionalText977',
                  )}
                </span>
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
                label={formatWebText(
                  language,
                  'componentsrenderwebStartMenuElementInspectorConditionalText992',
                )}
                value={element.linkTarget || '_blank'}
                options={[
                  {
                    value: '_blank',
                    label: formatWebText(
                      language,
                      'componentsrenderwebStartMenuElementInspectorConditionalText998',
                    ),
                  },
                  {
                    value: '_self',
                    label: formatWebText(
                      language,
                      'componentsrenderwebStartMenuElementInspectorConditionalText1003',
                    ),
                  },
                ]}
                onChange={(linkTarget) =>
                  onUpdate({ linkTarget: linkTarget as '_blank' | '_self' })
                }
              />
            </div>
          )}
          {buttonFunction === 'volume' && (
            <div className="mt-2">
              <NumberField
                icon={<Volume2 className="h-4 w-4" />}
                label={formatWebText(
                  language,
                  'componentsrenderwebStartMenuElementInspectorConditionalText1021',
                )}
                value={element.actionValue ?? 70}
                min={0}
                max={100}
                onChange={(actionValue) => onUpdate({ actionValue })}
              />
            </div>
          )}
          {surface !== 'settings' &&
            surface !== 'game' &&
            (['speed', 'textSize', 'animationSpeed'] as ButtonFunction[]).includes(
              buttonFunction,
            ) && (
              <NumericButtonActionControl
                role={buttonFunction as 'speed' | 'textSize' | 'animationSpeed'}
                language={language}
                value={element.actionValue}
                inputMode={element.actionValueInputMode}
                onChange={(actionValue) => onUpdate({ actionValue })}
                onModeChange={(actionValueInputMode) => onUpdate({ actionValueInputMode })}
              />
            )}
        </Group>
      )}

      {showButtonMotion && element.kind === 'button' && (
        <Group
          title={formatWebText(
            language,
            'componentsrenderwebStartMenuElementInspectorButtonMotionTitle',
          )}
          icon={<Sparkles className="h-3.5 w-3.5" />}
          tone="animation"
          expandLabel={inspectorCopy.expand}
          collapseLabel={inspectorCopy.collapse}
          showDescriptions={showDescriptions}
          titleDescription={formatWebText(
            language,
            'componentsrenderwebStartMenuElementInspectorButtonMotionDescription',
          )}
          secondary={null}
        >
          <div className="space-y-2">
            <ButtonMotionStateEditor
              language={language}
              stateKey="hover"
              state={buttonMotion.hover}
              onChange={(patch) => updateButtonMotionState('hover', patch)}
            />
            <ButtonMotionStateEditor
              language={language}
              stateKey="pressed"
              state={buttonMotion.pressed}
              onChange={(patch) => updateButtonMotionState('pressed', patch)}
            />
            <label className="block space-y-1">
              <span className="property-field-label">
                {formatWebText(
                  language,
                  'componentsrenderwebStartMenuElementInspectorButtonMotionOrigin',
                )}
              </span>
              <select
                className="h-8 w-full rounded-md bg-white px-2 text-xs text-slate-800"
                value={buttonMotion.transformOrigin}
                onChange={(event) =>
                  onUpdate({
                    buttonMotion: {
                      ...(element.buttonMotion || {}),
                      transformOrigin: event.target.value,
                    } as WebButtonMotion,
                  })
                }
              >
                <option value="center center">
                  {formatWebText(
                    language,
                    'componentsrenderwebStartMenuElementInspectorButtonMotionCenter',
                  )}
                </option>
                <option value="left center">
                  {formatWebText(
                    language,
                    'componentsrenderwebStartMenuElementInspectorButtonMotionLeft',
                  )}
                </option>
                <option value="right center">
                  {formatWebText(
                    language,
                    'componentsrenderwebStartMenuElementInspectorButtonMotionRight',
                  )}
                </option>
                <option value="center top">
                  {formatWebText(
                    language,
                    'componentsrenderwebStartMenuElementInspectorButtonMotionTop',
                  )}
                </option>
                <option value="center bottom">
                  {formatWebText(
                    language,
                    'componentsrenderwebStartMenuElementInspectorButtonMotionBottom',
                  )}
                </option>
              </select>
            </label>
            <button
              type="button"
              className="h-8 w-full rounded-md bg-white text-xs font-bold text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
              onClick={() => onUpdate({ buttonMotion: undefined })}
            >
              {formatWebText(
                language,
                'componentsrenderwebStartMenuElementInspectorButtonMotionReset',
              )}
            </button>
          </div>
        </Group>
      )}

      <AppearanceStackInspector
        language={language}
        groups={element.kind === 'image' ? ['strokes', 'shadows'] : ['fills', 'strokes', 'shadows']}
        value={
          element.kind === 'image'
            ? { ...webAppearance(element), fills: [] }
            : webAppearance(element)
        }
        onChange={(appearance) =>
          onUpdate({
            appearance: element.kind === 'image' ? { ...appearance, fills: [] } : appearance,
          })
        }
      />

      {element.kind === 'image' && (
        <Group
          title={text.group.fill}
          icon={<ImageIcon className="h-3.5 w-3.5" />}
          tone="fill"
          onTitleClick={toggleFill}
          titleActive={fillEnabled}
          expandLabel={inspectorCopy.expand}
          collapseLabel={inspectorCopy.collapse}
          showDescriptions={showDescriptions}
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
            <FloatingPopover
              language={language}
              popoverKey="image"
              onClose={() => setPopover(null)}
            >
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
                imageBackgroundColor={element.imageBackgroundColor || '#00000000'}
                onImageBackgroundColorChange={(imageBackgroundColor) =>
                  onUpdate({ imageBackgroundColor })
                }
                supportsFit={false}
                supportsCrop={false}
              />
            </FloatingPopover>
          )}
        </Group>
      )}
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
    <div
      className={`grid h-10 grid-cols-2 overflow-hidden rounded-xl bg-white ${disabled ? 'opacity-45' : ''}`}
    >
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

function SlashedIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-grid h-3.5 w-3.5 place-items-center" aria-hidden="true">
      {children}
      <span className="absolute h-[1.5px] w-[18px] rotate-[-45deg] rounded-full bg-current" />
    </span>
  );
}

function SettingDescription({
  show,
  label,
  className = '',
  children,
}: {
  show: boolean;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1 ${className}`}>
      {show && <div className="px-1 text-[10px] leading-4 text-slate-500">{label}</div>}
      {children}
    </div>
  );
}

type ButtonMotionStateKey = 'hover' | 'pressed';

function ButtonMotionStateEditor({
  language,
  stateKey,
  state,
  onChange,
}: {
  language: Language;
  stateKey: ButtonMotionStateKey;
  state: ResolvedWebButtonMotionState;
  onChange: (patch: Partial<WebButtonMotionState>) => void;
}) {
  const prefix = 'componentsrenderwebStartMenuElementInspectorButtonMotion';
  const title = formatWebText(
    language,
    `${prefix}${stateKey === 'hover' ? 'Hover' : 'Pressed'}` as Parameters<typeof formatWebText>[1],
  );
  const enabledLabel = formatWebText(
    language,
    `${prefix}Enabled` as Parameters<typeof formatWebText>[1],
  );
  const labels = {
    scale: formatWebText(language, `${prefix}Scale` as Parameters<typeof formatWebText>[1]),
    translateX: formatWebText(
      language,
      `${prefix}TranslateX` as Parameters<typeof formatWebText>[1],
    ),
    translateY: formatWebText(
      language,
      `${prefix}TranslateY` as Parameters<typeof formatWebText>[1],
    ),
    rotate: formatWebText(language, `${prefix}Rotate` as Parameters<typeof formatWebText>[1]),
    duration: formatWebText(language, `${prefix}Duration` as Parameters<typeof formatWebText>[1]),
    easing: formatWebText(language, `${prefix}Easing` as Parameters<typeof formatWebText>[1]),
    shadow: formatWebText(language, `${prefix}Shadow` as Parameters<typeof formatWebText>[1]),
  };
  const motionText = (suffix: string) =>
    formatWebText(language, `${prefix}${suffix}` as Parameters<typeof formatWebText>[1]);
  return (
    <div className="space-y-2 rounded-lg bg-white/60 p-2">
      <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-700">
        <span>{title}</span>
        <label className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500">
          <input
            type="checkbox"
            checked={state.enabled}
            onChange={(event) => onChange({ enabled: event.target.checked })}
            className="accent-indigo-600"
          />
          {enabledLabel}
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label={labels.scale}
          value={state.scale}
          min={0.85}
          max={1.2}
          step={0.01}
          onChange={(scale) => onChange({ scale })}
        />
        <NumberField
          label={labels.rotate}
          value={state.rotate}
          min={-12}
          max={12}
          step={1}
          onChange={(rotate) => onChange({ rotate })}
        />
        <NumberField
          label={labels.translateX}
          value={state.translateX}
          min={-24}
          max={24}
          step={1}
          onChange={(translateX) => onChange({ translateX })}
        />
        <NumberField
          label={labels.translateY}
          value={state.translateY}
          min={-24}
          max={24}
          step={1}
          onChange={(translateY) => onChange({ translateY })}
        />
        <NumberField
          label={labels.duration}
          value={state.duration}
          min={0}
          max={1200}
          step={10}
          onChange={(duration) => onChange({ duration })}
        />
        <label className="min-w-0 space-y-1">
          <span className="property-field-label">{labels.easing}</span>
          <select
            className="h-8 w-full rounded-md bg-white px-2 text-xs text-slate-800"
            value={state.easing}
            onChange={(event) =>
              onChange({ easing: event.target.value as WebButtonMotionState['easing'] })
            }
          >
            <option value="ease">{motionText('Ease')}</option>
            <option value="linear">{motionText('Linear')}</option>
            <option value="ease-in">{motionText('EaseIn')}</option>
            <option value="ease-out">{motionText('EaseOut')}</option>
            <option value="ease-in-out">{motionText('EaseInOut')}</option>
          </select>
        </label>
      </div>
      <label className="block space-y-1">
        <span className="property-field-label">{labels.shadow}</span>
        <select
          className="h-8 w-full rounded-md bg-white px-2 text-xs text-slate-800"
          value={state.shadow}
          onChange={(event) =>
            onChange({ shadow: event.target.value as WebButtonMotionState['shadow'] })
          }
        >
          <option value="same">{motionText('Same')}</option>
          <option value="lift">{motionText('Lift')}</option>
          <option value="inset">{motionText('Inset')}</option>
          <option value="none">{motionText('None')}</option>
        </select>
      </label>
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
      <button
        type="button"
        onClick={onOpen}
        className="grid h-10 w-full min-w-0 grid-cols-[56px_minmax(0,1fr)] overflow-hidden rounded-xl bg-white text-left text-sm font-medium text-slate-950"
        title={label}
      >
        <span
          className="h-full bg-slate-100 bg-cover bg-center"
          style={
            imageUrl ? { backgroundImage: `url("${imageUrl.replace(/"/g, '\\"')}")` } : undefined
          }
          aria-hidden="true"
        >
          {!imageUrl && (
            <span className="grid h-full place-items-center text-slate-500">
              <ImageIcon className="h-4 w-4" />
            </span>
          )}
        </span>
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
        style={
          imageUrl ? { backgroundImage: `url("${imageUrl.replace(/"/g, '\\"')}")` } : undefined
        }
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
  element,
  onUpdate,
  language,
}: {
  element: WebMenuElement;
  onUpdate: (patch: Partial<WebMenuElement>) => void;
  language: Language;
  copy?: unknown;
}) {
  const base = element.borderRadius ?? 12;
  return (
    <CornerEditor
      language={language}
      value={[
        element.borderTopLeftRadius ?? base,
        element.borderTopRightRadius ?? base,
        element.borderBottomRightRadius ?? base,
        element.borderBottomLeftRadius ?? base,
      ]}
      onChange={([tl, tr, br, bl]) =>
        onUpdate({
          borderRadius: tl,
          borderTopLeftRadius: tl,
          borderTopRightRadius: tr,
          borderBottomRightRadius: br,
          borderBottomLeftRadius: bl,
        })
      }
    />
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

export function PortaledGradientPopover({
  children,
  language,
  onClose,
  closeLabel,
}: {
  children: React.ReactNode;
  language?: Language;
  onClose?: () => void;
  closeLabel?: string;
}) {
  return (
    <FloatingPopover
      language={language}
      popoverKey="gradient"
      onClose={onClose}
      closeLabel={closeLabel}
    >
      {children}
    </FloatingPopover>
  );
}

export { GradientEditorPopover, type GradientShape } from '../shared/paint/GradientEditorPopover';

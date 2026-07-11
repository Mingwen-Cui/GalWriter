import {
  Baseline,
  Blend,
  Box,
  CaseSensitive,
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
import { useState } from 'react';

import type { Language } from '../../../lib/i18n';
import { ImageFillPopover, SolidColorPopover } from '../video/objectInspector/ColorPopovers';
import { renderObjectText } from '../video/objectInspector/i18n';
import type { RenderColorStop, RenderFillType, WebMenuElement } from '../video/shared/types';
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
  showDescriptions: boolean;
  onUpdate: (patch: Partial<WebMenuElement>) => void;
};

type Popover = null | {
  group: 'text' | 'fill' | 'stroke' | 'shadow' | 'image';
  type: RenderFillType;
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

export function StartMenuElementInspector({
  element,
  language,
  surface = 'start',
  showDescriptions,
  onUpdate,
}: InspectorProps) {
  const text = renderObjectText(language);
  const [popover, setPopover] = useState<Popover>(null);
  const [radiusPopoverOpen, setRadiusPopoverOpen] = useState(false);
  const backgroundType = element.backgroundType || 'solid';
  const gradientStops = normalizeGradientStops(
    element.backgroundGradientStops,
    element.backgroundGradientStart || '#0ea5e9',
    element.backgroundGradientEnd || '#0f172a',
  );
  const hasTextControls = element.kind !== 'image';
  const hasFillControls = element.kind !== 'text';
  const strokeIsText = element.kind === 'text';
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
  const shadowHasValue = (element.shadowOpacity ?? 0) > 0;
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
    });
    onUpdate({
      shadowEnabled: !shadowEnabled,
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
    setPopover({ group: 'shadow', type: 'solid' });
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
          <p className="px-1 text-[11px] leading-5 text-slate-500">
            {language === 'zh'
              ? '选择点击后的行为；外观仍由下方样式分区控制。'
              : language === 'ja'
                ? 'クリック時の動作を選択します。見た目は下のスタイルで設定できます。'
                : 'Choose what happens on click. Appearance remains editable below.'}
          </p>
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
              />
            )}
            {backgroundType === 'gradient' && (
              <InlineGradientControl
                label={text.popover.gradientTitle}
                angle={element.backgroundGradientAngle ?? 135}
                stops={gradientStops}
                onOpen={() => setPopover({ group: 'fill', type: 'gradient' })}
              />
            )}
            {backgroundType === 'image' && (
              <InlineImageControl
                label={element.backgroundImageUrl ? text.popover.replace : text.popover.upload}
                imageUrl={element.backgroundImageUrl || ''}
                onImageChange={(backgroundImageUrl) =>
                  onUpdate({ backgroundImageUrl, backgroundType: 'image' })
                }
              />
            )}
            <button
              type="button"
              onClick={() => setPopover({ group: 'fill', type: backgroundType })}
              className="grid h-10 w-11 place-items-center rounded-xl bg-white text-slate-700 transition-colors hover:bg-sky-100 hover:text-slate-950"
              title={text.field.color}
              aria-label={text.field.color}
            >
              {backgroundType === 'image' ? (
                <ImageIcon className="h-4 w-4" />
              ) : backgroundType === 'gradient' ? (
                <GradientIcon />
              ) : (
                <Palette className="h-4 w-4" />
              )}
            </button>
          </div>
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
            <OutsideDismissPopover onClose={() => setPopover(null)}>
              <GradientEditorPopover
                language={language}
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
            </OutsideDismissPopover>
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
          <ControlRow className="mt-2">
            <HeaderSelect
              icon={<Blend className="h-4 w-4" />}
              label={text.field.blendMode}
              value={element.blendMode || 'normal'}
              options={BLEND_OPTIONS.map((value) => ({ label: value, value }))}
              onChange={(blendMode) => onUpdate({ blendMode })}
            />
            <div aria-hidden="true" />
          </ControlRow>
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
          {strokeIsText ? (
            <div aria-hidden="true" />
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
          {strokeType === 'gradient' && !strokeIsText ? (
            <InlineGradientControl
              label={text.popover.gradientTitle}
              angle={element.borderGradientAngle ?? 135}
              stops={borderGradientStops}
              onOpen={() => setPopover({ group: 'stroke', type: 'gradient' })}
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
            />
          )}
          <button
            type="button"
            onClick={() =>
              setPopover(
                popover?.group === 'stroke'
                  ? null
                  : { group: 'stroke', type: strokeType === 'gradient' ? 'gradient' : 'solid' },
              )
            }
            className="grid h-10 w-11 place-items-center rounded-xl bg-white text-slate-700 transition-colors hover:bg-indigo-100 hover:text-slate-950"
            title={text.field.color}
            aria-label={text.field.color}
          >
            {strokeType === 'gradient' && !strokeIsText ? <GradientIcon /> : <Palette className="h-4 w-4" />}
          </button>
        </div>
        {popover?.group === 'stroke' && popover.type === 'solid' && (
          <FloatingPopover>
            <SolidColorPopover
              tone="stroke"
              text={text.popover}
              color={strokeColor}
              alpha={100}
              onColorChange={(value) =>
                onUpdate(strokeIsText ? { textStrokeColor: value } : { borderColor: value })
              }
              onAlphaChange={() => undefined}
            />
          </FloatingPopover>
        )}
        {popover?.group === 'stroke' && popover.type === 'gradient' && !strokeIsText && (
          <OutsideDismissPopover onClose={() => setPopover(null)}>
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
          </OutsideDismissPopover>
        )}
      </Group>

      <Group
        title={text.group.shadow}
        icon={<Blend className="h-3.5 w-3.5" />}
        tone="shadow"
        onTitleClick={toggleShadow}
        titleActive={shadowEnabled}
        expandLabel={inspectorCopy.expand}
        collapseLabel={inspectorCopy.collapse}
        secondary={
          element.kind === 'text' ? (
            <HeaderAction
              icon={<Palette className="h-4 w-4" />}
              label={text.field.color}
              onClick={() =>
                setPopover(popover?.group === 'shadow' ? null : { group: 'shadow', type: 'solid' })
              }
            />
          ) : (
            <SegmentedIconControl
              value={shadowType}
              options={[
                { value: 'outer', label: inspectorCopy.outerShadow, icon: <ShadowModeIcon mode="outer" /> },
                { value: 'inner', label: inspectorCopy.innerShadow, icon: <ShadowModeIcon mode="inner" /> },
                { value: 'innerBlur', label: inspectorCopy.innerBlur, icon: <ShadowModeIcon mode="innerBlur" /> },
              ]}
              onChange={(shadowType) => onUpdate({ shadowType })}
            />
          )
        }
      >
        <ControlRow>
          <NumberField
            icon={<Blend className="h-4 w-4" />}
            label={text.field.opacity}
            description={showDescriptions ? text.field.opacity : undefined}
            value={element.shadowOpacity ?? 0}
            min={0}
            max={100}
            onChange={(shadowOpacity) => onUpdate({ shadowOpacity })}
          />
          <NumberField
            icon={<Radius className="h-4 w-4" />}
            label={text.field.blur}
            description={showDescriptions ? text.field.blur : undefined}
            value={element.shadowBlur ?? 18}
            min={0}
            max={80}
            onChange={(shadowBlur) => onUpdate({ shadowBlur })}
          />
        </ControlRow>
        <ControlRow className="mt-2">
          <NumberField
            icon={<MoveHorizontal className="h-4 w-4" />}
            label={text.field.x}
            value={element.shadowOffsetX ?? 0}
            min={-80}
            max={80}
            onChange={(shadowOffsetX) => onUpdate({ shadowOffsetX })}
          />
          <NumberField
            icon={<MoveVertical className="h-4 w-4" />}
            label={text.field.y}
            value={element.shadowOffsetY ?? (element.kind === 'text' ? 2 : 8)}
            min={-80}
            max={80}
            onChange={(shadowOffsetY) => onUpdate({ shadowOffsetY })}
          />
        </ControlRow>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_44px] gap-3">
          <InlineColorControl
            label={text.field.color}
            color={element.shadowColor || '#000000'}
            alpha={element.shadowOpacity ?? 0}
            alphaLabel={text.field.opacity}
            hexLabel={text.popover.hex}
            onColorChange={(shadowColor) => onUpdate({ shadowColor })}
            onAlphaChange={(shadowOpacity) => onUpdate({ shadowOpacity })}
          />
          <button
            type="button"
            onClick={() =>
              setPopover(popover?.group === 'shadow' ? null : { group: 'shadow', type: 'solid' })
            }
            className="grid h-10 w-11 place-items-center rounded-xl bg-white text-slate-700 transition-colors hover:bg-fuchsia-100 hover:text-slate-950"
            title={text.field.color}
            aria-label={text.field.color}
          >
            <Palette className="h-4 w-4" />
          </button>
        </div>
        {popover?.group === 'shadow' && (
          <FloatingPopover>
            <SolidColorPopover
              tone="shadow"
              text={text.popover}
              color={element.shadowColor || '#000000'}
              alpha={element.shadowOpacity ?? 0}
              onColorChange={(shadowColor) => onUpdate({ shadowColor })}
              onAlphaChange={(shadowOpacity) => onUpdate({ shadowOpacity })}
            />
          </FloatingPopover>
        )}
      </Group>

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
      <rect x="7" y="7" width="10" height="10" rx="2" />
      {mode === 'outer' && <path d="M17 17h2v2M19 15v4h-4" />}
      {mode === 'inner' && <path d="M10 10h4M10 14h4" />}
      {mode === 'innerBlur' && (
        <>
          <path d="M9 12h6" opacity="0.55" />
          <path d="M12 9v6" opacity="0.55" />
          <circle cx="12" cy="12" r="6" strokeDasharray="2 3" />
        </>
      )}
    </svg>
  );
}

function InlineColorControl({
  label,
  color,
  alpha,
  alphaLabel,
  hexLabel,
  onColorChange,
  onAlphaChange,
}: {
  label: string;
  color: string;
  alpha: number;
  alphaLabel: string;
  hexLabel: string;
  onColorChange: (value: string) => void;
  onAlphaChange?: (value: number) => void;
}) {
  const safeColor = /^#[0-9a-f]{6}$/i.test(color) ? color : '#000000';
  const safeAlpha = clampPercent(alpha);
  return (
    <div
      className="grid h-10 min-w-0 grid-cols-[44px_minmax(0,1fr)_72px] overflow-hidden rounded-xl bg-white"
      title={label}
    >
      <label className="relative block h-full cursor-pointer" aria-label={label}>
        <span className="absolute inset-0" style={{ backgroundColor: safeColor }} />
        <input
          type="color"
          value={safeColor}
          onChange={(event) => onColorChange(event.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
      <input
        value={color}
        aria-label={hexLabel}
        onChange={(event) => onColorChange(event.target.value)}
        className="h-full min-w-0 border-0 bg-white px-3 text-sm font-medium text-slate-950 outline-none"
      />
      <label
        className={`grid h-full grid-cols-[minmax(0,1fr)_18px] items-center border-l border-slate-100 bg-white px-2 ${
          onAlphaChange ? 'text-slate-950' : 'text-slate-400'
        }`}
        aria-label={alphaLabel}
      >
        <input
          type="number"
          min={0}
          max={100}
          value={safeAlpha}
          readOnly={!onAlphaChange}
          onChange={(event) =>
            onAlphaChange?.(clampPercent(Number(event.target.value) || 0))
          }
          className="h-full min-w-0 border-0 bg-transparent text-center text-sm font-medium outline-none"
        />
        <span className="text-sm text-slate-400">%</span>
      </label>
    </div>
  );
}

function InlineGradientControl({
  label,
  angle,
  stops,
  onOpen,
}: {
  label: string;
  angle: number;
  stops: RenderColorStop[];
  onOpen: () => void;
}) {
  const orderedStops = [...stops].sort((a, b) => a.position - b.position);
  const previewStops = orderedStops
    .map((stop) => `${alphaColor(stop.color, stop.alpha, '#ffffff')} ${stop.position}%`)
    .join(', ');
  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid h-10 min-w-0 grid-cols-[56px_minmax(0,1fr)_64px] overflow-hidden rounded-xl bg-white text-left text-sm font-medium text-slate-950"
      title={label}
      aria-label={label}
    >
      <span
        className="h-full"
        style={{ background: `linear-gradient(90deg, ${previewStops})` }}
        aria-hidden="true"
      />
      <span className="min-w-0 truncate px-3 leading-10">{label}</span>
      <span className="border-l border-slate-100 text-center leading-10 text-slate-500">
        {Math.round(angle)}deg
      </span>
    </button>
  );
}

function InlineImageControl({
  label,
  imageUrl,
  onImageChange,
}: {
  label: string;
  imageUrl: string;
  onImageChange: (value: string) => void;
}) {
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

function GradientEditorPopover({
  language,
  angle,
  stops,
  onAngleChange,
  onStopsChange,
}: {
  language: Language;
  angle: number;
  stops: RenderColorStop[];
  onAngleChange: (value: number) => void;
  onStopsChange: (value: RenderColorStop[]) => void;
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
          }
        : {
            angle: 'Angle',
            color: 'Color',
            position: 'Position',
            opacity: 'Opacity',
            addStop: 'Add stop',
            reverse: 'Reverse',
            deleteStop: 'Delete stop',
          };
  const orderedStops = [...stops].sort((a, b) => a.position - b.position);
  const [activeStopId, setActiveStopId] = useState(orderedStops[0]?.id || '');
  const activeStop = orderedStops.find((stop) => stop.id === activeStopId) || orderedStops[0];
  const previewStops = orderedStops
    .map((stop) => `${alphaColor(stop.color, stop.alpha, '#ffffff')} ${stop.position}%`)
    .join(', ');
  const trackPreview = `linear-gradient(90deg, ${previewStops})`;
  const commitStops = (nextStops: RenderColorStop[]) => {
    onStopsChange([...nextStops].sort((a, b) => a.position - b.position));
  };
  const updateStop = (id: string, updates: Partial<RenderColorStop>) => {
    commitStops(orderedStops.map((stop) => (stop.id === id ? { ...stop, ...updates } : stop)));
  };
  const addStopAt = (position: number) => {
    const newStop = {
      id: `stop-${Date.now().toString(36)}`,
      color: activeStop?.color || orderedStops.at(-1)?.color || '#ffffff',
      alpha: activeStop?.alpha ?? 100,
      position: clampPercent(position),
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
    <div className="rounded-2xl border border-sky-200 bg-sky-50/98 p-3 text-sky-950 shadow-2xl shadow-black/25 backdrop-blur-xl">
      <div className="grid grid-cols-[42px_minmax(0,1fr)_58px] items-center gap-2">
        <div className="text-[11px] font-black text-sky-900/70">{copy.angle}</div>
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
          className="h-9 rounded-lg border border-white/70 bg-white px-1 text-center text-xs font-bold outline-none"
        />
      </div>
      <div className="mt-2 grid grid-cols-5 gap-1.5">
        {[0, 45, 90, 135, 180].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onAngleChange(value)}
            className={`h-8 rounded-lg text-[11px] font-black ${
              angle === value ? 'bg-sky-600 text-white' : 'bg-white text-sky-900'
            }`}
          >
            {value}掳
          </button>
        ))}
      </div>
      <div
        className="relative mt-4 h-12 rounded-xl border border-white/80 shadow-inner"
        style={{ background: trackPreview }}
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
      {activeStop && (
        <div className="mt-3 grid gap-2">
          <div className="grid grid-cols-[44px_minmax(0,1fr)_38px] items-center gap-2">
          <input
            type="color"
            title={copy.color}
            value={activeStop.color}
            onChange={(event) => updateStop(activeStop.id, { color: event.target.value })}
          />
          <input
            value={activeStop.color}
            onChange={(event) => updateStop(activeStop.id, { color: event.target.value })}
            className="h-9 min-w-0 rounded-lg border border-white/70 bg-white px-2 text-xs outline-none"
          />
          <button
            type="button"
            disabled={orderedStops.length <= 2}
            onClick={() => removeStop(activeStop.id)}
            className="grid h-9 place-items-center rounded-lg bg-white text-rose-600 disabled:opacity-35"
            title={copy.deleteStop}
            aria-label={copy.deleteStop}
          >
            <Trash2 className="h-4 w-4" />
          </button>
          </div>
          <div className="grid grid-cols-[42px_minmax(0,1fr)_58px] items-center gap-2">
            <div className="text-[11px] font-black text-sky-900/70">{copy.position}</div>
            <input
              type="range"
              min={0}
              max={100}
              value={activeStop.position}
              onChange={(event) =>
                updateStop(activeStop.id, {
                  position: clampPercent(Number(event.target.value) || 0),
                })
              }
            />
            <input
              type="number"
              min={0}
              max={100}
              value={activeStop.position}
              onChange={(event) =>
                updateStop(activeStop.id, {
                  position: clampPercent(Number(event.target.value) || 0),
                })
              }
              className="h-8 rounded-lg border border-white/70 bg-white px-1 text-center text-xs outline-none"
            />
          </div>
        </div>
      )}
      {activeStop && (
        <div className="mt-2 grid grid-cols-[42px_minmax(0,1fr)_58px] items-center gap-2">
          <div className="text-[11px] font-black text-sky-900/70">{copy.opacity}</div>
          <input
            type="range"
            min={0}
            max={100}
            value={activeStop.alpha}
            onChange={(event) =>
              updateStop(activeStop.id, { alpha: clampPercent(Number(event.target.value) || 0) })
            }
          />
          <input
            type="number"
            min={0}
            max={100}
            value={activeStop.alpha}
            onChange={(event) =>
              updateStop(activeStop.id, { alpha: clampPercent(Number(event.target.value) || 0) })
            }
            className="h-8 rounded-lg border border-white/70 bg-white px-1 text-center text-xs outline-none"
          />
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => addStopAt(50)}
          className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white text-xs font-black"
        >
          <Plus className="h-3.5 w-3.5" />
          {copy.addStop}
        </button>
        <button
          type="button"
          onClick={() =>
            commitStops(
              orderedStops
                .map((stop) => ({ ...stop, position: 100 - stop.position }))
                .reverse(),
            )
          }
          className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white text-xs font-black"
        >
          <RotateCw className="h-3.5 w-3.5" />
          {copy.reverse}
        </button>
      </div>
    </div>
  );
}

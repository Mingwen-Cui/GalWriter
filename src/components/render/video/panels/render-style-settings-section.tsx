import {
  ALargeSmall,
  Baseline,
  BetweenHorizontalStart,
  BetweenVerticalStart,
  Blend,
  CaseSensitive,
  ChevronDown,
  Eye,
  EyeOff,
  ImagePlus,
  MoveHorizontal,
  MoveVertical,
  Palette,
  PanelLeftRightDashed,
  Radius,
  RectangleHorizontal,
  RectangleVertical,
  RotateCw,
  Sparkles,
  Timer,
  Trash2,
  Type,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { DragSizeControl } from '../controls/RenderControls';
import { TEXT_ANIMATION_OPTIONS } from '../shared/constants';
import { renderCopy } from '../shared/renderCopy';
import type { RenderStyle, TextAlign, TextAnimation, TypewriterMode } from '../shared/types';
import type { Language } from '../../../../lib/i18n';

const CLEAN_FONT_OPTIONS = [
  {
    label: '雅黑',
    value: '"Microsoft YaHei", "Noto Sans SC", Arial, sans-serif',
  },
  {
    label: '宋体',
    value: 'SimSun, "Noto Serif SC", serif',
  },
  {
    label: '黑体',
    value: 'SimHei, "Noto Sans SC", sans-serif',
  },
  {
    label: 'Arial',
    value: 'Arial, sans-serif',
  },
  {
    label: 'Serif',
    value: 'Georgia, "Times New Roman", serif',
  },
];

// FONT_OPTIONS: 可选的字体配置
const FONT_OPTIONS = [
  {
    label: '雅黑',
    value: '"Microsoft YaHei", "Noto Sans SC", Arial, sans-serif',
  },
  {
    label: '宋体',
    value: 'SimSun, "Noto Serif SC", serif',
  },
  {
    label: '黑体',
    value: 'SimHei, "Noto Sans SC", sans-serif',
  },
  {
    label: 'Arial',
    value: 'Arial, sans-serif',
  },
  {
    label: 'Serif',
    value: 'Georgia, "Times New Roman", serif',
  },
];

interface RenderStyleSettingsSectionProps {
  language: Language;
  renderStyle: RenderStyle;
  updateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
  resolutionWidth?: number;
  resolutionHeight?: number;
  showDescriptions?: boolean;
}

/**
 * 剧本渲染样式与对话框配置面板组件
 * 用于统一视频渲染设置与网页导出设置的文字与底框样式配置 UI
 */
export function RenderStyleSettingsSection({
  language,
  renderStyle,
  updateRenderStyle,
  resolutionWidth = 1920,
  resolutionHeight = 1080,
  showDescriptions = false,
}: RenderStyleSettingsSectionProps) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);

  const colorInputValue = (value: string, fallback = '#111827') => {
    const trimmed = value.trim();
    if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
    const rgba = trimmed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!rgba) return fallback;
    return `#${[rgba[1], rgba[2], rgba[3]]
      .map((channel) => Number(channel).toString(16).padStart(2, '0'))
      .join('')}`;
  };

  const withAlpha = (hex: string, alpha: number) => {
    const normalized = colorInputValue(hex);
    const red = Number.parseInt(normalized.slice(1, 3), 16);
    const green = Number.parseInt(normalized.slice(3, 5), 16);
    const blue = Number.parseInt(normalized.slice(5, 7), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  };

  const gradientStops =
    renderStyle.dialogGradientStops?.length >= 2
      ? [...renderStyle.dialogGradientStops].sort((a, b) => a.position - b.position)
      : [
          {
            id: 'start',
            color: colorInputValue(renderStyle.dialogGradientStartColor),
            alpha: 0,
            position: 0,
          },
          {
            id: 'end',
            color: colorInputValue(renderStyle.dialogGradientColor),
            alpha: 86,
            position: 100,
          },
        ];

  const getVisibleGradientRange = () => {
    const boxWidth = Math.max(
      1,
      resolutionWidth * Math.min(1, Math.max(0.35, renderStyle.dialogWidth / 100)),
    );
    const boxHeight = Math.max(
      1,
      resolutionHeight * Math.min(0.75, Math.max(0.16, renderStyle.dialogHeight / 100)),
    );
    const safeAngle = Number.isFinite(renderStyle.dialogGradientAngle)
      ? renderStyle.dialogGradientAngle
      : 90;
    const angle = ((safeAngle - 90) * Math.PI) / 180;
    const diagonal = Math.hypot(boxWidth, boxHeight);
    const visibleHalfRange =
      (Math.abs(Math.cos(angle)) * boxWidth + Math.abs(Math.sin(angle)) * boxHeight) /
      (2 * diagonal);
    const start = Math.min(1, Math.max(0, 0.5 - visibleHalfRange));
    const end = Math.min(1, Math.max(0, 0.5 + visibleHalfRange));
    return end - start < 0.001 ? { start: 0, end: 1 } : { start, end };
  };

  const visibleGradientRange = getVisibleGradientRange();

  const mapGradientStopToVisibleTrack = (position: number) =>
    Math.min(
      100,
      Math.max(
        0,
        ((position / 100 - visibleGradientRange.start) /
          (visibleGradientRange.end - visibleGradientRange.start)) *
          100,
      ),
    );

  const mapVisibleTrackToGradientStop = (position: number) =>
    Math.round(
      Math.min(
        100,
        Math.max(
          0,
          (visibleGradientRange.start +
            (position / 100) * (visibleGradientRange.end - visibleGradientRange.start)) *
            100,
        ),
      ),
    );

  const visibleGradientCssStops = gradientStops
    .map((stop) => {
      const visiblePosition =
        ((stop.position / 100 - visibleGradientRange.start) /
          (visibleGradientRange.end - visibleGradientRange.start)) *
        100;
      return `${withAlpha(stop.color, stop.alpha / 100)} ${visiblePosition}%`;
    })
    .join(', ');

  const [activeGradientStopId, setActiveGradientStopId] = useState<string | null>(null);
  const [openSelectId, setOpenSelectId] = useState<string | null>(null);
  const gradientEditorRef = useRef<HTMLDivElement | null>(null);
  const [showSolidColorMenu, setShowSolidColorMenu] = useState(false);
  const solidColorEditorRef = useRef<HTMLDivElement | null>(null);

  const activeGradientStop = activeGradientStopId
    ? gradientStops.find((stop) => stop.id === activeGradientStopId)
    : null;

  useEffect(() => {
    if (!activeGradientStopId) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!gradientEditorRef.current?.contains(event.target as Node)) {
        setActiveGradientStopId(null);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [activeGradientStopId]);

  useEffect(() => {
    if (!showSolidColorMenu) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!solidColorEditorRef.current?.contains(event.target as Node)) {
        setShowSolidColorMenu(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [showSolidColorMenu]);

  const updateGradientStops = (
    updater: (
      stops: Array<{ id: string; color: string; alpha: number; position: number }>,
    ) => Array<{ id: string; color: string; alpha: number; position: number }>,
  ) => {
    const nextStops = updater(gradientStops).sort((a, b) => a.position - b.position);
    updateRenderStyle('dialogGradientStops', nextStops);
  };

  const removeGradientStop = (targetId = activeGradientStopId) => {
    updateGradientStops((stops) => {
      if (stops.length <= 2) return stops;
      const idToRemove = targetId || stops[stops.length - 1]?.id;
      const nextStops = stops.filter((stop) => stop.id !== idToRemove);
      setActiveGradientStopId(nextStops[0]?.id || null);
      return nextStops;
    });
  };

  const getGradientPointerPosition = (
    event: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>,
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const trackPosition = Math.min(
      100,
      Math.max(0, ((event.clientX - rect.left) / rect.width) * 100),
    );
    return mapVisibleTrackToGradientStop(trackPosition);
  };

  const addGradientStopAt = (position: number) => {
    const previousStop =
      [...gradientStops].reverse().find((stop) => stop.position <= position) || gradientStops[0];
    const nextStop = gradientStops.find((stop) => stop.position >= position) || previousStop;
    const nextId = `stop-${Date.now().toString(36)}`;
    updateGradientStops((stops) => [
      ...stops,
      {
        id: nextId,
        color: nextStop?.color || previousStop?.color || '#111827',
        alpha: Math.round(((previousStop?.alpha ?? 86) + (nextStop?.alpha ?? 86)) / 2),
        position,
      },
    ]);
    setActiveGradientStopId(nextId);
  };

  const setStyle = <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) =>
    updateRenderStyle(key, value);

  const iconShell = (
    Icon: LucideIcon,
    children: React.ReactNode,
    disabled = false,
    description?: string,
  ) => (
    <div className={`space-y-1 ${disabled ? 'opacity-40' : ''}`}>
      {showDescriptions && description && (
        <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">{description}</div>
      )}
      <div className="grid h-9 grid-cols-[28px_minmax(0,1fr)] items-stretch rounded-lg bg-[var(--vr-surface-soft)]">
        <span className="flex h-full items-center justify-center text-[var(--vr-text-muted)]">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );

  const iconSelect = (
    Icon: LucideIcon,
    id: string,
    value: string,
    onChange: (value: string) => void,
    options: Array<{ value: string; label: string }>,
    title: string,
    description?: string,
    disabled = false,
  ) => {
    const selectedLabel = options.find((option) => option.value === value)?.label || '';
    const isOpen = openSelectId === id && !disabled;
    return iconShell(
      Icon,
      <div
        className="relative min-w-0"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setOpenSelectId((current) => (current === id ? null : current));
          }
        }}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpenSelectId(isOpen ? null : id)}
          className={`flex w-full min-w-0 items-center justify-end gap-1.5 rounded-r-lg bg-transparent px-2 text-right text-xs font-normal text-[var(--vr-text)] outline-none transition-colors hover:bg-white/5 disabled:cursor-default ${
            showDescriptions ? 'h-8' : 'h-9'
          }`}
          title={title}
        >
          <span className="min-w-0 truncate">{selectedLabel}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-[var(--vr-text-muted)] transition-transform ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
        {isOpen && (
          <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-full overflow-hidden rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface)] p-1 shadow-2xl shadow-black/20">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setOpenSelectId(null);
                }}
                className={`flex h-8 w-full items-center justify-end rounded-lg px-2 text-right text-xs font-normal transition-colors ${
                  option.value === value
                    ? 'bg-[var(--vr-accent)] text-white'
                    : 'text-[var(--vr-text)] hover:bg-[var(--vr-surface-soft)]'
                }`}
              >
                <span className="min-w-0 truncate">{option.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>,
      disabled,
      description,
    );
  };

  const iconNumber = (Icon: LucideIcon, control: React.ReactNode, description: string) =>
    iconShell(Icon, <div className="min-w-0">{control}</div>, false, description);

  const iconColor = (
    Icon: LucideIcon,
    value: string,
    onChange: (value: string) => void,
    title: string,
    description?: string,
  ) =>
    iconShell(
      Icon,
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="video-render-color-input h-9 w-full cursor-pointer rounded-r-lg border-0 bg-transparent p-0"
        title={title}
      />,
      false,
      description || title,
    );

  const renderTextStyleSection = (
    kind: 'title' | 'body',
    label: string,
    toneClass: string,
    canToggle: boolean,
  ) => {
    const isTitle = kind === 'title';
    const visibleKey = `${kind}Visible` as keyof RenderStyle;
    const visible = isTitle ? renderStyle.titleVisible : true;
    const fontSizeKey = `${kind}FontSize` as keyof RenderStyle;
    const fontFamilyKey = `${kind}FontFamily` as keyof RenderStyle;
    const animationKey = `${kind}Animation` as keyof RenderStyle;
    const leadKey = `${kind}AnimationLeadSeconds` as keyof RenderStyle;
    const typewriterKey = `${kind}TypewriterMode` as keyof RenderStyle;
    const colorKey = `${kind}Color` as keyof RenderStyle;
    const colorAlphaKey = `${kind}ColorAlpha` as keyof RenderStyle;
    const strokeWidthKey = `${kind}StrokeWidth` as keyof RenderStyle;
    const alignKey = `${kind}Align` as keyof RenderStyle;
    const spacingKey = `${kind}LetterSpacing` as keyof RenderStyle;
    const lineHeightKey = `${kind}LineHeight` as keyof RenderStyle;
    const animation = renderStyle[animationKey] as TextAnimation;
    const isTypewriter = animation === 'typewriter';
    const align = renderStyle[alignKey] as TextAlign;
    const typewriterMode = renderStyle[typewriterKey] as TypewriterMode;
    const normalizedTypewriterMode = typewriterMode === 'word' ? 'sentence' : typewriterMode;
    const characterModeLabel = t('逐字', '一文字ずつ', 'Character');
    const sentenceModeLabel = t('逐句', '一文ずつ', 'Sentence');
    const lineModeLabel = t('逐行', '一行ずつ', 'Line');

    return (
      <div className={`space-y-2 rounded-xl p-2 ${toneClass}`}>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            {showDescriptions && (
              <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">
                {isTitle ? t('标题隐藏', 'タイトルを非表示', 'Title hidden') : t('正文无法隐藏', '本文は非表示不可', 'Body cannot be hidden')}
              </div>
            )}
              <button
                type="button"
                onClick={() => {
                  if (canToggle) setStyle(visibleKey, !visible as never);
                }}
              className={`flex h-9 w-full items-center justify-start gap-1 rounded-lg px-2 text-left text-[11px] font-normal ${
                isTitle
                  ? 'bg-[#1d4ed8] text-white'
                  : visible
                    ? 'bg-white/12 text-[var(--vr-text)]'
                    : 'bg-[var(--vr-surface-soft)] text-[var(--vr-text-muted)]'
              } ${canToggle ? '' : 'cursor-default'}`}
              aria-label={label}
            >
              {canToggle &&
                (visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />)}
              {label}
            </button>
          </div>
          {iconSelect(
            Type,
            `${kind}-font`,
            renderStyle[fontFamilyKey] as string,
            (value) => setStyle(fontFamilyKey, value as never),
            CLEAN_FONT_OPTIONS,
            t('字体', 'フォント', 'Font'),
            t('选择字体', 'フォントを選択', 'Choose font'),
          )}
          {iconNumber(
            ALargeSmall,
            <DragSizeControl
              label={t('拖动调整字号', 'サイズを調整', 'Adjust font size')}
              value={renderStyle[fontSizeKey] as number}
              min={isTitle ? 18 : 16}
              max={isTitle ? 120 : 96}
              step={1}
              onChange={(value) => setStyle(fontSizeKey, value as never)}
            />,
            t('字体大小', 'フォントサイズ', 'Font size'),
          )}
          </div>
          <div className="grid grid-cols-3 gap-2">
          {iconSelect(
            Sparkles,
            `${kind}-animation`,
            animation,
            (value) => setStyle(animationKey, value as TextAnimation as never),
            TEXT_ANIMATION_OPTIONS.map((option) => ({
              value: option.value,
              label: renderCopy(language, option.zh, option.ja, option.en),
            })),
            t('动画', 'アニメ', 'Animation'),
            t('选择文字动画', '文字アニメを選択', 'Choose text animation'),
          )}
          {iconNumber(
            Timer,
            <DragSizeControl
              label={t('拖动调整提前完成时间', '早めに完了する時間を调整', 'Adjust finish-early time')}
              value={renderStyle[leadKey] as number}
              min={0}
              max={30}
              step={0.1}
              unit="s"
              onChange={(value) => setStyle(leadKey, value as never)}
            />,
            t('动画提前完成时间', 'アニメーション先行完了時間', 'Finish-early time'),
          )}
          {iconSelect(
            CaseSensitive,
            `${kind}-typewriter`,
            normalizedTypewriterMode,
            (value) => setStyle(typewriterKey, value as TypewriterMode as never),
            [
              { value: 'character', label: characterModeLabel },
              { value: 'sentence', label: sentenceModeLabel },
              { value: 'line', label: lineModeLabel },
            ],
            t('打字粒度', 'タイプ単位', 'Typewriter unit'),
            t('选择打字粒度', 'タイプ単位を選択', 'Choose typewriter unit'),
            !isTypewriter,
          )}
          </div>
          <div className="grid grid-cols-3 gap-2">
          {iconColor(
            Palette,
            colorInputValue(renderStyle[colorKey] as string),
            (value) => setStyle(colorKey, value as never),
            t('文字颜色', '文字色', 'Text color'),
            t('选择文字颜色', '文字色を選択', 'Choose text color'),
          )}
          {iconNumber(
            Blend,
            <DragSizeControl
              label={t('拖动调整文字透明度', '文字透明度を調整', 'Adjust text alpha')}
              value={renderStyle[colorAlphaKey] as number}
              min={0}
              max={100}
              step={1}
              unit="%"
              onChange={(value) => setStyle(colorAlphaKey, value as never)}
            />,
            t('文字透明度', '文字の透明度', 'Text alpha'),
          )}
          {iconNumber(
            Baseline,
            <DragSizeControl
              label={t('拖动调整描边宽度', '縁取り幅を調整', 'Adjust stroke width')}
              value={renderStyle[strokeWidthKey] as number}
              min={0}
              max={16}
              step={0.5}
              onChange={(value) => setStyle(strokeWidthKey, value as never)}
            />,
            t('描边宽度', '縁取り幅', 'Stroke width'),
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            {showDescriptions && (
              <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">
                {t('文字对齐', '文字揃え', 'Text align')}
              </div>
            )}
            <div className="grid grid-cols-3 overflow-hidden rounded-lg bg-[var(--vr-surface-soft)]">
              {(['left', 'center', 'right'] as TextAlign[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStyle(alignKey, value as never)}
                  className={`h-9 text-xs font-normal ${
                    align === value ? 'bg-[var(--vr-accent)] text-white' : 'text-[var(--vr-text-soft)]'
                  }`}
                >
                  {value === 'left' ? t('左', '左', 'L') : value === 'center' ? t('中', '中央', 'C') : t('右', '右', 'R')}
                </button>
              ))}
            </div>
          </div>
          {iconNumber(
            BetweenHorizontalStart,
            <DragSizeControl
              label={t('拖动调整字间距', '文字間隔を調整', 'Adjust spacing')}
              value={renderStyle[spacingKey] as number}
              min={-4}
              max={24}
              step={0.5}
              onChange={(value) => setStyle(spacingKey, value as never)}
            />,
            t('字间距', '文字間隔', 'Letter spacing'),
          )}
          {iconNumber(
            BetweenVerticalStart,
            <DragSizeControl
              label={t('拖动调整行距', '行間を調整', 'Adjust line height')}
              value={renderStyle[lineHeightKey] as number}
              min={0.8}
              max={2.4}
              step={0.05}
              unit="x"
              onChange={(value) => setStyle(lineHeightKey, value as never)}
            />,
            t('行距', '行間', 'Line height'),
          )}
          </div>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {renderTextStyleSection('title', t('标题', 'タイトル', 'Title'), 'bg-indigo-500/5', true)}
      {renderTextStyleSection('body', t('正文', '本文', 'Body'), 'bg-blue-500/5', false)}

      <div className="space-y-2 rounded-xl bg-violet-500/5 p-2">
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            {showDescriptions && (
              <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">
                {t('文字框背景隐藏', 'テキスト枠背景を非表示', 'Hide text box background')}
              </div>
            )}
            <button
              type="button"
              onClick={() => updateRenderStyle('dialogVisible', !renderStyle.dialogVisible)}
              className={`flex h-9 w-full items-center justify-start gap-1 rounded-lg px-2 text-left text-[11px] font-normal ${
                renderStyle.dialogVisible
                  ? 'bg-violet-500/15 text-violet-500'
                  : 'bg-[var(--vr-surface-soft)] text-[var(--vr-text-muted)]'
              }`}
              title={t('点击显示或隐藏文字框背景', 'テキスト枠背景の表示を切替', 'Show or hide text box background')}
            >
              {renderStyle.dialogVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {t('背景', '背景', 'Background')}
            </button>
          </div>
          {iconNumber(
            RectangleHorizontal,
            <DragSizeControl
              label={t('拖动调整对话框宽度', 'ダイアログ幅を調整', 'Adjust dialogue width')}
              value={renderStyle.dialogWidth}
              min={35}
              max={100}
              step={1}
              unit="%"
              onChange={(value) => updateRenderStyle('dialogWidth', value)}
            />,
            t('对话框宽度', 'ダイアログ幅', 'Dialogue width'),
          )}
          {iconNumber(
            RectangleVertical,
            <DragSizeControl
              label={t('拖动调整对话框高度', 'ダイアログ高さを調整', 'Adjust dialogue height')}
              value={renderStyle.dialogHeight}
              min={16}
              max={75}
              step={1}
              unit="%"
              onChange={(value) => updateRenderStyle('dialogHeight', value)}
            />,
            t('对话框高度', 'ダイアログ高さ', 'Dialogue height'),
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {iconNumber(
            MoveHorizontal,
            <DragSizeControl
              label={t('拖动调整对话框左右位置', '左右位置を調整', 'Adjust horizontal position')}
              value={renderStyle.dialogOffsetX ?? 0}
              min={-100}
              max={100}
              step={1}
              unit="%"
              onChange={(value) => updateRenderStyle('dialogOffsetX', value)}
            />,
            t('左右位置', '左右位置', 'Horizontal position'),
          )}
          {iconNumber(
            MoveVertical,
            <DragSizeControl
              label={t('拖动调整对话框上下位置', '上下位置を調整', 'Adjust vertical position')}
              value={renderStyle.dialogOffsetY ?? 0}
              min={-100}
              max={100}
              step={1}
              unit="%"
              onChange={(value) => updateRenderStyle('dialogOffsetY', value)}
            />,
            t('上下位置', '上下位置', 'Vertical position'),
          )}
          {iconNumber(
            PanelLeftRightDashed,
            <DragSizeControl
              label={t('拖动调整文字左右内间距', '文字の左右余白を調整', 'Adjust text side padding')}
              value={renderStyle.dialogTextPaddingX ?? 9}
              min={2}
              max={24}
              step={1}
              unit="%"
              onChange={(value) => updateRenderStyle('dialogTextPaddingX', value)}
            />,
            t('文本左右内边距', 'テキスト左右内側余白', 'Text side padding'),
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {iconNumber(
            Radius,
            <DragSizeControl
              label={t('拖动调整对话框圆角', '角丸を調整', 'Adjust corner radius')}
              value={renderStyle.dialogRadius}
              min={0}
              max={120}
              step={1}
              onChange={(value) => updateRenderStyle('dialogRadius', value)}
            />,
            t('对话框圆角', 'ダイアログ角丸', 'Dialogue radius'),
          )}
          {iconSelect(
            Palette,
            'dialog-background-type',
            renderStyle.dialogBackgroundType,
            (value) => updateRenderStyle('dialogBackgroundType', value as RenderStyle['dialogBackgroundType']),
            [
              { value: 'solid', label: t('纯色', '単色', 'Solid') },
              {
                value: 'gradient',
                label: t('透明渐变', '透明グラデーション', 'Transparent gradient'),
              },
              { value: 'image', label: t('导入图片', '画像', 'Image') },
            ],
            t('底色类型', '背景タイプ', 'Background'),
            t('对话框底色', 'ダイアログ背景', 'Dialogue background'),
          )}
          {renderStyle.dialogBackgroundType === 'solid' && (
            <div className="relative" ref={solidColorEditorRef}>
              {iconShell(
                Palette,
                <button
                  type="button"
                  onClick={() => setShowSolidColorMenu(!showSolidColorMenu)}
                  className="h-full w-full cursor-pointer rounded-r-lg border-0 p-1 bg-transparent flex items-stretch"
                  title={t('颜色', '色', 'Color')}
                >
                  <div
                    className="flex-1 rounded-md border border-white/10"
                    style={{
                      backgroundColor: withAlpha(
                        renderStyle.panelColor,
                        (renderStyle.panelColorAlpha ?? 82) / 100,
                      ),
                    }}
                  />
                </button>
                ,
                false,
                t('对话框底色', 'ダイアログ背景色', 'Dialogue background'),
              )}
              {showSolidColorMenu && (
                <div
                  className="absolute right-0 top-[calc(100%+6px)] z-50 rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface)] p-3 shadow-2xl shadow-black/30"
                  style={{ width: '210px' }}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div className="space-y-3">
                    <div
                      className="relative h-8 w-full rounded-lg border border-[var(--vr-border)] overflow-hidden"
                      style={{
                        background: `
                          linear-gradient(45deg, rgba(0,0,0,0.08) 25%, transparent 25%),
                          linear-gradient(-45deg, rgba(0,0,0,0.08) 25%, transparent 25%),
                          linear-gradient(45deg, transparent 75%, rgba(0,0,0,0.08) 75%),
                          linear-gradient(-45deg, transparent 75%, rgba(0,0,0,0.08) 75%)
                        `,
                        backgroundSize: '8px 8px',
                        backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
                      }}
                    >
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundColor: withAlpha(
                            renderStyle.panelColor,
                            (renderStyle.panelColorAlpha ?? 82) / 100,
                          ),
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-[36px_1fr] gap-2 items-center">
                      <input
                        type="color"
                        value={colorInputValue(renderStyle.panelColor)}
                        onPointerDown={(e) => e.stopPropagation()}
                        onChange={(event) => updateRenderStyle('panelColor', event.target.value)}
                        className="h-8 w-full cursor-pointer rounded-lg border-0 bg-transparent p-0"
                      />
                      <input
                        type="text"
                        value={renderStyle.panelColor}
                        onPointerDown={(e) => e.stopPropagation()}
                        onChange={(event) => updateRenderStyle('panelColor', event.target.value)}
                        className="h-8 w-full rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-2 text-xs text-[var(--vr-text)] outline-none focus:border-[var(--vr-accent)]"
                        placeholder="#111827"
                      />
                    </div>

                    <div className="grid grid-cols-[1fr_52px] gap-2 items-center">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={renderStyle.panelColorAlpha ?? 82}
                        onPointerDown={(e) => e.stopPropagation()}
                        onChange={(event) =>
                          updateRenderStyle('panelColorAlpha', Number(event.target.value))
                        }
                        className="w-full h-1.5 accent-[var(--vr-accent)] rounded-lg appearance-none cursor-pointer bg-[var(--vr-surface-soft)]"
                        style={{
                          background: `linear-gradient(to right, transparent, ${colorInputValue(
                            renderStyle.panelColor,
                          )})`,
                        }}
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={renderStyle.panelColorAlpha ?? 82}
                        onPointerDown={(e) => e.stopPropagation()}
                        onChange={(event) => {
                          const val = Math.min(100, Math.max(0, Number(event.target.value) || 0));
                          updateRenderStyle('panelColorAlpha', val);
                        }}
                        className="h-8 w-full rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-1 text-center text-xs text-[var(--vr-text)] outline-none focus:border-[var(--vr-accent)]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {renderStyle.dialogBackgroundType === 'gradient' &&
            iconNumber(
              RotateCw,
              <DragSizeControl
                label={t('拖动调整渐变角度', 'グラデーション角度を調整', 'Adjust gradient angle')}
                value={renderStyle.dialogGradientAngle}
                min={0}
                max={360}
                step={1}
                unit="°"
                onChange={(value) => updateRenderStyle('dialogGradientAngle', value)}
              />,
              t('渐变角度', 'グラデーション角度', 'Gradient angle'),
            )}
          {renderStyle.dialogBackgroundType === 'image' && (
            <div className="space-y-1">
              {showDescriptions && (
                <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">
                  {t('导入或替换对话框背景图片', 'ダイアログ背景画像を追加/差し替え', 'Import or replace dialogue background image')}
                </div>
              )}
              <div
                className={`grid h-9 items-center rounded-lg bg-[var(--vr-surface-soft)] ${
                  renderStyle.dialogImageUrl ? 'grid-cols-[28px_1fr_1fr]' : 'grid-cols-[28px_minmax(0,1fr)]'
                }`}
              >
                <span className="flex h-full items-center justify-center text-[var(--vr-text-muted)]">
                  <ImagePlus className="h-3.5 w-3.5" />
                </span>
                <label
                  className="flex h-9 min-w-0 cursor-pointer items-center justify-center rounded-r-lg px-2 text-[var(--vr-text-soft)] transition-colors hover:bg-white/5"
                  title={renderStyle.dialogImageUrl ? t('更换图片', '画像を变更', 'Replace image') : t('导入图片', '画像を選択', 'Import image')}
                  aria-label={renderStyle.dialogImageUrl ? t('更换图片', '画像を变更', 'Replace image') : t('导入图片', '画像を選択', 'Import image')}
                >
                  {renderStyle.dialogImageUrl ? <RotateCw className="h-3.5 w-3.5" /> : <ImagePlus className="h-3.5 w-3.5" />}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        updateRenderStyle('dialogImageUrl', String(reader.result || ''));
                        updateRenderStyle('dialogBackgroundType', 'image');
                      };
                      reader.readAsDataURL(file);
                      event.target.value = '';
                    }}
                  />
                </label>
                {renderStyle.dialogImageUrl && (
                  <button
                    type="button"
                    onClick={() => updateRenderStyle('dialogImageUrl', '')}
                    className="flex h-9 items-center justify-center rounded-r-lg px-2 text-[var(--vr-text-soft)] transition-colors hover:bg-rose-500/10 hover:text-rose-400"
                    title={t('删除图片', '画像を削除', 'Remove image')}
                    aria-label={t('删除图片', '画像を削除', 'Remove image')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        {renderStyle.dialogBackgroundType === 'gradient' && (
          <div ref={gradientEditorRef} className="space-y-2">
            <div className="grid grid-cols-[32px_minmax(0,1fr)_32px] items-center gap-2">
              <button
                type="button"
                disabled={gradientStops.length <= 2}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  removeGradientStop();
                }}
                className="h-8 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] text-sm font-bold text-[var(--vr-text-soft)] hover:bg-[var(--vr-accent-soft)]"
                title={t('删除一个色标', '色標を削除', 'Remove a color stop')}
              >
                -
              </button>
              <div
                className="relative h-10 rounded-lg"
                style={{
                  background: `linear-gradient(90deg, ${visibleGradientCssStops})`,
                }}
                onPointerDown={(event) => {
                  if ((event.target as HTMLElement).dataset.gradientStopId) return;
                  addGradientStopAt(getGradientPointerPosition(event));
                }}
              >
                {gradientStops.map((stop) => (
                  <button
                    key={stop.id}
                    type="button"
                    data-gradient-stop-id={stop.id}
                    className={`absolute top-1/2 h-6 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border shadow ${
                      activeGradientStop?.id === stop.id
                        ? 'border-white ring-2 ring-[var(--vr-accent)]'
                        : 'border-white/80'
                    }`}
                    style={{
                      left: `${mapGradientStopToVisibleTrack(stop.position)}%`,
                      backgroundColor: withAlpha(stop.color, stop.alpha / 100),
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveGradientStopId(stop.id);
                    }}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      setActiveGradientStopId(stop.id);
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
                        return;
                      }
                      const track = event.currentTarget.parentElement;
                      if (!track) return;
                      const rect = track.getBoundingClientRect();
                      const trackPosition = Math.min(
                        100,
                        Math.max(0, ((event.clientX - rect.left) / rect.width) * 100),
                      );
                      const position = mapVisibleTrackToGradientStop(trackPosition);
                      updateGradientStops((stops) =>
                        stops.map((item) => (item.id === stop.id ? { ...item, position } : item)),
                      );
                    }}
                    onPointerUp={(event) => {
                      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                        event.currentTarget.releasePointerCapture(event.pointerId);
                      }
                    }}
                    aria-label={t('渐变色标', 'グラデーション色標', 'Gradient stop')}
                  />
                ))}
                {activeGradientStop && (
                  <div
                    className="absolute top-[calc(100%+6px)] z-50 rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface)] p-2 shadow-lg"
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                    style={{
                      left: `max(8px, min(calc(${mapGradientStopToVisibleTrack(
                        activeGradientStop.position,
                      )}% - 105px), calc(100% - 218px)))`,
                      width: '210px',
                      maxWidth: 'calc(100% - 16px)',
                    }}
                  >
                    <div
                      className="absolute -top-1 h-2 w-2 rotate-45 border-l border-t border-[var(--vr-border)] bg-[var(--vr-surface)]"
                      style={{
                        left: `calc(${mapGradientStopToVisibleTrack(
                          activeGradientStop.position,
                        )}% - max(8px, min(calc(${mapGradientStopToVisibleTrack(
                          activeGradientStop.position,
                        )}% - 105px), calc(100% - 218px))))`,
                      }}
                    />
                    <div className="grid grid-cols-[42px_1fr_28px] items-center gap-2">
                      <input
                        type="color"
                        value={colorInputValue(activeGradientStop.color)}
                        onPointerDown={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          updateGradientStops((stops) =>
                            stops.map((item) =>
                              item.id === activeGradientStop.id ? { ...item, color: event.target.value } : item,
                            ),
                          )
                        }
                        className="h-8 w-full cursor-pointer rounded-lg border-0 bg-transparent p-0"
                      />
                      <DragSizeControl
                        label={t('拖动调整透明度', '透明度を調整', 'Adjust alpha')}
                        value={activeGradientStop.alpha}
                        min={0}
                        max={100}
                        step={1}
                        unit="%"
                        onChange={(value) =>
                          updateGradientStops((stops) =>
                            stops.map((item) =>
                              item.id === activeGradientStop.id ? { ...item, alpha: value } : item,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        disabled={gradientStops.length <= 2}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          removeGradientStop(activeGradientStop.id);
                        }}
                        className="h-8 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] text-sm font-bold text-[var(--vr-text-muted)] disabled:opacity-30"
                      >
                        -
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  addGradientStopAt(Math.min(100, Math.max(0, (activeGradientStop?.position ?? 50) + 10)))
                }
                className="h-8 rounded-lg bg-[var(--vr-surface-soft)] text-sm font-normal text-[var(--vr-text-soft)] hover:bg-[var(--vr-accent-soft)]"
                title={t('添加色标', '色標を追加', 'Add a color stop')}
              >
                +
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

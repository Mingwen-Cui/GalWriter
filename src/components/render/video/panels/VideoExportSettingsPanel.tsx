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
  FileVideo,
  Film,
  FolderOpen,
  Gauge,
  ImagePlus,
  Loader2,
  Mic,
  Monitor,
  MoveHorizontal,
  MoveVertical,
  Music,
  Palette,
  PanelLeftRightDashed,
  PencilLine,
  Radius,
  RectangleHorizontal,
  RectangleVertical,
  RotateCw,
  Settings,
  Sparkles,
  Timer,
  Trash2,
  Type,
  Video,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { DragSizeControl, RangeControl } from '../controls/RenderControls';
import {
  EXPORT_FORMAT_OPTIONS,
  FRAME_RATE_OPTIONS,
  RESOLUTION_OPTIONS,
  TEXT_ANIMATION_OPTIONS,
} from '../shared/constants';
import { renderCopy } from '../shared/renderCopy';
import type {
  ExportFormat,
  ExportSettingsMode,
  RenderStatus,
  RenderStyle,
  TextAlign,
  TextAnimation,
  TypewriterMode,
} from '../shared/types';
import type { Language } from '../../../../lib/i18n';

type VideoExportSettingsPanelProps = {
  language: Language;
  exportPanelWidth: number;
  exportSettingsMode: ExportSettingsMode;
  setExportSettingsMode: (value: ExportSettingsMode) => void;
  status: RenderStatus;
  exportFormat: ExportFormat;
  setExportFormat: (value: ExportFormat) => void;
  resolutionIndex: number;
  setResolutionIndex: (value: number) => void;
  resolutionWidth: number;
  setResolutionWidth: (value: number) => void;
  resolutionHeight: number;
  setResolutionHeight: (value: number) => void;
  frameRate: number;
  setFrameRate: (value: number) => void;
  outputDir: string;
  setOutputDir: (value: string) => void;
  outputDirError: string;
  setOutputDirError: (value: string) => void;
  chooseOutputDir: () => void;
  renderStyle: RenderStyle;
  updateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
  defaultSeconds: number;
  setDefaultSeconds: (value: number) => void;
  speed: number;
  setSpeed: (value: number) => void;
  animationLeadSeconds: number;
  setAnimationLeadSeconds: (value: number) => void;
  selectedSpeechNodeCount: number;
  selectedAudioClipCount: number;
  selectedAudioVolume?: number;
  selectedAudioFadeIn?: number;
  selectedAudioFadeOut?: number;
  updateSelectedAudioSettings: (key: 'volume' | 'fadeIn' | 'fadeOut', value: number) => void;
  audioBusy: boolean;
  audioMessage: string;
  isRecordingVoiceover: boolean;
  generateAudioFromSelectedText: () => void;
  startVoiceoverRecording: () => void;
  stopVoiceoverRecording: () => void;
  assetUploadInputRef: React.RefObject<HTMLInputElement | null>;
  progress: string;
  error: string;
  progressValue: number;
  savedPath: string;
  useGpuAcceleration: boolean;
  setUseGpuAcceleration: (value: boolean) => void;
  isWebGPUSupported: boolean;
  hideCharacterTags: boolean;
  setHideCharacterTags: (value: boolean) => void;
  hideSceneTags: boolean;
  setHideSceneTags: (value: boolean) => void;
};

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

export function VideoExportSettingsPanel({
  language,
  exportPanelWidth,
  exportSettingsMode,
  setExportSettingsMode,
  status,
  exportFormat,
  setExportFormat,
  resolutionIndex,
  setResolutionIndex,
  resolutionWidth,
  setResolutionWidth,
  resolutionHeight,
  setResolutionHeight,
  frameRate,
  setFrameRate,
  outputDir,
  setOutputDir,
  outputDirError,
  setOutputDirError,
  chooseOutputDir,
  renderStyle,
  updateRenderStyle,
  defaultSeconds,
  setDefaultSeconds,
  speed,
  setSpeed,
  animationLeadSeconds,
  setAnimationLeadSeconds,
  selectedSpeechNodeCount,
  selectedAudioClipCount,
  selectedAudioVolume = 0,
  selectedAudioFadeIn = 0,
  selectedAudioFadeOut = 0,
  updateSelectedAudioSettings,
  audioBusy,
  audioMessage,
  isRecordingVoiceover,
  generateAudioFromSelectedText,
  startVoiceoverRecording,
  stopVoiceoverRecording,
  assetUploadInputRef,
  progress,
  error,
  progressValue,
  savedPath,
  useGpuAcceleration,
  setUseGpuAcceleration,
  isWebGPUSupported,
  hideCharacterTags,
  setHideCharacterTags,
  hideSceneTags,
  setHideSceneTags,
}: VideoExportSettingsPanelProps) {
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
    // NOTE: dialogGradientAngle 可能为 undefined（旧存档数据），需要 fallback 防止产生 NaN
    const safeAngle = Number.isFinite(renderStyle.dialogGradientAngle) ? renderStyle.dialogGradientAngle : 90;
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
  const iconShell = (Icon: LucideIcon, children: React.ReactNode, disabled = false) => (
    <div
      className={`grid h-9 grid-cols-[28px_minmax(0,1fr)] items-center rounded-lg bg-[var(--vr-surface-soft)] ${disabled ? 'opacity-40' : ''
        }`}
    >
      <span className="flex h-full items-center justify-center text-[var(--vr-text-muted)]">
        <Icon className="h-3.5 w-3.5" />
      </span>
      {children}
    </div>
  );
  const iconSelect = (
    Icon: LucideIcon,
    id: string,
    value: string,
    onChange: (value: string) => void,
    options: Array<{ value: string; label: string }>,
    title: string,
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
          className="flex h-9 w-full min-w-0 items-center justify-end gap-1.5 rounded-r-lg bg-transparent px-2 text-right text-xs font-normal text-[var(--vr-text)] outline-none transition-colors hover:bg-white/5 disabled:cursor-default"
          title={title}
        >
          <span className="min-w-0 truncate">{selectedLabel}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-[var(--vr-text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''
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
                className={`flex h-8 w-full items-center justify-end rounded-lg px-2 text-right text-xs font-normal transition-colors ${option.value === value
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
    );
  };
  const iconNumber = (Icon: LucideIcon, control: React.ReactNode) =>
    iconShell(Icon, <div className="min-w-0">{control}</div>);
  const iconColor = (
    Icon: LucideIcon,
    value: string,
    onChange: (value: string) => void,
    title: string,
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
          <button
            type="button"
            onClick={() => {
              if (canToggle) setStyle(visibleKey, !visible as never);
            }}
            className={`flex h-9 items-center justify-start gap-1 rounded-lg px-2 text-left text-[11px] font-normal ${visible
                ? 'bg-white/12 text-[var(--vr-text)]'
                : 'bg-[var(--vr-surface-soft)] text-[var(--vr-text-muted)]'
              } ${canToggle ? '' : 'cursor-default'}`}
          >
            {canToggle &&
              (visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />)}
            {label}
          </button>
          {iconSelect(
            Type,
            `${kind}-font`,
            renderStyle[fontFamilyKey] as string,
            (value) => setStyle(fontFamilyKey, value as never),
            FONT_OPTIONS,
            t('字体', 'フォント', 'Font'),
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
          )}
          {iconNumber(
            Timer,
            <DragSizeControl
              label={t(
                '拖动调整提前完成时间',
                '早めに完了する時間を調整',
                'Adjust finish-early time',
              )}
              value={renderStyle[leadKey] as number}
              min={0}
              max={30}
              step={0.1}
              unit="s"
              onChange={(value) => setStyle(leadKey, value as never)}
            />,
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
            !isTypewriter,
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {iconColor(
            Palette,
            colorInputValue(renderStyle[colorKey] as string),
            (value) => setStyle(colorKey, value as never),
            t('\u6587\u5b57\u989c\u8272', '\u6587\u5b57\u8272', 'Text color'),
          )}
          {iconNumber(
            Blend,
            <DragSizeControl
              label={t(
                '\u62d6\u52a8\u8c03\u6574\u6587\u5b57\u900f\u660e\u5ea6',
                '\u6587\u5b57\u900f\u660e\u5ea6\u3092\u8abf\u6574',
                'Adjust text alpha',
              )}
              value={renderStyle[colorAlphaKey] as number}
              min={0}
              max={100}
              step={1}
              unit="%"
              onChange={(value) => setStyle(colorAlphaKey, value as never)}
            />,
          )}
          {iconNumber(
            Baseline,
            <DragSizeControl
              label={t(
                '\u62d6\u52a8\u8c03\u6574\u63cf\u8fb9\u5bbd\u5ea6',
                '\u7e01\u53d6\u308a\u5e45\u3092\u8abf\u6574',
                'Adjust stroke width',
              )}
              value={renderStyle[strokeWidthKey] as number}
              min={0}
              max={16}
              step={0.5}
              onChange={(value) => setStyle(strokeWidthKey, value as never)}
            />,
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="grid grid-cols-3 overflow-hidden rounded-lg bg-[var(--vr-surface-soft)]">
            {(['left', 'center', 'right'] as TextAlign[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStyle(alignKey, value as never)}
                className={`h-9 text-xs font-normal ${align === value
                    ? 'bg-[var(--vr-accent)] text-white'
                    : 'text-[var(--vr-text-soft)]'
                  }`}
              >
                {value === 'left'
                  ? t('左', '左', 'L')
                  : value === 'center'
                    ? t('中', '中央', 'C')
                    : t('右', '右', 'R')}
              </button>
            ))}
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
          )}
        </div>
      </div>
    );
  };

  return (
    <aside
      className="min-h-0 border-l border-[var(--vr-border)] bg-[var(--vr-surface)] backdrop-blur-xl flex flex-col shrink-0"
      style={{ width: exportPanelWidth }}
    >
      <div className="h-12 px-4 border-b border-[var(--vr-border)] flex items-center justify-between gap-3 text-xs font-black uppercase tracking-wide text-[var(--vr-text-soft)]">
        <div className="min-w-0 flex items-center gap-2">
          <Settings className="h-4 w-4 shrink-0 text-[var(--vr-accent)]" />
          <span className="truncate">{t('导出设置', '書き出し設定', 'Export Settings')}</span>
        </div>
        <div className="flex h-8 shrink-0 rounded-lg bg-[var(--vr-surface-soft)] p-0.5">
          {(['video', 'audio'] as ExportSettingsMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setExportSettingsMode(mode)}
              className={`flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-black transition-colors ${exportSettingsMode === mode
                  ? 'bg-[var(--vr-accent)] text-white shadow-sm'
                  : 'text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'
                }`}
              title={
                mode === 'video'
                  ? t('切换到导出设置', '書き出し設定を表示', 'Show export settings')
                  : t('切换到音频设置', '音声設定を表示', 'Show audio settings')
              }
              aria-pressed={exportSettingsMode === mode}
            >
              {mode === 'video' ? (
                <Video className="h-3.5 w-3.5" />
              ) : (
                <Music className="h-3.5 w-3.5" />
              )}
              {mode === 'video' ? t('视频', '動画', 'Video') : t('音频', '音声', 'Audio')}
            </button>
          ))}
        </div>
      </div>
      <div className="video-render-scroll min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
        {exportSettingsMode === 'video' ? (
          <div className="flex flex-col gap-4">
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                {t('视频参数', '動画パラメータ', 'Video')}
              </div>
              <div className="space-y-2 rounded-xl border border-slate-300/40 bg-slate-200/40 p-2 dark:border-white/10 dark:bg-white/5">
                <div className="grid grid-cols-3 gap-2">
                  {iconSelect(
                    Monitor,
                    'resolution-template',
                    String(resolutionIndex),
                    (value) => {
                      const nextIndex = Number(value);
                      setResolutionIndex(nextIndex);
                      const preset = RESOLUTION_OPTIONS[nextIndex];
                      if (preset) {
                        setResolutionWidth(preset.width);
                        setResolutionHeight(preset.height);
                      }
                    },
                    [
                      {
                        value: '-1',
                        label: t(
                          `\u81ea\u5b9a\u4e49 ${resolutionWidth} x ${resolutionHeight}`,
                          `\u30ab\u30b9\u30bf\u30e0 ${resolutionWidth} x ${resolutionHeight}`,
                          `Custom ${resolutionWidth} x ${resolutionHeight}`,
                        ),
                      },
                      ...RESOLUTION_OPTIONS.map((option, index) => ({
                        value: String(index),
                        label: option.label,
                      })),
                    ],
                    t(
                      '\u5206\u8fa8\u7387\u6a21\u677f',
                      '\u89e3\u50cf\u5ea6\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8',
                      'Resolution template',
                    ),
                  )}
                  {iconNumber(
                    RectangleHorizontal,
                    <DragSizeControl
                      label={t(
                        '\u5de6\u53f3\u62d6\u52a8\u8c03\u6574\u89c6\u9891\u5bbd\u5ea6',
                        '\u5de6\u53f3\u306b\u30c9\u30e9\u30c3\u30b0\u3057\u3066\u52d5\u753b\u5e45\u3092\u8abf\u6574',
                        'Drag horizontally to adjust video width',
                      )}
                      value={resolutionWidth}
                      min={320}
                      max={7680}
                      step={2}
                      onChange={(value) => {
                        setResolutionIndex(-1);
                        setResolutionWidth(value);
                      }}
                    />,
                  )}
                  {iconNumber(
                    RectangleVertical,
                    <DragSizeControl
                      label={t(
                        '\u5de6\u53f3\u62d6\u52a8\u8c03\u6574\u89c6\u9891\u9ad8\u5ea6',
                        '\u5de6\u53f3\u306b\u30c9\u30e9\u30c3\u30b0\u3057\u3066\u52d5\u753b\u9ad8\u3055\u3092\u8abf\u6574',
                        'Drag horizontally to adjust video height',
                      )}
                      value={resolutionHeight}
                      min={240}
                      max={4320}
                      step={2}
                      onChange={(value) => {
                        setResolutionIndex(-1);
                        setResolutionHeight(value);
                      }}
                    />,
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {iconSelect(
                    Film,
                    'frame-rate',
                    String(frameRate),
                    (value) => setFrameRate(Number(value) || 30),
                    FRAME_RATE_OPTIONS.map((option) => ({
                      value: String(option),
                      label: `${option} fps`,
                    })),
                    t('\u5e27\u7387', '\u30d5\u30ec\u30fc\u30e0\u30ec\u30fc\u30c8', 'FPS'),
                  )}
                  {iconSelect(
                    FileVideo,
                    'export-format',
                    exportFormat,
                    (value) => setExportFormat(value as ExportFormat),
                    EXPORT_FORMAT_OPTIONS.map((option) => ({
                      value: option.value,
                      label: option.label,
                    })),
                    t('\u683c\u5f0f', '\u5f62\u5f0f', 'Format'),
                  )}
                  {iconNumber(
                    Gauge,
                    <DragSizeControl
                      label={t(
                        '\u5de6\u53f3\u62d6\u52a8\u8c03\u6574\u64ad\u653e\u500d\u901f',
                        '\u5de6\u53f3\u30c9\u30e9\u30c3\u30b0\u3067\u518d\u751f\u901f\u5ea6\u3092\u8abf\u6574',
                        'Drag to adjust speed',
                      )}
                      value={speed}
                      min={0.25}
                      max={3}
                      step={0.25}
                      unit="x"
                      onChange={(value) => setSpeed(Math.max(0.25, value || 1))}
                    />,
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={outputDir}
                    onChange={(e) => {
                      setOutputDir(e.target.value);
                      setOutputDirError('');
                    }}
                    placeholder={t('\u4e0b\u8f7d\u76ee\u5f55 \\Downloads', '\u30c0\u30a6\u30f3\u30ed\u30fc\u30c9 \\Downloads', '\\Downloads')}
                    className={`h-9 min-w-0 flex-1 rounded-lg border bg-[var(--vr-surface-soft)] px-3 text-xs text-[var(--vr-text)] outline-none ${
                      outputDirError ? 'border-rose-400/70' : 'border-transparent'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={chooseOutputDir}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] transition-colors hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)]"
                    title={t('选择保存文件夹', '保存フォルダーを選択', 'Choose save folder')}
                    aria-label={t('选择保存文件夹', '保存フォルダーを選択', 'Choose save folder')}
                  >
                    <FolderOpen className="h-4 w-4" />
                  </button>
                </div>
                {outputDirError && (
                  <div className="text-[11px] font-bold text-rose-500 dark:text-rose-400">
                    {outputDirError}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                {t('文字样式', 'テキストスタイル', 'Text Style')}
              </div>
              <div className="space-y-2">
                {renderTextStyleSection(
                  'title',
                  t('标题', 'タイトル', 'Title'),
                  'bg-indigo-500/5',
                  true,
                )}
                {renderTextStyleSection('body', t('正文', '本文', 'Body'), 'bg-blue-500/5', false)}

                <div className="space-y-2 rounded-xl bg-violet-500/5 p-2">
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => updateRenderStyle('dialogVisible', !renderStyle.dialogVisible)}
                      className={`flex h-9 items-center justify-start gap-1 rounded-lg px-2 text-left text-[11px] font-normal ${renderStyle.dialogVisible
                          ? 'bg-violet-500/15 text-violet-500'
                          : 'bg-[var(--vr-surface-soft)] text-[var(--vr-text-muted)]'
                        }`}
                      title={t(
                        '点击显示或隐藏对话框',
                        'ダイアログ枠の表示を切替',
                        'Show or hide dialogue box',
                      )}
                    >
                      {renderStyle.dialogVisible ? (
                        <Eye className="h-3.5 w-3.5" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5" />
                      )}
                      {t('对话框', 'ダイアログ', 'Dialogue')}
                    </button>
                    {iconNumber(
                      RectangleHorizontal,
                      <DragSizeControl
                        label={t(
                          '拖动调整对话框宽度',
                          'ダイアログ幅を調整',
                          'Adjust dialogue width',
                        )}
                        value={renderStyle.dialogWidth}
                        min={35}
                        max={100}
                        step={1}
                        unit="%"
                        onChange={(value) => updateRenderStyle('dialogWidth', value)}
                      />,
                    )}
                    {iconNumber(
                      RectangleVertical,
                      <DragSizeControl
                        label={t(
                          '拖动调整对话框高度',
                          'ダイアログ高さを調整',
                          'Adjust dialogue height',
                        )}
                        value={renderStyle.dialogHeight}
                        min={16}
                        max={75}
                        step={1}
                        unit="%"
                        onChange={(value) => updateRenderStyle('dialogHeight', value)}
                      />,
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {iconNumber(
                      MoveHorizontal,
                      <DragSizeControl
                        label={t(
                          '拖动调整对话框左右位置',
                          '左右位置を調整',
                          'Adjust horizontal position',
                        )}
                        value={renderStyle.dialogOffsetX ?? 0}
                        min={-100}
                        max={100}
                        step={1}
                        unit="%"
                        onChange={(value) => updateRenderStyle('dialogOffsetX', value)}
                      />,
                    )}
                    {iconNumber(
                      MoveVertical,
                      <DragSizeControl
                        label={t(
                          '拖动调整对话框上下位置',
                          '上下位置を調整',
                          'Adjust vertical position',
                        )}
                        value={renderStyle.dialogOffsetY ?? 0}
                        min={-100}
                        max={100}
                        step={1}
                        unit="%"
                        onChange={(value) => updateRenderStyle('dialogOffsetY', value)}
                      />,
                    )}
                    {iconNumber(
                      PanelLeftRightDashed,
                      <DragSizeControl
                        label={t(
                          '拖动调整文字左右内间距',
                          '文字の左右余白を調整',
                          'Adjust text side padding',
                        )}
                        value={renderStyle.dialogTextPaddingX ?? 9}
                        min={2}
                        max={24}
                        step={1}
                        unit="%"
                        onChange={(value) => updateRenderStyle('dialogTextPaddingX', value)}
                      />,
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
                    )}
                    {iconSelect(
                      Palette,
                      'dialog-background-type',
                      renderStyle.dialogBackgroundType,
                      (value) =>
                        updateRenderStyle(
                          'dialogBackgroundType',
                          value as RenderStyle['dialogBackgroundType'],
                        ),
                      [
                        { value: 'solid', label: t('纯色', '単色', 'Solid') },
                        {
                          value: 'gradient',
                          label: t('透明渐变', '透明グラデーション', 'Transparent gradient'),
                        },
                        { value: 'image', label: t('导入图片', '画像', 'Image') },
                      ],
                      t('底色类型', '背景タイプ', 'Background'),
                    )}
                    {renderStyle.dialogBackgroundType === 'solid' && (
                      <div className="relative" ref={solidColorEditorRef}>
                        <button
                          type="button"
                          onClick={() => setShowSolidColorMenu(!showSolidColorMenu)}
                          className="flex h-9 w-full items-center justify-between rounded-lg bg-[var(--vr-surface-soft)] px-2.5 text-xs font-normal text-[var(--vr-text)] outline-none transition-colors hover:bg-white/5"
                          title={t('对话框底色', 'ダイアログ色', 'Dialogue Color')}
                        >
                          <span className="flex min-w-0 items-center gap-1.5">
                            <Palette className="h-3.5 w-3.5 shrink-0 text-[var(--vr-text-muted)]" />
                            <span className="truncate">{t('底色', '背景色', 'Color')}</span>
                          </span>
                          <span
                            className="h-4 w-7 shrink-0 rounded border border-white/20 shadow-sm"
                            style={{
                              backgroundColor: withAlpha(
                                renderStyle.panelColor,
                                (renderStyle.panelColorAlpha ?? 82) / 100,
                              ),
                            }}
                          />
                        </button>
                        {showSolidColorMenu && (
                          <div
                            className="absolute right-0 top-[calc(100%+6px)] z-50 rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface)] p-3 shadow-2xl shadow-black/30"
                            style={{ width: '210px' }}
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                          >
                            <div className="space-y-3">
                              {/* 顶部的高颜值长方形色条，带网格透明度展示 */}
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

                              {/* 基础颜色选择 */}
                              <div className="grid grid-cols-[auto_1fr] items-center gap-2">
                                <span className="text-[11px] font-bold text-[var(--vr-text-soft)]">
                                  {t('基础颜色', '基本色', 'Base Color')}
                                </span>
                                <input
                                  type="color"
                                  value={colorInputValue(renderStyle.panelColor)}
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onChange={(event) => updateRenderStyle('panelColor', event.target.value)}
                                  className="h-8 w-full cursor-pointer rounded-lg border-0 bg-transparent p-0"
                                />
                              </div>

                              {/* 底部控制Alpha值的滑动条 */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] font-bold text-[var(--vr-text-soft)]">
                                  <span>{t('不透明度', '不透明度', 'Opacity')}</span>
                                  <span>{renderStyle.panelColorAlpha ?? 82}%</span>
                                </div>
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
                                    background: `linear-gradient(to right, transparent, ${colorInputValue(renderStyle.panelColor)})`
                                  }}
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
                          label={t(
                            '拖动调整渐变角度',
                            'グラデーション角度を調整',
                            'Adjust gradient angle',
                          )}
                          value={renderStyle.dialogGradientAngle}
                          min={0}
                          max={360}
                          step={1}
                          unit="°"
                          onChange={(value) => updateRenderStyle('dialogGradientAngle', value)}
                        />,
                      )}
                    {renderStyle.dialogBackgroundType === 'image' && (
                      <div
                        className={`grid h-9 items-center rounded-lg bg-[var(--vr-surface-soft)] ${renderStyle.dialogImageUrl
                            ? 'grid-cols-[28px_1fr_1fr]'
                            : 'grid-cols-[28px_minmax(0,1fr)]'
                          }`}
                      >
                        <span className="flex h-full items-center justify-center text-[var(--vr-text-muted)]">
                          <ImagePlus className="h-3.5 w-3.5" />
                        </span>
                        <label
                          className="flex h-9 min-w-0 cursor-pointer items-center justify-center rounded-r-lg px-2 text-[var(--vr-text-soft)] transition-colors hover:bg-white/5"
                          title={
                            renderStyle.dialogImageUrl
                              ? t(
                                '\u66f4\u6362\u56fe\u7247',
                                '\u753b\u50cf\u3092\u5909\u66f4',
                                'Replace image',
                              )
                              : t(
                                '\u5bfc\u5165\u56fe\u7247',
                                '\u753b\u50cf\u3092\u9078\u629e',
                                'Import image',
                              )
                          }
                          aria-label={
                            renderStyle.dialogImageUrl
                              ? t(
                                '\u66f4\u6362\u56fe\u7247',
                                '\u753b\u50cf\u3092\u5909\u66f4',
                                'Replace image',
                              )
                              : t(
                                '\u5bfc\u5165\u56fe\u7247',
                                '\u753b\u50cf\u3092\u9078\u629e',
                                'Import image',
                              )
                          }
                        >
                          {renderStyle.dialogImageUrl ? (
                            <RotateCw className="h-3.5 w-3.5" />
                          ) : (
                            <ImagePlus className="h-3.5 w-3.5" />
                          )}
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
                            title={t(
                              '\u5220\u9664\u56fe\u7247',
                              '\u753b\u50cf\u3092\u524a\u9664',
                              'Remove image',
                            )}
                            aria-label={t(
                              '\u5220\u9664\u56fe\u7247',
                              '\u753b\u50cf\u3092\u524a\u9664',
                              'Remove image',
                            )}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
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
                              className={`absolute top-1/2 h-6 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border shadow ${activeGradientStop?.id === stop.id
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
                                  stops.map((item) =>
                                    item.id === stop.id ? { ...item, position } : item,
                                  ),
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
                                        item.id === activeGradientStop.id
                                          ? { ...item, color: event.target.value }
                                          : item,
                                      ),
                                    )
                                  }
                                  className="h-8 w-full cursor-pointer rounded-lg border-0 bg-transparent p-0"
                                />
                                <DragSizeControl
                                  label={t(
                                    '\u62d6\u52a8\u8c03\u6574\u900f\u660e\u5ea6',
                                    '\u900f\u660e\u5ea6\u3092\u8abf\u6574',
                                    'Adjust alpha',
                                  )}
                                  value={activeGradientStop.alpha}
                                  min={0}
                                  max={100}
                                  step={1}
                                  unit="%"
                                  onChange={(value) =>
                                    updateGradientStops((stops) =>
                                      stops.map((item) =>
                                        item.id === activeGradientStop.id
                                          ? { ...item, alpha: value }
                                          : item,
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
                            addGradientStopAt(
                              Math.min(100, Math.max(0, (activeGradientStop?.position ?? 50) + 10)),
                            )
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
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                {t('导出细节', '書き出し詳細', 'Export Details')}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="min-w-0 space-y-1.5">
                  <span className="block truncate text-[11px] font-normal text-[var(--vr-text-soft)]">
                    {t('无音频视频长度', '音声なし動画の長さ', 'No-audio video length')}
                  </span>
                  <DragSizeControl
                    label={t(
                      '左右拖动调整无音频视频长度',
                      '左右にドラッグして音声なし動画の長さを調整',
                      'Drag horizontally to adjust no-audio video length',
                    )}
                    value={defaultSeconds}
                    min={1}
                    max={30}
                    step={1}
                    unit="s"
                    onChange={setDefaultSeconds}
                  />
                </label>
                <label className="min-w-0 space-y-1.5">
                  <span className="block truncate text-[11px] font-normal text-[var(--vr-text-soft)]">
                    {t('提前完成动画(秒)', 'アニメを早めに完了(秒)', 'Finish animation early')}
                  </span>
                  <DragSizeControl
                    label={t(
                      '左右拖动调整动画提前完成时间',
                      '左右ドラッグでアニメ完了時間を調整',
                      'Drag to adjust animation lead time',
                    )}
                    value={animationLeadSeconds}
                    min={0}
                    max={30}
                    step={0.1}
                    unit="s"
                    onChange={(value) => setAnimationLeadSeconds(value)}
                  />
                </label>
              </div>
            </div>

            <div className="order-last flex items-center gap-3">
              <div className="shrink-0 text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                {t('渲染加速', 'レンダリング加速', 'Render Acceleration')}
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setUseGpuAcceleration(false)}
                  disabled={!isWebGPUSupported}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-black transition-colors ${!useGpuAcceleration
                      ? 'bg-[var(--vr-accent)] text-white shadow-sm'
                      : 'text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'
                    } ${!isWebGPUSupported ? 'opacity-40 cursor-not-allowed' : ''}`}
                  title={t(
                    '使用 2D Canvas 渲染（最稳定）',
                    '2D Canvas レンダリング（最も安定）',
                    '2D Canvas rendering (most stable)',
                  )}
                >
                  2D Canvas
                </button>
                <button
                  type="button"
                  onClick={() => isWebGPUSupported && setUseGpuAcceleration(true)}
                  disabled={!isWebGPUSupported}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-black transition-colors ${useGpuAcceleration
                      ? 'bg-[var(--vr-accent)] text-white shadow-sm'
                      : 'text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'
                    } ${!isWebGPUSupported ? 'opacity-40 cursor-not-allowed' : ''}`}
                  title={
                    isWebGPUSupported
                      ? t(
                        '使用 WebGPU 加速渲染（实验性）',
                        'WebGPU 加速レンダリング（実験的）',
                        'WebGPU accelerated rendering (experimental)',
                      )
                      : t(
                        '当前浏览器不支持 WebGPU',
                        'このブラウザは WebGPU をサポートしていません',
                        'WebGPU is not supported in this browser',
                      )
                  }
                >
                  GPU
                  {!isWebGPUSupported && (
                    <span className="ml-0.5 text-[9px] opacity-70">
                      {t('(不支持)', '(未対応)', '(Unsupported)')}
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                {t('标签显示', 'タグ表示', 'Tag Display')}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setHideCharacterTags(!hideCharacterTags)}
                  className={`rounded-lg px-3 py-2 text-xs font-black transition-colors ${hideCharacterTags
                      ? 'bg-[var(--vr-accent)] text-white'
                      : 'bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)]'
                    }`}
                >
                  {t('隐藏人物标签', '人物タグを非表示', 'Hide character tags')}
                </button>
                <button
                  type="button"
                  onClick={() => setHideSceneTags(!hideSceneTags)}
                  className={`rounded-lg px-3 py-2 text-xs font-black transition-colors ${hideSceneTags
                      ? 'bg-[var(--vr-accent)] text-white'
                      : 'bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)]'
                    }`}
                >
                  {t('隐藏场景标签', 'シーンタグを非表示', 'Hide scene tags')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                {t('时间线声音', 'タイムライン音声', 'Timeline Audio')}
              </div>
              <div className="space-y-3 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-3">
                <p className="text-xs font-bold leading-5 text-[var(--vr-text-muted)]">
                  {selectedAudioClipCount > 0
                    ? t(
                      `正在调整 ${selectedAudioClipCount} 个声音片段`,
                      `${selectedAudioClipCount} 個の音声クリップを調整中`,
                      `Editing ${selectedAudioClipCount} audio clip(s)`,
                    )
                    : t(
                      '请在时间线中选择带声音的卡片。',
                      'タイムラインで音声付きカードを選択してください。',
                      'Select an audio-enabled card in the timeline.',
                    )}
                </p>
                <RangeControl
                  label={t('音量', '音量', 'Volume')}
                  min={0}
                  max={1}
                  step={0.01}
                  value={selectedAudioVolume}
                  valueLabel={`${Math.round(selectedAudioVolume * 100)}%`}
                  disabled={selectedAudioClipCount === 0}
                  onChange={(value) => updateSelectedAudioSettings('volume', value)}
                />
                <RangeControl
                  label={t('淡入', 'フェードイン', 'Fade in')}
                  min={0}
                  max={10}
                  step={0.1}
                  value={selectedAudioFadeIn}
                  valueLabel={`${Number(selectedAudioFadeIn).toFixed(1)}s`}
                  disabled={selectedAudioClipCount === 0}
                  onChange={(value) => updateSelectedAudioSettings('fadeIn', value)}
                />
                <RangeControl
                  label={t('淡出', 'フェードアウト', 'Fade out')}
                  min={0}
                  max={10}
                  step={0.1}
                  value={selectedAudioFadeOut}
                  valueLabel={`${Number(selectedAudioFadeOut).toFixed(1)}s`}
                  disabled={selectedAudioClipCount === 0}
                  onChange={(value) => updateSelectedAudioSettings('fadeOut', value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                {t('文字转音频', 'テキストから音声', 'Text to Audio')}
              </div>
              <div className="rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-3 space-y-3">
                <p className="text-xs font-bold leading-5 text-[var(--vr-text-muted)]">
                  {t(
                    `将当前选中的 ${selectedSpeechNodeCount} 个非视频片段文字生成音频素材。`,
                    `選択中の ${selectedSpeechNodeCount} 個の非動画セグメントから音声素材を作成します。`,
                    `Create an audio asset from ${selectedSpeechNodeCount} selected non-video segment(s).`,
                  )}
                </p>
                <button
                  type="button"
                  onClick={generateAudioFromSelectedText}
                  disabled={audioBusy || selectedSpeechNodeCount === 0}
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[var(--vr-accent)] px-3 text-xs font-black text-white transition-colors hover:bg-[var(--vr-accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {audioBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {t('生成语音', '音声を生成', 'Generate speech')}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                {t('用户配音', 'ボイスオーバー', 'Voiceover')}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => assetUploadInputRef.current?.click()}
                  className="flex h-10 min-w-0 items-center justify-center gap-2 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-3 text-xs font-black text-[var(--vr-text-soft)] transition-colors hover:border-[var(--vr-border-strong)] hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)]"
                >
                  <FolderOpen className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {t('上传音频', '音声をアップロード', 'Upload audio')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={isRecordingVoiceover ? stopVoiceoverRecording : startVoiceoverRecording}
                  className={`flex h-10 min-w-0 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black transition-colors ${isRecordingVoiceover
                      ? 'bg-rose-500 text-white hover:bg-rose-600'
                      : 'border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] hover:border-[var(--vr-border-strong)] hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)]'
                    }`}
                >
                  <Mic className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {isRecordingVoiceover
                      ? t('停止录音', '録音を停止', 'Stop')
                      : t('录制配音', '録音', 'Record')}
                  </span>
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-3 py-2 text-xs font-bold leading-5 text-[var(--vr-text-muted)]">
              {audioMessage ||
                t(
                  '生成或上传后，音频会出现在左侧素材栏，可拖到下方音频轨。',
                  '生成またはアップロードした音声は左側の素材パネルに表示され、音声トラックへドラッグできます。',
                  'Generated or uploaded audio appears in the left assets panel and can be dragged to an audio track.',
                )}
            </div>
          </div>
        )}
        {(progress || error) && (
          <div className="space-y-2">
            {!error && (
              <div className="h-2 rounded-full bg-[var(--vr-surface-soft)] border border-[var(--vr-border)] overflow-hidden">
                <div
                  className="h-full bg-[var(--vr-accent)] transition-all"
                  style={{ width: `${progressValue}%` }}
                />
              </div>
            )}
            <p
              className={`text-xs font-bold ${error ? 'text-rose-500 dark:text-rose-400' : 'text-[var(--vr-text-muted)]'}`}
            >
              {error || progress}
            </p>
          </div>
        )}
        {savedPath && (
          <div className="rounded-lg border border-[var(--vr-accent)] bg-[var(--vr-accent-soft)] px-3 py-2 text-xs font-bold text-[var(--vr-accent-strong)] break-all">
            {t('已保存到：', '保存先: ', 'Saved to: ')}
            {savedPath}
          </div>
        )}
      </div>
    </aside>
  );
}

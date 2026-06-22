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
  MousePointerClick,
  MoveHorizontal,
  MoveVertical,
  Music,
  Palette,
  PanelLeftRightDashed,
  PencilLine,
  Info,
  Radius,
  RectangleHorizontal,
  RectangleVertical,
  Settings,
  Sparkles,
  Timer,
  Trash2,
  Type,
  Video,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

import { DragSizeControl, RangeControl } from '../controls/RenderControls';
import {
  EXPORT_FORMAT_OPTIONS,
  FRAME_RATE_OPTIONS,
  RESOLUTION_OPTIONS,
  TEXT_ANIMATION_OPTIONS,
} from '../shared/constants';
import { renderCopy } from '../shared/renderCopy';
import { RenderStyleSettingsSection } from './render-style-settings-section';
import type {
  ExportFormat,
  ExportSettingsMode,
  RenderStatus,
  RenderStyle,
  TextAlign,
  TextAnimation,
  TypewriterMode,
  VideoTextScaleMode,
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
  videoTextScaleMode: VideoTextScaleMode;
  setVideoTextScaleMode: (value: VideoTextScaleMode) => void;
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
  videoTextScaleMode,
  setVideoTextScaleMode,
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
  const [showSettingDescriptions, setShowSettingDescriptions] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = window.localStorage.getItem('galwriter-video-export-setting-descriptions');
    return stored === null ? true : stored === 'true';
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      'galwriter-video-export-setting-descriptions',
      String(showSettingDescriptions),
    );
  }, [showSettingDescriptions]);
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
      {showSettingDescriptions && description && (
        <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">{description}</div>
      )}
      <div className="grid h-9 grid-cols-[28px_minmax(0,1fr)] items-center rounded-lg bg-[var(--vr-surface-soft)]">
        <span className="flex h-full items-center justify-center text-[var(--vr-text-muted)]">
          <Icon className="h-3.5 w-3.5" />
        </span>
        {children}
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
          <div className="absolute right-0 top-[calc(100%+6px)] z-[1200] min-w-full overflow-hidden rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface)] p-1 shadow-2xl shadow-black/20">
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
      description,
    );
  };
  const iconNumber = (Icon: LucideIcon, control: React.ReactNode, description?: string) =>
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
    const characterModeLabel = t('逐字', '文字ごと', 'Character');
    const sentenceModeLabel = t('逐句', '文ごと', 'Sentence');
    const lineModeLabel = t('逐行', '行ごと', 'Line');

    return (
      <div className={`space-y-2 rounded-xl p-2 ${toneClass}`}>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            {showSettingDescriptions && (
              <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">
                {isTitle ? t('标题隐藏', 'タイトルを非表示', 'Title hidden') : t('正文无法隐藏', '本文は非表示不可', 'Body cannot be hidden')}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (canToggle) setStyle(visibleKey, !visible as never);
              }}
              className={`flex h-9 w-full items-center justify-start gap-1 rounded-lg px-2 text-left text-[11px] font-normal ${isTitle
                ? 'bg-[#f7f9fc] text-[var(--vr-text)]'
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
            FONT_OPTIONS,
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
            t('动画', 'アニメーション', 'Animation'),
            t('选择文字动画', '文字アニメを選択', 'Choose text animation'),
          )}
          {iconNumber(
            Timer,
            <DragSizeControl
              label={t(
                '鎷栧姩璋冩暣鎻愬墠瀹屾垚鏃堕棿',
                '鏃┿倎銇畬浜嗐仚銈嬫檪闁撱倰瑾挎暣',
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
            t('选择打字粒度', 'タイプ単位を選択', 'Choose typewriter unit'),
            !isTypewriter,
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {iconColor(
            Palette,
            colorInputValue(renderStyle[colorKey] as string),
            (value) => setStyle(colorKey, value as never),
            t('\u6587\u5b57\u989c\u8272', '\u6587\u5b57\u8272', 'Text color'),
            t('选择文字颜色', '文字色を選択', 'Choose text color'),
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
          <div className="space-y-1">
            {showSettingDescriptions && (
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
      className="ml-auto min-h-0 border-l border-[var(--vr-border)] bg-[var(--vr-surface)] backdrop-blur-xl flex flex-col shrink-0 overflow-hidden"
      style={{ width: exportPanelWidth }}
    >
      <div className="h-12 px-4 border-b border-[var(--vr-border)] flex items-center justify-between gap-3 text-xs font-black uppercase tracking-wide text-[var(--vr-text-soft)]">
        <div className="min-w-0 flex items-center gap-2">
          <Settings className="h-4 w-4 shrink-0 text-[var(--vr-accent)]" />
          <span className="truncate">{t('导出设置', '書き出し設定', 'Export Settings')}</span>
          <button
            type="button"
            onClick={() => setShowSettingDescriptions((current) => !current)}
            className={`ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${showSettingDescriptions
              ? 'bg-[var(--vr-surface)] text-[var(--vr-text)] ring-1 ring-[var(--vr-border)]'
              : 'bg-[var(--vr-surface-soft)] text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'
              }`}
            title={
              showSettingDescriptions
                ? t('隐藏参数说明', '説明を非表示', 'Hide descriptions')
                : t('显示参数说明', '説明を表示', 'Show descriptions')
            }
            aria-label={
              showSettingDescriptions
                ? t('隐藏参数说明', '説明を非表示', 'Hide descriptions')
                : t('显示参数说明', '説明を表示', 'Show descriptions')
            }
          >
            <Info className="h-3.5 w-3.5" />
          </button>
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
                {t('视频参数', '動画', 'Video')}
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
                    t('分辨率', '解像度', 'Resolution'),
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
                        setResolutionWidth(value);
                      }}
                    />,
                    t('视频宽度', '動画幅', 'Video width'),
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
                        setResolutionHeight(value);
                      }}
                    />,
                    t('视频高度', '動画高さ', 'Video height'),
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
                    t('选择帧率', 'フレームレートを選択', 'Choose frame rate'),
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
                    t('导出格式', '書き出し形式', 'Export format'),
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
                    t('播放倍速', '再生速度', 'Playback speed'),
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
                    className={`h-9 min-w-0 flex-1 rounded-lg border bg-[var(--vr-surface-soft)] px-3 text-xs text-[var(--vr-text)] outline-none ${outputDirError ? 'border-rose-400/70' : 'border-transparent'
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
              <div className="flex items-center gap-3 rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-2">
                <div className="shrink-0 px-1 text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                  {t(
                    '\u89c6\u9891\u6587\u5b57\u5c3a\u5ea6',
                    '\u52d5\u753b\u30c6\u30ad\u30b9\u30c8\u5c3a\u5ea6',
                    'Video text scale',
                  )}
                </div>
                <div className="min-w-[156px] flex-1">
                  <ExportPillToggleGroup
                    value={videoTextScaleMode}
                    options={[
                      {
                        value: 'literal',
                        label: t(
                          '\u9075\u5faa\u6570\u503c',
                          '\u6570\u5024\u3092\u512a\u5148',
                          'Use px values',
                        ),
                      },
                      {
                        value: 'webRatio',
                        label: t(
                          '\u7f51\u9875\u6bd4\u4f8b',
                          '\u30a6\u30a7\u30d6\u6bd4\u7387',
                          'Match web ratio',
                        ),
                      },
                    ]}
                    onChange={(value) => setVideoTextScaleMode(value as VideoTextScaleMode)}
                  />
                </div>
              </div>
              <RenderStyleSettingsSection
                language={language}
                renderStyle={renderStyle}
                updateRenderStyle={updateRenderStyle}
                resolutionWidth={resolutionWidth}
                resolutionHeight={resolutionHeight}
                showDescriptions={showSettingDescriptions}
              />
            </div>


            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                {t('其他', 'その他', 'Other')}
              </div>
              <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-2">
                  <span className="min-w-0 flex-1 truncate text-[10px] font-black tracking-wide text-[var(--vr-text-muted)]">
                    {t('无音频视频长度', '音声なし動画の長さ', 'No-audio video length')}
                  </span>
                  <div className="w-16 shrink-0">
                    <DragSizeControl
                      label={t(
                        '左右拖动调整无音频视频长度',
                        '左右ドラッグで音声なし動画の長さを調整',
                        'Drag horizontally to adjust no-audio video length',
                      )}
                      value={defaultSeconds}
                      min={1}
                      max={30}
                      step={1}
                      unit="s"
                      onChange={setDefaultSeconds}
                    />
                  </div>
                </div>
                <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-2">
                  <span className="min-w-0 flex-1 truncate text-[10px] font-black tracking-wide text-[var(--vr-text-muted)]">
                    {t('提前完成动画', 'アニメーションを早めに完了', 'Finish animation early')}
                  </span>
                  <div className="w-16 shrink-0">
                    <DragSizeControl
                      label={t(
                        '左右拖动调整动画提前完成时间',
                        '左右ドラッグでアニメーション完了時間を調整',
                        'Drag to adjust animation lead time',
                      )}
                      value={animationLeadSeconds}
                      min={0}
                      max={30}
                      step={0.1}
                      unit="s"
                      onChange={(value) => setAnimationLeadSeconds(value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-xl border border-[var(--vr-border)] bg-slate-200/60 p-2 dark:bg-slate-800/60">
              {/* NOTE: 人物标签单按钮开关 — 点击在显示/隐藏之间切换 */}
              <ExportSettingCard
                icon={CharacterTagGlyph}
                description={
                  showSettingDescriptions
                    ? t('隐藏人物标签', '人物タグを隠す', 'Hide character tags')
                    : undefined
                }
              >
                <ExportToggleButton
                  active={hideCharacterTags}
                  title={hideCharacterTags
                    ? t('人物标签已隐藏', 'キャラクタータグ: 非表示', 'Character tags: hidden')
                    : t('人物标签显示中', 'キャラクタータグ: 表示', 'Character tags: visible')
                  }
                  onClick={() => setHideCharacterTags(!hideCharacterTags)}
                  icon={hideCharacterTags
                    ? <EyeOff className="h-3.5 w-3.5" />
                    : <Eye className="h-3.5 w-3.5" />
                  }
                />
              </ExportSettingCard>

              {/* NOTE: 场景标签单按鈕开关 — 点击在显示/隐藏之间切换 */}
              <ExportSettingCard
                icon={SceneTagGlyph}
                description={
                  showSettingDescriptions
                    ? t('隐藏场景标签', 'シーンタグを隠す', 'Hide scene tags')
                    : undefined
                }
              >
                <ExportToggleButton
                  active={hideSceneTags}
                  title={hideSceneTags
                    ? t('场景标签已隐藏', 'シーンタグ: 非表示', 'Scene tags: hidden')
                    : t('场景标签显示中', 'シーンタグ: 表示', 'Scene tags: visible')
                  }
                  onClick={() => setHideSceneTags(!hideSceneTags)}
                  icon={hideSceneTags
                    ? <EyeOff className="h-3.5 w-3.5" />
                    : <Eye className="h-3.5 w-3.5" />
                  }
                />
              </ExportSettingCard>

              {/* NOTE: 渲染模式单切换按钮 — 点击在 2D Canvas / WebGPU 间切换，active=GPU高亮 */}
              <ExportSettingCard
                icon={RenderModeGlyph}
                description={
                  showSettingDescriptions
                    ? t('渲染方式', '描画方式', 'Render mode')
                    : undefined
                }
              >
                <ExportToggleButton
                  active={useGpuAcceleration}
                  label={useGpuAcceleration ? 'WebGPU' : '2D Canvas'}
                  highlightActive={false}
                  icon={null}
                  title={useGpuAcceleration
                    ? t(
                      '当前：WebGPU 加速（点击切换到 2D Canvas）',
                      '現在: WebGPU 加速（クリックで 2D Canvas に切替）',
                      'Current: WebGPU accelerated (click to switch to 2D Canvas)',
                    )
                    : isWebGPUSupported
                      ? t(
                        '当前：2D Canvas（点击切换到 WebGPU 加速）',
                        '現在: 2D Canvas（クリックで WebGPU 加速に切替）',
                        'Current: 2D Canvas (click to switch to WebGPU)',
                      )
                      : t(
                        '当前浏览器不支持 WebGPU，仅可使用 2D Canvas',
                        'このブラウザーは WebGPU 非対応、2D Canvas のみ使用可能',
                        'WebGPU not supported; 2D Canvas only',
                      )
                  }
                  disabled={!isWebGPUSupported}
                  onClick={() => {
                    if (!isWebGPUSupported) return;
                    setUseGpuAcceleration(!useGpuAcceleration);
                  }}
                />
              </ExportSettingCard>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                {t('时间线音频', 'タイムライン音声', 'Timeline Audio')}
              </div>
              <div className="space-y-3 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-3">
                <p className="text-xs font-bold leading-5 text-[var(--vr-text-muted)]">
                  {selectedAudioClipCount > 0
                    ? t(
                      `正在调整 ${selectedAudioClipCount} 个音频片段`,
                      `${selectedAudioClipCount} 個の音声クリップを調整中`,
                      `Editing ${selectedAudioClipCount} audio clip(s)`,
                    )
                    : t(
                      '请在时间线中选择带音频的卡片。',
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

// NOTE: 与 WebWorkspace 中 WebSettingCard 结构完全一致，支持自定义 Glyph 组件作为 icon
function ExportSettingCard({
  icon: Icon,
  description,
  children,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  description?: string;
  children: ReactNode;
}) {
  const hasIcon = Boolean(Icon);
  return (
    <div className="space-y-1">
      {description && <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">{description}</div>}
      <div
        className={`grid h-9 items-center overflow-hidden rounded-lg bg-[var(--vr-surface-soft)] ${hasIcon ? 'grid-cols-[28px_minmax(0,1fr)]' : 'grid-cols-1'
          }`}
      >
        {Icon ? (
          <div className="flex h-full items-center justify-center text-[var(--vr-text-muted)]">
            <Icon className="h-3.5 w-3.5" />
          </div>
        ) : null}
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

// NOTE: 单按钮切换组件，点击在 active/inactive 间切换，active 时显示 accent 高亮；label 可选，显示在 icon 右侧
function ExportToggleButton({
  active,
  onClick,
  icon,
  label,
  title,
  disabled,
  highlightActive = true,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label?: string;
  title?: string;
  disabled?: boolean;
  highlightActive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`flex h-9 w-full min-w-0 items-center justify-center gap-1 border-0 px-2 text-[10px] font-black transition-colors ${active && highlightActive
        ? 'bg-[var(--vr-accent)] text-white'
        : 'text-[var(--vr-text-soft)] hover:bg-white/5 hover:text-[var(--vr-text)]'
        } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
      aria-pressed={active}
    >
      {icon}
      {label && <span className="truncate">{label}</span>}
    </button>
  );
}

type ExportSegmentedOption = {
  value: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  title?: string;
};

// NOTE: 与 WebWorkspace 中 WebPillToggleGroup 结构完全一致，额外支持 disabled/title 用于 GPU 不可用场景
function ExportPillToggleGroup({
  value,
  options,
  onChange,
}: {
  value: string;
  options: ExportSegmentedOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid h-9 w-full min-w-0 overflow-hidden rounded-lg grid-cols-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={option.disabled}
            className={`flex h-9 min-w-0 items-center justify-center gap-1 border-0 px-2 text-[10px] font-black transition-colors ${active
              ? 'bg-[var(--vr-accent)] text-white'
              : 'text-[var(--vr-text-soft)] hover:bg-white/5 hover:text-[var(--vr-text)]'
              } ${option.disabled ? 'cursor-not-allowed opacity-40' : ''}`}
            title={option.title ?? option.label}
            aria-pressed={active}
          >
            {option.icon}
            {option.icon ? null : <span className="truncate">{option.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

// NOTE: 人物标签卡片图标 — 小人剪影（圆头 + 肩部弧线）
function CharacterTagGlyph() {
  return (
    <span className="relative inline-flex h-3.5 w-3.5 shrink-0 flex-col items-center justify-end gap-0 pb-[1px]">
      {/* 圆形头部 */}
      <span className="mb-[2px] h-[5px] w-[5px] rounded-full bg-current/70" />
      {/* 肩部弧线 */}
      <span className="h-[4px] w-[10px] rounded-t-[50%] bg-current/55" />
    </span>
  );
}

// NOTE: 场景标签卡片图标 — 带天空和地面的风景小帧
function SceneTagGlyph() {
  return (
    <span className="relative inline-flex h-3.5 w-3.5 shrink-0 overflow-hidden rounded-[3px] border border-current/40 bg-current/10">
      {/* 太阳 */}
      <span className="absolute left-[2px] top-[2px] h-[4px] w-[4px] rounded-full bg-current/55" />
      {/* 地平线 */}
      <span className="absolute inset-x-0 bottom-[4px] h-[1px] bg-current/30" />
      {/* 地面 */}
      <span className="absolute inset-x-0 bottom-0 h-[4px] bg-current/45" />
    </span>
  );
}

// NOTE: 渲染模式卡片图标 — 监视器 + 底部芯片，表达「渲染输出」概念
function RenderModeGlyph() {
  return (
    <span className="relative inline-flex h-3.5 w-3.5 shrink-0 flex-col items-center justify-center gap-0">
      {/* 监视器外框 */}
      <span className="relative h-[8px] w-[12px] rounded-[1.5px] border border-current/50 bg-current/10">
        {/* 屏幕内部扫描线，象征渲染输出 */}
        <span className="absolute inset-x-[2px] top-[1.5px] h-[1px] bg-current/40 rounded-full" />
        <span className="absolute inset-x-[2px] top-[3.5px] h-[1px] bg-current/30 rounded-full" />
        <span className="absolute inset-x-[2px] top-[5px] h-[1px] bg-current/20 rounded-full" />
      </span>
      {/* 底座支脚 */}
      <span className="h-[1.5px] w-[5px] bg-current/40 rounded-full" />
      {/* 底座底板 */}
      <span className="h-[1px] w-[7px] bg-current/35 rounded-full" />
    </span>
  );
}

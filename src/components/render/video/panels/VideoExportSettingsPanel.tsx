import { formatVideoText, getVideoTextAnimationOptions } from '../i18n';
import type { LucideIcon } from 'lucide-react';
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
  Info,
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
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

import type { Language } from '../../../../lib/i18n';
import {
  normalizeSharedCanvasSettings,
  type SharedCanvasSettings,
} from '../../canvas/canvasSettings';
import { CanvasSettingsSection } from '../../canvas/CanvasSettingsSection';
import { DragSizeControl, RangeControl } from '../controls/RenderControls';
import { EXPORT_FORMAT_OPTIONS, FRAME_RATE_OPTIONS, RESOLUTION_OPTIONS } from '../shared/constants';
import { getVideoRenderObjects, updateVideoTextAnimations } from '../shared/renderObjects';
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
import { RenderObjectSettingsSection } from './render-object-settings-section';

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
  speed: number;
  setSpeed: (value: number) => void;
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
  hideCharacterTags: boolean;
  setHideCharacterTags: (value: boolean) => void;
  hideSceneTags: boolean;
  setHideSceneTags: (value: boolean) => void;
  canvasSettings: SharedCanvasSettings;
  onCanvasSettingsChange: (patch: Partial<SharedCanvasSettings>) => void;
  showCanvasSettings: boolean;
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

function greatestCommonDivisor(left: number, right: number) {
  let a = Math.max(1, Math.round(Math.abs(left)));
  let b = Math.max(1, Math.round(Math.abs(right)));
  while (b) [a, b] = [b, a % b];
  return Math.max(1, a);
}

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
  speed,
  setSpeed,
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
  hideCharacterTags,
  setHideCharacterTags,
  hideSceneTags,
  setHideSceneTags,
  canvasSettings,
  onCanvasSettingsChange,
  showCanvasSettings,
}: VideoExportSettingsPanelProps) {
  const initialRatioDivisor = greatestCommonDivisor(resolutionWidth, resolutionHeight);
  const [canvasRatioWidth, setCanvasRatioWidth] = useState(() =>
    Math.max(1, Math.round(resolutionWidth / initialRatioDivisor)),
  );
  const [canvasRatioHeight, setCanvasRatioHeight] = useState(() =>
    Math.max(1, Math.round(resolutionHeight / initialRatioDivisor)),
  );
  const [canvasRatioLocked, setCanvasRatioLocked] = useState(true);
  const [videoCanvasOptions, setVideoCanvasOptions] = useState(() =>
    normalizeSharedCanvasSettings({
      canvasWidth: resolutionWidth,
      canvasHeight: resolutionHeight,
      hideCharacterTags,
      hideSceneTags,
    }),
  );
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
      <div className="grid h-10 grid-cols-[28px_minmax(0,1fr)] items-center rounded-lg bg-[var(--vr-surface-soft)]">
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
        className={`relative min-w-0 ${isOpen ? 'z-[10000]' : 'z-0'}`}
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
          className="flex h-10 w-full min-w-0 items-center justify-end gap-1.5 rounded-r-lg bg-transparent px-2 text-right text-xs font-normal text-[var(--vr-text)] outline-none transition-colors hover:bg-white/5 disabled:cursor-default"
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
          <div
            className="absolute right-0 top-[calc(100%+6px)] z-[9999] min-w-full overflow-hidden rounded-xl border border-[var(--vr-border)] bg-white p-1 shadow-2xl shadow-black/20"
            style={{
              ['--vr-surface-soft' as any]: '#f1f5f9',
              ['--vr-text' as any]: '#1e293b',
              ['--vr-border' as any]: '#e2e8f0',
            }}
          >
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setOpenSelectId(null);
                }}
                className={`flex h-9 w-full items-center justify-end rounded-lg px-2 text-right text-xs font-normal transition-colors ${
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
    const colorKey = `${kind}Color` as keyof RenderStyle;
    const colorAlphaKey = `${kind}ColorAlpha` as keyof RenderStyle;
    const strokeWidthKey = `${kind}StrokeWidth` as keyof RenderStyle;
    const alignKey = `${kind}Align` as keyof RenderStyle;
    const spacingKey = `${kind}LetterSpacing` as keyof RenderStyle;
    const lineHeightKey = `${kind}LineHeight` as keyof RenderStyle;
    const objectAnimation = getVideoRenderObjects(renderStyle)[kind].animation;
    const setObjectAnimation = (updates: Partial<typeof objectAnimation>) =>
      updateRenderStyle(
        'videoTextAnimations',
        updateVideoTextAnimations(renderStyle, kind, updates),
      );
    const animation = objectAnimation.animation;
    const isTypewriter = animation === 'typewriter';
    const align = renderStyle[alignKey] as TextAlign;
    const typewriterMode = objectAnimation.typewriterMode;
    const normalizedTypewriterMode = typewriterMode === 'word' ? 'sentence' : typewriterMode;
    const characterModeLabel = formatVideoText(
      language,
      'componentsrendervideopanelsVideoExportSettingsPanelText528',
    );
    const sentenceModeLabel = formatVideoText(
      language,
      'componentsrendervideopanelsVideoExportSettingsPanelText529',
    );
    const lineModeLabel = formatVideoText(
      language,
      'componentsrendervideopanelsVideoExportSettingsPanelText530',
    );

    return (
      <div className={`space-y-2 rounded-xl p-2 ${toneClass}`}>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            {showSettingDescriptions && (
              <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">
                {isTitle
                  ? visible
                    ? formatVideoText(
                        language,
                        'componentsrendervideopanelsVideoExportSettingsPanelText540',
                      )
                    : formatVideoText(
                        language,
                        'componentsrendervideopanelsVideoExportSettingsPanelText541',
                      )
                  : formatVideoText(
                      language,
                      'componentsrendervideopanelsVideoExportSettingsPanelText542',
                    )}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (canToggle) setStyle(visibleKey, !visible as never);
              }}
              className={`flex h-9 w-full items-center justify-start gap-1 rounded-lg px-2 text-left text-[11px] font-normal ${
                isTitle
                  ? visible
                    ? 'bg-[#1d4ed8] text-white'
                    : 'bg-[var(--vr-surface-soft)] text-[var(--vr-text-muted)]'
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
            formatVideoText(language, 'componentsrendervideopanelsVideoExportSettingsPanelText572'),
            formatVideoText(language, 'componentsrendervideopanelsVideoExportSettingsPanelText573'),
          )}
          {iconNumber(
            ALargeSmall,
            <DragSizeControl
              label={formatVideoText(
                language,
                'componentsrendervideopanelsVideoExportSettingsPanelText578',
              )}
              value={renderStyle[fontSizeKey] as number}
              min={isTitle ? 18 : 16}
              max={isTitle ? 120 : 96}
              step={1}
              onChange={(value) => setStyle(fontSizeKey, value as never)}
            />,
          )}
        </div>
        <div
          className="pointer-events-none grid grid-cols-3 gap-2 select-none opacity-40 grayscale"
          title={formatVideoText(
            language,
            'componentsrendervideopanelsVideoExportSettingsPanelText589',
          )}
        >
          {iconSelect(
            Sparkles,
            `${kind}-animation`,
            animation,
            (value) => setObjectAnimation({ animation: value as TextAnimation }),
            getVideoTextAnimationOptions(language),
            formatVideoText(language, 'componentsrendervideopanelsVideoExportSettingsPanelText604'),
            formatVideoText(language, 'componentsrendervideopanelsVideoExportSettingsPanelText605'),
          )}
          {iconNumber(
            Timer,
            <DragSizeControl
              label={formatVideoText(
                language,
                'componentsrendervideopanelsVideoExportSettingsPanelText610',
              )}
              value={objectAnimation.durationMs}
              min={0}
              max={10000}
              step={50}
              unit="ms"
              onChange={(value) => setObjectAnimation({ durationMs: value })}
            />,
          )}
          {iconSelect(
            CaseSensitive,
            `${kind}-typewriter`,
            normalizedTypewriterMode,
            (value) => setObjectAnimation({ typewriterMode: value as TypewriterMode }),
            [
              { value: 'character', label: characterModeLabel },
              { value: 'sentence', label: sentenceModeLabel },
              { value: 'line', label: lineModeLabel },
            ],
            formatVideoText(language, 'componentsrendervideopanelsVideoExportSettingsPanelText633'),
            formatVideoText(language, 'componentsrendervideopanelsVideoExportSettingsPanelText634'),
            !isTypewriter,
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {iconColor(
            Palette,
            colorInputValue(renderStyle[colorKey] as string),
            (value) => setStyle(colorKey, value as never),
            formatVideoText(language, 'componentsrendervideopanelsVideoExportSettingsPanelText643'),
            formatVideoText(language, 'componentsrendervideopanelsVideoExportSettingsPanelText644'),
          )}
          {iconNumber(
            Blend,
            <DragSizeControl
              label={formatVideoText(
                language,
                'componentsrendervideopanelsVideoExportSettingsPanelText649',
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
              label={formatVideoText(
                language,
                'componentsrendervideopanelsVideoExportSettingsPanelText665',
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
                {formatVideoText(
                  language,
                  'componentsrendervideopanelsVideoExportSettingsPanelText682',
                )}
              </div>
            )}
            <div className="grid grid-cols-3 overflow-hidden rounded-lg bg-[var(--vr-surface-soft)]">
              {(['left', 'center', 'right'] as TextAlign[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStyle(alignKey, value as never)}
                  className={`h-9 text-xs font-normal ${
                    align === value
                      ? 'bg-[var(--vr-accent)] text-white'
                      : 'text-[var(--vr-text-soft)]'
                  }`}
                >
                  {value === 'left'
                    ? formatVideoText(
                        language,
                        'componentsrendervideopanelsVideoExportSettingsPanelText698',
                      )
                    : value === 'center'
                      ? formatVideoText(
                          language,
                          'componentsrendervideopanelsVideoExportSettingsPanelText700',
                        )
                      : formatVideoText(
                          language,
                          'componentsrendervideopanelsVideoExportSettingsPanelText701',
                        )}
                </button>
              ))}
            </div>
          </div>
          {iconNumber(
            BetweenHorizontalStart,
            <DragSizeControl
              label={formatVideoText(
                language,
                'componentsrendervideopanelsVideoExportSettingsPanelText709',
              )}
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
              label={formatVideoText(
                language,
                'componentsrendervideopanelsVideoExportSettingsPanelText720',
              )}
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
          <span className="truncate">
            {formatVideoText(
              language,
              'componentsrendervideopanelsVideoExportSettingsPanelText742',
            )}
          </span>
          <button
            type="button"
            onClick={() => setShowSettingDescriptions((current) => !current)}
            className={`ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
              showSettingDescriptions
                ? 'bg-[var(--vr-surface)] text-[var(--vr-text)] ring-1 ring-[var(--vr-border)]'
                : 'bg-[var(--vr-surface-soft)] text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'
            }`}
            title={
              showSettingDescriptions
                ? formatVideoText(
                    language,
                    'componentsrendervideopanelsVideoExportSettingsPanelText753',
                  )
                : formatVideoText(
                    language,
                    'componentsrendervideopanelsVideoExportSettingsPanelText754',
                  )
            }
            aria-label={
              showSettingDescriptions
                ? formatVideoText(
                    language,
                    'componentsrendervideopanelsVideoExportSettingsPanelText758',
                  )
                : formatVideoText(
                    language,
                    'componentsrendervideopanelsVideoExportSettingsPanelText759',
                  )
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
              className={`flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-black transition-colors ${
                exportSettingsMode === mode
                  ? 'bg-[var(--vr-accent)] text-white shadow-sm'
                  : 'text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'
              }`}
              title={
                mode === 'video'
                  ? formatVideoText(
                      language,
                      'componentsrendervideopanelsVideoExportSettingsPanelText778',
                    )
                  : formatVideoText(
                      language,
                      'componentsrendervideopanelsVideoExportSettingsPanelText779',
                    )
              }
              aria-pressed={exportSettingsMode === mode}
            >
              {mode === 'video' ? (
                <Video className="h-3.5 w-3.5" />
              ) : (
                <Music className="h-3.5 w-3.5" />
              )}
              {mode === 'video'
                ? formatVideoText(
                    language,
                    'componentsrendervideopanelsVideoExportSettingsPanelText788',
                  )
                : formatVideoText(
                    language,
                    'componentsrendervideopanelsVideoExportSettingsPanelText788_2',
                  )}
            </button>
          ))}
        </div>
      </div>
      <div className="video-render-scroll min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
        {exportSettingsMode === 'video' ? (
          <div className="flex flex-col gap-4">
            {showCanvasSettings && (
              <CanvasSettingsSection
                language={language}
                showDescriptions={showSettingDescriptions}
                variant="video"
                value={normalizeSharedCanvasSettings({
                  ...videoCanvasOptions,
                  ...canvasSettings,
                  canvasWidth: resolutionWidth,
                  canvasHeight: resolutionHeight,
                  canvasRatioWidth,
                  canvasRatioHeight,
                  canvasRatioLocked,
                  hideCharacterTags,
                  hideSceneTags,
                })}
                onChange={(patch) => {
                  setVideoCanvasOptions((current) =>
                    normalizeSharedCanvasSettings({ ...current, ...patch }),
                  );
                  onCanvasSettingsChange(patch);
                  if (patch.canvasWidth !== undefined) setResolutionWidth(patch.canvasWidth);
                  if (patch.canvasHeight !== undefined) setResolutionHeight(patch.canvasHeight);
                  if (patch.canvasRatioWidth !== undefined)
                    setCanvasRatioWidth(patch.canvasRatioWidth);
                  if (patch.canvasRatioHeight !== undefined)
                    setCanvasRatioHeight(patch.canvasRatioHeight);
                  if (patch.canvasRatioLocked !== undefined)
                    setCanvasRatioLocked(patch.canvasRatioLocked);
                  if (patch.hideCharacterTags !== undefined)
                    setHideCharacterTags(patch.hideCharacterTags);
                  if (patch.hideSceneTags !== undefined) setHideSceneTags(patch.hideSceneTags);
                }}
              />
            )}

            <RenderObjectSettingsSection
              language={language}
              renderStyle={renderStyle}
              updateRenderStyle={updateRenderStyle}
              canvasSettings={canvasSettings}
              onCanvasSettingsChange={onCanvasSettingsChange}
              surface="video"
              showDescriptions={showSettingDescriptions}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                {formatVideoText(
                  language,
                  'componentsrendervideopanelsVideoExportSettingsPanelText846',
                )}
              </div>
              <div className="space-y-3 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-3">
                <p className="text-xs font-bold leading-5 text-[var(--vr-text-muted)]">
                  {selectedAudioClipCount > 0
                    ? formatVideoText(
                        language,
                        'componentsrendervideopanelsVideoExportSettingsPanelText851',
                        selectedAudioClipCount,
                      )
                    : formatVideoText(
                        language,
                        'componentsrendervideopanelsVideoExportSettingsPanelText856',
                      )}
                </p>
                <RangeControl
                  label={formatVideoText(
                    language,
                    'componentsrendervideopanelsVideoExportSettingsPanelText863',
                  )}
                  min={0}
                  max={1}
                  step={0.01}
                  value={selectedAudioVolume}
                  valueLabel={`${Math.round(selectedAudioVolume * 100)}%`}
                  disabled={selectedAudioClipCount === 0}
                  onChange={(value) => updateSelectedAudioSettings('volume', value)}
                />
                <RangeControl
                  label={formatVideoText(
                    language,
                    'componentsrendervideopanelsVideoExportSettingsPanelText873',
                  )}
                  min={0}
                  max={10}
                  step={0.1}
                  value={selectedAudioFadeIn}
                  valueLabel={`${Number(selectedAudioFadeIn).toFixed(1)}s`}
                  disabled={selectedAudioClipCount === 0}
                  onChange={(value) => updateSelectedAudioSettings('fadeIn', value)}
                />
                <RangeControl
                  label={formatVideoText(
                    language,
                    'componentsrendervideopanelsVideoExportSettingsPanelText883',
                  )}
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
                {formatVideoText(
                  language,
                  'componentsrendervideopanelsVideoExportSettingsPanelText897',
                )}
              </div>
              <div className="rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-3 space-y-3">
                <p className="text-xs font-bold leading-5 text-[var(--vr-text-muted)]">
                  {formatVideoText(
                    language,
                    'componentsrendervideopanelsVideoExportSettingsPanelText901',
                    selectedSpeechNodeCount,
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
                  {formatVideoText(
                    language,
                    'componentsrendervideopanelsVideoExportSettingsPanelText918',
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                {formatVideoText(
                  language,
                  'componentsrendervideopanelsVideoExportSettingsPanelText925',
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => assetUploadInputRef.current?.click()}
                  className="flex h-10 min-w-0 items-center justify-center gap-2 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-3 text-xs font-black text-[var(--vr-text-soft)] transition-colors hover:border-[var(--vr-border-strong)] hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)]"
                >
                  <FolderOpen className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {formatVideoText(
                      language,
                      'componentsrendervideopanelsVideoExportSettingsPanelText935',
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={isRecordingVoiceover ? stopVoiceoverRecording : startVoiceoverRecording}
                  className={`flex h-10 min-w-0 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black transition-colors ${
                    isRecordingVoiceover
                      ? 'bg-rose-500 text-white hover:bg-rose-600'
                      : 'border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] hover:border-[var(--vr-border-strong)] hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)]'
                  }`}
                >
                  <Mic className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {isRecordingVoiceover
                      ? formatVideoText(
                          language,
                          'componentsrendervideopanelsVideoExportSettingsPanelText950',
                        )
                      : formatVideoText(
                          language,
                          'componentsrendervideopanelsVideoExportSettingsPanelText951',
                        )}
                  </span>
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-3 py-2 text-xs font-bold leading-5 text-[var(--vr-text-muted)]">
              {audioMessage ||
                formatVideoText(
                  language,
                  'componentsrendervideopanelsVideoExportSettingsPanelText959',
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
            {formatVideoText(
              language,
              'componentsrendervideopanelsVideoExportSettingsPanelText987',
            )}
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
      {description && (
        <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">{description}</div>
      )}
      <div
        className={`grid h-9 items-center overflow-hidden rounded-lg bg-[var(--vr-surface-soft)] ${
          hasIcon ? 'grid-cols-[28px_minmax(0,1fr)]' : 'grid-cols-1'
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
      className={`flex h-9 w-full min-w-0 items-center justify-center gap-1 border-0 px-2 text-[10px] font-black transition-colors ${
        active && highlightActive
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
            className={`flex h-9 min-w-0 items-center justify-center gap-1 border-0 px-2 text-[10px] font-black transition-colors ${
              active
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

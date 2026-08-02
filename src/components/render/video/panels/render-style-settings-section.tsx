import { formatVideoText, getVideoTextAnimationOptions } from '../i18n';
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
import type { ComponentType } from 'react';
import { useEffect, useRef, useState } from 'react';

import { DragSizeControl } from '../controls/RenderControls';
import { getVideoRenderObjects, updateVideoTextAnimations } from '../shared/renderObjects';
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
  const [activeNameplateGradientStopId, setActiveNameplateGradientStopId] = useState<string | null>(
    null,
  );
  const [openSelectId, setOpenSelectId] = useState<string | null>(null);
  const gradientEditorRef = useRef<HTMLDivElement | null>(null);
  const nameplateGradientEditorRef = useRef<HTMLDivElement | null>(null);
  const [showSolidColorMenu, setShowSolidColorMenu] = useState(false);
  const solidColorEditorRef = useRef<HTMLDivElement | null>(null);
  const [showNameplateStyleMenu, setShowNameplateStyleMenu] = useState(false);
  const nameplateStyleEditorRef = useRef<HTMLDivElement | null>(null);

  const activeGradientStop = activeGradientStopId
    ? gradientStops.find((stop) => stop.id === activeGradientStopId)
    : null;
  const nameplateGradientStops =
    renderStyle.nameplateGradientStops?.length >= 2
      ? [...renderStyle.nameplateGradientStops].sort((a, b) => a.position - b.position)
      : [
          { id: 'start', color: '#6366f1', alpha: 92, position: 0 },
          { id: 'end', color: '#ec4899', alpha: 82, position: 100 },
        ];
  const nameplateGradientStart = nameplateGradientStops[0];
  const nameplateGradientEnd = nameplateGradientStops[nameplateGradientStops.length - 1];
  const activeNameplateGradientStop = activeNameplateGradientStopId
    ? nameplateGradientStops.find((stop) => stop.id === activeNameplateGradientStopId)
    : null;
  const nameplateGradientCssStops = nameplateGradientStops
    .map((stop) => `${withAlpha(stop.color, stop.alpha / 100)} ${stop.position}%`)
    .join(', ');

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
    if (!activeNameplateGradientStopId) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!nameplateGradientEditorRef.current?.contains(event.target as Node)) {
        setActiveNameplateGradientStopId(null);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [activeNameplateGradientStopId]);

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

  useEffect(() => {
    if (!showNameplateStyleMenu) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!nameplateStyleEditorRef.current?.contains(event.target as Node)) {
        setShowNameplateStyleMenu(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [showNameplateStyleMenu]);

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

  const updateNameplateGradientStops = (
    updater: (
      stops: Array<{ id: string; color: string; alpha: number; position: number }>,
    ) => Array<{ id: string; color: string; alpha: number; position: number }>,
  ) => {
    const nextStops = updater(nameplateGradientStops).sort((a, b) => a.position - b.position);
    updateRenderStyle('nameplateGradientStops', nextStops);
  };

  const removeNameplateGradientStop = (targetId = activeNameplateGradientStopId) => {
    updateNameplateGradientStops((stops) => {
      if (stops.length <= 2) return stops;
      const idToRemove = targetId || stops[stops.length - 1]?.id;
      const nextStops = stops.filter((stop) => stop.id !== idToRemove);
      setActiveNameplateGradientStopId(nextStops[0]?.id || null);
      return nextStops;
    });
  };

  const getRawGradientPointerPosition = (
    event: React.PointerEvent<HTMLElement> | React.MouseEvent<HTMLElement>,
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.round(Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)));
  };

  const addNameplateGradientStopAt = (position: number) => {
    const previousStop =
      [...nameplateGradientStops].reverse().find((stop) => stop.position <= position) ||
      nameplateGradientStops[0];
    const nextStop =
      nameplateGradientStops.find((stop) => stop.position >= position) || previousStop;
    const nextId = `nameplate-stop-${Date.now().toString(36)}`;
    updateNameplateGradientStops((stops) => [
      ...stops,
      {
        id: nextId,
        color: nextStop?.color || previousStop?.color || '#6366f1',
        alpha: Math.round(((previousStop?.alpha ?? 86) + (nextStop?.alpha ?? 86)) / 2),
        position,
      },
    ]);
    setActiveNameplateGradientStopId(nextId);
  };

  const setStyle = <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) =>
    updateRenderStyle(key, value);

  const fadedStripStyle = (rgb: string) => ({
    background: `linear-gradient(90deg, rgba(${rgb}, 0) 0%, rgba(${rgb}, 0) 32%, rgba(${rgb}, 0.18) 58%, rgba(${rgb}, 0.62) 100%)`,
  });

  const lockedStripStyle = () => ({
    left: 'calc((100% - 1rem) / 3 + 0.5rem)',
  });

  const renderCollapsibleRows = (open: boolean, children: React.ReactNode) => (
    <div
      aria-hidden={!open}
      className={`grid transition-[grid-template-rows,opacity,transform] duration-200 ease-out ${
        open
          ? 'grid-rows-[1fr] translate-y-0 opacity-100'
          : 'pointer-events-none grid-rows-[0fr] -translate-y-1 opacity-0'
      }`}
    >
      <div className={`min-h-0 ${open ? 'overflow-visible' : 'overflow-hidden'}`}>
        <div className="space-y-2">{children}</div>
      </div>
    </div>
  );

  const iconShell = (
    Icon: ComponentType<{ className?: string }>,
    children: React.ReactNode,
    disabled = false,
    description?: string,
  ) => (
    <div className={`space-y-1 ${disabled ? 'opacity-40' : ''}`}>
      {showDescriptions && description && (
        <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">{description}</div>
      )}
      <div className="grid h-10 grid-cols-[28px_minmax(0,1fr)] items-stretch rounded-lg bg-[var(--vr-surface-soft)]">
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
          className={`flex w-full min-w-0 items-center justify-end gap-1.5 rounded-r-lg bg-transparent px-2 text-right text-xs font-normal text-[var(--vr-text)] outline-none transition-colors hover:bg-white/5 disabled:cursor-default ${
            showDescriptions ? 'h-9' : 'h-10'
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
      'componentsrendervideopanelsrenderStyleSettingsSectionText536',
    );
    const sentenceModeLabel = formatVideoText(
      language,
      'componentsrendervideopanelsrenderStyleSettingsSectionText537',
    );
    const lineModeLabel = formatVideoText(
      language,
      'componentsrendervideopanelsrenderStyleSettingsSectionText538',
    );
    const showDetailRows = !isTitle || visible;
    const visibilityButtonClass = isTitle
      ? visible
        ? 'border border-indigo-500/25 bg-indigo-500/15 text-indigo-500 hover:border-indigo-500/40 hover:bg-indigo-500/20 dark:text-indigo-300'
        : 'relative z-30 bg-[var(--vr-surface-soft)] text-[var(--vr-text-muted)] hover:bg-indigo-500/10 hover:text-indigo-300'
      : visible
        ? 'bg-white/12 text-[var(--vr-text)]'
        : 'bg-[var(--vr-surface-soft)] text-[var(--vr-text-muted)]';

    return (
      <div className={`space-y-2 rounded-xl p-2 ${toneClass}`}>
        <div className="relative grid grid-cols-3 gap-2 rounded-lg">
          <div className="space-y-1">
            {showDescriptions && (
              <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">
                {isTitle
                  ? formatVideoText(
                      language,
                      'componentsrendervideopanelsrenderStyleSettingsSectionText554',
                    )
                  : formatVideoText(
                      language,
                      'componentsrendervideopanelsrenderStyleSettingsSectionText554_2',
                    )}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (canToggle) setStyle(visibleKey, !visible as never);
              }}
              className={`flex h-9 w-full items-center justify-start gap-1 rounded-lg px-2 text-left text-[11px] font-normal transition-colors ${visibilityButtonClass} ${canToggle ? '' : 'cursor-default'}`}
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
            formatVideoText(
              language,
              'componentsrendervideopanelsrenderStyleSettingsSectionText576',
            ),
            formatVideoText(
              language,
              'componentsrendervideopanelsrenderStyleSettingsSectionText577',
            ),
          )}
          {iconNumber(
            ALargeSmall,
            <DragSizeControl
              label={formatVideoText(
                language,
                'componentsrendervideopanelsrenderStyleSettingsSectionText582',
              )}
              value={renderStyle[fontSizeKey] as number}
              min={isTitle ? 18 : 16}
              max={isTitle ? 120 : 96}
              step={1}
              onChange={(value) => setStyle(fontSizeKey, value as never)}
            />,
            formatVideoText(
              language,
              'componentsrendervideopanelsrenderStyleSettingsSectionText589',
            ),
          )}
          {isTitle && !visible && (
            <>
              <div
                className="render-settings-overlay-in pointer-events-none absolute -bottom-2 -left-2 -right-2 -top-2 z-10 rounded-xl"
                style={fadedStripStyle('79, 70, 229')}
                aria-hidden="true"
              />
              <div
                className="absolute -bottom-2 -right-2 -top-2 z-20 cursor-not-allowed rounded-r-xl"
                style={lockedStripStyle()}
                aria-hidden="true"
              />
            </>
          )}
        </div>
        {renderCollapsibleRows(
          showDetailRows,
          <>
            <div
              className="pointer-events-none grid grid-cols-3 gap-2 select-none opacity-40 grayscale"
              title={formatVideoText(
                language,
                'componentsrendervideopanelsrenderStyleSettingsSectionText609',
              )}
            >
              {iconSelect(
                Sparkles,
                `${kind}-animation`,
                animation,
                (value) => setObjectAnimation({ animation: value as TextAnimation }),
                getVideoTextAnimationOptions(language),
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText619',
                ),
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText620',
                ),
              )}
              {iconNumber(
                Timer,
                <DragSizeControl
                  label={formatVideoText(
                    language,
                    'componentsrendervideopanelsrenderStyleSettingsSectionText625',
                  )}
                  value={objectAnimation.durationMs}
                  min={0}
                  max={10000}
                  step={50}
                  unit="ms"
                  onChange={(value) => setObjectAnimation({ durationMs: value })}
                />,
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText633',
                ),
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
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText645',
                ),
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText646',
                ),
                !isTypewriter,
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {iconColor(
                Palette,
                colorInputValue(renderStyle[colorKey] as string),
                (value) => setStyle(colorKey, value as never),
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText655',
                ),
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText656',
                ),
              )}
              {iconNumber(
                Blend,
                <DragSizeControl
                  label={formatVideoText(
                    language,
                    'componentsrendervideopanelsrenderStyleSettingsSectionText661',
                  )}
                  value={renderStyle[colorAlphaKey] as number}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  onChange={(value) => setStyle(colorAlphaKey, value as never)}
                />,
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText669',
                ),
              )}
              {iconNumber(
                Baseline,
                <DragSizeControl
                  label={formatVideoText(
                    language,
                    'componentsrendervideopanelsrenderStyleSettingsSectionText674',
                  )}
                  value={renderStyle[strokeWidthKey] as number}
                  min={0}
                  max={16}
                  step={0.5}
                  onChange={(value) => setStyle(strokeWidthKey, value as never)}
                />,
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText681',
                ),
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                {showDescriptions && (
                  <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">
                    {formatVideoText(
                      language,
                      'componentsrendervideopanelsrenderStyleSettingsSectionText688',
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
                            'componentsrendervideopanelsrenderStyleSettingsSectionText701',
                          )
                        : value === 'center'
                          ? formatVideoText(
                              language,
                              'componentsrendervideopanelsrenderStyleSettingsSectionText701_2',
                            )
                          : formatVideoText(
                              language,
                              'componentsrendervideopanelsrenderStyleSettingsSectionText701_3',
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
                    'componentsrendervideopanelsrenderStyleSettingsSectionText709',
                  )}
                  value={renderStyle[spacingKey] as number}
                  min={-4}
                  max={24}
                  step={0.5}
                  onChange={(value) => setStyle(spacingKey, value as never)}
                />,
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText716',
                ),
              )}
              {iconNumber(
                BetweenVerticalStart,
                <DragSizeControl
                  label={formatVideoText(
                    language,
                    'componentsrendervideopanelsrenderStyleSettingsSectionText721',
                  )}
                  value={renderStyle[lineHeightKey] as number}
                  min={0.8}
                  max={2.4}
                  step={0.05}
                  unit="x"
                  onChange={(value) => setStyle(lineHeightKey, value as never)}
                />,
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText729',
                ),
              )}
            </div>
          </>,
        )}
      </div>
    );
  };

  const updateNameplateGradientEdge = (
    edge: 'start' | 'end',
    updates: Partial<{ color: string; alpha: number }>,
  ) => {
    const targetIndex = edge === 'start' ? 0 : nameplateGradientStops.length - 1;
    updateRenderStyle(
      'nameplateGradientStops',
      nameplateGradientStops.map((stop, index) =>
        index === targetIndex ? { ...stop, ...updates } : stop,
      ),
    );
  };

  const renderNameplateStyleMenu = () => (
    <div
      ref={nameplateStyleEditorRef}
      className={`relative ${showNameplateStyleMenu ? 'z-[10000]' : 'z-0'}`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {iconShell(
        Palette,
        <button
          type="button"
          onClick={() => setShowNameplateStyleMenu(!showNameplateStyleMenu)}
          className="flex h-10 w-full items-stretch rounded-r-lg bg-transparent p-1"
          title={formatVideoText(
            language,
            'componentsrendervideopanelsrenderStyleSettingsSectionText764',
          )}
        >
          <div
            className="flex-1 rounded-md border border-white/10"
            style={{
              background:
                renderStyle.nameplateBackgroundType === 'gradient'
                  ? `linear-gradient(${renderStyle.nameplateGradientAngle}deg, ${nameplateGradientStops
                      .map((stop) => `${withAlpha(stop.color, stop.alpha / 100)} ${stop.position}%`)
                      .join(', ')})`
                  : renderStyle.nameplateBackgroundType === 'image' && renderStyle.nameplateImageUrl
                    ? `center / cover url("${renderStyle.nameplateImageUrl.replace(/"/g, '\\"')}")`
                    : withAlpha(
                        renderStyle.nameplateColor,
                        (renderStyle.nameplateColorAlpha ?? 86) / 100,
                      ),
            }}
          />
        </button>,
        false,
        formatVideoText(language, 'componentsrendervideopanelsrenderStyleSettingsSectionText784'),
      )}
      {showNameplateStyleMenu && (
        <div
          className="absolute right-0 top-[calc(100%+6px)] z-[9999] w-[230px] rounded-xl border border-[var(--vr-border)] bg-white p-3 shadow-2xl shadow-black/30"
          style={{
            ['--vr-surface' as any]: '#ffffff',
            ['--vr-surface-soft' as any]: '#f1f5f9',
            ['--vr-text' as any]: '#1e293b',
            ['--vr-border' as any]: '#e2e8f0',
            ['--vr-accent-soft' as any]: 'rgba(99, 102, 241, 0.1)',
          }}
        >
          {renderStyle.nameplateBackgroundType === 'solid' && (
            <div className="space-y-3">
              <div className="grid grid-cols-[36px_1fr] items-center gap-2">
                <input
                  type="color"
                  value={colorInputValue(renderStyle.nameplateColor)}
                  onChange={(event) => updateRenderStyle('nameplateColor', event.target.value)}
                  className="h-8 w-full cursor-pointer rounded-lg border-0 bg-transparent p-0"
                />
                <input
                  type="text"
                  value={renderStyle.nameplateColor}
                  onChange={(event) => updateRenderStyle('nameplateColor', event.target.value)}
                  className="h-8 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-2 text-xs text-[var(--vr-text)] outline-none focus:border-[var(--vr-accent)]"
                />
              </div>
              <DragSizeControl
                label={formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText814',
                )}
                value={renderStyle.nameplateColorAlpha ?? 86}
                min={0}
                max={100}
                step={1}
                unit="%"
                onChange={(value) => updateRenderStyle('nameplateColorAlpha', value)}
              />
            </div>
          )}
          {renderStyle.nameplateBackgroundType === 'gradient' && (
            <div ref={nameplateGradientEditorRef} className="space-y-3">
              <DragSizeControl
                label={formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText827',
                )}
                value={renderStyle.nameplateGradientAngle}
                min={0}
                max={360}
                step={1}
                unit="°"
                onChange={(value) => updateRenderStyle('nameplateGradientAngle', value)}
              />
              <div className="grid grid-cols-[32px_minmax(0,1fr)_32px] items-center gap-2">
                <button
                  type="button"
                  disabled={nameplateGradientStops.length <= 2}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    removeNameplateGradientStop();
                  }}
                  className="h-8 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] text-sm font-bold text-[var(--vr-text-soft)] hover:bg-[var(--vr-accent-soft)] disabled:opacity-30"
                  title={formatVideoText(
                    language,
                    'componentsrendervideopanelsrenderStyleSettingsSectionText845',
                  )}
                >
                  -
                </button>
                <div
                  className="relative h-10 rounded-lg"
                  style={{ background: `linear-gradient(90deg, ${nameplateGradientCssStops})` }}
                  onPointerDown={(event) => {
                    if ((event.target as HTMLElement).dataset.nameplateGradientStopId) return;
                    addNameplateGradientStopAt(getRawGradientPointerPosition(event));
                  }}
                >
                  {nameplateGradientStops.map((stop) => (
                    <button
                      key={stop.id}
                      type="button"
                      data-nameplate-gradient-stop-id={stop.id}
                      className={`absolute top-1/2 h-6 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border shadow ${
                        activeNameplateGradientStop?.id === stop.id
                          ? 'border-white ring-2 ring-[var(--vr-accent)]'
                          : 'border-white/80'
                      }`}
                      style={{
                        left: `${stop.position}%`,
                        backgroundColor: withAlpha(stop.color, stop.alpha / 100),
                      }}
                      onClick={(event) => {
                        event.stopPropagation();
                        setActiveNameplateGradientStopId(stop.id);
                      }}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        setActiveNameplateGradientStopId(stop.id);
                        event.currentTarget.setPointerCapture(event.pointerId);
                      }}
                      onPointerMove={(event) => {
                        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
                        const track = event.currentTarget.parentElement;
                        if (!track) return;
                        const rect = track.getBoundingClientRect();
                        const position = Math.round(
                          Math.min(
                            100,
                            Math.max(0, ((event.clientX - rect.left) / rect.width) * 100),
                          ),
                        );
                        updateNameplateGradientStops((stops) =>
                          stops.map((item) => (item.id === stop.id ? { ...item, position } : item)),
                        );
                      }}
                      onPointerUp={(event) => {
                        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                          event.currentTarget.releasePointerCapture(event.pointerId);
                        }
                      }}
                      aria-label={formatVideoText(
                        language,
                        'componentsrendervideopanelsrenderStyleSettingsSectionText902',
                      )}
                    />
                  ))}
                  {activeNameplateGradientStop && (
                    <div
                      className="absolute top-[calc(100%+6px)] z-[9999] rounded-xl border border-[var(--vr-border)] bg-white p-2 shadow-lg"
                      onClick={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}
                      style={{
                        left: `max(8px, min(calc(${activeNameplateGradientStop.position}% - 105px), calc(100% - 218px)))`,
                        width: '210px',
                        maxWidth: 'calc(100% - 16px)',
                        ['--vr-surface' as any]: '#ffffff',
                        ['--vr-surface-soft' as any]: '#f1f5f9',
                        ['--vr-text' as any]: '#1e293b',
                        ['--vr-border' as any]: '#e2e8f0',
                      }}
                    >
                      <div
                        className="absolute -top-1 h-2 w-2 rotate-45 border-l border-t border-[var(--vr-border)] bg-white"
                        style={{
                          left: `calc(${activeNameplateGradientStop.position}% - max(8px, min(calc(${activeNameplateGradientStop.position}% - 105px), calc(100% - 218px))))`,
                        }}
                      />
                      <div className="grid grid-cols-[42px_1fr_28px] items-center gap-2">
                        <input
                          type="color"
                          value={colorInputValue(activeNameplateGradientStop.color)}
                          onPointerDown={(event) => event.stopPropagation()}
                          onChange={(event) =>
                            updateNameplateGradientStops((stops) =>
                              stops.map((item) =>
                                item.id === activeNameplateGradientStop.id
                                  ? { ...item, color: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          className="h-8 w-full cursor-pointer rounded-lg border-0 bg-transparent p-0"
                        />
                        <DragSizeControl
                          label={formatVideoText(
                            language,
                            'componentsrendervideopanelsrenderStyleSettingsSectionText943',
                          )}
                          value={activeNameplateGradientStop.alpha}
                          min={0}
                          max={100}
                          step={1}
                          unit="%"
                          onChange={(value) =>
                            updateNameplateGradientStops((stops) =>
                              stops.map((item) =>
                                item.id === activeNameplateGradientStop.id
                                  ? { ...item, alpha: value }
                                  : item,
                              ),
                            )
                          }
                        />
                        <button
                          type="button"
                          disabled={nameplateGradientStops.length <= 2}
                          onPointerDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            removeNameplateGradientStop(activeNameplateGradientStop.id);
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
                    addNameplateGradientStopAt(
                      Math.min(
                        100,
                        Math.max(0, (activeNameplateGradientStop?.position ?? 50) + 10),
                      ),
                    )
                  }
                  className="h-8 rounded-lg bg-[var(--vr-surface-soft)] text-sm font-normal text-[var(--vr-text-soft)] hover:bg-[var(--vr-accent-soft)]"
                  title={formatVideoText(
                    language,
                    'componentsrendervideopanelsrenderStyleSettingsSectionText986',
                  )}
                >
                  +
                </button>
              </div>
              {(['start', 'end'] as const).map((edge) => {
                const stop = edge === 'start' ? nameplateGradientStart : nameplateGradientEnd;
                return (
                  <div key={edge} className="grid grid-cols-[32px_1fr_54px] items-center gap-2">
                    <input
                      type="color"
                      value={colorInputValue(stop.color)}
                      onChange={(event) =>
                        updateNameplateGradientEdge(edge, { color: event.target.value })
                      }
                      className="h-8 w-full cursor-pointer rounded-lg border-0 bg-transparent p-0"
                    />
                    <input
                      type="text"
                      value={stop.color}
                      onChange={(event) =>
                        updateNameplateGradientEdge(edge, { color: event.target.value })
                      }
                      className="h-8 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-2 text-xs text-[var(--vr-text)] outline-none focus:border-[var(--vr-accent)]"
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={stop.alpha}
                      onChange={(event) =>
                        updateNameplateGradientEdge(edge, {
                          alpha: Math.min(100, Math.max(0, Number(event.target.value) || 0)),
                        })
                      }
                      className="h-8 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-1 text-center text-xs text-[var(--vr-text)] outline-none focus:border-[var(--vr-accent)]"
                    />
                  </div>
                );
              })}
            </div>
          )}
          {renderStyle.nameplateBackgroundType === 'image' && (
            <div className="space-y-2">
              <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[var(--vr-surface-soft)] px-2 text-xs text-[var(--vr-text)] hover:bg-white/5">
                <ImagePlus className="h-3.5 w-3.5" />
                {renderStyle.nameplateImageUrl
                  ? formatVideoText(
                      language,
                      'componentsrendervideopanelsrenderStyleSettingsSectionText1033',
                    )
                  : formatVideoText(
                      language,
                      'componentsrendervideopanelsrenderStyleSettingsSectionText1034',
                    )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () =>
                      updateRenderStyle('nameplateImageUrl', String(reader.result || ''));
                    reader.readAsDataURL(file);
                    event.target.value = '';
                  }}
                />
              </label>
              {renderStyle.nameplateImageUrl && (
                <button
                  type="button"
                  onClick={() => updateRenderStyle('nameplateImageUrl', '')}
                  className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-rose-500/10 px-2 text-xs text-rose-400 hover:bg-rose-500/15"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {formatVideoText(
                    language,
                    'componentsrendervideopanelsrenderStyleSettingsSectionText1056',
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const dialogLayerRaised =
    showSolidColorMenu ||
    Boolean(activeGradientStopId) ||
    openSelectId === 'dialog-background-type';
  const nameplateLayerRaised =
    showNameplateStyleMenu ||
    openSelectId === 'nameplate-background-type' ||
    openSelectId === 'nameplate-font-family';

  return (
    <div className="space-y-2">
      {renderTextStyleSection(
        'title',
        formatVideoText(language, 'componentsrendervideopanelsrenderStyleSettingsSectionText1077'),
        'bg-indigo-500/5',
        true,
      )}
      {renderTextStyleSection(
        'body',
        formatVideoText(language, 'componentsrendervideopanelsrenderStyleSettingsSectionText1078'),
        'bg-blue-500/5',
        false,
      )}

      <div
        className={`relative space-y-2 rounded-xl bg-violet-500/5 p-2 ${
          dialogLayerRaised ? 'z-[10000]' : 'z-0'
        }`}
      >
        <div className="relative grid grid-cols-3 gap-2 rounded-lg">
          <div className="space-y-1">
            {showDescriptions && (
              <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">
                {formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText1089',
                )}
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
              title={formatVideoText(
                language,
                'componentsrendervideopanelsrenderStyleSettingsSectionText1100',
              )}
            >
              {renderStyle.dialogVisible ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
              {formatVideoText(
                language,
                'componentsrendervideopanelsrenderStyleSettingsSectionText1103',
              )}
            </button>
          </div>
          {iconNumber(
            RectangleHorizontal,
            <DragSizeControl
              label={formatVideoText(
                language,
                'componentsrendervideopanelsrenderStyleSettingsSectionText1109',
              )}
              value={renderStyle.dialogWidth}
              min={35}
              max={100}
              step={1}
              unit="%"
              onChange={(value) => updateRenderStyle('dialogWidth', value)}
            />,
            formatVideoText(
              language,
              'componentsrendervideopanelsrenderStyleSettingsSectionText1117',
            ),
          )}
          {iconNumber(
            RectangleVertical,
            <DragSizeControl
              label={formatVideoText(
                language,
                'componentsrendervideopanelsrenderStyleSettingsSectionText1122',
              )}
              value={renderStyle.dialogHeight}
              min={16}
              max={75}
              step={1}
              unit="%"
              onChange={(value) => updateRenderStyle('dialogHeight', value)}
            />,
            formatVideoText(
              language,
              'componentsrendervideopanelsrenderStyleSettingsSectionText1130',
            ),
          )}
          {!renderStyle.dialogVisible && (
            <>
              <div
                className="render-settings-overlay-in pointer-events-none absolute -bottom-2 -left-2 -right-2 -top-2 z-10 rounded-xl"
                style={fadedStripStyle('139, 92, 246')}
                aria-hidden="true"
              />
              <div
                className="absolute -bottom-2 -right-2 -top-2 z-20 cursor-not-allowed rounded-r-xl"
                style={lockedStripStyle()}
                aria-hidden="true"
              />
            </>
          )}
        </div>
        {renderCollapsibleRows(
          renderStyle.dialogVisible,
          <>
            <div className="grid grid-cols-3 gap-2">
              {iconShell(
                RectangleVertical,
                <button
                  type="button"
                  disabled
                  className="flex h-9 w-full min-w-0 cursor-default items-center justify-end rounded-r-lg bg-transparent px-2 text-right text-xs font-normal text-[var(--vr-text)]"
                  title={formatVideoText(
                    language,
                    'componentsrendervideopanelsrenderStyleSettingsSectionText1157',
                  )}
                >
                  <span className="min-w-0 truncate">
                    {formatVideoText(
                      language,
                      'componentsrendervideopanelsrenderStyleSettingsSectionText1160',
                    )}
                  </span>
                </button>,
                false,
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText1164',
                ),
              )}
              {iconNumber(
                BetweenVerticalStart,
                <DragSizeControl
                  label={formatVideoText(
                    language,
                    'componentsrendervideopanelsrenderStyleSettingsSectionText1169',
                  )}
                  value={renderStyle.dialogTextOffsetY ?? 0}
                  min={-20}
                  max={40}
                  step={1}
                  unit="%"
                  onChange={(value) => updateRenderStyle('dialogTextOffsetY', value)}
                />,
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText1177',
                ),
              )}
              {iconShell(
                PanelLeftRightDashed,
                <div className="flex h-9 items-center justify-end rounded-r-lg px-2 text-xs text-[var(--vr-text-muted)]">
                  <span className="min-w-0 truncate">-</span>
                </div>,
                true,
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText1185',
                ),
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {iconNumber(
                MoveHorizontal,
                <DragSizeControl
                  label={formatVideoText(
                    language,
                    'componentsrendervideopanelsrenderStyleSettingsSectionText1192',
                  )}
                  value={renderStyle.dialogOffsetX ?? 0}
                  min={-100}
                  max={100}
                  step={1}
                  unit="%"
                  onChange={(value) => updateRenderStyle('dialogOffsetX', value)}
                />,
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText1200',
                ),
              )}
              {iconNumber(
                MoveVertical,
                <DragSizeControl
                  label={formatVideoText(
                    language,
                    'componentsrendervideopanelsrenderStyleSettingsSectionText1205',
                  )}
                  value={renderStyle.dialogOffsetY ?? 0}
                  min={-100}
                  max={100}
                  step={1}
                  unit="%"
                  onChange={(value) => updateRenderStyle('dialogOffsetY', value)}
                />,
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText1213',
                ),
              )}
              {iconNumber(
                PanelLeftRightDashed,
                <DragSizeControl
                  label={formatVideoText(
                    language,
                    'componentsrendervideopanelsrenderStyleSettingsSectionText1218',
                  )}
                  value={renderStyle.dialogTextPaddingX ?? 9}
                  min={2}
                  max={24}
                  step={1}
                  unit="%"
                  onChange={(value) => updateRenderStyle('dialogTextPaddingX', value)}
                />,
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText1226',
                ),
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {iconNumber(
                Radius,
                <DragSizeControl
                  label={formatVideoText(
                    language,
                    'componentsrendervideopanelsrenderStyleSettingsSectionText1233',
                  )}
                  value={renderStyle.dialogRadius}
                  min={0}
                  max={120}
                  step={1}
                  onChange={(value) => updateRenderStyle('dialogRadius', value)}
                />,
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText1240',
                ),
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
                  {
                    value: 'solid',
                    label: formatVideoText(
                      language,
                      'componentsrendervideopanelsrenderStyleSettingsSectionText1248',
                    ),
                  },
                  {
                    value: 'gradient',
                    label: formatVideoText(
                      language,
                      'componentsrendervideopanelsrenderStyleSettingsSectionText1251',
                    ),
                  },
                  {
                    value: 'image',
                    label: formatVideoText(
                      language,
                      'componentsrendervideopanelsrenderStyleSettingsSectionText1253',
                    ),
                  },
                ],
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText1255',
                ),
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText1256',
                ),
              )}
              {renderStyle.dialogBackgroundType === 'solid' && (
                <div
                  className={`relative ${showSolidColorMenu ? 'z-[10000]' : 'z-0'}`}
                  ref={solidColorEditorRef}
                >
                  {iconShell(
                    Palette,
                    <button
                      type="button"
                      onClick={() => setShowSolidColorMenu(!showSolidColorMenu)}
                      className="h-full w-full cursor-pointer rounded-r-lg border-0 p-1 bg-transparent flex items-stretch"
                      title={formatVideoText(
                        language,
                        'componentsrendervideopanelsrenderStyleSettingsSectionText1269',
                      )}
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
                    </button>,
                    false,
                    formatVideoText(
                      language,
                      'componentsrendervideopanelsrenderStyleSettingsSectionText1283',
                    ),
                  )}
                  {showSolidColorMenu && (
                    <div
                      className="absolute right-0 top-[calc(100%+6px)] z-[9999] rounded-xl border border-[var(--vr-border)] bg-white p-3 shadow-2xl shadow-black/30"
                      style={{
                        width: '210px',
                        ['--vr-surface' as any]: '#ffffff',
                        ['--vr-surface-soft' as any]: '#f1f5f9',
                        ['--vr-text' as any]: '#1e293b',
                        ['--vr-border' as any]: '#e2e8f0',
                        ['--vr-accent-soft' as any]: 'rgba(99, 102, 241, 0.1)',
                      }}
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
                            onChange={(event) =>
                              updateRenderStyle('panelColor', event.target.value)
                            }
                            className="h-8 w-full cursor-pointer rounded-lg border-0 bg-transparent p-0"
                          />
                          <input
                            type="text"
                            value={renderStyle.panelColor}
                            onPointerDown={(e) => e.stopPropagation()}
                            onChange={(event) =>
                              updateRenderStyle('panelColor', event.target.value)
                            }
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
                              const val = Math.min(
                                100,
                                Math.max(0, Number(event.target.value) || 0),
                              );
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
                    label={formatVideoText(
                      language,
                      'componentsrendervideopanelsrenderStyleSettingsSectionText1382',
                    )}
                    value={renderStyle.dialogGradientAngle}
                    min={0}
                    max={360}
                    step={1}
                    unit="°"
                    onChange={(value) => updateRenderStyle('dialogGradientAngle', value)}
                  />,
                  formatVideoText(
                    language,
                    'componentsrendervideopanelsrenderStyleSettingsSectionText1390',
                  ),
                )}
              {renderStyle.dialogBackgroundType === 'image' && (
                <div className="space-y-1">
                  {showDescriptions && (
                    <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">
                      {formatVideoText(
                        language,
                        'componentsrendervideopanelsrenderStyleSettingsSectionText1396',
                      )}
                    </div>
                  )}
                  <div
                    className={`grid h-9 items-center rounded-lg bg-[var(--vr-surface-soft)] ${
                      renderStyle.dialogImageUrl
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
                          ? formatVideoText(
                              language,
                              'componentsrendervideopanelsrenderStyleSettingsSectionText1409',
                            )
                          : formatVideoText(
                              language,
                              'componentsrendervideopanelsrenderStyleSettingsSectionText1409_2',
                            )
                      }
                      aria-label={
                        renderStyle.dialogImageUrl
                          ? formatVideoText(
                              language,
                              'componentsrendervideopanelsrenderStyleSettingsSectionText1410',
                            )
                          : formatVideoText(
                              language,
                              'componentsrendervideopanelsrenderStyleSettingsSectionText1410_2',
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
                        title={formatVideoText(
                          language,
                          'componentsrendervideopanelsrenderStyleSettingsSectionText1435',
                        )}
                        aria-label={formatVideoText(
                          language,
                          'componentsrendervideopanelsrenderStyleSettingsSectionText1436',
                        )}
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
                    title={formatVideoText(
                      language,
                      'componentsrendervideopanelsrenderStyleSettingsSectionText1457',
                    )}
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
                        aria-label={formatVideoText(
                          language,
                          'componentsrendervideopanelsrenderStyleSettingsSectionText1515',
                        )}
                      />
                    ))}
                    {activeGradientStop && (
                      <div
                        className="absolute top-[calc(100%+6px)] z-[9999] rounded-xl border border-[var(--vr-border)] bg-white p-2 shadow-lg"
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                        style={{
                          left: `max(8px, min(calc(${mapGradientStopToVisibleTrack(
                            activeGradientStop.position,
                          )}% - 105px), calc(100% - 218px)))`,
                          width: '210px',
                          maxWidth: 'calc(100% - 16px)',
                          ['--vr-surface' as any]: '#ffffff',
                          ['--vr-surface-soft' as any]: '#f1f5f9',
                          ['--vr-text' as any]: '#1e293b',
                          ['--vr-border' as any]: '#e2e8f0',
                        }}
                      >
                        <div
                          className="absolute -top-1 h-2 w-2 rotate-45 border-l border-t border-[var(--vr-border)] bg-white"
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
                            label={formatVideoText(
                              language,
                              'componentsrendervideopanelsrenderStyleSettingsSectionText1560',
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
                    title={formatVideoText(
                      language,
                      'componentsrendervideopanelsrenderStyleSettingsSectionText1596',
                    )}
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </>,
        )}
      </div>

      <div
        className={`relative space-y-2 rounded-xl bg-fuchsia-500/5 p-2 ${
          nameplateLayerRaised ? 'z-[10000]' : 'z-0'
        }`}
      >
        <div className="relative grid grid-cols-3 gap-2 rounded-lg">
          <div className="space-y-1">
            {showDescriptions && (
              <div className="px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">
                {formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText1616',
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => updateRenderStyle('nameplateVisible', !renderStyle.nameplateVisible)}
              className={`flex h-9 w-full items-center justify-start gap-1 rounded-lg px-2 text-left text-[11px] font-normal ${
                renderStyle.nameplateVisible
                  ? 'bg-fuchsia-500/15 text-fuchsia-500'
                  : 'bg-[var(--vr-surface-soft)] text-[var(--vr-text-muted)]'
              }`}
              title={formatVideoText(
                language,
                'componentsrendervideopanelsrenderStyleSettingsSectionText1627',
              )}
            >
              {renderStyle.nameplateVisible ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
              {formatVideoText(
                language,
                'componentsrendervideopanelsrenderStyleSettingsSectionText1630',
              )}
            </button>
          </div>
          {iconShell(
            RectangleVertical,
            <button
              type="button"
              onClick={() => updateRenderStyle('nameplateInside', !renderStyle.nameplateInside)}
              className={`flex h-9 w-full min-w-0 items-center justify-end rounded-r-lg px-2 text-right text-xs font-normal transition-colors ${
                renderStyle.nameplateInside
                  ? 'bg-fuchsia-500/15 text-fuchsia-500 hover:bg-fuchsia-500/20'
                  : 'bg-transparent text-[var(--vr-text)] hover:bg-white/5'
              }`}
              title={formatVideoText(
                language,
                'componentsrendervideopanelsrenderStyleSettingsSectionText1643',
              )}
            >
              <span className="min-w-0 truncate">
                {renderStyle.nameplateInside
                  ? formatVideoText(
                      language,
                      'componentsrendervideopanelsrenderStyleSettingsSectionText1647',
                    )
                  : formatVideoText(
                      language,
                      'componentsrendervideopanelsrenderStyleSettingsSectionText1648',
                    )}
              </span>
            </button>,
            false,
            formatVideoText(
              language,
              'componentsrendervideopanelsrenderStyleSettingsSectionText1652',
            ),
          )}
          {iconShell(
            FollowCharacterGlyph,
            <button
              type="button"
              onClick={() =>
                updateRenderStyle('nameplateFollowCharacter', !renderStyle.nameplateFollowCharacter)
              }
              className={`flex h-9 w-full min-w-0 items-center justify-end rounded-r-lg px-2 text-right text-xs font-normal transition-colors ${
                renderStyle.nameplateFollowCharacter
                  ? 'bg-fuchsia-500/15 text-fuchsia-500 hover:bg-fuchsia-500/20'
                  : 'bg-transparent text-[var(--vr-text)] hover:bg-white/5'
              }`}
              title={formatVideoText(
                language,
                'componentsrendervideopanelsrenderStyleSettingsSectionText1666',
              )}
            >
              <span className="min-w-0 truncate">
                {renderStyle.nameplateFollowCharacter
                  ? formatVideoText(
                      language,
                      'componentsrendervideopanelsrenderStyleSettingsSectionText1670',
                    )
                  : formatVideoText(
                      language,
                      'componentsrendervideopanelsrenderStyleSettingsSectionText1671',
                    )}
              </span>
            </button>,
            false,
            formatVideoText(
              language,
              'componentsrendervideopanelsrenderStyleSettingsSectionText1675',
            ),
          )}
          {!renderStyle.nameplateVisible && (
            <>
              <div
                className="render-settings-overlay-in pointer-events-none absolute -bottom-2 -left-2 -right-2 -top-2 z-10 rounded-xl"
                style={fadedStripStyle('217, 70, 239')}
                aria-hidden="true"
              />
              <div
                className="absolute -bottom-2 -right-2 -top-2 z-20 cursor-not-allowed rounded-r-xl"
                style={lockedStripStyle()}
                aria-hidden="true"
              />
            </>
          )}
        </div>
        {renderCollapsibleRows(
          renderStyle.nameplateVisible,
          <>
            <div className="grid grid-cols-3 gap-2">
              {iconColor(
                CaseSensitive,
                colorInputValue(renderStyle.nameplateTextColor, '#ffffff'),
                (value) => updateRenderStyle('nameplateTextColor', value),
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText1700',
                ),
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText1701',
                ),
              )}
              {iconNumber(
                RectangleHorizontal,
                <DragSizeControl
                  label={formatVideoText(
                    language,
                    'componentsrendervideopanelsrenderStyleSettingsSectionText1706',
                  )}
                  value={renderStyle.nameplateScale ?? 100}
                  min={55}
                  max={180}
                  step={1}
                  unit="%"
                  onChange={(value) => updateRenderStyle('nameplateScale', value)}
                />,
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText1714',
                ),
              )}
              {iconNumber(
                Type,
                <DragSizeControl
                  label={formatVideoText(
                    language,
                    'componentsrendervideopanelsrenderStyleSettingsSectionText1719',
                  )}
                  value={renderStyle.nameplateFontSize ?? 18}
                  min={10}
                  max={48}
                  step={1}
                  onChange={(value) => updateRenderStyle('nameplateFontSize', value)}
                />,
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText1726',
                ),
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {iconSelect(
                ALargeSmall,
                'nameplate-font-family',
                renderStyle.nameplateFontFamily || renderStyle.titleFontFamily,
                (value) => updateRenderStyle('nameplateFontFamily', value),
                CLEAN_FONT_OPTIONS,
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText1736',
                ),
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText1737',
                ),
              )}
              {iconNumber(
                Radius,
                <DragSizeControl
                  label={formatVideoText(
                    language,
                    'componentsrendervideopanelsrenderStyleSettingsSectionText1742',
                  )}
                  value={renderStyle.nameplateRadius ?? 14}
                  min={0}
                  max={64}
                  step={1}
                  onChange={(value) => updateRenderStyle('nameplateRadius', value)}
                />,
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText1749',
                ),
              )}
              {iconNumber(
                MoveHorizontal,
                <DragSizeControl
                  label={formatVideoText(
                    language,
                    'componentsrendervideopanelsrenderStyleSettingsSectionText1754',
                  )}
                  value={renderStyle.nameplateOffsetX ?? 0}
                  min={-240}
                  max={240}
                  step={1}
                  onChange={(value) => updateRenderStyle('nameplateOffsetX', value)}
                />,
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText1761',
                ),
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {iconNumber(
                MoveVertical,
                <DragSizeControl
                  label={formatVideoText(
                    language,
                    'componentsrendervideopanelsrenderStyleSettingsSectionText1768',
                  )}
                  value={renderStyle.nameplateOffsetY ?? 0}
                  min={-160}
                  max={160}
                  step={1}
                  onChange={(value) => updateRenderStyle('nameplateOffsetY', value)}
                />,
                formatVideoText(
                  language,
                  'componentsrendervideopanelsrenderStyleSettingsSectionText1775',
                ),
              )}
              {renderStyle.nameplateInside &&
                iconNumber(
                  BetweenVerticalStart,
                  <DragSizeControl
                    label={formatVideoText(
                      language,
                      'componentsrendervideopanelsrenderStyleSettingsSectionText1781',
                    )}
                    value={renderStyle.nameplateTextGap ?? 8}
                    min={-80}
                    max={80}
                    step={1}
                    onChange={(value) => updateRenderStyle('nameplateTextGap', value)}
                  />,
                  formatVideoText(
                    language,
                    'componentsrendervideopanelsrenderStyleSettingsSectionText1788',
                  ),
                )}
              {!renderStyle.nameplateInside &&
                iconSelect(
                  Palette,
                  'nameplate-background-type',
                  renderStyle.nameplateBackgroundType,
                  (value) =>
                    updateRenderStyle(
                      'nameplateBackgroundType',
                      value as RenderStyle['nameplateBackgroundType'],
                    ),
                  [
                    {
                      value: 'solid',
                      label: formatVideoText(
                        language,
                        'componentsrendervideopanelsrenderStyleSettingsSectionText1801',
                      ),
                    },
                    {
                      value: 'gradient',
                      label: formatVideoText(
                        language,
                        'componentsrendervideopanelsrenderStyleSettingsSectionText1802',
                      ),
                    },
                    {
                      value: 'image',
                      label: formatVideoText(
                        language,
                        'componentsrendervideopanelsrenderStyleSettingsSectionText1803',
                      ),
                    },
                  ],
                  formatVideoText(
                    language,
                    'componentsrendervideopanelsrenderStyleSettingsSectionText1805',
                  ),
                  formatVideoText(
                    language,
                    'componentsrendervideopanelsrenderStyleSettingsSectionText1806',
                  ),
                )}
              {!renderStyle.nameplateInside && renderNameplateStyleMenu()}
            </div>
          </>,
        )}
      </div>
    </div>
  );
}

function FollowCharacterGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
    >
      <circle cx="8.2" cy="7.2" r="2.4" />
      <path d="M4.5 15.8c.9-2.8 2.1-4.2 3.7-4.2s2.8 1.4 3.7 4.2" />
      <path d="M14.2 6.2h3.2a2.4 2.4 0 0 1 2.4 2.4v3.2" />
      <path d="M19.8 6.2v5.6h-5.6" />
      <circle cx="17" cy="15.9" r="2.2" />
      <path d="M17 13.7v-1.8" />
    </svg>
  );
}

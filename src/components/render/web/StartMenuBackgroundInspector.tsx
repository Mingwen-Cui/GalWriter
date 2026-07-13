import { Image as ImageIcon, Palette, Video } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { Language } from '../../../lib/i18n';
import { CanvasSettingsSection } from '../canvas/CanvasSettingsSection';
import { normalizeSharedCanvasSettings } from '../canvas/canvasSettings';
import {
  ImageFillPopover,
  SolidColorPopover,
} from '../video/objectInspector/ColorPopovers';
import { renderObjectText } from '../video/objectInspector/i18n';
import { parseColorValue, toHex8 } from '../video/shared/colorValue';
import type { WebExportSettings } from '../video/shared/types';
import {
  GradientEditorPopover,
  InlineColorControl,
  InlineGradientControl,
  PortaledGradientPopover,
} from './StartMenuElementInspector';
import { normalizeGradientStops } from './webGradientStops';
import { gradientFromStops } from './webGradientStops';
import { FloatingPopover, GradientIcon, InspectorGroup as Group } from './webStyleInspectorControls';
import { WebMenuMusicPanel } from './WebMenuMusicPanel';

type StartMenuBackgroundInspectorProps = {
  settings: WebExportSettings;
  language: Language;
  showDescriptions: boolean;
  surface?: 'start' | 'archive' | 'settings' | 'game';
  updateWebSettings: <K extends keyof WebExportSettings>(
    key: K,
    value: WebExportSettings[K],
  ) => void;
  onGradientEditingChange?: (surface: BackgroundSurface | null) => void;
};

type BackgroundType = WebExportSettings['startMenuBackgroundType'];
type BackgroundSurface = NonNullable<StartMenuBackgroundInspectorProps['surface']>;

const BLANK_BACKGROUND_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='9' viewBox='0 0 16 9'%3E%3Crect width='16' height='9' fill='white'/%3E%3C/svg%3E";

export function StartMenuBackgroundInspector({
  settings,
  language,
  showDescriptions,
  surface = 'start',
  updateWebSettings,
  onGradientEditingChange,
}: StartMenuBackgroundInspectorProps) {
  const text = renderObjectText(language);
  const closeLabel = language === 'zh' ? '关闭' : language === 'ja' ? '閉じる' : 'Close';
  const [openEditor, setOpenEditor] = useState<BackgroundType | null>(null);
  const background = getSurfaceBackground(settings, surface);
  const gradientStops = normalizeGradientStops(
    background.gradientStops,
    background.gradientStart,
    background.gradientEnd,
    '#0f172a',
    '#0891b2',
  );
  useEffect(() => {
    onGradientEditingChange?.(openEditor === 'gradient' ? surface : null);
    return () => onGradientEditingChange?.(null);
  }, [onGradientEditingChange, openEditor, surface]);

  const setBackgroundType = (value: BackgroundType) => {
    updateBackgroundSetting(updateWebSettings, surface, 'type', value);
    if (value === 'image' && !background.imageUrl) {
      updateBackgroundSetting(updateWebSettings, surface, 'imageUrl', BLANK_BACKGROUND_IMAGE);
    }
  };

  return (
    <div className="space-y-3">
      <CanvasSettingsSection
        language={language}
        showDescriptions={showDescriptions}
        value={normalizeSharedCanvasSettings(settings)}
        onChange={(patch) => {
          Object.entries(patch).forEach(([key, value]) =>
            updateWebSettings(
              key as keyof WebExportSettings,
              value as WebExportSettings[keyof WebExportSettings],
            ),
          );
        }}
      />
      <Group
        title={text.group.fill}
        icon={<Palette className="h-3.5 w-3.5 shrink-0" />}
        tone="fill"
        showDescriptions={showDescriptions}
        secondaryDescription={
          language === 'zh' ? '填充样式' : language === 'ja' ? '塗りつぶし形式' : 'Fill style'
        }
        secondary={
          <BackgroundFillTabs
            value={background.type}
            labels={text.option}
            onChange={(type) => {
              setBackgroundType(type);
              setOpenEditor(type);
            }}
          />
        }
      >
      {showDescriptions && (
        <div className="mb-2 px-1 text-[10px] leading-4 text-slate-500">{text.group.fill}</div>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)_44px] gap-3">
        <div className="min-w-0">
          {background.type === 'solid' && (
            <InlineColorControl
              label={text.popover.solidTitle}
              color={background.color}
              alpha={parseColorValue(background.color).alpha}
              alphaLabel={text.field.opacity}
              hexLabel={text.popover.hex}
              onColorChange={(value) => {
                const current = parseColorValue(background.color);
                updateBackgroundSetting(
                  updateWebSettings,
                  surface,
                  'color',
                  toHex8(value, current.alpha),
                );
              }}
              onAlphaChange={(alpha) =>
                updateBackgroundSetting(
                  updateWebSettings,
                  surface,
                  'color',
                  toHex8(background.color, alpha),
                )
              }
              onOpen={() => setOpenEditor(openEditor === 'solid' ? null : 'solid')}
            />
          )}
          {background.type === 'gradient' && (
            <InlineGradientControl
              label={text.popover.gradientTitle}
              stops={gradientStops}
              onOpen={() => setOpenEditor(openEditor === 'gradient' ? null : 'gradient')}
              onAlphaChange={(alpha) =>
                updateBackgroundSetting(
                  updateWebSettings,
                  surface,
                  'gradientStops',
                  gradientStops.map((stop) => ({ ...stop, alpha })),
                )
              }
            />
          )}
          {(background.type === 'image' || background.type === 'video') && (
            <BackgroundPreview settings={settings} surface={surface} />
          )}
        </div>
        <div className="h-10 w-11" aria-hidden="true" />
      </div>
      {openEditor === 'solid' && (
        <FloatingPopover popoverKey="solid" onClose={() => setOpenEditor(null)} closeLabel={closeLabel}>
          <SolidColorPopover
            tone="fill"
            text={text.popover}
            color={parseColorValue(background.color).hex}
            alpha={parseColorValue(background.color).alpha}
            onColorChange={(value) =>
              updateBackgroundSetting(
                updateWebSettings,
                surface,
                'color',
                toHex8(value, parseColorValue(background.color).alpha),
              )
            }
            onAlphaChange={(alpha) =>
              updateBackgroundSetting(
                updateWebSettings,
                surface,
                'color',
                toHex8(background.color, alpha),
              )
            }
          />
        </FloatingPopover>
      )}
      {openEditor === 'gradient' && (
        <PortaledGradientPopover onClose={() => setOpenEditor(null)} closeLabel={closeLabel}>
          <GradientEditorPopover
            language={language}
            angle={background.gradientAngle}
            shape={background.gradientShape}
            stops={gradientStops}
            onAngleChange={(value) =>
              updateBackgroundSetting(updateWebSettings, surface, 'gradientAngle', value)
            }
            onShapeChange={(value) =>
              updateBackgroundSetting(updateWebSettings, surface, 'gradientShape', value)
            }
            onStopsChange={(stops) => {
              const sorted = [...stops].sort((a, b) => a.position - b.position);
              const start = sorted[0];
              const end = sorted[sorted.length - 1];
              updateBackgroundSetting(updateWebSettings, surface, 'gradientStops', sorted);
              if (start)
                updateBackgroundSetting(updateWebSettings, surface, 'gradientStart', start.color);
              if (end)
                updateBackgroundSetting(updateWebSettings, surface, 'gradientEnd', end.color);
            }}
          />
        </PortaledGradientPopover>
      )}
      {openEditor === 'image' && (
        <FloatingPopover popoverKey="image" onClose={() => setOpenEditor(null)} closeLabel={closeLabel}>
          <ImageFillPopover
            tone="fill"
            text={text.popover}
            value={{
              imageUrl: background.imageUrl,
              imageFit: 'crop',
              imageAngle: 0,
              imageAlpha: 100,
            }}
            onChange={(updates) => {
              if (updates.imageUrl !== undefined) {
                updateBackgroundSetting(updateWebSettings, surface, 'imageUrl', updates.imageUrl);
              }
            }}
          />
        </FloatingPopover>
      )}
      {openEditor === 'video' && (
        <FloatingPopover popoverKey="style" onClose={() => setOpenEditor(null)} closeLabel={closeLabel}>
          <VideoBackgroundPopover
            language={language}
            videoUrl={background.videoUrl}
            loop={background.videoLoop}
            muted={background.videoMuted}
            fit={background.videoFit}
            onChange={(updates) => {
              if (updates.videoUrl !== undefined) updateBackgroundSetting(updateWebSettings, surface, 'videoUrl', updates.videoUrl);
              if (updates.videoLoop !== undefined) updateBackgroundSetting(updateWebSettings, surface, 'videoLoop', updates.videoLoop);
              if (updates.videoMuted !== undefined) updateBackgroundSetting(updateWebSettings, surface, 'videoMuted', updates.videoMuted);
              if (updates.videoFit !== undefined) updateBackgroundSetting(updateWebSettings, surface, 'videoFit', updates.videoFit);
            }}
          />
        </FloatingPopover>
      )}
      </Group>
      {surface !== 'game' && (
        <WebMenuMusicPanel
          language={language}
          settings={settings}
          surface={surface}
          updateWebSettings={updateWebSettings}
          showDescriptions={showDescriptions}
        />
      )}
    </div>
  );
}

function BackgroundFillTabs({
  value,
  labels,
  onChange,
}: {
  value: BackgroundType;
  labels: { solid: string; gradient: string; image: string };
  onChange: (value: BackgroundType) => void;
}) {
  const options = [
    { value: 'solid' as const, label: labels.solid, icon: <Palette className="h-3.5 w-3.5" /> },
    { value: 'gradient' as const, label: labels.gradient, icon: <GradientIcon /> },
    { value: 'image' as const, label: labels.image, icon: <ImageIcon className="h-3.5 w-3.5" /> },
    { value: 'video' as const, label: '视频', icon: <Video className="h-3.5 w-3.5" /> },
  ];
  return (
    <div className="grid h-10 grid-cols-4 overflow-hidden rounded-xl bg-white">
      {options.map((option) => (
        <button key={option.value} type="button" onClick={() => onChange(option.value)} className={`grid place-items-center ${value === option.value ? 'bg-indigo-600 text-white' : 'text-slate-700'}`} title={option.label} aria-label={option.label}>
          {option.icon}
        </button>
      ))}
    </div>
  );
}

function VideoBackgroundPopover({ language, videoUrl, loop, muted, fit, onChange }: {
  language: Language; videoUrl: string; loop: boolean; muted: boolean; fit: 'crop' | 'fit';
  onChange: (updates: { videoUrl?: string; videoLoop?: boolean; videoMuted?: boolean; videoFit?: 'crop' | 'fit' }) => void;
}) {
  const copy = language === 'en' ? ['Video background', 'Replace video', 'Loop', 'Mute', 'Fill', 'Fit'] : language === 'ja' ? ['動画背景', '動画を置換', 'ループ', 'ミュート', 'トリミング', '全体表示'] : ['视频背景', '替换视频', '循环', '静音', '裁切填满', '完整显示'];
  return <div className="rounded-[22px] border border-sky-200 bg-sky-50 p-3 shadow-xl">
    <label className="grid h-32 cursor-pointer place-items-center overflow-hidden rounded-xl bg-slate-950">
      {videoUrl ? <video src={videoUrl} autoPlay muted loop playsInline className="h-full w-full object-cover" /> : <span className="text-xs font-medium text-white">{copy[0]}</span>}
      <input type="file" accept="video/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => onChange({ videoUrl: String(reader.result || '') }); reader.readAsDataURL(file); event.target.value = ''; }} />
    </label>
    <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
      <button type="button" onClick={() => onChange({ videoLoop: !loop })} className={`h-9 rounded-lg ${loop ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'}`}>{copy[2]}</button>
      <button type="button" onClick={() => onChange({ videoMuted: !muted })} className={`h-9 rounded-lg ${muted ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'}`}>{copy[3]}</button>
      <button type="button" onClick={() => onChange({ videoFit: 'crop' })} className={`h-9 rounded-lg ${fit === 'crop' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'}`}>{copy[4]}</button>
      <button type="button" onClick={() => onChange({ videoFit: 'fit' })} className={`h-9 rounded-lg ${fit === 'fit' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'}`}>{copy[5]}</button>
    </div>
  </div>;
}

function BackgroundPreview({
  settings,
  surface = 'start',
}: {
  settings: WebExportSettings;
  surface?: BackgroundSurface;
}) {
  const backgroundSettings = getSurfaceBackground(settings, surface);
  const background =
    backgroundSettings.type === 'video' && !backgroundSettings.videoUrl
      ? '#000000'
      : backgroundSettings.type === 'gradient'
      ? gradientFromStops(
          backgroundSettings.gradientShape,
          backgroundSettings.gradientAngle,
          normalizeGradientStops(
            backgroundSettings.gradientStops,
            backgroundSettings.gradientStart,
            backgroundSettings.gradientEnd,
          ),
        )
      : backgroundSettings.type === 'image'
        ? `center / cover url("${backgroundSettings.imageUrl}")`
        : backgroundSettings.color;
  return (
    <div className="h-10 rounded-xl border border-white/60 bg-white p-1">
      <div className="h-full rounded-lg" style={{ background }} />
    </div>
  );
}

export function getSurfaceBackground(settings: WebExportSettings, surface: BackgroundSurface) {
  const prefix =
    surface === 'archive'
      ? 'archiveBackground'
      : surface === 'settings'
        ? 'settingsBackground'
        : surface === 'game'
          ? 'dialogueBackground'
          : 'startMenuBackground';
  const read = <T,>(suffix: string, fallback: T) =>
    ((settings as unknown as Record<string, T | undefined>)[`${prefix}${suffix}`] ?? fallback) as T;
  return {
    type: read<BackgroundType>('Type', settings.startMenuBackgroundType),
    color: read<string>('Color', settings.startMenuBackgroundColor),
    gradientStart: read<string>('GradientStart', settings.startMenuBackgroundGradientStart),
    gradientEnd: read<string>('GradientEnd', settings.startMenuBackgroundGradientEnd),
    gradientAngle: read<number>('GradientAngle', settings.startMenuBackgroundGradientAngle),
    gradientStartX: read<number | undefined>('GradientStartX', settings.startMenuBackgroundGradientStartX),
    gradientStartY: read<number | undefined>('GradientStartY', settings.startMenuBackgroundGradientStartY),
    gradientEndX: read<number | undefined>('GradientEndX', settings.startMenuBackgroundGradientEndX),
    gradientEndY: read<number | undefined>('GradientEndY', settings.startMenuBackgroundGradientEndY),
    gradientShape: read<'linear' | 'radial' | 'diamond'>('GradientShape', settings.startMenuBackgroundGradientShape || 'linear'),
    gradientStops: read<WebExportSettings['startMenuBackgroundGradientStops']>(
      'GradientStops',
      settings.startMenuBackgroundGradientStops,
    ),
    imageUrl: read<string>('ImageUrl', settings.startMenuBackgroundImageUrl),
    videoUrl: read<string>('VideoUrl', ''),
    videoLoop: read<boolean>('VideoLoop', true),
    videoMuted: read<boolean>('VideoMuted', true),
    videoFit: read<'crop' | 'fit'>('VideoFit', 'crop'),
  };
}

function updateBackgroundSetting(
  updateWebSettings: StartMenuBackgroundInspectorProps['updateWebSettings'],
  surface: BackgroundSurface,
  field:
    | 'type'
    | 'color'
    | 'gradientStart'
    | 'gradientEnd'
    | 'gradientAngle'
    | 'gradientStartX'
    | 'gradientStartY'
    | 'gradientEndX'
    | 'gradientEndY'
    | 'gradientShape'
    | 'gradientStops'
    | 'imageUrl'
    | 'videoUrl'
    | 'videoLoop'
    | 'videoMuted'
    | 'videoFit',
  value: BackgroundType | string | number | boolean | WebExportSettings['startMenuBackgroundGradientStops'],
) {
  const keyMap = {
    start: {
      type: 'startMenuBackgroundType',
      color: 'startMenuBackgroundColor',
      gradientStart: 'startMenuBackgroundGradientStart',
      gradientEnd: 'startMenuBackgroundGradientEnd',
      gradientAngle: 'startMenuBackgroundGradientAngle',
      gradientStartX: 'startMenuBackgroundGradientStartX', gradientStartY: 'startMenuBackgroundGradientStartY', gradientEndX: 'startMenuBackgroundGradientEndX', gradientEndY: 'startMenuBackgroundGradientEndY',
      gradientShape: 'startMenuBackgroundGradientShape',
      gradientStops: 'startMenuBackgroundGradientStops',
      imageUrl: 'startMenuBackgroundImageUrl',
      videoUrl: 'startMenuBackgroundVideoUrl', videoLoop: 'startMenuBackgroundVideoLoop', videoMuted: 'startMenuBackgroundVideoMuted', videoFit: 'startMenuBackgroundVideoFit',
    },
    archive: {
      type: 'archiveBackgroundType',
      color: 'archiveBackgroundColor',
      gradientStart: 'archiveBackgroundGradientStart',
      gradientEnd: 'archiveBackgroundGradientEnd',
      gradientAngle: 'archiveBackgroundGradientAngle',
      gradientStartX: 'archiveBackgroundGradientStartX', gradientStartY: 'archiveBackgroundGradientStartY', gradientEndX: 'archiveBackgroundGradientEndX', gradientEndY: 'archiveBackgroundGradientEndY',
      gradientShape: 'archiveBackgroundGradientShape',
      gradientStops: 'archiveBackgroundGradientStops',
      imageUrl: 'archiveBackgroundImageUrl',
      videoUrl: 'archiveBackgroundVideoUrl', videoLoop: 'archiveBackgroundVideoLoop', videoMuted: 'archiveBackgroundVideoMuted', videoFit: 'archiveBackgroundVideoFit',
    },
    settings: {
      type: 'settingsBackgroundType',
      color: 'settingsBackgroundColor',
      gradientStart: 'settingsBackgroundGradientStart',
      gradientEnd: 'settingsBackgroundGradientEnd',
      gradientAngle: 'settingsBackgroundGradientAngle',
      gradientStartX: 'settingsBackgroundGradientStartX', gradientStartY: 'settingsBackgroundGradientStartY', gradientEndX: 'settingsBackgroundGradientEndX', gradientEndY: 'settingsBackgroundGradientEndY',
      gradientShape: 'settingsBackgroundGradientShape',
      gradientStops: 'settingsBackgroundGradientStops',
      imageUrl: 'settingsBackgroundImageUrl',
      videoUrl: 'settingsBackgroundVideoUrl', videoLoop: 'settingsBackgroundVideoLoop', videoMuted: 'settingsBackgroundVideoMuted', videoFit: 'settingsBackgroundVideoFit',
    },
    game: {
      type: 'dialogueBackgroundType',
      color: 'dialogueBackgroundColor',
      gradientStart: 'dialogueBackgroundGradientStart',
      gradientEnd: 'dialogueBackgroundGradientEnd',
      gradientAngle: 'dialogueBackgroundGradientAngle',
      gradientStartX: 'dialogueBackgroundGradientStartX', gradientStartY: 'dialogueBackgroundGradientStartY', gradientEndX: 'dialogueBackgroundGradientEndX', gradientEndY: 'dialogueBackgroundGradientEndY',
      gradientShape: 'dialogueBackgroundGradientShape',
      gradientStops: 'dialogueBackgroundGradientStops',
      imageUrl: 'dialogueBackgroundImageUrl',
      videoUrl: 'dialogueBackgroundVideoUrl', videoLoop: 'dialogueBackgroundVideoLoop', videoMuted: 'dialogueBackgroundVideoMuted', videoFit: 'dialogueBackgroundVideoFit',
    },
  } satisfies Record<BackgroundSurface, Record<typeof field, keyof WebExportSettings>>;
  const key = keyMap[surface][field];
  updateWebSettings(key, value as WebExportSettings[typeof key]);
}

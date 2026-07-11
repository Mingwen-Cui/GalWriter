import { Palette } from 'lucide-react';
import { useState } from 'react';

import type { Language } from '../../../lib/i18n';
import { CanvasSettingsSection } from '../canvas/CanvasSettingsSection';
import { normalizeSharedCanvasSettings } from '../canvas/canvasSettings';
import {
  GradientPopover,
  ImageFillPopover,
  SolidColorPopover,
} from '../video/objectInspector/ColorPopovers';
import { renderObjectText } from '../video/objectInspector/i18n';
import type { WebExportSettings } from '../video/shared/types';
import { normalizeGradientStops } from './webGradientStops';
import { FillTabs, FloatingPopover, InspectorGroup as Group } from './webStyleInspectorControls';

type StartMenuBackgroundInspectorProps = {
  settings: WebExportSettings;
  language: Language;
  showDescriptions: boolean;
  surface?: 'start' | 'archive' | 'settings' | 'game';
  updateWebSettings: <K extends keyof WebExportSettings>(
    key: K,
    value: WebExportSettings[K],
  ) => void;
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
}: StartMenuBackgroundInspectorProps) {
  const text = renderObjectText(language);
  const [openEditor, setOpenEditor] = useState<BackgroundType | null>(null);
  const background = getSurfaceBackground(settings, surface);
  const gradientStops = normalizeGradientStops(
    background.gradientStops,
    background.gradientStart,
    background.gradientEnd,
    '#0f172a',
    '#0891b2',
  );

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
      secondary={
        <FillTabs
          value={background.type}
          labels={text.option}
          onChange={(type) => {
            setBackgroundType(type);
            setOpenEditor(openEditor === type ? null : type);
          }}
        />
      }
    >
      {showDescriptions && (
        <div className="mb-2 px-1 text-[10px] leading-4 text-slate-500">{text.group.fill}</div>
      )}
      <BackgroundPreview settings={settings} surface={surface} />
      {openEditor === 'solid' && (
        <FloatingPopover>
          <SolidColorPopover
            tone="fill"
            text={text.popover}
            color={background.color}
            alpha={100}
            onColorChange={(value) =>
              updateBackgroundSetting(updateWebSettings, surface, 'color', value)
            }
            onAlphaChange={() => undefined}
          />
        </FloatingPopover>
      )}
      {openEditor === 'gradient' && (
        <FloatingPopover>
          <GradientPopover
            tone="fill"
            text={text.popover}
            angle={background.gradientAngle}
            stops={gradientStops}
            onAngleChange={(value) =>
              updateBackgroundSetting(updateWebSettings, surface, 'gradientAngle', value)
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
        </FloatingPopover>
      )}
      {openEditor === 'image' && (
        <FloatingPopover>
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
      </Group>
    </div>
  );
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
    backgroundSettings.type === 'gradient'
      ? `linear-gradient(${backgroundSettings.gradientAngle}deg, ${backgroundSettings.gradientStart}, ${backgroundSettings.gradientEnd})`
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
    gradientStops: read<WebExportSettings['startMenuBackgroundGradientStops']>(
      'GradientStops',
      settings.startMenuBackgroundGradientStops,
    ),
    imageUrl: read<string>('ImageUrl', settings.startMenuBackgroundImageUrl),
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
    | 'gradientStops'
    | 'imageUrl',
  value: BackgroundType | string | number | WebExportSettings['startMenuBackgroundGradientStops'],
) {
  const keyMap = {
    start: {
      type: 'startMenuBackgroundType',
      color: 'startMenuBackgroundColor',
      gradientStart: 'startMenuBackgroundGradientStart',
      gradientEnd: 'startMenuBackgroundGradientEnd',
      gradientAngle: 'startMenuBackgroundGradientAngle',
      gradientStops: 'startMenuBackgroundGradientStops',
      imageUrl: 'startMenuBackgroundImageUrl',
    },
    archive: {
      type: 'archiveBackgroundType',
      color: 'archiveBackgroundColor',
      gradientStart: 'archiveBackgroundGradientStart',
      gradientEnd: 'archiveBackgroundGradientEnd',
      gradientAngle: 'archiveBackgroundGradientAngle',
      gradientStops: 'archiveBackgroundGradientStops',
      imageUrl: 'archiveBackgroundImageUrl',
    },
    settings: {
      type: 'settingsBackgroundType',
      color: 'settingsBackgroundColor',
      gradientStart: 'settingsBackgroundGradientStart',
      gradientEnd: 'settingsBackgroundGradientEnd',
      gradientAngle: 'settingsBackgroundGradientAngle',
      gradientStops: 'settingsBackgroundGradientStops',
      imageUrl: 'settingsBackgroundImageUrl',
    },
    game: {
      type: 'dialogueBackgroundType',
      color: 'dialogueBackgroundColor',
      gradientStart: 'dialogueBackgroundGradientStart',
      gradientEnd: 'dialogueBackgroundGradientEnd',
      gradientAngle: 'dialogueBackgroundGradientAngle',
      gradientStops: 'dialogueBackgroundGradientStops',
      imageUrl: 'dialogueBackgroundImageUrl',
    },
  } satisfies Record<BackgroundSurface, Record<typeof field, keyof WebExportSettings>>;
  const key = keyMap[surface][field];
  updateWebSettings(key, value as WebExportSettings[typeof key]);
}

import { AppearanceStackInspector } from '../shared/inspectors/AppearanceStackInspector';
import { newPaint } from '../shared/paint/appearance';
import type { Language } from '../../../lib/i18n';
import type { SharedCanvasSettings } from '../canvas/canvasSettings';
import { normalizeSharedCanvasSettings } from '../canvas/canvasSettings';
import { CanvasSettingsSection } from '../canvas/CanvasSettingsSection';
import { BackgroundFillInspector } from '../shared/paint/BackgroundFillInspector';
import type { WebExportSettings } from '../video/shared/types';
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
  onCanvasSettingsChange?: (patch: Partial<SharedCanvasSettings>) => void;
  hideMusic?: boolean;
  onGradientEditingChange?: (surface: BackgroundSurface | null) => void;
};
type BackgroundType = WebExportSettings['startMenuBackgroundType'];
type BackgroundSurface = NonNullable<StartMenuBackgroundInspectorProps['surface']>;
export function StartMenuBackgroundInspector({
  settings,
  language,
  showDescriptions,
  surface = 'start',
  updateWebSettings,
  onCanvasSettingsChange,
  hideMusic,
  onGradientEditingChange,
}: StartMenuBackgroundInspectorProps) {
  return (
    <div className="property-inspector space-y-1">
      <CanvasSettingsSection
        language={language}
        value={normalizeSharedCanvasSettings(settings)}
        showDescriptions={showDescriptions}
        onChange={(patch) => {
          if (onCanvasSettingsChange) onCanvasSettingsChange(patch);
          else
            Object.entries(patch).forEach(([key, value]) =>
              updateWebSettings(key as keyof WebExportSettings, value),
            );
        }}
      />
      <AppearanceStackInspector
        language={language}
        value={
          settings.surfaceAppearances?.[surface] || {
            fills: [
              {
                ...newPaint(),
                ...getSurfaceBackground(settings, surface),
                id: 'legacy-background',
              },
            ],
            strokes: [],
            shadows: [],
          }
        }
        onChange={(appearance) =>
          updateWebSettings('surfaceAppearances', {
            ...settings.surfaceAppearances,
            [surface]: appearance,
          })
        }
      />
      {!hideMusic && surface !== 'game' && (
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
    gradientStartX: read<number | undefined>(
      'GradientStartX',
      settings.startMenuBackgroundGradientStartX,
    ),
    gradientStartY: read<number | undefined>(
      'GradientStartY',
      settings.startMenuBackgroundGradientStartY,
    ),
    gradientEndX: read<number | undefined>(
      'GradientEndX',
      settings.startMenuBackgroundGradientEndX,
    ),
    gradientEndY: read<number | undefined>(
      'GradientEndY',
      settings.startMenuBackgroundGradientEndY,
    ),
    gradientShape: read<'linear' | 'radial' | 'diamond'>(
      'GradientShape',
      settings.startMenuBackgroundGradientShape || 'linear',
    ),
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
  value:
    | BackgroundType
    | string
    | number
    | boolean
    | WebExportSettings['startMenuBackgroundGradientStops'],
) {
  const keyMap = {
    start: {
      type: 'startMenuBackgroundType',
      color: 'startMenuBackgroundColor',
      gradientStart: 'startMenuBackgroundGradientStart',
      gradientEnd: 'startMenuBackgroundGradientEnd',
      gradientAngle: 'startMenuBackgroundGradientAngle',
      gradientStartX: 'startMenuBackgroundGradientStartX',
      gradientStartY: 'startMenuBackgroundGradientStartY',
      gradientEndX: 'startMenuBackgroundGradientEndX',
      gradientEndY: 'startMenuBackgroundGradientEndY',
      gradientShape: 'startMenuBackgroundGradientShape',
      gradientStops: 'startMenuBackgroundGradientStops',
      imageUrl: 'startMenuBackgroundImageUrl',
      videoUrl: 'startMenuBackgroundVideoUrl',
      videoLoop: 'startMenuBackgroundVideoLoop',
      videoMuted: 'startMenuBackgroundVideoMuted',
      videoFit: 'startMenuBackgroundVideoFit',
    },
    archive: {
      type: 'archiveBackgroundType',
      color: 'archiveBackgroundColor',
      gradientStart: 'archiveBackgroundGradientStart',
      gradientEnd: 'archiveBackgroundGradientEnd',
      gradientAngle: 'archiveBackgroundGradientAngle',
      gradientStartX: 'archiveBackgroundGradientStartX',
      gradientStartY: 'archiveBackgroundGradientStartY',
      gradientEndX: 'archiveBackgroundGradientEndX',
      gradientEndY: 'archiveBackgroundGradientEndY',
      gradientShape: 'archiveBackgroundGradientShape',
      gradientStops: 'archiveBackgroundGradientStops',
      imageUrl: 'archiveBackgroundImageUrl',
      videoUrl: 'archiveBackgroundVideoUrl',
      videoLoop: 'archiveBackgroundVideoLoop',
      videoMuted: 'archiveBackgroundVideoMuted',
      videoFit: 'archiveBackgroundVideoFit',
    },
    settings: {
      type: 'settingsBackgroundType',
      color: 'settingsBackgroundColor',
      gradientStart: 'settingsBackgroundGradientStart',
      gradientEnd: 'settingsBackgroundGradientEnd',
      gradientAngle: 'settingsBackgroundGradientAngle',
      gradientStartX: 'settingsBackgroundGradientStartX',
      gradientStartY: 'settingsBackgroundGradientStartY',
      gradientEndX: 'settingsBackgroundGradientEndX',
      gradientEndY: 'settingsBackgroundGradientEndY',
      gradientShape: 'settingsBackgroundGradientShape',
      gradientStops: 'settingsBackgroundGradientStops',
      imageUrl: 'settingsBackgroundImageUrl',
      videoUrl: 'settingsBackgroundVideoUrl',
      videoLoop: 'settingsBackgroundVideoLoop',
      videoMuted: 'settingsBackgroundVideoMuted',
      videoFit: 'settingsBackgroundVideoFit',
    },
    game: {
      type: 'dialogueBackgroundType',
      color: 'dialogueBackgroundColor',
      gradientStart: 'dialogueBackgroundGradientStart',
      gradientEnd: 'dialogueBackgroundGradientEnd',
      gradientAngle: 'dialogueBackgroundGradientAngle',
      gradientStartX: 'dialogueBackgroundGradientStartX',
      gradientStartY: 'dialogueBackgroundGradientStartY',
      gradientEndX: 'dialogueBackgroundGradientEndX',
      gradientEndY: 'dialogueBackgroundGradientEndY',
      gradientShape: 'dialogueBackgroundGradientShape',
      gradientStops: 'dialogueBackgroundGradientStops',
      imageUrl: 'dialogueBackgroundImageUrl',
      videoUrl: 'dialogueBackgroundVideoUrl',
      videoLoop: 'dialogueBackgroundVideoLoop',
      videoMuted: 'dialogueBackgroundVideoMuted',
      videoFit: 'dialogueBackgroundVideoFit',
    },
  } satisfies Record<BackgroundSurface, Record<typeof field, keyof WebExportSettings>>;
  const key = keyMap[surface][field];
  updateWebSettings(key, value as WebExportSettings[typeof key]);
}

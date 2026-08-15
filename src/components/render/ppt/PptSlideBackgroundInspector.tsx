import type { Language } from '../../../lib/i18n';
import { type SharedCanvasSettings } from '../canvas/canvasSettings';
import { StartMenuBackgroundInspector } from '../web/StartMenuBackgroundInspector';
import type {
  PptExportSettings,
  PptSlideBackgroundStyle,
  WebExportSettings,
} from '../video/shared/types';

const backgroundKeyMap = {
  startMenuBackgroundType: 'type',
  startMenuBackgroundColor: 'color',
  startMenuBackgroundGradientStart: 'gradientStart',
  startMenuBackgroundGradientEnd: 'gradientEnd',
  startMenuBackgroundGradientAngle: 'gradientAngle',
  startMenuBackgroundGradientStartX: 'gradientStartX',
  startMenuBackgroundGradientStartY: 'gradientStartY',
  startMenuBackgroundGradientEndX: 'gradientEndX',
  startMenuBackgroundGradientEndY: 'gradientEndY',
  startMenuBackgroundGradientShape: 'gradientShape',
  startMenuBackgroundGradientStops: 'gradientStops',
  startMenuBackgroundImageUrl: 'imageUrl',
  startMenuBackgroundVideoUrl: 'videoUrl',
  startMenuBackgroundVideoLoop: 'videoLoop',
  startMenuBackgroundVideoMuted: 'videoMuted',
  startMenuBackgroundVideoFit: 'videoFit',
} as const satisfies Partial<Record<keyof WebExportSettings, keyof PptSlideBackgroundStyle>>;

const canvasForPptLayout = (layout: PptExportSettings['layout']) =>
  layout === 'LAYOUT_STANDARD'
    ? {
        canvasWidth: 1440,
        canvasHeight: 1080,
        canvasRatioWidth: 4,
        canvasRatioHeight: 3,
      }
    : {
        canvasWidth: 1920,
        canvasHeight: 1080,
        canvasRatioWidth: 16,
        canvasRatioHeight: 9,
      };

export function PptSlideBackgroundInspector({
  language,
  webSettings,
  pptSettings,
  background,
  onUpdateBackground,
  onUpdatePptSettings,
}: {
  language: Language;
  webSettings: WebExportSettings;
  pptSettings: PptExportSettings;
  background: PptSlideBackgroundStyle;
  onUpdateBackground: (patch: Partial<PptSlideBackgroundStyle>) => void;
  onUpdatePptSettings: (patch: Partial<PptExportSettings>) => void;
}) {
  const canvas = canvasForPptLayout(pptSettings.layout);
  const settings: WebExportSettings = {
    ...webSettings,
    ...canvas,
    startMenuBackgroundType: background.type,
    startMenuBackgroundColor: background.color,
    startMenuBackgroundGradientStart: background.gradientStart,
    startMenuBackgroundGradientEnd: background.gradientEnd,
    startMenuBackgroundGradientAngle: background.gradientAngle,
    startMenuBackgroundGradientStartX: background.gradientStartX,
    startMenuBackgroundGradientStartY: background.gradientStartY,
    startMenuBackgroundGradientEndX: background.gradientEndX,
    startMenuBackgroundGradientEndY: background.gradientEndY,
    startMenuBackgroundGradientShape: background.gradientShape,
    startMenuBackgroundGradientStops: background.gradientStops,
    startMenuBackgroundImageUrl: background.imageUrl || '',
    startMenuBackgroundVideoUrl: background.videoUrl,
    startMenuBackgroundVideoLoop: background.videoLoop,
    startMenuBackgroundVideoMuted: background.videoMuted,
    startMenuBackgroundVideoFit: background.videoFit,
  };
  const updateWebSetting = (
    key: keyof WebExportSettings,
    value: WebExportSettings[keyof WebExportSettings],
  ) => {
    const backgroundKey = backgroundKeyMap[key as keyof typeof backgroundKeyMap];
    if (!backgroundKey) return;
    onUpdateBackground({ [backgroundKey]: value } as Partial<PptSlideBackgroundStyle>);
  };
  const updateCanvas = (patch: Partial<SharedCanvasSettings>) => {
    const width = patch.canvasRatioWidth ?? canvas.canvasRatioWidth;
    const height = patch.canvasRatioHeight ?? canvas.canvasRatioHeight;
    const ratio = width / Math.max(1, height);
    const layout =
      Math.abs(ratio - 4 / 3) < Math.abs(ratio - 16 / 9) ? 'LAYOUT_STANDARD' : 'LAYOUT_WIDE';
    if (layout !== pptSettings.layout) onUpdatePptSettings({ layout });
  };
  return (
    <StartMenuBackgroundInspector
      settings={settings}
      language={language}
      showDescriptions={false}
      hideMusic
      onCanvasSettingsChange={updateCanvas}
      updateWebSettings={
        updateWebSetting as <K extends keyof WebExportSettings>(
          key: K,
          value: WebExportSettings[K],
        ) => void
      }
    />
  );
}

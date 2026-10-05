import type { Language } from '../../lib/i18n';
import { homepageCoverTemplates } from './homepageCoverTemplates';
import { newPaint, type SurfaceAppearance } from './shared/paint/appearance';
import { getRenderObjects } from './video/shared/renderObjects';
import { DEFAULT_RENDER_STYLE } from './video/VideoRenderModal/workspaceStorage';
import type { RenderStyle, WebExportSettings } from './video/shared/types';
import { buildArchivePageElements, buildSettingsPageElements } from './web/webMenuPageElements';
import { buildRehearsalFlowPageElements } from './web/webExperienceTemplates';
import { decorateWebPageElements, webThemePalettes } from './web/webThemeVisuals';

export const experienceThemes = homepageCoverTemplates.map((cover) => ({
  ...cover, ...webThemePalettes[cover.id],
}));
export const getExperienceTheme = (id: string) => experienceThemes.find((theme) => theme.id === id);

export function themeAppearance(id: string, primary = false): SurfaceAppearance {
  const theme = getExperienceTheme(id) || experienceThemes[0];
  return {
    fills: [{
      ...newPaint(), id: 'theme-panel', type: 'gradient',
      gradientStart: primary ? theme.accent : theme.panel,
      gradientEnd: primary ? theme.accentEnd : theme.panelEnd,
      gradientAngle: 155, opacity: primary ? 100 : 95,
    }],
    strokes: [{ id: 'theme-edge', enabled: true, color: theme.edge, width: 1, position: 'inside' }],
    shadows: [
      { id: 'theme-depth', enabled: true, color: theme.dark ? '#00000038' : '#533a4c18', x: 0, y: 10, blur: 32, spread: 0, inset: false },
      { id: 'theme-sheen', enabled: true, color: theme.dark ? '#ffffff0a' : '#ffffffb3', x: 0, y: 1, blur: 0, spread: 0, inset: true },
    ],
  };
}

export function themeRenderPatch(id: string, style: RenderStyle): Partial<RenderStyle> {
  const theme = getExperienceTheme(id);
  if (!theme) return {};
  if (id === 'universal') {
    const { renderObjects: defaultObjects, ...defaults } = structuredClone(DEFAULT_RENDER_STYLE);
    const objects = getRenderObjects({ ...defaults, renderObjects: defaultObjects });
    return {
      ...defaults,
      selectedRenderObject: style.selectedRenderObject,
      renderObjects: {
        ...objects,
        choice: {
          ...objects.choice,
          fill: {
            ...objects.choice.fill, alpha: 100, color: theme.accent,
            gradientStops: [
              { id: 'start', color: theme.accent, alpha: 100, position: 0 },
              { id: 'end', color: theme.accentEnd, alpha: 100, position: 100 },
            ],
          },
        },
      },
    };
  }
  const objects = getRenderObjects(style);
  const bodySize = id === 'gothic-moon' ? 28 : 26;
  const titleSize = 30;
  const nameSize = 18;
  const stops = [
    { id: 'theme-start', color: theme.panel, alpha: 95, position: 0 },
    { id: 'theme-end', color: theme.panelEnd, alpha: 95, position: 100 },
  ];
  const textStyle = (object: typeof objects.body, color: string, size: number, weight: number, lineHeight: number) => ({
    ...object, fontFamily: theme.font, fontSize: size, fontWeight: weight, lineHeight,
    letterSpacing: id === 'gothic-moon' ? 0.5 : 0.2,
    fill: { ...object.fill, enabled: true, type: 'solid' as const, color, alpha: 100 },
    stroke: { ...object.stroke, enabled: false }, shadow: { ...object.shadow, enabled: false },
    appearance: undefined,
  });
  return {
    panelColor: theme.panel, panelColorAlpha: 95, dialogRadius: theme.radius, dialogVisible: true,
    dialogBackgroundType: 'gradient', dialogGradientStartColor: theme.panel,
    dialogGradientColor: theme.panelEnd, dialogGradientAngle: 155, dialogGradientStops: stops,
    dialogImageUrl: '', titleColor: theme.muted, bodyColor: theme.ink,
    titleColorAlpha: 100, bodyColorAlpha: 100, titleFontFamily: theme.font, bodyFontFamily: theme.font,
    titleFontSize: titleSize, bodyFontSize: bodySize, titleLineHeight: 1.3, bodyLineHeight: 1.7,
    titleLetterSpacing: 0.5, bodyLetterSpacing: 0.2, titleStrokeWidth: 0, bodyStrokeWidth: 0,
    nameplateFontFamily: theme.font, nameplateFontSize: nameSize, nameplateRadius: theme.radius,
    nameplateTextColor: theme.ink, nameplateTextColorAlpha: 100,
    nameplateBackgroundType: 'gradient', nameplateColor: theme.panel, nameplateColorAlpha: 95,
    nameplateGradientAngle: 155, nameplateGradientStops: stops, nameplateImageUrl: '',
    renderObjects: {
      ...objects,
      dialogBox: {
        ...objects.dialogBox, visible: true, appearance: themeAppearance(id), radius: theme.radius,
        corners: [theme.radius, theme.radius, theme.radius, theme.radius],
        fill: { ...objects.dialogBox.fill, enabled: true, type: 'gradient', color: theme.panel, alpha: 95, gradientAngle: 155, gradientStops: stops },
      },
      title: textStyle(objects.title, theme.muted, titleSize, 600, 1.3),
      body: textStyle(objects.body, theme.ink, bodySize, 400, 1.7),
      nameplate: {
        ...textStyle(objects.nameplate, theme.ink, nameSize, 600, 1.2),
        appearance: themeAppearance(id), radius: theme.radius,
        corners: [theme.radius, theme.radius, theme.radius, theme.radius],
      },
      choice: {
        ...textStyle(objects.choice, theme.onAccent, 20, 600, 1.4),
        appearance: themeAppearance(id, true), radius: theme.radius,
        corners: [theme.radius, theme.radius, theme.radius, theme.radius],
      },
    },
  };
}

export function themeMenuPatch(id: string, language: Language): Partial<WebExportSettings> {
  const theme = getExperienceTheme(id);
  if (!theme) return {};
  const shade: SurfaceAppearance = {
    fills: [
      { ...newPaint(), id: 'theme-page-wash', type: 'gradient', gradientStart: theme.canvas, gradientEnd: theme.canvasEnd, gradientAngle: 135, opacity: theme.dark ? 92 : 78 },
      { ...newPaint(), id: 'theme-page-art', type: 'image', imageUrl: theme.backgroundUrl, imageFit: 'crop', imageScale: 100 },
    ], strokes: [], shadows: [],
  };
  const game: SurfaceAppearance = {
    fills: [{ ...newPaint(), id: 'theme-game-background', type: 'gradient', gradientStart: theme.canvas, gradientEnd: theme.canvasEnd, gradientAngle: 135 }],
    strokes: [], shadows: [],
  };
  return {
    menuTheme: webThemePalettes[id], settingsPageElementsInitialized: true,
    archiveBackgroundColor: theme.canvas, archiveBackgroundType: 'gradient',
    archiveBackgroundGradientStart: theme.canvas, archiveBackgroundGradientEnd: theme.canvasEnd, archiveBackgroundGradientAngle: 135,
    settingsBackgroundColor: theme.canvas, settingsBackgroundType: 'gradient',
    settingsBackgroundGradientStart: theme.canvas, settingsBackgroundGradientEnd: theme.canvasEnd, settingsBackgroundGradientAngle: 135,
    flowOverviewBackgroundColor: theme.canvas, flowOverviewBackgroundType: 'gradient',
    flowOverviewBackgroundGradientStart: theme.canvas, flowOverviewBackgroundGradientEnd: theme.canvasEnd, flowOverviewBackgroundGradientAngle: 135,
    dialogueBackgroundType: 'gradient', dialogueBackgroundColor: theme.canvas,
    dialogueBackgroundGradientStart: theme.canvas, dialogueBackgroundGradientEnd: theme.canvasEnd, dialogueBackgroundGradientAngle: 135,
    sceneBackgroundType: 'gradient', sceneBackgroundColor: theme.canvas,
    sceneBackgroundGradientStart: theme.canvas, sceneBackgroundGradientEnd: theme.canvasEnd, sceneBackgroundGradientAngle: 135,
    sceneBackgroundImageUrl: '',
    surfaceAppearances: { archive: shade, settings: shade, flow: shade, game },
    archivePageElements: decorateWebPageElements(buildArchivePageElements(language, theme.accent, theme.ink), theme),
    settingsPageElements: decorateWebPageElements(buildSettingsPageElements(language, theme.accent, theme.ink), theme),
    flowOverviewElements: decorateWebPageElements(buildRehearsalFlowPageElements(language), theme),
  };
}

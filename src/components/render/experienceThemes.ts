import type { Language } from '../../lib/i18n';
import { homepageCoverTemplates } from './homepageCoverTemplates';
import { newPaint, type SurfaceAppearance } from './shared/paint/appearance';
import { getRenderObjects } from './video/shared/renderObjects';
import type { RenderStyle, WebExportSettings, WebMenuElement } from './video/shared/types';
import { buildArchivePageElements, buildSettingsPageElements } from './web/webMenuPageElements';

const palettes = {
  'sakura-campus': {
    panel: '#fff7f4ed',
    ink: '#4b3140',
    muted: '#9f6077',
    accent: '#c8567b',
    edge: '#eeb9c7',
    radius: 22,
  },
  'rainy-station': {
    panel: '#081b2aed',
    ink: '#e2f5ff',
    muted: '#7dd3fc',
    accent: '#0891b2',
    edge: '#1c566b',
    radius: 10,
  },
  'gothic-moon': {
    panel: '#170f25f2',
    ink: '#f5edf9',
    muted: '#ddbd86',
    accent: '#7e5ba6',
    edge: '#9d7a45',
    radius: 4,
  },
  'deepsea-sci-fi': {
    panel: '#071d35eb',
    ink: '#e2f8ff',
    muted: '#67e8f9',
    accent: '#1378aa',
    edge: '#297a99',
    radius: 16,
  },
};
export const experienceThemes = homepageCoverTemplates.map((cover) => ({
  ...cover,
  ...palettes[cover.id],
}));
export const getExperienceTheme = (id: string) => experienceThemes.find((t) => t.id === id);
export function themeAppearance(id: string): SurfaceAppearance {
  const t = getExperienceTheme(id) || experienceThemes[0];
  return {
    fills: [
      {
        ...newPaint(),
        id: 'theme-sheen',
        type: 'gradient',
        gradientStart: '#ffffff14',
        gradientEnd: '#ffffff00',
        gradientAngle: 145,
      },
      { ...newPaint(), id: 'theme-panel', color: t.panel },
    ],
    strokes: [{ id: 'theme-edge', enabled: true, color: t.edge, width: 1, position: 'inside' }],
    shadows: [
      {
        id: 'theme-depth',
        enabled: true,
        color: '#00000030',
        x: 0,
        y: 10,
        blur: 30,
        spread: 0,
        inset: false,
      },
    ],
  };
}
export function themeRenderPatch(id: string, style: RenderStyle): Partial<RenderStyle> {
  const t = getExperienceTheme(id);
  if (!t) return {};
  const objects = getRenderObjects(style);
  return {
    panelColor: t.panel.slice(0, 7),
    panelColorAlpha: 93,
    dialogRadius: t.radius,
    dialogVisible: true,
    titleColor: t.muted,
    bodyColor: t.ink,
    renderObjects: {
      ...objects,
      dialogBox: {
        ...objects.dialogBox,
        appearance: themeAppearance(id),
        radius: t.radius,
        corners: [t.radius, t.radius, t.radius, t.radius],
      },
      title: {
        ...objects.title,
        fill: { ...objects.title.fill, type: 'solid', color: t.muted, alpha: 100 },
      },
      body: {
        ...objects.body,
        fill: { ...objects.body.fill, type: 'solid', color: t.ink, alpha: 100 },
      },
    },
  };
}
export function themeMenuPatch(id: string, language: Language): Partial<WebExportSettings> {
  const t = getExperienceTheme(id);
  if (!t) return {};
  const decorate = (items: WebMenuElement[]) =>
    items.map((e) => ({
      ...e,
      textColor: e.kind === 'text' ? t.ink : '#ffffff',
      backgroundColor: t.panel,
      borderRadius: t.radius,
      ...(e.kind === 'button'
        ? {
            appearance: {
              ...themeAppearance(id),
              fills: [{ ...newPaint(), id: 'theme-button', color: e.primary ? t.accent : t.panel }],
            },
          }
        : {}),
    }));
  return {
    archiveBackgroundColor: t.panel,
    archiveBackgroundType: 'solid',
    settingsBackgroundColor: t.panel,
    settingsBackgroundType: 'solid',
    archivePageElements: decorate(buildArchivePageElements(language, t.accent, t.ink)),
    settingsPageElements: decorate(buildSettingsPageElements(language, t.accent, t.ink)),
  };
}

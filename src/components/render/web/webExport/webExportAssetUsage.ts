import type { SurfaceAppearance } from '../../shared/paint/appearance';
import type { RenderStyle, WebExportSettings, WebMenuElement } from '../../video/shared/types';

/** Strip dormant media from the export copy; keep the editor's authored data. */
export function usedAppearance(appearance?: SurfaceAppearance): SurfaceAppearance | undefined {
  if (!appearance) return undefined;
  const media = <T extends SurfaceAppearance['fills'][number]>(paint: T): T => ({
    ...paint,
    imageUrl: paint.type === 'image' ? paint.imageUrl : '',
    videoUrl: paint.type === 'video' ? paint.videoUrl : '',
  });
  return {
    ...appearance,
    fills: appearance.fills.filter((fill) => fill.enabled && fill.opacity > 0).map(media),
    strokes: appearance.strokes.filter((stroke) => stroke.enabled && stroke.width > 0).map((stroke) => ({
      ...stroke,
      paint: stroke.paint ? media(stroke.paint) : undefined,
    })),
    shadows: appearance.shadows.filter((shadow) => shadow.enabled),
  };
}

export function usedMenuElements(elements: WebMenuElement[]): WebMenuElement[] {
  return elements.map((element) => ({
    ...element,
    appearance: element.visible === false ? undefined : usedAppearance(element.appearance),
    imageUrl: element.visible !== false && element.kind === 'image' ? element.imageUrl : '',
    backgroundImageUrl: element.visible !== false && element.kind !== 'text' &&
      element.fillEnabled !== false && element.backgroundType === 'image' ? element.backgroundImageUrl : '',
  }));
}

export function usedRenderStyle(style: RenderStyle, elements: WebMenuElement[]): RenderStyle {
  const renderObjects = style.renderObjects && Object.fromEntries(
    Object.entries(style.renderObjects).map(([kind, object]) => [kind, {
      ...object,
      appearance: object.visible === false ? undefined : usedAppearance(object.appearance),
      fill: { ...object.fill, imageUrl: object.visible !== false && !object.appearance &&
        object.fill.enabled && object.fill.type === 'image' ? object.fill.imageUrl : '' },
    }]),
  ) as RenderStyle['renderObjects'];
  const fontFamilies = [style.titleFontFamily, style.bodyFontFamily, style.nameplateFontFamily,
    ...Object.values(renderObjects || {}).filter((object) => object.visible !== false)
      .map((object) => 'fontFamily' in object ? object.fontFamily : ''),
    ...elements.filter((element) => element.visible !== false).map((element) => element.fontFamily),
  ].filter(Boolean).join(',').toLowerCase();
  const usesFont = (family: string) => fontFamilies.split(',')
    .some((value) => value.trim().replace(/^['"]|['"]$/g, '') === family.toLowerCase());
  return {
    ...style,
    renderObjects,
    customFonts: style.customFonts?.filter((font) => usesFont(font.family)),
    dialogImageUrl: style.dialogVisible !== false && renderObjects?.dialogBox?.visible !== false && style.dialogBackgroundType === 'image' &&
      !renderObjects?.dialogBox?.appearance ? style.dialogImageUrl : '',
    nameplateImageUrl: style.nameplateVisible !== false && renderObjects?.nameplate?.visible !== false && !style.nameplateInside &&
      style.nameplateBackgroundType === 'image' && !renderObjects?.nameplate?.appearance ? style.nameplateImageUrl : '',
  };
}

export function usedSurfaceSettings(settings: WebExportSettings): WebExportSettings {
  const next = { ...settings };
  const pageKeys = ['startMenuElements', 'archivePageElements', 'settingsPageElements',
    'previewToolbarElements', 'dialogueOverlayElements', 'flowOverviewElements'] as const;
  pageKeys.forEach((key) => { next[key] = usedMenuElements(settings[key] || []); });
  next.surfaceAppearances = Object.fromEntries(Object.entries(settings.surfaceAppearances || {})
    .filter(([surface]) => surface !== 'start' || settings.showStartMenu)
    .map(([surface, appearance]) => [surface, usedAppearance(appearance)]));
  if (!settings.showStartMenu) next.startMenuElements = [];
  next.startMenuBackgroundImageUrl = settings.showStartMenu && !next.surfaceAppearances.start &&
    settings.startMenuBackgroundType === 'image' ? settings.startMenuBackgroundImageUrl : '';
  next.archiveBackgroundImageUrl = !next.surfaceAppearances.archive &&
    (settings.archiveBackgroundType || settings.startMenuBackgroundType) === 'image' ? settings.archiveBackgroundImageUrl || settings.startMenuBackgroundImageUrl : '';
  next.settingsBackgroundImageUrl = !next.surfaceAppearances.settings &&
    (settings.settingsBackgroundType || settings.startMenuBackgroundType) === 'image' ? settings.settingsBackgroundImageUrl || settings.startMenuBackgroundImageUrl : '';
  next.flowOverviewBackgroundImageUrl = !next.surfaceAppearances.flow &&
    settings.flowOverviewBackgroundType === 'image' ? settings.flowOverviewBackgroundImageUrl : '';
  next.dialogueBackgroundImageUrl = settings.dialogueBackgroundType === 'image' ? settings.dialogueBackgroundImageUrl : '';
  next.sceneBackgroundImageUrl = settings.sceneBackgroundVisible && settings.layoutMode !== 'immersive' &&
    settings.sceneBackgroundType === 'image' ? settings.sceneBackgroundImageUrl : '';
  return next;
}

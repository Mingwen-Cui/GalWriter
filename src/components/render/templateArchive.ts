const imageUrlKey = /image(?:url)?$/i;
const supportedImageExtension = /\.(avif|bmp|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;

const fileExtensionForImage = (url: string, mimeType: string) => {
  const extension = url.match(supportedImageExtension)?.[1]?.toLowerCase();
  if (extension) return extension === 'jpeg' ? 'jpg' : extension;
  const byMimeType: Record<string, string> = {
    'image/avif': 'avif',
    'image/bmp': 'bmp',
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
  };
  return byMimeType[mimeType.toLowerCase()] || 'png';
};

const canPackageImage = (key: string, value: string) =>
  imageUrlKey.test(key) &&
  (value.startsWith('data:image/') ||
    value.startsWith('blob:') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('/') ||
    supportedImageExtension.test(value));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const webPageSettingKeys = {
  home: [
    'showStartMenu',
    'startMenuTemplate',
    'startMenuBackgroundType',
    'startMenuBackgroundColor',
    'startMenuBackgroundGradientStart',
    'startMenuBackgroundGradientEnd',
    'startMenuBackgroundGradientAngle',
    'startMenuBackgroundGradientShape',
    'startMenuBackgroundGradientStops',
    'startMenuBackgroundImageUrl',
    'startMenuBackgroundVideoUrl',
    'startMenuBackgroundVideoLoop',
    'startMenuBackgroundVideoMuted',
    'startMenuBackgroundVideoFit',
    'startMenuElements',
    'startMenuPlacementBoundsLocked',
    'startMenuPlacementMinX',
    'startMenuPlacementMinY',
    'startMenuPlacementMaxX',
    'startMenuPlacementMaxY',
    'startMenuShowSave',
    'startMenuShowNewGame',
    'startMenuShowSettings',
  ],
  archive: [
    'archiveBackgroundType',
    'archiveBackgroundColor',
    'archiveBackgroundGradientStart',
    'archiveBackgroundGradientEnd',
    'archiveBackgroundGradientAngle',
    'archiveBackgroundGradientShape',
    'archiveBackgroundGradientStops',
    'archiveBackgroundImageUrl',
    'archiveBackgroundVideoUrl',
    'archiveBackgroundVideoLoop',
    'archiveBackgroundVideoMuted',
    'archiveBackgroundVideoFit',
    'archivePageElements',
    'startMenuMusicApplyToArchive',
  ],
  settings: [
    'settingsBackgroundType',
    'settingsBackgroundColor',
    'settingsBackgroundGradientStart',
    'settingsBackgroundGradientEnd',
    'settingsBackgroundGradientAngle',
    'settingsBackgroundGradientShape',
    'settingsBackgroundGradientStops',
    'settingsBackgroundImageUrl',
    'settingsBackgroundVideoUrl',
    'settingsBackgroundVideoLoop',
    'settingsBackgroundVideoMuted',
    'settingsBackgroundVideoFit',
    'settingsPageElements',
    'startMenuMusicApplyToSettings',
  ],
  dialogue: [
    'layoutMode',
    'sceneFit',
    'sceneScale',
    'sceneScaleX',
    'sceneScaleY',
    'sceneOffsetX',
    'sceneOffsetY',
    'sceneBackgroundVisible',
    'sceneBackgroundType',
    'sceneBackgroundColor',
    'sceneBackgroundGradientStart',
    'sceneBackgroundGradientEnd',
    'sceneBackgroundGradientAngle',
    'sceneBackgroundImageUrl',
    'choicesPosition',
    'skipSingleChoicePopup',
    'autoAdvance',
    'videoAutoPlay',
    'hideCharacterTags',
    'hideSceneTags',
    'dialogueBackgroundType',
    'dialogueBackgroundColor',
    'dialogueBackgroundGradientStart',
    'dialogueBackgroundGradientEnd',
    'dialogueBackgroundGradientAngle',
    'dialogueBackgroundGradientShape',
    'dialogueBackgroundGradientStops',
    'dialogueBackgroundImageUrl',
    'dialogueBackgroundVideoUrl',
    'dialogueBackgroundVideoLoop',
    'dialogueBackgroundVideoMuted',
    'dialogueBackgroundVideoFit',
    'previewToolbarElements',
    'dialogueOverlayElements',
  ],
} as const;

const splitWebExperienceTemplate = (template: unknown) => {
  if (!isRecord(template) || !isRecord(template.settings)) return null;
  const settings = template.settings;
  if (!Array.isArray(settings.startMenuElements)) return null;

  const { settings: _settings, renderStyle, ...shared } = template;
  const pages = Object.fromEntries(
    Object.entries(webPageSettingKeys).map(([surface, keys]) => [
      surface,
      {
        version: 1,
        surface,
        settings: Object.fromEntries(
          keys.filter((key) => key in settings).map((key) => [key, settings[key]]),
        ),
        ...(surface === 'dialogue' && renderStyle !== undefined ? { renderStyle } : {}),
      },
    ]),
  );
  return {
    manifest: {
      ...shared,
      version: 3,
      kind: 'galwriter-web-template',
      pages: {
        home: 'pages/home.json',
        archive: 'pages/archive.json',
        settings: 'pages/settings.json',
        dialogue: 'pages/dialogue.json',
      },
    },
    pages,
  };
};

/**
 * Packages a portable template: template.json keeps the design data and every
 * reachable image used by that data is copied to assets/ beside it.
 */
export const downloadTemplateArchive = async ({
  filename,
  template,
}: {
  filename: string;
  template: unknown;
}) => {
  if (typeof document === 'undefined') return;

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const packagedImages = new Map<string, string>();
  let imageIndex = 0;

  const packageImage = async (url: string, relativePrefix = '') => {
    const existing = packagedImages.get(url);
    if (existing) return `${relativePrefix}${existing}`;
    try {
      const response = await fetch(url);
      if (!response.ok) return url;
      const image = await response.blob();
      if (!image.type.startsWith('image/')) return url;
      const assetPath = `assets/image-${++imageIndex}.${fileExtensionForImage(url, image.type)}`;
      zip.file(assetPath, image);
      packagedImages.set(url, assetPath);
      return `${relativePrefix}${assetPath}`;
    } catch {
      // A cross-origin image may not allow downloading. Keep its source URL so
      // that the exported template does not silently lose that artwork.
      return url;
    }
  };

  const copyWithPackagedImages = async (
    value: unknown,
    key = '',
    relativePrefix = '',
  ): Promise<unknown> => {
    if (typeof value === 'string') {
      return canPackageImage(key, value) ? packageImage(value, relativePrefix) : value;
    }
    if (Array.isArray(value)) {
      return Promise.all(value.map((item) => copyWithPackagedImages(item, '', relativePrefix)));
    }
    if (!value || typeof value !== 'object') return value;

    const copied: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(value as Record<string, unknown>)) {
      copied[entryKey] = await copyWithPackagedImages(entryValue, entryKey, relativePrefix);
    }
    return copied;
  };

  const webBundle = splitWebExperienceTemplate(template);
  if (webBundle) {
    zip.file('template.json', JSON.stringify(webBundle.manifest, null, 2));
    for (const [surface, page] of Object.entries(webBundle.pages)) {
      const portablePage = await copyWithPackagedImages(page, '', '../');
      zip.file(`pages/${surface}.json`, JSON.stringify(portablePage, null, 2));
    }
  } else {
    const portableTemplate = await copyWithPackagedImages(template);
    zip.file('template.json', JSON.stringify(portableTemplate, null, 2));
  }
  const archive = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(archive);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.zip') ? filename : `${filename}.zip`;
  link.click();
  URL.revokeObjectURL(url);
};

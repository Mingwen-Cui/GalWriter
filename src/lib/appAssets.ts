/**
 * One public-asset address contract for bundled and rapid builds.
 *
 * Full builds keep large visual packs in the app. Rapid builds leave those
 * packs on the GalWriter website, so every caller must resolve its URL here
 * instead of hard-coding a root-relative public path.
 */
export type AssetEdition = 'full' | 'lite';

export const FULL_BUILD_DOWNLOAD_URL = 'https://mingwencui.com/galwriter/download.php';

const edition = import.meta.env.VITE_ASSET_EDITION === 'lite' ? 'lite' : 'full';
const configuredBaseUrl = String(import.meta.env.VITE_ASSET_BASE_URL || '').trim();
const defaultRemoteBaseUrl = 'https://mingwencui.com/online/galwriter-assets/';
const assistantOnlineBaseUrl = 'https://mingwencui.com/online/';

const normalizeBaseUrl = (value: string) => `${value.replace(/\/+$/, '')}/`;
const remoteBaseUrl = normalizeBaseUrl(configuredBaseUrl || defaultRemoteBaseUrl);

const remoteAssetRoots = ['presets/', 'cover-templates/', 'web-homepage/'] as const;
const assistantAssetRoots = ['assistant/'] as const;

const normalizeAssetPath = (path: string) => path.replace(/^\/+/, '').replace(/^\.\//, '');

const isKnownAppAssetPath = (path: string) => {
  const relativePath = normalizeAssetPath(path);
  return [...remoteAssetRoots, ...assistantAssetRoots].some((root) =>
    relativePath.startsWith(root),
  );
};

export const getAssetEdition = (): AssetEdition => edition;

export const isRapidAssetEdition = () => edition === 'lite';

export const isRemoteAssetPath = (path: string) =>
  remoteAssetRoots.some((root) => normalizeAssetPath(path).startsWith(root));

/**
 * Resolves checked-in public files without changing user uploads, blob URLs,
 * data URLs, or other external media.
 */
export const getAppAssetUrl = (path: string) => {
  if (!path || /^(?:blob:|data:|https?:)/i.test(path)) return path;

  const relativePath = normalizeAssetPath(path);
  if (isRapidAssetEdition() && assistantAssetRoots.some((root) => relativePath.startsWith(root))) {
    return `${assistantOnlineBaseUrl}${relativePath}`;
  }
  if (isRapidAssetEdition() && isRemoteAssetPath(relativePath)) {
    return `${remoteBaseUrl}${relativePath}`;
  }

  return `${import.meta.env.BASE_URL}${relativePath}`;
};

/**
 * Repairs known bundled-asset paths that came from an older project snapshot.
 * User uploads and arbitrary external media are intentionally left unchanged.
 */
export const resolveKnownAppAssetUrl = (path: string) => {
  if (!path || /^(?:blob:|data:|https?:)/i.test(path)) return path;
  return isKnownAppAssetPath(path) ? getAppAssetUrl(path) : path;
};

/** Public endpoint used by the release notes and downloadable asset manifest. */
export const getRemoteAssetBaseUrl = () => remoteBaseUrl;

import { openDB } from 'idb';

import { isTauriRuntime } from './tauriRuntime';

/**
 * Desktop bundles already contain presets. In the browser, only assets the
 * user explicitly chooses are retained locally instead of being preloaded.
 */
const DB_NAME = 'GalWriterPresetAssetCache';
const STORE_NAME = 'assets';

type CachedPresetAsset = {
  blob: Blob;
  updatedAt: number;
};

const objectUrls = new Map<string, string>();
let database: ReturnType<typeof openDB> | null = null;

const getDatabase = () => {
  if (!database) {
    database = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      },
    });
  }
  return database;
};

export const requiresPresetDownload = () => !isTauriRuntime();

export const hasCachedPresetAssets = async (urls: readonly string[]) => {
  if (!requiresPresetDownload() || urls.length === 0) return true;
  const db = await getDatabase();
  const records = await Promise.all(urls.map((url) => db.get(STORE_NAME, url)));
  return records.every(Boolean);
};

export const cachePresetAssets = async (urls: readonly string[]) => {
  if (!requiresPresetDownload() || urls.length === 0) return;

  const uniqueUrls = [...new Set(urls)];
  const db = await getDatabase();
  const missingUrls = (
    await Promise.all(
      uniqueUrls.map(async (url) => ((await db.get(STORE_NAME, url)) ? null : url)),
    )
  ).filter((url): url is string => Boolean(url));

  await Promise.all(
    missingUrls.map(async (url) => {
      const response = await fetch(url, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`Failed to download preset asset: ${response.status}`);
      const blob = await response.blob();
      if (!blob.size) throw new Error('Downloaded preset asset is empty.');
      await db.put(STORE_NAME, { blob, updatedAt: Date.now() } satisfies CachedPresetAsset, url);
    }),
  );
};

/** Returns an object URL only after the browser asset has been downloaded. */
export const getCachedPresetAssetUrl = async (url: string) => {
  if (!requiresPresetDownload()) return url;
  const knownUrl = objectUrls.get(url);
  if (knownUrl) return knownUrl;

  const record = (await (await getDatabase()).get(STORE_NAME, url)) as CachedPresetAsset | undefined;
  if (!record?.blob) return undefined;
  const objectUrl = URL.createObjectURL(record.blob);
  objectUrls.set(url, objectUrl);
  return objectUrl;
};

export const getCachedPresetAssetUrls = async (urls: readonly string[]) =>
  Object.fromEntries(
    (
      await Promise.all(
        [...new Set(urls)].map(async (url) => [url, await getCachedPresetAssetUrl(url)] as const),
      )
    ).filter((pair): pair is [string, string] => Boolean(pair[1])),
  );

import { DBSchema, IDBPDatabase, openDB } from 'idb';

interface GalWriterDB extends DBSchema {
  autosave: {
    key: 'current';
    value: {
      timestamp: number;
      snapshot: string;
      media: Record<string, Blob>;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<GalWriterDB>> | null = null;

const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<GalWriterDB>('GalWriterDB', 1, {
      upgrade(db) {
        db.createObjectStore('autosave');
      },
    });
  }
  return dbPromise;
};

/**
 * 提取快照中的 blob: URL 并将它们转换为实际的 Blob 数据，随后一并存入 IndexedDB
 */
export const saveAutoSave = async (snapshot: string): Promise<void> => {
  try {
    // 匹配所有 blob: URL (例如 blob:http://localhost:3000/xxx-yyy-zzz)
    const blobUrlRegex = /blob:https?:\/\/[^\s"'<>]+/g;
    const matches = snapshot.match(blobUrlRegex);
    const uniqueUrls = [...new Set(matches || [])];

    const media: Record<string, Blob> = {};

    await Promise.all(
      uniqueUrls.map(async (url) => {
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          media[url] = blob;
        } catch (err) {
          console.warn(`Failed to fetch blob for autosave: ${url}`, err);
        }
      }),
    );

    const db = await getDB();
    await db.put(
      'autosave',
      {
        timestamp: Date.now(),
        snapshot,
        media,
      },
      'current',
    );

    // console.log('[AutoSave] Saved successfully.', new Date().toLocaleTimeString());
  } catch (error) {
    console.error('[AutoSave] Failed to save to IndexedDB', error);
  }
};

/**
 * 获取自动保存的数据，并将过期的 blob: URL 替换为当前会话有效的新 blob: URL
 */
export const getAutoSave = async (): Promise<{ snapshot: string; timestamp: number } | null> => {
  try {
    const db = await getDB();
    const data = await db.get('autosave', 'current');
    if (!data) return null;

    let newSnapshot = data.snapshot;

    // 为每个旧的 Blob 生成一个新的会话有效 URL
    for (const [oldUrl, blob] of Object.entries(data.media)) {
      const newUrl = URL.createObjectURL(blob);
      // 替换快照中的旧 URL
      // 使用全局替换，因为同一个图片可能在多个地方（节点和边）被引用
      newSnapshot = newSnapshot.split(oldUrl).join(newUrl);
    }

    return { snapshot: newSnapshot, timestamp: data.timestamp };
  } catch (error) {
    console.error('[AutoSave] Failed to load from IndexedDB', error);
    return null;
  }
};

/**
 * 清除自动保存（通常在手动成功保存项目后调用）
 */
export const clearAutoSave = async (): Promise<void> => {
  try {
    const db = await getDB();
    await db.delete('autosave', 'current');
  } catch (error) {
    console.error('[AutoSave] Failed to clear IndexedDB', error);
  }
};

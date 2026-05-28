import { DBSchema, IDBPDatabase, openDB } from 'idb';

import type { ApiKeySettings, ProjectSettings, StoryProject } from '../domain/project';

export interface AutoSaveRecord {
  snapshot: string;
  timestamp: number;
}

export interface LocalProjectRecord {
  id: string;
  projectName: string;
  snapshot: StoryProject;
  updatedAt: number;
}

export interface LocalProjectSummary {
  id: string;
  projectName: string;
  updatedAt: number;
}

export interface LocalAppSettings {
  theme: 'light' | 'dark' | null;
  lastProjectId: string | null;
}

export type LocalApiKeySettings = ApiKeySettings &
  Pick<ProjectSettings, 'aiProvider' | 'imageApiUrl' | 'imageModel' | 'imageSize' | 'ttsApiUrl' | 'ttsModel' | 'ttsVoice' | 'ttsProvider' | 'thinkingMode'>;

interface StoredAutoSaveRecord {
  timestamp: number;
  snapshot: string;
  media: Record<string, Blob>;
}

interface StoredLocalProjectRecord {
  id: string;
  projectName: string;
  snapshot: string;
  media: Record<string, Blob>;
  updatedAt: number;
}

interface GalWriterDB extends DBSchema {
  autosave: {
    key: string;
    value: StoredAutoSaveRecord;
  };
  localProjects: {
    key: string;
    value: StoredLocalProjectRecord;
    indexes: {
      'by-updatedAt': number;
    };
  };
  appSettings: {
    key: string;
    value: LocalAppSettings;
  };
  apiSettings: {
    key: 'current';
    value: LocalApiKeySettings;
  };
}

const DB_NAME = 'GalWriterDB';
const DB_VERSION = 2;
const APP_SETTINGS_KEY = 'current';
const DEFAULT_APP_SETTINGS: LocalAppSettings = {
  theme: null,
  lastProjectId: null,
};

let dbPromise: Promise<IDBPDatabase<GalWriterDB>> | null = null;

const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<GalWriterDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('autosave');
        }

        if (!db.objectStoreNames.contains('localProjects')) {
          const projectStore = db.createObjectStore('localProjects', { keyPath: 'id' });
          projectStore.createIndex('by-updatedAt', 'updatedAt');
        }

        if (!db.objectStoreNames.contains('appSettings')) {
          db.createObjectStore('appSettings');
        }

        if (!db.objectStoreNames.contains('apiSettings')) {
          db.createObjectStore('apiSettings');
        }
      },
    });
  }
  return dbPromise;
};

const blobUrlRegex = /blob:https?:\/\/[^\s"'<>]+/g;

const extractSnapshotMedia = async (snapshot: string) => {
  const matches = snapshot.match(blobUrlRegex);
  const uniqueUrls = [...new Set(matches || [])];
  const media: Record<string, Blob> = {};

  await Promise.all(
    uniqueUrls.map(async (url) => {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        media[url] = blob;
      } catch (error) {
        console.warn(`Failed to fetch blob for autosave: ${url}`, error);
      }
    }),
  );

  return { snapshot, media };
};

const reviveSnapshotMedia = (snapshot: string, media: Record<string, Blob>) => {
  let revivedSnapshot = snapshot;

  for (const [oldUrl, blob] of Object.entries(media)) {
    const newUrl = URL.createObjectURL(blob);
    revivedSnapshot = revivedSnapshot.split(oldUrl).join(newUrl);
  }

  return revivedSnapshot;
};

export const saveAutoSave = async (snapshot: string): Promise<void> => {
  return saveNamedAutoSave('current', snapshot);
};

export const saveNamedAutoSave = async (key: string, snapshot: string): Promise<void> => {
  try {
    const db = await getDB();
    await db.put(
      'autosave',
      {
        ...(await extractSnapshotMedia(snapshot)),
        timestamp: Date.now(),
      },
      key,
    );
  } catch (error) {
    console.error('[AutoSave] Failed to save to IndexedDB', error);
  }
};

export const getAutoSave = async (): Promise<AutoSaveRecord | null> => {
  return getNamedAutoSave('current');
};

export const getNamedAutoSave = async (key: string): Promise<AutoSaveRecord | null> => {
  try {
    const db = await getDB();
    const data = await db.get('autosave', key);
    if (!data) return null;

    return {
      snapshot: reviveSnapshotMedia(data.snapshot, data.media),
      timestamp: data.timestamp,
    };
  } catch (error) {
    console.error('[AutoSave] Failed to load from IndexedDB', error);
    return null;
  }
};

export const clearAutoSave = async (): Promise<void> => {
  return clearNamedAutoSave('current');
};

export const clearNamedAutoSave = async (key: string): Promise<void> => {
  try {
    const db = await getDB();
    await db.delete('autosave', key);
  } catch (error) {
    console.error('[AutoSave] Failed to clear IndexedDB', error);
  }
};

export const saveLocalProject = async (record: LocalProjectRecord): Promise<void> => {
  const db = await getDB();
  const serializedSnapshot = JSON.stringify(record.snapshot);
  await db.put('localProjects', {
    id: record.id,
    projectName: record.projectName,
    updatedAt: record.updatedAt,
    ...(await extractSnapshotMedia(serializedSnapshot)),
  });
};

export const getLocalProject = async (id: string): Promise<LocalProjectRecord | null> => {
  const db = await getDB();
  const record = await db.get('localProjects', id);
  if (!record) return null;

  return {
    id: record.id,
    projectName: record.projectName,
    snapshot: JSON.parse(reviveSnapshotMedia(record.snapshot, record.media)) as StoryProject,
    updatedAt: record.updatedAt,
  };
};

export const getMostRecentLocalProject = async (): Promise<LocalProjectRecord | null> => {
  const db = await getDB();
  const tx = db.transaction('localProjects');
  const index = tx.store.index('by-updatedAt');
  const cursor = await index.openCursor(null, 'prev');
  await tx.done;
  if (!cursor) return null;

  return {
    id: cursor.value.id,
    projectName: cursor.value.projectName,
    snapshot: JSON.parse(reviveSnapshotMedia(cursor.value.snapshot, cursor.value.media)) as StoryProject,
    updatedAt: cursor.value.updatedAt,
  };
};

export const listLocalProjects = async (): Promise<LocalProjectSummary[]> => {
  const db = await getDB();
  const tx = db.transaction('localProjects');
  const index = tx.store.index('by-updatedAt');
  const summaries: LocalProjectSummary[] = [];
  let cursor = await index.openCursor(null, 'prev');

  while (cursor) {
    summaries.push({
      id: cursor.value.id,
      projectName: cursor.value.projectName,
      updatedAt: cursor.value.updatedAt,
    });
    cursor = await cursor.continue();
  }

  await tx.done;
  return summaries;
};

export const renameLocalProject = async (id: string, projectName: string): Promise<void> => {
  const db = await getDB();
  const record = await db.get('localProjects', id);
  if (!record) return;

  let nextSnapshot = record.snapshot;

  try {
    const parsedSnapshot = JSON.parse(record.snapshot) as StoryProject;
    nextSnapshot = JSON.stringify({
      ...parsedSnapshot,
      settings: {
        ...parsedSnapshot.settings,
        projectTitle: projectName,
      },
    } satisfies StoryProject);
  } catch (error) {
    console.warn('Failed to sync renamed project title into snapshot', error);
  }

  await db.put('localProjects', {
    ...record,
    projectName,
    snapshot: nextSnapshot,
    updatedAt: Date.now(),
  });
};

export const deleteLocalProject = async (id: string): Promise<void> => {
  const db = await getDB();
  await Promise.all([db.delete('localProjects', id), db.delete('autosave', id)]);

  const appSettings = await db.get('appSettings', APP_SETTINGS_KEY);
  if (appSettings?.lastProjectId === id) {
    await db.put(
      'appSettings',
      {
        ...appSettings,
        lastProjectId: null,
      },
      APP_SETTINGS_KEY,
    );
  }
};

export const saveAppSettings = async (
  nextSettings: Partial<LocalAppSettings>,
): Promise<LocalAppSettings> => {
  const db = await getDB();
  const current = ((await db.get('appSettings', APP_SETTINGS_KEY)) ??
    DEFAULT_APP_SETTINGS) as LocalAppSettings;
  const merged = { ...current, ...nextSettings };
  await db.put('appSettings', merged, APP_SETTINGS_KEY);
  return merged;
};

export const getAppSettings = async (): Promise<LocalAppSettings> => {
  const db = await getDB();
  return ((await db.get('appSettings', APP_SETTINGS_KEY)) ?? DEFAULT_APP_SETTINGS) as LocalAppSettings;
};

export const saveApiSettings = async (settings: LocalApiKeySettings): Promise<void> => {
  const db = await getDB();
  await db.put('apiSettings', settings, 'current');
};

export const getApiSettings = async (): Promise<LocalApiKeySettings | null> => {
  const db = await getDB();
  return (await db.get('apiSettings', 'current')) ?? null;
};

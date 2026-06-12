import { DBSchema, IDBPDatabase, openDB } from 'idb';

import type {
  ApiKeySettings,
  ProjectSettings,
  SavedAIProfile,
  StoryProject,
} from '../domain/project';

export interface AutoSaveRecord {
  snapshot: string;
  timestamp: number;
}

export interface LocalProjectRecord {
  id: string;
  projectName: string;
  snapshot: StoryProject;
  updatedAt: number;
  thumbnailDataUrl?: string | null;
}

export interface LocalProjectSummary {
  id: string;
  projectName: string;
  updatedAt: number;
  thumbnailDataUrl?: string | null;
}

export interface LocalAppSettings {
  theme: 'light' | 'dark' | null;
  lastProjectId: string | null;
  closeButtonBehavior: 'minimize' | 'quit';
  projectFilePaths: Record<string, string>;
  defaultProjectSaveDir: string | null;
}

export type LocalApiKeySettings = ApiKeySettings &
  Pick<
    ProjectSettings,
    | 'aiProvider'
    | 'imageApiUrl'
    | 'imageModel'
    | 'imageSize'
    | 'ttsApiUrl'
    | 'ttsModel'
    | 'ttsVoice'
    | 'ttsProvider'
    | 'thinkingMode'
  >;

export interface LocalAIProfilesState {
  profiles: SavedAIProfile[];
  activeTextProfileId: string | null;
  activeImageProfileId: string | null;
  activeVoiceProfileId: string | null;
}

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
  thumbnailDataUrl?: string | null;
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
  aiProfiles: {
    key: 'current';
    value: LocalAIProfilesState;
  };
}

const DB_NAME = 'GalWriterDB';
const DB_VERSION = 3;
const APP_SETTINGS_KEY = 'current';
const DEFAULT_APP_SETTINGS: LocalAppSettings = {
  theme: null,
  lastProjectId: null,
  closeButtonBehavior: 'quit',
  projectFilePaths: {},
  defaultProjectSaveDir: null,
};
const AI_PROFILES_KEY = 'current';
const DEFAULT_AI_PROFILES_STATE: LocalAIProfilesState = {
  profiles: [],
  activeTextProfileId: null,
  activeImageProfileId: null,
  activeVoiceProfileId: null,
};
const AUTO_TEXT_PROFILE_SIGNATURE = {
  name: 'DeepSeek 文本',
  provider: 'deepseek',
  apiKey: '',
  apiUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  thinkingMode: false,
} as const;
const AUTO_IMAGE_PROFILE_SIGNATURE = {
  name: '豆包图片',
  provider: 'doubao',
  apiKey: '',
  apiUrl: 'https://ark.cn-beijing.volces.com/api/v3',
  model: 'doubao-seedream-4-5-251128',
  size: '2K',
} as const;
const AUTO_VOICE_PROFILE_SIGNATURE = {
  name: '系统语音',
  provider: 'system',
  apiKey: '',
  apiUrl: 'https://openapi.youdao.com/ttsapi',
  model: '',
  voice: 'youxiaoqin',
  appKey: '',
} as const;

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

        if (!db.objectStoreNames.contains('aiProfiles')) {
          db.createObjectStore('aiProfiles');
        }
      },
    });
  }
  return dbPromise;
};

const normalizeProfileName = (name: string | undefined, fallback: string) => {
  const trimmed = (name || '').trim();
  return trimmed || fallback;
};

const isLikelyUrlProfileName = (name: string | undefined) =>
  /^https?:\/\//i.test((name || '').trim());

const buildProfileNameFallback = (profile: SavedAIProfile) => {
  if (profile.kind === 'text') return `${profile.provider || 'Text'} Text`;
  if (profile.kind === 'image') return `${profile.provider || 'Image'} Image`;
  return `${profile.provider || 'Voice'} Voice`;
};

const normalizeSavedProfileName = (profile: SavedAIProfile): SavedAIProfile => {
  const fallback = buildProfileNameFallback(profile);
  const name = isLikelyUrlProfileName(profile.name)
    ? fallback
    : normalizeProfileName(profile.name, fallback);
  return name === profile.name ? profile : ({ ...profile, name } as SavedAIProfile);
};

const createLegacyTextProfile = (settings: LocalApiKeySettings) => {
  const providerLabelMap: Partial<Record<ProjectSettings['aiProvider'], string>> = {
    deepseek: 'DeepSeek',
    gemini: 'Gemini',
    openai: 'OpenAI',
  };

  const resolveApiKey = () => {
    if (settings.aiProvider === 'deepseek') return settings.deepseekApiKey;
    if (settings.aiProvider === 'openai') return settings.openaiApiKey;
    return settings.customApiKey;
  };

  return {
    id: 'legacy-text-profile',
    name: normalizeProfileName(providerLabelMap[settings.aiProvider], 'Text AI'),
    kind: 'text' as const,
    provider: settings.aiProvider,
    apiKey: resolveApiKey(),
    apiUrl:
      settings.aiProvider === 'deepseek'
        ? 'https://api.deepseek.com'
        : settings.aiProvider === 'openai'
          ? 'https://api.openai.com/v1'
          : 'https://generativelanguage.googleapis.com',
    model:
      settings.aiProvider === 'deepseek'
        ? settings.thinkingMode
          ? 'deepseek-reasoner'
          : 'deepseek-chat'
        : settings.aiProvider === 'openai'
          ? 'gpt-4o'
          : settings.thinkingMode
            ? 'gemini-2.0-flash-thinking-exp'
            : 'gemini-2.0-flash',
    thinkingMode: settings.thinkingMode,
  };
};

const createLegacyImageProfile = (settings: LocalApiKeySettings) => ({
  id: 'legacy-image-profile',
  name: 'Image AI',
  kind: 'image' as const,
  provider: 'custom',
  apiKey: settings.imageApiKey,
  apiUrl: settings.imageApiUrl,
  model: settings.imageModel,
  size: settings.imageSize,
});

const createLegacyVoiceProfile = (settings: LocalApiKeySettings) => ({
  id: 'legacy-voice-profile',
  name: settings.ttsProvider === 'youdao' ? 'Youdao Voice' : 'System Voice',
  kind: 'voice' as const,
  provider: settings.ttsProvider,
  apiKey: settings.ttsApiKey,
  apiUrl: settings.ttsApiUrl,
  model: settings.ttsModel,
  voice: settings.ttsVoice,
  appKey: settings.ttsProvider === 'youdao' ? settings.ttsModel : '',
});

const dedupeProfiles = (profiles: SavedAIProfile[]) => {
  const seen = new Set<string>();
  return profiles.filter((profile) => {
    if (!profile.id || seen.has(profile.id)) return false;
    seen.add(profile.id);
    return true;
  });
};

const isAutogeneratedProfile = (profile: SavedAIProfile) => {
  if (profile.kind === 'text') {
    return (
      profile.name === AUTO_TEXT_PROFILE_SIGNATURE.name &&
      profile.provider === AUTO_TEXT_PROFILE_SIGNATURE.provider &&
      profile.apiKey === AUTO_TEXT_PROFILE_SIGNATURE.apiKey &&
      profile.apiUrl === AUTO_TEXT_PROFILE_SIGNATURE.apiUrl &&
      profile.model === AUTO_TEXT_PROFILE_SIGNATURE.model &&
      profile.thinkingMode === AUTO_TEXT_PROFILE_SIGNATURE.thinkingMode
    );
  }

  if (profile.kind === 'image') {
    return (
      profile.name === AUTO_IMAGE_PROFILE_SIGNATURE.name &&
      profile.provider === AUTO_IMAGE_PROFILE_SIGNATURE.provider &&
      profile.apiKey === AUTO_IMAGE_PROFILE_SIGNATURE.apiKey &&
      profile.apiUrl === AUTO_IMAGE_PROFILE_SIGNATURE.apiUrl &&
      profile.model === AUTO_IMAGE_PROFILE_SIGNATURE.model &&
      profile.size === AUTO_IMAGE_PROFILE_SIGNATURE.size
    );
  }

  return (
    profile.name === AUTO_VOICE_PROFILE_SIGNATURE.name &&
    profile.provider === AUTO_VOICE_PROFILE_SIGNATURE.provider &&
    profile.apiKey === AUTO_VOICE_PROFILE_SIGNATURE.apiKey &&
    profile.apiUrl === AUTO_VOICE_PROFILE_SIGNATURE.apiUrl &&
    profile.model === AUTO_VOICE_PROFILE_SIGNATURE.model &&
    profile.voice === AUTO_VOICE_PROFILE_SIGNATURE.voice &&
    profile.appKey === AUTO_VOICE_PROFILE_SIGNATURE.appKey
  );
};

const normalizeAIProfilesState = (
  state: LocalAIProfilesState | null | undefined,
): LocalAIProfilesState => {
  const profiles = dedupeProfiles(
    Array.isArray(state?.profiles)
      ? state.profiles.filter((profile): profile is SavedAIProfile => Boolean(profile?.id))
      : [],
  )
    .filter((profile) => !isAutogeneratedProfile(profile))
    .map(normalizeSavedProfileName);

  const getActiveId = (kind: 'text' | 'image' | 'voice', incoming: string | null | undefined) => {
    if (incoming && profiles.some((profile) => profile.kind === kind && profile.id === incoming)) {
      return incoming;
    }
    return profiles.find((profile) => profile.kind === kind)?.id ?? null;
  };

  return {
    profiles,
    activeTextProfileId: getActiveId('text', state?.activeTextProfileId),
    activeImageProfileId: getActiveId('image', state?.activeImageProfileId),
    activeVoiceProfileId: getActiveId('voice', state?.activeVoiceProfileId),
  };
};

const migrateLegacyApiSettings = async (db: IDBPDatabase<GalWriterDB>) => {
  const existingProfilesState = await db.get('aiProfiles', AI_PROFILES_KEY);
  if (existingProfilesState?.profiles?.length) {
    return normalizeAIProfilesState(existingProfilesState);
  }

  const legacySettings = await db.get('apiSettings', 'current');
  if (!legacySettings) {
    const normalized = normalizeAIProfilesState(DEFAULT_AI_PROFILES_STATE);
    await db.put('aiProfiles', normalized, AI_PROFILES_KEY);
    return normalized;
  }

  const migrated = normalizeAIProfilesState({
    profiles: [
      createLegacyTextProfile(legacySettings),
      createLegacyImageProfile(legacySettings),
      createLegacyVoiceProfile(legacySettings),
    ],
    activeTextProfileId: 'legacy-text-profile',
    activeImageProfileId: 'legacy-image-profile',
    activeVoiceProfileId: 'legacy-voice-profile',
  });

  await db.put('aiProfiles', migrated, AI_PROFILES_KEY);
  return migrated;
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
    thumbnailDataUrl: record.thumbnailDataUrl ?? null,
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
    thumbnailDataUrl: record.thumbnailDataUrl ?? null,
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
    snapshot: JSON.parse(
      reviveSnapshotMedia(cursor.value.snapshot, cursor.value.media),
    ) as StoryProject,
    updatedAt: cursor.value.updatedAt,
    thumbnailDataUrl: cursor.value.thumbnailDataUrl ?? null,
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
      thumbnailDataUrl: cursor.value.thumbnailDataUrl ?? null,
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
  const merged = { ...DEFAULT_APP_SETTINGS, ...current, ...nextSettings };
  await db.put('appSettings', merged, APP_SETTINGS_KEY);
  return merged;
};

export const getAppSettings = async (): Promise<LocalAppSettings> => {
  const db = await getDB();
  return {
    ...DEFAULT_APP_SETTINGS,
    ...((await db.get('appSettings', APP_SETTINGS_KEY)) ?? {}),
  } as LocalAppSettings;
};

export const saveApiSettings = async (settings: LocalApiKeySettings): Promise<void> => {
  const db = await getDB();
  await db.put('apiSettings', settings, 'current');
};

export const getApiSettings = async (): Promise<LocalApiKeySettings | null> => {
  const db = await getDB();
  return (await db.get('apiSettings', 'current')) ?? null;
};

export const saveAIProfiles = async (
  state: LocalAIProfilesState,
): Promise<LocalAIProfilesState> => {
  const db = await getDB();
  const normalized = normalizeAIProfilesState(state);
  await db.put('aiProfiles', normalized, AI_PROFILES_KEY);
  return normalized;
};

export const getAIProfiles = async (): Promise<LocalAIProfilesState> => {
  const db = await getDB();
  const existing = await db.get('aiProfiles', AI_PROFILES_KEY);
  if (existing) {
    const normalized = normalizeAIProfilesState(existing);
    if (JSON.stringify(normalized) !== JSON.stringify(existing)) {
      await db.put('aiProfiles', normalized, AI_PROFILES_KEY);
    }
    return normalized;
  }

  return migrateLegacyApiSettings(db);
};

import type {
  CharacterNodeData,
  SceneNodeData,
  SettingLibraryKind,
  SettingLibraryListItem,
} from './project';
import {
  cachePresetAssets,
  getCachedPresetAssetUrl,
  hasCachedPresetAssets,
  requiresPresetDownload,
} from '../lib/presetAssetCache';
import { isTauriRuntime } from '../lib/tauriRuntime';

export type CharacterSettingLibraryData = Pick<
  CharacterNodeData,
  | 'characterName'
  | 'identity'
  | 'appearance'
  | 'traits'
  | 'personality'
  | 'habits'
  | 'speechStyle'
  | 'experience'
  | 'relationships'
  | 'notes'
  | 'voiceProfileId'
  | 'voiceId'
  | 'features'
  | 'background'
  | 'other'
  | 'avatarUrl'
  | 'placeholderIdentityId'
  | 'threeViewUrl'
  | 'tagSpriteUrl'
  | 'outfits'
>;

export type SceneSettingLibraryData = Pick<
  SceneNodeData,
  | 'sceneName'
  | 'time'
  | 'weather'
  | 'visual'
  | 'sound'
  | 'notes'
  | 'description'
  | 'location'
  | 'items'
  | 'atmosphere'
  | 'other'
  | 'coverImageUrl'
  | 'images'
>;

export interface SettingLibraryItem {
  id: string;
  kind: SettingLibraryKind;
  name: string;
  data: CharacterSettingLibraryData | SceneSettingLibraryData;
  createdAt: number;
  updatedAt: number;
}

export interface SettingLibraryPresetManifestItem {
  id: string;
  kind: SettingLibraryKind;
  name: string;
  dataUrl: string;
}

/**
 * Presets are copied to `dist/presets` by Vite. Resolve them from the built
 * script rather than the site root: the web app may be hosted under a
 * subdirectory, while the desktop bundle keeps the same assets beside it.
 */
const presetAssetBaseUrl = import.meta.env.DEV || isTauriRuntime()
  ? '/presets/'
  : (import.meta.env.VITE_PRESET_ASSET_BASE_URL || 'https://mingwencui.com/online/presets/').replace(/\/?$/, '/');

const getPresetAssetUrl = (relativePath: string) => `${presetAssetBaseUrl}${relativePath}`;

const collectPresetMediaUrls = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return value.startsWith('/presets/') ? [getPresetAssetUrl(value.slice('/presets/'.length))] : [];
  }
  if (Array.isArray(value)) return value.flatMap(collectPresetMediaUrls);
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(collectPresetMediaUrls);
  }
  return [];
};

const resolvePresetMediaUrls = async (value: unknown): Promise<unknown> => {
  if (typeof value === 'string') {
    if (!value.startsWith('/presets/')) return value;
    const presetUrl = getPresetAssetUrl(value.slice('/presets/'.length));
    return (await getCachedPresetAssetUrl(presetUrl)) || presetUrl;
  }
  if (Array.isArray(value)) return Promise.all(value.map(resolvePresetMediaUrls));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      await Promise.all(
        Object.entries(value).map(async ([key, child]) => [key, await resolvePresetMediaUrls(child)]),
      ),
    );
  }
  return value;
};

/**
 * Keep this manifest small: the editable text and its image live together in public/presets.
 * Add a JSON file beside a new image, then add one line here so it appears in the library.
 */
export const SETTING_LIBRARY_PRESETS: SettingLibraryPresetManifestItem[] = [
  {
    id: 'preset-character-night-courier',
    kind: 'character',
    name: '夜班跑腿员',
    dataUrl: getPresetAssetUrl('characters/gu-yao.json'),
  },
  {
    id: 'preset-character-old-bookshop-owner',
    kind: 'character',
    name: '旧书店店主',
    dataUrl: getPresetAssetUrl('characters/wen-lan.json'),
  },
  {
    id: 'preset-character-micro-manager-jiang',
    kind: 'character',
    name: '老蒋（微操大师）',
    dataUrl: getPresetAssetUrl('characters/jiang-jieshi.json'),
  },
  {
    id: 'preset-character-rare-laughing-nai-long',
    kind: 'character',
    name: '大笑奶龙（稀有变体）',
    dataUrl: getPresetAssetUrl('characters/nai-long.json'),
  },
  {
    id: 'preset-character-lao-da-mamba',
    kind: 'character',
    name: '劳大（曼巴精神）',
    dataUrl: getPresetAssetUrl('characters/lao-da.json'),
  },
  {
    id: 'preset-character-fei-wu-belial',
    kind: 'character',
    name: '废雾贝利亚（抽象反派）',
    dataUrl: getPresetAssetUrl('characters/fei-wu-belial.json'),
  },
  {
    id: 'preset-scene-rainy-platform',
    kind: 'scene',
    name: '雨夜车站',
    dataUrl: getPresetAssetUrl('scenes/rainy-platform.json'),
  },
  {
    id: 'preset-scene-city-corner-plaza',
    kind: 'scene',
    name: '城市街角广场',
    dataUrl: getPresetAssetUrl('scenes/city-corner-plaza.json'),
  },
  {
    id: 'preset-scene-daves-front-yard',
    kind: 'scene',
    name: '戴夫的前院',
    dataUrl: getPresetAssetUrl('scenes/daves-front-yard.json'),
  },
];

export const getSettingLibraryPresets = (kind: SettingLibraryKind) =>
  SETTING_LIBRARY_PRESETS.filter((item) => item.kind === kind);

export const isSettingLibraryPresetDownloaded = async (id: string) => {
  const item = SETTING_LIBRARY_PRESETS.find((candidate) => candidate.id === id);
  return Boolean(item && await hasCachedPresetAssets([item.dataUrl]));
};

export const downloadSettingLibraryPresetAssets = async (id: string) => {
  const manifestItem = SETTING_LIBRARY_PRESETS.find((item) => item.id === id);
  if (!manifestItem) return null;

  try {
    const response = await fetch(manifestItem.dataUrl, { cache: 'force-cache' });
    if (!response.ok) return null;
    const payload = (await response.json()) as { data?: unknown };
    if (!payload.data || typeof payload.data !== 'object') return null;
    await cachePresetAssets([
      manifestItem.dataUrl,
      ...collectPresetMediaUrls(payload.data),
    ]);
    return loadSettingLibraryPreset(id);
  } catch (error) {
    console.error(`Failed to download setting-library preset: ${id}`, error);
    return null;
  }
};

export const loadSettingLibraryPreset = async (id: string): Promise<SettingLibraryItem | null> => {
  const manifestItem = SETTING_LIBRARY_PRESETS.find((item) => item.id === id);
  if (!manifestItem) return null;

  try {
    const dataUrl = requiresPresetDownload()
      ? await getCachedPresetAssetUrl(manifestItem.dataUrl)
      : manifestItem.dataUrl;
    if (!dataUrl) return null;
    const response = await fetch(dataUrl);
    if (!response.ok) return null;
    const payload = (await response.json()) as { data?: unknown };
    if (!payload.data || typeof payload.data !== 'object') return null;
    return {
      id: manifestItem.id,
      kind: manifestItem.kind,
      name: manifestItem.name,
      data: (await resolvePresetMediaUrls(payload.data)) as CharacterSettingLibraryData | SceneSettingLibraryData,
      createdAt: 0,
      updatedAt: 0,
    };
  } catch (error) {
    console.error(`Failed to load setting-library preset: ${id}`, error);
    return null;
  }
};

export const toSettingLibraryListItem = (
  item: Pick<SettingLibraryItem, 'id' | 'kind' | 'name' | 'data' | 'updatedAt'>,
  source: SettingLibraryListItem['source'],
  downloaded = true,
): SettingLibraryListItem => ({
  id: item.id,
  kind: item.kind,
  name: item.name,
  source,
  thumbnailUrl:
    item.kind === 'character'
      ? (item.data as CharacterSettingLibraryData).avatarUrl
      : (item.data as SceneSettingLibraryData).coverImageUrl,
  updatedAt: item.updatedAt,
  downloaded,
});

export const toCharacterSettingLibraryData = (
  data: CharacterNodeData,
): CharacterSettingLibraryData => ({
  characterName: data.characterName,
  identity: data.identity,
  appearance: data.appearance,
  traits: data.traits || '',
  personality: data.personality,
  habits: data.habits,
  speechStyle: data.speechStyle,
  experience: data.experience,
  relationships: data.relationships,
  notes: data.notes,
  voiceProfileId: data.voiceProfileId,
  voiceId: data.voiceId,
  features: data.features,
  background: data.background,
  other: data.other,
  avatarUrl: data.avatarUrl,
  placeholderIdentityId: data.placeholderIdentityId,
  threeViewUrl: data.threeViewUrl,
  tagSpriteUrl: data.tagSpriteUrl,
  outfits: data.outfits?.map((outfit) => ({ ...outfit })),
});

export const toSceneSettingLibraryData = (data: SceneNodeData): SceneSettingLibraryData => ({
  sceneName: data.sceneName,
  time: data.time,
  weather: data.weather,
  visual: data.visual,
  sound: data.sound,
  notes: data.notes,
  description: data.description || '',
  location: data.location,
  items: data.items,
  atmosphere: data.atmosphere,
  other: data.other,
  coverImageUrl: data.coverImageUrl,
  images: data.images?.map((image) => ({ ...image })),
});

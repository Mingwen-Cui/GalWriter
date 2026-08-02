import type {
  CharacterNodeData,
  SceneNodeData,
  SettingLibraryKind,
  SettingLibraryListItem,
} from './project';

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
 * Keep this manifest small: the editable text and its image live together in public/presets.
 * Add a JSON file beside a new image, then add one line here so it appears in the library.
 */
export const SETTING_LIBRARY_PRESETS: SettingLibraryPresetManifestItem[] = [
  {
    id: 'preset-character-night-courier',
    kind: 'character',
    name: '夜班跑腿员',
    dataUrl: '/presets/characters/gu-yao.json',
  },
  {
    id: 'preset-character-old-bookshop-owner',
    kind: 'character',
    name: '旧书店店主',
    dataUrl: '/presets/characters/wen-lan.json',
  },
  {
    id: 'preset-character-micro-manager-jiang',
    kind: 'character',
    name: '老蒋（微操大师）',
    dataUrl: '/presets/characters/jiang-jieshi.json',
  },
  {
    id: 'preset-scene-rainy-platform',
    kind: 'scene',
    name: '雨夜车站',
    dataUrl: '/presets/scenes/rainy-platform.json',
  },
  {
    id: 'preset-scene-afternoon-archive-room',
    kind: 'scene',
    name: '午后资料室',
    dataUrl: '/presets/scenes/afternoon-archive-room.json',
  },
];

export const getSettingLibraryPresets = (kind: SettingLibraryKind) =>
  SETTING_LIBRARY_PRESETS.filter((item) => item.kind === kind);

export const loadSettingLibraryPreset = async (id: string): Promise<SettingLibraryItem | null> => {
  const manifestItem = SETTING_LIBRARY_PRESETS.find((item) => item.id === id);
  if (!manifestItem) return null;

  try {
    const response = await fetch(manifestItem.dataUrl);
    if (!response.ok) return null;
    const payload = (await response.json()) as { data?: unknown };
    if (!payload.data || typeof payload.data !== 'object') return null;
    return {
      id: manifestItem.id,
      kind: manifestItem.kind,
      name: manifestItem.name,
      data: payload.data as CharacterSettingLibraryData | SceneSettingLibraryData,
      createdAt: 0,
      updatedAt: 0,
    };
  } catch (error) {
    console.error(`Failed to load setting-library preset: ${id}`, error);
    return null;
  }
};

export const toSettingLibraryListItem = (
  item: Pick<SettingLibraryItem, 'id' | 'kind' | 'name' | 'updatedAt'>,
  source: SettingLibraryListItem['source'],
): SettingLibraryListItem => ({
  id: item.id,
  kind: item.kind,
  name: item.name,
  source,
  updatedAt: item.updatedAt,
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

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
  | 'features'
  | 'background'
  | 'other'
  | 'avatarUrl'
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

const characterPreset = (
  id: string,
  name: string,
  data: CharacterSettingLibraryData,
): SettingLibraryItem => ({ id, kind: 'character', name, data, createdAt: 0, updatedAt: 0 });

const scenePreset = (id: string, name: string, data: SceneSettingLibraryData): SettingLibraryItem => ({
  id,
  kind: 'scene',
  name,
  data,
  createdAt: 0,
  updatedAt: 0,
});

export const SETTING_LIBRARY_PRESETS: SettingLibraryItem[] = [
  characterPreset('preset-character-night-courier', '夜班跑腿员', {
    characterName: '顾遥',
    identity: '22岁 · 夜班跑腿员',
    avatarUrl: '/presets/characters/gu-yao.png',
    appearance: '深色雨衣，旧球鞋，常把头发随手扎起。',
    traits: '',
    personality: '对人礼貌，但不轻易解释自己。',
    habits: '等红灯时会数路边亮着的窗户。',
    speechStyle: '句子很短，偶尔会说出意外准确的比喻。',
    experience: '熟悉城市里多数不愿被记住的小路。',
    relationships: '与附近便利店店员互相认识。',
    notes: '怕狗，却总会随身带一小包狗粮。',
  }),
  characterPreset('preset-character-old-bookshop-owner', '旧书店店主', {
    characterName: '闻岚',
    identity: '34岁 · 二手书店店主',
    avatarUrl: '/presets/characters/wen-lan.png',
    appearance: '总穿褪色衬衫，手指常沾着纸灰。',
    traits: '',
    personality: '温和而固执，对遗失的东西格外上心。',
    habits: '会在每本卖出的旧书里夹一张空白书签。',
    speechStyle: '说话慢，喜欢先反问一句。',
    experience: '曾在不同城市的旧书店做过店员。',
    relationships: '和常来避雨的邻居保持点头之交。',
    notes: '记得每本书从哪一排离开。',
  }),
  scenePreset('preset-scene-rainy-platform', '雨夜车站', {
    sceneName: '雨夜车站',
    location: '城郊支线尽头的小站台。',
    time: '深夜，末班车刚离开。',
    weather: '持续小雨，空气潮冷。',
    visual: '褪色站牌、积水和一盏闪烁的顶灯。',
    sound: '雨滴敲铁皮，远处偶尔有货车经过。',
    items: '自动售票机、折叠伞、停摆的时刻表。',
    notes: '站台另一端没有照明。',
    description: '',
  }),
  scenePreset('preset-scene-afternoon-archive-room', '午后资料室', {
    sceneName: '午后资料室',
    location: '学校旧楼二层的资料室。',
    time: '下午三点，阳光斜照进来。',
    weather: '窗外闷热，室内有纸张和灰尘的干燥气味。',
    visual: '高书架遮住半扇窗，桌面堆着未归档的文件夹。',
    sound: '风扇转动、纸页摩擦，走廊偶尔传来脚步声。',
    items: '索引卡、木梯、旧风扇、上锁的铁柜。',
    notes: '最里面一排书架后有一张窄桌。',
    description: '',
  }),
];

export const getSettingLibraryPresets = (kind: SettingLibraryKind) =>
  SETTING_LIBRARY_PRESETS.filter((item) => item.kind === kind);

export const getSettingLibraryPreset = (id: string) =>
  SETTING_LIBRARY_PRESETS.find((item) => item.id === id) ?? null;

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
  features: data.features,
  background: data.background,
  other: data.other,
  avatarUrl: data.avatarUrl,
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

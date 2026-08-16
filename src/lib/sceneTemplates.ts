import type {
  SceneAmbientSound,
  SceneEnvironment,
  SceneFilterPreset,
  SceneLightingPreset,
  SceneVisualStyle,
} from '../domain/project';

export type SceneVisualTemplate = {
  id: string;
  environment: SceneEnvironment;
  name: string;
  description: string;
  /** Optional card image. When absent the picker uses the themed colour preview. */
  previewUrl?: string;
  style: SceneVisualStyle;
  suggestedAmbientPresetId?: string;
};

export type PresetAmbientTrack = {
  id: string;
  name: string;
  environment: SceneEnvironment;
  /** Path under public/, e.g. presets/scenes/images/inner/music/... */
  assetPath: string;
  /** Optional cover art for the picker tile. */
  coverUrl?: string;
  loop?: boolean;
  volume?: number;
};

export type SceneBackgroundPreset = {
  id: string;
  environment: SceneEnvironment;
  label: string;
  /** Path under public/, e.g. presets/scenes/images/inner/background/... */
  assetPath: string;
};

const SCENE_ASSET_ROOT = 'presets/scenes/images';

/** Folder name is intentionally `outter` to match the on-disk preset pack. */
const sceneFolder = (environment: SceneEnvironment) =>
  environment === 'indoor' ? 'inner' : 'outter';

export const getScenePresetAssetUrl = (assetPath: string) => {
  if (!assetPath) return '';
  if (/^(?:blob:|data:|https?:)/i.test(assetPath)) return assetPath;
  const encoded = assetPath
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `${import.meta.env.BASE_URL}${encoded}`;
};

/** @deprecated Prefer getScenePresetAssetUrl — kept for existing call sites. */
export const getSceneBackgroundAssetUrl = getScenePresetAssetUrl;

const indoorLightFiles = [
  'ChatGPT Image 2026年8月16日 18_16_28 (1).png',
  'ChatGPT Image 2026年8月16日 18_16_29 (2).png',
  'ChatGPT Image 2026年8月16日 18_16_29 (3).png',
  'ChatGPT Image 2026年8月16日 18_16_30 (4).png',
] as const;

const outdoorLightFiles = [
  'ChatGPT Image 2026年8月16日 18_16_30 (5).png',
  'ChatGPT Image 2026年8月16日 18_16_30 (6).png',
  'ChatGPT Image 2026年8月16日 18_16_31 (7).png',
  'ChatGPT Image 2026年8月16日 18_16_31 (8).png',
] as const;

const indoorLightStyles: Array<Omit<SceneVisualStyle, 'templateId'> & { name: string; description: string }> = [
  {
    name: '打光 1',
    description: '清透自然光。',
    lighting: 'natural-daylight',
    backgroundBlur: 1,
    filter: 'clear',
    intensity: 62,
  },
  {
    name: '打光 2',
    description: '局部暖光。',
    lighting: 'warm-lamp',
    backgroundBlur: 4,
    filter: 'warm-film',
    intensity: 72,
  },
  {
    name: '打光 3',
    description: '均匀冷白顶光。',
    lighting: 'cool-fluorescent',
    backgroundBlur: 0,
    filter: 'cool-cinematic',
    intensity: 48,
  },
  {
    name: '打光 4',
    description: '霓虹侧光。',
    lighting: 'neon-side-light',
    backgroundBlur: 6,
    filter: 'neon',
    intensity: 78,
  },
];

const outdoorLightStyles: Array<Omit<SceneVisualStyle, 'templateId'> & { name: string; description: string }> = [
  {
    name: '打光 5',
    description: '明亮日光。',
    lighting: 'natural-daylight',
    backgroundBlur: 0,
    filter: 'clear',
    intensity: 58,
  },
  {
    name: '打光 6',
    description: '黄昏逆光。',
    lighting: 'golden-hour',
    backgroundBlur: 3,
    filter: 'warm-film',
    intensity: 76,
  },
  {
    name: '打光 7',
    description: '阴雨散射光。',
    lighting: 'overcast-rain',
    backgroundBlur: 2,
    filter: 'muted-rain',
    intensity: 68,
  },
  {
    name: '打光 8',
    description: '夜街环境光。',
    lighting: 'night-street',
    backgroundBlur: 5,
    filter: 'night-blue',
    intensity: 82,
  },
];

const buildLightTemplates = (
  environment: SceneEnvironment,
  files: readonly string[],
  styles: Array<Omit<SceneVisualStyle, 'templateId'> & { name: string; description: string }>,
): SceneVisualTemplate[] =>
  files.map((file, index) => {
    const meta = styles[index] || styles[0]!;
    const id = `${environment}-light-${index + 1}`;
    const assetPath = `${SCENE_ASSET_ROOT}/${sceneFolder(environment)}/light/${file}`;
    return {
      id,
      environment,
      name: meta.name,
      description: meta.description,
      previewUrl: getScenePresetAssetUrl(assetPath),
      style: {
        templateId: id,
        lighting: meta.lighting,
        backgroundBlur: meta.backgroundBlur,
        filter: meta.filter,
        intensity: meta.intensity,
      },
    };
  });

/** Lighting picker entries — sourced from scenes/images/{inner|outter}/light. */
export const sceneVisualTemplates: SceneVisualTemplate[] = [
  ...buildLightTemplates('indoor', indoorLightFiles, indoorLightStyles),
  ...buildLightTemplates('outdoor', outdoorLightFiles, outdoorLightStyles),
];

export const sceneLightingOptions: Array<{ id: SceneLightingPreset; name: string }> = [
  { id: 'natural-daylight', name: '自然日光' },
  { id: 'warm-lamp', name: '暖灯' },
  { id: 'cool-fluorescent', name: '冷白顶光' },
  { id: 'neon-side-light', name: '霓虹侧光' },
  { id: 'golden-hour', name: '黄昏逆光' },
  { id: 'overcast-rain', name: '阴雨散射光' },
  { id: 'night-street', name: '夜街环境光' },
];

export const sceneFilterOptions: Array<{ id: SceneFilterPreset; name: string }> = [
  { id: 'none', name: '无滤镜' },
  { id: 'clear', name: '清透' },
  { id: 'warm-film', name: '暖色胶片' },
  { id: 'cool-cinematic', name: '冷色电影' },
  { id: 'neon', name: '霓虹' },
  { id: 'muted-rain', name: '雨雾低饱和' },
  { id: 'night-blue', name: '深蓝夜景' },
];

export const defaultSceneVisualStyle = (): SceneVisualStyle => ({
  lighting: 'natural-daylight',
  backgroundBlur: 0,
  filter: 'none',
  intensity: 50,
});

export const normalizeSceneVisualStyle = (value: Partial<SceneVisualStyle> | undefined) => ({
  ...defaultSceneVisualStyle(),
  ...value,
  backgroundBlur: Math.max(0, Math.min(16, Number(value?.backgroundBlur ?? 0))),
  intensity: Math.max(0, Math.min(100, Number(value?.intensity ?? 50))),
});

export const getSceneVisualTemplate = (id: string | undefined) =>
  sceneVisualTemplates.find((template) => template.id === id);

export const getSceneVisualTemplates = (environment: SceneEnvironment) =>
  sceneVisualTemplates.filter((template) => template.environment === environment);

/** Background images under scenes/images/{inner|outter}/background. */
export const SCENE_BACKGROUND_PRESETS: SceneBackgroundPreset[] = [
  {
    id: 'inner-3',
    environment: 'indoor',
    label: '场景 3',
    assetPath: `${SCENE_ASSET_ROOT}/inner/background/background (3).png`,
  },
  {
    id: 'inner-4',
    environment: 'indoor',
    label: '场景 4',
    assetPath: `${SCENE_ASSET_ROOT}/inner/background/background (4).png`,
  },
  {
    id: 'inner-5',
    environment: 'indoor',
    label: '场景 5',
    assetPath: `${SCENE_ASSET_ROOT}/inner/background/background (5).png`,
  },
  {
    id: 'inner-6',
    environment: 'indoor',
    label: '场景 6',
    assetPath: `${SCENE_ASSET_ROOT}/inner/background/background (6).png`,
  },
  {
    id: 'outter-1',
    environment: 'outdoor',
    label: '场景 1',
    assetPath: `${SCENE_ASSET_ROOT}/outter/background/background (1).png`,
  },
  {
    id: 'outter-2',
    environment: 'outdoor',
    label: '场景 2',
    assetPath: `${SCENE_ASSET_ROOT}/outter/background/background (2).png`,
  },
  {
    id: 'outter-7',
    environment: 'outdoor',
    label: '场景 7',
    assetPath: `${SCENE_ASSET_ROOT}/outter/background/background (7).png`,
  },
  {
    id: 'outter-8',
    environment: 'outdoor',
    label: '场景 8',
    assetPath: `${SCENE_ASSET_ROOT}/outter/background/background (8).png`,
  },
];

export const getSceneBackgroundPresets = (environment: SceneEnvironment) =>
  SCENE_BACKGROUND_PRESETS.filter((item) => item.environment === environment);

export const isSameSceneBackgroundUrl = (currentUrl: string | undefined, assetPath: string) => {
  if (!currentUrl || !assetPath) return false;
  const resolved = getScenePresetAssetUrl(assetPath);
  if (currentUrl === resolved || currentUrl === assetPath) return true;
  try {
    const currentPath = decodeURIComponent(new URL(currentUrl, window.location.origin).pathname);
    const assetSuffix = `/${assetPath.replace(/^\/+/, '')}`;
    return (
      currentPath.endsWith(assetSuffix) ||
      currentPath.endsWith(
        `/${assetPath
          .replace(/^\/+/, '')
          .split('/')
          .map((part) => encodeURIComponent(part))
          .join('/')}`,
      )
    );
  } catch {
    return currentUrl.includes(assetPath) || currentUrl.includes(encodeURI(assetPath));
  }
};

/**
 * Scene ambience tracks live under scenes/images/{inner|outter}/music.
 * Add files there and register them here — do not use /presets/music.
 */
export const SCENE_AMBIENT_PRESETS: PresetAmbientTrack[] = [
  // Currently empty on disk; upload remains available in the UI.
];

export const getSceneAmbientPresets = (environment: SceneEnvironment) =>
  SCENE_AMBIENT_PRESETS.filter((track) => track.environment === environment);

export const listSceneAmbientPresets = async (environment: SceneEnvironment) =>
  getSceneAmbientPresets(environment);

export const sceneAmbientPresetUrl = (track: Pick<PresetAmbientTrack, 'assetPath'> | string) =>
  typeof track === 'string' ? getScenePresetAssetUrl(track) : getScenePresetAssetUrl(track.assetPath);

export const isSceneAmbientPresetDownloaded = async (presetId: string) =>
  SCENE_AMBIENT_PRESETS.some((track) => track.id === presetId);

export const downloadSceneAmbientPreset = async (presetId: string) => {
  const track = SCENE_AMBIENT_PRESETS.find((candidate) => candidate.id === presetId);
  if (!track) return null;
  return { track, sourceUrl: sceneAmbientPresetUrl(track) };
};

export const resolveSceneAmbientPresetUrl = async (sound: SceneAmbientSound | undefined) => {
  if (!sound?.enabled || sound.source !== 'preset' || !sound.presetId) return undefined;
  const track = SCENE_AMBIENT_PRESETS.find((candidate) => candidate.id === sound.presetId);
  if (track) return sceneAmbientPresetUrl(track);
  return sound.url;
};

export const ambientSoundFromPreset = (
  track: PresetAmbientTrack,
  sourceUrl = sceneAmbientPresetUrl(track),
  enabled = false,
): SceneAmbientSound => ({
  enabled,
  source: 'preset',
  presetId: track.id,
  url: sourceUrl,
  name: track.name,
  loop: track.loop !== false,
  volume: Math.max(0, Math.min(1, Number(track.volume ?? 0.45))),
  fadeIn: 0.8,
  fadeOut: 0.8,
});

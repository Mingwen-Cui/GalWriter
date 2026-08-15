import type {
  SceneAmbientSound,
  SceneEnvironment,
  SceneFilterPreset,
  SceneLightingPreset,
  SceneVisualStyle,
} from '../domain/project';
import {
  cachePresetAssets,
  getCachedPresetAssetUrl,
  hasCachedPresetAssets,
  requiresPresetDownload,
} from './presetAssetCache';

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
  file: string;
  /** Optional cover art supplied by the preset manifest. */
  coverUrl?: string;
  tags?: string[];
  loop?: boolean;
  volume?: number;
};

type PresetMusicManifest = { tracks?: PresetAmbientTrack[] };

export const PRESET_MUSIC_MANIFEST_URL = '/presets/music/manifest.json';

export const sceneVisualTemplates: SceneVisualTemplate[] = [
  {
    id: 'indoor-window-daylight',
    environment: 'indoor',
    name: '窗边日光',
    description: '清透自然光，适合教室、书房和咖啡馆。',
    style: { templateId: 'indoor-window-daylight', lighting: 'natural-daylight', backgroundBlur: 1, filter: 'clear', intensity: 62 },
  },
  {
    id: 'indoor-warm-lamp',
    environment: 'indoor',
    name: '暖灯夜读',
    description: '局部暖光与柔和景深，适合夜晚的室内场景。',
    style: { templateId: 'indoor-warm-lamp', lighting: 'warm-lamp', backgroundBlur: 4, filter: 'warm-film', intensity: 72 },
    suggestedAmbientPresetId: 'cafe-ambient',
  },
  {
    id: 'indoor-cool-fluorescent',
    environment: 'indoor',
    name: '冷白顶光',
    description: '均匀、理性的室内冷光。',
    style: { templateId: 'indoor-cool-fluorescent', lighting: 'cool-fluorescent', backgroundBlur: 0, filter: 'cool-cinematic', intensity: 48 },
  },
  {
    id: 'indoor-neon-room',
    environment: 'indoor',
    name: '霓虹侧光',
    description: '紫蓝侧光与更强的景深。',
    style: { templateId: 'indoor-neon-room', lighting: 'neon-side-light', backgroundBlur: 6, filter: 'neon', intensity: 78 },
  },
  {
    id: 'outdoor-clear-day',
    environment: 'outdoor',
    name: '晴天街景',
    description: '明亮日光与清晰的环境层次。',
    style: { templateId: 'outdoor-clear-day', lighting: 'natural-daylight', backgroundBlur: 0, filter: 'clear', intensity: 58 },
    suggestedAmbientPresetId: 'upbeat-daily',
  },
  {
    id: 'outdoor-golden-hour',
    environment: 'outdoor',
    name: '黄昏逆光',
    description: '金色边缘光和电影感暖色。',
    style: { templateId: 'outdoor-golden-hour', lighting: 'golden-hour', backgroundBlur: 3, filter: 'warm-film', intensity: 76 },
  },
  {
    id: 'outdoor-overcast-rain',
    environment: 'outdoor',
    name: '阴雨雾景',
    description: '低饱和散射光与轻微空气感。',
    style: { templateId: 'outdoor-overcast-rain', lighting: 'overcast-rain', backgroundBlur: 2, filter: 'muted-rain', intensity: 68 },
  },
  {
    id: 'outdoor-night-street',
    environment: 'outdoor',
    name: '夜街霓虹',
    description: '深蓝环境光与局部霓虹高光。',
    style: { templateId: 'outdoor-night-street', lighting: 'night-street', backgroundBlur: 5, filter: 'night-blue', intensity: 82 },
    suggestedAmbientPresetId: 'rooftop-southeast-mountain',
  },
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

export const sceneAmbientPresetUrl = (file: string) =>
  `/presets/music/${file
    .split('/')
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join('/')}`;

const readManifest = async (cached: boolean) => {
  const url = cached && requiresPresetDownload()
    ? await getCachedPresetAssetUrl(PRESET_MUSIC_MANIFEST_URL)
    : PRESET_MUSIC_MANIFEST_URL;
  if (!url) return [];
  const response = await fetch(url, { cache: 'force-cache' });
  if (!response.ok) return [];
  const manifest = (await response.json()) as PresetMusicManifest;
  return (manifest.tracks || []).filter((track) => Boolean(track.id && track.name && track.file));
};

export const listSceneAmbientPresets = () => readManifest(false);

export const isSceneAmbientPresetDownloaded = async (presetId: string) => {
  if (!requiresPresetDownload()) return true;
  const tracks = await readManifest(false);
  const track = tracks.find((candidate) => candidate.id === presetId);
  return Boolean(track && await hasCachedPresetAssets([PRESET_MUSIC_MANIFEST_URL, sceneAmbientPresetUrl(track.file)]));
};

export const downloadSceneAmbientPreset = async (presetId: string) => {
  const tracks = await readManifest(false);
  const track = tracks.find((candidate) => candidate.id === presetId);
  if (!track) return null;
  const sourceUrl = sceneAmbientPresetUrl(track.file);
  await cachePresetAssets([PRESET_MUSIC_MANIFEST_URL, sourceUrl]);
  return { track, sourceUrl };
};

export const resolveSceneAmbientPresetUrl = async (sound: SceneAmbientSound | undefined) => {
  if (!sound?.enabled || sound.source !== 'preset' || !sound.presetId) return undefined;
  if (!requiresPresetDownload()) return sound.url;
  if (!sound.url || !(await hasCachedPresetAssets([sound.url]))) return undefined;
  return getCachedPresetAssetUrl(sound.url);
};

export const ambientSoundFromPreset = (
  track: PresetAmbientTrack,
  sourceUrl = sceneAmbientPresetUrl(track.file),
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

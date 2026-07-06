import { v4 as uuidv4 } from 'uuid';

import type {
  BackgroundRemovalAIProfile,
  ImageAIProfile,
  SavedAIProfile,
  TextAIProfile,
  VoiceAIProfile,
} from '../../domain/project';
import {
  DEFAULT_IMAGE_API_URL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_STABLE_DIFFUSION_CFG_SCALE,
  DEFAULT_STABLE_DIFFUSION_SAMPLER,
  DEFAULT_STABLE_DIFFUSION_STEPS,
} from '../../editor-features/media/imageGeneration';
import { DEFAULT_TTS_API_URL, DEFAULT_TTS_MODEL, DEFAULT_TTS_VOICE } from './constants';

export const buildProfileId = () => uuidv4();

export const buildDefaultTextProfile = (): TextAIProfile => {
  // User-created profiles remain independent from the web-only hosted proxy.
  return {
    id: buildProfileId(),
    name: '',
    kind: 'text',
    provider: 'deepseek',
    apiKey: '',
    apiUrl: '',
    model: '',
    thinkingMode: false,
  };
};

export const buildDefaultImageProfile = (): ImageAIProfile => ({
  id: buildProfileId(),
  name: '豆包图片',
  kind: 'image',
  provider: 'doubao',
  apiKey: '',
  apiUrl: DEFAULT_IMAGE_API_URL,
  model: DEFAULT_IMAGE_MODEL,
  size: DEFAULT_IMAGE_SIZE,
  negativePrompt: '',
  steps: DEFAULT_STABLE_DIFFUSION_STEPS,
  cfgScale: DEFAULT_STABLE_DIFFUSION_CFG_SCALE,
  sampler: DEFAULT_STABLE_DIFFUSION_SAMPLER,
  seed: -1,
  restoreFaces: false,
  enableHr: false,
  hrScale: 2,
  denoisingStrength: 0.7,
});

export const buildDefaultBackgroundRemovalProfile = (): BackgroundRemovalAIProfile => ({
  id: buildProfileId(),
  name: '去背景 AI',
  kind: 'background-removal',
  provider: 'custom',
  apiKey: '',
  apiUrl: 'api/proxy.php',
  model: '',
});

export const buildDefaultVoiceProfile = (): VoiceAIProfile => ({
  id: buildProfileId(),
  name: '系统语音',
  kind: 'voice',
  provider: 'system',
  apiKey: '',
  apiUrl: DEFAULT_TTS_API_URL,
  model: DEFAULT_TTS_MODEL,
  voice: DEFAULT_TTS_VOICE,
  appKey: '',
  appSecret: '',
});

export const updateProfileList = (
  profiles: SavedAIProfile[],
  profileId: string,
  updater: (profile: SavedAIProfile) => SavedAIProfile,
) => profiles.map((profile) => (profile.id === profileId ? updater(profile) : profile));

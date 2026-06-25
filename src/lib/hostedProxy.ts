import type { ImageAIProfile, TextAIProfile, VoiceAIProfile } from '../domain/project';
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_SIZE,
} from '../editor-features/media/imageGeneration';

/**
 * NOTE: 鍥哄畾 ID锛岀敤浜庢爣璇嗙綉椤垫墭绠′唬鐞嗙殑铏氭嫙鏂囨湰 AI 閰嶇疆銆? * 璇ラ厤缃笉瀛樺偍鍦ㄧ敤鎴锋湰鍦帮紝濮嬬粓鍦ㄨ繍琛屾椂娉ㄥ叆锛岀敤鎴锋棤娉曠紪杈戞垨鍒犻櫎銆? */
export const HOSTED_PROXY_PROFILE_ID = '__hosted_proxy__';
export const HOSTED_IMAGE_PROXY_PROFILE_ID = '__hosted_image_proxy__';
export const HOSTED_VOICE_PROXY_PROFILE_ID = '__hosted_voice_proxy__';

/**
 * 缃戦〉鎵樼浠ｇ悊铏氭嫙閰嶇疆瀵硅薄銆? * 浠呭湪闈?Tauri锛堝嵆缃戦〉閮ㄧ讲锛夌幆澧冧笅浣跨敤锛岀洿鎺ユ寚鍚戞湇鍔＄ PHP 浠ｇ悊銆? */
export const HOSTED_PROXY_PROFILE: TextAIProfile = {
  id: HOSTED_PROXY_PROFILE_ID,
  name: '\u7f51\u7edc\u6258\u7ba1\u4ee3\u7406',
  kind: 'text',
  provider: 'hosted',
  apiKey: '',
  apiUrl: '',
  model: 'deepseek',
  thinkingMode: false,
};

export const HOSTED_IMAGE_PROXY_PROFILE: ImageAIProfile = {
  id: HOSTED_IMAGE_PROXY_PROFILE_ID,
  name: '\u7f51\u7edc\u6258\u7ba1\u4ee3\u7406',
  kind: 'image',
  provider: 'hosted-image',
  apiKey: '',
  apiUrl: '',
  model: DEFAULT_IMAGE_MODEL,
  size: DEFAULT_IMAGE_SIZE,
  negativePrompt: '',
  removeBackground: false,
  subjectSegmentationApiUrl: '',
  subjectSegmentationApiKey: '',
};

export const HOSTED_VOICE_PROXY_PROFILE: VoiceAIProfile = {
  id: HOSTED_VOICE_PROXY_PROFILE_ID,
  name: '\u7f51\u7edc\u6258\u7ba1\u4ee3\u7406',
  kind: 'voice',
  provider: 'hosted-voice',
  apiKey: '',
  apiUrl: '',
  model: 'gpt-4o-mini-tts',
  voice: 'alloy',
  appKey: '',
};

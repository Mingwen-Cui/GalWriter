import {
  ArrowLeft,
  BrainCircuit,
  Check,
  Feather,
  ImageIcon,
  Lightbulb,
  Lock,
  MessageCircle,
  PanelTopDashed,
  PenLine,
  Pencil,
  Plus,
  RefreshCw,
  Volume2,
} from 'lucide-react';
import React from 'react';
import { createPortal } from 'react-dom';

import type {
  ImageAIProfile,
  SavedAIProfile,
  TextAIProfile,
  VoiceAIProfile,
} from '../domain/project';
import {
  DEFAULT_IMAGE_API_URL,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_IMAGE_SIZE,
  DEFAULT_STABLE_DIFFUSION_API_URL,
  DEFAULT_STABLE_DIFFUSION_CFG_SCALE,
  DEFAULT_STABLE_DIFFUSION_MODEL,
  DEFAULT_STABLE_DIFFUSION_SAMPLER,
  DEFAULT_STABLE_DIFFUSION_STEPS,
  LOCAL_STABLE_DIFFUSION_PROVIDER,
} from '../editor-features/media/imageGeneration';
import { ConfirmActionModal } from '../editor-shell/ConfirmActionModal';
import {
  type AIButtonsConfig,
  type AIGenerationBalance,
  type AIPromptsConfig,
  defaultAIButtonsConfig,
  defaultAIPrompts,
} from '../editor-state/editorConfig';
import { Language, translations } from '../lib/i18n';
import {
  HOSTED_IMAGE_PROXY_PROFILE,
  HOSTED_IMAGE_PROXY_PROFILE_ID,
  HOSTED_PROXY_PROFILE,
  HOSTED_PROXY_PROFILE_ID,
  HOSTED_VOICE_PROXY_PROFILE,
  HOSTED_VOICE_PROXY_PROFILE_ID,
} from '../lib/hostedProxy';
import { isTauriRuntime } from '../lib/tauriRuntime';

type ProfileKind = 'text' | 'image' | 'voice';
type ProfileDraft = TextAIProfile | ImageAIProfile | VoiceAIProfile;
type ProfileUpdates = Partial<TextAIProfile> | Partial<ImageAIProfile> | Partial<VoiceAIProfile>;
type ProfileSeed = Partial<TextAIProfile> | Partial<ImageAIProfile> | Partial<VoiceAIProfile>;
type ProviderOption = {
  value: string;
  label: string;
  apiUrl?: string;
  model?: string;
  voice?: string;
  size?: string;
};
type ModelOption = {
  value: string;
  label: string;
};
type EditorState = {
  mode: 'create' | 'edit';
  kind: ProfileKind;
  profileId: string | null;
  draft: ProfileDraft;
};
type DeleteState =
  | {
      mode: 'draft';
      name: string;
    }
  | {
      mode: 'saved';
      kind: ProfileKind;
      profileId: string;
      name: string;
    };

function FloatingHint({
  label,
  description,
  className = '',
}: {
  label: React.ReactNode;
  description: string;
  className?: string;
}) {
  const anchorRef = React.useRef<HTMLSpanElement | null>(null);
  const [position, setPosition] = React.useState<{
    left: number;
    top: number;
    placement: 'above' | 'below';
  } | null>(null);

  const showHint = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 256;
    const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.left));
    const shouldPlaceAbove = rect.bottom + 112 > window.innerHeight && rect.top > 112;
    setPosition({
      left,
      top: shouldPlaceAbove ? rect.top - 8 : rect.bottom + 8,
      placement: shouldPlaceAbove ? 'above' : 'below',
    });
  };

  return (
    <span
      ref={anchorRef}
      className={`relative inline-flex min-w-0 cursor-help ${className}`}
      aria-label={description}
      onMouseEnter={showHint}
      onMouseLeave={() => setPosition(null)}
      onFocus={showHint}
      onBlur={() => setPosition(null)}
      tabIndex={0}
    >
      {label}
      {position
        ? createPortal(
            <span
              className="pointer-events-none fixed z-[2000] w-64 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3 text-xs font-medium leading-relaxed text-[var(--text-secondary)] shadow-xl"
              style={{
                left: position.left,
                top: position.top,
                transform: position.placement === 'above' ? 'translateY(-100%)' : undefined,
              }}
            >
              {description}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

const DEFAULT_TTS_API_URL = 'https://openapi.youdao.com/ttsapi';
const DEFAULT_TTS_MODEL = '';
const DEFAULT_TTS_VOICE = 'youxiaoqin';
const CUSTOM_MODEL_VALUE = '__custom_model__';
const YOUDAO_TTS_HELP = {
  zh: '照着有道后台“查看应用”页面抄就可以：应用ID填到应用ID，应用密钥填到应用密钥。这里不需要去 API Keys 页面找别的 Key。',
  ja: 'Youdao TTS uses the application ID and application secret from the console.',
  en: 'Youdao TTS uses the application ID and application secret from the console.',
};

const TEXT_PROVIDER_OPTIONS: ProviderOption[] = [
  {
    value: 'deepseek',
    label: 'DeepSeek',
    apiUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
  },
  {
    value: 'gemini',
    label: 'Gemini',
    apiUrl: 'https://generativelanguage.googleapis.com',
    model: 'gemini-2.5-flash',
  },
  {
    value: 'openai',
    label: 'OpenAI',
    apiUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1',
  },
  {
    value: 'claude',
    label: 'Claude',
    apiUrl: 'https://api.anthropic.com/v1/messages',
    model: 'claude-sonnet-4-20250514',
  },
  {
    value: 'kimi',
    label: 'Kimi',
    apiUrl: 'https://api.moonshot.cn/v1',
    model: 'kimi-k2.5',
  },
  {
    value: 'qwen',
    label: '千问',
    apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen3.6-plus',
  },
  {
    value: 'copilot',
    label: 'Copilot',
    apiUrl: '',
    model: 'gpt-4o',
  },
  {
    value: 'glm',
    label: 'GLM',
    apiUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-5',
  },
  {
    value: 'ollama',
    label: 'Ollama',
    apiUrl: 'http://localhost:11434/api',
    model: 'gemma4',
  },
  {
    value: 'custom',
    label: '自定义',
    apiUrl: '',
    model: '',
  },
];

const IMAGE_PROVIDER_OPTIONS: ProviderOption[] = [
  {
    value: 'doubao',
    label: '豆包',
    apiUrl: DEFAULT_IMAGE_API_URL,
    model: DEFAULT_IMAGE_MODEL,
    size: DEFAULT_IMAGE_SIZE,
  },
  {
    value: 'hosted-image',
    label: '网络托管代理',
    apiUrl: '',
    model: DEFAULT_IMAGE_MODEL,
    size: DEFAULT_IMAGE_SIZE,
  },
  {
    value: 'gemini',
    label: 'Gemini',
    apiUrl: '',
    model: 'gemini-2.5-flash-image-preview',
    size: '1024x1024',
  },
  {
    value: 'openai',
    label: 'OpenAI',
    apiUrl: 'https://api.openai.com/v1/images/generations',
    model: 'gpt-image-1',
    size: '1024x1024',
  },
  {
    value: 'qwen',
    label: '千问',
    apiUrl: '',
    model: 'wanx2.1-t2i-plus',
    size: '1024x1024',
  },
  {
    value: 'glm',
    label: 'GLM',
    apiUrl: '',
    model: 'cogview-4',
    size: '1024x1024',
  },
  {
    value: LOCAL_STABLE_DIFFUSION_PROVIDER,
    label: '本地 Stable Diffusion WebUI',
    apiUrl: DEFAULT_STABLE_DIFFUSION_API_URL,
    model: DEFAULT_STABLE_DIFFUSION_MODEL,
    size: '1024x1024',
  },
  {
    value: 'custom',
    label: '自定义',
    apiUrl: '',
    model: '',
    size: '1024x1024',
  },
];

const VOICE_PROVIDER_OPTIONS: ProviderOption[] = [
  {
    value: 'system',
    label: '系统语音',
    apiUrl: '',
    model: '',
    voice: '',
  },
  {
    value: 'youdao',
    label: '有道',
    apiUrl: DEFAULT_TTS_API_URL,
    model: '',
    voice: DEFAULT_TTS_VOICE,
  },
  {
    value: 'openai',
    label: 'OpenAI',
    apiUrl: 'https://api.openai.com/v1/audio/speech',
    model: 'gpt-4o-mini-tts',
    voice: 'alloy',
  },
  {
    value: 'hosted-voice',
    label: '\u7f51\u7edc\u6258\u7ba1\u4ee3\u7406',
    apiUrl: '',
    model: 'gpt-4o-mini-tts',
    voice: 'alloy',
  },
  {
    value: 'doubao',
    label: '豆包',
    apiUrl: '',
    model: 'speech-02-hd',
    voice: 'zh_female_tianmei',
  },
  {
    value: 'gemini',
    label: 'Gemini',
    apiUrl: '',
    model: 'gemini-2.5-flash-preview-tts',
    voice: 'Kore',
  },
  {
    value: 'custom',
    label: '自定义',
    apiUrl: '',
    model: 'gpt-4o-mini-tts',
    voice: 'alloy',
  },
];

const TEXT_MODEL_OPTIONS: Record<string, ModelOption[]> = {
  deepseek: [
    { value: 'deepseek-chat', label: 'deepseek-chat' },
    { value: 'deepseek-reasoner', label: 'deepseek-reasoner' },
    { value: 'deepseek-v3.1', label: 'deepseek-v3.1' },
  ],
  gemini: [
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  ],
  openai: [
    { value: 'gpt-4.1', label: 'GPT-4.1' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { value: 'gpt-4.1-nano', label: 'GPT-4.1 Nano' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'o3', label: 'o3' },
    { value: 'o4-mini', label: 'o4-mini' },
  ],
  claude: [
    { value: 'claude-opus-4-1-20250805', label: 'Claude Opus 4.1' },
    { value: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { value: 'claude-3-7-sonnet-latest', label: 'Claude 3.7 Sonnet' },
    { value: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku' },
  ],
  kimi: [
    { value: 'kimi-k2.5', label: 'Kimi K2.5' },
    { value: 'kimi-k2-thinking', label: 'Kimi K2 Thinking' },
    { value: 'kimi-k2-thinking-turbo', label: 'Kimi K2 Thinking Turbo' },
    { value: 'moonshot-v1-8k', label: 'Moonshot V1 8K' },
    { value: 'moonshot-v1-32k', label: 'Moonshot V1 32K' },
    { value: 'moonshot-v1-128k', label: 'Moonshot V1 128K' },
  ],
  qwen: [
    { value: 'qwen3.7-max', label: 'Qwen 3.7 Max' },
    { value: 'qwen3.6-plus', label: 'Qwen 3.6 Plus' },
    { value: 'qwen3.6-flash', label: 'Qwen 3.6 Flash' },
    { value: 'qwen-plus', label: 'qwen-plus' },
    { value: 'qwen-plus-latest', label: 'qwen-plus-latest' },
    { value: 'qwen-turbo', label: 'qwen-turbo' },
    { value: 'qwen-turbo-latest', label: 'qwen-turbo-latest' },
    { value: 'qwen-max-latest', label: 'qwen-max-latest' },
    { value: 'qwen3-coder-plus', label: 'Qwen 3 Coder Plus' },
  ],
  copilot: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'o4-mini', label: 'o4-mini' },
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  ],
  glm: [
    { value: 'glm-5.1', label: 'GLM 5.1' },
    { value: 'glm-5', label: 'GLM 5' },
    { value: 'glm-4.7', label: 'GLM 4.7' },
    { value: 'glm-4-plus', label: 'GLM 4 Plus' },
    { value: 'glm-4-air', label: 'GLM 4 Air' },
    { value: 'glm-4-flash', label: 'GLM 4 Flash' },
  ],
  ollama: [
    { value: 'gemma4', label: 'gemma4' },
    { value: 'llama3', label: 'llama3' },
    { value: 'qwen2.5', label: 'qwen2.5' },
    { value: 'mistral', label: 'mistral' },
  ],
  // NOTE: hosted 模式固定使用 DeepSeek，由服务端持有密钥
  hosted: [{ value: 'deepseek', label: 'DeepSeek' }],
};

const IMAGE_MODEL_OPTIONS: Record<string, ModelOption[]> = {
  doubao: [
    { value: DEFAULT_IMAGE_MODEL, label: 'Doubao Seedream 4.5' },
    { value: 'doubao-seedream-3.0-t2i', label: 'Doubao Seedream 3.0 T2I' },
  ],
  gemini: [
    { value: 'gemini-2.5-flash-image-preview', label: 'Gemini 2.5 Flash Image Preview' },
    { value: 'imagen-4.0-generate-001', label: 'Imagen 4' },
  ],
  openai: [
    { value: 'gpt-image-1', label: 'GPT Image 1' },
    { value: 'gpt-image-1-mini', label: 'GPT Image 1 Mini' },
    { value: 'chatgpt-image-latest', label: 'ChatGPT Image Latest' },
  ],
  qwen: [
    { value: 'wanx2.1-t2i-plus', label: 'Wanx 2.1 T2I Plus' },
    { value: 'wanx2.1-t2i-turbo', label: 'Wanx 2.1 T2I Turbo' },
    { value: 'qwen-image', label: 'Qwen Image' },
  ],
  glm: [
    { value: 'cogview-4', label: 'CogView 4' },
    { value: 'cogview-3-flash', label: 'CogView 3 Flash' },
  ],
  [LOCAL_STABLE_DIFFUSION_PROVIDER]: [
    { value: DEFAULT_STABLE_DIFFUSION_MODEL, label: '当前 WebUI 模型' },
  ],
};

const VOICE_MODEL_OPTIONS: Record<string, ModelOption[]> = {
  system: [{ value: '', label: '系统默认' }],
  youdao: [
    { value: '', label: '有道官方默认' },
    { value: 'youdao-tts', label: 'Youdao TTS' },
  ],
  openai: [
    { value: 'gpt-4o-mini-tts', label: 'GPT-4o Mini TTS' },
    { value: 'tts-1', label: 'TTS-1' },
    { value: 'tts-1-hd', label: 'TTS-1 HD' },
  ],
  'hosted-voice': [{ value: 'gpt-4o-mini-tts', label: 'GPT-4o Mini TTS' }],
  doubao: [
    { value: 'speech-02-hd', label: 'Speech 02 HD' },
    { value: 'doubao-tts', label: 'Doubao TTS' },
  ],
  gemini: [{ value: 'gemini-2.5-flash-preview-tts', label: 'Gemini 2.5 Flash TTS Preview' }],
};

const IMAGE_SIZE_PRESETS = [
  { value: '2K', zh: '官方 2K', ja: '公式 2K', en: 'Official 2K' },
  { value: '2048x2048', zh: '1:1 即梦 2K', ja: '1:1 即夢 2K', en: '1:1 Seedream 2K' },
  { value: '2560x1440', zh: '16:9 即梦横屏', ja: '16:9 即夢横向き', en: '16:9 Seedream landscape' },
  { value: '1440x2560', zh: '9:16 即梦竖屏', ja: '9:16 即夢縦向き', en: '9:16 Seedream portrait' },
  { value: '1024x1024', zh: '1:1 标准方图', ja: '1:1 標準スクエア', en: '1:1 Standard square' },
  { value: '1024x1536', zh: '2:3 竖图', ja: '2:3 縦画像', en: '2:3 Portrait' },
  { value: '1536x1024', zh: '3:2 横图', ja: '3:2 横画像', en: '3:2 Landscape' },
  { value: '1792x1024', zh: '16:9 DALL-E', ja: '16:9 DALL-E', en: '16:9 DALL-E' },
  {
    value: '512x512',
    zh: 'SD 1:1 快速预览',
    ja: 'SD 1:1 クイックプレビュー',
    en: 'SD 1:1 quick preview',
  },
  { value: '768x512', zh: 'SD 3:2 横图', ja: 'SD 3:2 横画像', en: 'SD 3:2 landscape' },
  { value: '512x768', zh: 'SD 2:3 竖图', ja: 'SD 2:3 縦画像', en: 'SD 2:3 portrait' },
  { value: '768x768', zh: 'SD 1:1 高清', ja: 'SD 1:1 高精細', en: 'SD 1:1 high detail' },
];

const parseImageApiTemplate = (text: string) => {
  const source = text.trim();
  if (!source) return null;

  const baseUrl = source.match(
    /(?:base_url|baseURL|baseUrl|api_url|apiUrl|endpoint)\s*[:=]\s*["']([^"']+)["']/i,
  )?.[1];
  const curlUrl = source.match(
    /curl(?:\s+-X\s+POST|\s+--location)?\s+["']?([^\s"'\\]+)["']?/i,
  )?.[1];
  const endpointUrl = source.match(/https?:\/\/[^\s"'\\]+\/images\/generations/i)?.[0];
  const plainUrl = source.match(/^https?:\/\/\S+$/i)?.[0];
  const apiKey =
    source.match(/Authorization:\s*Bearer\s+([^"'\s\\]+)/i)?.[1] ||
    source.match(
      /(?:api[_-]?key|apiKey|ARK_API_KEY|OPENAI_API_KEY)\s*[:=]\s*["']([^"']+)["']/i,
    )?.[1] ||
    source.match(/["']Bearer\s+([^"']+)["']/i)?.[1] ||
    source.match(/^(?:sk|ark)-[A-Za-z0-9_\-.]+$/)?.[0];
  const model =
    source.match(/["']model["']\s*:\s*["']([^"']+)["']/i)?.[1] ||
    source.match(/model\s*=\s*["']([^"']+)["']/i)?.[1];
  const size =
    source.match(/["']size["']\s*:\s*["']([^"']+)["']/i)?.[1] ||
    source.match(/size\s*=\s*["']([^"']+)["']/i)?.[1];

  const parsed = {
    apiUrl: baseUrl || endpointUrl || curlUrl || plainUrl,
    apiKey,
    model,
    size,
  };

  return Object.values(parsed).some(Boolean) ? parsed : null;
};

const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
};

const buildFallbackProfileName = (kind: ProfileKind, language: Language) => {
  const prefix =
    language === 'zh'
      ? kind === 'text'
        ? '文本配置'
        : kind === 'image'
          ? '图片配置'
          : '语音配置'
      : language === 'ja'
        ? kind === 'text'
          ? 'テキスト設定'
          : kind === 'image'
            ? '画像設定'
            : '音声設定'
        : kind === 'text'
          ? 'Text Profile'
          : kind === 'image'
            ? 'Image Profile'
            : 'Voice Profile';
  return `${prefix}_${formatTimestamp(Date.now())}`;
};

const isLikelyUrlProfileName = (name: string) => /^https?:\/\//i.test(name.trim());

const buildDefaultTextDraft = (): TextAIProfile => {
  return {
    id: 'draft-text',
    name: '',
    kind: 'text',
    provider: 'deepseek',
    apiKey: '',
    apiUrl: '',
    model: 'deepseek-chat',
    thinkingMode: false,
  };
};

const buildDefaultImageDraft = (): ImageAIProfile => ({
  id: 'draft-image',
  name: '',
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
  removeBackground: false,
  subjectSegmentationApiUrl: '',
  subjectSegmentationApiKey: '',
});

const buildDefaultVoiceDraft = (): VoiceAIProfile => ({
  id: 'draft-voice',
  name: '',
  kind: 'voice',
  provider: 'system',
  apiKey: '',
  apiUrl: '',
  model: '',
  voice: '',
  appKey: '',
});

const getProviderOptions = (kind: ProfileKind) => {
  if (kind === 'text') return TEXT_PROVIDER_OPTIONS;
  if (kind === 'image') return IMAGE_PROVIDER_OPTIONS;
  return VOICE_PROVIDER_OPTIONS;
};

const getModelOptions = (kind: ProfileKind, provider: string): ModelOption[] => {
  const map =
    kind === 'text'
      ? TEXT_MODEL_OPTIONS
      : kind === 'image'
        ? IMAGE_MODEL_OPTIONS
        : VOICE_MODEL_OPTIONS;
  const ownOptions = map[provider] || [];
  const allOptions = Object.values(map).flat();
  const deduped = [...ownOptions, ...allOptions].filter(
    (option, index, array) => array.findIndex((item) => item.value === option.value) === index,
  );
  return deduped;
};

const getModelSelectValue = (kind: ProfileKind, profile: ProfileDraft) => {
  const options = getModelOptions(kind, profile.provider);
  return options.some((option) => option.value === profile.model.trim())
    ? profile.model.trim()
    : CUSTOM_MODEL_VALUE;
};

const applyProviderDefaults = (draft: ProfileDraft, provider: string): ProfileDraft => {
  const options = getProviderOptions(draft.kind);
  const option = options.find((item) => item.value === provider);

  if (draft.kind === 'text') {
    return {
      ...draft,
      provider,
      apiUrl: option?.apiUrl ?? draft.apiUrl,
      model: option?.model ?? draft.model,
    };
  }

  if (draft.kind === 'image') {
    const sdDefaults =
      provider === LOCAL_STABLE_DIFFUSION_PROVIDER
        ? {
            negativePrompt: draft.negativePrompt ?? '',
            steps: draft.steps ?? DEFAULT_STABLE_DIFFUSION_STEPS,
            cfgScale: draft.cfgScale ?? DEFAULT_STABLE_DIFFUSION_CFG_SCALE,
            sampler: draft.sampler ?? DEFAULT_STABLE_DIFFUSION_SAMPLER,
            seed: draft.seed ?? -1,
            restoreFaces: draft.restoreFaces ?? false,
            enableHr: draft.enableHr ?? false,
            hrScale: draft.hrScale ?? 2,
            denoisingStrength: draft.denoisingStrength ?? 0.7,
          }
        : {};
    return {
      ...draft,
      provider,
      apiUrl: option?.apiUrl ?? draft.apiUrl,
      model: option?.model ?? draft.model,
      size: option?.size ?? draft.size,
      ...sdDefaults,
    };
  }

  return {
    ...draft,
    provider,
    apiUrl: option?.apiUrl ?? draft.apiUrl,
    model: option?.model ?? draft.model,
    voice: option?.voice ?? draft.voice,
  };
};

const getProfileKindMeta = (kind: ProfileKind, language: Language) => {
  if (kind === 'text') {
    return {
      title: language === 'zh' ? '文本 AI' : 'Text AI',
      subtitle: language === 'zh' ? '续写、润色、助手对话' : 'Writing, polishing, assistant chat',
      icon: BrainCircuit,
      accent:
        'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/30 dark:text-indigo-300',
      badge: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300',
    };
  }
  if (kind === 'image') {
    return {
      title: language === 'zh' ? '图片 AI' : 'Image AI',
      subtitle:
        language === 'zh' ? '角色、场景、背景生成' : 'Character, scene, background generation',
      icon: ImageIcon,
      accent:
        'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/30 dark:text-emerald-300',
      badge: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
    };
  }
  return {
    title: language === 'zh' ? '语音 AI' : 'Voice AI',
    subtitle: language === 'zh' ? '朗读、配音、语音合成' : 'Reading, dubbing, speech generation',
    icon: Volume2,
    accent:
      'bg-sky-50 text-sky-600 border-sky-200 dark:bg-sky-500/10 dark:border-sky-500/30 dark:text-sky-300',
    badge: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
  };
};

interface AISettingsPanelProps {
  language: Language;
  savedAIProfiles: SavedAIProfile[];
  activeTextProfileId: string | null;
  activeImageProfileId: string | null;
  activeVoiceProfileId: string | null;
  missingTextApiKey: boolean;
  settingsAttentionTarget?: ProfileKind | null;
  onAcknowledgeSettingsAttention?: () => void;
  onCreateAIProfile: (
    kind: ProfileKind,
    initialProfile?: ProfileSeed,
  ) => void | string | Promise<void | string>;
  onUpdateAIProfile: (profileId: string, updates: ProfileUpdates) => void | Promise<void>;
  onSelectAIProfile: (kind: ProfileKind, profileId: string) => void | Promise<void>;
  onDeleteAIProfile: (profileId: string) => void | Promise<void>;
  customAiPromptsEnabled: boolean;
  setCustomAiPromptsEnabled: (enabled: boolean) => void;
  aiPrompts: AIPromptsConfig;
  setAiPrompts: (prompts: AIPromptsConfig) => void;
  aiButtonsConfig: AIButtonsConfig;
  setAiButtonsConfig: (config: AIButtonsConfig) => void;
  aiGenerationBalance: AIGenerationBalance;
  setAiGenerationBalance: (balance: AIGenerationBalance) => void;
  assistantOptionsSlot?: React.ReactNode;
}

export function AISettingsPanel({
  language,
  savedAIProfiles,
  activeTextProfileId,
  activeImageProfileId,
  activeVoiceProfileId,
  missingTextApiKey,
  settingsAttentionTarget,
  onAcknowledgeSettingsAttention,
  onCreateAIProfile,
  onUpdateAIProfile,
  onSelectAIProfile,
  onDeleteAIProfile,
  customAiPromptsEnabled,
  setCustomAiPromptsEnabled,
  aiPrompts,
  setAiPrompts,
  aiButtonsConfig,
  setAiButtonsConfig,
  aiGenerationBalance,
  setAiGenerationBalance,
  assistantOptionsSlot,
}: AISettingsPanelProps) {
  const t = translations[language];
  const [editorState, setEditorState] = React.useState<EditorState | null>(null);
  const [deleteState, setDeleteState] = React.useState<DeleteState | null>(null);
  const [imageTemplateImportStatus, setImageTemplateImportStatus] = React.useState<
    'idle' | 'success' | 'empty' | 'blocked'
  >('idle');
  const [localOllamaModels, setLocalOllamaModels] = React.useState<ModelOption[]>([]);

  React.useEffect(() => {
    if (editorState?.kind === 'text' && editorState.draft.provider === 'ollama') {
      const fetchOllamaModels = async () => {
        try {
          const url = editorState.draft.apiUrl || 'http://localhost:11434/api';
          const cleanUrl = url.replace(/\/$/, '');
          const response = await fetch(`${cleanUrl}/tags`);
          if (response.ok) {
            const data = await response.json();
            if (data && Array.isArray(data.models)) {
              const options = data.models.map((m: any) => ({
                value: m.name,
                label: m.name,
              }));
              setLocalOllamaModels(options);
            }
          }
        } catch (err) {
          console.warn('获取 Ollama 本地模型列表失败:', err);
        }
      };
      void fetchOllamaModels();
    } else {
      setLocalOllamaModels([]);
    }
  }, [editorState?.kind, editorState?.draft.provider, editorState?.draft.apiUrl]);

  const toggleCustomAiPrompts = React.useCallback(() => {
    if (customAiPromptsEnabled) {
      setAiPrompts(defaultAIPrompts);
    }
    setCustomAiPromptsEnabled(!customAiPromptsEnabled);
  }, [customAiPromptsEnabled, setAiPrompts, setCustomAiPromptsEnabled]);

  const textProfiles = savedAIProfiles.filter(
    (profile): profile is TextAIProfile => profile.kind === 'text',
  );
  const imageProfiles = savedAIProfiles.filter(
    (profile): profile is ImageAIProfile => profile.kind === 'image',
  );
  const voiceProfiles = savedAIProfiles.filter(
    (profile): profile is VoiceAIProfile => profile.kind === 'voice',
  );

  const activeTextProfile =
    textProfiles.find((profile) => profile.id === activeTextProfileId) ?? null;
  const activeImageProfile =
    imageProfiles.find((profile) => profile.id === activeImageProfileId) ?? null;
  const activeVoiceProfile =
    voiceProfiles.find((profile) => profile.id === activeVoiceProfileId) ?? null;

  const sections = [
    {
      kind: 'text' as const,
      profiles: textProfiles,
      activeId: activeTextProfileId,
      activeProfile: activeTextProfile,
    },
    {
      kind: 'image' as const,
      profiles: imageProfiles,
      activeId: activeImageProfileId,
      activeProfile: activeImageProfile,
    },
    {
      kind: 'voice' as const,
      profiles: voiceProfiles,
      activeId: activeVoiceProfileId,
      activeProfile: activeVoiceProfile,
    },
  ];
  const optionButtonClass = (active: boolean) =>
    `group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 transition-all ${
      active
        ? 'bg-[var(--card-bg)] text-[var(--accent)] shadow-sm ring-1 ring-[var(--card-border)]'
        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
    }`;
  const optionIconClass = (active: boolean) =>
    `flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
      active
        ? 'border-[var(--accent)]/30 bg-[var(--accent)]/10 text-[var(--accent)]'
        : 'border-[var(--card-border)] text-[var(--text-muted)] group-hover:text-[var(--text-secondary)]'
    }`;
  const renderInfoHint = (label: React.ReactNode, description: string, className = '') => (
    <FloatingHint label={label} description={description} className={className} />
  );

  const updateDraft = React.useCallback((updates: Partial<ProfileDraft>) => {
    setEditorState((current) => {
      if (!current) return current;
      return {
        ...current,
        draft: {
          ...current.draft,
          ...updates,
        } as ProfileDraft,
      };
    });
  }, []);

  const openCreate = (kind: ProfileKind) => {
    const draft =
      kind === 'text'
        ? buildDefaultTextDraft()
        : kind === 'image'
          ? buildDefaultImageDraft()
          : buildDefaultVoiceDraft();
    draft.name = buildFallbackProfileName(kind, language);
    setImageTemplateImportStatus('idle');
    setEditorState({
      mode: 'create',
      kind,
      profileId: null,
      draft,
    });
  };

  const openEdit = (profile: SavedAIProfile) => {
    // NOTE: 虚拟托管代理配置不允许编辑，直接拦截
    if (
      profile.id === HOSTED_PROXY_PROFILE_ID ||
      profile.id === HOSTED_IMAGE_PROXY_PROFILE_ID ||
      profile.id === HOSTED_VOICE_PROXY_PROFILE_ID
    )
      return;
    setImageTemplateImportStatus('idle');
    setEditorState({
      mode: 'edit',
      kind: profile.kind,
      profileId: profile.id,
      draft: { ...profile },
    });
  };

  const applyImageTemplateToDraft = React.useCallback((template: string) => {
    const parsed = parseImageApiTemplate(template);
    if (!parsed) return false;

    setEditorState((current) => {
      if (!current || current.kind !== 'image') return current;
      return {
        ...current,
        draft: {
          ...current.draft,
          apiUrl: parsed.apiUrl || current.draft.apiUrl,
          apiKey: parsed.apiKey || current.draft.apiKey,
          model: parsed.model || current.draft.model,
          size: parsed.size || (current.draft as ImageAIProfile).size,
        },
      };
    });
    return true;
  }, []);

  const importImageTemplateFromClipboard = async () => {
    if (!navigator.clipboard?.readText) {
      setImageTemplateImportStatus('blocked');
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      const imported = applyImageTemplateToDraft(text);
      setImageTemplateImportStatus(imported ? 'success' : 'empty');
    } catch {
      setImageTemplateImportStatus('blocked');
    }
  };

  const handleSaveProfile = async () => {
    if (!editorState) return;

    const trimmedName = editorState.draft.name.trim();
    const finalName =
      trimmedName && !isLikelyUrlProfileName(trimmedName)
        ? trimmedName
        : buildFallbackProfileName(editorState.kind, language);
    const payload = {
      ...editorState.draft,
      name: finalName,
    } as ProfileSeed;

    if (payload.kind === 'voice' && payload.provider === 'youdao') {
      payload.model = '';
      payload.apiUrl = payload.apiUrl?.trim() || DEFAULT_TTS_API_URL;
    }

    if (payload.kind === 'voice' && payload.provider === 'hosted-voice') {
      payload.apiKey = '';
      payload.apiUrl = '';
      payload.appKey = '';
    }

    if (editorState.mode === 'create') {
      const createdId = await onCreateAIProfile(editorState.kind, payload);
      if (typeof createdId === 'string') {
        await onSelectAIProfile(editorState.kind, createdId);
      }
    } else if (editorState.profileId) {
      await onUpdateAIProfile(editorState.profileId, payload);
      await onSelectAIProfile(editorState.kind, editorState.profileId);
    }

    setEditorState(null);
    setImageTemplateImportStatus('idle');
  };

  const handleConfirmDelete = async () => {
    if (!deleteState) return;

    if (deleteState.mode === 'draft') {
      setDeleteState(null);
      setEditorState(null);
      setImageTemplateImportStatus('idle');
      return;
    }

    await onDeleteAIProfile(deleteState.profileId);
    setDeleteState(null);
    setEditorState((current) => (current?.profileId === deleteState.profileId ? null : current));
    setImageTemplateImportStatus('idle');
  };

  const renderFieldLabel = (label: string) => (
    <label className="text-xs font-black text-slate-900 dark:text-slate-100">{label}</label>
  );

  const renderProfileForm = () => {
    if (!editorState) return null;

    const draft = editorState.draft;
    const providerOptions = getProviderOptions(editorState.kind).filter(
      (option) =>
        !(editorState.kind === 'image' && option.value === 'hosted-image' && isTauriRuntime()) &&
        !(editorState.kind === 'voice' && option.value === 'hosted-voice' && isTauriRuntime()),
    );
    const rawModelOptions = getModelOptions(editorState.kind, draft.provider);
    const modelOptions =
      draft.kind === 'text' && draft.provider === 'ollama' && localOllamaModels.length > 0
        ? localOllamaModels
        : rawModelOptions;
    const currentModelSelectValue = getModelSelectValue(editorState.kind, draft);
    const meta = getProfileKindMeta(editorState.kind, language);
    const isLocalStableDiffusion =
      draft.kind === 'image' && draft.provider === LOCAL_STABLE_DIFFUSION_PROVIDER;
    const isOllama = draft.kind === 'text' && draft.provider === 'ollama';
    // NOTE: hosted 模式下无需用户填写 API Key，由服务端代理持有
    const isHosted = draft.kind === 'text' && draft.provider === 'hosted';
    const isHostedVoice = draft.kind === 'voice' && draft.provider === 'hosted-voice';
    const showModelSelect =
      draft.kind !== 'voice' || (draft.provider !== 'system' && draft.provider !== 'youdao');

    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => {
                setEditorState(null);
                setImageTemplateImportStatus('idle');
              }}
              className="group mb-4 inline-flex w-14 items-center gap-1.5 overflow-hidden whitespace-nowrap text-xs font-black text-transparent transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition-colors group-hover:text-[var(--accent)]" />
              <span className="shrink-0 text-[var(--text-muted)] transition-colors group-hover:text-[var(--accent)]">
                {language === 'zh' ? '返回' : 'Back'}
              </span>
              {language === 'zh' ? '返回已保存配置' : 'Back to saved profiles'}
            </button>
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br ${meta.accent}`}
              >
                <meta.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xl font-black text-[var(--text-primary)]">
                  {editorState.mode === 'create'
                    ? language === 'zh'
                      ? `新建${meta.title}配置`
                      : `Create ${meta.title} profile`
                    : language === 'zh'
                      ? `编辑${meta.title}配置`
                      : `Edit ${meta.title} profile`}
                </h3>
                <p className="mt-1 text-sm font-medium text-[var(--text-muted)]">
                  {language === 'zh'
                    ? '保存后才会真正写入本地，不会自动覆盖已有配置。'
                    : 'Nothing is written until you press save.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--card-border)] bg-[var(--card-bg)]/90 p-6 shadow-sm">
          <div className="space-y-5">
            <div className="space-y-2">
              {renderFieldLabel(language === 'zh' ? '配置名称' : 'Profile Name')}
              <input
                type="text"
                name={`ai-${draft.kind}-profile-name`}
                autoComplete="off"
                spellCheck={false}
                value={draft.name}
                onChange={(e) => updateDraft({ name: e.target.value })}
                placeholder={
                  language === 'zh'
                    ? '例如：我的主力文本模型'
                    : 'For example: My main writing model'
                }
                className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className={showModelSelect ? 'space-y-2' : 'space-y-2 md:col-span-2'}>
                {renderFieldLabel(language === 'zh' ? '服务商' : 'Provider')}
                <select
                  value={draft.provider}
                  onChange={(e) => {
                    setImageTemplateImportStatus('idle');
                    setEditorState((current) => {
                      if (!current) return current;
                      return {
                        ...current,
                        draft: applyProviderDefaults(current.draft, e.target.value),
                      };
                    });
                  }}
                  className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                >
                  {providerOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {showModelSelect && (
                <div className="space-y-2">
                  {renderFieldLabel(
                    isHosted
                      ? language === 'zh'
                        ? '后端 AI 提供商'
                        : 'Backend AI Provider'
                      : language === 'zh'
                        ? '模型'
                        : 'Model',
                  )}
                  <select
                    value={currentModelSelectValue}
                    onChange={(e) => {
                      if (e.target.value === CUSTOM_MODEL_VALUE) {
                        if (modelOptions.some((option) => option.value === draft.model)) {
                          updateDraft({ model: '' });
                        }
                        return;
                      }
                      updateDraft({ model: e.target.value });
                    }}
                    className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                  >
                    {modelOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                    {!isHosted && (
                      <option value={CUSTOM_MODEL_VALUE}>
                        {language === 'zh' ? '自定义模型' : 'Custom model'}
                      </option>
                    )}
                  </select>
                  {currentModelSelectValue === CUSTOM_MODEL_VALUE && (
                    <input
                      type="text"
                      name={`ai-${draft.kind}-custom-model`}
                      autoComplete="off"
                      spellCheck={false}
                      value={draft.model}
                      onChange={(e) => updateDraft({ model: e.target.value })}
                      placeholder={language === 'zh' ? '输入模型型号' : 'Enter a model identifier'}
                      className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--app-bg)]/60 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[var(--accent)] dark:text-slate-100"
                    />
                  )}
                </div>
              )}
            </div>

            {draft.kind === 'text' && (
              <>
                <div className={`grid gap-5 ${isHosted ? '' : 'md:grid-cols-2'}`}>
                  {/* NOTE: hosted 模式下不需要填写 API Key，服务端已持有密钥 */}
                  {isHosted ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                      <p className="text-sm font-black text-emerald-700 dark:text-emerald-300">
                        ✅ {language === 'zh' ? '无需填写 API Key' : 'No API Key required'}
                      </p>
                      <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        {language === 'zh'
                          ? 'AI 请求将通过网站服务端代理转发，密钥由网站管理员统一持有。每人每天可免费使用 30 次 AI 对话。'
                          : 'AI requests are proxied through the server. The API key is managed by the site admin. Each user gets 30 free AI calls per day.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {renderFieldLabel(
                        isLocalStableDiffusion || isOllama
                          ? language === 'zh'
                            ? 'API Key（可选）'
                            : 'API Key (Optional)'
                          : 'API Key',
                      )}
                      <input
                        type="password"
                        name={`ai-${draft.kind}-api-key`}
                        autoComplete="new-password"
                        value={draft.apiKey}
                        onChange={(e) => updateDraft({ apiKey: e.target.value })}
                        placeholder={
                          isLocalStableDiffusion
                            ? language === 'zh'
                              ? '本地 WebUI 通常可以留空'
                              : 'Usually empty for local WebUI'
                            : isOllama
                              ? language === 'zh'
                                ? 'Ollama 本地服务通常可以留空'
                                : 'Usually empty for local Ollama'
                              : undefined
                        }
                        className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-mono text-slate-900 outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    {renderFieldLabel(
                      isHosted
                        ? language === 'zh'
                          ? '代理地址（可选）'
                          : 'Proxy URL (Optional)'
                        : 'API URL',
                    )}
                    <input
                      type="text"
                      name="ai-text-api-url"
                      autoComplete="off"
                      spellCheck={false}
                      value={draft.apiUrl}
                      onChange={(e) => updateDraft({ apiUrl: e.target.value })}
                      placeholder={
                        isHosted
                          ? language === 'zh'
                            ? '留空使用默认 api/proxy.php'
                            : 'Leave empty for default api/proxy.php'
                          : undefined
                      }
                      className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-mono text-slate-900 outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-[var(--card-border)] bg-[var(--app-bg)]/45 px-4 py-4">
                  <div className="pr-4">
                    <p className="text-sm font-black text-[var(--text-primary)]">
                      {t.thinkingMode}
                    </p>
                    <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
                      {t.thinkingModeDesc}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateDraft({ thinkingMode: !draft.thinkingMode })}
                    className={`relative h-7 w-14 rounded-full transition-all ${
                      draft.thinkingMode
                        ? 'bg-[var(--accent)]'
                        : 'border border-[var(--header-border)] bg-[var(--app-bg)]'
                    }`}
                  >
                    <div
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                        draft.thinkingMode ? 'left-8' : 'left-1'
                      }`}
                    />
                  </button>
                </div>
              </>
            )}

            {draft.kind === 'image' && (
              <>
                <div className="grid gap-3 rounded-2xl border border-[var(--card-border)] bg-[var(--app-bg)]/45 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-black text-[var(--text-primary)]">
                        {language === 'zh' ? '从剪贴板导入模板' : 'Import template from clipboard'}
                      </p>
                      <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
                        {language === 'zh'
                          ? '支持把 curl、JSON 或官方示例直接粘进来自动识别 URL、Key、Model、尺寸。'
                          : 'Paste curl, JSON, or sample snippets and auto-fill URL, key, model, and size.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={importImageTemplateFromClipboard}
                      className="rounded-2xl bg-[var(--accent)] px-4 py-3 text-xs font-black text-white transition-all hover:shadow-lg active:scale-95"
                    >
                      {language === 'zh' ? '导入模板' : 'Import'}
                    </button>
                  </div>
                  {imageTemplateImportStatus !== 'idle' && (
                    <p
                      className={`text-xs font-bold ${
                        imageTemplateImportStatus === 'success'
                          ? 'text-emerald-500'
                          : 'text-amber-500'
                      }`}
                    >
                      {imageTemplateImportStatus === 'success'
                        ? language === 'zh'
                          ? '已识别并填入图片接口配置。'
                          : 'Image API fields were imported.'
                        : imageTemplateImportStatus === 'empty'
                          ? language === 'zh'
                            ? '没有识别到可用的接口字段。'
                            : 'No supported fields were detected.'
                          : language === 'zh'
                            ? '无法读取剪贴板。'
                            : 'Clipboard access is unavailable.'}
                    </p>
                  )}
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    {renderFieldLabel('API URL')}
                    <input
                      type="text"
                      name="ai-image-api-url"
                      autoComplete="off"
                      spellCheck={false}
                      value={draft.apiUrl}
                      onChange={(e) => updateDraft({ apiUrl: e.target.value })}
                      className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-mono text-slate-900 outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-2">
                    {renderFieldLabel('API Key')}
                    <input
                      type="password"
                      name="ai-image-api-key"
                      autoComplete="new-password"
                      value={draft.apiKey}
                      onChange={(e) => updateDraft({ apiKey: e.target.value })}
                      className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-mono text-slate-900 outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-2">
                    {renderFieldLabel(language === 'zh' ? '尺寸' : 'Size')}
                    <select
                      value={draft.size}
                      onChange={(e) => updateDraft({ size: e.target.value })}
                      className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                    >
                      {IMAGE_SIZE_PRESETS.map((size) => (
                        <option key={size.value} value={size.value}>
                          {size.value} - {language === 'zh' ? size.zh : size.en}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--app-bg)]/45 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-black text-[var(--text-primary)]">
                        {language === 'zh' ? '主体分割 / 扣背景' : 'Subject Segmentation'}
                      </p>
                      <p className="mt-1 text-xs font-medium leading-5 text-[var(--text-muted)]">
                        {language === 'zh'
                          ? '开启后，图片生成完成会自动继续调用扣背景 API，最终保存透明 PNG。'
                          : 'When enabled, generated images are sent to a background removal API and saved as transparent PNG.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        updateDraft({
                          removeBackground: !Boolean((draft as ImageAIProfile).removeBackground),
                        })
                      }
                      className="shrink-0 rounded-xl bg-[var(--app-bg)]/30 px-3 py-2 transition-all active:scale-95"
                    >
                      <div
                        className={`relative h-6 w-11 rounded-full transition-all duration-300 ${
                          (draft as ImageAIProfile).removeBackground
                            ? 'bg-[var(--accent)] shadow-lg'
                            : 'border border-[var(--header-border)] bg-[var(--app-bg)]'
                        }`}
                      >
                        <div
                          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-300 ${
                            (draft as ImageAIProfile).removeBackground ? 'left-6' : 'left-1'
                          }`}
                        />
                      </div>
                    </button>
                  </div>

                  {Boolean((draft as ImageAIProfile).removeBackground) && (
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        {renderFieldLabel(
                          language === 'zh' ? '主体分割 API URL' : 'Segmentation API URL',
                        )}
                        <select
                          value=""
                          onChange={(event) => {
                            if (!event.target.value) return;
                            updateDraft({ subjectSegmentationApiUrl: event.target.value });
                          }}
                          className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                        >
                          <option value="">
                            {language === 'zh' ? '选择 URL 模板' : 'Choose URL template'}
                          </option>
                          <option value="https://visual.volcengineapi.com">
                            https://visual.volcengineapi.com
                          </option>
                        </select>
                        <input
                          type="text"
                          name="ai-image-subject-segmentation-api-url"
                          autoComplete="off"
                          spellCheck={false}
                          value={(draft as ImageAIProfile).subjectSegmentationApiUrl ?? ''}
                          onChange={(event) =>
                            updateDraft({ subjectSegmentationApiUrl: event.target.value })
                          }
                          className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-mono text-slate-900 outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        {renderFieldLabel(
                          language === 'zh' ? '主体分割 API Key' : 'Segmentation API Key',
                        )}
                        <input
                          type="password"
                          name="ai-image-subject-segmentation-api-key"
                          autoComplete="new-password"
                          value={(draft as ImageAIProfile).subjectSegmentationApiKey ?? ''}
                          onChange={(event) =>
                            updateDraft({ subjectSegmentationApiKey: event.target.value })
                          }
                          className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-mono text-slate-900 outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {isLocalStableDiffusion && (
                  <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--app-bg)]/45 p-4">
                    <div className="mb-4">
                      <p className="text-sm font-black text-[var(--text-primary)]">
                        Stable Diffusion WebUI 参数
                      </p>
                      <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
                        {language === 'zh'
                          ? '需要在 AUTOMATIC1111 启动时开启 --api；API URL 填 WebUI 地址即可。'
                          : 'Start AUTOMATIC1111 with --api, then use the WebUI address as API URL.'}
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        {renderFieldLabel(language === 'zh' ? '负面提示词' : 'Negative Prompt')}
                        <textarea
                          value={(draft as ImageAIProfile).negativePrompt ?? ''}
                          onChange={(e) => updateDraft({ negativePrompt: e.target.value })}
                          rows={3}
                          placeholder="low quality, blurry, bad anatomy, watermark, text"
                          className="w-full resize-y rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </div>

                      <div className="space-y-2">
                        {renderFieldLabel('Steps')}
                        <input
                          type="number"
                          min={1}
                          max={150}
                          value={(draft as ImageAIProfile).steps ?? DEFAULT_STABLE_DIFFUSION_STEPS}
                          onChange={(e) => updateDraft({ steps: Number(e.target.value) })}
                          className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </div>

                      <div className="space-y-2">
                        {renderFieldLabel('CFG Scale')}
                        <input
                          type="number"
                          min={1}
                          max={30}
                          step={0.5}
                          value={
                            (draft as ImageAIProfile).cfgScale ?? DEFAULT_STABLE_DIFFUSION_CFG_SCALE
                          }
                          onChange={(e) => updateDraft({ cfgScale: Number(e.target.value) })}
                          className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </div>

                      <div className="space-y-2">
                        {renderFieldLabel('Sampler')}
                        <input
                          type="text"
                          value={
                            (draft as ImageAIProfile).sampler ?? DEFAULT_STABLE_DIFFUSION_SAMPLER
                          }
                          onChange={(e) => updateDraft({ sampler: e.target.value })}
                          placeholder={DEFAULT_STABLE_DIFFUSION_SAMPLER}
                          className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </div>

                      <div className="space-y-2">
                        {renderFieldLabel('Seed')}
                        <input
                          type="number"
                          min={-1}
                          value={(draft as ImageAIProfile).seed ?? -1}
                          onChange={(e) => updateDraft({ seed: Number(e.target.value) })}
                          className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </div>

                      <label className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--card-border)] bg-white px-4 py-3 dark:bg-slate-950">
                        <span className="text-sm font-black text-[var(--text-primary)]">
                          Restore Faces
                        </span>
                        <input
                          type="checkbox"
                          checked={Boolean((draft as ImageAIProfile).restoreFaces)}
                          onChange={(e) => updateDraft({ restoreFaces: e.target.checked })}
                          className="h-5 w-5 accent-[var(--accent)]"
                        />
                      </label>

                      <label className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--card-border)] bg-white px-4 py-3 dark:bg-slate-950">
                        <span className="text-sm font-black text-[var(--text-primary)]">
                          Hires Fix
                        </span>
                        <input
                          type="checkbox"
                          checked={Boolean((draft as ImageAIProfile).enableHr)}
                          onChange={(e) => updateDraft({ enableHr: e.target.checked })}
                          className="h-5 w-5 accent-[var(--accent)]"
                        />
                      </label>

                      {Boolean((draft as ImageAIProfile).enableHr) && (
                        <>
                          <div className="space-y-2">
                            {renderFieldLabel('Hires Scale')}
                            <input
                              type="number"
                              min={1}
                              max={4}
                              step={0.1}
                              value={(draft as ImageAIProfile).hrScale ?? 2}
                              onChange={(e) => updateDraft({ hrScale: Number(e.target.value) })}
                              className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                            />
                          </div>
                          <div className="space-y-2">
                            {renderFieldLabel('Denoising')}
                            <input
                              type="number"
                              min={0}
                              max={1}
                              step={0.05}
                              value={(draft as ImageAIProfile).denoisingStrength ?? 0.7}
                              onChange={(e) =>
                                updateDraft({ denoisingStrength: Number(e.target.value) })
                              }
                              className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                            />
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {draft.kind === 'voice' && (
              <>
                {draft.provider === 'system' ? (
                  <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--app-bg)]/45 px-4 py-4">
                    <p className="text-sm font-black text-[var(--text-primary)]">
                      {language === 'zh'
                        ? '系统语音'
                        : language === 'ja'
                          ? 'システム音声'
                          : 'System voice'}
                    </p>
                    <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
                      {language === 'zh'
                        ? '系统语音使用桌面端内置朗读能力，不需要联网或填写 API Key。'
                        : language === 'ja'
                          ? 'システム音声はデスクトップ内蔵のスピーチエンジンを使用するため、インターネット接続やAPIキーの入力は不要です。'
                          : 'System voice uses the app built-in speech engine and does not require an API key.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-5 md:grid-cols-2">
                    {isHostedVoice ? (
                      <div className="rounded-2xl border border-[var(--card-border)] bg-[var(--app-bg)]/45 px-4 py-4 md:col-span-2">
                        <p className="text-sm font-black text-[var(--text-primary)]">
                          {language === 'zh' ? '\u7f51\u7ad9\u6258\u7ba1\u8bed\u97f3' : 'Hosted voice'}
                        </p>
                        <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
                          {language === 'zh'
                            ? '\u8bed\u97f3\u8bf7\u6c42\u5c06\u901a\u8fc7\u7f51\u7ad9\u670d\u52a1\u7aef\u4ee3\u7406\u8f6c\u53d1\uff0c\u7528\u6237\u65e0\u9700\u586b\u5199 API Key\u3002'
                            : 'Voice requests are forwarded through the hosted server proxy. No user API key is required.'}
                        </p>
                      </div>
                    ) : draft.provider === 'youdao' ? (
                      <>
                        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs font-semibold leading-6 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100 md:col-span-2">
                          <p>
                            {language === 'zh'
                              ? YOUDAO_TTS_HELP.zh
                              : language === 'ja'
                                ? YOUDAO_TTS_HELP.ja
                                : YOUDAO_TTS_HELP.en}
                          </p>
                          {language === 'zh' && (
                            <div className="mt-3 grid gap-2 text-[11px] md:grid-cols-3">
                              <div className="rounded-xl bg-white/75 px-3 py-2 dark:bg-slate-950/40">
                                <span className="block font-black text-sky-950 dark:text-sky-50">
                                  1. 后台应用ID
                                </span>
                                <span className="text-sky-700 dark:text-sky-200">
                                  填到下面“应用ID”
                                </span>
                              </div>
                              <div className="rounded-xl bg-white/75 px-3 py-2 dark:bg-slate-950/40">
                                <span className="block font-black text-sky-950 dark:text-sky-50">
                                  2. 后台应用密钥
                                </span>
                                <span className="text-sky-700 dark:text-sky-200">
                                  填到下面“应用密钥”
                                </span>
                              </div>
                              <div className="rounded-xl bg-white/75 px-3 py-2 dark:bg-slate-950/40">
                                <span className="block font-black text-sky-950 dark:text-sky-50">
                                  3. 接口地址
                                </span>
                                <span className="text-sky-700 dark:text-sky-200">保持默认即可</span>
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          {renderFieldLabel(
                            language === 'zh' ? '应用ID（App Key）' : 'Application ID (App Key)',
                          )}
                          <input
                            type="text"
                            name="ai-voice-app-key"
                            autoComplete="off"
                            spellCheck={false}
                            value={draft.appKey}
                            onChange={(e) => updateDraft({ appKey: e.target.value })}
                            placeholder={
                              language === 'zh' ? '填有道后台“应用ID”' : 'Youdao application ID'
                            }
                            className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-mono text-slate-900 outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                          />
                          {language === 'zh' && (
                            <p className="text-[11px] font-semibold text-[var(--text-muted)]">
                              你截图左侧的“应用ID”填这里。它也会被有道文档叫做 appKey。
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          {renderFieldLabel(
                            language === 'zh'
                              ? '应用密钥（App Secret）'
                              : 'Application Secret (App Secret)',
                          )}
                          <input
                            type="password"
                            name="ai-voice-app-secret"
                            autoComplete="new-password"
                            value={draft.apiKey}
                            onChange={(e) => updateDraft({ apiKey: e.target.value })}
                            placeholder={
                              language === 'zh'
                                ? '填有道后台“应用密钥”'
                                : 'Youdao application secret'
                            }
                            className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-mono text-slate-900 outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                          />
                          {language === 'zh' && (
                            <p className="text-[11px] font-semibold text-[var(--text-muted)]">
                              你截图左侧的“应用密钥”填这里。它会隐藏显示，属于密码。
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2 md:col-span-2">
                        {renderFieldLabel('API Key')}
                        <input
                          type="password"
                          name="ai-voice-api-key"
                          autoComplete="new-password"
                          value={draft.apiKey}
                          onChange={(e) => updateDraft({ apiKey: e.target.value })}
                          className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-mono text-slate-900 outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </div>
                    )}

                    {!isHostedVoice && (
                      <div className="space-y-2 md:col-span-2">
                      {renderFieldLabel(
                        draft.provider === 'youdao' && language === 'zh'
                          ? '接口地址（API URL）'
                          : 'API URL',
                      )}
                      <input
                        type="text"
                        name="ai-voice-api-url"
                        autoComplete="off"
                        spellCheck={false}
                        value={draft.apiUrl}
                        onChange={(e) => updateDraft({ apiUrl: e.target.value })}
                        placeholder={draft.provider === 'youdao' ? DEFAULT_TTS_API_URL : undefined}
                        className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-mono text-slate-900 outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                      />
                      {draft.provider === 'youdao' && language === 'zh' && (
                        <p className="text-[11px] font-semibold text-[var(--text-muted)]">
                          默认地址是有道官方语音合成接口，普通接入不用改。
                        </p>
                      )}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  {renderFieldLabel(
                    draft.provider === 'youdao' && language === 'zh'
                      ? '音色（voiceName）'
                      : 'Voice',
                  )}
                  <input
                    type="text"
                    name="ai-voice-name"
                    autoComplete="off"
                    spellCheck={false}
                    value={draft.voice}
                    onChange={(e) => updateDraft({ voice: e.target.value })}
                    placeholder={
                      draft.provider === 'youdao'
                        ? language === 'zh'
                          ? '默认 youxiaoqin，可改成有道文档支持的 voiceName'
                          : 'Default: youxiaoqin'
                        : language === 'zh'
                          ? '例如：alloy / youxiaoqin'
                          : language === 'ja'
                            ? '例：alloy / youxiaoqin'
                            : 'For example: alloy / youxiaoqin'
                    }
                    className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                  />
                  {draft.provider === 'youdao' && language === 'zh' && (
                    <p className="text-[11px] font-semibold text-[var(--text-muted)]">
                      不知道选什么就保持 youxiaoqin。需要换声音时，打开
                      <a
                        href="https://ai.youdao.com/DOCSIRMA/html/tts/api/yyhc/index.html#section-9"
                        target="_blank"
                        rel="noreferrer"
                        className="mx-1 font-black text-[var(--accent)] underline underline-offset-2"
                      >
                        有道官方音色列表
                      </a>
                      ，把文档里的 voiceName 填到这里。
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={handleSaveProfile}
              className="rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-black text-white transition-all hover:bg-black active:scale-[0.99] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              {language === 'zh' ? '保存' : language === 'ja' ? '保存' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() =>
                setDeleteState({
                  mode: editorState.mode === 'create' ? 'draft' : 'saved',
                  ...(editorState.mode === 'create'
                    ? {
                        name:
                          draft.name.trim() ||
                          (language === 'zh'
                            ? '未保存配置'
                            : language === 'ja'
                              ? '未保存の設定'
                              : 'Unsaved profile'),
                      }
                    : {
                        kind: editorState.kind,
                        profileId: editorState.profileId || '',
                        name:
                          draft.name.trim() || buildFallbackProfileName(editorState.kind, language),
                      }),
                } as DeleteState)
              }
              className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3.5 text-sm font-black text-rose-600 transition-all hover:bg-rose-100 active:scale-[0.99] dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
            >
              {language === 'zh' ? '删除' : language === 'ja' ? '削除' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    );
  };
  return (
    <>
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
        {editorState ? (
          renderProfileForm()
        ) : (
          <>
            <section className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="text-base font-black text-[var(--text-primary)]">
                      {language === 'zh'
                        ? '\u0041\u0049 \u63a5\u53e3\u914d\u7f6e'
                        : language === 'ja'
                          ? 'AI Provider Profiles'
                          : 'AI Provider Profiles'}
                    </h3>
                  </div>
                </div>
              </div>

              <div className="grid gap-5">
                {sections.map((section) => {
                  const isWeb = !isTauriRuntime();
                  const virtualProfiles: SavedAIProfile[] =
                    isWeb && section.kind === 'text'
                      ? [HOSTED_PROXY_PROFILE]
                      : isWeb && section.kind === 'image'
                        ? [HOSTED_IMAGE_PROXY_PROFILE]
                        : isWeb && section.kind === 'voice'
                          ? [HOSTED_VOICE_PROXY_PROFILE]
                          : [];
                  const meta = getProfileKindMeta(section.kind, language);
                  const showMissingApiHint =
                    (section.kind === 'text' && missingTextApiKey) ||
                    section.kind === settingsAttentionTarget;
                  const canAcknowledgeMissingApiHint =
                    section.kind === settingsAttentionTarget &&
                    Boolean(onAcknowledgeSettingsAttention);
                  const allProfiles = [...virtualProfiles, ...section.profiles];
                  const totalCount = allProfiles.length;
                  const profileCountLabel =
                    language === 'zh'
                      ? String(totalCount) + ' \u4e2a\u914d\u7f6e'
                      : String(totalCount) + ' profile' + (totalCount === 1 ? '' : 's');

                  return (
                    <div
                      key={section.kind}
                      className={
                        'overflow-hidden rounded-lg border bg-[var(--card-bg)]/90 shadow-sm ' +
                        (showMissingApiHint
                          ? 'border-rose-400 ring-2 ring-rose-400/30'
                          : 'border-[var(--card-border)]')
                      }
                    >
                      <div className="flex items-start justify-between gap-4 border-b border-[var(--header-border)] px-5 py-4">
                        <div className="flex min-w-0 items-start gap-3">
                          <div
                            className={
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-md border ' +
                              (showMissingApiHint
                                ? 'border-rose-300 bg-rose-50 text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300'
                                : meta.accent)
                            }
                          >
                            <meta.icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4
                                className={
                                  'text-base font-black ' +
                                  (showMissingApiHint
                                    ? 'text-rose-600 dark:text-rose-300'
                                    : 'text-[var(--text-primary)]')
                                }
                              >
                                {meta.title}
                              </h4>
                              {showMissingApiHint && (
                                <span className="h-2 w-2 rounded-full bg-rose-500 shadow-sm" />
                              )}
                              <span className={'rounded px-2 py-0.5 text-[10px] font-black ' + meta.badge}>
                                {profileCountLabel}
                              </span>
                            </div>
                            <p className="mt-1 text-xs font-medium leading-5 text-[var(--text-muted)]">
                              {meta.subtitle}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {canAcknowledgeMissingApiHint && (
                            <button
                              type="button"
                              onClick={onAcknowledgeSettingsAttention}
                              className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-600 transition-all hover:bg-rose-100 active:scale-95 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15"
                            >
                              <Check className="h-3.5 w-3.5" />
                              {language === 'zh' ? '\u6211\u5df2\u77e5\u6653' : 'Got it'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openCreate(section.kind)}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--card-border)] bg-white px-3 py-2 text-xs font-black text-slate-900 transition-all hover:border-[var(--accent)] hover:text-[var(--accent)] active:scale-95 dark:bg-slate-950 dark:text-slate-100"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            {language === 'zh' ? '\u65b0\u5efa\u914d\u7f6e' : 'New Profile'}
                          </button>
                        </div>
                      </div>

                      <div className="max-h-[260px] overflow-y-auto px-4 py-3 custom-scrollbar">
                        {allProfiles.length === 0 ? (
                          <div className="rounded-md border border-dashed border-[var(--card-border)] bg-[var(--app-bg)]/40 px-4 py-7 text-center">
                            <p className="text-sm font-black text-[var(--text-primary)]">
                              {language === 'zh' ? '\u8fd8\u6ca1\u6709\u4fdd\u5b58\u7684\u914d\u7f6e' : 'No saved profiles yet'}
                            </p>
                            <p className="mt-2 text-xs font-medium leading-relaxed text-[var(--text-muted)]">
                              {language === 'zh'
                                ? '\u70b9\u51fb\u53f3\u4e0a\u89d2\u65b0\u5efa\uff0c\u5148\u586b\u5199\u914d\u7f6e\uff0c\u518d\u6309\u4fdd\u5b58\u3002'
                                : 'Create one from the top-right button, then save it.'}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {allProfiles.map((profile) => {
                              const isActive = profile.id === section.activeId;
                              const isReadOnly =
                                profile.id === HOSTED_PROXY_PROFILE_ID ||
                                profile.id === HOSTED_IMAGE_PROXY_PROFILE_ID ||
                                profile.id === HOSTED_VOICE_PROXY_PROFILE_ID;
                              const profileSummary = isReadOnly
                                ? language === 'zh'
                                  ? '\u0041\u0049 \u8bf7\u6c42\u5c06\u901a\u8fc7\u7f51\u7ad9\u670d\u52a1\u7aef\u4ee3\u7406\u8f6c\u53d1\u3002\u6bcf\u4eba\u6bcf\u5929\u53ef\u514d\u8d39\u4f7f\u7528 30 \u6b21 \u0041\u0049 \u5bf9\u8bdd\u3002'
                                  : 'AI requests are forwarded through the hosted proxy.'
                                : (profile.provider || 'custom').toUpperCase() + ' / ' +
                                  (profile.model || (language === 'zh' ? '\u672a\u6307\u5b9a\u6a21\u578b' : 'No model selected'));
                              return (
                                <button
                                  key={profile.id}
                                  type="button"
                                  onClick={() => {
                                    void onSelectAIProfile(section.kind, profile.id);
                                  }}
                                  className={
                                    'w-full rounded-md border px-3.5 py-3 text-left transition-all ' +
                                    (isActive
                                      ? 'border-[var(--accent)] bg-[var(--accent)]/5 shadow-sm ring-1 ring-[var(--accent)]/15'
                                      : 'border-[var(--card-border)] bg-[var(--app-bg)]/35 hover:border-[var(--accent)]/35 hover:bg-[var(--app-bg)]/55')
                                  }
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2.5">
                                        <span
                                          className={
                                            'h-2 w-2 rounded-full ' +
                                            (isActive ? 'bg-[var(--accent)]' : 'bg-slate-300')
                                          }
                                        />
                                        <p className="truncate text-sm font-black text-[var(--text-primary)]">
                                          {profile.name}
                                        </p>
                                      </div>
                                      <p
                                        className={
                                          'mt-1 pl-4.5 text-[11px] font-medium text-[var(--text-muted)] ' +
                                          (isReadOnly ? 'leading-5' : 'truncate')
                                        }
                                      >
                                        {profileSummary}
                                      </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                      {isActive && (
                                        <span className="rounded bg-[var(--accent)]/10 px-2 py-1 text-[10px] font-black text-[var(--accent)]">
                                          {language === 'zh' ? '\u6b63\u5728\u4f7f\u7528' : 'Active'}
                                        </span>
                                      )}
                                      {isReadOnly ? (
                                        <span className="inline-flex items-center gap-1 rounded border border-[var(--card-border)] px-2.5 py-1 text-[10px] font-black text-[var(--text-muted)] opacity-60">
                                          <Lock className="h-3 w-3" />
                                          {language === 'zh' ? '\u6258\u7ba1\u9501\u5b9a' : 'Locked'}
                                        </span>
                                      ) : (
                                        <span
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            openEdit(profile);
                                          }}
                                          className="inline-flex items-center gap-1 rounded border border-[var(--card-border)] px-2.5 py-1 text-[10px] font-black text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                                        >
                                          <Pencil className="h-3 w-3" />
                                          {language === 'zh' ? '\u7f16\u8f91' : 'Edit'}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>



            <section className="space-y-4 border-t border-[var(--header-border)] pt-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  {renderInfoHint(
                    <h3 className="text-base font-black text-[var(--text-primary)]">
                      {language === 'zh'
                        ? '\u0041\u0049 \u7eed\u5199\u5f39\u7a97\u6309\u94ae'
                        : language === 'ja'
                          ? 'AI writing buttons'
                          : 'AI Action Buttons'}
                    </h3>,
                    language === 'zh'
                      ? '\u63a7\u5236 \u0041\u0049 \u7eed\u5199\u9009\u62e9\u5f39\u7a97\u4e2d\u663e\u793a\u54ea\u4e9b\u529f\u80fd\u6309\u94ae\u3002'
                      : language === 'ja'
                        ? 'AI writing dialog features.'
                        : 'Control which action buttons appear in the AI writing modal.'
                  )}
                </div>
                <button
                  onClick={() => setAiButtonsConfig(defaultAIButtonsConfig)}
                  className="shrink-0 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-1.5 text-[10px] font-bold text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  {language === 'zh'
                    ? '\u5168\u90e8\u6062\u590d'
                    : language === 'ja'
                      ? 'Reset All'
                      : 'Reset All'}
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--app-bg)]/50 p-1.5 sm:grid-cols-2">
                {(
                  [
                    {
                      key: 'continue' as const,
                      Icon: PenLine,
                      label:
                        language === 'zh'
                          ? '\u6839\u636e\u524d\u6587\u7eed\u5199'
                          : language === 'ja'
                            ? 'Continue from context'
                            : 'Continue from context',
                    },
                    {
                      key: 'creative' as const,
                      Icon: Lightbulb,
                      label:
                        language === 'zh'
                          ? '\u63d0\u4f9b\u4e0d\u540c\u521b\u610f'
                          : language === 'ja'
                            ? 'Creative alternatives'
                            : 'Creative alternatives',
                    },
                    {
                      key: 'rewrite' as const,
                      Icon: RefreshCw,
                      label:
                        language === 'zh'
                          ? '\u6539\u5199\u5f53\u524d\u5185\u5bb9'
                          : language === 'ja'
                            ? 'Rewrite current content'
                            : 'Rewrite current content',
                    },
                    {
                      key: 'interpolate' as const,
                      Icon: PanelTopDashed,
                      label:
                        language === 'zh'
                          ? '\u8865\u5145\u4e2d\u95f4\u5185\u5bb9'
                          : language === 'ja'
                            ? 'Fill in the gap'
                            : 'Fill in the gap',
                    },
                    {
                      key: 'scene_only' as const,
                      Icon: Feather,
                      label:
                        language === 'zh'
                          ? '\u4ec5\u589e\u52a0\u573a\u666f\u63cf\u5199'
                          : language === 'ja'
                            ? 'Scene description only'
                            : 'Scene description only',
                    },
                    {
                      key: 'dialogue_only' as const,
                      Icon: MessageCircle,
                      label:
                        language === 'zh'
                          ? '\u4ec5\u589e\u52a0\u5bf9\u8bdd'
                          : language === 'ja'
                            ? 'Dialogue only'
                            : 'Dialogue only',
                    },
                  ] as const
                ).map((item) => (
                  <div
                    key={item.key}
                    onClick={() =>
                      setAiButtonsConfig({
                        ...aiButtonsConfig,
                        [item.key]: !aiButtonsConfig[item.key],
                      })
                    }
                    className={optionButtonClass(aiButtonsConfig[item.key])}
                  >
                    <span className={optionIconClass(aiButtonsConfig[item.key])}>
                      <item.Icon className="h-4 w-4" />
                    </span>
                    <span className="flex-1 text-sm font-semibold">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="border-t border-[var(--header-border)] pt-5">
              <div className="grid items-center gap-3 md:grid-cols-[minmax(132px,auto)_minmax(0,1fr)]">
                <div className="flex items-center gap-2">
                  {renderInfoHint(
                    <h3 className="whitespace-nowrap text-base font-black text-[var(--text-primary)]">
                      {language === 'zh'
                        ? '\u0041\u0049 \u5199\u4f5c\u503e\u5411'
                        : language === 'ja'
                          ? 'AI writing balance'
                          : 'AI Writing Balance'}
                    </h3>,
                    language === 'zh'
                      ? '\u63a7\u5236\u7efc\u5408\u7eed\u5199\u65f6\u66f4\u504f\u5411\u4eba\u7269\u5bf9\u8bdd\uff0c\u8fd8\u662f\u66f4\u504f\u5411\u52a8\u4f5c\u4e0e\u4e8b\u4ef6\u63a8\u8fdb\u3002'
                      : language === 'ja'
                        ? 'General writing can lean toward character dialogue or action-driven progress.'
                        : 'Choose whether general generation leans toward dialogue or action-driven progress.'
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--app-bg)]/50 p-1.5">
                {(
                  [
                    {
                      value: 'dialogue' as const,
                      Icon: MessageCircle,
                      label:
                        language === 'zh'
                          ? '\u66f4\u591a\u5bf9\u8bdd'
                          : language === 'ja'
                            ? 'More Dialogue'
                            : 'More Dialogue',
                      description:
                        language === 'zh'
                          ? '\u9ed8\u8ba4\uff1a\u8ba9\u4eba\u7269\u4ea4\u6d41\u3001\u53f0\u8bcd\u548c\u60c5\u7eea\u53cd\u5e94\u66f4\u591a\u3002'
                          : language === 'ja'
                            ? 'Default: more character speech and emotional response.'
                            : 'Default: more character speech and emotional response.',
                    },
                    {
                      value: 'action' as const,
                      Icon: Feather,
                      label:
                        language === 'zh'
                          ? '\u66f4\u591a\u52a8\u4f5c'
                          : language === 'ja'
                            ? 'More Action'
                            : 'More Action',
                      description:
                        language === 'zh'
                          ? '\u8ba9\u80a2\u4f53\u52a8\u4f5c\u3001\u573a\u9762\u8c03\u5ea6\u548c\u4e8b\u4ef6\u63a8\u8fdb\u66f4\u591a\u3002'
                          : language === 'ja'
                            ? 'More physical action, staging, and plot movement.'
                            : 'More physical action, staging, and plot movement.',
                    },
                  ] satisfies Array<{
                    value: AIGenerationBalance;
                    Icon: typeof MessageCircle;
                    label: string;
                    description: string;
                  }>
                ).map((item) => {
                  const selected = aiGenerationBalance === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setAiGenerationBalance(item.value)}
                      className={`flex min-h-11 items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all ${
                        selected
                          ? 'bg-[var(--card-bg)] text-[var(--accent)] shadow-sm ring-1 ring-[var(--card-border)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <span className={optionIconClass(selected)}>
                        <item.Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        {renderInfoHint(
                          <span className="text-sm font-black leading-tight">{item.label}</span>,
                          item.description,
                        )}
                      </span>
                    </button>
                  );
                })}
                </div>
              </div>
            </section>


            {assistantOptionsSlot}

            <section className="space-y-5 border-t border-[var(--header-border)] pt-5">
              <div className="mb-2 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-[var(--text-primary)]">
                    {language === 'zh'
                      ? '自定义 AI 提示词'
                      : language === 'ja'
                        ? 'カスタムAIプロンプト'
                        : 'Custom AI Prompts'}
                  </h3>
                  <p className="mt-1 text-xs font-medium leading-5 text-[var(--text-muted)]">
                    {language === 'zh'
                      ? '开启后可修改模板变量；关闭后保存项目时不会保留自定义文字。'
                      : language === 'ja'
                        ? '有効にするとプロンプトテンプレートを編集できます。無効にした場合、カスタムテキストは保存されません。'
                        : 'Enable to edit prompt templates. When disabled, custom text is not saved with the project.'}
                  </p>
                </div>
                <button
                  onClick={toggleCustomAiPrompts}
                  className="shrink-0 rounded-xl bg-[var(--app-bg)]/30 px-3 py-2 transition-all active:scale-95"
                >
                  <div
                    className={`relative h-6 w-11 rounded-full transition-all duration-300 ${
                      customAiPromptsEnabled
                        ? 'bg-[var(--accent)] shadow-lg'
                        : 'border border-[var(--header-border)] bg-[var(--app-bg)]'
                    }`}
                  >
                    <div
                      className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-300 ${
                        customAiPromptsEnabled ? 'left-6' : 'left-1'
                      }`}
                    />
                  </div>
                </button>
              </div>
              {customAiPromptsEnabled && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                  {Object.entries(aiPrompts || {}).map(([key, value]) => {
                    const labelMap: Record<string, string> = {
                      basePrompt:
                        language === 'zh'
                          ? '基础前置提示 (所有续写功能共享)'
                          : language === 'ja'
                            ? 'システムプロンプト（すべての機能で共有）'
                            : 'Base System Prompt',
                      continue:
                        language === 'zh'
                          ? '自然续写'
                          : language === 'ja'
                            ? '自然に書き続け'
                            : 'Continue Naturally',
                      creative:
                        language === 'zh'
                          ? '不同创意方向'
                          : language === 'ja'
                            ? '異なるアイデア方向'
                            : 'Creative Directions',
                      rewrite:
                        language === 'zh'
                          ? '文笔改写润色'
                          : language === 'ja'
                            ? '文章の書き換えと推敲'
                            : 'Rewrite & Polish',
                      interpolate:
                        language === 'zh'
                          ? '承上启下补充'
                          : language === 'ja'
                            ? '中間の内容を補完'
                            : 'Interpolate Segment',
                      sceneOnly:
                        language === 'zh'
                          ? '仅环境描写'
                          : language === 'ja'
                            ? '環境描写のみ'
                            : 'Scene Description Only',
                      dialogueOnly:
                        language === 'zh'
                          ? '仅人物对话'
                          : language === 'ja'
                            ? '対話のみ'
                            : 'Dialogue Only',
                      analyzeStructure:
                        language === 'zh'
                          ? '分析结构'
                          : language === 'ja'
                            ? '構造分析'
                            : 'Analyze Structure',
                      analyzeSuggestions:
                        language === 'zh'
                          ? '后续剧情建议'
                          : language === 'ja'
                            ? 'その後の展開のアドバイス'
                            : 'Plot Suggestions',
                      analyzeDirection:
                        language === 'zh'
                          ? '写作方向指导'
                          : language === 'ja'
                            ? '執筆方向のガイダンス'
                            : 'Direction Guidance',
                      analyzeSolution:
                        language === 'zh'
                          ? '解法与修改方案'
                          : language === 'ja'
                            ? '修正方案と解決策'
                            : 'Fix Solutions',
                      analyzeSummary:
                        language === 'zh'
                          ? '整体汇总报告'
                          : language === 'ja'
                            ? '全体のまとめ報告'
                            : 'General Summary',
                    };
                    const defaultValue =
                      defaultAIPrompts[key as keyof typeof defaultAIPrompts] ?? '';
                    const isModified = value !== defaultValue;
                    return (
                      <div key={key} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-[var(--text-primary)]">
                            {labelMap[key] || key}
                          </label>
                          {isModified && (
                            <button
                              onClick={() => setAiPrompts({ ...aiPrompts, [key]: defaultValue })}
                              title={
                                language === 'zh'
                                  ? '恢复默认'
                                  : language === 'ja'
                                    ? 'デフォルトに戻す'
                                    : 'Restore Default'
                              }
                              className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600 transition-all hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400"
                            >
                              ↺{' '}
                              {language === 'zh'
                                ? '恢复初始'
                                : language === 'ja'
                                  ? '元に戻す'
                                  : 'Restore'}
                            </button>
                          )}
                        </div>
                        <textarea
                          value={value}
                          onChange={(e) => setAiPrompts({ ...aiPrompts, [key]: e.target.value })}
                          className="custom-scrollbar h-24 w-full resize-y rounded-xl border border-[var(--card-border)] bg-[var(--app-bg)] px-4 py-3 text-xs font-medium text-[var(--text-secondary)] outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/50"
                          spellCheck="false"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <ConfirmActionModal
        visible={Boolean(deleteState)}
        language={language}
        title={
          deleteState?.mode === 'draft'
            ? language === 'zh'
              ? '放弃这个新配置？'
              : language === 'ja'
                ? 'この新規設定を破棄しますか？'
                : 'Discard this new profile?'
            : language === 'zh'
              ? '删除这个配置？'
              : language === 'ja'
                ? 'この設定を削除しますか？'
                : 'Delete this profile?'
        }
        description={
          deleteState?.mode === 'draft'
            ? language === 'zh'
              ? '这个配置还没有保存，删除后不会留下任何本地记录。'
              : language === 'ja'
                ? 'この設定はまだ保存されていないため、破棄するとローカルの記録には残りません。'
                : 'This profile has not been saved yet, so nothing will be kept locally.'
            : language === 'zh'
              ? `确定要删除「${deleteState?.name || '这个配置'}」吗？删除后无法恢复。`
              : language === 'ja'
                ? `本当に「${deleteState?.name || 'この設定'}」を削除しますか？この操作は取り消せません。`
                : `Delete "${deleteState?.name || 'this profile'}"? This cannot be undone.`
        }
        confirmLabel={
          deleteState?.mode === 'draft'
            ? language === 'zh'
              ? '删除草稿'
              : language === 'ja'
                ? '下書きを破棄'
                : 'Discard draft'
            : language === 'zh'
              ? '删除配置'
              : language === 'ja'
                ? '設定を削除'
                : 'Delete profile'
        }
        onCancel={() => setDeleteState(null)}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
      />
    </>
  );
}

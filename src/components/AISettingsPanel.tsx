import { ArrowLeft, BrainCircuit, ImageIcon, Volume2 } from 'lucide-react';
import React from 'react';

import { ConfirmActionModal } from '../editor-shell/ConfirmActionModal';
import {
  type AIButtonsConfig,
  type AIPromptsConfig,
  defaultAIButtonsConfig,
  defaultAIPrompts,
} from '../editor-state/editorConfig';
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
import { Language, translations } from '../lib/i18n';

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

const DEFAULT_TTS_API_URL = 'https://openapi.youdao.com/ttsapi';
const DEFAULT_TTS_MODEL = '';
const DEFAULT_TTS_VOICE = 'youxiaoqin';
const CUSTOM_MODEL_VALUE = '__custom_model__';

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
  doubao: [
    { value: 'speech-02-hd', label: 'Speech 02 HD' },
    { value: 'doubao-tts', label: 'Doubao TTS' },
  ],
  gemini: [{ value: 'gemini-2.5-flash-preview-tts', label: 'Gemini 2.5 Flash TTS Preview' }],
};

const IMAGE_SIZE_PRESETS = [
  { value: '2K', zh: '官方 2K', en: 'Official 2K' },
  { value: '2048x2048', zh: '1:1 即梦 2K', en: '1:1 Seedream 2K' },
  { value: '2560x1440', zh: '16:9 即梦横屏', en: '16:9 Seedream landscape' },
  { value: '1440x2560', zh: '9:16 即梦竖屏', en: '9:16 Seedream portrait' },
  { value: '1024x1024', zh: '1:1 标准方图', en: '1:1 Standard square' },
  { value: '1024x1536', zh: '2:3 竖图', en: '2:3 Portrait' },
  { value: '1536x1024', zh: '3:2 横图', en: '3:2 Landscape' },
  { value: '1792x1024', zh: '16:9 DALL-E', en: '16:9 DALL-E' },
  { value: '512x512', zh: 'SD 1:1 快速预览', en: 'SD 1:1 quick preview' },
  { value: '768x512', zh: 'SD 3:2 横图', en: 'SD 3:2 landscape' },
  { value: '512x768', zh: 'SD 2:3 竖图', en: 'SD 2:3 portrait' },
  { value: '768x768', zh: 'SD 1:1 高清', en: 'SD 1:1 high detail' },
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
      : kind === 'text'
        ? 'Text Profile'
        : kind === 'image'
          ? 'Image Profile'
          : 'Voice Profile';
  return `${prefix}_${formatTimestamp(Date.now())}`;
};

const buildDefaultTextDraft = (): TextAIProfile => ({
  id: 'draft-text',
  name: '',
  kind: 'text',
  provider: 'deepseek',
  apiKey: '',
  apiUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  thinkingMode: false,
});

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
      icon: BrainCircuit,
      accent:
        'from-indigo-500/15 to-indigo-500/5 text-indigo-600 border-indigo-200/70 dark:border-indigo-500/30 dark:text-indigo-300',
    };
  }
  if (kind === 'image') {
    return {
      title: language === 'zh' ? '图片 AI' : 'Image AI',
      icon: ImageIcon,
      accent:
        'from-emerald-500/15 to-emerald-500/5 text-emerald-600 border-emerald-200/70 dark:border-emerald-500/30 dark:text-emerald-300',
    };
  }
  return {
    title: language === 'zh' ? '语音 AI' : 'Voice AI',
    icon: Volume2,
    accent:
      'from-sky-500/15 to-sky-500/5 text-sky-600 border-sky-200/70 dark:border-sky-500/30 dark:text-sky-300',
  };
};

interface AISettingsPanelProps {
  language: Language;
  savedAIProfiles: SavedAIProfile[];
  activeTextProfileId: string | null;
  activeImageProfileId: string | null;
  activeVoiceProfileId: string | null;
  onCreateAIProfile: (
    kind: ProfileKind,
    initialProfile?: ProfileSeed,
  ) => void | string | Promise<void | string>;
  onUpdateAIProfile: (profileId: string, updates: ProfileUpdates) => void | Promise<void>;
  onSelectAIProfile: (kind: ProfileKind, profileId: string) => void | Promise<void>;
  onDeleteAIProfile: (profileId: string) => void | Promise<void>;
  aiPrompts: AIPromptsConfig;
  setAiPrompts: (prompts: AIPromptsConfig) => void;
  aiButtonsConfig: AIButtonsConfig;
  setAiButtonsConfig: (config: AIButtonsConfig) => void;
}

export function AISettingsPanel({
  language,
  savedAIProfiles,
  activeTextProfileId,
  activeImageProfileId,
  activeVoiceProfileId,
  onCreateAIProfile,
  onUpdateAIProfile,
  onSelectAIProfile,
  onDeleteAIProfile,
  aiPrompts,
  setAiPrompts,
  aiButtonsConfig,
  setAiButtonsConfig,
}: AISettingsPanelProps) {
  const t = translations[language];
  const [editorState, setEditorState] = React.useState<EditorState | null>(null);
  const [deleteState, setDeleteState] = React.useState<DeleteState | null>(null);
  const [showCustomAiPrompts, setShowCustomAiPrompts] = React.useState(false);
  const [imageTemplateImportStatus, setImageTemplateImportStatus] = React.useState<
    'idle' | 'success' | 'empty' | 'blocked'
  >('idle');

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
    setImageTemplateImportStatus('idle');
    setEditorState({
      mode: 'create',
      kind,
      profileId: null,
      draft,
    });
  };

  const openEdit = (profile: SavedAIProfile) => {
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

    const finalName = editorState.draft.name.trim() || buildFallbackProfileName(editorState.kind, language);
    const payload = {
      ...editorState.draft,
      name: finalName,
    } as ProfileSeed;

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
    setEditorState((current) =>
      current?.profileId === deleteState.profileId ? null : current,
    );
    setImageTemplateImportStatus('idle');
  };

  const renderFieldLabel = (label: string) => (
    <label className="text-xs font-black text-slate-900 dark:text-slate-100">{label}</label>
  );

  const renderProfileForm = () => {
    if (!editorState) return null;

    const draft = editorState.draft;
    const providerOptions = getProviderOptions(editorState.kind);
    const modelOptions = getModelOptions(editorState.kind, draft.provider);
    const currentModelSelectValue = getModelSelectValue(editorState.kind, draft);
    const meta = getProfileKindMeta(editorState.kind, language);
    const isLocalStableDiffusion =
      draft.kind === 'image' && draft.provider === LOCAL_STABLE_DIFFUSION_PROVIDER;

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
              <div className="space-y-2">
                {renderFieldLabel('Provider')}
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

              <div className="space-y-2">
                {renderFieldLabel('Model')}
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
                  <option value={CUSTOM_MODEL_VALUE}>
                    {language === 'zh' ? '自定义模型' : 'Custom model'}
                  </option>
                </select>
                {currentModelSelectValue === CUSTOM_MODEL_VALUE && (
                  <input
                    type="text"
                    value={draft.model}
                    onChange={(e) => updateDraft({ model: e.target.value })}
                    placeholder={
                      language === 'zh' ? '输入模型型号' : 'Enter a model identifier'
                    }
                    className="w-full rounded-2xl border border-[var(--card-border)] bg-[var(--app-bg)]/60 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[var(--accent)] dark:text-slate-100"
                  />
                )}
              </div>
            </div>

            {draft.kind === 'text' && (
              <>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    {renderFieldLabel(isLocalStableDiffusion ? 'API Key（可选）' : 'API Key')}
                    <input
                      type="password"
                      value={draft.apiKey}
                      onChange={(e) => updateDraft({ apiKey: e.target.value })}
                      placeholder={
                        isLocalStableDiffusion
                          ? language === 'zh'
                            ? '本地 WebUI 通常可以留空'
                            : 'Usually empty for local WebUI'
                          : undefined
                      }
                      className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-mono text-slate-900 outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>
                  <div className="space-y-2">
                    {renderFieldLabel('API URL')}
                    <input
                      type="text"
                      value={draft.apiUrl}
                      onChange={(e) => updateDraft({ apiUrl: e.target.value })}
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
                    className={`relative h-7 w-14 rounded-full transition-all ${draft.thinkingMode
                      ? 'bg-[var(--accent)]'
                      : 'border border-[var(--header-border)] bg-[var(--app-bg)]'
                      }`}
                  >
                    <div
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${draft.thinkingMode ? 'left-8' : 'left-1'
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
                      className={`text-xs font-bold ${imageTemplateImportStatus === 'success'
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
                      value={draft.apiUrl}
                      onChange={(e) => updateDraft({ apiUrl: e.target.value })}
                      className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-mono text-slate-900 outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>

                  <div className="space-y-2">
                    {renderFieldLabel('API Key')}
                    <input
                      type="password"
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
                          value={(draft as ImageAIProfile).cfgScale ?? DEFAULT_STABLE_DIFFUSION_CFG_SCALE}
                          onChange={(e) => updateDraft({ cfgScale: Number(e.target.value) })}
                          className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </div>

                      <div className="space-y-2">
                        {renderFieldLabel('Sampler')}
                        <input
                          type="text"
                          value={(draft as ImageAIProfile).sampler ?? DEFAULT_STABLE_DIFFUSION_SAMPLER}
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
                      {language === 'zh' ? '系统语音' : 'System voice'}
                    </p>
                    <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
                      {language === 'zh'
                        ? '系统语音使用桌面端内置朗读能力，不需要联网或填写 API Key。'
                        : 'System voice uses the desktop app built-in speech engine and does not require an API key.'}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-5 md:grid-cols-2">
                    {draft.provider === 'youdao' ? (
                      <>
                        <div className="space-y-2">
                          {renderFieldLabel('App Key')}
                          <input
                            type="text"
                            value={draft.appKey}
                            onChange={(e) => updateDraft({ appKey: e.target.value })}
                            className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-mono text-slate-900 outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                          />
                        </div>
                        <div className="space-y-2">
                          {renderFieldLabel('App Secret')}
                          <input
                            type="password"
                            value={draft.apiKey}
                            onChange={(e) => updateDraft({ apiKey: e.target.value })}
                            className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-mono text-slate-900 outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2 md:col-span-2">
                        {renderFieldLabel('API Key')}
                        <input
                          type="password"
                          value={draft.apiKey}
                          onChange={(e) => updateDraft({ apiKey: e.target.value })}
                          className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-mono text-slate-900 outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                        />
                      </div>
                    )}

                    <div className="space-y-2 md:col-span-2">
                      {renderFieldLabel('API URL')}
                      <input
                        type="text"
                        value={draft.apiUrl}
                        onChange={(e) => updateDraft({ apiUrl: e.target.value })}
                        className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-mono text-slate-900 outline-none transition-all focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {renderFieldLabel('Voice')}
                  <input
                    type="text"
                    value={draft.voice}
                    onChange={(e) => updateDraft({ voice: e.target.value })}
                    placeholder={language === 'zh' ? '例如：alloy / youxiaoqin' : 'For example: alloy / youxiaoqin'}
                    className="w-full rounded-2xl border-2 border-[var(--card-border)] bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent)]/15 dark:bg-slate-950 dark:text-slate-100"
                  />
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
              {language === 'zh' ? '保存' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() =>
                setDeleteState({
                  mode: editorState.mode === 'create' ? 'draft' : 'saved',
                  ...(editorState.mode === 'create'
                    ? {
                      name: draft.name.trim() || (language === 'zh' ? '未保存配置' : 'Unsaved profile'),
                    }
                    : {
                      kind: editorState.kind,
                      profileId: editorState.profileId || '',
                      name:
                        draft.name.trim() ||
                        buildFallbackProfileName(editorState.kind, language),
                    }),
                } as DeleteState)
              }
              className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3.5 text-sm font-black text-rose-600 transition-all hover:bg-rose-100 active:scale-[0.99] dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
            >
              {language === 'zh' ? '删除' : 'Delete'}
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
                  <div className="h-6 w-1.5 rounded-full bg-[var(--accent)]" />
                  <div>
                    <h3 className="text-base font-black text-[var(--text-primary)]">
                      {language === 'zh' ? 'AI 接口配置' : 'AI Provider Profiles'}
                    </h3>
                    <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
                      {language === 'zh'
                        ? '这些配置只保存在当前浏览器或桌面端本机，不会跟着项目导出。'
                        : 'These profiles stay on this device only and are never exported with projects.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-5">
                {sections.map((section) => {
                  const meta = getProfileKindMeta(section.kind, language);
                  return (
                    <div
                      key={section.kind}
                      className="overflow-hidden rounded-[28px] border border-[var(--card-border)] bg-[var(--card-bg)]/85 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-4 border-b border-[var(--header-border)] px-6 py-5">
                        <div className="flex min-w-0 items-center gap-4">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-gradient-to-br ${meta.accent}`}
                          >
                            <meta.icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-base font-black text-[var(--text-primary)]">
                              {meta.title}
                            </h4>
                            <p className="hidden">
                              {section.activeProfile?.name ||
                                (language === 'zh'
                                  ? '需要创建新的 AI 接口配置'
                                  : 'Create a new AI profile')}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openCreate(section.kind)}
                          className="shrink-0 rounded-2xl border border-[var(--card-border)] bg-white px-4 py-2.5 text-xs font-black text-slate-900 transition-all hover:border-[var(--accent)] hover:text-[var(--accent)] active:scale-95 dark:bg-slate-950 dark:text-slate-100"
                        >
                          {language === 'zh' ? '新建配置' : 'New Profile'}
                        </button>
                      </div>

                      <div className="max-h-[260px] overflow-y-auto px-4 py-4 custom-scrollbar">
                        {section.profiles.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-[var(--card-border)] bg-[var(--app-bg)]/40 px-5 py-10 text-center">
                            <p className="text-sm font-black text-[var(--text-primary)]">
                              {language === 'zh' ? '还没有保存的配置' : 'No saved profiles yet'}
                            </p>
                            <p className="mt-2 text-xs font-medium leading-relaxed text-[var(--text-muted)]">
                              {language === 'zh'
                                ? '点击右上角新建，先填写配置，再按保存。'
                                : 'Create one from the top-right button, then save it.'}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {section.profiles.map((profile) => {
                              const isActive = profile.id === section.activeId;
                              return (
                                <button
                                  key={profile.id}
                                  type="button"
                                  onClick={() => {
                                    void onSelectAIProfile(section.kind, profile.id);
                                  }}
                                  className={`w-full rounded-2xl border px-4 py-4 text-left transition-all ${isActive
                                    ? 'border-[var(--accent)] bg-[var(--accent)]/5 shadow-md ring-2 ring-[var(--accent)]/15'
                                    : 'border-[var(--card-border)] bg-[var(--app-bg)]/35 hover:border-[var(--accent)]/35'
                                    }`}
                                >
                                  <div className="flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span
                                          className={`h-2.5 w-2.5 rounded-full ${isActive ? 'bg-[var(--accent)]' : 'bg-slate-300'
                                            }`}
                                        />
                                        <p className="truncate text-sm font-black text-[var(--text-primary)]">
                                          {profile.name}
                                        </p>
                                      </div>
                                      <p className="hidden">
                                        {profile.provider || 'custom'}
                                      </p>
                                      <p className="hidden">
                                        {profile.model || (language === 'zh' ? '未指定模型' : 'No model selected')}
                                      </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                      {false && isActive && (
                                        <span className="rounded-full bg-[var(--accent)]/10 px-2 py-1 text-[10px] font-black text-[var(--accent)]">
                                          {language === 'zh' ? '正在使用' : 'Active'}
                                        </span>
                                      )}
                                      <span
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          openEdit(profile);
                                        }}
                                        className="rounded-full border border-[var(--card-border)] px-3 py-1 text-[10px] font-black text-[var(--text-secondary)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                                      >
                                        {language === 'zh' ? '编辑' : 'Edit'}
                                      </span>
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

            <section className="space-y-4 border-t border-[var(--header-border)] pt-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-1.5 rounded-full bg-indigo-500 dark:bg-sky-400" />
                  <h3 className="text-base font-black text-[var(--text-primary)]">
                    {language === 'zh' ? 'AI 续写弹窗按钮' : 'AI Action Buttons'}
                  </h3>
                </div>
                <button
                  onClick={() => setAiButtonsConfig(defaultAIButtonsConfig)}
                  className="rounded-lg px-2 py-1 text-[10px] font-bold text-[var(--text-muted)] transition-colors hover:bg-[var(--app-bg)]/50 hover:text-[var(--accent)]"
                >
                  {language === 'zh' ? '全部恢复' : 'Reset All'}
                </button>
              </div>
              <p className="text-xs font-medium text-[var(--text-muted)]">
                {language === 'zh'
                  ? '控制 AI 续写选择弹窗中显示哪些功能按钮。'
                  : 'Control which action buttons appear in the AI writing modal.'}
              </p>
              <div className="grid grid-cols-1 gap-2">
                {(
                  [
                    {
                      key: 'continue' as const,
                      emoji: '✍️',
                      label: language === 'zh' ? '根据前文续写' : 'Continue from context',
                    },
                    {
                      key: 'creative' as const,
                      emoji: '💡',
                      label: language === 'zh' ? '提供不同创意' : 'Creative alternatives',
                    },
                    {
                      key: 'rewrite' as const,
                      emoji: '🔄',
                      label: language === 'zh' ? '改写当前内容' : 'Rewrite current content',
                    },
                    {
                      key: 'interpolate' as const,
                      emoji: '🧩',
                      label: language === 'zh' ? '补充中间内容' : 'Fill in the gap',
                    },
                    {
                      key: 'scene_only' as const,
                      emoji: '🏞',
                      label: language === 'zh' ? '仅增加场景描写' : 'Scene description only',
                    },
                    {
                      key: 'dialogue_only' as const,
                      emoji: '💬',
                      label: language === 'zh' ? '仅增加对话' : 'Dialogue only',
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
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all ${aiButtonsConfig[item.key]
                      ? 'border-[var(--accent)]/40 bg-[var(--accent)]/5 hover:bg-[var(--accent)]/10'
                      : 'border-[var(--header-border)] bg-[var(--app-bg)]/30 opacity-50 hover:opacity-70'
                      }`}
                  >
                    <span className="text-lg">{item.emoji}</span>
                    <span
                      className={`flex-1 text-sm font-semibold ${aiButtonsConfig[item.key]
                        ? 'text-[var(--text-primary)]'
                        : 'text-[var(--text-muted)]'
                        }`}
                    >
                      {item.label}
                    </span>
                    <div
                      className={`relative h-5 w-10 rounded-full transition-all ${aiButtonsConfig[item.key]
                        ? 'bg-[var(--accent)]'
                        : 'border border-[var(--header-border)] bg-[var(--app-bg)]'
                        }`}
                    >
                      <div
                        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${aiButtonsConfig[item.key] ? 'left-5' : 'left-0.5'
                          }`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-6 border-t border-[var(--header-border)] pt-4">
              <div className="mb-2 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-1.5 rounded-full bg-indigo-500 dark:bg-sky-400" />
                  <h3 className="text-base font-black text-[var(--text-primary)]">
                    {language === 'zh' ? '自定义 AI 提示词' : 'Custom AI Prompts'}
                  </h3>
                </div>
                <button
                  onClick={() => setShowCustomAiPrompts(!showCustomAiPrompts)}
                  className="rounded-xl bg-[var(--app-bg)]/30 px-3 py-2 transition-all active:scale-95"
                >
                  <div
                    className={`relative h-6 w-11 rounded-full transition-all duration-300 ${showCustomAiPrompts
                      ? 'bg-[var(--accent)] shadow-lg'
                      : 'border border-[var(--header-border)] bg-[var(--app-bg)]'
                      }`}
                  >
                    <div
                      className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-300 ${showCustomAiPrompts ? 'left-6' : 'left-1'
                        }`}
                    />
                  </div>
                </button>
              </div>
              {showCustomAiPrompts && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                  <p className="mb-4 text-xs font-medium text-[var(--text-muted)]">
                    {language === 'zh'
                      ? '可在此处修改 AI 对话时使用的模板变量，修改会自动保存在工程中。'
                      : 'Modify the prompt templates used for AI interactions. Changes are saved with the project.'}
                  </p>
                  {Object.entries(aiPrompts || {}).map(([key, value]) => {
                    const labelMap: Record<string, string> = {
                      basePrompt:
                        language === 'zh'
                          ? '基础前置提示 (所有续写功能共享)'
                          : 'Base System Prompt',
                      continue: language === 'zh' ? '自然续写' : 'Continue Naturally',
                      creative: language === 'zh' ? '不同创意方向' : 'Creative Directions',
                      rewrite: language === 'zh' ? '文笔改写润色' : 'Rewrite & Polish',
                      interpolate: language === 'zh' ? '承上启下补充' : 'Interpolate Segment',
                      sceneOnly: language === 'zh' ? '仅环境描写' : 'Scene Description Only',
                      dialogueOnly: language === 'zh' ? '仅人物对话' : 'Dialogue Only',
                      analyzeStructure: language === 'zh' ? '分析结构' : 'Analyze Structure',
                      analyzeSuggestions: language === 'zh' ? '后续剧情建议' : 'Plot Suggestions',
                      analyzeDirection: language === 'zh' ? '写作方向指导' : 'Direction Guidance',
                      analyzeSolution: language === 'zh' ? '解法与修改方案' : 'Fix Solutions',
                      analyzeSummary: language === 'zh' ? '整体汇总报告' : 'General Summary',
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
                              title={language === 'zh' ? '恢复默认' : 'Restore Default'}
                              className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-600 transition-all hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400"
                            >
                              ↺ {language === 'zh' ? '恢复初始' : 'Restore'}
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
              : 'Discard this new profile?'
            : language === 'zh'
              ? '删除这个配置？'
              : 'Delete this profile?'
        }
        description={
          deleteState?.mode === 'draft'
            ? language === 'zh'
              ? '这个配置还没有保存，删除后不会留下任何本地记录。'
              : 'This profile has not been saved yet, so nothing will be kept locally.'
            : language === 'zh'
              ? `确定要删除「${deleteState?.name || '这个配置'}」吗？删除后无法恢复。`
              : `Delete "${deleteState?.name || 'this profile'}"? This cannot be undone.`
        }
        confirmLabel={
          deleteState?.mode === 'draft'
            ? language === 'zh'
              ? '删除草稿'
              : 'Discard draft'
            : language === 'zh'
              ? '删除配置'
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

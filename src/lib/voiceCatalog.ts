const OPENAI_VOICES = [
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'fable',
  'marin',
  'nova',
  'onyx',
  'sage',
  'shimmer',
  'verse',
];

const GEMINI_VOICES = [
  'Zephyr',
  'Puck',
  'Charon',
  'Kore',
  'Fenrir',
  'Leda',
  'Orus',
  'Aoede',
  'Callirrhoe',
  'Autonoe',
  'Enceladus',
  'Iapetus',
  'Umbriel',
  'Algieba',
  'Despina',
  'Erinome',
  'Algenib',
  'Rasalgethi',
  'Laomedeia',
  'Achernar',
  'Alnilam',
  'Gacrux',
  'Pulcherrima',
  'Vindemiatrix',
  'Sadachbia',
  'Sadaltager',
];

const YOUDAO_VOICES = [
  'youxiaoqin',
  'youxiaozhi',
  'youxiaoxun',
  'youxiaofu',
  'youyuting',
  'youxiaohao',
  'youxiaonan',
  'youxiaoke',
  'youxiaomei',
  'youxiaoying',
  'youxiaowei',
  'youxiaoguan',
  'youyating',
  'youkejiang',
  'yuantianjun',
  'youxiaobei',
  'youxiaodao',
];

const PLATFORM_VOICES: Record<string, string[]> = {
  openai: OPENAI_VOICES,
  gemini: GEMINI_VOICES,
  youdao: YOUDAO_VOICES,
};

export const getPlatformVoiceOptions = (provider: string, configuredVoice?: string) => {
  const options = PLATFORM_VOICES[provider] || [];
  return [
    ...new Set(
      [configuredVoice?.trim(), ...options].filter((voice): voice is string => Boolean(voice)),
    ),
  ];
};

export const getPlatformVoicePlaceholder = (provider: string) => {
  switch (provider) {
    case 'youdao':
      return '例如 youxiaoqin';
    case 'gemini':
      return '例如 Kore';
    case 'doubao':
    case 'hosted-voice':
      return '输入平台提供的 voice_type';
    case 'system':
      return '使用系统默认音色';
    default:
      return '例如 alloy';
  }
};

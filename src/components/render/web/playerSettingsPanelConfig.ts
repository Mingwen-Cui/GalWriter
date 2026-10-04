import type { Language } from '../../../lib/i18n';

export type PlayerControlId =
  | 'mode'
  | 'speed'
  | 'textSize'
  | 'auto'
  | 'animationSpeed'
  | 'musicVolume'
  | 'voiceVolume'
  | 'sound'
  | 'controls'
  | 'preview'
  | 'reset';
export type PlayerControlConfig = {
  state?: 'visible' | 'hidden' | 'removed';
  form?: 'switch' | 'segmented' | 'slider' | 'stepper' | 'select';
  height?: number;
  fontSize?: number;
  width?: number;
};
export type PlayerSettingsPanelConfig = {
  height?: number;
  fontSize?: number;
  radius?: number;
  appearance?: 'soft' | 'filled' | 'outline';
  controls?: Partial<Record<PlayerControlId, PlayerControlConfig>>;
};

export const playbackSettingButtonRoles: readonly string[] = [
  'settings',
  'mode',
  'speed',
  'textSize',
  'auto',
  'animationSpeed',
  'sound',
  'musicVolume',
  'voiceVolume',
  'controls',
  'preview',
  'reset',
];

export function playbackSettingButtonConfig(
  config: PlayerSettingsPanelConfig | undefined,
  role: string,
): PlayerSettingsPanelConfig {
  const ids: PlayerControlId[] = [
    'mode',
    'speed',
    'textSize',
    'auto',
    'animationSpeed',
    'sound',
    'controls',
    'preview',
    'reset',
    'musicVolume',
    'voiceVolume',
  ];
  return {
    ...config,
    controls: Object.fromEntries(
      ids.map((id) => [
        id,
        {
          ...config?.controls?.[id],
          state: role === 'settings' || id === role ? 'visible' : 'removed',
        },
      ]),
    ),
  };
}

export const playerControlCatalog = (language: Language) => {
  const labels =
    language === 'en'
      ? [
          'Text display',
          'Text speed',
          'Text size',
          'Auto advance',
          'Transitions & effects',
          'Playback audio',
          'Show toolbar',
          'Reading preview',
          'Restore story defaults',
          'Background music',
          'Character voice',
        ]
      : language === 'ja'
        ? [
            '文字の表示',
            '文字の表示速度',
            '文字サイズ',
            '自動ページ送り',
            '画面切替と演出の速度',
            'サウンド',
            '操作バーを表示',
            '読み方のプレビュー',
            '作品の初期設定に戻す',
            '背景音楽',
            'キャラクターボイス',
          ]
        : [
            '文字显示',
            '文字速度',
            '文字大小',
            '自动推进',
            '转场与动效速度',
            '播放声音',
            '显示操作栏',
            '阅读效果预览',
            '恢复作品默认',
            '背景音乐',
            '人物声音',
          ];
  const ids: PlayerControlId[] = [
    'mode',
    'speed',
    'textSize',
    'auto',
    'animationSpeed',
    'sound',
    'controls',
    'preview',
    'reset',
    'musicVolume',
    'voiceVolume',
  ];
  return ids.map((id, index) => ({
    id,
    label: labels[index],
    forms: (id === 'mode'
      ? ['segmented', 'select']
      : ['auto', 'sound', 'controls'].includes(id)
        ? ['switch', 'segmented']
        : ['speed', 'textSize', 'animationSpeed', 'musicVolume', 'voiceVolume'].includes(id)
          ? ['slider', 'stepper']
          : []) as NonNullable<PlayerControlConfig['form']>[],
  }));
};

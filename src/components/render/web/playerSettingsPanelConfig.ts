import type { Language } from '../../../lib/i18n';

export type PlayerControlId =
  | 'mode'
  | 'speed'
  | 'textSize'
  | 'auto'
  | 'animationSpeed'
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
          'Typing interval',
          'Text size',
          'Auto advance',
          'Animation speed',
          'Playback audio',
          'Show toolbar',
          'Reading preview',
          'Restore defaults',
        ]
      : language === 'ja'
        ? [
            '文字の表示',
            '文字の表示間隔',
            '文字サイズ',
            '自動ページ送り',
            'アニメーション速度',
            'サウンド',
            '操作バーを表示',
            '読み方のプレビュー',
            '初期設定に戻す',
          ]
        : [
            '文字呈现',
            '打字间隔',
            '文字大小',
            '自动翻页',
            '动画速度',
            '播放声音',
            '显示控制栏',
            '阅读效果预览',
            '恢复默认',
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
  ];
  return ids.map((id, index) => ({
    id,
    label: labels[index],
    forms: (id === 'mode'
      ? ['segmented', 'select']
      : ['auto', 'sound', 'controls'].includes(id)
        ? ['switch', 'segmented']
        : ['speed', 'textSize', 'animationSpeed'].includes(id)
          ? ['slider', 'stepper']
          : []) as NonNullable<PlayerControlConfig['form']>[],
  }));
};

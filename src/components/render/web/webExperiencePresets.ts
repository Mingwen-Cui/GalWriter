import type { Language } from '../../../lib/i18n';
import type { RenderStyle, WebExportSettings, WebMenuElement } from '../video/shared/types';

export type WebPresetScope = 'all' | 'current';
export type WebPresetSurface = 'start' | 'archive' | 'settings' | 'game';

export type WebExperiencePreset = {
  id: string;
  name: string;
  description: string;
  accent: string;
  settings: Partial<WebExportSettings>;
  renderStyle?: Partial<RenderStyle>;
  choiceColor?: string;
  choiceTextColor?: string;
};

type PresetLabels = {
  language: Language;
  title: string;
  subtitle: string;
  save: string;
  newGame: string;
  settings: string;
  archiveTitle: string;
  archiveBack: string;
  archiveSlot: string;
  archiveNew: string;
  settingsTitle: string;
  settingsBack: string;
  settingsAuto: string;
  settingsSpeed: string;
  settingsControls: string;
};

type StartCopyTheme = 'night' | 'campus' | 'minimal';

const makePresetLabels = (labels: PresetLabels, theme: StartCopyTheme): PresetLabels => {
  const copy =
    labels.language === 'ja'
      ? {
          night: ['夜のはじまり', '静寂の向こうへ', '物語を始める', '記録を見る', '環境設定'],
          campus: ['放課後のページ', '今日の物語をはじめよう', 'はじめる', '思い出を見る', '個人設定'],
          minimal: ['STORY', '項目を選択してください', 'はじめる', '記録', '設定'],
        }
      : labels.language === 'en'
        ? {
            night: ['A Quiet Night', 'The story begins beyond the silence.', 'Begin story', 'View archive', 'Preferences'],
            campus: ['After-school Pages', 'Today\'s story starts here.', 'Start game', 'My archive', 'Personalize'],
            minimal: ['STORY', 'Choose where to continue.', 'Start', 'Archive', 'Settings'],
          }
        : {
            night: ['静夜未眠', '迷雾之中，故事刚刚开始', '开始新篇', '查看档案', '偏好设置'],
            campus: ['放学后的故事', '今天的故事，从这里开始', '开始游戏', '我的档案', '个性设置'],
            minimal: ['故事入口', '请选择一项继续', '开始', '档案', '设置'],
          };
  const [title, subtitle, newGame, save, settings] = copy[theme];
  return { ...labels, title, subtitle, newGame, save, settings };
};

const textElement = (
  id: string,
  role: WebMenuElement['role'],
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fontSize: number,
  textColor = '#ffffff',
): WebMenuElement => ({
  id,
  kind: 'text',
  role,
  text,
  visible: true,
  x,
  y,
  width,
  height,
  scale: 1,
  rotation: 0,
  fontSize,
  textColor,
  borderRadius: 0,
});

const buttonElement = ({
  id,
  role,
  text,
  x,
  y,
  width,
  height,
  primary = false,
  disabled = false,
  textColor = '#ffffff',
  backgroundColor = '#ffffff1a',
  borderColor = 'rgba(255,255,255,0.16)',
  borderRadius = 12,
  fontSize = 14,
}: {
  id: string;
  role: WebMenuElement['role'];
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  primary?: boolean;
  disabled?: boolean;
  textColor?: string;
  backgroundColor?: string;
  borderColor?: string;
  borderRadius?: number;
  fontSize?: number;
}): WebMenuElement => ({
  id,
  kind: 'button',
  role,
  text,
  visible: true,
  x,
  y,
  width,
  height,
  scale: 1,
  rotation: 0,
  primary,
  disabled,
  fontSize,
  textColor,
  backgroundType: 'solid',
  backgroundColor,
  borderColor,
  borderRadius,
});

const makeStartElements = (
  labels: PresetLabels,
  choiceColor: string,
  choiceTextColor: string,
  variant: 'center' | 'left' | 'quiet',
): WebMenuElement[] => {
  const gradientButton = (
    config: Parameters<typeof buttonElement>[0],
    start: string,
    end: string,
  ): WebMenuElement => ({
    ...buttonElement(config),
    backgroundType: 'gradient',
    backgroundColor: start,
    backgroundGradientStart: start,
    backgroundGradientEnd: end,
    backgroundGradientAngle: 135,
    backgroundGradientShape: 'linear',
    backgroundGradientStops: [
      { id: `${config.id}-start`, color: start, alpha: 100, position: 0 },
      { id: `${config.id}-end`, color: end, alpha: 100, position: 100 },
    ],
    borderColor: 'rgba(255,255,255,0.34)',
  });

  if (variant === 'left') {
    return [
      {
        ...textElement('title', 'title', labels.title, 9, 18, 50, 13, 42, '#0f172a'),
        textAlign: 'left',
        fontFamily: '"Microsoft YaHei", "Noto Sans SC", sans-serif',
        fontWeight: 800,
        letterSpacing: 0.5,
      },
      {
        ...textElement('subtitle', 'subtitle', labels.subtitle, 10, 33, 38, 6, 15, '#155e75'),
        textAlign: 'left',
        fontFamily: '"Microsoft YaHei", "Noto Sans SC", sans-serif',
        fontWeight: 600,
        letterSpacing: 1.2,
      },
      gradientButton({
        id: 'new',
        role: 'new',
        text: labels.newGame,
        x: 9,
        y: 55,
        width: 30,
        height: 9,
        fontSize: 16,
        textColor: choiceTextColor,
        borderRadius: 18,
      }, '#fb923c', '#ea580c'),
      gradientButton({
        id: 'save',
        role: 'save',
        text: labels.save,
        x: 9,
        y: 67,
        width: 30,
        height: 9,
        disabled: true,
        fontSize: 16,
        textColor: choiceTextColor,
        borderRadius: 18,
      }, '#2dd4bf', '#0f766e'),
      gradientButton({
        id: 'settings',
        role: 'settings',
        text: labels.settings,
        x: 9,
        y: 79,
        width: 30,
        height: 9,
        fontSize: 16,
        textColor: choiceTextColor,
        borderRadius: 18,
      }, '#38bdf8', '#0284c7'),
    ];
  }

  if (variant === 'quiet') {
    return [
      {
        ...textElement('title', 'title', labels.title, 28, 28, 44, 10, 34, '#e2e8f0'),
        textAlign: 'center',
        fontFamily: 'ui-monospace, "Cascadia Mono", "Noto Sans Mono CJK SC", monospace',
        fontWeight: 600,
        letterSpacing: 2.4,
      },
      {
        ...textElement('subtitle', 'subtitle', labels.subtitle, 30, 40, 40, 5, 13, '#94a3b8'),
        textAlign: 'center',
        fontFamily: 'ui-monospace, "Cascadia Mono", "Noto Sans Mono CJK SC", monospace',
        fontWeight: 400,
        letterSpacing: 1.6,
      },
      gradientButton({
        id: 'new',
        role: 'new',
        text: labels.newGame,
        x: 31,
        y: 65,
        width: 11,
        height: 7,
        fontSize: 14,
        textColor: choiceTextColor,
        borderRadius: 4,
      }, '#475569', '#1e293b'),
      gradientButton({
        id: 'save',
        role: 'save',
        text: labels.save,
        x: 44.5,
        y: 65,
        width: 11,
        height: 7,
        disabled: true,
        fontSize: 14,
        textColor: choiceTextColor,
        borderRadius: 4,
      }, '#64748b', '#334155'),
      gradientButton({
        id: 'settings',
        role: 'settings',
        text: labels.settings,
        x: 58,
        y: 65,
        width: 11,
        height: 7,
        fontSize: 14,
        textColor: choiceTextColor,
        borderRadius: 4,
      }, '#94a3b8', '#475569'),
    ];
  }

  return [
    {
      ...textElement('title', 'title', labels.title, 18, 20, 64, 13, 46, '#e0e7ff'),
      textAlign: 'center',
      fontFamily: 'ui-serif, "Noto Serif SC", "Songti SC", serif',
      fontWeight: 700,
      letterSpacing: 2,
      shadowEnabled: true,
      shadowColor: '#4f46e5',
      shadowOpacity: 58,
      shadowBlur: 20,
      shadowOffsetX: 0,
      shadowOffsetY: 4,
    },
    {
      ...textElement('subtitle', 'subtitle', labels.subtitle, 20, 35, 60, 6, 18, '#c4b5fd'),
      textAlign: 'center',
      fontFamily: 'ui-serif, "Noto Serif SC", "Songti SC", serif',
      fontWeight: 500,
      letterSpacing: 2.8,
      shadowEnabled: true,
      shadowColor: '#4f46e5',
      shadowOpacity: 42,
      shadowBlur: 10,
      shadowOffsetX: 0,
      shadowOffsetY: 2,
    },
    gradientButton({
      id: 'new',
      role: 'new',
      text: labels.newGame,
      x: 30,
      y: 55,
      width: 40,
      height: 10,
      fontSize: 18,
      textColor: choiceTextColor,
      borderRadius: 12,
    }, '#6366f1', '#312e81'),
    gradientButton({
      id: 'save',
      role: 'save',
      text: labels.save,
      x: 30,
      y: 68,
      width: 40,
      height: 10,
      disabled: true,
      fontSize: 18,
      textColor: choiceTextColor,
      borderRadius: 12,
    }, '#0f766e', '#164e63'),
    gradientButton({
      id: 'settings',
      role: 'settings',
      text: labels.settings,
      x: 30,
      y: 81,
      width: 40,
      height: 10,
      fontSize: 18,
      textColor: choiceTextColor,
      borderRadius: 12,
    }, '#2563eb', '#1e3a8a'),
  ];
};

const makeArchiveElements = (
  labels: PresetLabels,
  choiceColor: string,
  choiceTextColor: string,
): WebMenuElement[] => [
  textElement('archive-title', 'title', labels.archiveTitle, 8, 7, 34, 9, 28),
  buttonElement({
    id: 'archive-back',
    role: 'back',
    text: labels.archiveBack,
    x: 78,
    y: 7,
    width: 14,
    height: 8,
    fontSize: 12,
  }),
  buttonElement({
    id: 'archive-slot',
    role: 'slot',
    text: labels.archiveSlot,
    x: 25,
    y: 42,
    width: 50,
    height: 16,
    fontSize: 14,
  }),
  buttonElement({
    id: 'archive-new',
    role: 'new',
    text: labels.archiveNew,
    x: 25,
    y: 62,
    width: 50,
    height: 10,
    primary: true,
    textColor: choiceTextColor,
    backgroundColor: choiceColor,
    borderColor: 'rgba(255,255,255,0.22)',
  }),
];

const makeSettingsElements = (
  labels: PresetLabels,
  choiceColor: string,
  choiceTextColor: string,
): WebMenuElement[] => [
  textElement('settings-title', 'title', labels.settingsTitle, 8, 7, 34, 9, 28),
  buttonElement({
    id: 'settings-back',
    role: 'back',
    text: labels.settingsBack,
    x: 78,
    y: 7,
    width: 14,
    height: 8,
    fontSize: 12,
  }),
  buttonElement({
    id: 'settings-auto',
    role: 'auto',
    text: labels.settingsAuto,
    x: 25,
    y: 38,
    width: 50,
    height: 10,
  }),
  buttonElement({
    id: 'settings-speed',
    role: 'speed',
    text: labels.settingsSpeed,
    x: 25,
    y: 52,
    width: 50,
    height: 12,
  }),
  buttonElement({
    id: 'settings-controls',
    role: 'controls',
    text: labels.settingsControls,
    x: 25,
    y: 68,
    width: 50,
    height: 10,
    primary: true,
    textColor: choiceTextColor,
    backgroundColor: choiceColor,
    borderColor: 'rgba(255,255,255,0.22)',
  }),
];

export const buildWebExperiencePresets = (labels: PresetLabels): WebExperiencePreset[] => [
  {
    id: 'quiet-night',
    name: '静夜蓝',
    description: '深色渐变、居中菜单、适合悬疑和剧情向作品。',
    accent: '#0ea5e9',
    choiceColor: '#0ea5e9',
    choiceTextColor: '#ffffff',
    settings: {
      showStartMenu: true,
      startMenuTemplate: 'cinematic',
      startMenuBackgroundType: 'gradient',
      startMenuBackgroundGradientStart: '#020617',
      startMenuBackgroundGradientEnd: '#312e81',
      startMenuBackgroundGradientAngle: 145,
      startMenuElements: makeStartElements(makePresetLabels(labels, 'night'), '#0ea5e9', '#ffffff', 'center'),
      archivePageElements: makeArchiveElements(labels, '#0ea5e9', '#ffffff'),
      settingsPageElements: makeSettingsElements(labels, '#0ea5e9', '#ffffff'),
      blurBackground: true,
      skipSingleChoicePopup: true,
    },
    renderStyle: {
      panelColor: '#080b1d',
      panelColorAlpha: 90,
      dialogRadius: 10,
      titleColor: '#e0e7ff',
      bodyColor: '#e2e8f0',
      nameplateColor: '#6366f1',
    },
  },
  {
    id: 'clear-campus',
    name: '校园清透',
    description: '明亮青绿、左侧标题，适合日常和轻恋爱作品。',
    accent: '#14b8a6',
    choiceColor: '#14b8a6',
    choiceTextColor: '#ffffff',
    settings: {
      showStartMenu: true,
      startMenuTemplate: 'glass',
      startMenuBackgroundType: 'gradient',
      startMenuBackgroundGradientStart: '#e0f2fe',
      startMenuBackgroundGradientEnd: '#99f6e4',
      startMenuBackgroundGradientAngle: 160,
      startMenuElements: makeStartElements(makePresetLabels(labels, 'campus'), '#14b8a6', '#ffffff', 'left'),
      archivePageElements: makeArchiveElements(labels, '#14b8a6', '#ffffff'),
      settingsPageElements: makeSettingsElements(labels, '#14b8a6', '#ffffff'),
      blurBackground: true,
      skipSingleChoicePopup: true,
    },
    renderStyle: {
      panelColor: '#ecfeff',
      panelColorAlpha: 92,
      dialogRadius: 30,
      titleColor: '#0f172a',
      bodyColor: '#155e75',
      nameplateColor: '#0f766e',
    },
  },
  {
    id: 'minimal-type',
    name: '极简文字',
    description: '低装饰、细圆角、适合文字主导的作品。',
    accent: '#64748b',
    choiceColor: '#475569',
    choiceTextColor: '#ffffff',
    settings: {
      showStartMenu: true,
      startMenuTemplate: 'minimal',
      startMenuBackgroundType: 'solid',
      startMenuBackgroundColor: '#0f172a',
      startMenuElements: makeStartElements(makePresetLabels(labels, 'minimal'), '#475569', '#ffffff', 'quiet'),
      archivePageElements: makeArchiveElements(labels, '#475569', '#ffffff'),
      settingsPageElements: makeSettingsElements(labels, '#475569', '#ffffff'),
      blurBackground: false,
      skipSingleChoicePopup: true,
    },
    renderStyle: {
      panelColor: '#111827',
      panelColorAlpha: 62,
      dialogRadius: 4,
      titleColor: '#f8fafc',
      bodyColor: '#cbd5e1',
      nameplateColor: '#64748b',
    },
  },
];

export const pickPresetSettingsForScope = (
  preset: WebExperiencePreset,
  surface: WebPresetSurface,
  scope: WebPresetScope,
): Partial<WebExportSettings> => {
  if (scope === 'all') return preset.settings;
  if (surface === 'archive') {
    return {
      archivePageElements: preset.settings.archivePageElements,
      startMenuShowSave: preset.settings.startMenuShowSave,
    };
  }
  if (surface === 'settings') {
    return {
      settingsPageElements: preset.settings.settingsPageElements,
    };
  }
  if (surface === 'game') {
    return {
      layoutMode: preset.settings.layoutMode,
      choicesPosition: preset.settings.choicesPosition,
      blurBackground: preset.settings.blurBackground,
      skipSingleChoicePopup: preset.settings.skipSingleChoicePopup,
    };
  }
  return {
    showStartMenu: preset.settings.showStartMenu,
    startMenuTemplate: preset.settings.startMenuTemplate,
    startMenuBackgroundType: preset.settings.startMenuBackgroundType,
    startMenuBackgroundColor: preset.settings.startMenuBackgroundColor,
    startMenuBackgroundGradientStart: preset.settings.startMenuBackgroundGradientStart,
    startMenuBackgroundGradientEnd: preset.settings.startMenuBackgroundGradientEnd,
    startMenuBackgroundGradientAngle: preset.settings.startMenuBackgroundGradientAngle,
    startMenuElements: preset.settings.startMenuElements,
    startMenuPlacementBoundsLocked: preset.settings.startMenuPlacementBoundsLocked,
    startMenuPlacementMinX: preset.settings.startMenuPlacementMinX,
    startMenuPlacementMinY: preset.settings.startMenuPlacementMinY,
    startMenuPlacementMaxX: preset.settings.startMenuPlacementMaxX,
    startMenuPlacementMaxY: preset.settings.startMenuPlacementMaxY,
    startMenuShowSave: preset.settings.startMenuShowSave,
    startMenuShowNewGame: preset.settings.startMenuShowNewGame,
    startMenuShowSettings: preset.settings.startMenuShowSettings,
  };
};

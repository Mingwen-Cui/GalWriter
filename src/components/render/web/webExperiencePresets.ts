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
  if (variant === 'left') {
    return [
      textElement('title', 'title', labels.title, 9, 22, 48, 12, 38),
      textElement('subtitle', 'subtitle', labels.subtitle, 10, 36, 34, 5, 13, '#dbeafe'),
      buttonElement({
        id: 'save',
        role: 'save',
        text: labels.save,
        x: 9,
        y: 58,
        width: 28,
        height: 9,
        primary: true,
        disabled: true,
        textColor: choiceTextColor,
        backgroundColor: choiceColor,
      }),
      buttonElement({
        id: 'new',
        role: 'new',
        text: labels.newGame,
        x: 9,
        y: 69,
        width: 28,
        height: 9,
      }),
      buttonElement({
        id: 'settings',
        role: 'settings',
        text: labels.settings,
        x: 9,
        y: 80,
        width: 28,
        height: 9,
      }),
    ];
  }

  if (variant === 'quiet') {
    return [
      textElement('title', 'title', labels.title, 29, 27, 42, 10, 30),
      textElement('subtitle', 'subtitle', labels.subtitle, 35, 39, 30, 5, 12, '#cbd5e1'),
      buttonElement({
        id: 'save',
        role: 'save',
        text: labels.save,
        x: 37,
        y: 61,
        width: 26,
        height: 8,
        primary: true,
        disabled: true,
        textColor: choiceTextColor,
        backgroundColor: choiceColor,
        borderRadius: 18,
      }),
      buttonElement({
        id: 'new',
        role: 'new',
        text: labels.newGame,
        x: 37,
        y: 71,
        width: 26,
        height: 8,
        borderRadius: 18,
      }),
      buttonElement({
        id: 'settings',
        role: 'settings',
        text: labels.settings,
        x: 37,
        y: 81,
        width: 26,
        height: 8,
        borderRadius: 18,
      }),
    ];
  }

  return [
    textElement('title', 'title', labels.title, 22, 30, 56, 12, 34),
    textElement('subtitle', 'subtitle', labels.subtitle, 22, 43, 56, 5, 13, '#bae6fd'),
    buttonElement({
      id: 'save',
      role: 'save',
      text: labels.save,
      x: 33,
      y: 61,
      width: 34,
      height: 10,
      primary: true,
      disabled: true,
      textColor: choiceTextColor,
      backgroundColor: choiceColor,
    }),
    buttonElement({
      id: 'new',
      role: 'new',
      text: labels.newGame,
      x: 33,
      y: 73,
      width: 34,
      height: 10,
    }),
    buttonElement({
      id: 'settings',
      role: 'settings',
      text: labels.settings,
      x: 33,
      y: 85,
      width: 34,
      height: 10,
    }),
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
      startMenuBackgroundGradientStart: '#0f172a',
      startMenuBackgroundGradientEnd: '#0891b2',
      startMenuBackgroundGradientAngle: 135,
      startMenuElements: makeStartElements(labels, '#0ea5e9', '#ffffff', 'center'),
      archivePageElements: makeArchiveElements(labels, '#0ea5e9', '#ffffff'),
      settingsPageElements: makeSettingsElements(labels, '#0ea5e9', '#ffffff'),
      blurBackground: true,
      skipSingleChoicePopup: true,
    },
    renderStyle: {
      panelColor: '#111827',
      panelColorAlpha: 82,
      dialogRadius: 24,
      titleColor: '#ffffff',
      bodyColor: '#f8fafc',
      nameplateColor: '#0ea5e9',
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
      startMenuBackgroundGradientStart: '#164e63',
      startMenuBackgroundGradientEnd: '#5eead4',
      startMenuBackgroundGradientAngle: 35,
      startMenuElements: makeStartElements(labels, '#14b8a6', '#ffffff', 'left'),
      archivePageElements: makeArchiveElements(labels, '#14b8a6', '#ffffff'),
      settingsPageElements: makeSettingsElements(labels, '#14b8a6', '#ffffff'),
      blurBackground: true,
      skipSingleChoicePopup: true,
    },
    renderStyle: {
      panelColor: '#0f172a',
      panelColorAlpha: 76,
      dialogRadius: 22,
      titleColor: '#ffffff',
      bodyColor: '#f8fafc',
      nameplateColor: '#14b8a6',
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
      startMenuBackgroundColor: '#111827',
      startMenuElements: makeStartElements(labels, '#475569', '#ffffff', 'quiet'),
      archivePageElements: makeArchiveElements(labels, '#475569', '#ffffff'),
      settingsPageElements: makeSettingsElements(labels, '#475569', '#ffffff'),
      blurBackground: false,
      skipSingleChoicePopup: true,
    },
    renderStyle: {
      panelColor: '#0f172a',
      panelColorAlpha: 70,
      dialogRadius: 16,
      titleColor: '#ffffff',
      bodyColor: '#e5e7eb',
      nameplateColor: '#475569',
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

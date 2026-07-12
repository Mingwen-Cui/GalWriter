import type { Language } from '../../../lib/i18n';
import { renderCopy } from '../video/shared/renderCopy';
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
type PresetVisualTheme = StartCopyTheme | 'paper' | 'neon';

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

const presetElementLayout = (
  theme: PresetVisualTheme,
  surface: 'start' | 'archive' | 'settings',
  role: WebMenuElement['role'],
): Partial<Pick<WebMenuElement, 'x' | 'y' | 'width' | 'height'>> => {
  if (surface === 'start' && theme === 'neon') {
    if (role === 'title') return { x: 12, y: 15, width: 76, height: 10 };
    if (role === 'subtitle') return { x: 13, y: 28, width: 74, height: 6 };
    if (role === 'new') return { x: 20, y: 72, width: 18, height: 8 };
    if (role === 'save') return { x: 41, y: 72, width: 18, height: 8 };
    if (role === 'settings') return { x: 62, y: 72, width: 18, height: 8 };
  }
  if (surface === 'start' && theme === 'paper') {
    if (role === 'title') return { x: 12, y: 16, width: 58, height: 12 };
    if (role === 'subtitle') return { x: 13, y: 31, width: 50, height: 7 };
    if (role === 'new' || role === 'save' || role === 'settings') return { x: 13, width: 28, height: 8 };
  }
  if (surface === 'archive') {
    if (theme === 'campus') {
      if (role === 'title') return { x: 10, y: 14, width: 42, height: 10 };
      if (role === 'back') return { x: 74, y: 14, width: 16, height: 7 };
      if (role === 'slot') return { x: 10, y: 35, width: 42, height: 22 };
      if (role === 'new') return { x: 56, y: 35, width: 30, height: 22 };
    }
    if (theme === 'minimal') {
      if (role === 'title') return { x: 10, y: 12, width: 50, height: 8 };
      if (role === 'back') return { x: 82, y: 12, width: 9, height: 6 };
      if (role === 'slot') return { x: 10, y: 28, width: 80, height: 14 };
      if (role === 'new') return { x: 10, y: 47, width: 20, height: 7 };
    }
    if (theme === 'paper') {
      if (role === 'title') return { x: 14, y: 13, width: 44, height: 10 };
      if (role === 'back') return { x: 74, y: 14, width: 15, height: 7 };
      if (role === 'slot') return { x: 14, y: 32, width: 54, height: 22 };
      if (role === 'new') return { x: 14, y: 59, width: 26, height: 8 };
    }
    if (theme === 'neon') {
      if (role === 'title') return { x: 10, y: 10, width: 54, height: 9 };
      if (role === 'back') return { x: 76, y: 10, width: 14, height: 7 };
      if (role === 'slot') return { x: 18, y: 34, width: 64, height: 16 };
      if (role === 'new') return { x: 60, y: 58, width: 22, height: 8 };
    }
  }
  if (surface === 'settings') {
    if (theme === 'campus') {
      if (role === 'title') return { x: 10, y: 14, width: 46, height: 10 };
      if (role === 'back') return { x: 74, y: 14, width: 16, height: 7 };
      if (role === 'auto' || role === 'speed' || role === 'controls') return { x: 10, width: 76, height: 8 };
    }
    if (theme === 'minimal') {
      if (role === 'title') return { x: 10, y: 12, width: 50, height: 8 };
      if (role === 'back') return { x: 82, y: 12, width: 9, height: 6 };
      if (role === 'auto' || role === 'speed' || role === 'controls') return { x: 10, width: 80, height: 7 };
    }
    if (theme === 'paper') {
      if (role === 'title') return { x: 14, y: 13, width: 48, height: 10 };
      if (role === 'back') return { x: 74, y: 14, width: 15, height: 7 };
      if (role === 'auto' || role === 'speed' || role === 'controls') return { x: 14, width: 54, height: 8 };
    }
    if (theme === 'neon') {
      if (role === 'title') return { x: 10, y: 10, width: 56, height: 9 };
      if (role === 'back') return { x: 76, y: 10, width: 14, height: 7 };
      if (role === 'auto' || role === 'speed' || role === 'controls') return { x: 18, width: 64, height: 8 };
    }
  }
  return {};
};

const stylePresetElements = (
  elements: WebMenuElement[],
  theme: PresetVisualTheme,
  surface: 'start' | 'archive' | 'settings',
): WebMenuElement[] => {
  const palette = {
    night: { text: '#dbeafe', soft: '#bfdbfe', card: 'rgba(15,23,42,0.55)', border: 'rgba(125,211,252,0.40)', radius: 18, font: 'ui-serif, "Noto Serif SC", "Songti SC", serif' },
    campus: { text: '#0f3b4a', soft: '#155e75', card: 'rgba(255,255,255,0.68)', border: 'rgba(20,184,166,0.34)', radius: 22, font: '"Microsoft YaHei", "Noto Sans SC", sans-serif' },
    minimal: { text: '#e2e8f0', soft: '#94a3b8', card: 'rgba(15,23,42,0.44)', border: 'rgba(148,163,184,0.42)', radius: 4, font: 'ui-monospace, "Cascadia Mono", "Noto Sans Mono CJK SC", monospace' },
    paper: { text: '#451a03', soft: '#78350f', card: 'rgba(255,251,235,0.78)', border: 'rgba(146,64,14,0.42)', radius: 2, font: 'ui-serif, "Noto Serif SC", "Songti SC", serif' },
    neon: { text: '#cffafe', soft: '#67e8f9', card: 'rgba(2,6,23,0.62)', border: 'rgba(34,211,238,0.64)', radius: 2, font: 'ui-monospace, "Cascadia Mono", "Noto Sans Mono CJK SC", monospace' },
  }[theme];
  const pageOffset = surface === 'start' ? 0 : theme === 'campus' || theme === 'paper' ? -6 : 0;
  return elements.map((element) => {
    const layout = presetElementLayout(theme, surface, element.role);
    const isTitle = element.role === 'title';
    const isPrimary = element.primary;
    const isButton = element.kind === 'button';
    const base: Partial<WebMenuElement> = {
      fontFamily: palette.font,
      textColor: isPrimary ? element.textColor : isTitle ? palette.text : palette.soft,
      borderColor: isButton ? palette.border : element.borderColor,
      borderRadius: isButton ? palette.radius : element.borderRadius,
      shadowEnabled: theme === 'night' || theme === 'neon',
      shadowColor: theme === 'neon' ? '#22d3ee' : '#0ea5e9',
      shadowOpacity: theme === 'neon' ? 44 : 22,
      shadowBlur: theme === 'neon' ? 14 : 10,
      shadowOffsetX: 0,
      shadowOffsetY: theme === 'neon' ? 0 : 4,
    };
    if (isTitle) {
      return {
        ...element,
        ...base,
        x: Math.max(6, element.x + pageOffset),
        ...layout,
        fontSize: theme === 'neon' ? Math.max(22, (element.fontSize || 28) - 2) : element.fontSize,
        fontWeight: theme === 'minimal' ? 500 : 800,
        letterSpacing: theme === 'neon' ? 3.2 : theme === 'minimal' ? 1.8 : 0.6,
      };
    }
    if (!isButton) return { ...element, ...base, ...layout };
    if (theme === 'neon') {
      return {
        ...element,
        ...base,
        ...layout,
        backgroundType: 'gradient',
        backgroundGradientStart: isPrimary ? '#0891b2' : '#0f172a',
        backgroundGradientEnd: isPrimary ? '#7c3aed' : '#083344',
        backgroundGradientAngle: 110,
        backgroundColor: isPrimary ? '#0891b2' : '#0f172a',
        borderWidth: 1.4,
      };
    }
    if (theme === 'paper') {
      return { ...element, ...base, ...layout, backgroundColor: isPrimary ? '#a16207' : palette.card, borderWidth: 1.2 };
    }
    if (theme === 'campus') {
      return { ...element, ...base, ...layout, backgroundColor: isPrimary ? '#14b8a6' : palette.card, borderWidth: 1 };
    }
    return { ...element, ...base, ...layout, backgroundColor: isPrimary ? element.backgroundColor : palette.card, borderWidth: theme === 'minimal' ? 1 : undefined };
  });
};

const makePresetSurfaceSettings = (theme: PresetVisualTheme): Partial<WebExportSettings> => {
  type SurfaceTheme = {
    start: [string, string, number]; archive: [string, string, number]; settings: [string, string, number]; dialogue: [string, string, number];
    layoutMode: 'classic' | 'immersive'; choicesPosition: 'center' | 'aboveText' | 'belowText'; blurBackground: boolean; skipSingleChoicePopup: boolean;
  };
  const allThemes: Record<PresetVisualTheme, SurfaceTheme> = {
    night: { start: ['#020617', '#312e81', 145], archive: ['#020617', '#0c4a6e', 160], settings: ['#0f172a', '#312e81', 125], dialogue: ['#020617', '#0f172a', 180], layoutMode: 'immersive' as const, choicesPosition: 'center' as const, blurBackground: true, skipSingleChoicePopup: true },
    campus: { start: ['#e0f2fe', '#99f6e4', 160], archive: ['#ecfeff', '#a7f3d0', 135], settings: ['#f0fdfa', '#bae6fd', 110], dialogue: ['#cffafe', '#e0f2fe', 145], layoutMode: 'classic' as const, choicesPosition: 'belowText' as const, blurBackground: false, skipSingleChoicePopup: false },
    minimal: { start: ['#0f172a', '#111827', 180], archive: ['#111827', '#1e293b', 145], settings: ['#0f172a', '#334155', 125], dialogue: ['#020617', '#111827', 180], layoutMode: 'classic' as const, choicesPosition: 'aboveText' as const, blurBackground: false, skipSingleChoicePopup: true },
    paper: { start: ['#fef3c7', '#fed7aa', 145], archive: ['#fffbeb', '#fde68a', 115], settings: ['#fefce8', '#fed7aa', 150], dialogue: ['#fef3c7', '#ffedd5', 180], layoutMode: 'classic' as const, choicesPosition: 'belowText' as const, blurBackground: false, skipSingleChoicePopup: false },
    neon: { start: ['#020617', '#0e7490', 120], archive: ['#020617', '#3b0764', 135], settings: ['#020617', '#164e63', 105], dialogue: ['#020617', '#0f172a', 180], layoutMode: 'immersive' as const, choicesPosition: 'center' as const, blurBackground: true, skipSingleChoicePopup: true },
  };
  const themes = allThemes[theme];
  const [startColor, startEnd, startAngle] = themes.start;
  const [archiveColor, archiveEnd, archiveAngle] = themes.archive;
  const [settingsColor, settingsEnd, settingsAngle] = themes.settings;
  const [dialogueColor, dialogueEnd, dialogueAngle] = themes.dialogue;
  return {
    startMenuBackgroundType: 'gradient', startMenuBackgroundGradientStart: startColor, startMenuBackgroundGradientEnd: startEnd, startMenuBackgroundGradientAngle: startAngle,
    archiveBackgroundType: 'gradient', archiveBackgroundGradientStart: archiveColor, archiveBackgroundGradientEnd: archiveEnd, archiveBackgroundGradientAngle: archiveAngle,
    settingsBackgroundType: 'gradient', settingsBackgroundGradientStart: settingsColor, settingsBackgroundGradientEnd: settingsEnd, settingsBackgroundGradientAngle: settingsAngle,
    dialogueBackgroundType: 'gradient', dialogueBackgroundGradientStart: dialogueColor, dialogueBackgroundGradientEnd: dialogueEnd, dialogueBackgroundGradientAngle: dialogueAngle,
    layoutMode: themes.layoutMode, choicesPosition: themes.choicesPosition, blurBackground: themes.blurBackground, skipSingleChoicePopup: themes.skipSingleChoicePopup,
  };
};

export const buildWebExperiencePresets = (labels: PresetLabels): WebExperiencePreset[] => [
  {
    id: 'quiet-night',
    name: '静夜蓝',
    description: '深色渐变、居中菜单、适合悬疑和剧情向作品。',
    accent: '#0ea5e9',
    choiceColor: '#0ea5e9',
    choiceTextColor: '#ffffff',
    settings: {
      ...makePresetSurfaceSettings('night'),
      showStartMenu: true,
      startMenuTemplate: 'cinematic',
      startMenuElements: stylePresetElements(makeStartElements(makePresetLabels(labels, 'night'), '#0ea5e9', '#ffffff', 'center'), 'night', 'start'),
      archivePageElements: stylePresetElements(makeArchiveElements(labels, '#0ea5e9', '#ffffff'), 'night', 'archive'),
      settingsPageElements: stylePresetElements(makeSettingsElements(labels, '#0ea5e9', '#ffffff'), 'night', 'settings'),
    },
    renderStyle: {
      panelColor: '#080b1d',
      panelColorAlpha: 90,
      dialogRadius: 10,
      titleColor: '#e0e7ff',
      bodyColor: '#e2e8f0',
      nameplateColor: '#6366f1',
      dialogBackgroundType: 'gradient', dialogGradientStartColor: '#0f172a', dialogGradientColor: '#1e1b4b', dialogGradientAngle: 125,
      nameplateInside: true, nameplateRadius: 14, titleAnimation: 'fade', bodyAnimation: 'typewriter',
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
      ...makePresetSurfaceSettings('campus'),
      showStartMenu: true,
      startMenuTemplate: 'glass',
      startMenuElements: stylePresetElements(makeStartElements(makePresetLabels(labels, 'campus'), '#14b8a6', '#ffffff', 'left'), 'campus', 'start'),
      archivePageElements: stylePresetElements(makeArchiveElements(labels, '#14b8a6', '#ffffff'), 'campus', 'archive'),
      settingsPageElements: stylePresetElements(makeSettingsElements(labels, '#14b8a6', '#ffffff'), 'campus', 'settings'),
    },
    renderStyle: {
      panelColor: '#ecfeff',
      panelColorAlpha: 92,
      dialogRadius: 30,
      titleColor: '#0f172a',
      bodyColor: '#155e75',
      nameplateColor: '#0f766e',
      dialogBackgroundType: 'gradient', dialogGradientStartColor: '#ecfeff', dialogGradientColor: '#cffafe', dialogGradientAngle: 145,
      nameplateInside: false, nameplateRadius: 22, titleAnimation: 'slideUp', bodyAnimation: 'typewriter',
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
      ...makePresetSurfaceSettings('minimal'),
      showStartMenu: true,
      startMenuTemplate: 'minimal',
      startMenuElements: stylePresetElements(makeStartElements(makePresetLabels(labels, 'minimal'), '#475569', '#ffffff', 'quiet'), 'minimal', 'start'),
      archivePageElements: stylePresetElements(makeArchiveElements(labels, '#475569', '#ffffff'), 'minimal', 'archive'),
      settingsPageElements: stylePresetElements(makeSettingsElements(labels, '#475569', '#ffffff'), 'minimal', 'settings'),
    },
    renderStyle: {
      panelColor: '#111827',
      panelColorAlpha: 62,
      dialogRadius: 4,
      titleColor: '#f8fafc',
      bodyColor: '#cbd5e1',
      nameplateColor: '#64748b',
      dialogBackgroundType: 'solid', nameplateInside: true, nameplateRadius: 4, titleAnimation: 'none', bodyAnimation: 'typewriter',
    },
  },
  {
    id: 'paper-story', name: '纸页小说', description: '暖色纸张、衬线排版、适合叙事与阅读。', accent: '#a16207', choiceColor: '#a16207', choiceTextColor: '#ffffff',
    settings: { ...makePresetSurfaceSettings('paper'), showStartMenu: true, startMenuTemplate: 'minimal', startMenuElements: stylePresetElements(makeStartElements(makePresetLabels(labels, 'campus'), '#a16207', '#ffffff', 'left'), 'paper', 'start'), archivePageElements: stylePresetElements(makeArchiveElements(labels, '#a16207', '#ffffff'), 'paper', 'archive'), settingsPageElements: stylePresetElements(makeSettingsElements(labels, '#a16207', '#ffffff'), 'paper', 'settings') },
    renderStyle: { panelColor: '#fffbeb', panelColorAlpha: 96, dialogRadius: 8, titleColor: '#451a03', bodyColor: '#78350f', nameplateColor: '#a16207', dialogBackgroundType: 'gradient', dialogGradientStartColor: '#fffbeb', dialogGradientColor: '#fed7aa', dialogGradientAngle: 90, nameplateInside: true, nameplateRadius: 2, titleAnimation: 'fade', bodyAnimation: 'typewriter' },
  },
  {
    id: 'neon-interface', name: '霓虹界面', description: '深色霓虹、锐利边角、适合科幻和赛博作品。', accent: '#22d3ee', choiceColor: '#0891b2', choiceTextColor: '#ecfeff',
    settings: { ...makePresetSurfaceSettings('neon'), showStartMenu: true, startMenuTemplate: 'cinematic', startMenuElements: stylePresetElements(makeStartElements(makePresetLabels(labels, 'night'), '#0891b2', '#ecfeff', 'center'), 'neon', 'start'), archivePageElements: stylePresetElements(makeArchiveElements(labels, '#0891b2', '#ecfeff'), 'neon', 'archive'), settingsPageElements: stylePresetElements(makeSettingsElements(labels, '#0891b2', '#ecfeff'), 'neon', 'settings') },
    renderStyle: { panelColor: '#020617', panelColorAlpha: 88, dialogRadius: 4, titleColor: '#67e8f9', bodyColor: '#cffafe', nameplateColor: '#22d3ee', dialogBackgroundType: 'gradient', dialogGradientStartColor: '#020617', dialogGradientColor: '#164e63', dialogGradientAngle: 110, nameplateInside: false, nameplateRadius: 2, titleAnimation: 'slideUp', bodyAnimation: 'typewriter' },
  },
];

export const buildDefaultWebExperiencePreset = (
  language: Language,
  title: string,
): WebExperiencePreset =>
  buildWebExperiencePresets({
    language,
    title,
    subtitle: renderCopy(language, '从这里开始阅读你的故事。', 'ここから物語を読み始めましょう。', 'Begin reading your story here.'),
    save: renderCopy(language, '存档', 'セーブ', 'Archive'),
    newGame: renderCopy(language, '开始新篇', '新しく始める', 'Begin story'),
    settings: renderCopy(language, '偏好设置', '環境設定', 'Preferences'),
    archiveTitle: renderCopy(language, '存档', 'セーブ', 'Archive'),
    archiveBack: renderCopy(language, '返回', '戻る', 'Back'),
    archiveSlot: renderCopy(language, '尚无存档\n导出后的网页会在这里记录进度。', 'セーブデータはありません\n書き出し後のWeb版では進行状況がここに表示されます。', 'No saves yet\nExported web builds record progress here.'),
    archiveNew: renderCopy(language, '开始新篇', '新しく始める', 'New game'),
    settingsTitle: renderCopy(language, '设置', '設定', 'Settings'),
    settingsBack: renderCopy(language, '返回', '戻る', 'Back'),
    settingsAuto: renderCopy(language, '自动播放', '自動再生', 'Auto play'),
    settingsSpeed: renderCopy(language, '打字速度', 'テキスト速度', 'Text speed'),
    settingsControls: renderCopy(language, '显示控制栏', '操作表示', 'Show controls'),
  })[0];

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

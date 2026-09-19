import { playerControlCatalog } from './playerSettingsPanelConfig';
import { formatWebText } from './i18n';
import type { Language } from '../../../lib/i18n';
import type { RenderStyle, WebExportSettings, WebMenuElement } from '../video/shared/types';
import { getWebSettingsCopy } from './i18n';

/**
 * The single source of truth for the built-in web rehearsal experience.
 * Keep visual defaults here so the editor preview and exported website start
 * from exactly the same page, toolbar, and typography data.
 */
export const REHEARSAL_TEMPLATE_ID = 'rehearsal';
export const REHEARSAL_TEMPLATE_VERSION = 1;

export type WebExperienceTemplate = {
  id: string;
  version: number;
  name: string;
  settings: Partial<WebExportSettings>;
  renderStyle: Partial<RenderStyle>;
  choiceColor: string;
  choiceTextColor: string;
};

const text = (
  id: string,
  role: WebMenuElement['role'],
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fontSize: number,
): WebMenuElement => ({
  id,
  kind: 'text',
  role,
  text: value,
  visible: true,
  x,
  y,
  width,
  height,
  scale: 1,
  rotation: 0,
  fontSize,
  fontWeight: role === 'title' ? 700 : 500,
  textColor: '#ffffff',
  borderRadius: 0,
});

const button = (
  id: string,
  role: WebMenuElement['role'],
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  choiceColor: string,
  choiceTextColor: string,
  primary = false,
): WebMenuElement => ({
  id,
  kind: 'button',
  role,
  text: value,
  visible: true,
  x,
  y,
  width,
  height,
  scale: 1,
  rotation: 0,
  primary,
  fontSize: 14,
  fontWeight: 700,
  textColor: primary ? choiceTextColor : '#f8fafc',
  backgroundType: 'solid',
  backgroundColor: primary ? choiceColor : '#ffffff1a',
  borderColor: primary ? '#ffffff3d' : '#ffffff29',
  borderRadius: 12,
});

export const buildRehearsalArchivePageElements = (
  language: Language,
  choiceColor: string,
  choiceTextColor: string,
): WebMenuElement[] => {
  const settingsCopy = getWebSettingsCopy(language);
  const elements: WebMenuElement[] = [
    text(
      'archive-title',
      'title',
      formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText92'),
      10,
      8,
      32,
      8,
      28,
    ),
    button(
      'archive-back',
      'back',
      settingsCopy.backToMainMenu,
      78,
      8,
      14,
      7,
      choiceColor,
      choiceTextColor,
    ),
    button(
      'archive-slot',
      'slot',
      formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText107'),
      24,
      40,
      52,
      15,
      choiceColor,
      choiceTextColor,
    ),
    button(
      'archive-slot-continue',
      'slotContinue',
      formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText119'),
      56,
      46,
      12,
      5,
      choiceColor,
      choiceTextColor,
      true,
    ),
    button(
      'archive-slot-delete',
      'slotDelete',
      formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText120'),
      69,
      46,
      7,
      5,
      choiceColor,
      choiceTextColor,
    ),
    button(
      'archive-new',
      'new',
      formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText124'),
      24,
      59,
      52,
      9,
      choiceColor,
      choiceTextColor,
      true,
    ),
  ];
  return elements
    .map((element) => {
      if (element.role === 'title') {
        return { ...element, x: 18, y: 24, width: 64, height: 12, fontSize: 46 };
      }
      if (element.role === 'subtitle') {
        return { ...element, x: 18, y: 38, width: 64, height: 6, fontSize: 18 };
      }
      const gradient =
        element.role === 'new'
          ? { start: '#38bdf8', end: '#2563eb', y: 57 }
          : element.role === 'save'
            ? { start: '#22d3ee', end: '#0f766e', y: 68 }
            : element.role === 'settings'
              ? { start: '#a78bfa', end: '#7c3aed', y: 79 }
              : null;
      if (!gradient) return element;
      return {
        ...element,
        text:
          element.role === 'save'
            ? formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText152')
            : element.text,
        x: 32,
        y: gradient.y,
        width: 36,
        height: 9,
        fontSize: 18,
        textColor: '#ffffff',
        backgroundType: 'gradient' as const,
        backgroundColor: gradient.start,
        backgroundGradientStart: gradient.start,
        backgroundGradientEnd: gradient.end,
        backgroundGradientAngle: 135,
        backgroundGradientShape: 'linear' as const,
        backgroundGradientStops: [
          { id: `${element.id}-start`, color: gradient.start, alpha: 100, position: 0 },
          { id: `${element.id}-end`, color: gradient.end, alpha: 100, position: 100 },
        ],
        borderColor: 'rgba(255,255,255,0.30)',
        borderRadius: 14,
      };
    })
    .sort((left, right) => {
      const order: Record<string, number> = {
        title: 0,
        subtitle: 1,
        new: 2,
        save: 3,
        settings: 4,
      };
      return (order[left.role || ''] ?? 99) - (order[right.role || ''] ?? 99);
    });
};

export const buildRehearsalSettingsPageElements = (
  language: Language,
  choiceColor: string,
  choiceTextColor: string,
): WebMenuElement[] => {
  const positions: Record<string, [number, number, number, number]> = {
    mode: [8, 22, 40, 15],
    speed: [8, 39, 40, 17],
    textSize: [8, 58, 40, 17],
    auto: [54, 22, 38, 15],
    animationSpeed: [54, 39, 38, 17],
    sound: [54, 58, 38, 15],
    controls: [54, 75, 38, 18],
    preview: [8, 77, 40, 16],
    reset: [54, 10, 24, 7],
  };
  return [
    text(
      'settings-title',
      'title',
      formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText192'),
      8,
      8,
      40,
      9,
      30,
    ),
    button(
      'settings-back',
      'back',
      formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText196'),
      80,
      10,
      12,
      7,
      choiceColor,
      choiceTextColor,
    ),
    ...playerControlCatalog(language).map(({ id, label, forms }) => ({
      ...button(`settings-${id}`, id, label, ...positions[id], choiceColor, choiceTextColor),
      fontSize: 16,
      textAlign: 'left' as const,
      backgroundColor: '#111c2de8',
      settingsControlForm: forms[0],
    })),
  ];
};

import { arrangeToolbarRow } from './webToolbarLayout';

export const buildRehearsalToolbarElements = (
  language: Language,
  canvasWidth = 1920,
  canvasHeight = 1080,
): WebMenuElement[] => {
  const toolbarButton = (
    id: string,
    role: WebMenuElement['role'],
    value: string,
    x: number,
    width: number,
  ): WebMenuElement => ({
    ...button(id, role, value, x, 2.4, width, 4.8, '#0ea5e9', '#ffffff'),
    fontSize: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 9999,
    textVisible: false,
    toolbarLayoutVersion: 2,
  });
  return arrangeToolbarRow(
    [
      toolbarButton(
        'toolbar-main',
        'mainMenu',
        language === 'zh' ? '主菜单' : language === 'ja' ? 'メニュー' : 'Menu',
        2,
        10,
      ),
      toolbarButton(
        'toolbar-controls-toggle',
        'controlsToggle',
        language === 'zh' ? '隐藏控制栏' : language === 'ja' ? '操作を隠す' : 'Hide controls',
        13,
        17,
      ),
      toolbarButton(
        'toolbar-return',
        'return',
        language === 'zh' ? '回退' : language === 'ja' ? '戻る' : 'Back',
        31,
        9,
      ),
      toolbarButton(
        'toolbar-auto',
        'auto',
        language === 'zh' ? '自动播放' : language === 'ja' ? '自動再生' : 'Auto play',
        41,
        13,
      ),
      toolbarButton(
        'toolbar-history',
        'history',
        language === 'zh' ? '对话历史' : language === 'ja' ? '会話履歴' : 'History',
        55,
        13,
      ),
      toolbarButton(
        'toolbar-audio',
        'audio',
        formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText259'),
        69,
        10,
      ),
      toolbarButton(
        'toolbar-fullscreen',
        'fullscreen',
        formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText260'),
        80,
        13,
      ),
    ].map((element) => ({ ...element, width: (4.8 * canvasHeight) / canvasWidth })),
    canvasWidth,
    canvasHeight,
  );
};

// Upgrade the old built-in row once; subsequent authored positions and sizes remain editable.
export const resolveWebToolbarElements = (
  elements: WebMenuElement[] | undefined,
  language: Language,
  canvasWidth = 1920,
  canvasHeight = 1080,
): WebMenuElement[] => {
  const defaults = buildRehearsalToolbarElements(language, canvasWidth, canvasHeight);
  if (!elements?.length) return defaults;
  const builtInIds = new Set(defaults.map((element) => element.id));
  const isLegacyRow =
    elements.some((element) => builtInIds.has(element.id)) &&
    (!elements.some((element) => element.id === 'toolbar-auto') ||
      elements.some((element) => builtInIds.has(element.id) && element.toolbarLayoutVersion !== 2));
  if (isLegacyRow) {
    const row = defaults.map((fallback) => {
      const previous = elements.find((element) => element.id === fallback.id);
      if (!previous) return fallback;
      return {
        ...previous,
        x: fallback.x,
        y: fallback.y,
        width: fallback.width,
        height: fallback.height,
        borderRadius: 9999,
        textVisible: previous.textVisible ?? false,
        toolbarLayoutVersion: 2,
        text: ['mainMenu', 'return', 'controlsToggle'].includes(fallback.role || '')
          ? fallback.text
          : previous.text || fallback.text,
      };
    });
    return arrangeToolbarRow(
      [...row, ...elements.filter((element) => !builtInIds.has(element.id))],
      canvasWidth,
      canvasHeight,
    );
  }
  if (elements.some((element) => element.role === 'history')) return elements;
  const history = defaults.find((element) => element.role === 'history')!;
  let candidate = { ...history };
  for (let y = 2.4; y <= 18; y += 6) {
    for (let x = 2; x <= 88; x += 10) {
      if (
        elements.every(
          (element) =>
            element.visible === false ||
            x + candidate.width <= element.x ||
            x >= element.x + element.width ||
            y + candidate.height <= element.y ||
            y >= element.y + element.height,
        )
      ) {
        candidate = { ...candidate, x, y };
        return [...elements, candidate];
      }
    }
  }
  return [...elements, candidate];
};

export const buildRehearsalStartMenuElements = (
  language: Language,
  title: string,
  choiceColor: string,
  choiceTextColor: string,
): WebMenuElement[] => {
  const startMenuAccent = '#625BF6';
  const startMenuAccentDark = '#4F46C5';
  const startMenuText = '#252A59';
  const startMenuMuted = '#68719A';
  const resolvedTitle = title && title !== '开始' ? title : '序章';
  const subtitle =
    language === 'zh'
      ? '选择一条路径，开始你的故事'
      : language === 'ja'
        ? '物語の道を選び、旅を始めよう'
        : 'Choose a path and begin your story';
  const elements: WebMenuElement[] = [
    {
      ...text(
        'title',
        'title',
        resolvedTitle || formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText275'),
        10,
        13,
        42,
        11,
        42,
      ),
      textAlign: 'left',
    },
    {
      ...text(
        'subtitle',
        'subtitle',
        subtitle,
        10,
        25,
        42,
        6,
        16,
      ),
      textAlign: 'left',
    },
    {
      ...button(
        'save',
        'save',
        formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText281'),
        10,
        63,
        28,
        9,
        choiceColor,
        choiceTextColor,
        true,
      ),
    },
    button(
      'continue',
      'continue',
      formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText291'),
      10,
      40,
      28,
      10,
      choiceColor,
      choiceTextColor,
      true,
    ),
    button(
      'flow-overview',
      'flowOverview',
      language === 'zh' ? '流程图总览' : language === 'ja' ? 'フロー概要' : 'Flow overview',
      10,
      76,
      13,
      7,
      choiceColor,
      choiceTextColor,
    ),
    button(
      'new',
      'new',
      formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText295'),
      10,
      52,
      28,
      9,
      choiceColor,
      choiceTextColor,
    ),
    button(
      'settings',
      'settings',
      formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText306'),
      25,
      76,
      13,
      7,
      choiceColor,
      choiceTextColor,
    ),
  ];
  return elements.map((element) => {
    if (element.role === 'title') {
      return {
        ...element,
        textColor: startMenuText,
      };
    }
    if (element.role === 'subtitle') {
      return {
        ...element,
        textColor: startMenuMuted,
        fontWeight: 600,
      };
    }
    if (element.kind !== 'button') return element;

    const isPrimary = element.role === 'continue';
    const isSecondary = element.role === 'new' || element.role === 'save';
    const isUtility = element.role === 'flowOverview' || element.role === 'settings';
    return {
      ...element,
      primary: isPrimary,
      fontSize: isUtility ? 15 : 18,
      fontWeight: 700,
      textAlign: isUtility ? 'center' : 'left',
      textColor: isPrimary ? '#FFFFFF' : isUtility ? '#514DB4' : startMenuText,
      backgroundType: isPrimary ? ('gradient' as const) : ('solid' as const),
      backgroundColor: isPrimary
        ? startMenuAccent
        : isSecondary
          ? element.role === 'new'
            ? '#FFFFFF'
            : '#F3F1FF'
          : 'rgba(255,255,255,0.78)',
      backgroundGradientStart: startMenuAccent,
      backgroundGradientEnd: startMenuAccentDark,
      backgroundGradientAngle: 135,
      backgroundGradientShape: 'linear' as const,
      backgroundGradientStops: [
        { id: `${element.id}-start`, color: startMenuAccent, alpha: 100, position: 0 },
        { id: `${element.id}-end`, color: startMenuAccentDark, alpha: 100, position: 100 },
      ],
      borderColor: isPrimary
        ? 'rgba(98,91,246,0.34)'
        : isSecondary
          ? 'rgba(98,91,246,0.24)'
          : 'rgba(98,91,246,0.18)',
      borderWidth: 1,
      borderRadius: isUtility ? 999 : 16,
      shadowColor: isPrimary ? '#625BF6' : '#625BF6',
      shadowOpacity: isPrimary ? 18 : 8,
      shadowBlur: isPrimary ? 22 : 12,
      shadowOffsetY: 5,
    };
  });
};

export const buildRehearsalTemplate = (
  language: Language,
  title: string,
): WebExperienceTemplate => {
  const choiceColor = '#0ea5e9';
  const choiceTextColor = '#ffffff';
  return {
    id: REHEARSAL_TEMPLATE_ID,
    version: REHEARSAL_TEMPLATE_VERSION,
    name: formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText326'),
    choiceColor,
    choiceTextColor,
    settings: {
      showStartMenu: true,
      startMenuTemplate: 'cinematic',
      startMenuButtonPosition: 'center',
      startMenuButtonLayout: 'vertical',
      startMenuButtonSize: 'normal',
      startMenuElements: buildRehearsalStartMenuElements(
        language,
        title,
        choiceColor,
        choiceTextColor,
      ),
      archivePageElements: buildRehearsalArchivePageElements(
        language,
        choiceColor,
        choiceTextColor,
      ),
      settingsPageElements: buildRehearsalSettingsPageElements(
        language,
        choiceColor,
        choiceTextColor,
      ),
      previewToolbarElements: buildRehearsalToolbarElements(language),
    },
    renderStyle: {
      titleFontSize: 28,
      bodyFontSize: 18,
      nameplateFontSize: 18,
      titleLineHeight: 1.25,
      bodyLineHeight: 1.45,
    },
  };
};

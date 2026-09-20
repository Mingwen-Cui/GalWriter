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
  return [
    text(
      'archive-title',
      'title',
      formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText92'),
      8,
      16,
      30,
      10,
      42,
    ),
    {
      ...text(
        'archive-subtitle',
        'subtitle',
        language === 'zh'
          ? '选择一个进度继续你的旅程'
          : language === 'ja'
            ? '進行状況を選んで、物語を続けよう'
            : 'Choose a save to continue your journey',
        8,
        28,
        30,
        5,
        16,
      ),
      textAlign: 'left' as const,
    },
    button(
      'archive-back',
      'back',
      settingsCopy.backToMainMenu,
      8,
      35,
      14,
      7,
      choiceColor,
      choiceTextColor,
    ),
    button(
      'archive-slot',
      'slot',
      formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText107'),
      8,
      45,
      30,
      13,
      choiceColor,
      choiceTextColor,
    ),
    button(
      'archive-slot-continue',
      'slotContinue',
      formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText119'),
      8,
      60,
      20,
      7,
      choiceColor,
      choiceTextColor,
      true,
    ),
    button(
      'archive-slot-delete',
      'slotDelete',
      formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText120'),
      30,
      60,
      8,
      7,
      choiceColor,
      choiceTextColor,
    ),
    button(
      'archive-new',
      'new',
      formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText124'),
      8,
      70,
      30,
      9,
      choiceColor,
      choiceTextColor,
      true,
    ),
  ].map((element) => {
    if (element.role === 'title') return { ...element, textColor: '#252a59', textAlign: 'left' };
    if (element.role === 'subtitle')
      return { ...element, textColor: '#68719a', fontWeight: 600, textAlign: 'left' };
    const primary = element.role === 'new' || element.role === 'slotContinue';
    return {
      ...element,
      primary,
      fontSize: element.role === 'slot' ? 16 : 15,
      textColor: primary ? '#ffffff' : '#334155',
      backgroundColor: primary ? '#625bf6' : '#ffffff',
      borderColor: primary ? '#4f46c5' : 'rgba(15,23,42,0.28)',
      borderWidth: primary ? 1.5 : 1,
      borderRadius: element.role === 'back' ? 999 : 14,
      shadowColor: '#0f172a',
      shadowOpacity: primary ? 18 : 12,
      shadowBlur: primary ? 24 : 16,
      shadowOffsetY: primary ? 8 : 6,
    };
  });
};

export const buildRehearsalSettingsPageElements = (
  language: Language,
  choiceColor: string,
  choiceTextColor: string,
): WebMenuElement[] => {
  const positions: Record<string, [number, number, number, number]> = {
    mode: [8, 42, 30, 10],
    speed: [8, 55, 30, 12],
    textSize: [8, 70, 30, 12],
    preview: [8, 85, 30, 10],
    auto: [40, 42, 30, 10],
    animationSpeed: [40, 55, 30, 12],
    sound: [40, 70, 30, 10],
    controls: [40, 85, 30, 10],
    reset: [24, 29, 14, 7],
  };
  return [
    text(
      'settings-title',
      'title',
      formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText192'),
      8,
      16,
      48,
      10,
      42,
    ),
    button(
      'settings-back',
      'back',
      formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText196'),
      8,
      29,
      14,
      7,
      choiceColor,
      choiceTextColor,
    ),
    ...playerControlCatalog(language).map(({ id, label, forms }) => ({
      ...button(`settings-${id}`, id, label, ...positions[id], choiceColor, choiceTextColor),
      fontSize: id === 'reset' ? 14 : 15,
      textAlign: 'left' as const,
      textColor: id === 'reset' ? '#ffffff' : '#334155',
      backgroundColor: id === 'reset' ? '#625bf6' : '#ffffff',
      borderColor: id === 'reset' ? '#4f46c5' : 'rgba(15,23,42,0.28)',
      borderWidth: id === 'reset' ? 1.5 : 1,
      borderRadius: id === 'reset' ? 999 : 14,
      shadowColor: '#0f172a',
      shadowOpacity: id === 'reset' ? 18 : 12,
      shadowBlur: id === 'reset' ? 24 : 16,
      shadowOffsetY: id === 'reset' ? 8 : 6,
      settingsControlForm: forms[0],
    })),
  ].map((element) =>
    element.role === 'title' ? { ...element, textColor: '#252a59', textAlign: 'left' } : element,
  );
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
  const resolvedTitle = title && title !== '开始' ? title : '故事首页';
  const subtitle =
    language === 'zh'
      ? '选择一条路径，开启你的旅程'
      : language === 'ja'
        ? '物語の道を選び、旅を始めよう'
        : 'Choose a path and begin your story';
  const elements: WebMenuElement[] = [
    {
      ...text(
        'title',
        'title',
        resolvedTitle ||
          formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText275'),
        8,
        16,
        44,
        11,
        42,
      ),
      textAlign: 'left',
    },
    {
      ...text('subtitle', 'subtitle', subtitle, 8, 28, 42, 6, 16),
      textAlign: 'left',
    },
    {
      ...button(
        'save',
        'save',
        formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText281'),
        8,
        66,
        30,
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
      8,
      42,
      30,
      9,
      choiceColor,
      choiceTextColor,
      true,
    ),
    button(
      'flow-overview',
      'flowOverview',
      language === 'zh' ? '流程图总览' : language === 'ja' ? 'フロー概要' : 'Flow overview',
      8,
      82,
      14,
      7,
      choiceColor,
      choiceTextColor,
    ),
    button(
      'new',
      'new',
      formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText295'),
      8,
      54,
      30,
      9,
      choiceColor,
      choiceTextColor,
    ),
    button(
      'settings',
      'settings',
      formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText306'),
      24,
      82,
      14,
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
    const isUtility = element.role === 'flowOverview' || element.role === 'settings';
    return {
      ...element,
      primary: isPrimary,
      fontSize: isUtility ? 15 : 18,
      fontWeight: 700,
      textAlign: 'center',
      textColor: isPrimary ? '#ffffff' : isUtility ? '#334155' : startMenuText,
      backgroundType: 'solid' as const,
      backgroundColor: isPrimary ? startMenuAccent : '#FFFFFF',
      backgroundGradientStart: startMenuAccent,
      backgroundGradientEnd: startMenuAccentDark,
      backgroundGradientAngle: 135,
      backgroundGradientShape: 'linear' as const,
      backgroundGradientStops: [
        { id: `${element.id}-start`, color: startMenuAccent, alpha: 100, position: 0 },
        { id: `${element.id}-end`, color: startMenuAccentDark, alpha: 100, position: 100 },
      ],
      borderColor: isPrimary ? startMenuAccentDark : 'rgba(15,23,42,0.28)',
      borderWidth: isPrimary ? 1.5 : 1,
      borderRadius: isUtility ? 999 : 16,
      shadowColor: '#0f172a',
      shadowOpacity: isPrimary ? 18 : 12,
      shadowBlur: isPrimary ? 24 : 16,
      shadowOffsetY: isPrimary ? 8 : 6,
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

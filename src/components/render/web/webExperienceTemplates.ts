import { placementGeometry } from './webElementPlacement';
import { playerControlCatalog } from './playerSettingsPanelConfig';
import { buttonMotionForPreset } from './webButtonMotion';
import { formatWebText } from './i18n';
import type { Language } from '../../../lib/i18n';
import type { RenderStyle, WebExportSettings, WebMenuElement } from '../video/shared/types';
import { getWebSettingsCopy } from './i18n';
import { decorateWebPageElements, defaultWebTheme, SETTINGS_BACKGROUND_STYLE } from './webThemeVisuals';

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

const pagePanel = (id: string, width = 62): WebMenuElement => ({
  id, kind: 'shape', shapeType: 'rounded', role: 'custom', text: '页面底板', visible: true,
  x: 5, y: 5, width, height: 94, scale: 1, rotation: 0,
  backgroundType: 'solid', backgroundColor: '#f8fafff5', borderColor: '#e0e5ef', borderWidth: 1, borderRadius: 24,
  shadowColor: '#252a59', shadowOpacity: 8, shadowBlur: 32, shadowOffsetY: 8,
});

export const buildRehearsalArchivePageElements = (
  language: Language,
  choiceColor: string,
  choiceTextColor: string,
): WebMenuElement[] => {
  const settingsCopy = getWebSettingsCopy(language);
  return decorateWebPageElements([
    { ...pagePanel('archive-panel', 90), shapeType: 'rectangle' as const, zIndex: -1, strokeEnabled: false, shadowEnabled: false },
    text(
      'archive-title',
      'title',
      formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText92'),
      8,
      8,
      44,
      8,
      40,
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
        18,
        56,
        5,
        18,
      ),
      textAlign: 'left' as const,
    },
    button(
      'archive-back',
      'back',
      settingsCopy.backToMainMenu,
      84,
      9,
      8,
      7,
      choiceColor,
      choiceTextColor,
    ),
    button(
      'archive-slot',
      'slot',
      formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText107'),
      8,
      33,
      84,
      60,
      choiceColor,
      choiceTextColor,
    ),
    {
      ...text('archive-progress-heading', 'custom', language === 'zh' ? '你的阅读进度' : language === 'ja' ? '保存した進行状況' : 'Your reading progress', 8, 26, 56, 5, 22),
      textColor: '#252a59', fontWeight: 700, textAlign: 'left' as const,
    },
  ].map((element) => {
    if (element.role === 'title') return { ...element, textColor: '#252a59', textAlign: 'left' };
    if (element.role === 'subtitle')
      return { ...element, textColor: '#68719a', fontWeight: 600, textAlign: 'left' };
    if (element.kind !== 'button') return element;
    const primary = element.role === 'slotContinue';
    return {
      ...element,
      primary,
      fontSize: element.role === 'slot' ? 20 : 18,
      textColor: primary ? '#ffffff' : '#334155',
      backgroundColor: primary ? '#625bf6' : element.role === 'back' || element.role === 'new' ? '#eef2ff' : '#ffffff',
      borderColor: primary ? '#4f46c5' : '#e0e5ef',
      borderWidth: primary ? 1.5 : 1,
      borderRadius: 14,
      shadowColor: '#0f172a',
      shadowOpacity: primary ? 14 : 4,
      shadowBlur: primary ? 20 : 10,
      shadowOffsetY: primary ? 6 : 2,
    };
  }), defaultWebTheme).map((element) => ({
    ...element, archiveLayoutVersion: 1,
    ...(element.id === 'archive-panel' ? SETTINGS_BACKGROUND_STYLE : {}),
    ...(element.role === 'slot' ? { fillEnabled: false, strokeEnabled: false, shadowEnabled: false, borderWidth: 0, appearance: undefined, buttonMotion: buttonMotionForPreset('none') } : {}),
  }));
};

export const buildRehearsalSettingsPageElements = (
  language: Language,
  choiceColor: string,
  choiceTextColor: string,
): WebMenuElement[] => {
  const positions: Record<string, [number, number, number, number]> = {
    preview: [8, 25, 66, 14],
    mode: [8, 52, 26, 10],
    speed: [8, 66, 26, 13],
    textSize: [8, 82, 26, 17],
    auto: [68, 52, 24, 10],
    sound: [38, 52, 26, 10],
    controls: [68, 64, 24, 10],
    animationSpeed: [68, 76, 24, 13],
    reset: [76, 92, 16, 7],
    musicVolume: [38, 66, 26, 13],
    voiceVolume: [38, 82, 26, 13],
  };
  return decorateWebPageElements([
    {
      ...pagePanel('settings-background', 90),
      shapeType: 'rectangle' as const, text: language === 'zh' ? '设置背景' : language === 'ja' ? '設定の背景' : 'Settings background',
      zIndex: -1, borderRadius: 0, strokeEnabled: false, shadowEnabled: false,
    },
    text(
      'settings-title',
      'title',
      formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText192'),
      8,
      8,
      30,
      8,
      40,
    ),
    button(
      'settings-back',
      'back',
      formatWebText(language, 'componentsrenderwebwebExperienceTemplatesText196'),
      84,
      9,
      8,
      7,
      choiceColor,
      choiceTextColor,
    ),
    {
      ...text('settings-intro', 'custom', language === 'zh' ? '按照你的节奏，享受这个故事。' : language === 'ja' ? '自分のペースで物語を楽しもう。' : 'Enjoy the story at your own pace.', 8, 18, 56, 5, 18),
      textColor: '#59637d',
      textAlign: 'left' as const,
    },
    ...(['reading', 'playback', 'effects'] as const).map((group, index) => ({
      ...text(`settings-${group}-heading`, 'custom', language === 'zh' ? ['文字', '语音', '动效'][index] : language === 'ja' ? ['文字', '音声', '演出'][index] : ['Text', 'Audio', 'Effects'][index], [8, 38, 68][index], 46, 26, 4, 22),
      textColor: '#252a59', fontWeight: 700, textAlign: 'left' as const,
    })),
    ...[36, 66].map((x, index): WebMenuElement => ({
      id: `settings-divider-${index}`, kind: 'shape', shapeType: 'line', role: 'custom', text: '', visible: true, scale: 1,
      ...placementGeometry({ kind: 'shape', shapeType: 'line' }, { x, y: 46 }, { x, y: 98 }, 1920, 1080),
      fillEnabled: false, strokeEnabled: true, borderColor: '#c4c8dc', borderWidth: 1.5, shadowEnabled: false,
    })),
    ...playerControlCatalog(language).map(({ id, label, forms }) => ({
      ...button(`settings-${id}`, id, label, ...positions[id], choiceColor, choiceTextColor),
      fontSize: id === 'reset' ? 18 : 20,
      textAlign: id === 'reset' ? 'center' as const : 'left' as const,
      textColor: id === 'reset' ? '#4f46e5' : '#334155',
      backgroundColor: id === 'reset' ? '#eef2ff' : '#ffffff',
      borderColor: id === 'reset' ? '#c7d2fe' : '#e0e5ef',
      borderWidth: 1,
      borderRadius: id === 'reset' ? 12 : 14,
      shadowColor: '#0f172a',
      shadowOpacity: id === 'reset' ? 8 : 4,
      shadowBlur: id === 'reset' ? 14 : 10,
      shadowOffsetY: id === 'reset' ? 4 : 2,
      settingsControlForm: forms[0],
    })),
  ].map((element) =>
    element.role === 'title' ? { ...element, textColor: '#252a59', textAlign: 'left' } : element.role === 'back' ? { ...element, textColor: '#4338ca', backgroundColor: '#eef2ff', borderColor: '#c7d2fe', fontSize: 18, textAlign: 'center' } : element,
  ), defaultWebTheme).map((element) => ({
    ...element,
    settingsLayoutVersion: 8,
    borderRadius: element.kind === 'button' && ['back', 'reset'].includes(element.role || '') ? defaultWebTheme.radius : 0,
    ...(element.id === 'settings-background' ? SETTINGS_BACKGROUND_STYLE : {}),
    ...(element.shapeType === 'line' ? { fillEnabled: false, strokeEnabled: true, borderColor: '#c4c8dc', borderWidth: 1.5, shadowEnabled: false } : {}),
    ...(element.kind === 'button' && !['back', 'reset'].includes(element.role || '')
      ? { buttonMotion: buttonMotionForPreset('none'), fillEnabled: false, strokeEnabled: false, shadowEnabled: false, borderWidth: 0,
          backgroundType: 'solid' as const, backgroundColor: 'transparent', appearance: undefined }
      : {}),
  }));
};

export const buildRehearsalFlowPageElements = (language: Language): WebMenuElement[] =>
  decorateWebPageElements([
    buildFlowOverviewHomeElement(),
    { ...text('flow-title', 'custom', language === 'zh' ? '流程图总览' : language === 'ja' ? 'フロー概要' : 'Story overview', 8, 5, 44, 7, 36), textAlign: 'left', fontWeight: 700 },
    { ...text('flow-subtitle', 'subtitle', language === 'zh' ? '循着故事的线索，回看每一次选择' : language === 'ja' ? '物語の道をたどり、選択を振り返ろう' : 'Trace your journey and revisit each choice', 8, 13, 58, 4, 18), textAlign: 'left' },
    ...(['flowDirection', 'flowFitView'] as const).map((role, index) => ({
      ...button(index === 0 ? 'flow-direction-control' : 'flow-fit-view-control', role, '', 84 + index * 4, 5, 2.588, 4.6, defaultWebTheme.accent, '#fff'),
      textVisible: false, borderRadius: 999,
    })),
    { ...button('flow-minimap', 'flowMinimap', '', 79, 75, 19, 21, defaultWebTheme.accent, '#fff'), textVisible: false },
  ]);

/** Only upgrade the untouched default grid; authored layouts remain authoritative. */
export const isPreviousRehearsalSettingsLayout = (elements: WebMenuElement[] | undefined) => {
  const positions: Record<string, [number, number, number, number]> = {
    title: [8, 16, 48, 10], back: [8, 29, 14, 7],
    mode: [8, 42, 26, 11], speed: [8, 56, 26, 15], textSize: [8, 74, 26, 15],
    preview: [8, 91, 26, 8], auto: [38, 42, 26, 11], animationSpeed: [38, 56, 26, 15],
    sound: [38, 74, 26, 11], controls: [38, 88, 26, 8], reset: [72, 88, 16, 8],
  };
  return elements?.length === Object.keys(positions).length && Object.entries(positions).every(([role, [x, y, width, height]]) => {
    const element = elements.find((item) => item.id === `settings-${role}`);
    return element?.x === x && element.y === y && element.width === width && element.height === height;
  });
};

export const isPreviousRehearsalArchiveLayout = (elements: WebMenuElement[] | undefined) => {
  const positions: Record<string, [number, number, number, number]> = {
    title: [8, 16, 30, 10], subtitle: [8, 28, 30, 5], back: [8, 35, 14, 7], slot: [8, 45, 30, 13],
    'slot-continue': [8, 60, 20, 7], 'slot-delete': [30, 60, 8, 7], new: [8, 70, 30, 9],
  };
  return elements?.length === Object.keys(positions).length && Object.entries(positions).every(([role, [x, y, width, height]]) => {
    const element = elements.find((item) => item.id === `archive-${role}`);
    return element?.x === x && element.y === y && element.width === width && element.height === height;
  });
};

import { arrangeToolbarRow } from './webToolbarLayout';

export const buildFlowOverviewHomeElement = (
  canvasWidth = 1920,
  canvasHeight = 1080,
): WebMenuElement => ({
  ...buildRehearsalToolbarElements('en', canvasWidth, canvasHeight).find(
    (element) => element.role === 'mainMenu',
  )!,
  id: 'flow-main-menu',
  text: '',
  x: 2,
  y: 2.4,
  backgroundColor: '#f1f5f9',
  textColor: '#475569',
});

export const buildRehearsalToolbarElements = (
  language: Language,
  canvasWidth = 1920,
  canvasHeight = 1080,
): WebMenuElement[] => {
  const toolbarShadow = {
    shadowEnabled: true,
    shadowColor: '#0f172a',
    shadowOpacity: 14,
    shadowBlur: 14,
    shadowOffsetX: 0,
    shadowOffsetY: 6,
    shadows: [
      {
        id: 'toolbar-control-shadow',
        type: 'outer' as const,
        color: '#0f172a',
        opacity: 14,
        blur: 14,
        offsetX: 0,
        offsetY: 6,
      },
    ],
  };
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
    ...toolbarShadow,
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
  const withBuiltInShadow = (element: WebMenuElement, fallback: WebMenuElement) => {
    const hasShadowData =
      element.shadowColor !== undefined ||
      element.shadowOpacity !== undefined ||
      element.shadowBlur !== undefined ||
      element.shadowOffsetX !== undefined ||
      element.shadowOffsetY !== undefined ||
      Boolean(element.shadows?.length);
    return hasShadowData || element.shadowEnabled !== undefined
      ? element
      : {
          ...element,
          shadowEnabled: fallback.shadowEnabled,
          shadowColor: fallback.shadowColor,
          shadowOpacity: fallback.shadowOpacity,
          shadowBlur: fallback.shadowBlur,
          shadowOffsetX: fallback.shadowOffsetX,
          shadowOffsetY: fallback.shadowOffsetY,
          shadows: fallback.shadows,
        };
  };
  const withBuiltInDefaults = (values: WebMenuElement[]) =>
    values.map((element) => {
      const fallback = defaults.find((candidate) => candidate.id === element.id);
      return fallback && builtInIds.has(element.id)
        ? withBuiltInShadow(element, fallback)
        : element;
    });
  const isLegacyRow =
    elements.some((element) => builtInIds.has(element.id)) &&
    (!elements.some((element) => element.id === 'toolbar-auto') ||
      elements.some((element) => builtInIds.has(element.id) && element.toolbarLayoutVersion !== 2));
  if (isLegacyRow) {
    const row = defaults.map((fallback) => {
      const previous = elements.find((element) => element.id === fallback.id);
      if (!previous) return fallback;
      return withBuiltInShadow({
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
      }, fallback);
    });
    return arrangeToolbarRow(
      [...row, ...elements.filter((element) => !builtInIds.has(element.id))],
      canvasWidth,
      canvasHeight,
    );
  }
  if (elements.some((element) => element.role === 'history'))
    return withBuiltInDefaults(elements);
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
        return withBuiltInDefaults([...elements, candidate]);
      }
    }
  }
  return withBuiltInDefaults([...elements, candidate]);
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
      flowOverviewElements: buildRehearsalFlowPageElements(language),
      menuTheme: defaultWebTheme,
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

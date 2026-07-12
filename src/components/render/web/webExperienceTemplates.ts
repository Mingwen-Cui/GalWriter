import type { Language } from '../../../lib/i18n';
import { renderCopy } from '../video/shared/renderCopy';
import type { RenderStyle, WebExportSettings, WebMenuElement } from '../video/shared/types';

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
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  return [
    text('archive-title', 'title', t('存档', 'セーブ', 'Save'), 10, 8, 32, 8, 28),
    button(
      'archive-back',
      'back',
      t('返回', '戻る', 'Back'),
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
      t(
        '没有存档\n导出后的网页会在这里显示上次进度。',
        'セーブなし\n書き出し後のWebでは前回の進行がここに表示されます。',
        'No save\nExported web builds show the last progress here.',
      ),
      24,
      40,
      52,
      15,
      choiceColor,
      choiceTextColor,
    ),
    button(
      'archive-new',
      'new',
      t('新游戏', '新規ゲーム', 'New Game'),
      24,
      59,
      52,
      9,
      choiceColor,
      choiceTextColor,
      true,
    ),
  ];
};

export const buildRehearsalSettingsPageElements = (
  language: Language,
  choiceColor: string,
  choiceTextColor: string,
): WebMenuElement[] => {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  return [
    text('settings-title', 'title', t('设置', '設定', 'Settings'), 10, 8, 32, 8, 28),
    button(
      'settings-back',
      'back',
      t('返回', '戻る', 'Back'),
      78,
      8,
      14,
      7,
      choiceColor,
      choiceTextColor,
    ),
    button(
      'settings-auto',
      'auto',
      t('自动播放', '自動再生', 'Auto play'),
      24,
      37,
      52,
      9,
      choiceColor,
      choiceTextColor,
    ),
    button(
      'settings-speed',
      'speed',
      t('打字速度', 'テキスト速度', 'Text speed'),
      24,
      50,
      52,
      11,
      choiceColor,
      choiceTextColor,
    ),
    button(
      'settings-controls',
      'controls',
      t('显示控制栏', '操作表示', 'Show controls'),
      24,
      65,
      52,
      9,
      choiceColor,
      choiceTextColor,
      true,
    ),
  ];
};

export const buildRehearsalToolbarElements = (language: Language): WebMenuElement[] => {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
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
    borderRadius: 8,
  });
  return [
    toolbarButton('toolbar-audio', 'audio', t('音频', '音声', 'Audio'), 57.2, 8.4),
    toolbarButton('toolbar-fullscreen', 'fullscreen', t('最大化', '最大化', 'Max'), 66.4, 9.8),
    toolbarButton('toolbar-return', 'return', t('返回', '戻る', 'Back'), 77.2, 8.4),
    toolbarButton('toolbar-main', 'mainMenu', t('主界面', 'メニュー', 'Menu'), 86.4, 9.6),
    {
      ...button(
        'toolbar-controls-toggle',
        'controlsToggle',
        '',
        92,
        84,
        4.4,
        5.2,
        '#0ea5e9',
        '#ffffff',
      ),
      fontSize: 12,
      backgroundColor: 'rgba(0,0,0,0.35)',
      borderRadius: 999,
    },
  ];
};

export const buildRehearsalStartMenuElements = (
  language: Language,
  title: string,
  choiceColor: string,
  choiceTextColor: string,
): WebMenuElement[] => {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  return [
    text('title', 'title', title || t('开始', 'スタート', 'Start'), 22, 29, 56, 11, 32),
    text('subtitle', 'subtitle', t('没有存档', 'セーブなし', 'No save'), 22, 42, 56, 5, 14),
    {
      ...button(
        'save',
        'save',
        t('存档', 'セーブ', 'Save'),
        33,
        59,
        34,
        9,
        choiceColor,
        choiceTextColor,
        true,
      ),
      disabled: true,
    },
    button(
      'new',
      'new',
      t('新游戏', '新規ゲーム', 'New Game'),
      33,
      70,
      34,
      9,
      choiceColor,
      choiceTextColor,
    ),
    button(
      'settings',
      'settings',
      t('设置', '設定', 'Settings'),
      33,
      81,
      34,
      9,
      choiceColor,
      choiceTextColor,
    ),
  ];
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
    name: renderCopy(language, '排练模板', 'リハーサル', 'Rehearsal'),
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

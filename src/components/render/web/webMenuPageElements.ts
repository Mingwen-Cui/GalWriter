import type { PlayerControlId } from './playerSettingsPanelConfig';
import type { Language } from '../../../lib/i18n';
import type { WebExportSettings, WebMenuElement } from '../video/shared/types';
import {
  buildRehearsalArchivePageElements,
  buildRehearsalSettingsPageElements,
  isPreviousRehearsalSettingsLayout,
  isPreviousRehearsalArchiveLayout,
} from './webExperienceTemplates';

export const buildArchivePageElements = (
  language: Language,
  choiceColor: string,
  choiceTextColor: string,
): WebMenuElement[] => {
  return buildRehearsalArchivePageElements(language, choiceColor, choiceTextColor);
};

export const buildSettingsPageElements = (
  language: Language,
  choiceColor: string,
  choiceTextColor: string,
): WebMenuElement[] => {
  return buildRehearsalSettingsPageElements(language, choiceColor, choiceTextColor);
};

export const resolveArchivePageElements = (settings: Partial<WebExportSettings>, language: Language, choiceColor: string, choiceTextColor: string) => {
  const defaults = buildArchivePageElements(language, choiceColor, choiceTextColor);
  if (isPreviousRehearsalArchiveLayout(settings.archivePageElements)) return defaults.map((fallback) => {
    const previous = settings.archivePageElements?.find((element) => element.id === fallback.id);
    return previous ? { ...fallback, visible: previous.visible, disabled: previous.disabled, text: previous.text, ...(previous.appearance ? { appearance: previous.appearance } : {}) } : fallback;
  });
  return settings.archivePageElements?.length ? settings.archivePageElements : defaults;
};

/** Resolve old grouped-page settings once; authored element arrays (including empty ones) are authoritative. */
export const resolveSettingsPageElements = (
  settings: Partial<WebExportSettings>,
  language: Language,
  choiceColor: string,
  choiceTextColor: string,
): WebMenuElement[] => {
  if (isPreviousRehearsalSettingsLayout(settings.settingsPageElements)) {
    return buildSettingsPageElements(language, choiceColor, choiceTextColor).map((fallback) => {
      const previous = settings.settingsPageElements?.find((element) => element.id === fallback.id);
      if (!previous) return fallback;
      const oldLabels: Record<string, string[]> = {
        mode: ['文字呈现', 'Text display', '文字の表示'],
        speed: ['打字间隔', 'Typing interval', '文字の表示間隔'],
        auto: ['自动翻页', 'Auto advance', '自動ページ送り'],
        controls: ['显示控制栏', 'Show toolbar', '操作バーを表示'],
        reset: ['恢复默认', 'Restore defaults', '初期設定に戻す'],
      };
      const oldSize = previous.role === 'title' ? 42 : previous.role === 'back' ? 14 : previous.role === 'reset' ? 13 : 15;
      return {
        ...previous,
        x: fallback.x, y: fallback.y, width: fallback.width, height: fallback.height,
        text: oldLabels[previous.role || '']?.includes(previous.text) ? fallback.text : previous.text,
        fontSize: previous.fontSize === oldSize ? fallback.fontSize : previous.fontSize,
        ...(previous.role === 'back' && previous.textColor === '#f8fafc' ? { textColor: fallback.textColor, backgroundColor: fallback.backgroundColor, borderColor: fallback.borderColor, textAlign: fallback.textAlign } : {}),
        ...(previous.borderColor === 'rgba(15,23,42,0.28)' ? { borderColor: fallback.borderColor } : {}),
        ...(previous.shadowOpacity === 12 ? { shadowOpacity: fallback.shadowOpacity, shadowBlur: fallback.shadowBlur, shadowOffsetY: fallback.shadowOffsetY } : {}),
      };
    });
  }
  if (settings.settingsPageElementsInitialized) return settings.settingsPageElements || [];
  const defaults = buildSettingsPageElements(language, choiceColor, choiceTextColor);
  const source = settings.settingsPageElements?.length ? settings.settingsPageElements : defaults;
  return source.flatMap((element) => {
    const role = element.role;
    const config = settings.playerSettingsPanel?.controls?.[role as PlayerControlId];
    if (config?.state === 'removed') return [];
    const fallback = defaults.find((item) => item.role === role);
    const legacyRow =
      element.kind === 'button' && element.x === 28 && element.width === 44 && element.height === 6;
    return [
      {
        ...element,
        ...(legacyRow && fallback
          ? { x: fallback.x, y: fallback.y, width: fallback.width, height: fallback.height }
          : {}),
        visible: config?.state ? config.state === 'visible' : element.visible,
        settingsControlForm:
          element.settingsControlForm || config?.form || fallback?.settingsControlForm,
      },
    ];
  });
};

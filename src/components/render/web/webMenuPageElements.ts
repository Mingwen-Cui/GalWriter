import type { PlayerControlId } from './playerSettingsPanelConfig';
import type { Language } from '../../../lib/i18n';
import type { WebExportSettings, WebMenuElement } from '../video/shared/types';
import {
  buildRehearsalArchivePageElements,
  buildRehearsalSettingsPageElements,
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

/** Resolve old grouped-page settings once; authored element arrays (including empty ones) are authoritative. */
export const resolveSettingsPageElements = (
  settings: Partial<WebExportSettings>,
  language: Language,
  choiceColor: string,
  choiceTextColor: string,
): WebMenuElement[] => {
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

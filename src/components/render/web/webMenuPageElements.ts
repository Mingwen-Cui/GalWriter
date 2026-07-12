import type { Language } from '../../../lib/i18n';
import type { WebMenuElement } from '../video/shared/types';
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

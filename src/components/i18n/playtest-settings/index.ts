import type { Language } from '../../../lib/i18n';
import { playtestSettingsEn } from './en';
import { playtestSettingsJa } from './ja';
import { playtestSettingsZh } from './zh';

type PlaytestSettingsDictionary = { [Key in keyof typeof playtestSettingsEn]: string };

const dictionaries: Record<Language, PlaytestSettingsDictionary> = {
  zh: playtestSettingsZh,
  ja: playtestSettingsJa,
  en: playtestSettingsEn,
};

export const playtestSettingsCopy = (language: Language) => dictionaries[language];

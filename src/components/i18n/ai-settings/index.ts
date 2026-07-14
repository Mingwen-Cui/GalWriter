import type { Language } from '../../../lib/i18n';
import { aiSettingsEn } from './en';
import { aiSettingsJa } from './ja';
import { aiSettingsZh } from './zh';

type Dictionary = { [Key in keyof typeof aiSettingsEn]: string };

const dictionaries: Record<Language, Dictionary> = {
  en: aiSettingsEn,
  ja: aiSettingsJa,
  zh: aiSettingsZh,
};

export const aiSettingsCopy = (language: Language) => dictionaries[language];

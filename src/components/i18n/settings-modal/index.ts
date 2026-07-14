import type { Language } from '../../../lib/i18n';
import { settingsModalEn } from './en';
import { settingsModalJa } from './ja';
import { settingsModalZh } from './zh';

type LocalizedDictionary<Value> = {
  [Key in keyof Value]: Value[Key] extends string ? string : Value[Key];
};

type SettingsModalDictionary = LocalizedDictionary<typeof settingsModalEn>;

const dictionaries: Record<Language, SettingsModalDictionary> = {
  zh: settingsModalZh,
  ja: settingsModalJa,
  en: settingsModalEn,
};

export const settingsModalCopy = (language: Language) => dictionaries[language] || settingsModalEn;

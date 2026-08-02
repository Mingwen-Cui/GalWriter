import type { Language } from '../../../lib/i18n';
import { exportQuickMenuEn } from './en';
import { exportQuickMenuJa } from './ja';
import { exportQuickMenuZh } from './zh';

type ExportQuickMenuDictionary = {
  [Key in keyof typeof exportQuickMenuEn]: string;
};

const dictionaries: Record<Language, ExportQuickMenuDictionary> = {
  zh: exportQuickMenuZh,
  ja: exportQuickMenuJa,
  en: exportQuickMenuEn,
};

export const exportQuickMenuCopy = (language: Language) =>
  dictionaries[language] || exportQuickMenuEn;

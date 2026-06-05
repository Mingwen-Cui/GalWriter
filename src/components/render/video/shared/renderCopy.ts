import type { Language } from '../../../../lib/i18n';

export const renderCopy = (language: Language, zh: string, ja: string, en: string) => {
  if (language === 'zh') return zh;
  if (language === 'ja') return ja;
  return en;
};

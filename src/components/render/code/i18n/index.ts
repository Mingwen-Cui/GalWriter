import type { Language } from '../../../../lib/i18n';
import { codeEn } from './en';
import { codeJa } from './ja';
import { codeZh } from './zh';

export type CodeTextKey = keyof typeof codeEn;
export const getCodeText = (language: Language, key: CodeTextKey) =>
  (language === 'zh' ? codeZh : language === 'ja' ? codeJa : codeEn)[key];

export const formatCodeText = (
  language: Language,
  key: CodeTextKey,
  values: Record<string, string | number>,
) =>
  Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    getCodeText(language, key),
  );

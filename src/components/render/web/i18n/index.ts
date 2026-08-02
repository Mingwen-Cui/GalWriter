import type { Language } from '../../../../lib/i18n';

import {
  webSettingsCopy as enSettings,
  webText as enText,
  webStructuredText as enStructuredText,
} from './en';
import {
  webSettingsCopy as jaSettings,
  webText as jaText,
  webStructuredText as jaStructuredText,
} from './ja';
import {
  webSettingsCopy as zhSettings,
  webText as zhText,
  webStructuredText as zhStructuredText,
} from './zh';

export const getWebSettingsCopy = (language: Language) =>
  language === 'ja' ? jaSettings : language === 'en' ? enSettings : zhSettings;

const webTextByLanguage = { zh: zhText, ja: jaText, en: enText };
export type WebTextKey = keyof typeof enText;

export const getWebText = (language: Language, key: WebTextKey) => webTextByLanguage[language][key];

export const formatWebText = (
  language: Language,
  key: WebTextKey,
  ...values: Array<string | number>
) =>
  getWebText(language, key).replace(/\{(\d+)\}/g, (_, index) =>
    String(values[Number(index)] ?? ''),
  );

export const getWebShadowOrdinal = (language: Language, index: number) =>
  language === 'zh'
    ? ['', '一', '二', '三', '四', '五'][index] || String(index + 1)
    : ` ${index + 1}`;

const structuredTextByLanguage = {
  zh: zhStructuredText,
  ja: jaStructuredText,
  en: enStructuredText,
};
export type WebStructuredTextKey = keyof typeof enStructuredText;

export const getWebStructuredText = <Key extends WebStructuredTextKey>(
  language: Language,
  key: Key,
): (typeof enStructuredText)[Key] =>
  structuredTextByLanguage[language][key] as (typeof enStructuredText)[Key];

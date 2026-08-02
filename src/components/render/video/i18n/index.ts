import type { Language } from '../../../../lib/i18n';
import type { TextAnimation } from '../shared/types';

import { videoEn, videoStructuredText as enStructuredText } from './en';
import { videoJa, videoStructuredText as jaStructuredText } from './ja';
import { videoZh, videoStructuredText as zhStructuredText } from './zh';

const videoTextByLanguage = { zh: videoZh, ja: videoJa, en: videoEn };
export type VideoTextKey = keyof typeof videoEn;

export const getVideoText = (language: Language, key: VideoTextKey) =>
  videoTextByLanguage[language][key];

export const formatVideoText = (
  language: Language,
  key: VideoTextKey,
  ...values: Array<string | number>
) =>
  getVideoText(language, key).replace(/\{(\d+)\}/g, (_, index) =>
    String(values[Number(index)] ?? ''),
  );

export const getVideoTextForChinesePreference = (
  isZh: boolean,
  key: VideoTextKey,
  ...values: Array<string | number>
) => formatVideoText(isZh ? 'zh' : 'en', key, ...values);

export const getVideoTextAnimationOptions = (
  language: Language,
): Array<{
  value: TextAnimation;
  label: string;
}> => [
  { value: 'none', label: getVideoText(language, 'textAnimationNone') },
  { value: 'fade', label: getVideoText(language, 'textAnimationFade') },
  { value: 'slideUp', label: getVideoText(language, 'textAnimationSlideUp') },
  { value: 'typewriter', label: getVideoText(language, 'textAnimationTypewriter') },
];

const structuredTextByLanguage = {
  zh: zhStructuredText,
  ja: jaStructuredText,
  en: enStructuredText,
};
export type VideoStructuredTextKey = keyof typeof enStructuredText;

export const getVideoStructuredText = <Key extends VideoStructuredTextKey>(
  language: Language,
  key: Key,
): (typeof enStructuredText)[Key] =>
  structuredTextByLanguage[language][key] as (typeof enStructuredText)[Key];

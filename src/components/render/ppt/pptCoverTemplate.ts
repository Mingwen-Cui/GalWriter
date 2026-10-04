import type { PptTextOverrideTarget } from '../video/shared/types';
import type { Language } from '../../../lib/i18n';

export const PPT_DEFAULT_COVER_TITLE = '故事，\n从这里开始';
export const PPT_DEFAULT_COVER_DESCRIPTION = '每一次选择，\n都通向属于你的故事。';

export const getPptCoverSubtitle = (language: Language = 'zh') =>
  language === 'zh' ? '互动叙事作品 · GalWriter'
    : language === 'ja' ? 'インタラクティブストーリー · GalWriter'
      : 'An interactive story · GalWriter';

export const getPptCoverDescription = (language: Language = 'zh') =>
  language === 'zh' ? PPT_DEFAULT_COVER_DESCRIPTION
    : language === 'ja' ? '選ぶたびに、\nあなたの物語が広がる。'
      : 'Every choice opens\na story of your own.';

export const getPptCoverTitle = (projectName: string, fallback: string, language: Language = 'zh') => {
  const name = projectName.trim();
  const title = language === 'zh' ? PPT_DEFAULT_COVER_TITLE
    : language === 'ja' ? 'ここから、\n物語が始まる。' : 'Your story\nstarts here.';
  return !name || name === '开始' ? title : name || fallback;
};

export const getPptCoverText = (
  target: Extract<PptTextOverrideTarget, 'cover-title' | 'cover-subtitle' | 'cover-description'>,
  projectName: string,
  generatedBy: string,
  fallbackTitle: string,
  language: Language = 'zh',
) => {
  if (target === 'cover-title') return getPptCoverTitle(projectName, fallbackTitle, language);
  if (target === 'cover-description') return getPptCoverDescription(language);
  return generatedBy;
};

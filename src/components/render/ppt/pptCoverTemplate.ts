import type { PptTextOverrideTarget } from '../video/shared/types';

export const PPT_DEFAULT_COVER_TITLE = '静夜未眠';
export const PPT_DEFAULT_COVER_DESCRIPTION = '一款由选择驱动的 Galgame 互动叙事游戏';

export const getPptCoverTitle = (projectName: string, fallback: string) => {
  const name = projectName.trim();
  return !name || name === '开始' ? PPT_DEFAULT_COVER_TITLE : name || fallback;
};

export const getPptCoverText = (
  target: Extract<PptTextOverrideTarget, 'cover-title' | 'cover-subtitle' | 'cover-description'>,
  projectName: string,
  generatedBy: string,
  fallbackTitle: string,
) => {
  if (target === 'cover-title') return getPptCoverTitle(projectName, fallbackTitle);
  if (target === 'cover-description') return PPT_DEFAULT_COVER_DESCRIPTION;
  return generatedBy;
};

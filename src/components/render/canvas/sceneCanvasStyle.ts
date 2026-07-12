import type { CSSProperties } from 'react';

import type { SharedCanvasSettings } from './canvasSettings';

export const getSceneBackgroundStyle = (settings: SharedCanvasSettings): CSSProperties => {
  if (!settings.sceneBackgroundVisible) return { background: 'transparent' };
  if (settings.sceneBackgroundType === 'image' && settings.sceneBackgroundImageUrl) {
    return { background: `center / cover no-repeat url("${settings.sceneBackgroundImageUrl.replace(/"/g, '\\"')}")` };
  }
  if (settings.sceneBackgroundType === 'gradient') {
    return { background: `linear-gradient(${settings.sceneBackgroundGradientAngle}deg, ${settings.sceneBackgroundGradientStart}, ${settings.sceneBackgroundGradientEnd})` };
  }
  return { background: settings.sceneBackgroundColor };
};

export const mergeSceneMediaStyle = (
  base: CSSProperties,
  settings: SharedCanvasSettings,
): CSSProperties => ({
  ...base,
  objectFit: settings.sceneFit === 'stretch' ? 'fill' : settings.sceneFit,
  objectPosition: `${50 + settings.sceneOffsetX / 2}% ${50 + settings.sceneOffsetY / 2}%`,
  transform: [base.transform === 'none' ? '' : base.transform, `scale(${settings.sceneScale / 100})`]
    .filter(Boolean)
    .join(' ') || 'none',
});

import type { RenderStyle, VideoTextScaleMode } from './types';

const WEB_RATIO_REFERENCE_HEIGHT = 720;

export const resolveVideoTextScale = (
  mode: VideoTextScaleMode,
  resolutionHeight: number,
) =>
  mode === 'webRatio'
    ? Math.max(0.25, Math.min(8, resolutionHeight / WEB_RATIO_REFERENCE_HEIGHT))
    : 1;

export const getVideoTextRenderStyle = (
  style: RenderStyle,
  mode: VideoTextScaleMode,
  resolutionHeight: number,
): RenderStyle => {
  const scale = resolveVideoTextScale(mode, resolutionHeight);
  if (scale === 1) return style;
  return {
    ...style,
    titleFontSize: Math.round(style.titleFontSize * scale),
    bodyFontSize: Math.round(style.bodyFontSize * scale),
    titleStrokeWidth: style.titleStrokeWidth * scale,
    bodyStrokeWidth: style.bodyStrokeWidth * scale,
    titleLetterSpacing: style.titleLetterSpacing * scale,
    bodyLetterSpacing: style.bodyLetterSpacing * scale,
  };
};

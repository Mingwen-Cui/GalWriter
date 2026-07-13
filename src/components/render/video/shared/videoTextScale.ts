import type { RenderStyle, VideoTextScaleMode } from './types';
import { getRenderObjects } from './renderObjects';

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
  const objects = getRenderObjects(style);
  const scale = resolveVideoTextScale(mode, resolutionHeight);
  const objectStyle: RenderStyle = {
    ...style,
    dialogVisible: objects.dialogBox.visible,
    dialogOffsetX: objects.dialogBox.x,
    dialogOffsetY: objects.dialogBox.y,
    dialogWidth: objects.dialogBox.width,
    dialogHeight: objects.dialogBox.height,
    dialogRadius: objects.dialogBox.radius,
    nameplateVisible: objects.nameplate.visible,
    nameplateOffsetX: objects.nameplate.x,
    nameplateOffsetY: objects.nameplate.y,
    nameplateScale: objects.nameplate.width,
    nameplateRadius: objects.nameplate.radius,
  };
  if (scale === 1) return objectStyle;
  return {
    ...objectStyle,
    titleFontSize: Math.round(objectStyle.titleFontSize * scale),
    bodyFontSize: Math.round(objectStyle.bodyFontSize * scale),
    titleStrokeWidth: objectStyle.titleStrokeWidth * scale,
    bodyStrokeWidth: objectStyle.bodyStrokeWidth * scale,
    titleLetterSpacing: objectStyle.titleLetterSpacing * scale,
    bodyLetterSpacing: objectStyle.bodyLetterSpacing * scale,
    nameplateFontSize: Math.round(objectStyle.nameplateFontSize * scale),
    nameplateOffsetX: objectStyle.nameplateOffsetX * scale,
    nameplateOffsetY: objectStyle.nameplateOffsetY * scale,
    nameplateRadius: objectStyle.nameplateRadius * scale,
  };
};

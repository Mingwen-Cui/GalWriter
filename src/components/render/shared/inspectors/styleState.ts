import type { RenderStyle, RenderEditableObjectKind, RenderEditableObject, RenderEditableTextObject } from '../../video/shared/types';
function syncLegacyFields(
  kind: RenderEditableObjectKind,
  object: RenderEditableObject | RenderEditableTextObject,
  updateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void,
) {
  if (kind === 'dialogBox') {
    updateRenderStyle('dialogVisible', object.visible);
    updateRenderStyle('dialogOffsetX', object.x);
    updateRenderStyle('dialogOffsetY', object.y);
    updateRenderStyle('dialogWidth', object.width);
    updateRenderStyle('dialogHeight', object.height);
    updateRenderStyle('dialogRadius', object.radius);
    updateRenderStyle('dialogBackgroundType', object.fill.type);
    updateRenderStyle('panelColor', object.fill.color);
    updateRenderStyle('panelColorAlpha', object.fill.alpha);
    updateRenderStyle('dialogGradientAngle', object.fill.gradientAngle);
    updateRenderStyle('dialogGradientStops', object.fill.gradientStops);
    updateRenderStyle('dialogImageUrl', object.fill.imageUrl);
  }
  if (kind === 'title' || kind === 'body') {
    const textObject = object as RenderEditableTextObject;
    const prefix = kind;
    if (kind === 'title') updateRenderStyle('titleVisible', textObject.visible);
    updateRenderStyle(`${prefix}FontFamily` as keyof RenderStyle, textObject.fontFamily as never);
    updateRenderStyle(`${prefix}FontSize` as keyof RenderStyle, textObject.fontSize as never);
    updateRenderStyle(`${prefix}Color` as keyof RenderStyle, textObject.fill.color as never);
    updateRenderStyle(`${prefix}ColorAlpha` as keyof RenderStyle, textObject.fill.alpha as never);
    updateRenderStyle(
      `${prefix}StrokeColor` as keyof RenderStyle,
      textObject.stroke.color as never,
    );
    updateRenderStyle(
      `${prefix}StrokeWidth` as keyof RenderStyle,
      textObject.stroke.width as never,
    );
    updateRenderStyle(`${prefix}Align` as keyof RenderStyle, textObject.textAlign as never);
    updateRenderStyle(
      `${prefix}LetterSpacing` as keyof RenderStyle,
      textObject.letterSpacing as never,
    );
    updateRenderStyle(`${prefix}LineHeight` as keyof RenderStyle, textObject.lineHeight as never);
    updateRenderStyle(
      `${prefix}Animation` as keyof RenderStyle,
      textObject.animation.animation as never,
    );
    updateRenderStyle(
      `${prefix}TypewriterMode` as keyof RenderStyle,
      textObject.animation.typewriterMode as never,
    );
  }
  if (kind === 'nameplate') {
    const textObject = object as RenderEditableTextObject;
    updateRenderStyle('nameplateVisible', textObject.visible);
    updateRenderStyle('nameplateOffsetX', textObject.x);
    updateRenderStyle('nameplateOffsetY', textObject.y);
    updateRenderStyle('nameplateScale', textObject.width);
    updateRenderStyle('nameplateRadius', textObject.radius);
    updateRenderStyle('nameplateFontFamily', textObject.fontFamily);
    updateRenderStyle('nameplateFontSize', textObject.fontSize);
    updateRenderStyle('nameplateTextColor', textObject.fill.color);
    updateRenderStyle('nameplateTextColorAlpha', textObject.fill.alpha);
    updateRenderStyle('nameplateBackgroundType', textObject.fill.type);
    updateRenderStyle('nameplateColor', textObject.fill.color);
    updateRenderStyle('nameplateColorAlpha', textObject.fill.alpha);
    updateRenderStyle('nameplateGradientAngle', textObject.fill.gradientAngle);
    updateRenderStyle('nameplateGradientStops', textObject.fill.gradientStops);
    updateRenderStyle('nameplateImageUrl', textObject.fill.imageUrl);
  }
}

/** Legacy scalar fields are derived for older renderers, never independently edited by inspectors. */
export function applyStylePatch<K extends keyof RenderStyle>(previous: RenderStyle, key: K, value: RenderStyle[K]): RenderStyle {
  const next = {...previous, [key]: value};
  if (key === 'renderObjects' && next.renderObjects) {
    for (const kind of ['dialogBox','title','body','nameplate'] as const) {
      syncLegacyFields(kind, next.renderObjects[kind], (field, fieldValue) => { Object.assign(next, {[field]: fieldValue}); });
    }
  }
  return next;
}

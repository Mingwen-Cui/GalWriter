import type {
  PptManualElement,
  PptManualElementWebStyle,
  PptTextBoxLayout,
  WebMenuElement,
} from '../video/shared/types';
import { PPT_CONTENT_HEIGHT, PPT_CONTENT_WIDTH } from './pptWorkspaceModel';

const toPercent = (value: number, axis: 'x' | 'y') =>
  (value / (axis === 'x' ? PPT_CONTENT_WIDTH : PPT_CONTENT_HEIGHT)) * 100;

const toCanvasValue = (value: number, axis: 'x' | 'y') =>
  Math.round((value / 100) * (axis === 'x' ? PPT_CONTENT_WIDTH : PPT_CONTENT_HEIGHT));

const omitUndefined = <T extends Record<string, unknown>>(value: T) =>
  Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;

const styleKeys = new Set<keyof PptManualElementWebStyle>([
  'primary',
  'disabled',
  'fontSize',
  'fontFamily',
  'fontWeight',
  'textColor',
  'textColorAlpha',
  'textColorType',
  'textGradientStart',
  'textGradientEnd',
  'textGradientAngle',
  'textGradientStops',
  'textBlendMode',
  'textVisible',
  'textStrokeColor',
  'textStrokeWidth',
  'textStrokeTarget',
  'textAlign',
  'fillEnabled',
  'strokeEnabled',
  'shadowEnabled',
  'letterSpacing',
  'lineHeight',
  'backgroundType',
  'backgroundColor',
  'backgroundGradientStart',
  'backgroundGradientEnd',
  'backgroundGradientAngle',
  'backgroundGradientShape',
  'backgroundGradientStartX',
  'backgroundGradientStartY',
  'backgroundGradientEndX',
  'backgroundGradientEndY',
  'backgroundGradientStops',
  'backgroundImageUrl',
  'backgroundImageFit',
  'backgroundImageAlpha',
  'backgroundImageRotation',
  'backgroundImageScale',
  'backgroundImageOffsetX',
  'backgroundImageOffsetY',
  'borderType',
  'borderColor',
  'borderGradientStart',
  'borderGradientEnd',
  'borderGradientAngle',
  'borderGradientStops',
  'borderPosition',
  'borderWidth',
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomRightRadius',
  'borderBottomLeftRadius',
  'shadowColor',
  'shadowType',
  'shadowOpacity',
  'shadowBlur',
  'shadowOffsetX',
  'shadowOffsetY',
  'shadows',
  'zIndex',
  'opacity',
  'blendMode',
  'linkTarget',
  'actionValue',
  'actionValueInputMode',
]);

const stylePatchFromWebUpdate = (patch: Partial<WebMenuElement>) =>
  Object.fromEntries(
    Object.entries(patch).filter(
      ([key, value]) => styleKeys.has(key as keyof PptManualElementWebStyle) && value !== undefined,
    ),
  ) as PptManualElementWebStyle;

const textStyleFromElement = (element: PptManualElement): Partial<WebMenuElement> => {
  if (element.kind !== 'text') return {};
  return {
    fontSize: element.fontSize,
    fontFamily: element.fontFamily,
    fontWeight: element.bold ? 700 : 400,
    textColor: element.color,
    textAlign: element.align,
  };
};

export const toPptWebInspectorElement = (element: PptManualElement): WebMenuElement => ({
  ...(element.webStyle || {}),
  ...textStyleFromElement(element),
  id: element.id,
  kind: element.kind,
  role: element.kind === 'button' && element.action === 'url' ? 'link' : 'custom',
  text: element.kind === 'image' ? '' : element.text,
  visible: element.visible !== false,
  x: toPercent(element.x, 'x'),
  y: toPercent(element.y, 'y'),
  width: toPercent(element.width, 'x'),
  height: toPercent(element.height, 'y'),
  scale: 1,
  rotation: element.rotation || 0,
  imageUrl: element.kind === 'image' ? element.src : undefined,
  linkUrl: element.kind === 'button' ? element.url : undefined,
});

export const toPptManualElementPatch = (
  element: PptManualElement,
  update: Partial<WebMenuElement>,
): Partial<PptManualElement> => {
  const stylePatch = stylePatchFromWebUpdate(update);
  const patch: Record<string, unknown> = {
    ...omitUndefined({
      x: update.x === undefined ? undefined : toCanvasValue(update.x, 'x'),
      y: update.y === undefined ? undefined : toCanvasValue(update.y, 'y'),
      width: update.width === undefined ? undefined : toCanvasValue(update.width, 'x'),
      height: update.height === undefined ? undefined : toCanvasValue(update.height, 'y'),
      rotation: update.rotation,
      visible: update.visible,
    }),
  };
  if (element.kind === 'image' && update.imageUrl !== undefined) patch.src = update.imageUrl;
  if (element.kind !== 'image') {
    if (update.text !== undefined) patch.text = update.text;
    if (update.fontSize !== undefined) patch.fontSize = update.fontSize;
    if (update.fontFamily !== undefined) patch.fontFamily = update.fontFamily;
    if (update.textColor !== undefined) patch.color = update.textColor;
    if (update.textAlign !== undefined) patch.align = update.textAlign;
    if (update.fontWeight !== undefined) patch.bold = update.fontWeight >= 600;
  }
  if (element.kind === 'button') {
    if (update.role === 'link') patch.action = 'url';
    if (update.role === 'custom') patch.action = 'none';
    if (update.linkUrl !== undefined) patch.url = update.linkUrl;
  }
  if (Object.keys(stylePatch).length) {
    patch.webStyle = { ...element.webStyle, ...stylePatch };
  }
  return patch as Partial<PptManualElement>;
};

export const toPptCoverWebInspectorElement = (
  target: 'cover-title' | 'cover-subtitle',
  text: string,
  layout: PptTextBoxLayout,
): WebMenuElement => ({
  ...(layout.webStyle || {}),
  id: target,
  kind: 'text',
  role: target === 'cover-title' ? 'title' : 'subtitle',
  text,
  visible: layout.visible !== false,
  x: toPercent(layout.x, 'x'),
  y: toPercent(layout.y, 'y'),
  width: toPercent(layout.width, 'x'),
  height: toPercent(layout.height, 'y'),
  scale: 1,
  rotation: layout.rotation,
  fontSize: layout.webStyle?.fontSize || (target === 'cover-title' ? 52 : 22),
  fontWeight: layout.webStyle?.fontWeight || (target === 'cover-title' ? 800 : 400),
  textColor: layout.webStyle?.textColor || '#ffffff',
  textAlign: layout.webStyle?.textAlign || 'center',
});

export const toPptCoverPatch = (
  layout: PptTextBoxLayout,
  update: Partial<WebMenuElement>,
): { layoutPatch: Partial<PptTextBoxLayout>; text?: string } => {
  const stylePatch = stylePatchFromWebUpdate(update);
  const textStyle = omitUndefined({
    fontSize: update.fontSize,
    fontFamily: update.fontFamily,
    fontWeight: update.fontWeight,
    textColor: update.textColor,
    textAlign: update.textAlign,
  });
  return {
    text: update.text,
    layoutPatch: {
      ...omitUndefined({
        x: update.x === undefined ? undefined : toCanvasValue(update.x, 'x'),
        y: update.y === undefined ? undefined : toCanvasValue(update.y, 'y'),
        width: update.width === undefined ? undefined : toCanvasValue(update.width, 'x'),
        height: update.height === undefined ? undefined : toCanvasValue(update.height, 'y'),
        rotation: update.rotation,
        visible: update.visible,
      }),
      ...(Object.keys(stylePatch).length || Object.keys(textStyle).length
        ? { webStyle: { ...layout.webStyle, ...stylePatch, ...textStyle } }
        : {}),
    },
  };
};

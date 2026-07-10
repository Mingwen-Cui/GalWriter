import type {
  RenderColorStop,
  RenderEditableObject,
  RenderEditableObjectKind,
  RenderEditableObjects,
  RenderEditableTextObject,
  RenderFillStyle,
  RenderObjectAnimationStyle,
  RenderShadowStyle,
  RenderStrokeStyle,
  RenderStyle,
  TextAlign,
  TextAnimation,
  TypewriterMode,
} from './types';

const defaultStops = (start: string, end: string): RenderColorStop[] => [
  { id: 'start', color: start, alpha: 100, position: 0 },
  { id: 'end', color: end, alpha: 100, position: 100 },
];

const fill = (
  type: RenderFillStyle['type'],
  color: string,
  alpha: number,
  gradientStops: RenderColorStop[],
  imageUrl = '',
): RenderFillStyle => ({
  enabled: true,
  type,
  color,
  alpha,
  gradientAngle: 90,
  gradientStops,
  imageUrl,
  imageFit: 'crop',
  imageAngle: 0,
  imageAlpha: 100,
  blendMode: 'normal',
});

const stroke = (): RenderStrokeStyle => ({
  enabled: false,
  type: 'solid',
  color: '#000000',
  alpha: 100,
  width: 0,
  position: 'center',
  gradientAngle: 90,
  gradientStops: defaultStops('#000000', '#ffffff'),
  imageUrl: '',
  dashed: false,
  lineCap: 'round',
  lineJoin: 'round',
});

const shadow = (): RenderShadowStyle => ({
  enabled: false,
  type: 'outer',
  x: 20,
  y: 20,
  blur: 0,
  spread: 0,
  color: '#000000',
  alpha: 20,
});

const animation = (
  value: TextAnimation,
  typewriterMode: TypewriterMode,
): RenderObjectAnimationStyle => ({
  animation: value,
  durationMs: 300,
  typewriterMode,
});

const objectBase = (overrides: Partial<RenderEditableObject>): RenderEditableObject => ({
  visible: true,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  radius: 0,
  rotation: 0,
  flipX: false,
  flipY: false,
  horizontalAlign: 'left',
  verticalAlign: 'top',
  fill: fill('solid', '#111827', 82, defaultStops('#111827', '#111827')),
  stroke: stroke(),
  shadow: shadow(),
  animation: animation('none', 'character'),
  ...overrides,
});

const textObject = (
  base: RenderEditableObject,
  overrides: Partial<RenderEditableTextObject>,
): RenderEditableTextObject => ({
  ...base,
  fontFamily: 'SimHei, "Noto Sans SC", sans-serif',
  fontSize: 18,
  fontWeight: 500,
  underline: false,
  strikethrough: false,
  letterSpacing: 0,
  lineHeight: 1.4,
  textAlign: 'left',
  textVerticalAlign: 'top',
  ...overrides,
});

export const buildDefaultRenderObjects = (): RenderEditableObjects => ({
  dialogBox: objectBase({
    visible: true,
    width: 86,
    height: 34,
    radius: 24,
    fill: fill('solid', '#111827', 82, defaultStops('#111827', '#111827')),
  }),
  title: textObject(
    objectBase({
      visible: true,
      width: 100,
      height: 24,
      fill: fill('solid', '#ffffff', 100, defaultStops('#ffffff', '#ffffff')),
      animation: animation('none', 'character'),
    }),
    {
      fontSize: 28,
      fontWeight: 800,
      lineHeight: 1.25,
    },
  ),
  body: textObject(
    objectBase({
      visible: true,
      y: 0,
      width: 100,
      height: 64,
      fill: fill('solid', '#f8fafc', 100, defaultStops('#f8fafc', '#f8fafc')),
      animation: animation('typewriter', 'character'),
    }),
    {
      fontSize: 18,
      fontWeight: 500,
      lineHeight: 1.45,
    },
  ),
  nameplate: textObject(
    objectBase({
      visible: true,
      width: 34,
      height: 42,
      radius: 14,
      fill: fill('solid', '#4f46e5', 86, defaultStops('#6366f1', '#ec4899')),
    }),
    {
      fontSize: 18,
      fontWeight: 800,
      lineHeight: 1,
    },
  ),
});

const mergeObject = <T extends RenderEditableObject>(base: T, next?: Partial<T>): T => ({
  ...base,
  ...next,
  fill: { ...base.fill, ...next?.fill },
  stroke: { ...base.stroke, ...next?.stroke },
  shadow: { ...base.shadow, ...next?.shadow },
  animation: { ...base.animation, ...next?.animation },
});

export const getRenderObjects = (style: RenderStyle): RenderEditableObjects => {
  const defaults = buildDefaultRenderObjects();
  const legacyDialogFill = fill(
    style.dialogBackgroundType,
    style.panelColor || '#111827',
    style.panelColorAlpha ?? 82,
    style.dialogGradientStops?.length
      ? style.dialogGradientStops
      : defaultStops('#111827', '#111827'),
    style.dialogImageUrl,
  );
  const legacyNameplateFill = fill(
    style.nameplateBackgroundType,
    style.nameplateColor || '#4f46e5',
    style.nameplateColorAlpha ?? 86,
    style.nameplateGradientStops?.length
      ? style.nameplateGradientStops
      : defaultStops('#6366f1', '#ec4899'),
    style.nameplateImageUrl,
  );
  const legacy: RenderEditableObjects = {
    dialogBox: {
      ...defaults.dialogBox,
      visible: style.dialogVisible,
      x: style.dialogOffsetX ?? 0,
      y: style.dialogOffsetY ?? 0,
      width: style.dialogWidth,
      height: style.dialogHeight,
      radius: style.dialogRadius,
      fill: legacyDialogFill,
    },
    title: {
      ...defaults.title,
      visible: style.titleVisible,
      fontFamily: style.titleFontFamily,
      fontSize: style.titleFontSize,
      fontWeight: 800,
      letterSpacing: style.titleLetterSpacing,
      lineHeight: style.titleLineHeight,
      textAlign: style.titleAlign,
      horizontalAlign: style.titleAlign,
      fill: fill(
        'solid',
        style.titleColor,
        style.titleColorAlpha ?? 100,
        defaultStops(style.titleColor, style.titleColor),
      ),
      stroke: {
        ...defaults.title.stroke,
        enabled: style.titleStrokeWidth > 0,
        color: style.titleStrokeColor,
        width: style.titleStrokeWidth,
      },
      animation: animation(style.titleAnimation, style.titleTypewriterMode),
    },
    body: {
      ...defaults.body,
      fontFamily: style.bodyFontFamily,
      fontSize: style.bodyFontSize,
      fontWeight: 500,
      letterSpacing: style.bodyLetterSpacing,
      lineHeight: style.bodyLineHeight,
      textAlign: style.bodyAlign,
      horizontalAlign: style.bodyAlign,
      fill: fill(
        'solid',
        style.bodyColor,
        style.bodyColorAlpha ?? 100,
        defaultStops(style.bodyColor, style.bodyColor),
      ),
      stroke: {
        ...defaults.body.stroke,
        enabled: style.bodyStrokeWidth > 0,
        color: style.bodyStrokeColor,
        width: style.bodyStrokeWidth,
      },
      animation: animation(style.bodyAnimation, style.bodyTypewriterMode),
    },
    nameplate: {
      ...defaults.nameplate,
      visible: style.nameplateVisible,
      x: style.nameplateOffsetX ?? 0,
      y: style.nameplateOffsetY ?? 0,
      width: style.nameplateScale ?? 100,
      radius: style.nameplateRadius ?? 14,
      fontFamily: style.nameplateFontFamily || style.titleFontFamily,
      fontSize: style.nameplateFontSize ?? 18,
      fill: legacyNameplateFill,
    },
  };
  const current = style.renderObjects;
  if (!current) return legacy;
  return {
    dialogBox: mergeObject(legacy.dialogBox, current.dialogBox),
    title: mergeObject(legacy.title, current.title),
    body: mergeObject(legacy.body, current.body),
    nameplate: mergeObject(legacy.nameplate, current.nameplate),
  };
};

export const updateRenderObject = (
  style: RenderStyle,
  kind: RenderEditableObjectKind,
  updates: Partial<RenderEditableObject | RenderEditableTextObject>,
): RenderEditableObjects => {
  const objects = getRenderObjects(style);
  return {
    ...objects,
    [kind]: mergeObject(objects[kind] as RenderEditableObject, updates),
  } as RenderEditableObjects;
};

export const isTextRenderObject = (
  kind: RenderEditableObjectKind,
): kind is 'title' | 'body' | 'nameplate' => kind !== 'dialogBox';

export const normalizeTextAlign = (value: string): TextAlign =>
  value === 'center' || value === 'right' ? value : 'left';

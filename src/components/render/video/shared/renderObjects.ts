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
  gradientType: 'linear',
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
  gradientType: 'linear',
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
    height: 22,
    radius: 24,
    fill: fill('solid', '#111827', 82, defaultStops('#111827', '#111827')),
  }),
  title: textObject(
    objectBase({
      visible: true,
      x: 0,
      y: -10,
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
      fontSize: 32,
      fontWeight: 500,
      lineHeight: 1.45,
    },
  ),
  nameplate: textObject(
    objectBase({
      visible: true,
      width: 34,
      height: 42,
      radius: 50,
      fill: fill('gradient', '#172554', 94, defaultStops('#1e3a8a', '#0f172a')),
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

/** All surfaces read the same object graph. No scalar or per-mode fallback. */
export const getRenderObjects = (style: RenderStyle): RenderEditableObjects =>
  style.renderObjects ?? buildDefaultRenderObjects();

export const getVideoRenderObjects = getRenderObjects;

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

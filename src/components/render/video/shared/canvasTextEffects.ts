import type { RenderEditableTextObject, RenderShadowStyle } from './types';

const rgba = (color: string, alpha: number) => {
  const safeAlpha = Math.min(1, Math.max(0, alpha / 100));
  const hex = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    const red = Number.parseInt(hex.slice(1, 3), 16);
    const green = Number.parseInt(hex.slice(3, 5), 16);
    const blue = Number.parseInt(hex.slice(5, 7), 16);
    return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
  }
  return color;
};

const enabledShadows = (object: RenderEditableTextObject): RenderShadowStyle[] => {
  const layers = object.shadows?.length ? object.shadows : [object.shadow];
  // Canvas exposes a native text-shadow equivalent only for outer shadows.
  // Inner variants deliberately remain a web-only capability until their mask renderer lands.
  return layers.filter((layer) => layer.enabled && layer.type === 'outer' && layer.alpha > 0);
};

/** Draw one text line with the video-export effects used by the Canvas renderer. */
export const drawVideoTextLine = (
  ctx: CanvasRenderingContext2D,
  line: string,
  x: number,
  y: number,
  options: {
    align: CanvasTextAlign;
    fillColor: string;
    letterSpacing: number;
    object: RenderEditableTextObject;
  },
) => {
  ctx.save();
  ctx.textAlign = options.align;
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing =
    `${options.letterSpacing}px`;

  // Render each layer separately so opacity and offsets match the inspector exactly.
  for (const shadow of enabledShadows(options.object)) {
    ctx.save();
    ctx.shadowColor = rgba(shadow.color, shadow.alpha);
    ctx.shadowBlur = shadow.blur;
    ctx.shadowOffsetX = shadow.x;
    ctx.shadowOffsetY = shadow.y;
    ctx.fillStyle = options.fillColor;
    ctx.fillText(line, x, y);
    ctx.restore();
  }

  const { stroke } = options.object;
  if (stroke.enabled && stroke.width > 0) {
    ctx.lineJoin = stroke.lineJoin;
    ctx.lineCap = stroke.lineCap;
    // A double-width centered stroke, followed by fill, leaves a true outer outline.
    ctx.lineWidth = stroke.position === 'outside' ? stroke.width * 2 : stroke.width;
    ctx.strokeStyle = rgba(stroke.color, stroke.alpha);
    ctx.strokeText(line, x, y);
  }
  ctx.fillStyle = options.fillColor;
  ctx.fillText(line, x, y);
  ctx.restore();
};

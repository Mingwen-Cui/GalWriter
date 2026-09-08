import { drawAppearance } from '../../shared/paint/appearanceCanvas';
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
export const drawVideoTextLine = async (
  ctx: CanvasRenderingContext2D,
  line: string,
  x: number,
  y: number,
  options: {
    align: CanvasTextAlign;
    fillColor: string;
    letterSpacing: number;
    object: RenderEditableTextObject;
    appearanceText?: boolean;
  },
) => {
  ctx.save();
  ctx.textAlign = options.align;
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing =
    `${options.letterSpacing}px`;

  if(options.appearanceText && options.object.appearance){
    const appearance=options.object.appearance;
    const metrics=ctx.measureText(line),w=Math.ceil(metrics.width)+4,h=Math.ceil(metrics.actualBoundingBoxAscent+metrics.actualBoundingBoxDescent)+4;
    const left=options.align==='center'?x-w/2:options.align==='right'?x-w+2:x-2;
    const top=y-metrics.actualBoundingBoxAscent-2;
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,w);canvas.height=Math.max(1,h);
    const paint=canvas.getContext('2d');if(paint){
      await drawAppearance(paint,{fills:appearance.fills,strokes:[],shadows:[]},{x:0,y:0,width:w,height:h});
      paint.globalCompositeOperation='destination-in';paint.font=ctx.font;paint.textAlign=ctx.textAlign;paint.textBaseline=ctx.textBaseline;
      (paint as CanvasRenderingContext2D & {letterSpacing?:string}).letterSpacing=`${options.letterSpacing}px`;
      paint.fillText(line,x-left,y-top);
      for(const shadow of [...appearance.shadows].reverse().filter(s=>s.enabled&&!s.inset)){ctx.save();ctx.shadowColor=shadow.color;ctx.shadowBlur=shadow.blur;ctx.shadowOffsetX=shadow.x;ctx.shadowOffsetY=shadow.y;ctx.drawImage(canvas,left,top);ctx.restore();}
      for(const stroke of [...appearance.strokes].reverse().filter(s=>s.enabled)){ctx.strokeStyle=stroke.color;ctx.lineWidth=stroke.width*2;ctx.strokeText(line,x,y);}
      ctx.drawImage(canvas,left,top);
    }
    ctx.restore();return;
  }

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

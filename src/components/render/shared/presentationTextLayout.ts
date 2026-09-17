import { getRenderObjects } from '../video/shared/renderObjects';
import { resolvePresentationDialogueLayout } from '../video/shared/presentationLayout';
import type { RenderStyle, RenderEditableTextObject } from '../video/shared/types';

export type TextBlockLayout = {
  lines: string[]; starts: number[]; widths: number[];
  left: number; right: number; top: number; height: number;
  firstBaseline: number; lineHeight: number; font: string; fontSize: number;
  letterSpacing: number; visible: boolean; object: RenderEditableTextObject;
};
export type DialogueTextLayout = ReturnType<typeof resolveDialogueTextLayout>;

export const textFont = (object: RenderEditableTextObject, size = object.fontSize) =>
  `${object.fontWeight} ${size}px ${object.fontFamily}`;

export async function preparePresentationFonts(style: RenderStyle, text = '国Ag') {
  if (typeof document === 'undefined' || !document.fonts) return;
  const objects = getRenderObjects(style);
  await Promise.all(['title', 'body', 'nameplate'].map(kind =>
    document.fonts.load(textFont(objects[kind as 'title']), text || '国Ag')));
  await document.fonts.ready;
}

/** Explicit line boxes. No browser reflow, viewport measurements, or per-output font multipliers. */
export function resolveDialogueTextLayout(ctx: CanvasRenderingContext2D, input: {
  width: number; height: number; style: RenderStyle; title: string; body: string; hideTitle?: boolean;
}) {
  const { width, height, style } = input;
  const objects = getRenderObjects(style);
  const dialog = resolvePresentationDialogueLayout(width, height, style);
  const contentWidth = Math.max(1, dialog.width - 2 * dialog.paddingX);
  const availableHeight = Math.max(1, dialog.height - 2 * dialog.paddingY);
  const titleText = objects.title.visible && !input.hideTitle ? input.title : '';
  const bodyText = objects.body.visible ? input.body : '';
  const wrap = (text: string, object: RenderEditableTextObject, scale: number) => {
    const fontSize = Math.max(1, object.fontSize * scale);
    const font = textFont(object, fontSize);
    const letterSpacing = object.letterSpacing * scale;
    ctx.font = font; ctx.letterSpacing = `${letterSpacing}px`;
    const maxWidth = Math.max(1, contentWidth * object.width / 100);
    const lines: string[] = [], starts: number[] = [], widths: number[] = [];
    let line = '', start = 0, index = 0;
    const push = () => { lines.push(line); starts.push(start); widths.push(ctx.measureText(line).width); line = ''; start = index; };
    for (const character of Array.from(text.replace(/\r\n?/g, '\n'))) {
      if (character === '\n') { push(); index++; start = index; continue; }
      if (line && ctx.measureText(line + character).width > maxWidth) push();
      line += character; index++;
    }
    if (text.length) push();
    const metrics = ctx.measureText('国Ag');
    const ascent = metrics.fontBoundingBoxAscent || metrics.actualBoundingBoxAscent || fontSize * .8;
    const descent = metrics.fontBoundingBoxDescent || metrics.actualBoundingBoxDescent || fontSize * .2;
    const lineHeight = Math.max(fontSize, fontSize * object.lineHeight);
    return { lines, starts, widths, fontSize, font, letterSpacing, lineHeight,
      baselineInset: (lineHeight - ascent - descent) / 2 + ascent,
      width: maxWidth, height: lines.length * lineHeight, object };
  };
  ctx.save();
  try {
    ctx.textAlign = 'left';
    let scale = 1;
    let title = wrap(titleText, objects.title, scale), body = wrap(bodyText, objects.body, scale);
    let gap = title.lines.length && body.lines.length ? objects.body.fontSize * .6 : 0;
    // Fit the complete node, never silently drop lines. This is resolved once for all surfaces.
    for (let pass = 0; pass < 12 && title.height + gap + body.height > availableHeight; pass++) {
      scale *= Math.min(.95, availableHeight / (title.height + gap + body.height));
      title = wrap(titleText, objects.title, scale); body = wrap(bodyText, objects.body, scale);
      gap = title.lines.length && body.lines.length ? objects.body.fontSize * .6 * scale : 0;
    }
    const offsetY = dialog.height * (style.dialogTextOffsetY || 0) / 100;
    const block = (run: typeof title, y: number): TextBlockLayout => {
      const top = dialog.y + dialog.paddingY + y + run.object.y + offsetY;
      const left = dialog.x + dialog.paddingX + run.object.x;
      return { ...run, left, right: left + run.width, top, height: Math.max(run.lineHeight, run.height),
        firstBaseline: top + run.baselineInset, visible: run.lines.length > 0 && run.object.visible };
    };
    return { dialog, title: block(title, 0), body: block(body, title.height + gap), scale };
  } finally { ctx.restore(); }
}

export function revealLayoutLines(block: TextBlockLayout, count = Infinity) {
  return block.lines.map((line, i) => Array.from(line).slice(0, Math.max(0, count - block.starts[i])).join(''));
}

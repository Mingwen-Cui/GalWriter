import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { drawVideoTextLine } from '../video/shared/canvasTextEffects';
import type { RenderStyle } from '../video/shared/types';
import { preparePresentationFonts, resolveDialogueTextLayout, revealLayoutLines } from './presentationTextLayout';
import type { TextBlockLayout } from './presentationTextLayout';

export function useDialogueTextLayout(style: RenderStyle, width: number, height: number, title: string, body: string, hideTitle = false) {
  const [fontRevision, setFontRevision] = useState(0);
  useEffect(() => {
    let active = true;
    preparePresentationFonts(style, title + body).then(() => { if (active) setFontRevision(v => v + 1); });
    return () => { active = false; };
  }, [style, title, body]);
  return useMemo(() => {
    const context = document.createElement('canvas').getContext('2d')!;
    return resolveDialogueTextLayout(context, { style, width, height, title, body, hideTitle });
  }, [style, width, height, title, body, hideTitle, fontRevision]);
}

export function textBlockCss(block: TextBlockLayout, parent: { x: number; y: number; width: number; height: number }): CSSProperties {
  return { position: 'absolute', margin: 0, padding: 0, boxSizing: 'border-box',
    left: `${100 * (block.left - parent.x) / parent.width}%`,
    top: `${100 * (block.top - parent.y) / parent.height}%`,
    width: `${100 * (block.right - block.left) / parent.width}%`,
    height: `${100 * block.height / parent.height}%`,
    transform: `rotate(${block.object.rotation}deg) scale(${block.object.flipX ? -1 : 1}, ${block.object.flipY ? -1 : 1})`,
  };
}

/** The same Canvas text painter is used by the editor, video and exported text layers. */
export async function rasterizeTextBlock(block: TextBlockLayout, visibleCharacters = Infinity) {
  const canvas = document.createElement('canvas');
  const padding = Math.ceil(Math.max(8, block.object.stroke.width * 2, ...[block.object.shadow, ...(block.object.shadows || [])].map(s => s.enabled ? s.blur * 2 + Math.abs(s.x) + Math.abs(s.y) + Math.abs(s.spread) : 0)));
  canvas.width = Math.ceil(block.right - block.left + padding * 2);
  canvas.height = Math.ceil(block.height + padding * 2);
  const ctx = canvas.getContext('2d')!;
  ctx.font = block.font; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = `${block.letterSpacing}px`;
  const object = block.object;
  const lines = revealLayoutLines(block, visibleCharacters);
  for (let i = 0; i < lines.length; i++) {
    const alignOffset = object.textAlign === 'center' ? (block.right - block.left - block.widths[i]) / 2 : object.textAlign === 'right' ? block.right - block.left - block.widths[i] : 0;
    const x = padding + alignOffset, y = padding + block.firstBaseline - block.top + i * block.lineHeight;
    await drawVideoTextLine(ctx, lines[i], x, y, { align: 'left', letterSpacing: block.letterSpacing,
      fillColor: object.fill.color, object, appearanceText: true });
    if (object.underline || object.strikethrough) {
      ctx.fillStyle = object.fill.color;
      const width = ctx.measureText(lines[i]).width;
      if (object.underline) ctx.fillRect(x, y + block.fontSize * .12, width, Math.max(1, block.fontSize / 16));
      if (object.strikethrough) ctx.fillRect(x, y - block.fontSize * .3, width, Math.max(1, block.fontSize / 16));
    }
  }
  return { canvas, padding };
}

export function PresentationText({ block, visibleCharacters = Infinity }: { block: TextBlockLayout; visibleCharacters?: number }) {
  const [image, setImage] = useState<{ src: string; padding: number; width: number; height: number }>();
  useEffect(() => {
    let active = true;
    rasterizeTextBlock(block, visibleCharacters).then(({ canvas, padding }) => {
      if (active) setImage({ src: canvas.toDataURL('image/png'), padding, width: canvas.width, height: canvas.height });
    });
    return () => { active = false; };
  }, [block, visibleCharacters]);
  if (!image || !block.visible) return null;
  return <img alt={revealLayoutLines(block, visibleCharacters).join('\n')} draggable={false} src={image.src}
    style={{ position: 'absolute', maxWidth: 'none', pointerEvents: 'none',
      left: `${-100 * image.padding / (block.right - block.left)}%`, top: `${-100 * image.padding / block.height}%`,
      width: `${100 * image.width / (block.right - block.left)}%`, height: `${100 * image.height / block.height}%` }} />;
}

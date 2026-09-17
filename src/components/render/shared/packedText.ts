import { rasterizeTextBlock } from './PresentationText';
import { preparePresentationFonts, resolveDialogueTextLayout } from './presentationTextLayout';
import type { RenderStyle } from '../video/shared/types';

export async function packDialogueText(style: RenderStyle, width: number, height: number, title: string, body: string, hideTitle: boolean) {
  await preparePresentationFonts(style, title + body);
  const ctx = document.createElement('canvas').getContext('2d')!;
  const layout = resolveDialogueTextLayout(ctx, { style, width, height, title, body, hideTitle });
  const pack = async (kind: 'title' | 'body') => {
    const block = layout[kind];
    const lines = await Promise.all(block.lines.map(async (text, i) => {
      const lineBlock = { ...block, lines: [text], starts: [0], widths: [block.widths[i]], height: block.lineHeight };
      const { canvas, padding } = await rasterizeTextBlock(lineBlock);
      ctx.font = block.font; ctx.letterSpacing = `${block.letterSpacing}px`;
      const glyphs = Array.from(text), advances = [0];
      for (let j = 1; j <= glyphs.length; j++) advances.push(ctx.measureText(glyphs.slice(0, j).join('')).width);
      const alignOffset = block.object.textAlign === 'center' ? (block.right - block.left - block.widths[i]) / 2
        : block.object.textAlign === 'right' ? block.right - block.left - block.widths[i] : 0;
      return { src: canvas.toDataURL('image/png'), padding, width: canvas.width, height: canvas.height,
        top: i * block.lineHeight, start: block.starts[i], text, advances, alignOffset };
    }));
    return { left: block.left - layout.dialog.x, top: block.top - layout.dialog.y,
      width: block.right - block.left, height: block.height, visible: block.visible,
      rotation: block.object.rotation, flipX: block.object.flipX, flipY: block.object.flipY, lines };
  };
  return { dialog: layout.dialog, title: await pack('title'), body: await pack('body') };
}
export type PackedDialogueText = Awaited<ReturnType<typeof packDialogueText>>;

import { preparePresentationFonts, resolveDialogueTextLayout } from './presentationTextLayout';
import { presentTextBlock } from './presentationTextDom';
import type { RenderStyle } from '../video/shared/types';

export async function packDialogueText(
  style: RenderStyle,
  width: number,
  height: number,
  title: string,
  body: string,
  hideTitle: boolean,
) {
  await preparePresentationFonts(style, title + body);
  const ctx = document.createElement('canvas').getContext('2d')!;
  const layout = resolveDialogueTextLayout(ctx, { style, width, height, title, body, hideTitle });
  const pack = (kind: 'title' | 'body') => {
    const block = layout[kind];
    return {
      ...presentTextBlock(block),
      left: block.left - layout.dialog.x,
      top: block.top - layout.dialog.y,
      rotation: block.object.rotation,
      flipX: block.object.flipX,
      flipY: block.object.flipY,
    };
  };
  return { dialog: layout.dialog, title: pack('title'), body: pack('body') };
}
export type PackedDialogueText = Awaited<ReturnType<typeof packDialogueText>>;

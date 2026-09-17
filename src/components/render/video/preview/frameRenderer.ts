import { rasterizeTextBlock } from '../../shared/PresentationText';
import { preparePresentationFonts } from '../../shared/presentationTextLayout';
import type { SharedCanvasSettings } from '../../canvas/canvasSettings';
import { objectAnimationState } from '../canvas/textAnimation';
import { drawDialogueBox } from '../shared/dialogueBoxRenderer';
import { drawNameplates } from '../shared/nameplateRenderer';
import { drawPresentationVisuals } from '../shared/presentationRenderer';
import type { RenderStyle, VideoTextScaleMode } from '../shared/types';
import { getVideoTextRenderStyle } from '../shared/videoTextScale';
import { resolveVideoTextLayout } from '../shared/videoTextLayout';

type DrawRenderFrameInput = {
  ctx: CanvasRenderingContext2D;
  node: import('@xyflow/react').Node;
  width: number;
  height: number;
  renderStyle: RenderStyle;
  videoTextScaleMode: VideoTextScaleMode;
  animationLeadSeconds: number;
  isZh: boolean;
  media?: { source: CanvasImageSource; width: number; height: number };
  elapsed?: number;
  duration?: number;
  forceFinalText?: boolean;
  nodes: import('@xyflow/react').Node[];
  hideCharacterTags: boolean;
  hideSceneTags: boolean;
  canvasSettings?: SharedCanvasSettings;
};

export const drawRenderFrame = async ({
  ctx,
  node,
  width,
  height,
  renderStyle,
  videoTextScaleMode,
  isZh,
  media,
  elapsed,
  duration,
  forceFinalText = false,
  nodes,
  hideCharacterTags,
  hideSceneTags,
  canvasSettings,
}: DrawRenderFrameInput) => {
  await preparePresentationFonts(renderStyle, String(node.data?.text || '') + String(node.data?.title || ''));
  const videoRenderStyle = getVideoTextRenderStyle(renderStyle, videoTextScaleMode, height);
  const layout = resolveVideoTextLayout({
    ctx,
    node,
    nodes,
    width,
    height,
    style: videoRenderStyle,
    elapsed,
    duration,
    forceFinalText,
    isZh,
    hideCharacterTags,
    hideSceneTags,
  });
  const { inlineState, objects } = layout;
  await drawPresentationVisuals({
    ctx,
    node,
    nodes,
    width,
    height,
    media,
    elapsed,
    duration,
    activeInlineAction: inlineState.activeAction,
    activeInlineActionElapsed: inlineState.activeActionElapsed,
    completedSwitchActions: inlineState.completedSwitchActions,
    completedInlineActions: inlineState.completedInlineActions,
    canvasSettings,
  });
  const dialogLayout = await drawDialogueBox(
    ctx,
    width,
    height,
    videoRenderStyle,
    { topExtension: layout.nameplateReservedHeight, elapsed },
    objectAnimationState(
      objects.dialogBox.animation.animation,
      objects.dialogBox.animation.durationMs,
      elapsed,
      forceFinalText,
    ),
  );
  await drawNameplates(
    ctx,
    width,
    dialogLayout,
    videoRenderStyle,
    layout.nameplateItems,
    objectAnimationState(
      objects.nameplate.animation.animation,
      objects.nameplate.animation.durationMs,
      elapsed,
      forceFinalText,
    ),
  );
  for (const kind of ['title', 'body'] as const) {
    const block = layout[kind];
    if (!block.visible || block.alpha <= 0) continue;
    const { canvas, padding } = await rasterizeTextBlock(block);
    ctx.save();
    ctx.globalAlpha *= block.alpha;
    const cx = (block.left + block.right) / 2, cy = block.top + block.height / 2;
    ctx.translate(cx, cy); ctx.rotate(block.object.rotation * Math.PI / 180);
    ctx.scale(block.object.flipX ? -1 : 1, block.object.flipY ? -1 : 1);
    ctx.drawImage(canvas, block.left - cx - padding, block.top - cy - padding);
    ctx.restore();
  }
};

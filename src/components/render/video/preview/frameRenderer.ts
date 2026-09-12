import type { SharedCanvasSettings } from '../../canvas/canvasSettings';
import { objectAnimationState } from '../canvas/textAnimation';
import { drawVideoTextLine } from '../shared/canvasTextEffects';
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

const colorWithAlpha = (color: string, alpha: number) => {
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

const textX = (align: RenderStyle['titleAlign'], left: number, right: number) => {
  if (align === 'center') return (left + right) / 2;
  if (align === 'right') return right;
  return left;
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
    const text = layout[kind];
    if (!text.visible || text.alpha <= 0) continue;
    ctx.save();
    try {
      ctx.font = text.font;
      ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = text.alpha;
      const align = kind === 'title' ? videoRenderStyle.titleAlign : videoRenderStyle.bodyAlign;
      const color = kind === 'title' ? videoRenderStyle.titleColor : videoRenderStyle.bodyColor;
      const alpha =
        kind === 'title' ? videoRenderStyle.titleColorAlpha : videoRenderStyle.bodyColorAlpha;
      const letterSpacing =
        kind === 'title' ? videoRenderStyle.titleLetterSpacing : videoRenderStyle.bodyLetterSpacing;
      for (const [index, line] of text.lines.entries()) {
        await drawVideoTextLine(
          ctx,
          line,
          textX(align, text.left, text.right),
          text.firstBaseline + index * text.lineHeight,
          {
            align,
            fillColor: colorWithAlpha(color, alpha),
            letterSpacing,
            object: objects[kind],
            appearanceText: true,
          },
        );
      }
    } finally {
      ctx.restore();
    }
  }
};

import { htmlToSpeechText } from '../../../../lib/tts';
import { inlinePlaybackStateAtTime } from '../../../../lib/inlinePresentationPlayback';
import { normalizeStoryPresentation } from '../../../../lib/presentation';
import type { StoryPresentation } from '../../../../domain/project';
import { animatedTextState } from '../canvas/textAnimation';
import { drawDialogueBox } from '../shared/dialogueBoxRenderer';
import { drawPresentationVisuals } from '../shared/presentationRenderer';
import { filterMentionTags, wrapText } from '../shared/storyNodes';
import type { RenderStyle, VideoTextScaleMode } from '../shared/types';
import { getVideoTextRenderStyle } from '../shared/videoTextScale';

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

const drawStyledLine = (
  ctx: CanvasRenderingContext2D,
  line: string,
  x: number,
  y: number,
  options: {
    align: CanvasTextAlign;
    fillColor: string;
    strokeColor: string;
    strokeWidth: number;
    letterSpacing: number;
  },
) => {
  ctx.textAlign = options.align;
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing =
    `${options.letterSpacing}px`;
  if (options.strokeWidth > 0) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = options.strokeWidth;
    ctx.strokeStyle = options.strokeColor;
    ctx.strokeText(line, x, y);
  }
  ctx.fillStyle = options.fillColor;
  ctx.fillText(line, x, y);
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px';
};

export const drawRenderFrame = async ({
  ctx,
  node,
  width,
  height,
  renderStyle,
  videoTextScaleMode,
  animationLeadSeconds,
  isZh,
  media,
  elapsed,
  duration,
  forceFinalText = false,
  nodes,
  hideCharacterTags,
  hideSceneTags,
}: DrawRenderFrameInput) => {
  const title = htmlToSpeechText(String(node.data?.title || ''));
  const rawBodyHtml = String(node.data?.text || '');
  const inlineState = inlinePlaybackStateAtTime({
    html: rawBodyHtml,
    presentation: normalizeStoryPresentation(node.data?.presentation as StoryPresentation | undefined),
    elapsed,
    duration,
    options: { hideCharacterTags, hideSceneTags },
  });
  const body = htmlToSpeechText(
    filterMentionTags(inlineState.html, hideCharacterTags, hideSceneTags),
  );
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
  });
  const videoRenderStyle = getVideoTextRenderStyle(renderStyle, videoTextScaleMode, height);

  const dialogLayout = await drawDialogueBox(ctx, width, height, videoRenderStyle);
  const paddingX = dialogLayout.paddingX ?? dialogLayout.padding;
  const paddingY = dialogLayout.paddingY ?? dialogLayout.padding;
  const margin = dialogLayout.x + paddingX;
  const titleSize = Math.max(18, videoRenderStyle.titleFontSize);
  const bodySize = Math.max(16, videoRenderStyle.bodyFontSize);
  const titleLineHeight = Math.round(titleSize * Math.max(0.8, videoRenderStyle.titleLineHeight));
  const bodyLineHeight = Math.round(bodySize * Math.max(0.8, videoRenderStyle.bodyLineHeight));
  const maxTextWidth = dialogLayout.width - paddingX * 2;
  const textLeft = margin;
  const textRight = dialogLayout.x + dialogLayout.width - paddingX;

  ctx.font = `800 ${titleSize}px ${videoRenderStyle.titleFontFamily}`;
  const titleLines = videoRenderStyle.titleVisible
    ? wrapText(ctx, title || (isZh ? '未命名片段' : 'Untitled segment'), maxTextWidth).slice(0, 2)
    : [];
  ctx.font = `500 ${bodySize}px ${videoRenderStyle.bodyFontFamily}`;
  const bodyLines = wrapText(ctx, body || '', maxTextWidth).slice(0, 7);
  const textHeight =
    titleLines.length * titleLineHeight +
    (bodyLines.length ? Math.round(bodySize * 0.6) : 0) +
    bodyLines.length * bodyLineHeight;
  let y = dialogLayout.y + Math.max(paddingY, (dialogLayout.height - textHeight) / 2);

  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 12;
  ctx.font = `800 ${titleSize}px ${videoRenderStyle.titleFontFamily}`;
  const titleState = animatedTextState(
    videoRenderStyle.titleAnimation,
    titleLines,
    videoRenderStyle.titleAnimationLeadSeconds ?? animationLeadSeconds,
    elapsed,
    duration,
    forceFinalText,
    videoRenderStyle.titleTypewriterMode,
  );
  ctx.save();
  ctx.globalAlpha = titleState.alpha;
  titleState.lines.forEach((line) => {
    drawStyledLine(
      ctx,
      line,
      textX(videoRenderStyle.titleAlign, textLeft, textRight),
      y + titleState.offsetY,
      {
        align: videoRenderStyle.titleAlign,
        fillColor: colorWithAlpha(videoRenderStyle.titleColor, videoRenderStyle.titleColorAlpha),
        strokeColor: videoRenderStyle.titleStrokeColor,
        strokeWidth: videoRenderStyle.titleStrokeWidth,
        letterSpacing: videoRenderStyle.titleLetterSpacing,
      },
    );
    y += titleLineHeight;
  });
  ctx.restore();

  if (bodyLines.length) y += Math.round(bodySize * 0.6);
  ctx.font = `500 ${bodySize}px ${videoRenderStyle.bodyFontFamily}`;
  const bodyState = animatedTextState(
    videoRenderStyle.bodyAnimation,
    bodyLines,
    videoRenderStyle.bodyAnimationLeadSeconds ?? animationLeadSeconds,
    elapsed,
    duration,
    forceFinalText,
    videoRenderStyle.bodyTypewriterMode,
  );
  ctx.save();
  ctx.globalAlpha = bodyState.alpha;
  bodyState.lines.forEach((line) => {
    drawStyledLine(
      ctx,
      line,
      textX(videoRenderStyle.bodyAlign, textLeft, textRight),
      y + bodyState.offsetY,
      {
        align: videoRenderStyle.bodyAlign,
        fillColor: colorWithAlpha(videoRenderStyle.bodyColor, videoRenderStyle.bodyColorAlpha),
        strokeColor: videoRenderStyle.bodyStrokeColor,
        strokeWidth: videoRenderStyle.bodyStrokeWidth,
        letterSpacing: videoRenderStyle.bodyLetterSpacing,
      },
    );
    y += bodyLineHeight;
  });
  ctx.restore();
  ctx.shadowBlur = 0;
};

import { htmlToSpeechText } from '../../../../lib/tts';
import { inlinePlaybackStateAtTime } from '../../../../lib/inlinePresentationPlayback';
import { normalizeStoryPresentation } from '../../../../lib/presentation';
import type { StoryPresentation } from '../../../../domain/project';
import { animatedTextState, revealCharacters } from '../canvas/textAnimation';
import { drawDialogueBox, getDialogueBoxLayout } from '../shared/dialogueBoxRenderer';
import {
  drawNameplates,
  getNameplateItems,
  getNameplateReservedHeight,
} from '../shared/nameplateRenderer';
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

const visibleTextLength = (text: string) => Array.from(text || '').length;
const visibleLines = (lines: string[]) => lines.filter((line) => line.length > 0);

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
  const fullBody = htmlToSpeechText(filterMentionTags(rawBodyHtml, hideCharacterTags, hideSceneTags));
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

  const baseDialogLayout = getDialogueBoxLayout(width, height, videoRenderStyle);
  const paddingX = baseDialogLayout.paddingX ?? baseDialogLayout.padding;
  const paddingY = baseDialogLayout.paddingY ?? baseDialogLayout.padding;
  const titleSize = Math.max(18, videoRenderStyle.titleFontSize);
  const bodySize = Math.max(16, videoRenderStyle.bodyFontSize);
  const titleLineHeight = Math.round(titleSize * Math.max(0.8, videoRenderStyle.titleLineHeight));
  const bodyLineHeight = Math.round(bodySize * Math.max(0.8, videoRenderStyle.bodyLineHeight));
  const maxTextWidth = baseDialogLayout.width - paddingX * 2;

  ctx.font = `800 ${titleSize}px ${videoRenderStyle.titleFontFamily}`;
  const titleLines = videoRenderStyle.titleVisible
    ? wrapText(ctx, title || (isZh ? '未命名片段' : 'Untitled segment'), maxTextWidth).slice(0, 2)
    : [];
  ctx.font = `500 ${bodySize}px ${videoRenderStyle.bodyFontFamily}`;
  const fullBodyLines = wrapText(ctx, fullBody || '', maxTextWidth).slice(0, 7);
  const bodyLines = revealCharacters(fullBodyLines, visibleTextLength(body));
  const titleState = animatedTextState(
    videoRenderStyle.titleAnimation,
    titleLines,
    videoRenderStyle.titleAnimationLeadSeconds ?? animationLeadSeconds,
    elapsed,
    duration,
    forceFinalText,
    videoRenderStyle.titleTypewriterMode,
  );
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
  const renderTitleLines = visibleLines(titleState.lines);
  const renderBodyLines = visibleLines(bodyState.lines);
  const visibleTextHeight =
    renderTitleLines.length * titleLineHeight +
    (renderTitleLines.length && renderBodyLines.length ? Math.round(bodySize * 0.6) : 0) +
    renderBodyLines.length * bodyLineHeight;
  const fixedTextHeight =
    titleLines.length * titleLineHeight +
    (titleLines.length && fullBodyLines.length ? Math.round(bodySize * 0.6) : 0) +
    fullBodyLines.length * bodyLineHeight;
  const textBaselineOffset = Math.round(bodySize * 0.35);
  const textOffsetY = Math.round(
    (baseDialogLayout.height *
      Math.max(-20, Math.min(40, videoRenderStyle.dialogTextOffsetY ?? 0))) /
      100,
  );
  const isAutoHeight = videoRenderStyle.dialogHeightMode === 'auto';
  const nameplateItems = getNameplateItems(node, nodes);
  const nameplateReservedHeight = getNameplateReservedHeight(nameplateItems, ctx, videoRenderStyle);
  const dialogLayout = await drawDialogueBox(
    ctx,
    width,
    height,
    videoRenderStyle,
    {
      ...(isAutoHeight
        ? { contentHeight: visibleTextHeight + textBaselineOffset + nameplateReservedHeight }
        : {}),
      topExtension: isAutoHeight ? 0 : nameplateReservedHeight,
    },
  );
  await drawNameplates(ctx, width, dialogLayout, videoRenderStyle, nameplateItems);
  const textLeft = dialogLayout.x + paddingX;
  const textRight = dialogLayout.x + dialogLayout.width - paddingX;
  let y =
    dialogLayout.y +
    nameplateReservedHeight +
    (isAutoHeight
      ? paddingY
      : Math.max(paddingY, (dialogLayout.height - nameplateReservedHeight - fixedTextHeight) / 2)) +
    textBaselineOffset +
    textOffsetY;

  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 12;
  ctx.font = `800 ${titleSize}px ${videoRenderStyle.titleFontFamily}`;
  ctx.save();
  ctx.globalAlpha = titleState.alpha;
  renderTitleLines.forEach((line) => {
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

  if (renderTitleLines.length && renderBodyLines.length) y += Math.round(bodySize * 0.6);
  ctx.font = `500 ${bodySize}px ${videoRenderStyle.bodyFontFamily}`;
  ctx.save();
  ctx.globalAlpha = bodyState.alpha;
  renderBodyLines.forEach((line) => {
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

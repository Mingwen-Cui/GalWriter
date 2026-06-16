import { htmlToSpeechText } from '../../../../lib/tts';
import { animatedTextState } from '../canvas/textAnimation';
import { drawDialogueBox } from '../shared/dialogueBoxRenderer';
import { drawPresentationVisuals } from '../shared/presentationRenderer';
import { filterMentionTags, wrapText } from '../shared/storyNodes';
import type { RenderStyle } from '../shared/types';

type DrawRenderFrameInput = {
  ctx: CanvasRenderingContext2D;
  node: import('@xyflow/react').Node;
  width: number;
  height: number;
  renderStyle: RenderStyle;
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
  const body = htmlToSpeechText(
    filterMentionTags(String(node.data?.text || ''), hideCharacterTags, hideSceneTags),
  );
  await drawPresentationVisuals({ ctx, node, nodes, width, height, media, elapsed, duration });

  const dialogLayout = await drawDialogueBox(ctx, width, height, renderStyle);
  const paddingX = dialogLayout.paddingX ?? dialogLayout.padding;
  const paddingY = dialogLayout.paddingY ?? dialogLayout.padding;
  const margin = dialogLayout.x + paddingX;
  const titleSize = Math.max(18, renderStyle.titleFontSize);
  const bodySize = Math.max(16, renderStyle.bodyFontSize);
  const titleLineHeight = Math.round(titleSize * Math.max(0.8, renderStyle.titleLineHeight));
  const bodyLineHeight = Math.round(bodySize * Math.max(0.8, renderStyle.bodyLineHeight));
  const maxTextWidth = dialogLayout.width - paddingX * 2;
  const textLeft = margin;
  const textRight = dialogLayout.x + dialogLayout.width - paddingX;

  ctx.font = `800 ${titleSize}px ${renderStyle.titleFontFamily}`;
  const titleLines = renderStyle.titleVisible
    ? wrapText(ctx, title || (isZh ? '未命名片段' : 'Untitled segment'), maxTextWidth).slice(0, 2)
    : [];
  ctx.font = `500 ${bodySize}px ${renderStyle.bodyFontFamily}`;
  const bodyLines = wrapText(ctx, body || '', maxTextWidth).slice(0, 7);
  const textHeight =
    titleLines.length * titleLineHeight +
    (bodyLines.length ? Math.round(bodySize * 0.6) : 0) +
    bodyLines.length * bodyLineHeight;
  let y = dialogLayout.y + Math.max(paddingY, (dialogLayout.height - textHeight) / 2);

  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 12;
  ctx.font = `800 ${titleSize}px ${renderStyle.titleFontFamily}`;
  const titleState = animatedTextState(
    renderStyle.titleAnimation,
    titleLines,
    renderStyle.titleAnimationLeadSeconds ?? animationLeadSeconds,
    elapsed,
    duration,
    forceFinalText,
    renderStyle.titleTypewriterMode,
  );
  ctx.save();
  ctx.globalAlpha = titleState.alpha;
  titleState.lines.forEach((line) => {
    drawStyledLine(
      ctx,
      line,
      textX(renderStyle.titleAlign, textLeft, textRight),
      y + titleState.offsetY,
      {
        align: renderStyle.titleAlign,
        fillColor: colorWithAlpha(renderStyle.titleColor, renderStyle.titleColorAlpha),
        strokeColor: renderStyle.titleStrokeColor,
        strokeWidth: renderStyle.titleStrokeWidth,
        letterSpacing: renderStyle.titleLetterSpacing,
      },
    );
    y += titleLineHeight;
  });
  ctx.restore();

  if (bodyLines.length) y += Math.round(bodySize * 0.6);
  ctx.font = `500 ${bodySize}px ${renderStyle.bodyFontFamily}`;
  const bodyState = animatedTextState(
    renderStyle.bodyAnimation,
    bodyLines,
    renderStyle.bodyAnimationLeadSeconds ?? animationLeadSeconds,
    elapsed,
    duration,
    forceFinalText,
    renderStyle.bodyTypewriterMode,
  );
  ctx.save();
  ctx.globalAlpha = bodyState.alpha;
  bodyState.lines.forEach((line) => {
    drawStyledLine(
      ctx,
      line,
      textX(renderStyle.bodyAlign, textLeft, textRight),
      y + bodyState.offsetY,
      {
        align: renderStyle.bodyAlign,
        fillColor: colorWithAlpha(renderStyle.bodyColor, renderStyle.bodyColorAlpha),
        strokeColor: renderStyle.bodyStrokeColor,
        strokeWidth: renderStyle.bodyStrokeWidth,
        letterSpacing: renderStyle.bodyLetterSpacing,
      },
    );
    y += bodyLineHeight;
  });
  ctx.restore();
  ctx.shadowBlur = 0;
};

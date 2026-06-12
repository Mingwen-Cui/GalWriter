import { htmlToSpeechText } from '../../../../lib/tts';
import { animatedTextState } from '../canvas/textAnimation';
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
    filterMentionTags(
      String(node.data?.text || ''),
      hideCharacterTags,
      hideSceneTags,
    ),
  );
  await drawPresentationVisuals({ ctx, node, nodes, width, height, media, elapsed, duration });

  const gradient = ctx.createLinearGradient(0, height * 0.45, 0, height);
  gradient.addColorStop(0, 'rgba(17, 24, 39, 0)');
  gradient.addColorStop(1, 'rgba(17, 24, 39, 0.88)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const margin = Math.max(48, width * 0.07);
  const titleSize = Math.max(18, renderStyle.titleFontSize);
  const bodySize = Math.max(16, renderStyle.bodyFontSize);
  const titleLineHeight = Math.round(titleSize * 1.25);
  const bodyLineHeight = Math.round(bodySize * 1.45);
  const maxTextWidth = width - margin * 2;

  ctx.font = `800 ${titleSize}px "Microsoft YaHei", "Noto Sans SC", Arial, sans-serif`;
  const titleLines = wrapText(
    ctx,
    title || (isZh ? '未命名片段' : 'Untitled segment'),
    maxTextWidth,
  ).slice(0, 2);
  ctx.font = `500 ${bodySize}px "Microsoft YaHei", "Noto Sans SC", Arial, sans-serif`;
  const bodyLines = wrapText(ctx, body || '', maxTextWidth).slice(0, 7);
  const textHeight =
    titleLines.length * titleLineHeight +
    (bodyLines.length ? Math.round(bodySize * 0.6) : 0) +
    bodyLines.length * bodyLineHeight;
  let y = height - margin - textHeight;

  ctx.fillStyle = renderStyle.panelColor;
  ctx.globalAlpha = 0.62;
  ctx.fillRect(
    margin * 0.72,
    y - bodySize * 0.8,
    width - margin * 1.44,
    textHeight + bodySize * 1.35,
  );
  ctx.globalAlpha = 1;

  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 12;
  ctx.font = `800 ${titleSize}px "Microsoft YaHei", "Noto Sans SC", Arial, sans-serif`;
  ctx.fillStyle = renderStyle.titleColor;
  const titleState = animatedTextState(
    renderStyle.titleAnimation,
    titleLines,
    animationLeadSeconds,
    elapsed,
    duration,
    forceFinalText,
  );
  ctx.save();
  ctx.globalAlpha = titleState.alpha;
  titleState.lines.forEach((line) => {
    ctx.fillText(line, margin, y + titleState.offsetY);
    y += titleLineHeight;
  });
  ctx.restore();

  if (bodyLines.length) y += Math.round(bodySize * 0.6);
  ctx.font = `500 ${bodySize}px "Microsoft YaHei", "Noto Sans SC", Arial, sans-serif`;
  ctx.fillStyle = renderStyle.bodyColor;
  const bodyState = animatedTextState(
    renderStyle.bodyAnimation,
    bodyLines,
    animationLeadSeconds,
    elapsed,
    duration,
    forceFinalText,
  );
  ctx.save();
  ctx.globalAlpha = bodyState.alpha;
  bodyState.lines.forEach((line) => {
    ctx.fillText(line, margin, y + bodyState.offsetY);
    y += bodyLineHeight;
  });
  ctx.restore();
  ctx.shadowBlur = 0;
};

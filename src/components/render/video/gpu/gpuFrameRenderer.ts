// GPU 帧渲染器 —— 适配现有 drawRenderFrame 接口
// 将 2D Canvas 文字渲染结果缓存为纹理，视频帧直接导入 GPU，
// 在 GPU 上完成最终合成。

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
import {
  type WebGPUContext,
  initWebGPU,
  importCanvasToTexture,
  renderCompositeFrame,
  destroyWebGPU,
} from './webgpuRenderer';

type GPURenderFrameInput = {
  gpu: WebGPUContext;
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

// 文字纹理缓存：key = nodeId + 文字内容 hash，避免逐帧重绘
const textTextureCache = new Map<string, { canvas: OffscreenCanvas; texture?: GPUTexture }>();

function getTextCacheKey(nodeId: string, title: string, body: string, style: RenderStyle): string {
  return `${nodeId}::${title}::${body}::${JSON.stringify(style)}`;
}

async function createTextLayerCanvas(
  width: number,
  height: number,
  title: string,
  body: string,
  style: RenderStyle,
  animationLeadSeconds: number,
  elapsed: number | undefined,
  duration: number | undefined,
  forceFinalText: boolean,
  isZh: boolean,
): Promise<OffscreenCanvas> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')! as unknown as CanvasRenderingContext2D;

  // 清空为透明
  ctx.clearRect(0, 0, width, height);

  const dialogLayout = await drawDialogueBox(ctx, width, height, style);
  const paddingX = dialogLayout.paddingX ?? dialogLayout.padding;
  const paddingY = dialogLayout.paddingY ?? dialogLayout.padding;
  const margin = dialogLayout.x + paddingX;
  const titleSize = Math.max(18, style.titleFontSize);
  const bodySize = Math.max(16, style.bodyFontSize);
  const titleLineHeight = Math.round(titleSize * Math.max(0.8, style.titleLineHeight));
  const bodyLineHeight = Math.round(bodySize * Math.max(0.8, style.bodyLineHeight));
  const maxTextWidth = dialogLayout.width - paddingX * 2;
  const textLeft = margin;
  const textRight = dialogLayout.x + dialogLayout.width - paddingX;

  // 文字面板
  ctx.font = `800 ${titleSize}px ${style.titleFontFamily}`;
  const titleLines = style.titleVisible
    ? wrapText(ctx, title || (isZh ? '未命名片段' : 'Untitled segment'), maxTextWidth).slice(0, 2)
    : [];
  ctx.font = `500 ${bodySize}px ${style.bodyFontFamily}`;
  const bodyLines = wrapText(ctx, body || '', maxTextWidth).slice(0, 7);
  const textHeight =
    titleLines.length * titleLineHeight +
    (bodyLines.length ? Math.round(bodySize * 0.6) : 0) +
    bodyLines.length * bodyLineHeight;
  let y = dialogLayout.y + Math.max(paddingY, (dialogLayout.height - textHeight) / 2);

  // 标题
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 12;
  ctx.font = `800 ${titleSize}px ${style.titleFontFamily}`;
  const titleState = animatedTextState(
    style.titleAnimation,
    titleLines,
    style.titleAnimationLeadSeconds ?? animationLeadSeconds,
    elapsed,
    duration,
    forceFinalText,
    style.titleTypewriterMode,
  );
  ctx.save();
  ctx.globalAlpha = titleState.alpha;
  titleState.lines.forEach((line) => {
    drawStyledLine(
      ctx,
      line,
      textX(style.titleAlign, textLeft, textRight),
      y + titleState.offsetY,
      {
        align: style.titleAlign,
        fillColor: colorWithAlpha(style.titleColor, style.titleColorAlpha),
        strokeColor: style.titleStrokeColor,
        strokeWidth: style.titleStrokeWidth,
        letterSpacing: style.titleLetterSpacing,
      },
    );
    y += titleLineHeight;
  });
  ctx.restore();

  // 正文
  if (bodyLines.length) y += Math.round(bodySize * 0.6);
  ctx.font = `500 ${bodySize}px ${style.bodyFontFamily}`;
  const bodyState = animatedTextState(
    style.bodyAnimation,
    bodyLines,
    style.bodyAnimationLeadSeconds ?? animationLeadSeconds,
    elapsed,
    duration,
    forceFinalText,
    style.bodyTypewriterMode,
  );
  ctx.save();
  ctx.globalAlpha = bodyState.alpha;
  bodyState.lines.forEach((line) => {
    drawStyledLine(ctx, line, textX(style.bodyAlign, textLeft, textRight), y + bodyState.offsetY, {
      align: style.bodyAlign,
      fillColor: colorWithAlpha(style.bodyColor, style.bodyColorAlpha),
      strokeColor: style.bodyStrokeColor,
      strokeWidth: style.bodyStrokeWidth,
      letterSpacing: style.bodyLetterSpacing,
    });
    y += bodyLineHeight;
  });
  ctx.restore();
  ctx.shadowBlur = 0;

  return canvas;
}

// 预渲染背景（图片模式）
async function createBackgroundCanvas(
  width: number,
  height: number,
  node: import('@xyflow/react').Node,
  media?: { source: CanvasImageSource; width: number; height: number },
  nodes: import('@xyflow/react').Node[] = [],
  elapsed?: number,
  duration?: number,
  activeInlineAction?: import('../../../../domain/project').InlinePresentationAction | null,
  activeInlineActionElapsed = 0,
  completedSwitchActions: import('../../../../domain/project').InlinePresentationAction[] = [],
  completedInlineActions: import('../../../../domain/project').InlinePresentationAction[] = [],
): Promise<OffscreenCanvas> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')! as unknown as CanvasRenderingContext2D;

  await drawPresentationVisuals({
    ctx,
    node,
    nodes,
    width,
    height,
    media,
    elapsed,
    duration,
    activeInlineAction,
    activeInlineActionElapsed,
    completedSwitchActions,
    completedInlineActions,
  });

  return canvas;
}

export async function drawGPUFrame({
  gpu,
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
}: GPURenderFrameInput): Promise<void> {
  const nodeId = node.id;
  const videoRenderStyle = getVideoTextRenderStyle(renderStyle, videoTextScaleMode, height);
  const title = htmlToSpeechText(String(node.data?.title || ''));
  const inlineState = inlinePlaybackStateAtTime({
    html: String(node.data?.text || ''),
    presentation: normalizeStoryPresentation(node.data?.presentation as StoryPresentation | undefined),
    elapsed,
    duration,
    options: { hideCharacterTags, hideSceneTags },
  });
  const body = htmlToSpeechText(
    filterMentionTags(inlineState.html, hideCharacterTags, hideSceneTags),
  );

  // 1. 准备背景纹理
  const bgCanvas = await createBackgroundCanvas(
    width,
    height,
    node,
    media,
    nodes,
    elapsed,
    duration,
    inlineState.activeAction,
    inlineState.activeActionElapsed,
    inlineState.completedSwitchActions,
    inlineState.completedInlineActions,
  );
  const bgTexture = importCanvasToTexture(gpu, bgCanvas, width, height);

  // 2. 准备文字纹理（带缓存）
  const cacheKey = getTextCacheKey(nodeId, title, body, videoRenderStyle);
  let textCanvas = textTextureCache.get(cacheKey)?.canvas;

  // 如果动画需要逐帧变化（elapsed 变化），不使用缓存
  const needsAnimation =
    !forceFinalText &&
    elapsed !== undefined &&
    duration !== undefined &&
    (videoRenderStyle.titleAnimation !== 'none' || videoRenderStyle.bodyAnimation !== 'none');

  if (needsAnimation || !textCanvas) {
    textCanvas = await createTextLayerCanvas(
      width,
      height,
      title,
      body,
      videoRenderStyle,
      animationLeadSeconds,
      elapsed,
      duration,
      forceFinalText,
      isZh,
    );
    if (!needsAnimation) {
      textTextureCache.set(cacheKey, { canvas: textCanvas });
    }
  }

  const textTexture = importCanvasToTexture(gpu, textCanvas, width, height);

  // 3. GPU 合成
  renderCompositeFrame(gpu, bgTexture, textTexture);

  // 4. 清理临时纹理（WebGPU texture 由 GC 管理）
  // 注意：不立即 destroy，让 GPU 队列完成后再释放
}

export function clearGPUTextCache(nodeId?: string): void {
  if (nodeId) {
    for (const key of textTextureCache.keys()) {
      if (key.startsWith(`${nodeId}::`)) {
        textTextureCache.delete(key);
      }
    }
  } else {
    textTextureCache.clear();
  }
}

export { initWebGPU, destroyWebGPU };
export type { WebGPUContext };

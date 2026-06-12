// GPU 帧渲染器 —— 适配现有 drawRenderFrame 接口
// 将 2D Canvas 文字渲染结果缓存为纹理，视频帧直接导入 GPU，
// 在 GPU 上完成最终合成。

import { htmlToSpeechText } from '../../../../lib/tts';
import { animatedTextState } from '../canvas/textAnimation';
import { drawPresentationVisuals } from '../shared/presentationRenderer';
import { filterMentionTags, wrapText } from '../shared/storyNodes';
import type { RenderStyle } from '../shared/types';
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

// 文字纹理缓存：key = nodeId + 文字内容 hash，避免逐帧重绘
const textTextureCache = new Map<string, { canvas: OffscreenCanvas; texture?: GPUTexture }>();

function getTextCacheKey(nodeId: string, title: string, body: string, style: RenderStyle): string {
  return `${nodeId}::${title}::${body}::${style.titleFontSize}:${style.bodyFontSize}:${style.titleColor}:${style.bodyColor}:${style.panelColor}`;
}

function createTextLayerCanvas(
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
): OffscreenCanvas {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')! as unknown as CanvasRenderingContext2D;

  // 清空为透明
  ctx.clearRect(0, 0, width, height);

  const margin = Math.max(48, width * 0.07);
  const titleSize = Math.max(18, style.titleFontSize);
  const bodySize = Math.max(16, style.bodyFontSize);
  const titleLineHeight = Math.round(titleSize * 1.25);
  const bodyLineHeight = Math.round(bodySize * 1.45);
  const maxTextWidth = width - margin * 2;

  // 绘制渐变遮罩
  const gradient = ctx.createLinearGradient(0, height * 0.45, 0, height);
  gradient.addColorStop(0, 'rgba(17, 24, 39, 0)');
  gradient.addColorStop(1, 'rgba(17, 24, 39, 0.88)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // 文字面板
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

  ctx.fillStyle = style.panelColor;
  ctx.globalAlpha = 0.62;
  ctx.fillRect(
    margin * 0.72,
    y - bodySize * 0.8,
    width - margin * 1.44,
    textHeight + bodySize * 1.35,
  );
  ctx.globalAlpha = 1;

  // 标题
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 12;
  ctx.font = `800 ${titleSize}px "Microsoft YaHei", "Noto Sans SC", Arial, sans-serif`;
  ctx.fillStyle = style.titleColor;
  const titleState = animatedTextState(
    style.titleAnimation,
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

  // 正文
  if (bodyLines.length) y += Math.round(bodySize * 0.6);
  ctx.font = `500 ${bodySize}px "Microsoft YaHei", "Noto Sans SC", Arial, sans-serif`;
  ctx.fillStyle = style.bodyColor;
  const bodyState = animatedTextState(
    style.bodyAnimation,
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
): Promise<OffscreenCanvas> {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')! as unknown as CanvasRenderingContext2D;

  await drawPresentationVisuals({ ctx, node, nodes, width, height, media, elapsed, duration });

  return canvas;
}

export async function drawGPUFrame({
  gpu,
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
}: GPURenderFrameInput): Promise<void> {
  const nodeId = node.id;
  const title = htmlToSpeechText(String(node.data?.title || ''));
  const body = htmlToSpeechText(
    filterMentionTags(
      String(node.data?.text || ''),
      hideCharacterTags,
      hideSceneTags,
    ),
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
  );
  const bgTexture = importCanvasToTexture(gpu, bgCanvas, width, height);

  // 2. 准备文字纹理（带缓存）
  const cacheKey = getTextCacheKey(nodeId, title, body, renderStyle);
  let textCanvas = textTextureCache.get(cacheKey)?.canvas;

  // 如果动画需要逐帧变化（elapsed 变化），不使用缓存
  const needsAnimation = !forceFinalText && elapsed !== undefined && duration !== undefined &&
    (renderStyle.titleAnimation !== 'none' || renderStyle.bodyAnimation !== 'none');

  if (needsAnimation || !textCanvas) {
    textCanvas = createTextLayerCanvas(
      width, height, title, body, renderStyle,
      animationLeadSeconds, elapsed, duration, forceFinalText, isZh,
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

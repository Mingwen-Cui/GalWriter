import type { Node as FlowNode } from '@xyflow/react';

import type { VideoCoverSettings } from '../shared/types';
import { loadCachedImage, loadVideo, seekVideo } from '../shared/mediaUtils';

export const DEFAULT_VIDEO_COVER: VideoCoverSettings = {
  sourceType: 'gradient',
  frameTime: 0,
  gradientStart: '#0f172a',
  gradientEnd: '#0e7490',
  title: '',
  subtitle: '',
  titleX: 50,
  titleY: 61,
  subtitleX: 50,
  subtitleY: 70,
  titleFontSize: 72,
  subtitleFontSize: 30,
  textAlign: 'center',
  logoPosition: 'bottomRight',
};

const drawCoverImage = (
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
) => {
  const scale = Math.max(width / Math.max(1, sourceWidth), height / Math.max(1, sourceHeight));
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
};

const wrapLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const lines: string[] = [];
  text.split(/\n+/).forEach((paragraph) => {
    let line = '';
    Array.from(paragraph.trim()).forEach((character) => {
      const next = line + character;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = character;
      } else {
        line = next;
      }
    });
    if (line) lines.push(line);
  });
  return lines;
};

const drawText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  xPercent: number,
  yPercent: number,
  fontSize: number,
  align: VideoCoverSettings['textAlign'],
  width: number,
  height: number,
  weight: number,
) => {
  if (!text.trim()) return;
  const size = Math.max(14, (fontSize / 1080) * height);
  ctx.save();
  ctx.font = `${weight} ${size}px "Noto Sans SC", "Microsoft YaHei", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, size * 0.075);
  ctx.strokeStyle = 'rgba(2, 6, 23, 0.62)';
  ctx.fillStyle = '#ffffff';
  const x = (Math.max(0, Math.min(100, xPercent)) / 100) * width;
  const lineHeight = size * 1.28;
  const lines = wrapLines(ctx, text, width * 0.78).slice(0, 4);
  const firstY = (Math.max(0, Math.min(100, yPercent)) / 100) * height -
    ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    const y = firstY + index * lineHeight;
    ctx.strokeText(line, x, y);
    ctx.fillText(line, x, y);
  });
  ctx.restore();
};

const drawLogo = async (
  ctx: CanvasRenderingContext2D,
  position: VideoCoverSettings['logoPosition'],
  width: number,
  height: number,
) => {
  try {
    const logo = await loadCachedImage('/glass.png');
    const size = Math.max(28, height * 0.058);
    const margin = Math.max(18, height * 0.032);
    const x = position === 'topLeft' || position === 'bottomLeft' ? margin : width - margin - size;
    const y = position === 'topLeft' || position === 'topRight' ? margin : height - margin - size;
    ctx.save();
    ctx.globalAlpha = 0.94;
    ctx.drawImage(logo, x, y, size, size);
    ctx.restore();
  } catch {
    // A cover remains usable when the bundled brand asset cannot be loaded.
  }
};

export const renderVideoCoverCanvas = async ({
  settings,
  nodes,
  width,
  height,
  canvas = document.createElement('canvas'),
}: {
  settings: VideoCoverSettings;
  nodes: FlowNode[];
  width: number;
  height: number;
  canvas?: HTMLCanvasElement;
}) => {
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cover canvas is unavailable.');

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, settings.gradientStart || '#0f172a');
  gradient.addColorStop(1, settings.gradientEnd || '#0e7490');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  try {
    if (settings.sourceType === 'image' && settings.imageUrl) {
      const image = await loadCachedImage(settings.imageUrl);
      drawCoverImage(ctx, image, image.naturalWidth, image.naturalHeight, width, height);
    }
    if (settings.sourceType === 'videoFrame' && settings.videoNodeId) {
      const node = nodes.find((candidate) => candidate.id === settings.videoNodeId);
      const source = typeof node?.data?.videoUrl === 'string' ? node.data.videoUrl : undefined;
      if (source) {
        const video = await loadVideo(source);
        await seekVideo(video, settings.frameTime || 0);
        drawCoverImage(ctx, video, video.videoWidth, video.videoHeight, width, height);
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    }
  } catch {
    // Keep the selected gradient visible if a local/remote media asset fails to load.
  }

  const shade = ctx.createLinearGradient(0, height * 0.35, 0, height);
  shade.addColorStop(0, 'rgba(2, 6, 23, 0)');
  shade.addColorStop(1, 'rgba(2, 6, 23, 0.62)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);
  drawText(
    ctx,
    settings.title,
    settings.titleX,
    settings.titleY,
    settings.titleFontSize,
    settings.textAlign,
    width,
    height,
    900,
  );
  drawText(
    ctx,
    settings.subtitle,
    settings.subtitleX,
    settings.subtitleY,
    settings.subtitleFontSize,
    settings.textAlign,
    width,
    height,
    600,
  );
  await drawLogo(ctx, settings.logoPosition, width, height);
  return canvas;
};

export const renderVideoCoverPngBytes = async (input: {
  settings: VideoCoverSettings;
  nodes: FlowNode[];
  width: number;
  height: number;
}) => {
  const canvas = await renderVideoCoverCanvas(input);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error('Cover PNG could not be created.'))), 'image/png');
  });
  return new Uint8Array(await blob.arrayBuffer());
};

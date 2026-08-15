import type { Node as FlowNode } from '@xyflow/react';

import { loadCachedImage, loadVideo, seekVideo } from '../shared/mediaUtils';
import type { VideoCoverElement, VideoCoverSettings } from '../shared/types';

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
  elements: [],
};

const drawCoverImage = (
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
  cropX = 50,
  cropY = 50,
  cropScale = 1,
) => {
  const scale = Math.max(width / Math.max(1, sourceWidth), height / Math.max(1, sourceHeight)) * Math.max(1, cropScale);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  const safeX = Math.max(0, Math.min(100, cropX)) / 100;
  const safeY = Math.max(0, Math.min(100, cropY)) / 100;
  ctx.drawImage(image, (width - drawWidth) * safeX, (height - drawHeight) * safeY, drawWidth, drawHeight);
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

const colorWithAlpha = (color: string | undefined, alpha: number | undefined) => {
  const source = color || '#ffffff';
  const match = source.match(/^#([0-9a-f]{6})$/i);
  if (!match) return source;
  const safeAlpha = Math.max(0, Math.min(100, alpha ?? 100)) / 100;
  const hex = match[1];
  return `rgba(${Number.parseInt(hex.slice(0, 2), 16)}, ${Number.parseInt(hex.slice(2, 4), 16)}, ${Number.parseInt(hex.slice(4, 6), 16)}, ${safeAlpha})`;
};

const getTextShadows = (element: VideoCoverElement) => {
  if (element.shadowEnabled === false) return [];
  const shadows = element.shadows?.length
    ? element.shadows
    : [{
        type: element.shadowType || 'outer',
        color: element.shadowColor || '#000000',
        opacity: element.shadowOpacity ?? 0,
        blur: element.shadowBlur ?? 18,
        offsetX: element.shadowOffsetX ?? 0,
        offsetY: element.shadowOffsetY ?? 2,
      }];
  return shadows.filter((shadow) => shadow.enabled !== false && shadow.type === 'outer' && shadow.opacity > 0);
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
  const firstY =
    (Math.max(0, Math.min(100, yPercent)) / 100) * height - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    const y = firstY + index * lineHeight;
    ctx.strokeText(line, x, y);
    ctx.fillText(line, x, y);
  });
  ctx.restore();
};

const drawCoverElement = async (
  ctx: CanvasRenderingContext2D,
  element: VideoCoverElement,
  width: number,
  height: number,
) => {
  if (!element.visible) return;
  const x = (element.x / 100) * width;
  const y = (element.y / 100) * height;
  const elementWidth = Math.max(1, (element.width / 100) * width);
  const elementHeight = Math.max(1, (element.height / 100) * height);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, element.opacity / 100));
  ctx.translate(x + elementWidth / 2, y + elementHeight / 2);
  ctx.rotate((element.rotation * Math.PI) / 180);
  ctx.translate(-elementWidth / 2, -elementHeight / 2);
  if (element.kind === 'image' && element.imageUrl) {
    try {
      const image = await loadCachedImage(element.imageUrl);
      if (element.objectFit === 'contain') {
        const scale = Math.min(elementWidth / image.naturalWidth, elementHeight / image.naturalHeight);
        const drawWidth = image.naturalWidth * scale;
        const drawHeight = image.naturalHeight * scale;
        ctx.drawImage(
          image,
          (elementWidth - drawWidth) / 2,
          (elementHeight - drawHeight) / 2,
          drawWidth,
          drawHeight,
        );
      } else {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, elementWidth, elementHeight);
        ctx.clip();
        drawCoverImage(
          ctx,
          image,
          image.naturalWidth,
          image.naturalHeight,
          elementWidth,
          elementHeight,
          element.imageCropX,
          element.imageCropY,
          element.imageCropScale,
        );
        ctx.restore();
      }
    } catch {
      // A missing asset should not stop the rest of the cover from exporting.
    }
  }
  if (element.kind === 'text' && element.textVisible !== false && element.text?.trim()) {
    const fontSize = Math.max(14, ((element.fontSize || 54) / 1080) * height);
    const textAlign = element.textAlign || 'center';
    const textX = textAlign === 'left' ? 0 : textAlign === 'right' ? elementWidth : elementWidth / 2;
    ctx.font = `${element.fontWeight || 800} ${fontSize}px ${element.fontFamily || '"Noto Sans SC", "Microsoft YaHei", sans-serif'}`;
    ctx.textAlign = textAlign;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const strokeWidth = element.strokeEnabled === false
      ? 0
      : Math.max(0, ((element.textStrokeWidth || 0) / 1080) * height);
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = element.textStrokeColor || '#000000';
    ctx.fillStyle = colorWithAlpha(element.textColor, element.textColorAlpha);
    const lineHeight = fontSize * (element.lineHeight || 1.28);
    const lines = wrapLines(ctx, element.text, elementWidth).slice(0, 5);
    const firstY = elementHeight / 2 - ((lines.length - 1) * lineHeight) / 2;
    const drawLines = () => lines.forEach((line, index) => {
      const lineY = firstY + index * lineHeight;
      if (strokeWidth > 0) ctx.strokeText(line, textX, lineY);
      ctx.fillText(line, textX, lineY);
    });
    getTextShadows(element).forEach((shadow) => {
      ctx.save();
      ctx.shadowColor = colorWithAlpha(shadow.color, shadow.opacity);
      ctx.shadowBlur = Math.max(0, ((shadow.blur || 0) / 1080) * height);
      ctx.shadowOffsetX = ((shadow.offsetX || 0) / 1080) * height;
      ctx.shadowOffsetY = ((shadow.offsetY || 0) / 1080) * height;
      drawLines();
      ctx.restore();
    });
    drawLines();
  }
  ctx.restore();
};

export const renderVideoCoverCanvas = async ({
  settings,
  nodes,
  width,
  height,
  canvas = document.createElement('canvas'),
  includeElements = true,
}: {
  settings: VideoCoverSettings;
  nodes: FlowNode[];
  width: number;
  height: number;
  canvas?: HTMLCanvasElement;
  includeElements?: boolean;
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
  if (includeElements) {
    const orderedElements = (settings.elements || [])
      .map((element, index) => ({ element, index }))
      .sort((left, right) => (left.element.zIndex ?? left.index) - (right.element.zIndex ?? right.index));
    for (const { element } of orderedElements) {
      await drawCoverElement(ctx, element, width, height);
    }
  }
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
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Cover PNG could not be created.'))),
      'image/png',
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
};

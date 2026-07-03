import type { Node as FlowNode } from '@xyflow/react';
import type { CSSProperties } from 'react';

import type { CharacterNodeData, CharacterPresentation, StoryPresentation } from '../../../../domain/project';
import { normalizeStoryPresentation } from '../../../../lib/presentation';
import { loadCachedImage } from './mediaUtils';
import type { RenderStyle } from './types';

export type NameplateItem = {
  sourceNodeId: string;
  name: string;
  config: CharacterPresentation;
};

export type NameplateLayout = {
  item: NameplateItem;
  x: number;
  y: number;
  width: number;
  height: number;
};

type DialogueLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const clampValue = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const colorWithAlpha = (color: string, alpha: number) => {
  const safeAlpha = clampValue(alpha / 100, 0, 1);
  const hex = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) {
    const red = Number.parseInt(hex.slice(1, 3), 16);
    const green = Number.parseInt(hex.slice(3, 5), 16);
    const blue = Number.parseInt(hex.slice(5, 7), 16);
    return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
  }
  return color;
};

export const getNameplateItems = (node: FlowNode, nodes: FlowNode[]): NameplateItem[] => {
  if (!node || !nodes.length) return [];
  const presentation = normalizeStoryPresentation(
    node.data?.presentation as StoryPresentation | undefined,
  );
  return presentation.characters
    .map((config) => {
      const source = nodes.find((item) => item.id === config.sourceNodeId);
      if (!source || source.type !== 'characterNode') return null;
      const data = source.data as CharacterNodeData;
      const name = String(data.characterName || source.data?.title || '').trim();
      if (!name) return null;
      return { sourceNodeId: config.sourceNodeId, name, config };
    })
    .filter((item): item is NameplateItem => Boolean(item));
};

export const getNameplateCharacterCenterX = (config: CharacterPresentation, width: number) => {
  const baseX = config.position === 'left' ? 0.24 : config.position === 'right' ? 0.76 : 0.5;
  return width * (baseX + config.offsetX / 1000);
};

const getGradientStops = (style: RenderStyle) =>
  style.nameplateGradientStops?.length >= 2
    ? [...style.nameplateGradientStops].sort((a, b) => a.position - b.position)
    : [
        { id: 'start', color: '#6366f1', alpha: 92, position: 0 },
        { id: 'end', color: '#ec4899', alpha: 82, position: 100 },
      ];

export const getNameplateCssBackground = (style: RenderStyle): CSSProperties => {
  if (style.nameplateBackgroundType === 'gradient') {
    const angle = Number.isFinite(style.nameplateGradientAngle) ? style.nameplateGradientAngle : 90;
    const stops = getGradientStops(style)
      .map((stop) => `${colorWithAlpha(stop.color, stop.alpha)} ${stop.position}%`)
      .join(', ');
    return { background: `linear-gradient(${angle}deg, ${stops})` };
  }
  if (style.nameplateBackgroundType === 'image' && style.nameplateImageUrl) {
    return {
      backgroundImage: `url("${style.nameplateImageUrl.replace(/"/g, '\\"')}")`,
      backgroundPosition: 'center',
      backgroundSize: 'cover',
    };
  }
  return {
    backgroundColor: colorWithAlpha(style.nameplateColor, style.nameplateColorAlpha ?? 86),
  };
};

export const measureNameplate = (
  ctx: CanvasRenderingContext2D,
  text: string,
  style: RenderStyle,
) => {
  const scale = clampValue((style.nameplateScale ?? 100) / 100, 0.5, 2);
  const fontSize = Math.max(10, style.nameplateFontSize ?? 18);
  const paddingX = Math.round(fontSize * 1.15 * scale);
  const paddingY = Math.round(fontSize * 0.42 * scale);
  ctx.font = `800 ${fontSize}px ${style.nameplateFontFamily || style.titleFontFamily}`;
  const width = Math.max(fontSize * 3.2, ctx.measureText(text).width + paddingX * 2);
  const height = Math.max(fontSize * 1.75, fontSize + paddingY * 2);
  return { width, height, fontSize, paddingX, paddingY };
};

export const getNameplateLayouts = (
  items: NameplateItem[],
  ctx: CanvasRenderingContext2D,
  stageWidth: number,
  dialogueLayout: DialogueLayout,
  style: RenderStyle,
): NameplateLayout[] => {
  if (!style.nameplateVisible || !items.length) return [];
  const gap = Math.max(8, (style.nameplateFontSize ?? 18) * 0.45);
  const offsetX = style.nameplateOffsetX ?? 0;
  const offsetY = style.nameplateOffsetY ?? 0;
  const measurements = items.map((item) => ({ item, ...measureNameplate(ctx, item.name, style) }));
  const baseY = style.nameplateInside
    ? dialogueLayout.y + gap + offsetY
    : dialogueLayout.y - Math.max(...measurements.map((item) => item.height)) - gap + offsetY;
  const minX = dialogueLayout.x + gap;
  const maxX = dialogueLayout.x + dialogueLayout.width - gap;

  const rawLayouts = measurements.map((measurement, index) => {
    const fixedStart =
      dialogueLayout.x +
      dialogueLayout.width / 2 -
      (measurements.reduce((sum, item) => sum + item.width, 0) + gap * (measurements.length - 1)) /
        2;
    const centerX = style.nameplateFollowCharacter
      ? getNameplateCharacterCenterX(measurement.item.config, stageWidth) + offsetX
      : fixedStart +
        measurements.slice(0, index).reduce((sum, item) => sum + item.width + gap, 0) +
        measurement.width / 2 +
        offsetX;
    const x = clampValue(centerX - measurement.width / 2, minX, maxX - measurement.width);
    return {
      item: measurement.item,
      x,
      y: baseY,
      width: measurement.width,
      height: measurement.height,
    };
  });

  const layouts = [...rawLayouts].sort((a, b) => a.x - b.x);
  for (let index = 1; index < layouts.length; index += 1) {
    const previous = layouts[index - 1];
    const current = layouts[index];
    current.x = Math.max(current.x, previous.x + previous.width + gap);
  }
  const overflow = layouts.length ? layouts[layouts.length - 1].x + layouts[layouts.length - 1].width - maxX : 0;
  if (overflow > 0) {
    layouts.forEach((layout) => {
      layout.x = Math.max(minX, layout.x - overflow);
    });
  }
  return layouts;
};

const roundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const safeRadius = Math.min(Math.max(0, radius), width / 2, height / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, safeRadius);
};

const fillNameplateBackground = async (
  ctx: CanvasRenderingContext2D,
  layout: NameplateLayout,
  style: RenderStyle,
) => {
  if (style.nameplateBackgroundType === 'image' && style.nameplateImageUrl) {
    try {
      const image = await loadCachedImage(style.nameplateImageUrl);
      const sourceWidth = image.naturalWidth || layout.width;
      const sourceHeight = image.naturalHeight || layout.height;
      const scale = Math.max(layout.width / sourceWidth, layout.height / sourceHeight);
      const drawWidth = sourceWidth * scale;
      const drawHeight = sourceHeight * scale;
      ctx.drawImage(
        image,
        layout.x + (layout.width - drawWidth) / 2,
        layout.y + (layout.height - drawHeight) / 2,
        drawWidth,
        drawHeight,
      );
      return;
    } catch {
      ctx.fillStyle = colorWithAlpha(style.nameplateColor, style.nameplateColorAlpha ?? 86);
      ctx.fillRect(layout.x, layout.y, layout.width, layout.height);
      return;
    }
  }
  if (style.nameplateBackgroundType === 'gradient') {
    const angle = (((Number.isFinite(style.nameplateGradientAngle) ? style.nameplateGradientAngle : 90) - 90) *
      Math.PI) /
      180;
    const length = Math.max(1, Math.hypot(layout.width, layout.height) / 2);
    const centerX = layout.x + layout.width / 2;
    const centerY = layout.y + layout.height / 2;
    const dx = Math.cos(angle) * length;
    const dy = Math.sin(angle) * length;
    const gradient = ctx.createLinearGradient(centerX - dx, centerY - dy, centerX + dx, centerY + dy);
    getGradientStops(style).forEach((stop) => {
      gradient.addColorStop(clampValue(stop.position / 100, 0, 1), colorWithAlpha(stop.color, stop.alpha));
    });
    ctx.fillStyle = gradient;
    ctx.fillRect(layout.x, layout.y, layout.width, layout.height);
    return;
  }
  ctx.fillStyle = colorWithAlpha(style.nameplateColor, style.nameplateColorAlpha ?? 86);
  ctx.fillRect(layout.x, layout.y, layout.width, layout.height);
};

export const drawNameplates = async (
  ctx: CanvasRenderingContext2D,
  stageWidth: number,
  dialogueLayout: DialogueLayout,
  style: RenderStyle,
  items: NameplateItem[],
) => {
  const layouts = getNameplateLayouts(items, ctx, stageWidth, dialogueLayout, style);
  if (!layouts.length) return layouts;

  for (const layout of layouts) {
    const fontSize = Math.max(10, style.nameplateFontSize ?? 18);
    ctx.save();
    roundedRect(
      ctx,
      layout.x,
      layout.y,
      layout.width,
      layout.height,
      Math.min(Math.max(0, style.nameplateRadius ?? 14), layout.height / 2),
    );
    ctx.clip();
    await fillNameplateBackground(ctx, layout, style);
    ctx.restore();

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 8;
    ctx.font = `800 ${fontSize}px ${style.nameplateFontFamily || style.titleFontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = colorWithAlpha(style.nameplateTextColor, style.nameplateTextColorAlpha ?? 100);
    ctx.fillText(layout.item.name, layout.x + layout.width / 2, layout.y + layout.height / 2);
    ctx.restore();
  }
  return layouts;
};

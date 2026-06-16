import { loadCachedImage } from './mediaUtils';
import type { RenderStyle } from './types';

export const getDialogueBoxLayout = (width: number, height: number, style: RenderStyle) => {
  const boxWidth = width * Math.min(1, Math.max(0.35, style.dialogWidth / 100));
  const boxHeight = height * Math.min(0.75, Math.max(0.16, style.dialogHeight / 100));
  const centeredX = (width - boxWidth) / 2;
  const baseY = height - Math.max(24, height * 0.045) - boxHeight;
  const offsetX = Math.min(100, Math.max(-100, style.dialogOffsetX ?? 0));
  const offsetY = Math.min(100, Math.max(-100, style.dialogOffsetY ?? 0));
  const x = Math.min(width - boxWidth, Math.max(0, centeredX + centeredX * (offsetX / 100)));
  const y = Math.min(
    height - boxHeight,
    Math.max(
      0,
      baseY +
        (offsetY / 100) *
          (offsetY < 0 ? Math.max(0, baseY) : Math.max(0, height - boxHeight - baseY)),
    ),
  );
  const padding = Math.max(20, Math.min(boxWidth, boxHeight) * 0.09);
  const paddingX = Math.max(
    12,
    Math.min(
      boxWidth * 0.32,
      boxWidth * Math.min(0.24, Math.max(0.02, (style.dialogTextPaddingX ?? 9) / 100)),
    ),
  );
  return { x, y, width: boxWidth, height: boxHeight, padding, paddingX, paddingY: padding };
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

const getGradientStops = (style: RenderStyle) => {
  if (style.dialogGradientStops?.length >= 2) {
    return [...style.dialogGradientStops].sort((a, b) => a.position - b.position);
  }
  return [
    { id: 'start', color: '#111827', alpha: 0, position: 0 },
    { id: 'end', color: '#111827', alpha: 86, position: 100 },
  ];
};

export const drawDialogueBox = async (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  style: RenderStyle,
) => {
  const layout = getDialogueBoxLayout(width, height, style);
  if (!style.dialogVisible) return layout;

  ctx.save();
  roundedRect(ctx, layout.x, layout.y, layout.width, layout.height, style.dialogRadius);
  ctx.clip();

  if (style.dialogBackgroundType === 'image' && style.dialogImageUrl) {
    try {
      const image = await loadCachedImage(style.dialogImageUrl);
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
    } catch {
      ctx.fillStyle = style.panelColor;
      ctx.fillRect(layout.x, layout.y, layout.width, layout.height);
    }
  } else if (style.dialogBackgroundType === 'gradient') {
    const angle = ((style.dialogGradientAngle - 90) * Math.PI) / 180;
    const length = Math.hypot(layout.width, layout.height) / 2;
    const centerX = layout.x + layout.width / 2;
    const centerY = layout.y + layout.height / 2;
    const dx = Math.cos(angle) * length;
    const dy = Math.sin(angle) * length;
    const gradient = ctx.createLinearGradient(
      centerX - dx,
      centerY - dy,
      centerX + dx,
      centerY + dy,
    );
    getGradientStops(style).forEach((stop) => {
      gradient.addColorStop(
        Math.min(1, Math.max(0, stop.position / 100)),
        colorWithAlpha(stop.color, stop.alpha),
      );
    });
    ctx.fillStyle = gradient;
    ctx.fillRect(layout.x, layout.y, layout.width, layout.height);
  } else {
    ctx.fillStyle = style.panelColor;
    ctx.globalAlpha = 0.82;
    ctx.fillRect(layout.x, layout.y, layout.width, layout.height);
  }

  ctx.restore();
  return layout;
};

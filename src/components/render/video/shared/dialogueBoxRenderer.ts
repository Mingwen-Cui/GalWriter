import { loadCachedImage } from './mediaUtils';
import type { RenderStyle } from './types';

export const getDialogueBoxLayout = (width: number, height: number, style: RenderStyle) => {
  const boxWidth = width * Math.min(0.98, Math.max(0.35, style.dialogWidth / 100));
  const boxHeight = height * Math.min(0.75, Math.max(0.16, style.dialogHeight / 100));
  const x = (width - boxWidth) / 2;
  const y = height - Math.max(24, height * 0.045) - boxHeight;
  const padding = Math.max(20, Math.min(boxWidth, boxHeight) * 0.09);
  return { x, y, width: boxWidth, height: boxHeight, padding };
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
    const gradient = ctx.createLinearGradient(
      layout.x,
      layout.y,
      layout.x,
      layout.y + layout.height,
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, style.dialogGradientColor || style.panelColor);
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

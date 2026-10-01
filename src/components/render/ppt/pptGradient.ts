import { parseColorValue } from '../shared/paint/colorValue';
import type { PptSlideBackgroundStyle } from '../video/shared/types';

type GradientLike = Pick<
  PptSlideBackgroundStyle,
  | 'gradientAngle'
  | 'gradientStart'
  | 'gradientEnd'
  | 'gradientShape'
  | 'gradientStops'
  | 'gradientStartX'
  | 'gradientStartY'
  | 'gradientEndX'
  | 'gradientEndY'
>;

const colorAtAlpha = (color: string, alpha: number) => {
  const parsed = parseColorValue(color, '#111827');
  const value = Number.parseInt(parsed.hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${(parsed.alpha * alpha) / 10000})`;
};

export const renderPptGradientPng = (
  gradient: GradientLike,
  width: number,
  height: number,
  cornerRadius = 0,
) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not render a PPT gradient fill.');

  const stops =
    (gradient.gradientStops?.length ?? 0) >= 2
      ? [...gradient.gradientStops!].sort((left, right) => left.position - right.position)
      : [
          { id: 'start', color: gradient.gradientStart || '#0f172a', alpha: 100, position: 0 },
          { id: 'end', color: gradient.gradientEnd || '#0e7490', alpha: 100, position: 100 },
        ];
  const angle = (((gradient.gradientAngle || 0) - 90) * Math.PI) / 180;
  const diagonal =
    Math.abs(canvas.width * Math.cos(angle)) + Math.abs(canvas.height * Math.sin(angle));
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  let fill: CanvasGradient;
  if (gradient.gradientShape === 'radial') {
    fill = context.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      Math.max(canvas.width, canvas.height) / 2,
    );
  } else if (gradient.gradientShape === 'diamond' && 'createConicGradient' in context) {
    fill = context.createConicGradient(
      (((gradient.gradientAngle || 0) + 45 - 90) * Math.PI) / 180,
      centerX,
      centerY,
    );
  } else {
    fill = context.createLinearGradient(
      centerX - (Math.cos(angle) * diagonal) / 2,
      centerY - (Math.sin(angle) * diagonal) / 2,
      centerX + (Math.cos(angle) * diagonal) / 2,
      centerY + (Math.sin(angle) * diagonal) / 2,
    );
  }
  stops.forEach((stop) => {
    fill.addColorStop(
      Math.max(0, Math.min(1, Number(stop.position) / 100)),
      colorAtAlpha(stop.color, Number(stop.alpha ?? 100)),
    );
  });
  context.fillStyle = fill;
  if (cornerRadius > 0) {
    context.beginPath();
    context.roundRect(0, 0, canvas.width, canvas.height, Math.min(cornerRadius, canvas.height / 2));
    context.fill();
  } else {
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  return canvas.toDataURL('image/png');
};

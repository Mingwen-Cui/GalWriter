import type { CSSProperties } from 'react';

import type { WebMenuElement } from '../video/shared/types';
import { linearGradientFromStops, normalizeGradientStops } from './webGradientStops';

export const webColorWithAlpha = (
  color: string | undefined,
  alpha: number | undefined,
  fallback = '#000000',
) => {
  const safeColor = color || fallback;
  const safeAlpha = Math.max(0, Math.min(100, alpha ?? 100)) / 100;
  const match = safeColor.match(/^#([0-9a-f]{6})$/i);
  if (!match) return safeColor;
  const hex = match[1];
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
};

export const webElementShadowStyle = (
  element: WebMenuElement,
  target: 'box' | 'text',
): CSSProperties => {
  if (element.shadowEnabled === false) return {};
  const opacity = Math.max(0, Math.min(100, element.shadowOpacity ?? 0));
  if (opacity <= 0) return {};
  const x = element.shadowOffsetX ?? 0;
  const y = element.shadowOffsetY ?? (target === 'text' ? 2 : 8);
  const blur = element.shadowBlur ?? 18;
  const color = webColorWithAlpha(element.shadowColor, opacity, '#000000');
  if (target === 'text') {
    return { textShadow: `${x}px ${y}px ${blur}px ${color}` };
  }
  const type = element.shadowType || 'outer';
  if (type === 'inner') return { boxShadow: `inset ${x}px ${y}px ${blur}px ${color}` };
  if (type === 'innerBlur') return { boxShadow: `inset 0 0 ${blur}px ${color}` };
  return { boxShadow: `${x}px ${y}px ${blur}px ${color}` };
};

const webElementBorderParts = (element: WebMenuElement) => {
  if (element.strokeEnabled === false) return { style: {} as CSSProperties, shadow: '' };
  const width = Math.max(0, Number(element.borderWidth ?? 0) || 0);
  if (width <= 0) return { style: {} as CSSProperties, shadow: '' };
  const position = element.borderPosition || 'center';
  const isGradient = element.borderType === 'gradient';
  const borderPaint = isGradient
    ? linearGradientFromStops(
        element.borderGradientAngle ?? 135,
        normalizeGradientStops(
          element.borderGradientStops,
          element.borderGradientStart || element.borderColor || '#ffffff',
          element.borderGradientEnd || '#4f46e5',
        ),
      )
    : element.borderColor || '#ffffff';

  if (!isGradient) {
    if (position === 'inside') {
      return { style: { border: 0 } as CSSProperties, shadow: `inset 0 0 0 ${width}px ${borderPaint}` };
    }
    if (position === 'outside') {
      return {
        style: { border: 0, outline: `${width}px solid ${borderPaint}`, outlineOffset: 0 } as CSSProperties,
        shadow: '',
      };
    }
    const halfWidth = width / 2;
    return {
      style: {
        border: 0,
      } as CSSProperties,
      shadow: `inset 0 0 0 ${halfWidth}px ${borderPaint}, 0 0 0 ${halfWidth}px ${borderPaint}`,
    };
  }

  return {
    style: {
      border: `${width}px solid transparent`,
      borderImage: `${borderPaint} 1`,
      boxSizing: 'border-box',
    } as CSSProperties,
    shadow: '',
  };
};

export const webElementBorderStyle = (element: WebMenuElement): CSSProperties =>
  webElementBorderParts(element).style;

export const webElementBoxStyle = (element: WebMenuElement): CSSProperties => {
  const border = webElementBorderParts(element);
  const shadow = webElementShadowStyle(element, 'box');
  const shadows = [border.shadow, shadow.boxShadow].filter(Boolean).join(', ');
  return {
    ...border.style,
    ...shadow,
    ...(shadows ? { boxShadow: shadows } : {}),
  };
};

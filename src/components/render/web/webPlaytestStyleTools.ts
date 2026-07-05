import type { CSSProperties } from 'react';

import { webAnimationStyle } from '../video/shared/storyNodes';
import type { RenderStyle, WebExportSettings } from '../video/shared/types';

export const colorInputValue = (value: string, fallback = '#111827') => {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  const rgba = trimmed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!rgba) return fallback;
  return `#${[rgba[1], rgba[2], rgba[3]]
    .map((channel) => Number(channel).toString(16).padStart(2, '0'))
    .join('')}`;
};

export const withAlpha = (hex: string, alpha: number) => {
  const normalized = colorInputValue(hex);
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const textStroke = (width: number, color: string) =>
  width > 0 ? `${width}px ${colorInputValue(color, '#000000')}` : undefined;

export const buildDialogueBackgroundStyle = (renderStyle: RenderStyle): CSSProperties => {
  const gradientStops =
    renderStyle.dialogGradientStops?.length >= 2
      ? [...renderStyle.dialogGradientStops].sort((a, b) => a.position - b.position)
      : [
          {
            color: colorInputValue(renderStyle.dialogGradientStartColor),
            alpha: 0,
            position: 0,
          },
          {
            color: colorInputValue(renderStyle.dialogGradientColor),
            alpha: 86,
            position: 100,
          },
        ];

  if (renderStyle.dialogBackgroundType === 'gradient') {
    const angle = Number.isFinite(renderStyle.dialogGradientAngle)
      ? renderStyle.dialogGradientAngle
      : 90;
    const stops = gradientStops
      .map((stop) => `${withAlpha(stop.color, stop.alpha / 100)} ${stop.position}%`)
      .join(', ');
    return { background: `linear-gradient(${angle}deg, ${stops})` };
  }
  if (renderStyle.dialogBackgroundType === 'image' && renderStyle.dialogImageUrl) {
    return {
      backgroundImage: `url("${renderStyle.dialogImageUrl.replace(/"/g, '\\"')}")`,
      backgroundPosition: 'center',
      backgroundSize: 'cover',
    };
  }
  return {
    backgroundColor: withAlpha(renderStyle.panelColor, (renderStyle.panelColorAlpha ?? 82) / 100),
  };
};

export const buildTitleStyle = (renderStyle: RenderStyle): CSSProperties => ({
  fontFamily: renderStyle.titleFontFamily,
  color: withAlpha(
    colorInputValue(renderStyle.titleColor),
    (renderStyle.titleColorAlpha ?? 100) / 100,
  ),
  WebkitTextStroke: textStroke(renderStyle.titleStrokeWidth, renderStyle.titleStrokeColor),
  fontSize: renderStyle.titleFontSize,
  letterSpacing: `${renderStyle.titleLetterSpacing ?? 0}px`,
  lineHeight: renderStyle.titleLineHeight,
  textAlign: renderStyle.titleAlign,
  overflowWrap: 'anywhere',
  ...webAnimationStyle(renderStyle.titleAnimation),
});

export const buildBodyStyle = (renderStyle: RenderStyle): CSSProperties => ({
  fontFamily: renderStyle.bodyFontFamily,
  color: withAlpha(
    colorInputValue(renderStyle.bodyColor),
    (renderStyle.bodyColorAlpha ?? 100) / 100,
  ),
  WebkitTextStroke: textStroke(renderStyle.bodyStrokeWidth, renderStyle.bodyStrokeColor),
  fontSize: renderStyle.bodyFontSize,
  letterSpacing: `${renderStyle.bodyLetterSpacing ?? 0}px`,
  lineHeight: renderStyle.bodyLineHeight,
  textAlign: renderStyle.bodyAlign,
  overflowWrap: 'anywhere',
  ...webAnimationStyle(renderStyle.bodyAnimation),
});

export const buildDialogueShellStyle = (
  renderStyle: RenderStyle,
  layoutMode: WebExportSettings['layoutMode'],
): CSSProperties => ({
  ...(renderStyle.dialogVisible
    ? buildDialogueBackgroundStyle(renderStyle)
    : {
        background: 'transparent',
        backgroundColor: 'transparent',
        backgroundImage: 'none',
        borderColor: 'transparent',
        boxShadow: 'none',
        backdropFilter: 'none',
      }),
  borderRadius: renderStyle.dialogRadius,
  maxHeight: layoutMode === 'immersive' ? 'calc(100% - 96px)' : undefined,
  paddingLeft: `${Math.max(2, renderStyle.dialogTextPaddingX ?? 9)}%`,
  paddingRight: `${Math.max(2, renderStyle.dialogTextPaddingX ?? 9)}%`,
});

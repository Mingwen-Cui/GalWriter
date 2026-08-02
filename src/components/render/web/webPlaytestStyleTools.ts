import type { CSSProperties } from 'react';

import {
  resolvePresentationDialogueLayout,
  resolvePresentationTextScale,
} from '../video/shared/presentationLayout';
import { getRenderObjects } from '../video/shared/renderObjects';
import { webAnimationStyle } from '../video/shared/storyNodes';
import type { RenderStyle } from '../video/shared/types';
import type { RenderEditableObject, RenderFillStyle } from '../video/shared/types';

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

const fillPaint = (fill: RenderFillStyle): string => {
  if (fill.type === 'gradient') {
    const stops = [...fill.gradientStops]
      .sort((a, b) => a.position - b.position)
      .map((stop) => `${withAlpha(stop.color, stop.alpha / 100)} ${stop.position}%`)
      .join(', ');
    if (fill.gradientType === 'radial') return `radial-gradient(circle at center, ${stops})`;
    if (fill.gradientType === 'angular')
      return `conic-gradient(from ${fill.gradientAngle}deg at center, ${stops})`;
    if (fill.gradientType === 'diamond')
      return `conic-gradient(from ${fill.gradientAngle + 45}deg at center, ${stops})`;
    return `linear-gradient(${fill.gradientAngle}deg, ${stops})`;
  }
  if (fill.type === 'image' && fill.imageUrl) return `url("${fill.imageUrl.replace(/"/g, '\\"')}")`;
  return withAlpha(fill.color, fill.alpha / 100);
};

const shadowPaint = (object: RenderEditableObject) => {
  const layers = object.shadows?.length ? object.shadows : [object.shadow];
  const value = layers
    .filter((shadow) => shadow.enabled && shadow.alpha > 0)
    .map((shadow) => {
      const inset = shadow.type === 'outer' ? '' : 'inset ';
      const x = shadow.type === 'innerBlur' ? 0 : shadow.x;
      const y = shadow.type === 'innerBlur' ? 0 : shadow.y;
      return `${inset}${x}px ${y}px ${shadow.blur}px ${shadow.spread}px ${withAlpha(shadow.color, shadow.alpha / 100)}`;
    })
    .join(', ');
  return value || undefined;
};

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

export const buildTitleStyle = (renderStyle: RenderStyle, canvasHeight: number): CSSProperties => {
  const scale = resolvePresentationTextScale(canvasHeight);
  return {
    ...textObjectStyle(renderStyle, 'title'),
    fontFamily: renderStyle.titleFontFamily,
    color: textColor(renderStyle, 'title'),
    fontSize: Math.max(18, renderStyle.titleFontSize * scale),
    letterSpacing: `${(renderStyle.titleLetterSpacing ?? 0) * scale}px`,
    lineHeight: renderStyle.titleLineHeight,
    textAlign: renderStyle.titleAlign,
    overflowWrap: 'anywhere',
    ...webAnimationStyle(renderStyle.titleAnimation),
    textShadow: shadowPaint(getRenderObjects(renderStyle).title),
  };
};

export const buildBodyStyle = (renderStyle: RenderStyle, canvasHeight: number): CSSProperties => {
  const scale = resolvePresentationTextScale(canvasHeight);
  return {
    ...textObjectStyle(renderStyle, 'body'),
    fontFamily: renderStyle.bodyFontFamily,
    color: textColor(renderStyle, 'body'),
    fontSize: Math.max(16, renderStyle.bodyFontSize * scale),
    letterSpacing: `${(renderStyle.bodyLetterSpacing ?? 0) * scale}px`,
    lineHeight: renderStyle.bodyLineHeight,
    textAlign: renderStyle.bodyAlign,
    overflowWrap: 'anywhere',
    ...webAnimationStyle(renderStyle.bodyAnimation),
    textShadow: shadowPaint(getRenderObjects(renderStyle).body),
  };
};

export const buildDialogueShellStyle = (
  renderStyle: RenderStyle,
  canvasWidth: number,
  canvasHeight: number,
): CSSProperties => {
  const object = getRenderObjects(renderStyle).dialogBox;
  const layout = resolvePresentationDialogueLayout(canvasWidth, canvasHeight, renderStyle);
  return {
    ...(object.visible
      ? {
          background: fillPaint(object.fill),
          backgroundSize: object.fill.type === 'image' ? 'cover' : undefined,
          backgroundPosition: object.fill.type === 'image' ? 'center' : undefined,
          border:
            object.stroke.enabled && object.stroke.type === 'solid'
              ? `${object.stroke.width}px solid ${withAlpha(object.stroke.color, object.stroke.alpha / 100)}`
              : undefined,
          boxShadow: shadowPaint(object),
        }
      : {
          background: 'transparent',
          backgroundColor: 'transparent',
          backgroundImage: 'none',
          borderColor: 'transparent',
          boxShadow: 'none',
          backdropFilter: 'none',
        }),
    borderRadius: object.radius,
    position: 'absolute',
    boxSizing: 'border-box',
    left: layout.x,
    top: layout.y,
    width: layout.width,
    height: layout.height,
    padding: `${layout.paddingY}px ${layout.paddingX}px`,
    transform: `rotate(${object.rotation}deg) scale(${object.flipX ? -1 : 1}, ${object.flipY ? -1 : 1})`,
    transformOrigin: 'center',
  };
};

const objectTransform = (renderStyle: RenderStyle, kind: 'dialogBox' | 'title' | 'body') => {
  const object = getRenderObjects(renderStyle)[kind];
  const transforms = [
    `translate(${object.x}px, ${object.y}px)`,
    `rotate(${object.rotation}deg)`,
    `scale(${object.flipX ? -1 : 1}, ${object.flipY ? -1 : 1})`,
  ].filter(Boolean);
  return transforms.length ? transforms.join(' ') : undefined;
};

const textObjectStyle = (renderStyle: RenderStyle, kind: 'title' | 'body'): CSSProperties => {
  const object = getRenderObjects(renderStyle)[kind];
  return {
    display: object.visible ? undefined : 'none',
    boxSizing: 'border-box',
    overflow: 'hidden',
    width: object.width ? `${object.width}%` : undefined,
    height: object.height ? `${object.height}px` : undefined,
    minHeight: object.height ? `${object.height}px` : undefined,
    transform: objectTransform(renderStyle, kind),
    textDecoration: [
      object.underline ? 'underline' : '',
      object.strikethrough ? 'line-through' : '',
    ]
      .filter(Boolean)
      .join(' '),
    fontWeight: object.fontWeight,
    ...(object.fill.type === 'gradient' || object.fill.type === 'image'
      ? {
          backgroundImage: fillPaint(object.fill),
          backgroundSize: object.fill.type === 'image' ? 'cover' : undefined,
          backgroundPosition: object.fill.type === 'image' ? 'center' : undefined,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
        }
      : {}),
    ...(object.stroke.enabled && object.stroke.type === 'solid'
      ? { WebkitTextStroke: textStroke(object.stroke.width, object.stroke.color) }
      : {}),
  };
};

const textColor = (renderStyle: RenderStyle, kind: 'title' | 'body') => {
  const fill = getRenderObjects(renderStyle)[kind].fill;
  return fill.type === 'solid' ? withAlpha(fill.color, fill.alpha / 100) : 'transparent';
};

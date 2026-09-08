import type { BackgroundPaint } from './BackgroundFillInspector';
import type { RenderEditableObject, WebMenuElement } from '../../video/shared/types';
import { toHex8 } from './colorValue';

export type PaintLayer = BackgroundPaint & { id: string; enabled: boolean; opacity: number };
export type OutlineLayer = {
  id: string;
  enabled: boolean;
  color: string;
  width: number;
  position: 'inside' | 'center' | 'outside';
};
export type ShadowLayer = {
  id: string;
  enabled: boolean;
  color: string;
  x: number;
  y: number;
  blur: number;
  spread: number;
  inset: boolean;
};
/** First item is the uppermost layer. Empty arrays mean no effect, never legacy fallback. */
export type SurfaceAppearance = {
  fills: PaintLayer[];
  strokes: OutlineLayer[];
  shadows: ShadowLayer[];
};
export const newPaint = (): PaintLayer => ({
  id: crypto.randomUUID(),
  enabled: true,
  opacity: 100,
  type: 'solid',
  color: '#111827d1',
  gradientStart: '#6366f1',
  gradientEnd: '#ec4899',
  gradientAngle: 135,
  imageUrl: '',
  videoUrl: '',
  videoLoop: true,
  videoMuted: true,
  videoFit: 'crop',
});
export const newOutline = (): OutlineLayer => ({
  id: crypto.randomUUID(),
  enabled: true,
  color: '#ffffff',
  width: 1,
  position: 'inside',
});
export const newShadow = (): ShadowLayer => ({
  id: crypto.randomUUID(),
  enabled: true,
  color: '#00000040',
  x: 0,
  y: 8,
  blur: 24,
  spread: 0,
  inset: false,
});
export function webAppearance(e: WebMenuElement): SurfaceAppearance {
  if (e.appearance) return e.appearance;
  return {
    fills: [
      {
        ...newPaint(),
        id: 'legacy-fill',
        enabled: e.fillEnabled !== false,
        type: e.backgroundType || 'solid',
        color: e.backgroundColor || '#11182700',
        gradientStart: e.backgroundGradientStart || '#6366f1',
        gradientEnd: e.backgroundGradientEnd || '#ec4899',
        gradientAngle: e.backgroundGradientAngle ?? 135,
        gradientShape: e.backgroundGradientShape,
        gradientStops: e.backgroundGradientStops,
        imageUrl: e.backgroundImageUrl || '',
        opacity: e.backgroundType === 'image' ? (e.backgroundImageAlpha ?? 100) : 100,
      },
    ],
    strokes:
      e.strokeEnabled !== false && (e.borderWidth || 0) > 0
        ? [
            {
              id: 'legacy-stroke',
              enabled: true,
              color: e.borderColor || '#ffffff',
              width: e.borderWidth || 1,
              position: e.borderPosition || 'center',
            },
          ]
        : [],
    shadows: (
      e.shadows ||
      (e.shadowOpacity
        ? [
            {
              id: 'legacy-shadow',
              color: e.shadowColor || '#000000',
              opacity: e.shadowOpacity,
              offsetX: e.shadowOffsetX || 0,
              offsetY: e.shadowOffsetY || 0,
              blur: e.shadowBlur || 0,
              type: e.shadowType,
            },
          ]
        : [])
    ).map((s) => ({
      id: s.id,
      enabled: e.shadowEnabled !== false && s.enabled !== false,
      color: toHex8(s.color, s.opacity),
      x: s.offsetX,
      y: s.offsetY,
      blur: s.blur,
      spread: 0,
      inset: s.type !== 'outer' && !!s.type,
    })),
  };
}
export function objectAppearance(e: RenderEditableObject): SurfaceAppearance {
  if (e.appearance) return e.appearance;
  return {
    fills: [
      {
        ...newPaint(),
        id: 'legacy-fill',
        enabled: e.fill.enabled,
        type: e.fill.type,
        color: toHex8(e.fill.color, e.fill.alpha),
        gradientStart: e.fill.gradientStops[0]?.color || '#6366f1',
        gradientEnd: e.fill.gradientStops.at(-1)?.color || '#ec4899',
        gradientAngle: e.fill.gradientAngle,
        gradientShape: e.fill.gradientType === 'angular' ? 'linear' : e.fill.gradientType,
        gradientStops: e.fill.gradientStops,
        imageUrl: e.fill.imageUrl,
        opacity: e.fill.type === 'image' ? e.fill.imageAlpha : 100,
      },
    ],
    strokes: e.stroke.enabled
      ? [
          {
            id: 'legacy-stroke',
            enabled: true,
            color: toHex8(e.stroke.color, e.stroke.alpha),
            width: e.stroke.width,
            position: e.stroke.position,
          },
        ]
      : [],
    shadows: (e.shadows || [e.shadow]).map((s, i) => ({
      id: `shadow-${i}`,
      enabled: s.enabled,
      color: toHex8(s.color, s.alpha),
      x: s.x,
      y: s.y,
      blur: s.blur,
      spread: s.spread,
      inset: s.type !== 'outer',
    })),
  };
}

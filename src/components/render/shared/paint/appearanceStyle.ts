import type { CSSProperties } from 'react';
import type { PaintLayer, SurfaceAppearance } from './appearance';
import { gradientFromStops, normalizeGradientStops } from './gradient';
import { resolveKnownAppAssetUrl } from '../../../../lib/appAssets';

export function paintLayerBackground(fill: PaintLayer): string {
  if (fill.type === 'gradient')
    return gradientFromStops(
      fill.gradientShape || 'linear',
      fill.gradientAngle,
      normalizeGradientStops(fill.gradientStops, fill.gradientStart, fill.gradientEnd),
    );
  if (fill.type === 'image')
    return fill.imageUrl
      ? `url(${JSON.stringify(resolveKnownAppAssetUrl(fill.imageUrl))})`
      : 'none';
  return fill.type === 'video' ? 'none' : `linear-gradient(${fill.color}, ${fill.color})`;
}
export function appearanceStyle(value: SurfaceAppearance): CSSProperties {
  const shadows = value.shadows
    .filter((s) => s.enabled)
    .map((s) => `${s.inset ? 'inset ' : ''}${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`);
  const outlines = value.strokes
    .filter((s) => s.enabled)
    .flatMap((s) =>
      s.position === 'center'
        ? [`inset 0 0 0 ${s.width / 2}px ${s.color}`, `0 0 0 ${s.width / 2}px ${s.color}`]
        : [`${s.position === 'inside' ? 'inset ' : ''}0 0 0 ${s.width}px ${s.color}`],
    );
  return {
    backgroundColor: 'transparent',
    backgroundImage:
      value.fills
        .filter((f) => f.enabled && f.opacity > 0 && f.type !== 'video')
        .map(paintLayerBackground)
        .join(', ') || 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    border: 0,
    outline: 0,
    boxShadow: [...outlines, ...shadows].join(', ') || 'none',
  };
}

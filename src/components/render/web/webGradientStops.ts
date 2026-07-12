import type { StyleGradientStop } from '../video/controls/StyleControlTiles';
import { colorInputValue, withAlpha } from '../video/controls/StyleControlTiles';

export function normalizeGradientStops(
  stops: StyleGradientStop[] | undefined,
  startColor: string,
  endColor: string,
  startFallback = '#0ea5e9',
  endFallback = '#0f172a',
) {
  if (stops && stops.length >= 2) {
    return [...stops]
      .map((stop) => ({
        id: stop.id,
        color: colorInputValue(stop.color, startFallback),
        alpha: Math.min(100, Math.max(0, Number(stop.alpha) || 0)),
        position: Math.min(100, Math.max(0, Number(stop.position) || 0)),
      }))
      .sort((a, b) => a.position - b.position);
  }

  return [
    {
      id: 'start',
      color: colorInputValue(startColor, startFallback),
      alpha: 100,
      position: 0,
    },
    {
      id: 'end',
      color: colorInputValue(endColor, endFallback),
      alpha: 100,
      position: 100,
    },
  ];
}

export function gradientStopsCss(stops: StyleGradientStop[]) {
  return stops
    .map((stop) => `${withAlpha(stop.color, stop.alpha / 100)} ${stop.position}%`)
    .join(', ');
}

export function linearGradientFromStops(angle: number, stops: StyleGradientStop[]) {
  return `linear-gradient(${angle}deg, ${gradientStopsCss(stops)})`;
}

export function gradientFromStops(
  shape: 'linear' | 'radial' | 'diamond' | undefined,
  angle: number,
  stops: StyleGradientStop[],
  geometry?: { startX?: number; startY?: number; endX?: number; endY?: number },
) {
  let renderedStops = stops;
  if (shape !== 'radial' && geometry && [geometry.startX, geometry.startY, geometry.endX, geometry.endY].every(Number.isFinite)) {
    const startX = Number(geometry.startX) / 100;
    const startY = Number(geometry.startY) / 100;
    const endX = Number(geometry.endX) / 100;
    const endY = Number(geometry.endY) / 100;
    const dx = endX - startX;
    const dy = endY - startY;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared > 0.0001) {
      const projections = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => x * dx + y * dy);
      const min = Math.min(...projections);
      const max = Math.max(...projections);
      const span = Math.max(0.0001, max - min);
      const startProjection = (startX * dx + startY * dy - min) / span * 100;
      const endProjection = (endX * dx + endY * dy - min) / span * 100;
      renderedStops = stops.map((stop) => ({
        ...stop,
        position: startProjection + (endProjection - startProjection) * stop.position / 100,
      }));
    }
  }
  const cssStops = gradientStopsCss(renderedStops);
  if (shape === 'radial') return `radial-gradient(circle at center, ${cssStops})`;
  if (shape === 'diamond') return `conic-gradient(from ${angle}deg at center, ${cssStops})`;
  return `linear-gradient(${angle}deg, ${cssStops})`;
}

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

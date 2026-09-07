import type { RenderColorStop as StyleGradientStop } from '../../video/shared/types';
import { parseColorValue, toHex8 } from './colorValue';

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
        color: parseColorValue(stop.color, startFallback).hex,
        alpha: Math.min(
          100,
          Math.max(0, Number(stop.alpha ?? parseColorValue(stop.color, startFallback).alpha) || 0),
        ),
        position: Math.min(100, Math.max(0, Number(stop.position) || 0)),
      }))
      .sort((a, b) => a.position - b.position);
  }

  return [
    {
      id: 'start',
      color: parseColorValue(startColor, startFallback).hex,
      alpha: parseColorValue(startColor, startFallback).alpha,
      position: 0,
    },
    {
      id: 'end',
      color: parseColorValue(endColor, endFallback).hex,
      alpha: parseColorValue(endColor, endFallback).alpha,
      position: 100,
    },
  ];
}

export function gradientStopsCss(stops: StyleGradientStop[]) {
  return stops.map((stop) => `${toHex8(stop.color, stop.alpha)} ${stop.position}%`).join(', ');
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
  // 控制线更新时会同步写入 angle；其长度不能再重映射色标，否则内部起点前会整块铺满首色。
  // 保留该参数以兼容已有项目数据与调用方，渐变范围始终由色标的 0–100% 决定。
  void geometry;
  const cssStops = gradientStopsCss(stops);
  if (shape === 'radial') return `radial-gradient(circle at center, ${cssStops})`;
  if (shape === 'diamond') return `conic-gradient(from ${angle}deg at center, ${cssStops})`;
  return `linear-gradient(${angle}deg, ${cssStops})`;
}

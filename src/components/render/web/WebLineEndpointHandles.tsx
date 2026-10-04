import { useEffect, useRef } from 'react';
import type { WebMenuElement } from '../video/shared/types';
import { placementGeometry, snapLineEnd, webLineEndpoints } from './webElementPlacement';

export function WebLineEndpointHandles({ element, canvasWidth, canvasHeight, onUpdate }: {
  element: WebMenuElement; canvasWidth: number; canvasHeight: number;
  onUpdate: (id: string, patch: Partial<WebMenuElement>) => void;
}) {
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  return <>{([0, 1] as const).map((endpoint) => <span
    key={endpoint}
    data-editable-frame-control="line-endpoint"
    aria-label={endpoint === 0 ? '线条起点' : '线条终点'}
    className="pointer-events-auto absolute top-1/2 z-[270] h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-crosshair touch-none rounded-full border border-indigo-400 bg-white"
    style={{ left: endpoint === 0 ? '0%' : '100%' }}
    onClick={(event) => event.stopPropagation()}
    onPointerDown={(event) => {
      if (event.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      cleanup.current?.();
      const rect = event.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const endpoints = webLineEndpoints(element, canvasWidth, canvasHeight);
      const fixed = endpoints[endpoint === 0 ? 1 : 0];
      const pointerId = event.pointerId;
      const move = (next: PointerEvent) => {
        if (next.pointerId !== pointerId) return;
        next.preventDefault();
        let point = { x: Math.max(0, Math.min(100, (next.clientX - rect.left) / rect.width * 100)), y: Math.max(0, Math.min(100, (next.clientY - rect.top) / rect.height * 100)) };
        if (next.ctrlKey || next.metaKey) point = snapLineEnd(fixed, point, canvasWidth, canvasHeight);
        const geometry = placementGeometry({ kind: 'shape', shapeType: 'line' }, endpoint === 0 ? point : fixed, endpoint === 0 ? fixed : point, canvasWidth, canvasHeight);
        const height = element.height * (element.scale || 1);
        onUpdate(element.id, { ...geometry, y: geometry.y + (geometry.height - height) / 2, height, scale: 1 });
      };
      const end = (next: PointerEvent) => {
        if (next.pointerId !== pointerId) return;
        if (next.type === 'pointerup') move(next);
        cleanup.current?.();
      };
      const dispose = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        window.removeEventListener('blur', dispose);
        cleanup.current = null;
      };
      cleanup.current = dispose;
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
      window.addEventListener('blur', dispose);
    }}
  />)}</>;
}

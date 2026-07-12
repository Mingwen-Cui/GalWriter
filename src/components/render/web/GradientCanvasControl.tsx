import { useRef } from 'react';

export type GradientGeometry = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  angle: number;
};

export function GradientCanvasControl({
  shape,
  angle,
  startX,
  startY,
  endX,
  endY,
  onGeometryChange,
}: {
  shape: 'linear' | 'radial' | 'diamond';
  angle: number;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  onGeometryChange: (geometry: GradientGeometry) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const radians = (angle * Math.PI) / 180;
  const safeStartX = startX ?? 50 - Math.sin(radians) * 25;
  const safeStartY = startY ?? 50 + Math.cos(radians) * 25;
  const safeEndX = endX ?? 50 + Math.sin(radians) * 25;
  const safeEndY = endY ?? 50 - Math.cos(radians) * 25;
  const updatePoint = (point: 'start' | 'end', clientX: number, clientY: number) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    const nextStartX = point === 'start' ? x : safeStartX;
    const nextStartY = point === 'start' ? y : safeStartY;
    const nextEndX = point === 'end' ? x : safeEndX;
    const nextEndY = point === 'end' ? y : safeEndY;
    const nextAngle = Math.round(
      ((Math.atan2(nextEndY - nextStartY, nextEndX - nextStartX) * 180) / Math.PI + 90 + 360) % 360,
    );
    onGeometryChange({ startX: nextStartX, startY: nextStartY, endX: nextEndX, endY: nextEndY, angle: nextAngle });
  };

  return (
    <div ref={rootRef} className="pointer-events-none absolute inset-0 z-[240]" data-gradient-canvas-control>
      {shape !== 'radial' && <svg className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        <line x1={`${safeStartX}%`} y1={`${safeStartY}%`} x2={`${safeEndX}%`} y2={`${safeEndY}%`} stroke="rgba(0,0,0,.45)" strokeWidth="4" />
        <line x1={`${safeStartX}%`} y1={`${safeStartY}%`} x2={`${safeEndX}%`} y2={`${safeEndY}%`} stroke="white" strokeWidth="2" />
      </svg>}
      {(['start', 'end'] as const).map((point) => {
        const x = point === 'start' ? safeStartX : safeEndX;
        const y = point === 'start' ? safeStartY : safeEndY;
        return <button key={point} type="button" className={`pointer-events-auto absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-[3px] border-white shadow-lg ${point === 'start' ? 'bg-sky-500' : 'bg-indigo-600'}`} style={{ left: `${x}%`, top: `${y}%` }} aria-label={`Gradient ${point}`} onPointerDown={(event) => { if (event.button !== 0) return; event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId); updatePoint(point, event.clientX, event.clientY); }} onPointerMove={(event) => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; event.stopPropagation(); updatePoint(point, event.clientX, event.clientY); }} onPointerUp={(event) => { event.stopPropagation(); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} />;
      })}
    </div>
  );
}

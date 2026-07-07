import type { PointerEvent } from 'react';
import { useRef } from 'react';

import type { GraphPoint } from './interactiveSegmentGraphLayout';
import { clamp } from './interactiveSegmentGraphLayout';
import type { InteractiveSegmentDraft } from './interactiveSegments';

type GraphLink = {
  id: string;
  fromSegmentId: string;
  toSegmentId: string;
  isChoice: boolean;
};

type Props = {
  label: string;
  ariaLabel: string;
  segments: InteractiveSegmentDraft[];
  graphLinks: GraphLink[];
  renderPositions: Map<string, GraphPoint>;
  activeSegmentId?: string;
  graphWidth: number;
  graphHeight: number;
  cardWidth: number;
  cardHeight: number;
  viewportPan: GraphPoint;
  viewportZoom: number;
  viewportSize: { width: number; height: number };
  lineOpacity: number;
  onViewportPanChange: (pan: GraphPoint) => void;
};

const MINIMAP_WIDTH = 190;
const MINIMAP_HEIGHT = 118;

export function InteractiveSegmentMinimap({
  label,
  ariaLabel,
  segments,
  graphLinks,
  renderPositions,
  activeSegmentId,
  graphWidth,
  graphHeight,
  cardWidth,
  cardHeight,
  viewportPan,
  viewportZoom,
  viewportSize,
  lineOpacity,
  onViewportPanChange,
}: Props) {
  const dragRef = useRef<{ pointerId: number } | null>(null);
  const minimapScale = Math.min(
    MINIMAP_WIDTH / Math.max(1, graphWidth),
    MINIMAP_HEIGHT / Math.max(1, graphHeight),
  );
  const viewport = {
    x: clamp((-viewportPan.x / Math.max(0.01, viewportZoom) / Math.max(1, graphWidth)) * MINIMAP_WIDTH, 0, MINIMAP_WIDTH),
    y: clamp((-viewportPan.y / Math.max(0.01, viewportZoom) / Math.max(1, graphHeight)) * MINIMAP_HEIGHT, 0, MINIMAP_HEIGHT),
    width: clamp(
      (viewportSize.width / Math.max(0.01, viewportZoom) / Math.max(1, graphWidth)) * MINIMAP_WIDTH,
      12,
      MINIMAP_WIDTH,
    ),
    height: clamp(
      (viewportSize.height / Math.max(0.01, viewportZoom) / Math.max(1, graphHeight)) * MINIMAP_HEIGHT,
      12,
      MINIMAP_HEIGHT,
    ),
  };

  const centerAt = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const graphX = ((event.clientX - rect.left) / Math.max(1, rect.width)) * graphWidth;
    const graphY = ((event.clientY - rect.top) / Math.max(1, rect.height)) * graphHeight;
    onViewportPanChange({
      x: viewportSize.width / 2 - graphX * viewportZoom,
      y: viewportSize.height / 2 - graphY * viewportZoom,
    });
  };

  const beginDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    dragRef.current = { pointerId: event.pointerId };
    centerAt(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.stopPropagation();
  };

  const drag = (event: PointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    centerAt(event);
  };

  const endDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  return (
    <div className="interactive-segment-minimap pointer-events-auto absolute bottom-4 right-4 z-20 rounded-xl border border-[var(--vr-border)] p-2 shadow-xl">
      <div className="mb-1.5 text-[10px] font-black uppercase text-[var(--vr-text-muted)]">
        {label}
      </div>
      <svg
        className="block cursor-pointer overflow-hidden rounded-lg"
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        viewBox={`0 0 ${MINIMAP_WIDTH} ${MINIMAP_HEIGHT}`}
        onPointerDown={beginDrag}
        onPointerMove={drag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        aria-label={ariaLabel}
      >
        <defs>
          <pattern id="interactive-minimap-grid" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="4" cy="4" r="1" className="fill-[var(--vr-accent)]" opacity="0.12" />
          </pattern>
          <marker id="interactive-minimap-arrow" markerWidth="5" markerHeight="5" refX="4.5" refY="2.5" orient="auto">
            <path d="M0,0 L5,2.5 L0,5 Z" fill="currentColor" />
          </marker>
        </defs>
        <rect width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT} rx="8" className="fill-[var(--vr-surface)]" />
        <rect width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT} rx="8" fill="url(#interactive-minimap-grid)" />
        {graphLinks.map((link) => {
          const from = renderPositions.get(link.fromSegmentId);
          const to = renderPositions.get(link.toSegmentId);
          if (!from || !to) return null;
          return (
            <line
              key={link.id}
              x1={(from.x + cardWidth / 2) * minimapScale}
              y1={(from.y + cardHeight / 2) * minimapScale}
              x2={(to.x + cardWidth / 2) * minimapScale}
              y2={(to.y + cardHeight / 2) * minimapScale}
              stroke="currentColor"
              strokeWidth="1"
              markerEnd="url(#interactive-minimap-arrow)"
              className="text-[var(--vr-border-strong)]"
              opacity={link.isChoice ? lineOpacity : lineOpacity * 0.62}
            />
          );
        })}
        {segments.map((segment) => {
          const position = renderPositions.get(segment.id);
          if (!position) return null;
          const active = activeSegmentId === segment.id;
          return (
            <rect
              key={segment.id}
              x={position.x * minimapScale}
              y={position.y * minimapScale}
              width={cardWidth * minimapScale}
              height={cardHeight * minimapScale}
              rx={3}
              className={active ? 'interactive-segment-minimap-node-active' : 'interactive-segment-minimap-node'}
            />
          );
        })}
        <rect
          x={viewport.x}
          y={viewport.y}
          width={viewport.width}
          height={viewport.height}
          rx={5}
          className="interactive-segment-minimap-mask"
        />
      </svg>
    </div>
  );
}

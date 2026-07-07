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
  canZoomIn: boolean;
  canZoomOut: boolean;
  onViewportPanChange: (pan: GraphPoint) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
};

const MINIMAP_WIDTH = 160;
const MINIMAP_HEIGHT = 120;

export function InteractiveSegmentMinimap({
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
  canZoomIn,
  canZoomOut,
  onViewportPanChange,
  onZoomIn,
  onZoomOut,
  onFitView,
}: Props) {
  const dragRef = useRef<{ pointerId: number } | null>(null);
  const minimapScale = Math.min(
    MINIMAP_WIDTH / Math.max(1, graphWidth),
    MINIMAP_HEIGHT / Math.max(1, graphHeight),
  );
  const viewport = {
    x: clamp(
      (-viewportPan.x / Math.max(0.01, viewportZoom) / Math.max(1, graphWidth)) * MINIMAP_WIDTH,
      0,
      MINIMAP_WIDTH,
    ),
    y: clamp(
      (-viewportPan.y / Math.max(0.01, viewportZoom) / Math.max(1, graphHeight)) * MINIMAP_HEIGHT,
      0,
      MINIMAP_HEIGHT,
    ),
    width: clamp(
      (viewportSize.width / Math.max(0.01, viewportZoom) / Math.max(1, graphWidth)) * MINIMAP_WIDTH,
      12,
      MINIMAP_WIDTH,
    ),
    height: clamp(
      (viewportSize.height / Math.max(0.01, viewportZoom) / Math.max(1, graphHeight)) *
        MINIMAP_HEIGHT,
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

  const maskPath = `M0,0h${MINIMAP_WIDTH}v${MINIMAP_HEIGHT}h-${MINIMAP_WIDTH}z M${viewport.x},${viewport.y}h${viewport.width}v${viewport.height}h-${viewport.width}z`;

  return (
    <div className="canvas-bottom-overlay toolbar-bubble-surface interactive-segment-minimap pointer-events-auto absolute bottom-4 right-4 z-[50] flex flex-col overflow-hidden rounded-xl border border-[var(--toolbar-border)] bg-[var(--toolbar-bg)] shadow-2xl backdrop-blur-md">
      <div className="minimap-clip w-full overflow-hidden rounded-t-xl">
        <div className="react-flow__panel react-flow__minimap !static !m-0 !block !border-none !bg-transparent">
          <svg
            className="react-flow__minimap-svg block cursor-pointer"
            width={MINIMAP_WIDTH}
            height={MINIMAP_HEIGHT}
            viewBox={`0 0 ${MINIMAP_WIDTH} ${MINIMAP_HEIGHT}`}
            onPointerDown={beginDrag}
            onPointerMove={drag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            aria-label={ariaLabel}
            role="img"
          >
            <title>{ariaLabel}</title>
            <defs>
              <marker
                id="interactive-minimap-arrow"
                markerWidth="5"
                markerHeight="5"
                refX="4.5"
                refY="2.5"
                orient="auto"
              >
                <path d="M0,0 L5,2.5 L0,5 Z" fill="currentColor" />
              </marker>
            </defs>
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
                  className="interactive-segment-minimap-link"
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
                  rx={6}
                  ry={6}
                  shapeRendering="crispEdges"
                  className={`react-flow__minimap-node ${
                    active ? 'interactive-segment-minimap-node-active' : ''
                  }`}
                />
              );
            })}
            <path
              className="react-flow__minimap-mask"
              d={maskPath}
              fillRule="evenodd"
              pointerEvents="none"
            />
          </svg>
        </div>
      </div>
      <div className="minimap-controls flex h-8 w-full items-center border-t border-[var(--toolbar-border)] bg-transparent">
        <div
          className="react-flow__panel react-flow__controls horizontal !static !m-0 !flex !h-full !w-full !flex-row !items-center !justify-around !gap-0 !border-none !bg-transparent !p-0 !shadow-none"
          aria-label="Control Panel"
        >
          <button
            type="button"
            className="react-flow__controls-button react-flow__controls-zoomin"
            title="Zoom In"
            aria-label="Zoom In"
            disabled={!canZoomIn}
            onClick={onZoomIn}
          >
            <svg viewBox="0 0 32 32" aria-hidden="true">
              <path d="M32 18.133H18.133V32h-4.266V18.133H0v-4.266h13.867V0h4.266v13.867H32z" />
            </svg>
          </button>
          <button
            type="button"
            className="react-flow__controls-button react-flow__controls-zoomout"
            title="Zoom Out"
            aria-label="Zoom Out"
            disabled={!canZoomOut}
            onClick={onZoomOut}
          >
            <svg viewBox="0 0 32 5" aria-hidden="true">
              <path d="M0 0h32v4.2H0z" />
            </svg>
          </button>
          <button
            type="button"
            className="react-flow__controls-button react-flow__controls-fitview"
            title="Fit View"
            aria-label="Fit View"
            onClick={onFitView}
          >
            <svg viewBox="0 0 32 30" aria-hidden="true">
              <path d="M3.692 4.63c0-.53.4-.938.939-.938h5.215V0H4.708C2.13 0 0 2.054 0 4.63v5.216h3.692V4.631zM27.354 0h-5.2v3.692h5.17c.53 0 .984.4.984.939v5.215H32V4.631A4.624 4.624 0 0027.354 0zm.954 24.83c0 .532-.4.94-.939.94h-5.215v3.768h5.215c2.577 0 4.631-2.13 4.631-4.707v-5.139h-3.692v5.139zm-23.677.94c-.531 0-.939-.4-.939-.94v-5.138H0v5.139c0 2.577 2.13 4.707 4.708 4.707h5.138V25.77H4.631z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

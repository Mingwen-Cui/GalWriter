import type { CSSProperties, PointerEvent } from 'react';
import { useRef } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';

import type { Language } from '../../../../lib/i18n';
import { useDesktopViewport } from '../../../../lib/useDesktopViewport';
import { formatVideoText } from '../i18n';
import type { GraphPoint, LayoutDirection } from './interactiveSegmentGraphLayout';
import { clamp, segmentLinkPath } from './interactiveSegmentGraphLayout';
import type { InteractiveSegmentDraft } from './interactiveSegments';

type GraphLink = {
  id: string;
  fromSegmentId: string;
  toSegmentId: string;
  isChoice: boolean;
};

type Props = {
  language: Language;
  ariaLabel: string;
  segments: InteractiveSegmentDraft[];
  graphLinks: GraphLink[];
  layoutDirection: LayoutDirection;
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
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  showFullscreenToggle?: boolean;
  width?: number;
  height?: number;
};

const DEFAULT_MINIMAP_WIDTH = 220;
const DEFAULT_MINIMAP_HEIGHT = 160;

export function InteractiveSegmentMinimap({
  language,
  ariaLabel,
  segments,
  graphLinks,
  layoutDirection,
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
  isFullscreen,
  onToggleFullscreen,
  showFullscreenToggle = true,
  width = DEFAULT_MINIMAP_WIDTH,
  height = DEFAULT_MINIMAP_HEIGHT,
}: Props) {
  const minimapWidth = clamp(width, 160, 440);
  const minimapHeight = clamp(height, 110, 320);
  const dragRef = useRef<{ pointerId: number } | null>(null);
  const isDesktopViewport = useDesktopViewport();
  const minimapScale = Math.min(
    minimapWidth / Math.max(1, graphWidth),
    minimapHeight / Math.max(1, graphHeight),
  );
  const scaledGraphWidth = graphWidth * minimapScale;
  const scaledGraphHeight = graphHeight * minimapScale;
  const safeZoom = Math.max(0.01, viewportZoom);
  const visibleGraphRect = {
    x: -viewportPan.x / safeZoom,
    y: -viewportPan.y / safeZoom,
    width: viewportSize.width / safeZoom,
    height: viewportSize.height / safeZoom,
  };
  const viewport = {
    x: clamp(visibleGraphRect.x * minimapScale, 0, minimapWidth),
    y: clamp(visibleGraphRect.y * minimapScale, 0, minimapHeight),
    width: clamp(visibleGraphRect.width * minimapScale, 12, minimapWidth),
    height: clamp(visibleGraphRect.height * minimapScale, 12, minimapHeight),
  };

  const centerAt = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / Math.max(1, rect.width)) * minimapWidth;
    const svgY = ((event.clientY - rect.top) / Math.max(1, rect.height)) * minimapHeight;
    const graphX = clamp(svgX, 0, scaledGraphWidth) / Math.max(0.001, minimapScale);
    const graphY = clamp(svgY, 0, scaledGraphHeight) / Math.max(0.001, minimapScale);
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

  const maskPath = `M0,0h${minimapWidth}v${minimapHeight}h-${minimapWidth}z M${viewport.x},${viewport.y}h${viewport.width}v${viewport.height}h-${viewport.width}z`;

  return (
    <div
      className="canvas-bottom-overlay toolbar-bubble-surface interactive-segment-minimap pointer-events-auto absolute bottom-4 right-4 z-[50] flex flex-col overflow-hidden rounded-xl border border-[var(--toolbar-border)] bg-[var(--toolbar-bg)] shadow-2xl backdrop-blur-md"
      style={
        {
          '--interactive-minimap-width': `${minimapWidth}px`,
          '--interactive-minimap-height': `${minimapHeight}px`,
        } as CSSProperties
      }
    >
      <div className="minimap-clip w-full overflow-hidden rounded-t-xl">
        <div className="react-flow__panel react-flow__minimap !static !m-0 !block !border-none !bg-transparent">
          <svg
            className="react-flow__minimap-svg block cursor-pointer"
            width={minimapWidth}
            height={minimapHeight}
            viewBox={`0 0 ${minimapWidth} ${minimapHeight}`}
            onPointerDown={beginDrag}
            onPointerMove={drag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            aria-label={ariaLabel}
            role="img"
          >
            <title>{ariaLabel}</title>
            {graphLinks.map((link) => {
              const from = renderPositions.get(link.fromSegmentId);
              const to = renderPositions.get(link.toSegmentId);
              if (!from || !to) return null;
              const path = segmentLinkPath(
                { x: from.x * minimapScale, y: from.y * minimapScale },
                { x: to.x * minimapScale, y: to.y * minimapScale },
                cardWidth * minimapScale,
                cardHeight * minimapScale,
                layoutDirection,
                6,
              );
              return (
                <path
                  key={link.id}
                  d={path}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1"
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
            title={formatVideoText(language, 'interactiveMinimapZoomIn')}
            aria-label={formatVideoText(language, 'interactiveMinimapZoomIn')}
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
            title={formatVideoText(language, 'interactiveMinimapZoomOut')}
            aria-label={formatVideoText(language, 'interactiveMinimapZoomOut')}
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
            title={formatVideoText(language, 'interactiveMinimapFitView')}
            aria-label={formatVideoText(language, 'interactiveMinimapFitView')}
            onClick={onFitView}
          >
            <svg viewBox="0 0 32 30" aria-hidden="true">
              <path d="M3.692 4.63c0-.53.4-.938.939-.938h5.215V0H4.708C2.13 0 0 2.054 0 4.63v5.216h3.692V4.631zM27.354 0h-5.2v3.692h5.17c.53 0 .984.4.984.939v5.215H32V4.631A4.624 4.624 0 0027.354 0zm.954 24.83c0 .532-.4.94-.939.94h-5.215v3.768h5.215c2.577 0 4.631-2.13 4.631-4.707v-5.139h-3.692v5.139zm-23.677.94c-.531 0-.939-.4-.939-.94v-5.138H0v5.139c0 2.577 2.13 4.707 4.708 4.707h5.138V25.77H4.631z" />
            </svg>
          </button>
          {isDesktopViewport && showFullscreenToggle && (
            <button
              type="button"
              className="react-flow__controls-button !min-w-0 !flex-1 !w-auto"
              title={formatVideoText(
                language,
                isFullscreen ? 'interactiveMinimapExitFullscreen' : 'interactiveMinimapMaximize',
              )}
              aria-label={formatVideoText(
                language,
                isFullscreen ? 'interactiveMinimapExitFullscreen' : 'interactiveMinimapMaximize',
              )}
              onClick={onToggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Maximize2 className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

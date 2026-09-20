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
  cardSizes?: Record<string, { width: number; height: number }>;
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
  embedded?: boolean;
  interactive?: boolean;
  /**
   * The flow editor exposes the minimap as one selectable canvas element.
   * These values let its regular appearance inspector style the control row
   * inside the minimap as well, rather than leaving a hidden hard-coded UI.
   */
  controlAppearance?: {
    fillEnabled?: boolean;
    strokeEnabled?: boolean;
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    textColor?: string;
  };
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
  cardSizes = {},
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
  embedded = false,
  interactive = true,
  controlAppearance,
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
  const controlStyle = {
    '--interactive-minimap-control-background':
      controlAppearance?.fillEnabled === false
        ? '#ffffff'
        : (controlAppearance?.backgroundColor ?? '#ffffff'),
    '--interactive-minimap-control-border':
      controlAppearance?.strokeEnabled === false
        ? 'transparent'
        : (controlAppearance?.borderColor ?? '#4f46e5'),
    '--interactive-minimap-control-border-width': `${
      controlAppearance?.strokeEnabled === false ? 0 : (controlAppearance?.borderWidth ?? 1)
    }px`,
    '--interactive-minimap-control-radius': `${controlAppearance?.borderRadius ?? 10}px`,
    '--interactive-minimap-control-color': controlAppearance?.textColor ?? '#4338ca',
  } as CSSProperties;

  return (
    <div
      className={`${embedded ? '' : 'canvas-bottom-overlay'} toolbar-bubble-surface interactive-segment-minimap ${interactive ? 'pointer-events-auto' : 'pointer-events-none'} ${embedded ? 'relative h-full w-full' : 'absolute bottom-4 right-4 z-[50]'} flex flex-col overflow-hidden rounded-xl border border-[var(--toolbar-border)] bg-[var(--toolbar-bg)] shadow-2xl backdrop-blur-md`}
      style={
        {
          '--interactive-minimap-width': `${minimapWidth}px`,
          '--interactive-minimap-height': `${minimapHeight}px`,
          ...controlStyle,
        } as CSSProperties
      }
    >
      <div className="minimap-clip min-h-0 w-full flex-1 overflow-hidden rounded-t-xl">
        <div className="react-flow__panel react-flow__minimap !static !m-0 !block !border-none !bg-transparent">
          <svg
            className={`react-flow__minimap-svg block ${interactive ? 'cursor-pointer' : 'pointer-events-none'}`}
            width={minimapWidth}
            height={minimapHeight}
            viewBox={`0 0 ${minimapWidth} ${minimapHeight}`}
            style={embedded ? { width: '100%', height: '100%' } : undefined}
            onPointerDown={interactive ? beginDrag : undefined}
            onPointerMove={interactive ? drag : undefined}
            onPointerUp={interactive ? endDrag : undefined}
            onPointerCancel={interactive ? endDrag : undefined}
            aria-label={ariaLabel}
            role="img"
          >
            <title>{ariaLabel}</title>
            {graphLinks.map((link) => {
              const from = renderPositions.get(link.fromSegmentId);
              const to = renderPositions.get(link.toSegmentId);
              if (!from || !to) return null;
              const fromSize = cardSizes[link.fromSegmentId] || {
                width: cardWidth,
                height: cardHeight,
              };
              const toSize = cardSizes[link.toSegmentId] || {
                width: cardWidth,
                height: cardHeight,
              };
              const path = segmentLinkPath(
                { x: from.x * minimapScale, y: from.y * minimapScale },
                { x: to.x * minimapScale, y: to.y * minimapScale },
                fromSize.width * minimapScale,
                fromSize.height * minimapScale,
                layoutDirection,
                6,
                toSize.width * minimapScale,
                toSize.height * minimapScale,
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
              const size = cardSizes[segment.id] || { width: cardWidth, height: cardHeight };
              return (
                <rect
                  key={segment.id}
                  x={position.x * minimapScale}
                  y={position.y * minimapScale}
                  width={size.width * minimapScale}
                  height={size.height * minimapScale}
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
      <div className="minimap-controls flex h-14 w-full items-center border-t border-[var(--toolbar-border)] bg-transparent px-2 py-1.5">
        <div
          className="react-flow__panel react-flow__controls horizontal !static !m-0 !flex !h-full !w-full !flex-row !items-center !justify-around !gap-2 !border-none !bg-transparent !p-0 !shadow-none"
          aria-label="Control Panel"
        >
          <button
            type="button"
            className="react-flow__controls-button interactive-minimap-control interactive-minimap-control--zoom-in react-flow__controls-zoomin"
            title={formatVideoText(language, 'interactiveMinimapZoomIn')}
            aria-label={formatVideoText(language, 'interactiveMinimapZoomIn')}
            disabled={!interactive || !canZoomIn}
            onClick={interactive ? onZoomIn : undefined}
          >
            <svg
              className="interactive-minimap-control-icon"
              viewBox="0 0 32 32"
              aria-hidden="true"
            >
              <path d="M32 18.133H18.133V32h-4.266V18.133H0v-4.266h13.867V0h4.266v13.867H32z" />
            </svg>
            <span className="interactive-minimap-control-label">
              {formatVideoText(language, 'interactiveMinimapZoomIn')}
            </span>
          </button>
          <button
            type="button"
            className="react-flow__controls-button interactive-minimap-control interactive-minimap-control--zoom-out react-flow__controls-zoomout"
            title={formatVideoText(language, 'interactiveMinimapZoomOut')}
            aria-label={formatVideoText(language, 'interactiveMinimapZoomOut')}
            disabled={!interactive || !canZoomOut}
            onClick={interactive ? onZoomOut : undefined}
          >
            <svg className="interactive-minimap-control-icon" viewBox="0 0 32 5" aria-hidden="true">
              <path d="M0 0h32v4.2H0z" />
            </svg>
            <span className="interactive-minimap-control-label">
              {formatVideoText(language, 'interactiveMinimapZoomOut')}
            </span>
          </button>
          <button
            type="button"
            className="react-flow__controls-button interactive-minimap-control interactive-minimap-control--fit-view react-flow__controls-fitview"
            title={formatVideoText(language, 'interactiveMinimapFitView')}
            aria-label={formatVideoText(language, 'interactiveMinimapFitView')}
            disabled={!interactive}
            onClick={interactive ? onFitView : undefined}
          >
            <svg
              className="interactive-minimap-control-icon"
              viewBox="0 0 32 30"
              aria-hidden="true"
            >
              <path d="M3.692 4.63c0-.53.4-.938.939-.938h5.215V0H4.708C2.13 0 0 2.054 0 4.63v5.216h3.692V4.631zM27.354 0h-5.2v3.692h5.17c.53 0 .984.4.984.939v5.215H32V4.631A4.624 4.624 0 0027.354 0zm.954 24.83c0 .532-.4.94-.939.94h-5.215v3.768h5.215c2.577 0 4.631-2.13 4.631-4.707v-5.139h-3.692v5.139zm-23.677.94c-.531 0-.939-.4-.939-.94v-5.138H0v5.139c0 2.577 2.13 4.707 4.708 4.707h5.138V25.77H4.631z" />
            </svg>
            <span className="interactive-minimap-control-label">
              {formatVideoText(language, 'interactiveMinimapFitView')}
            </span>
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
              disabled={!interactive}
              onClick={interactive ? onToggleFullscreen : undefined}
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

import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  GitBranch,
  Play,
  RotateCw,
  X,
} from 'lucide-react';
import type {
  CSSProperties,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { resolveKnownAppAssetUrl } from '../../../lib/appAssets';
import type { Language } from '../../../lib/i18n';
import { getNodeDisplayText, getNodeDisplayTitle, stripHtml } from '../video/shared/storyNodes';
import { formatVideoText } from '../video/i18n';
import {
  buildInteractiveSegments,
  type InteractiveSegmentDraft,
} from '../video/interactive/interactiveSegments';
import { InteractiveSegmentMinimap } from '../video/interactive/InteractiveSegmentMinimap';
import type {
  GraphPoint,
  LayoutDirection,
} from '../video/interactive/interactiveSegmentGraphLayout';
import {
  buildSegmentLayout,
  clamp,
  segmentLinkPath,
} from '../video/interactive/interactiveSegmentGraphLayout';

type Props = {
  language: Language;
  nodes: FlowNode[];
  edges: FlowEdge[];
  onClose?: () => void;
  onPlayFromNode?: (nodeId: string) => void;
  onActiveSegmentChange?: (title: string) => void;
  onSnapshot?: (snapshot: WebStoryFlowGraphSnapshot) => void;
  minimapWidth?: number;
  minimapHeight?: number;
  transparentSurface?: boolean;
  showHeader?: boolean;
  showCurrentBranchIndicator?: boolean;
  showMinimap?: boolean;
  editable?: boolean;
  cardSizes?: Record<string, { width: number; height: number }>;
  onCardSizeChange?: (segmentId: string, size: { width: number; height: number }) => void;
  layoutDirection?: LayoutDirection;
  onLayoutDirectionChange?: (direction: LayoutDirection) => void;
  onSelectedCardChange?: (segmentId: string | null) => void;
  controlsRef?: MutableRefObject<WebStoryFlowGraphControls | null>;
  showDirectionControl?: boolean;
  showFitViewControl?: boolean;
};

export type WebStoryFlowGraphControls = {
  cycleDirection: () => void;
  fitView: () => void;
};

export type WebStoryFlowGraphSnapshot = {
  segments: InteractiveSegmentDraft[];
  graphLinks: Array<{
    id: string;
    fromSegmentId: string;
    toSegmentId: string;
    isChoice: boolean;
  }>;
  layoutDirection: LayoutDirection;
  renderPositions: Map<string, GraphPoint>;
  activeSegmentId: string;
  graphWidth: number;
  graphHeight: number;
  viewportPan: GraphPoint;
  viewportZoom: number;
  viewportSize: { width: number; height: number };
  cardSizes: Record<string, { width: number; height: number }>;
  lineOpacity: number;
  onViewportPanChange: (pan: GraphPoint) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
};

const cardWidth = 208;
const cardHeight = 132;
const graphPadding = 120;
const minZoom = 0.35;
const maxZoom = 1.85;

const textFor = (language: Language, zh: string, ja: string, en: string) =>
  language === 'zh' ? zh : language === 'ja' ? ja : en;

const layoutDirections: LayoutDirection[] = ['right', 'down', 'left', 'up'];

const directionText = (language: Language, direction: LayoutDirection) => {
  const keys: Record<LayoutDirection, Parameters<typeof formatVideoText>[1]> = {
    right: 'interactiveSegmentLayoutDirectionRight',
    down: 'interactiveSegmentLayoutDirectionDown',
    left: 'interactiveSegmentLayoutDirectionLeft',
    up: 'interactiveSegmentLayoutDirectionUp',
  };
  return formatVideoText(language, keys[direction]);
};

const segmentImage = (segment: InteractiveSegmentDraft, nodesById: Map<string, FlowNode>) => {
  const firstNode = nodesById.get(segment.nodeIds[0]);
  const imageUrl = firstNode?.data?.imageUrl;
  return typeof imageUrl === 'string' ? imageUrl : '';
};

export function WebStoryFlowGraph({
  language,
  nodes,
  edges,
  onClose,
  onPlayFromNode,
  onActiveSegmentChange,
  onSnapshot,
  minimapWidth,
  minimapHeight,
  transparentSurface = false,
  showHeader = true,
  showCurrentBranchIndicator = true,
  showMinimap = true,
  editable = false,
  cardSizes = {},
  onCardSizeChange,
  layoutDirection: controlledLayoutDirection,
  onLayoutDirectionChange,
  onSelectedCardChange,
  controlsRef,
  showDirectionControl = true,
  showFitViewControl = true,
}: Props) {
  const segments = useMemo(() => buildInteractiveSegments(nodes, edges), [edges, nodes]);
  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>(
    controlledLayoutDirection || 'right',
  );
  const [activeSegmentId, setActiveSegmentId] = useState('');
  const [activeNodeId, setActiveNodeId] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [manualPositions, setManualPositions] = useState<Record<string, GraphPoint>>({});
  const [viewportPan, setViewportPan] = useState<GraphPoint>({ x: 0, y: 0 });
  const [viewportZoom, setViewportZoom] = useState(1);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState('');
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<GraphPoint>(viewportPan);
  const zoomRef = useRef(viewportZoom);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const cardResizeRef = useRef<{
    pointerId: number;
    segmentId: string;
    startX: number;
    startY: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (controlledLayoutDirection && controlledLayoutDirection !== layoutDirection) {
      setLayoutDirection(controlledLayoutDirection);
    }
  }, [controlledLayoutDirection, layoutDirection]);

  useEffect(() => {
    if (segments.length === 0) {
      setActiveSegmentId('');
      return;
    }
    setActiveSegmentId((current) =>
      segments.some((segment) => segment.id === current) ? current : segments[0].id,
    );
  }, [segments]);

  const activeSegment = segments.find((segment) => segment.id === activeSegmentId);

  const storyChainIds = useMemo(() => {
    if (!activeSegmentId) return new Set<string>();
    const byId = new Map(segments.map((segment) => [segment.id, segment]));
    const incoming = new Map<string, string>();
    segments.forEach((segment) => {
      segment.choices.forEach((choice) => {
        if (byId.has(choice.targetSegmentId) && !incoming.has(choice.targetSegmentId)) {
          incoming.set(choice.targetSegmentId, segment.id);
        }
      });
    });
    const chain = new Set<string>([activeSegmentId]);
    let current = activeSegmentId;
    const visited = new Set<string>();
    while (incoming.has(current) && !visited.has(current)) {
      visited.add(current);
      current = incoming.get(current)!;
      chain.add(current);
    }
    return chain;
  }, [activeSegmentId, segments]);

  useEffect(() => {
    const firstNodeId = activeSegment?.nodeIds[0] || '';
    setActiveNodeId((current) =>
      activeSegment?.nodeIds.includes(current) ? current : firstNodeId,
    );
  }, [activeSegment]);

  useEffect(() => {
    if (!onActiveSegmentChange) return;
    const firstNode = nodesById.get(activeSegment?.nodeIds[0] || '');
    onActiveSegmentChange(
      getNodeDisplayTitle(firstNode) ||
        activeSegment?.name ||
        textFor(language, '开始', '開始', 'Start'),
    );
  }, [activeSegment, language, nodesById, onActiveSegmentChange]);

  const autoPositions = useMemo(
    () => buildSegmentLayout(segments, layoutDirection, cardWidth, cardHeight),
    [layoutDirection, segments],
  );
  const positions = useMemo(() => {
    const next = new Map<string, GraphPoint>();
    segments.forEach((segment) => {
      next.set(
        segment.id,
        manualPositions[segment.id] || autoPositions.get(segment.id) || { x: 96, y: 92 },
      );
    });
    return next;
  }, [autoPositions, manualPositions, segments]);
  const cardSizeFor = (segmentId: string) => {
    const size = cardSizes[segmentId];
    return {
      width: clamp(size?.width ?? cardWidth, 140, 420),
      height: clamp(size?.height ?? cardHeight, 90, 260),
    };
  };
  const bounds = useMemo(() => {
    if (positions.size === 0) return { minX: 0, minY: 0, maxX: cardWidth, maxY: cardHeight };
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    positions.forEach((position, segmentId) => {
      const size = cardSizeFor(segmentId);
      minX = Math.min(minX, position.x);
      minY = Math.min(minY, position.y);
      maxX = Math.max(maxX, position.x + size.width);
      maxY = Math.max(maxY, position.y + size.height);
    });
    return { minX, minY, maxX, maxY };
  }, [cardSizes, positions]);
  const offset = { x: graphPadding - bounds.minX, y: graphPadding - bounds.minY };
  const renderPositions = useMemo(() => {
    const next = new Map<string, GraphPoint>();
    positions.forEach((position, id) =>
      next.set(id, { x: position.x + offset.x, y: position.y + offset.y }),
    );
    return next;
  }, [offset.x, offset.y, positions]);
  const graphWidth = Math.max(1040, bounds.maxX - bounds.minX + graphPadding * 2);
  const graphHeight = Math.max(620, bounds.maxY - bounds.minY + graphPadding * 2);
  const graphLinks = useMemo(
    () =>
      segments.flatMap((segment) =>
        segment.choices.map((choice, index) => ({
          id: choice.id,
          fromSegmentId: segment.id,
          toSegmentId: choice.targetSegmentId,
          targetTitle:
            segments.find((candidate) => candidate.id === choice.targetSegmentId)?.name ||
            choice.label,
          index,
          choiceCount: segment.choices.length,
          isChoice: segment.choices.length > 1,
        })),
      ),
    [segments],
  );
  const branchCount = segments.reduce((sum, segment) => sum + segment.choices.length, 0);
  const lineOpacity = 0.72;
  const graphStyle = {
    '--interactive-bg-x': `${viewportPan.x}px`,
    '--interactive-bg-y': `${viewportPan.y}px`,
    '--interactive-bg-scale': viewportZoom,
  } as CSSProperties;
  const DirectionIcon =
    layoutDirection === 'right'
      ? ArrowRight
      : layoutDirection === 'down'
        ? ArrowDown
        : layoutDirection === 'left'
          ? ArrowLeft
          : ArrowUp;
  const isHorizontalLayout = layoutDirection === 'right' || layoutDirection === 'left';

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateSize = () =>
      setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [isFullscreen]);

  const scheduleTransform = (pan: GraphPoint, zoom = zoomRef.current) => {
    panRef.current = pan;
    zoomRef.current = zoom;
    setViewportPan(pan);
    setViewportZoom(zoom);
  };

  const fitView = () => {
    if (!viewportSize.width || !viewportSize.height) return;
    const fitPadding = 56;
    const zoom = clamp(
      Math.min(
        (viewportSize.width - fitPadding * 2) / Math.max(1, graphWidth),
        (viewportSize.height - fitPadding * 2) / Math.max(1, graphHeight),
      ),
      minZoom,
      maxZoom,
    );
    scheduleTransform(
      {
        x: (viewportSize.width - graphWidth * zoom) / 2,
        y: (viewportSize.height - graphHeight * zoom) / 2,
      },
      zoom,
    );
  };

  const setZoomAt = (
    nextZoom: number,
    anchorX = viewportSize.width / 2,
    anchorY = viewportSize.height / 2,
  ) => {
    const currentZoom = zoomRef.current;
    const currentPan = panRef.current;
    const zoom = clamp(nextZoom, minZoom, maxZoom);
    if (Math.abs(zoom - currentZoom) < 0.001) return;
    const graphX = (anchorX - currentPan.x) / currentZoom;
    const graphY = (anchorY - currentPan.y) / currentZoom;
    scheduleTransform({ x: anchorX - graphX * zoom, y: anchorY - graphY * zoom }, zoom);
  };

  const resetLayout = (direction: LayoutDirection) => {
    setLayoutDirection(direction);
    onLayoutDirectionChange?.(direction);
    setManualPositions({});
    scheduleTransform({ x: 0, y: 0 }, 1);
  };

  useEffect(() => {
    if (!controlsRef) return;
    controlsRef.current = {
      cycleDirection: () => {
        const currentIndex = layoutDirections.indexOf(layoutDirection);
        resetLayout(layoutDirections[(currentIndex + 1) % layoutDirections.length]);
      },
      fitView,
    };
    return () => {
      if (controlsRef.current) controlsRef.current = null;
    };
  }, [controlsRef, layoutDirection, viewportSize, graphWidth, graphHeight]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    if (editable) onSelectedCardChange?.(null);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: panRef.current.x,
      originY: panRef.current.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    scheduleTransform({
      x: drag.originX + event.clientX - drag.startX,
      y: drag.originY + event.clientY - drag.startY,
    });
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };
  const beginCardResize = (event: ReactPointerEvent<HTMLSpanElement>, segmentId: string) => {
    if (!editable || !onCardSizeChange) return;
    event.preventDefault();
    event.stopPropagation();
    const size = cardSizeFor(segmentId);
    cardResizeRef.current = {
      pointerId: event.pointerId,
      segmentId,
      startX: event.clientX,
      startY: event.clientY,
      width: size.width,
      height: size.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const resizeCard = (event: ReactPointerEvent<HTMLSpanElement>) => {
    const resize = cardResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId || !onCardSizeChange) return;
    onCardSizeChange(resize.segmentId, {
      width: clamp(
        resize.width + (event.clientX - resize.startX) / Math.max(0.35, viewportZoom),
        140,
        420,
      ),
      height: clamp(
        resize.height + (event.clientY - resize.startY) / Math.max(0.35, viewportZoom),
        90,
        260,
      ),
    });
  };
  const endCardResize = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (cardResizeRef.current?.pointerId === event.pointerId) {
      cardResizeRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const delta = clamp(event.deltaY, -240, 240);
    setZoomAt(
      zoomRef.current * Math.exp(-delta * 0.0014),
      event.clientX - rect.left,
      event.clientY - rect.top,
    );
  };

  useEffect(() => {
    onSnapshot?.({
      segments,
      graphLinks,
      layoutDirection,
      renderPositions,
      activeSegmentId,
      graphWidth,
      graphHeight,
      viewportPan,
      viewportZoom,
      viewportSize,
      cardSizes,
      lineOpacity,
      onViewportPanChange: (pan) => scheduleTransform(pan),
      onZoomIn: () => setZoomAt(viewportZoom + 0.15),
      onZoomOut: () => setZoomAt(viewportZoom - 0.15),
      onFitView: fitView,
    });
  }, [
    activeSegmentId,
    graphHeight,
    graphLinks,
    graphWidth,
    layoutDirection,
    lineOpacity,
    onSnapshot,
    renderPositions,
    segments,
    viewportPan,
    viewportSize,
    viewportZoom,
    cardSizes,
  ]);

  if (segments.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center bg-[var(--vr-surface-soft)] text-sm text-[var(--vr-text-muted)]">
        {textFor(
          language,
          '还没有可展示的剧情分支',
          '表示できるストーリー分岐がありません',
          'No story branches to display yet',
        )}
      </div>
    );
  }

  return (
    <section
      className={`${isFullscreen ? 'fixed inset-3 z-[120] rounded-2xl shadow-2xl' : 'relative'} flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden border border-[var(--vr-border)] ${transparentSurface ? 'bg-transparent' : 'bg-[var(--vr-surface-soft)]'}`}
    >
      {showHeader && (
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-[var(--vr-border)] bg-[var(--vr-surface)] px-4">
          <div className="flex min-w-0 items-center gap-2 text-xs font-black tracking-wide text-[var(--vr-text-soft)]">
            <GitBranch className="h-4 w-4 text-[var(--vr-accent)]" />
            <span className="truncate">
              {textFor(language, '网页剧情流程图', 'Webストーリーフロー', 'Web story flow')}
            </span>
            <span className="rounded-full bg-[var(--vr-accent-soft)] px-2 py-0.5 text-[10px] text-[var(--vr-accent-strong)]">
              {segments.length} {textFor(language, '段', 'セグメント', 'segments')} · {branchCount}{' '}
              {textFor(language, '条分支', '分岐', 'choices')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {showDirectionControl && (
              <button
                type="button"
                onClick={() => {
                  const currentIndex = layoutDirections.indexOf(layoutDirection);
                  resetLayout(layoutDirections[(currentIndex + 1) % layoutDirections.length]);
                }}
                aria-label={textFor(
                  language,
                  `切换布局方向（当前${directionText(language, layoutDirection)}）`,
                  `レイアウト方向を切り替え（現在${directionText(language, layoutDirection)}）`,
                  `Switch layout direction (current: ${directionText(language, layoutDirection)})`,
                )}
                title={directionText(language, layoutDirection)}
                className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--vr-accent)] text-white ring-1 ring-[var(--vr-accent)] hover:bg-[var(--vr-accent-strong)]"
              >
                <DirectionIcon className="h-4 w-4" />
              </button>
            )}
            {showFitViewControl && (
              <button
                type="button"
                onClick={fitView}
                aria-label={textFor(language, '适应视图', '全体表示', 'Fit view')}
                className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--vr-surface)] text-[var(--vr-text-soft)] ring-1 ring-[var(--vr-border)] hover:text-[var(--vr-accent)]"
              >
                <RotateCw className="h-4 w-4" />
              </button>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label={textFor(
                  language,
                  '关闭流程图总览',
                  'フロー概要を閉じる',
                  'Close flow overview',
                )}
                className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--vr-surface)] text-[var(--vr-text-soft)] ring-1 ring-[var(--vr-border)] hover:text-[var(--vr-accent)]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </header>
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          ref={viewportRef}
          className={`interactive-segment-graph-viewport absolute inset-0 cursor-grab touch-none overflow-hidden active:cursor-grabbing ${transparentSurface ? 'bg-transparent before:hidden' : ''}`}
          style={graphStyle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
        >
          <div
            className="absolute left-0 top-0 touch-none"
            style={{
              width: graphWidth,
              height: graphHeight,
              transform: `matrix(${viewportZoom}, 0, 0, ${viewportZoom}, ${viewportPan.x}, ${viewportPan.y})`,
              transformOrigin: '0 0',
            }}
          >
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
              aria-hidden="true"
            >
              {graphLinks.map((link) => {
                const from = renderPositions.get(link.fromSegmentId);
                const to = renderPositions.get(link.toSegmentId);
                if (!from || !to) return null;
                const active =
                  storyChainIds.has(link.fromSegmentId) && storyChainIds.has(link.toSegmentId);
                const fromSize = cardSizeFor(link.fromSegmentId);
                const toSize = cardSizeFor(link.toSegmentId);
                const path = segmentLinkPath(
                  from,
                  to,
                  fromSize.width,
                  fromSize.height,
                  layoutDirection,
                  28,
                  toSize.width,
                  toSize.height,
                );
                return (
                  <g
                    key={link.id}
                    className={active ? 'text-[var(--vr-accent)]' : 'text-slate-400'}
                  >
                    <path
                      d={path}
                      fill="none"
                      stroke="var(--vr-surface-soft)"
                      strokeWidth={active ? 8 : 6}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d={path}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={active ? 3.5 : 2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={link.isChoice ? undefined : '7 7'}
                      opacity={active ? 1 : lineOpacity}
                    />
                  </g>
                );
              })}
              {graphLinks.map((link) => {
                const from = renderPositions.get(link.fromSegmentId);
                const to = renderPositions.get(link.toSegmentId);
                if (!from || !to) return null;
                const fromSize = cardSizeFor(link.fromSegmentId);
                const toSize = cardSizeFor(link.toSegmentId);
                const active =
                  storyChainIds.has(link.fromSegmentId) && storyChainIds.has(link.toSegmentId);
                const label = link.isChoice
                  ? link.targetTitle
                  : textFor(language, '继续', '続き', 'Continue');
                const startX = layoutDirection === 'right' ? from.x + fromSize.width : from.x;
                const endX = layoutDirection === 'right' ? to.x : to.x + toSize.width;
                const startY = layoutDirection === 'down' ? from.y + fromSize.height : from.y;
                const endY = layoutDirection === 'down' ? to.y : to.y + toSize.height;
                const labelX = isHorizontalLayout
                  ? (startX + endX) / 2
                  : from.x +
                    fromSize.width / 2 +
                    (to.x - from.x) / 2 +
                    (link.index - (link.choiceCount - 1) / 2) * 34;
                const labelY = isHorizontalLayout
                  ? from.y +
                    fromSize.height / 2 +
                    (to.y - from.y) / 2 +
                    (link.index - (link.choiceCount - 1) / 2) * 28
                  : (startY + endY) / 2 - 12;
                const visibleLabel = label.slice(0, 18);
                const labelWidth = Math.max(84, Math.min(190, visibleLabel.length * 9 + 24));
                return (
                  <g
                    key={`${link.id}-label`}
                    className={active ? 'text-[var(--vr-accent)]' : 'text-slate-400'}
                    style={{ isolation: 'isolate', zIndex: 10 }}
                  >
                    <rect
                      x={labelX - labelWidth / 2}
                      y={labelY - 12}
                      width={labelWidth}
                      height="23"
                      rx="7"
                      className="fill-[var(--vr-surface)] stroke-current"
                      opacity="0.98"
                      strokeWidth="1"
                    />
                    <text
                      x={labelX}
                      y={labelY + 3}
                      textAnchor="middle"
                      className="fill-current text-[9px] font-black"
                    >
                      {visibleLabel}
                    </text>
                  </g>
                );
              })}
            </svg>

            {segments.map((segment) => {
              const position = renderPositions.get(segment.id);
              if (!position) return null;
              const active = segment.id === activeSegmentId;
              const inStoryChain = storyChainIds.has(segment.id);
              const imageUrl = segmentImage(segment, nodesById);
              const cardSize = cardSizeFor(segment.id);
              const selectedForEdit = editable && selectedCardId === segment.id;
              return (
                <button
                  key={segment.id}
                  type="button"
                  onClick={() => {
                    setActiveSegmentId(segment.id);
                    setActiveNodeId(segment.nodeIds[0] || '');
                    if (editable) {
                      setSelectedCardId(segment.id);
                      onSelectedCardChange?.(segment.id);
                      setDetailsOpen(false);
                    } else {
                      setDetailsOpen(true);
                    }
                  }}
                  aria-label={
                    getNodeDisplayTitle(nodesById.get(segment.nodeIds[0])) || segment.name
                  }
                  className={`absolute overflow-hidden rounded-xl border text-left shadow-lg transition ${inStoryChain ? 'border-indigo-400 shadow-indigo-200/70' : 'border-slate-200 hover:border-indigo-300 hover:shadow-indigo-100/70'} ${active ? 'ring-2 ring-indigo-300/70' : ''} ${selectedForEdit ? 'ring-4 ring-amber-300/80' : ''}`}
                  style={{
                    left: position.x,
                    top: position.y,
                    width: cardSize.width,
                    height: cardSize.height,
                  }}
                >
                  {imageUrl ? (
                    <img
                      src={resolveKnownAppAssetUrl(imageUrl)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="block h-full w-full bg-gradient-to-br from-slate-100 via-white to-indigo-50" />
                  )}
                  {selectedForEdit && onCardSizeChange && (
                    <span
                      className="absolute bottom-1 right-1 z-10 h-4 w-4 cursor-se-resize rounded-sm bg-indigo-600/90 shadow ring-2 ring-white/80"
                      onPointerDown={(event) => beginCardResize(event, segment.id)}
                      onPointerMove={resizeCard}
                      onPointerUp={endCardResize}
                      onPointerCancel={endCardResize}
                      aria-label={textFor(
                        language,
                        '调整卡片大小',
                        'カードサイズを調整',
                        'Resize card',
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {showCurrentBranchIndicator && (
          <div className="pointer-events-none absolute left-4 top-4 z-20 max-w-[min(360px,calc(100%-2rem))] rounded-xl border border-white/70 bg-white/80 px-3 py-2 shadow-sm backdrop-blur-md">
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              {textFor(language, '当前分支', '現在の分岐', 'Current branch')}
            </div>
            <div className="mt-0.5 truncate text-xs font-black text-slate-700">
              {getNodeDisplayTitle(nodesById.get(activeSegment?.nodeIds[0] || '')) ||
                activeSegment?.name}
            </div>
          </div>
        )}

        {!showHeader && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={textFor(
              language,
              '关闭流程图总览',
              'フロー概要を閉じる',
              'Close flow overview',
            )}
            className="absolute right-4 top-4 z-40 grid h-8 w-8 place-items-center rounded-lg bg-[var(--vr-surface)] text-[var(--vr-text-soft)] ring-1 ring-[var(--vr-border)] hover:text-[var(--vr-accent)]"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {detailsOpen && activeSegment && (
          <aside className="absolute bottom-20 right-4 top-4 z-30 flex w-[min(360px,calc(100%-2rem))] min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur-md">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {textFor(language, '卡片内部剧情', 'カード内のストーリー', 'Inside this card')}
                </div>
                <div className="mt-1 truncate text-sm font-black text-slate-800">
                  {activeSegment.name ||
                    textFor(language, '未命名剧情段', '無題のセグメント', 'Untitled segment')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                aria-label={textFor(language, '关闭卡片详情', '詳細を閉じる', 'Close details')}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-[10px] font-bold text-indigo-700">
                <span>
                  {activeSegment.nodeIds.length}{' '}
                  {textFor(language, '个连续剧情节点', '個の連続ノード', 'story nodes')}
                </span>
                {onPlayFromNode && (
                  <button
                    type="button"
                    onClick={() => activeNodeId && onPlayFromNode(activeNodeId)}
                    disabled={!activeNodeId}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-[10px] font-black text-white shadow-sm hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Play className="h-3 w-3 fill-current" />
                    {textFor(language, '从此处开始', 'ここから再生', 'Play from here')}
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {activeSegment.nodeIds.map((nodeId, index) => {
                  const node = nodesById.get(nodeId);
                  if (!node) return null;
                  const selected = activeNodeId === nodeId;
                  const detailText = stripHtml(getNodeDisplayText(node)).trim();
                  return (
                    <button
                      key={nodeId}
                      type="button"
                      onClick={() => setActiveNodeId(nodeId)}
                      className={`w-full rounded-xl border p-3 text-left transition ${selected ? 'border-indigo-300 bg-indigo-50/80 shadow-sm' : 'border-slate-200 bg-white hover:border-indigo-200 hover:bg-slate-50'}`}
                    >
                      <span className="flex items-center gap-2 text-[10px] font-black text-slate-400">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500">
                          {index + 1}
                        </span>
                        <span className="truncate text-xs text-slate-700">
                          {getNodeDisplayTitle(node) ||
                            textFor(language, '未命名节点', '無題のノード', 'Untitled node')}
                        </span>
                        <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0" />
                      </span>
                      <span className="mt-2 block line-clamp-3 text-[10px] leading-5 text-slate-500">
                        {detailText || textFor(language, '暂无文本', 'テキストなし', 'No text')}
                      </span>
                      {onPlayFromNode && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            onPlayFromNode(nodeId);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              event.stopPropagation();
                              onPlayFromNode(nodeId);
                            }
                          }}
                          className="mt-2 inline-flex items-center gap-1 text-[10px] font-black text-indigo-600 hover:text-indigo-500"
                        >
                          <Play className="h-3 w-3 fill-current" />
                          {textFor(
                            language,
                            '从此节点开始游戏',
                            'このノードから再生',
                            'Play from this node',
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        )}

        {showMinimap && (
          <InteractiveSegmentMinimap
            language={language}
            ariaLabel={textFor(
              language,
              '网页流程图导航',
              'Webフローのナビゲーション',
              'Web flow navigation',
            )}
            segments={segments}
            graphLinks={graphLinks}
            layoutDirection={layoutDirection}
            renderPositions={renderPositions}
            activeSegmentId={activeSegmentId}
            graphWidth={graphWidth}
            graphHeight={graphHeight}
            cardWidth={cardWidth}
            cardHeight={cardHeight}
            cardSizes={cardSizes}
            viewportPan={viewportPan}
            viewportZoom={viewportZoom}
            viewportSize={viewportSize}
            lineOpacity={lineOpacity}
            canZoomIn={viewportZoom < maxZoom}
            canZoomOut={viewportZoom > minZoom}
            onViewportPanChange={(pan) => scheduleTransform(pan)}
            onZoomIn={() => setZoomAt(viewportZoom + 0.15)}
            onZoomOut={() => setZoomAt(viewportZoom - 0.15)}
            onFitView={fitView}
            isFullscreen={isFullscreen}
            onToggleFullscreen={() => setIsFullscreen((current) => !current)}
            showFullscreenToggle={false}
            width={minimapWidth}
            height={minimapHeight}
          />
        )}
      </div>
    </section>
  );
}

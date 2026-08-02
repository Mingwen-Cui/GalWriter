import { ScanSearch, ZoomIn } from 'lucide-react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { Language } from '../../../lib/i18n';
import { getPlaytestWindowText } from './i18n/playtest-window';

type WindowBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ResizeEdge =
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'top-left'
  | 'top-right'
  | 'bottom-right'
  | 'bottom-left';

type DragState = {
  pointerId: number;
  anchorX: number;
  anchorY: number;
};

type ResizeState = {
  pointerId: number;
  edge: ResizeEdge;
  startX: number;
  startY: number;
  bounds: WindowBounds;
};

const STORAGE_KEY = 'galwriter-playtest-window-bounds:v1';
const VIEWPORT_PADDING = 16;
const DEFAULT_WIDTH = 760;
const DEFAULT_HEIGHT = 560;
const WINDOW_ASPECT_RATIO = DEFAULT_WIDTH / DEFAULT_HEIGHT;
const MIN_WIDTH = 520;
const HOVER_SCALE = 1.12;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const clampBounds = (
  bounds: WindowBounds,
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight,
): WindowBounds => {
  const availableWidth = Math.max(280, viewportWidth - VIEWPORT_PADDING * 2);
  const availableHeight = Math.max(240, viewportHeight - VIEWPORT_PADDING * 2);
  const maxWidth = Math.min(availableWidth, availableHeight * WINDOW_ASPECT_RATIO);
  const minWidth = Math.min(MIN_WIDTH, maxWidth);
  const width = clamp(bounds.width, minWidth, maxWidth);
  const height = width / WINDOW_ASPECT_RATIO;
  const maxX = Math.max(VIEWPORT_PADDING, viewportWidth - width - VIEWPORT_PADDING);
  const maxY = Math.max(VIEWPORT_PADDING, viewportHeight - height - VIEWPORT_PADDING);

  return {
    x: clamp(bounds.x, VIEWPORT_PADDING, maxX),
    y: clamp(bounds.y, VIEWPORT_PADDING, maxY),
    width,
    height,
  };
};

const createDefaultBounds = (): WindowBounds => {
  const viewportWidth = typeof window === 'undefined' ? 1440 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 900 : window.innerHeight;
  const availableWidth = Math.min(
    viewportWidth - VIEWPORT_PADDING * 2,
    (viewportHeight - VIEWPORT_PADDING * 2) * WINDOW_ASPECT_RATIO,
  );
  const width = clamp(viewportWidth * 0.5, Math.min(MIN_WIDTH, availableWidth), DEFAULT_WIDTH);
  const height = width / WINDOW_ASPECT_RATIO;

  return clampBounds(
    {
      x: viewportWidth - width - 24,
      y: viewportHeight - height - 24,
      width,
      height,
    },
    viewportWidth,
    viewportHeight,
  );
};

const readStoredBounds = (): WindowBounds => {
  if (typeof window === 'undefined') return createDefaultBounds();
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) || 'null',
    ) as Partial<WindowBounds> | null;
    if (
      stored &&
      typeof stored.x === 'number' &&
      typeof stored.y === 'number' &&
      typeof stored.width === 'number' &&
      typeof stored.height === 'number'
    ) {
      return clampBounds(stored as WindowBounds);
    }
  } catch {
    // Ignore invalid local window state and restore the default bounds.
  }
  return createDefaultBounds();
};

const getHoveredBounds = (bounds: WindowBounds): WindowBounds => {
  const width = bounds.width * HOVER_SCALE;
  const height = bounds.height * HOVER_SCALE;
  return clampBounds({
    x: bounds.x - (width - bounds.width) / 2,
    y: bounds.y - (height - bounds.height) / 2,
    width,
    height,
  });
};

const resizeHandleClass = (edge: ResizeEdge) => {
  switch (edge) {
    case 'top':
      return 'left-3 right-3 top-0 h-2 cursor-ns-resize';
    case 'right':
      return 'bottom-3 right-0 top-3 w-2 cursor-ew-resize';
    case 'bottom':
      return 'bottom-0 left-3 right-3 h-2 cursor-ns-resize';
    case 'left':
      return 'bottom-3 left-0 top-3 w-2 cursor-ew-resize';
    case 'top-left':
      return 'left-0 top-0 h-4 w-4 cursor-nwse-resize';
    case 'top-right':
      return 'right-0 top-0 h-4 w-4 cursor-nesw-resize';
    case 'bottom-right':
      return 'bottom-0 right-0 h-4 w-4 cursor-nwse-resize';
    case 'bottom-left':
      return 'bottom-0 left-0 h-4 w-4 cursor-nesw-resize';
  }
};

const resizeEdges: ResizeEdge[] = [
  'top',
  'right',
  'bottom',
  'left',
  'top-left',
  'top-right',
  'bottom-right',
  'bottom-left',
];

interface PlaytestFloatingWindowProps {
  language: Language;
  autoScaleOnHover: boolean;
  children: ReactNode;
}

export function PlaytestFloatingWindow({
  language,
  autoScaleOnHover,
  children,
}: PlaytestFloatingWindowProps) {
  const text = getPlaytestWindowText(language);
  const [bounds, setBounds] = useState(readStoredBounds);
  const [hovered, setHovered] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const boundsRef = useRef(bounds);
  const displayedBoundsRef = useRef(bounds);
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);

  useEffect(() => {
    boundsRef.current = bounds;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bounds));
    } catch {
      // The floating window remains usable when local storage is unavailable.
    }
  }, [bounds]);

  useEffect(() => {
    const handleViewportResize = () => setBounds((current) => clampBounds(current));
    window.addEventListener('resize', handleViewportResize);
    return () => window.removeEventListener('resize', handleViewportResize);
  }, []);

  const displayedBounds = useMemo(
    () => (autoScaleOnHover && hovered && !interacting ? getHoveredBounds(bounds) : bounds),
    [autoScaleOnHover, bounds, hovered, interacting],
  );
  displayedBoundsRef.current = displayedBounds;

  const beginDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (!target.closest('[data-playtest-window-drag-handle]')) return;
    if (target.closest('button,input,select,textarea,a,[role="button"]')) return;

    const displayed = displayedBoundsRef.current;
    dragRef.current = {
      pointerId: event.pointerId,
      anchorX: clamp((event.clientX - displayed.x) / displayed.width, 0, 1),
      anchorY: clamp((event.clientY - displayed.y) / displayed.height, 0, 1),
    };
    setInteracting(true);
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const movePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId === event.pointerId) {
      const current = boundsRef.current;
      setBounds(
        clampBounds({
          ...current,
          x: event.clientX - current.width * drag.anchorX,
          y: event.clientY - current.height * drag.anchorY,
        }),
      );
      return;
    }

    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - resize.startX;
    const deltaY = event.clientY - resize.startY;
    const horizontalWidth = resize.edge.includes('left')
      ? resize.bounds.width - deltaX
      : resize.bounds.width + deltaX;
    const verticalHeight = resize.edge.includes('top')
      ? resize.bounds.height - deltaY
      : resize.bounds.height + deltaY;
    const verticalWidth = verticalHeight * WINDOW_ASPECT_RATIO;
    const usesHorizontalEdge = resize.edge.includes('left') || resize.edge.includes('right');
    const usesVerticalEdge = resize.edge.includes('top') || resize.edge.includes('bottom');
    const width =
      usesHorizontalEdge && usesVerticalEdge
        ? Math.abs(horizontalWidth - resize.bounds.width) >=
          Math.abs(verticalWidth - resize.bounds.width)
          ? horizontalWidth
          : verticalWidth
        : usesHorizontalEdge
          ? horizontalWidth
          : verticalWidth;
    const height = width / WINDOW_ASPECT_RATIO;
    const next = {
      ...resize.bounds,
      width,
      height,
      x: resize.edge.includes('left')
        ? resize.bounds.x + resize.bounds.width - width
        : usesHorizontalEdge
          ? resize.bounds.x
          : resize.bounds.x + (resize.bounds.width - width) / 2,
      y: resize.edge.includes('top')
        ? resize.bounds.y + resize.bounds.height - height
        : usesVerticalEdge
          ? resize.bounds.y
          : resize.bounds.y + (resize.bounds.height - height) / 2,
    };

    setBounds(clampBounds(next));
  };

  const endPointerInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      dragRef.current?.pointerId !== event.pointerId &&
      resizeRef.current?.pointerId !== event.pointerId
    ) {
      return;
    }
    dragRef.current = null;
    resizeRef.current = null;
    setInteracting(false);
  };

  const beginResize = (edge: ResizeEdge) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = {
      pointerId: event.pointerId,
      edge,
      startX: event.clientX,
      startY: event.clientY,
      bounds: boundsRef.current,
    };
    setInteracting(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const style: CSSProperties = {
    left: displayedBounds.x,
    top: displayedBounds.y,
    width: displayedBounds.width,
    height: displayedBounds.height,
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]">
      <div
        role="dialog"
        aria-label={text.windowTitle}
        className={`pointer-events-auto absolute overflow-visible rounded-[18px] shadow-2xl shadow-slate-950/35 ${
          interacting
            ? 'transition-none'
            : 'transition-[left,top,width,height] duration-200 ease-out'
        }`}
        style={style}
        onPointerDownCapture={beginDrag}
        onPointerMove={movePointer}
        onPointerUp={endPointerInteraction}
        onPointerCancel={endPointerInteraction}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        {resizeEdges.map((edge) => (
          <div
            key={edge}
            role="separator"
            aria-label={text.resizeWindow}
            className={`absolute z-[400] touch-none ${resizeHandleClass(edge)}`}
            onPointerDown={beginResize(edge)}
          />
        ))}
        {children}
      </div>
    </div>
  );
}

interface PlaytestWindowActionsProps {
  language: Language;
  isDarkMode: boolean;
  immersive: boolean;
  buttonClassName: string;
  followSelectedCard: boolean;
  hasSelectedCard: boolean;
  autoScaleOnHover: boolean;
  onFollowSelectedCardChange: (active: boolean) => void;
  onAutoScaleOnHoverChange: (active: boolean) => void;
}

export function PlaytestWindowActions({
  language,
  isDarkMode,
  immersive,
  buttonClassName,
  followSelectedCard,
  hasSelectedCard,
  autoScaleOnHover,
  onFollowSelectedCardChange,
  onAutoScaleOnHoverChange,
}: PlaytestWindowActionsProps) {
  const text = getPlaytestWindowText(language);
  const idleClass = immersive
    ? 'bg-white/10 text-white hover:bg-white/20'
    : isDarkMode
      ? 'bg-white/10 text-white hover:bg-white/20'
      : 'bg-slate-100 text-slate-600 hover:bg-slate-200';

  return (
    <>
      <button
        type="button"
        onClick={() => onFollowSelectedCardChange(!followSelectedCard)}
        className={`${buttonClassName} transition-colors ${
          followSelectedCard ? 'bg-sky-500/85 text-white hover:bg-sky-500' : idleClass
        }`}
        title={
          !hasSelectedCard
            ? text.followSelectedCardEmpty
            : followSelectedCard
              ? text.followSelectedCardActive
              : text.followSelectedCardInactive
        }
        aria-label={text.followSelectedCard}
        aria-pressed={followSelectedCard}
      >
        <ScanSearch className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={() => onAutoScaleOnHoverChange(!autoScaleOnHover)}
        className={`${buttonClassName} transition-colors ${
          autoScaleOnHover ? 'bg-violet-500/85 text-white hover:bg-violet-500' : idleClass
        }`}
        title={autoScaleOnHover ? text.autoScaleActive : text.autoScaleInactive}
        aria-label={text.autoScale}
        aria-pressed={autoScaleOnHover}
      >
        <ZoomIn className="h-5 w-5" />
      </button>
    </>
  );
}

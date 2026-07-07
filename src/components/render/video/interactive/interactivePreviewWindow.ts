import { useEffect, useRef } from 'react';
import type React from 'react';

export type InteractivePreviewDock = null | 'left' | 'right' | 'top' | 'bottom';

export type InteractivePreviewBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  dock: InteractivePreviewDock;
};

export type InteractivePreviewResizeEdge =
  | 'top'
  | 'right'
  | 'bottom'
  | 'left'
  | 'top-left'
  | 'top-right'
  | 'bottom-right'
  | 'bottom-left';

export const DEFAULT_INTERACTIVE_PREVIEW_BOUNDS: InteractivePreviewBounds = {
  x: 96,
  y: 92,
  width: 860,
  height: 640,
  dock: null,
};

const MIN_PREVIEW_WIDTH = 420;
const MIN_PREVIEW_HEIGHT = 320;
const EDGE_PADDING = 16;
const SNAP_DISTANCE = 24;

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const isInteractivePreviewBounds = (value: unknown): value is InteractivePreviewBounds => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<InteractivePreviewBounds>;
  return (
    typeof candidate.x === 'number' &&
    typeof candidate.y === 'number' &&
    typeof candidate.width === 'number' &&
    typeof candidate.height === 'number' &&
    (candidate.dock === null ||
      candidate.dock === 'left' ||
      candidate.dock === 'right' ||
      candidate.dock === 'top' ||
      candidate.dock === 'bottom')
  );
};

export const clampInteractivePreviewBounds = (
  bounds: InteractivePreviewBounds,
  viewportWidth = typeof window === 'undefined' ? 1024 : window.innerWidth,
  viewportHeight = typeof window === 'undefined' ? 768 : window.innerHeight,
): InteractivePreviewBounds => {
  const maxWidth = Math.max(MIN_PREVIEW_WIDTH, viewportWidth - EDGE_PADDING * 2);
  const maxHeight = Math.max(MIN_PREVIEW_HEIGHT, viewportHeight - EDGE_PADDING * 2);
  const width = clampNumber(bounds.width, MIN_PREVIEW_WIDTH, maxWidth);
  const height = clampNumber(bounds.height, MIN_PREVIEW_HEIGHT, maxHeight);
  const maxX = Math.max(0, viewportWidth - width);
  const maxY = Math.max(0, viewportHeight - height);
  let x = clampNumber(bounds.x, EDGE_PADDING, Math.max(EDGE_PADDING, maxX - EDGE_PADDING));
  let y = clampNumber(bounds.y, EDGE_PADDING, Math.max(EDGE_PADDING, maxY - EDGE_PADDING));

  if (bounds.dock === 'left') x = 0;
  if (bounds.dock === 'right') x = maxX;
  if (bounds.dock === 'top') y = 0;
  if (bounds.dock === 'bottom') y = maxY;

  return { ...bounds, x, y, width, height };
};

const snapInteractivePreviewBounds = (bounds: InteractivePreviewBounds): InteractivePreviewBounds => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxX = Math.max(0, viewportWidth - bounds.width);
  const maxY = Math.max(0, viewportHeight - bounds.height);

  if (bounds.x <= SNAP_DISTANCE) return { ...bounds, x: 0, dock: 'left' };
  if (maxX - bounds.x <= SNAP_DISTANCE) return { ...bounds, x: maxX, dock: 'right' };
  if (bounds.y <= SNAP_DISTANCE) return { ...bounds, y: 0, dock: 'top' };
  if (maxY - bounds.y <= SNAP_DISTANCE) return { ...bounds, y: maxY, dock: 'bottom' };
  return { ...bounds, dock: null };
};

type DragState = {
  pointerId: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
};

type ResizeState = {
  pointerId: number;
  edge: InteractivePreviewResizeEdge;
  startX: number;
  startY: number;
  bounds: InteractivePreviewBounds;
};

export const useInteractivePreviewWindow = (
  bounds: InteractivePreviewBounds,
  onBoundsChange: React.Dispatch<React.SetStateAction<InteractivePreviewBounds>>,
) => {
  const boundsRef = useRef(bounds);
  const dragRef = useRef<DragState | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);

  useEffect(() => {
    boundsRef.current = bounds;
  }, [bounds]);

  useEffect(() => {
    const handleResize = () => {
      onBoundsChange((previous) => clampInteractivePreviewBounds(previous));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [onBoundsChange]);

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const drag = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const next = clampInteractivePreviewBounds({
      ...boundsRef.current,
      x: event.clientX - current.offsetX,
      y: event.clientY - current.offsetY,
      width: current.width,
      height: current.height,
      dock: null,
    });
    onBoundsChange(snapInteractivePreviewBounds(next));
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  const beginResize =
    (edge: InteractivePreviewResizeEdge) => (event: React.PointerEvent<HTMLDivElement>) => {
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
      event.currentTarget.setPointerCapture(event.pointerId);
    };

  const resize = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = resizeRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();

    const deltaX = event.clientX - current.startX;
    const deltaY = event.clientY - current.startY;
    const next = { ...current.bounds, dock: null };

    if (current.edge.includes('right')) {
      next.width = current.bounds.width + deltaX;
    }
    if (current.edge.includes('bottom')) {
      next.height = current.bounds.height + deltaY;
    }
    if (current.edge.includes('left')) {
      next.width = current.bounds.width - deltaX;
      next.x = current.bounds.x + deltaX;
    }
    if (current.edge.includes('top')) {
      next.height = current.bounds.height - deltaY;
      next.y = current.bounds.y + deltaY;
    }

    if (next.width < MIN_PREVIEW_WIDTH && current.edge.includes('left')) {
      next.x -= MIN_PREVIEW_WIDTH - next.width;
    }
    if (next.height < MIN_PREVIEW_HEIGHT && current.edge.includes('top')) {
      next.y -= MIN_PREVIEW_HEIGHT - next.height;
    }

    onBoundsChange(snapInteractivePreviewBounds(clampInteractivePreviewBounds(next)));
  };

  const endResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (resizeRef.current?.pointerId === event.pointerId) {
      resizeRef.current = null;
    }
  };

  const windowStyle: React.CSSProperties = {
    left: bounds.x,
    top: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };

  return {
    beginDrag,
    drag,
    endDrag,
    beginResize,
    resize,
    endResize,
    windowStyle,
  };
};

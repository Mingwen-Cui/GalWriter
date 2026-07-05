import type { CSSProperties } from 'react';

export type StartMenuResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const resizeCursorByHandle: Record<StartMenuResizeHandle, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};

export const resizeHandlePositionClass: Record<StartMenuResizeHandle, string> = {
  nw: '-left-1.5 -top-1.5',
  n: 'left-1/2 -top-1.5 -translate-x-1/2',
  ne: '-right-1.5 -top-1.5',
  e: '-right-1.5 top-1/2 -translate-y-1/2',
  se: '-bottom-1.5 -right-1.5',
  s: 'left-1/2 -bottom-1.5 -translate-x-1/2',
  sw: '-bottom-1.5 -left-1.5',
  w: '-left-1.5 top-1/2 -translate-y-1/2',
};

export const resizeHandleShapeClass: Record<StartMenuResizeHandle, string> = {
  nw: 'h-3 w-3 rounded-full',
  n: 'h-2 rounded-full',
  ne: 'h-3 w-3 rounded-full',
  e: 'w-2 rounded-full',
  se: 'h-3 w-3 rounded-full',
  s: 'h-2 rounded-full',
  sw: 'h-3 w-3 rounded-full',
  w: 'w-2 rounded-full',
};

export const getResizeHandleStyle = (handle: StartMenuResizeHandle): CSSProperties => {
  if (handle === 'n' || handle === 's') {
    return { width: 'min(72%, 120px)', minWidth: 24, cursor: resizeCursorByHandle[handle] };
  }
  if (handle === 'e' || handle === 'w') {
    return { height: 'min(72%, 120px)', minHeight: 24, cursor: resizeCursorByHandle[handle] };
  }
  return { cursor: resizeCursorByHandle[handle] };
};

export const readStartMenuImageFile = (file: File, onReady: (value: string) => void) => {
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === 'string') onReady(reader.result);
  };
  reader.readAsDataURL(file);
};

export const protectedStartMenuElementRoles = new Set(['save', 'new', 'settings']);

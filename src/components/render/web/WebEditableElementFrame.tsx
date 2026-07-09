import { Eye, EyeOff, RotateCw } from 'lucide-react';
import type React from 'react';

export type WebEditableResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const webEditableResizeHandles: WebEditableResizeHandle[] = [
  'nw',
  'n',
  'ne',
  'e',
  'se',
  's',
  'sw',
  'w',
];

const positionClass: Record<WebEditableResizeHandle, string> = {
  n: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2',
  s: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
  e: 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2',
  w: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2',
  ne: 'right-0 top-0 translate-x-1/2 -translate-y-1/2',
  nw: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2',
  se: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2',
  sw: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2',
};

const shapeClass: Record<WebEditableResizeHandle, string> = {
  n: 'h-5 w-16 rounded-full opacity-0',
  s: 'h-5 w-16 rounded-full opacity-0',
  e: 'h-16 w-5 rounded-full opacity-0',
  w: 'h-16 w-5 rounded-full opacity-0',
  ne: 'h-4 w-4 rounded-full',
  nw: 'h-4 w-4 rounded-full',
  se: 'h-4 w-4 rounded-full',
  sw: 'h-4 w-4 rounded-full',
};

export function WebEditableElementFrame({
  visible,
  ringClassName = 'ring-2 ring-indigo-500',
  onToggleVisible,
  onRotatePointerDown,
  onResizePointerDown,
}: {
  visible: boolean;
  ringClassName?: string;
  onToggleVisible: (event: React.MouseEvent<HTMLElement>) => void;
  onRotatePointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onResizePointerDown: (
    event: React.PointerEvent<HTMLElement>,
    handle: WebEditableResizeHandle,
  ) => void;
}) {
  return (
    <>
      <span className={`pointer-events-none absolute inset-0 z-30 ${ringClassName}`} />
      <span
        role="button"
        tabIndex={-1}
        className="pointer-events-auto absolute -left-10 top-1/2 z-40 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white text-slate-900 shadow-lg"
        style={{ cursor: 'alias' }}
        onPointerDown={onRotatePointerDown}
        onClick={(event) => event.stopPropagation()}
        aria-label="Rotate"
      >
        <RotateCw className="h-4 w-4" />
      </span>
      <span
        role="button"
        tabIndex={-1}
        className="pointer-events-auto absolute -right-10 top-1/2 z-40 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-indigo-600 text-white shadow-lg"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onToggleVisible}
        aria-label={visible ? 'Hide' : 'Show'}
      >
        {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </span>
      {webEditableResizeHandles.map((handle) => (
        <span
          key={handle}
          role="button"
          tabIndex={-1}
          className={`pointer-events-auto absolute z-40 border border-indigo-200 bg-white shadow ${positionClass[handle]} ${shapeClass[handle]}`}
          onPointerDown={(event) => onResizePointerDown(event, handle)}
          onClick={(event) => event.stopPropagation()}
          aria-label="Resize"
        />
      ))}
    </>
  );
}

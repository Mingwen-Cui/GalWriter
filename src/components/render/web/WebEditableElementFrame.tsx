import { Eye, EyeOff, RotateCw, Trash2 } from 'lucide-react';
import type React from 'react';

export type WebEditableResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const webEditableResizeHandles: WebEditableResizeHandle[] = [
  'n',
  's',
  'e',
  'w',
  'nw',
  'ne',
  'se',
  'sw',
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
  n: 'h-5 w-full',
  s: 'h-5 w-full',
  e: 'h-full w-5',
  w: 'h-full w-5',
  ne: 'h-5 w-5',
  nw: 'h-5 w-5',
  se: 'h-5 w-5',
  sw: 'h-5 w-5',
};

const visibleHandleClass: Record<WebEditableResizeHandle, string> = {
  n: 'bg-transparent',
  s: 'bg-transparent',
  e: 'bg-transparent',
  w: 'bg-transparent',
  ne: 'border border-indigo-200 bg-white shadow',
  nw: 'border border-indigo-200 bg-white shadow',
  se: 'border border-indigo-200 bg-white shadow',
  sw: 'border border-indigo-200 bg-white shadow',
};

const cursorByHandle: Record<WebEditableResizeHandle, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};

export function WebEditableElementFrame({
  visible,
  ringClassName = 'ring-2 ring-indigo-500',
  onToggleVisible,
  onDelete,
  onRotatePointerDown,
  onResizePointerDown,
  showAuxiliaryControls = true,
}: {
  visible: boolean;
  ringClassName?: string;
  onToggleVisible: (event: React.MouseEvent<HTMLElement>) => void;
  onDelete?: (event: React.MouseEvent<HTMLElement>) => void;
  onRotatePointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onResizePointerDown: (
    event: React.PointerEvent<HTMLElement>,
    handle: WebEditableResizeHandle,
  ) => void;
  showAuxiliaryControls?: boolean;
}) {
  return (
    <>
      <span className={`pointer-events-none absolute inset-0 z-[260] ${ringClassName}`} />
      {showAuxiliaryControls && <span
        tabIndex={-1}
        className="pointer-events-auto absolute -left-10 top-1/2 z-[9999] grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white text-slate-900 shadow-lg"
        style={{ cursor: 'grab', pointerEvents: 'auto', touchAction: 'none', zIndex: 2147483646 }}
        onPointerDown={(event) => { event.stopPropagation(); onRotatePointerDown(event); }}
        onClick={(event) => event.stopPropagation()}
        aria-label="Rotate"
      >
        <RotateCw className="h-4 w-4" />
      </span>}
      {showAuxiliaryControls && <span
        tabIndex={-1}
        className="pointer-events-auto absolute -right-10 top-1/2 z-[9999] grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-indigo-600 text-white shadow-lg"
        style={{ pointerEvents: 'auto', touchAction: 'none', zIndex: 2147483646 }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onToggleVisible}
        aria-label={visible ? 'Hide' : 'Show'}
      >
        {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </span>}
      {onDelete && (
        <span
          tabIndex={-1}
          className="pointer-events-auto absolute -right-10 top-[calc(50%+40px)] z-[9999] grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-rose-500 text-white shadow-lg"
          style={{ pointerEvents: 'auto', touchAction: 'none', zIndex: 2147483646 }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onDelete}
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </span>
      )}
      {webEditableResizeHandles.map((handle) => (
        <span
          key={handle}
          tabIndex={-1}
          className={`pointer-events-auto absolute z-[270] ${positionClass[handle]} ${shapeClass[handle]} ${visibleHandleClass[handle]}`}
          style={{ cursor: cursorByHandle[handle], pointerEvents: 'auto', touchAction: 'none', zIndex: 2147483647 }}
          onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); onResizePointerDown(event, handle); }}
          onClick={(event) => event.stopPropagation()}
          aria-label="Resize border"
        />
      ))}
    </>
  );
}

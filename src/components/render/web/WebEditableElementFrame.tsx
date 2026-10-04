import { WebLineEndpointHandles } from './WebLineEndpointHandles';
import type { WebMenuElement } from '../video/shared/types';
import { Eye, EyeOff, List, Lock, Unlock, RotateCw, Trash2 } from 'lucide-react';
import type React from 'react';

export type WebEditableResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const webEditableResizeHandles: WebEditableResizeHandle[] = ['nw', 'ne', 'se', 'sw'];

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
  line,
  ringClassName = 'ring-1 ring-indigo-500',
  onToggleVisible,
  onDelete,
  onRotatePointerDown,
  onResizePointerDown,
  onToggleSlotPreview,
  slotPreviewActive = false,
  showAuxiliaryControls = true,
  showVisibilityControl = true,
  showResizeHandles = true,
  locked = false,
  onToggleLocked,
}: {
  compact?: boolean;
  line?: { element: WebMenuElement; canvasWidth: number; canvasHeight: number; onUpdate: (id: string, patch: Partial<WebMenuElement>) => void };
  visible: boolean;
  ringClassName?: string;
  onToggleVisible: (event: React.MouseEvent<HTMLElement>) => void;
  onDelete?: (event: React.MouseEvent<HTMLElement>) => void;
  onRotatePointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onResizePointerDown: (
    event: React.PointerEvent<HTMLElement>,
    handle: WebEditableResizeHandle,
  ) => void;
  onToggleSlotPreview?: (event: React.MouseEvent<HTMLElement>) => void;
  slotPreviewActive?: boolean;
  showAuxiliaryControls?: boolean;
  showVisibilityControl?: boolean;
  showResizeHandles?: boolean;
  locked?: boolean;
  onToggleLocked?: (event: React.MouseEvent<HTMLElement>) => void;
}) {
  return (
    <>
      <span className={`pointer-events-none absolute inset-0 z-[260] ${ringClassName}`} />
      {showAuxiliaryControls && !locked && !line && (
        <span
          tabIndex={-1}
          className="pointer-events-auto absolute -left-10 top-1/2 z-[9999] grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white text-slate-900 shadow-lg"
          style={{
            cursor: 'crosshair',
            pointerEvents: 'auto',
            touchAction: 'none',
            zIndex: 2147483646,
          }}
          data-editable-frame-control="rotate"
          onPointerDown={(event) => {
            event.stopPropagation();
            onRotatePointerDown(event);
          }}
          onClick={(event) => event.stopPropagation()}
          aria-label="Rotate"
        >
          <RotateCw className="h-4 w-4" />
        </span>
      )}
      {showAuxiliaryControls && showVisibilityControl && (
        <span
          tabIndex={-1}
          className="pointer-events-auto absolute -right-10 top-1/2 z-[9999] grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-indigo-600 text-white shadow-lg"
          style={{
            cursor: 'pointer',
            pointerEvents: 'auto',
            touchAction: 'none',
            zIndex: 2147483646,
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onToggleVisible}
          aria-label={visible ? 'Hide' : 'Show'}
        >
          {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </span>
      )}
      {onToggleSlotPreview && (
        <span
          tabIndex={-1}
          className={`pointer-events-auto absolute -right-10 top-[calc(50%-40px)] z-[9999] grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-white shadow-lg ${slotPreviewActive ? 'bg-indigo-600' : 'bg-slate-700'}`}
          style={{
            cursor: 'pointer',
            pointerEvents: 'auto',
            touchAction: 'none',
            zIndex: 2147483646,
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onToggleSlotPreview}
          aria-label={slotPreviewActive ? 'Show empty archive' : 'Preview saved archive'}
          title={slotPreviewActive ? 'Show empty archive' : 'Preview saved archive'}
        >
          <List className="h-4 w-4" />
        </span>
      )}
      {onDelete && (
        <span
          tabIndex={-1}
          className="pointer-events-auto absolute -right-10 top-[calc(50%+40px)] z-[9999] grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-rose-500 text-white shadow-lg"
          style={{
            cursor: 'pointer',
            pointerEvents: 'auto',
            touchAction: 'none',
            zIndex: 2147483646,
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onDelete}
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </span>
      )}
      {onToggleLocked && (
        <span
          role="button"
          tabIndex={0}
          data-editable-frame-control="lock"
          aria-label={locked ? '解锁' : '锁定'}
          aria-pressed={locked}
          title={locked ? '解锁' : '锁定：右键可再次选中'}
          className={`pointer-events-auto absolute -right-10 z-[9999] grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-slate-700 text-white shadow-lg ${onToggleSlotPreview ? 'top-[calc(50%-80px)]' : 'top-[calc(50%-40px)]'}`}
          style={{ cursor: 'pointer', pointerEvents: 'auto', touchAction: 'none', zIndex: 2147483646 }}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onToggleLocked}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.click();
            }
          }}
        >
          {locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
        </span>
      )}
      {line && !locked && <WebLineEndpointHandles {...line} />}
      {showResizeHandles && !locked && !line &&
        webEditableResizeHandles.map((handle) => (
          <span
            key={handle}
            tabIndex={-1}
            data-editable-frame-control="resize"
            className={`pointer-events-auto absolute z-[270] grid h-3 w-3 place-items-center ${positionClass[handle]}`}
            style={{
              cursor: cursorByHandle[handle],
              pointerEvents: 'auto',
              touchAction: 'none',
              zIndex: 2147483647,
            }}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onResizePointerDown(event, handle);
            }}
            onClick={(event) => event.stopPropagation()}
            aria-label="Resize border"
          >
            <span className="pointer-events-none block h-1.5 w-1.5 border border-indigo-400 bg-white" />
          </span>
        ))}
    </>
  );
}

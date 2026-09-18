import type React from 'react';
import { useState } from 'react';
import type { WebMenuElement } from '../video/shared/types';
import { WebEditableElementFrame, type WebEditableResizeHandle } from './WebEditableElementFrame';
import { arrangeToolbarRow, toolbarRowGap } from './webToolbarLayout';

export function WebToolbarSelectionTools({
  elements,
  selectedIds,
  toolbar,
  onUpdate,
}: {
  elements: WebMenuElement[];
  selectedIds: string[];
  toolbar: boolean;
  onUpdate?: (elements: WebMenuElement[]) => void;
}) {
  const [gapDragging, setGapDragging] = useState(false);
  const selected = elements.filter((element) => selectedIds.includes(element.id));
  const row = elements.filter((element) => element.kind === 'button').sort((a, b) => a.x - b.x);
  const bounds =
    selected.length > 1
      ? {
          x: Math.min(...selected.map((element) => element.x)),
          y: Math.min(...selected.map((element) => element.y)),
          right: Math.max(...selected.map((element) => element.x + element.width)),
          bottom: Math.max(...selected.map((element) => element.y + element.height)),
        }
      : null;

  const drag = (
    event: React.PointerEvent<HTMLElement>,
    mode: 'gap' | 'move' | 'resize',
    handle?: WebEditableResizeHandle,
  ) => {
    if (!onUpdate || event.button !== 0) return;
    const layer = event.currentTarget.closest<HTMLElement>('[data-toolbar-editor]');
    if (!layer) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = layer.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const initialGap = toolbarRowGap(row);
    const right = Math.max(...row.map((element) => element.x + element.width));
    const top = Math.min(...row.map((element) => element.y));
    if (mode === 'gap') setGapDragging(true);
    document.body.style.cursor =
      mode === 'gap'
        ? 'ew-resize'
        : mode === 'move'
          ? 'grabbing'
          : handle === 'nw' || handle === 'se'
            ? 'nwse-resize'
            : 'nesw-resize';
    const move = (next: PointerEvent) => {
      const dx = ((next.clientX - startX) / rect.width) * 100;
      const dy = ((next.clientY - startY) / rect.height) * 100;
      if (mode === 'gap') {
        const arranged = arrangeToolbarRow(
          row,
          layer.clientWidth,
          layer.clientHeight,
          Math.max(0, initialGap + dx),
          right,
          top,
        );
        const byId = new Map(arranged.map((element) => [element.id, element]));
        onUpdate(elements.map((element) => byId.get(element.id) || element));
        return;
      }
      if (!bounds) return;
      if (mode === 'move') {
        const offsetX = Math.max(-bounds.x, Math.min(100 - bounds.right, dx));
        const offsetY = Math.max(-bounds.y, Math.min(100 - bounds.bottom, dy));
        onUpdate(
          elements.map((element) =>
            selectedIds.includes(element.id)
              ? { ...element, x: element.x + offsetX, y: element.y + offsetY }
              : element,
          ),
        );
        return;
      }
      const width = bounds.right - bounds.x;
      const height = bounds.bottom - bounds.y;
      const sx = handle?.includes('w') ? -1 : 1;
      const sy = handle?.includes('n') ? -1 : 1;
      const pixelWidth = width * rect.width;
      const pixelHeight = height * rect.height;
      // Project the pointer on the diagonal to keep circles, labels and gaps proportional.
      const rawScale =
        1 +
        (sx * dx * rect.width * pixelWidth + sy * dy * rect.height * pixelHeight) /
          Math.max(1, pixelWidth ** 2 + pixelHeight ** 2);
      const anchorX = sx < 0 ? bounds.right : bounds.x;
      const anchorY = sy < 0 ? bounds.bottom : bounds.y;
      const maxScale = Math.min(
        (sx < 0 ? anchorX : 100 - anchorX) / width,
        (sy < 0 ? anchorY : 100 - anchorY) / height,
      );
      const minScale = Math.max(
        ...selected.map((element) => Math.max(0.5 / element.width, 0.5 / element.height)),
      );
      const scale = Math.max(Math.min(minScale, maxScale), Math.min(maxScale, rawScale));
      onUpdate(
        elements.map((element) =>
          selectedIds.includes(element.id)
            ? {
                ...element,
                x: anchorX + (element.x - anchorX) * scale,
                y: anchorY + (element.y - anchorY) * scale,
                width: element.width * scale,
                height: element.height * scale,
                fontSize: (element.fontSize || 14) * scale,
              }
            : element,
        ),
      );
    };
    const end = () => {
      setGapDragging(false);
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  return (
    <>
      {bounds && (
        <div
          className="pointer-events-none absolute z-[1100]"
          style={{
            left: `${bounds.x}%`,
            top: `${bounds.y}%`,
            width: `${bounds.right - bounds.x}%`,
            height: `${bounds.bottom - bounds.y}%`,
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div
            className="pointer-events-auto absolute inset-0 cursor-move bg-transparent"
            onPointerDown={(event) => drag(event, 'move')}
          />
          <WebEditableElementFrame
            visible
            showAuxiliaryControls={false}
            onToggleVisible={() => {}}
            onRotatePointerDown={() => {}}
            onResizePointerDown={(event, handle) => drag(event, 'resize', handle)}
          />
        </div>
      )}
      {toolbar &&
        row.slice(1).map((element, index) => {
          const previous = row[index];
          const gap = element.x - previous.x - previous.width;
          if (gap < -0.1 || Math.abs(element.y - previous.y) > 1) return null;
          return (
            <div
              key={`${previous.id}-${element.id}`}
              className="group pointer-events-auto absolute z-[1200] grid cursor-ew-resize place-items-center"
              style={{
                left: `${previous.x + previous.width + gap / 2}%`,
                top: `${Math.min(previous.y, element.y)}%`,
                width: 'max(12px, 0.6%)',
                height: `${Math.max(previous.height, element.height)}%`,
                transform: 'translateX(-50%)',
                touchAction: 'none',
              }}
              title="左右拖动，调整按钮的统一间距"
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => drag(event, 'gap')}
            >
              <span
                className={`pointer-events-none block h-1.5 w-1.5 border border-indigo-400 bg-white transition-opacity ${gapDragging || (selectedIds.includes(previous.id) && selectedIds.includes(element.id)) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              />
            </div>
          );
        })}
    </>
  );
}

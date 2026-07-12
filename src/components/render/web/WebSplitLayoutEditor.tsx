import type React from 'react';
import { useCallback, useLayoutEffect, useState } from 'react';

import type { SharedCanvasSettings } from '../canvas/canvasSettings';
import { getRenderObjects, updateRenderObject } from '../video/shared/renderObjects';
import type { RenderEditableObjectKind, RenderStyle } from '../video/shared/types';
import { WebEditableElementFrame, type WebEditableResizeHandle } from './WebEditableElementFrame';

export type SplitEditorSelection = 'scene' | 'background' | RenderEditableObjectKind;

type Box = { x: number; y: number; width: number; height: number };
type Props = {
  rootRef: React.RefObject<HTMLDivElement | null>;
  selection: SplitEditorSelection;
  onSelectionChange: (selection: SplitEditorSelection) => void;
  canvasSettings: SharedCanvasSettings;
  onCanvasSettingsChange: (patch: Partial<SharedCanvasSettings>) => void;
  renderStyle: RenderStyle;
  onRenderStyleChange: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
};

const kinds: RenderEditableObjectKind[] = ['dialogBox', 'title', 'body', 'nameplate'];

export function WebSplitLayoutEditor({ rootRef, selection, onSelectionChange, canvasSettings, onCanvasSettingsChange, renderStyle, onRenderStyleChange }: Props) {
  const [boxes, setBoxes] = useState<Partial<Record<SplitEditorSelection, Box>>>({});

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const rootRect = root.getBoundingClientRect();
    if (!rootRect.width || !rootRect.height) return;
    const scaleX = root.clientWidth / rootRect.width;
    const scaleY = root.clientHeight / rootRect.height;
    const read = (selector: string): Box | undefined => {
      const element = root.querySelector<HTMLElement>(selector);
      if (!element) return undefined;
      const rect = element.getBoundingClientRect();
      return { x: (rect.left - rootRect.left) * scaleX, y: (rect.top - rootRect.top) * scaleY, width: rect.width * scaleX, height: rect.height * scaleY };
    };
    setBoxes({
      scene: read('[data-split-visual-group]') || read('[data-split-scene-surface]'),
      background: { x: 0, y: 0, width: root.clientWidth, height: root.clientHeight },
      dialogBox: read('[data-render-object="dialogBox"]'),
      title: read('[data-render-object="title"]'),
      body: read('[data-render-object="body"]'),
      nameplate: read('[data-render-object="nameplate"]'),
    });
  }, [rootRef]);

  useLayoutEffect(() => {
    measure();
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    const mutation = new MutationObserver(measure);
    mutation.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
    return () => { observer.disconnect(); mutation.disconnect(); };
  }, [measure, renderStyle, canvasSettings]);

  const select = (next: SplitEditorSelection) => {
    onSelectionChange(next);
    onRenderStyleChange('selectedRenderObject', next === 'scene' || next === 'background' ? undefined : next);
  };

  const beginMove = (event: React.PointerEvent, kind: SplitEditorSelection) => {
    if (event.button !== 0 || kind === 'background') return;
    event.preventDefault();
    event.stopPropagation();
    select(kind);
    const startX = event.clientX;
    const startY = event.clientY;
    if (kind === 'scene') {
      const initialX = canvasSettings.sceneOffsetX;
      const initialY = canvasSettings.sceneOffsetY;
      const rootRect = rootRef.current?.getBoundingClientRect();
      const move = (moveEvent: PointerEvent) => {
        if (!rootRect) return;
        onCanvasSettingsChange({
          sceneOffsetX: clamp(initialX + ((moveEvent.clientX - startX) / Math.max(1, rootRect.width)) * 200, -100, 100),
          sceneOffsetY: clamp(initialY + ((moveEvent.clientY - startY) / Math.max(1, rootRect.height)) * 200, -100, 100),
        });
      };
      bindWindowDrag(move);
      return;
    }
    const object = getRenderObjects(renderStyle)[kind];
    const move = (moveEvent: PointerEvent) => {
      const next = updateRenderObject(renderStyle, kind, { x: Math.round(object.x + moveEvent.clientX - startX), y: Math.round(object.y + moveEvent.clientY - startY) });
      onRenderStyleChange('renderObjects', next);
    };
    bindWindowDrag(move);
  };

  const beginResize = (event: React.PointerEvent, kind: Exclude<SplitEditorSelection, 'background'>, handle: WebEditableResizeHandle) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    select(kind);
    const startX = event.clientX;
    const startY = event.clientY;
    const changesWidth = handle.includes('e') || handle.includes('w');
    const changesHeight = handle.includes('n') || handle.includes('s');
    const directionX = handle.includes('w') ? -1 : 1;
    const directionY = handle.includes('n') ? -1 : 1;
    if (kind === 'scene') {
      const initialX = canvasSettings.sceneScaleX;
      const initialY = canvasSettings.sceneScaleY;
      bindWindowDrag((moveEvent) => {
        const deltaX = (moveEvent.clientX - startX) * directionX / 3;
        const deltaY = (moveEvent.clientY - startY) * directionY / 3;
        const nextX = moveEvent.shiftKey
          ? (changesWidth ? clamp(initialX + deltaX, 25, 400) : initialX)
          : (() => {
              const factor = changesHeight && (!changesWidth || Math.abs(deltaY / Math.max(initialY, 1)) > Math.abs(deltaX / Math.max(initialX, 1)))
                ? (initialY + deltaY) / Math.max(initialY, 1)
                : (initialX + deltaX) / Math.max(initialX, 1);
              return clamp(initialX * factor, 25, 400);
            })();
        const nextY = moveEvent.shiftKey
          ? (changesHeight ? clamp(initialY + deltaY, 25, 400) : initialY)
          : (() => {
              const factor = changesHeight && (!changesWidth || Math.abs(deltaY / Math.max(initialY, 1)) > Math.abs(deltaX / Math.max(initialX, 1)))
                ? (initialY + deltaY) / Math.max(initialY, 1)
                : (initialX + deltaX) / Math.max(initialX, 1);
              return clamp(initialY * factor, 25, 400);
            })();
        onCanvasSettingsChange({ sceneScaleX: nextX, sceneScaleY: nextY, sceneScale: Math.round((nextX + nextY) / 2) });
      });
      return;
    }
    const object = getRenderObjects(renderStyle)[kind];
    const box = boxes[kind];
    bindWindowDrag((moveEvent) => {
      const dx = (moveEvent.clientX - startX) * directionX;
      const dy = (moveEvent.clientY - startY) * directionY;
      const width = changesWidth ? Math.max(kind === 'dialogBox' ? 35 : 8, object.width + dx * object.width / Math.max(1, box?.width || 1)) : object.width;
      const height = changesHeight ? Math.max(kind === 'dialogBox' ? 16 : 8, object.height + dy * object.height / Math.max(1, box?.height || 1)) : object.height;
      const next = updateRenderObject(renderStyle, kind, { width: Math.round(width), height: Math.round(height) });
      onRenderStyleChange('renderObjects', next);
    });
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-[500]" data-split-layout-editor>
      <button type="button" className={`pointer-events-auto absolute left-2 top-2 rounded-md border px-2 py-1 text-[10px] font-bold ${selection === 'background' ? 'border-indigo-300 bg-indigo-600 text-white' : 'border-white/25 bg-black/55 text-white/80'}`} style={{ cursor: 'pointer' }} onClick={(event) => { event.stopPropagation(); select('background'); }}>画面外背景</button>
      {(['scene', ...kinds] as Array<'scene' | RenderEditableObjectKind>).map((kind) => {
        const box = boxes[kind];
        if (!box || box.width <= 0 || box.height <= 0) return null;
        const selected = selection === kind;
        return (
          <div key={kind} className={`absolute ${selected ? 'ring-2 ring-indigo-500' : ''}`} style={{ left: box.x, top: box.y, width: box.width, height: box.height, zIndex: kind === 'dialogBox' ? 1 : kind === 'scene' ? 0 : 2, pointerEvents: 'none' }}>
            <button type="button" aria-label={`Select ${kind}`} className="absolute inset-0 h-full w-full bg-transparent" style={{ pointerEvents: 'auto', cursor: 'move', touchAction: 'none' }} onPointerDown={(event) => beginMove(event, kind)} onClick={(event) => { event.stopPropagation(); select(kind); }} />
            {selected && (
              <WebEditableElementFrame
                visible
                showAuxiliaryControls={false}
                onToggleVisible={() => undefined}
                onRotatePointerDown={(event) => event.stopPropagation()}
                onResizePointerDown={(event, handle) => beginResize(event, kind, handle)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

const clamp = (value: number, min: number, max: number) => Math.round(Math.min(max, Math.max(min, value)));
const bindWindowDrag = (move: (event: PointerEvent) => void) => {
  const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
};

import type React from 'react';
import { useEffect, useRef, useState } from 'react';

import type { PptManualElement, PptManualSlide } from '../video/shared/types';
import {
  WebEditableElementFrame,
  type WebEditableResizeHandle,
} from '../web/WebEditableElementFrame';
import { PPT_CONTENT_HEIGHT, PPT_CONTENT_WIDTH } from './pptWorkspaceModel';

const buttonClass = (variant: 'primary' | 'secondary' | 'link') =>
  variant === 'primary'
    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/30'
    : variant === 'secondary'
      ? 'border-2 border-indigo-500 bg-white text-indigo-700'
      : 'bg-transparent text-indigo-300 underline underline-offset-4';

export function PptManualElementLayer({
  elements,
  editable = false,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  onNavigateSlide,
}: {
  elements: PptManualElement[];
  editable?: boolean;
  selectedElementId?: string;
  onSelectElement?: (elementId: string) => void;
  onUpdateElement?: (elementId: string, patch: Partial<PptManualElement>) => void;
  onNavigateSlide?: (slideId: string) => void;
}) {
  const [editingElementId, setEditingElementId] = useState<string>();
  const [draftText, setDraftText] = useState('');
  const textEditorRef = useRef<HTMLDivElement>(null);
  const initialTextRef = useRef('');
  const discardTextEditRef = useRef(false);

  useEffect(() => {
    if (!editingElementId) return;
    const frame = window.requestAnimationFrame(() => {
      const editor = textEditorRef.current;
      if (!editor) return;
      editor.textContent = initialTextRef.current;
      editor.focus();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editingElementId]);

  const beginTextEdit = (event: React.MouseEvent<HTMLDivElement>, element: PptManualElement) => {
    if (!editable || !onUpdateElement || (element.kind !== 'text' && element.kind !== 'button'))
      return;
    event.preventDefault();
    event.stopPropagation();
    onSelectElement?.(element.id);
    initialTextRef.current = element.text;
    setDraftText(element.text);
    setEditingElementId(element.id);
  };
  const finishTextEdit = (
    element: Extract<PptManualElement, { kind: 'text' | 'button' }>,
    commit = true,
  ) => {
    if (editingElementId !== element.id) return;
    const nextText = textEditorRef.current?.innerText.replace(/\r\n/g, '\n') ?? draftText;
    const shouldCommit = commit && !discardTextEditRef.current;
    discardTextEditRef.current = false;
    setEditingElementId(undefined);
    if (shouldCommit && nextText !== element.text)
      onUpdateElement?.(element.id, { text: nextText });
  };
  const beginMove = (event: React.PointerEvent<HTMLDivElement>, element: PptManualElement) => {
    if (!editable || !onUpdateElement || event.button !== 0 || editingElementId === element.id)
      return;
    event.preventDefault();
    event.stopPropagation();
    onSelectElement?.(element.id);
    const startX = event.clientX;
    const startY = event.clientY;
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const initial = element;
    const move = (moveEvent: PointerEvent) => {
      onUpdateElement(element.id, {
        x: Math.round(
          Math.max(
            0,
            Math.min(
              PPT_CONTENT_WIDTH - initial.width,
              initial.x + ((moveEvent.clientX - startX) / rect.width) * PPT_CONTENT_WIDTH,
            ),
          ),
        ),
        y: Math.round(
          Math.max(
            0,
            Math.min(
              PPT_CONTENT_HEIGHT - initial.height,
              initial.y + ((moveEvent.clientY - startY) / rect.height) * PPT_CONTENT_HEIGHT,
            ),
          ),
        ),
      });
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end, { once: true });
  };
  const beginResize = (
    event: React.PointerEvent<HTMLElement>,
    element: PptManualElement,
    handle: WebEditableResizeHandle,
  ) => {
    if (!editable || !onUpdateElement) return;
    event.preventDefault();
    event.stopPropagation();
    const stage = event.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
    if (!stage) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const initial = element;
    const move = (moveEvent: PointerEvent) => {
      const dx = ((moveEvent.clientX - startX) / stage.width) * PPT_CONTENT_WIDTH;
      const dy = ((moveEvent.clientY - startY) / stage.height) * PPT_CONTENT_HEIGHT;
      let x = initial.x;
      let y = initial.y;
      let width = initial.width;
      let height = initial.height;
      if (handle.includes('e')) width += dx;
      if (handle.includes('w')) {
        x += dx;
        width -= dx;
      }
      if (handle.includes('s')) height += dy;
      if (handle.includes('n')) {
        y += dy;
        height -= dy;
      }
      width = Math.max(80, Math.min(PPT_CONTENT_WIDTH, width));
      height = Math.max(32, Math.min(PPT_CONTENT_HEIGHT, height));
      x = Math.max(0, Math.min(PPT_CONTENT_WIDTH - width, x));
      y = Math.max(0, Math.min(PPT_CONTENT_HEIGHT - height, y));
      onUpdateElement(element.id, {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
      });
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end, { once: true });
  };
  const beginRotate = (event: React.PointerEvent<HTMLElement>, element: PptManualElement) => {
    if (!editable || !onUpdateElement) return;
    event.preventDefault();
    event.stopPropagation();
    const box = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!box) return;
    const centerX = box.left + box.width / 2;
    const centerY = box.top + box.height / 2;
    const start = Math.atan2(event.clientY - centerY, event.clientX - centerX);
    const move = (moveEvent: PointerEvent) => {
      const rotation =
        (element.rotation || 0) +
        ((Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) - start) * 180) /
          Math.PI;
      onUpdateElement(element.id, {
        rotation: Math.round(((((rotation + 180) % 360) + 360) % 360) - 180),
      });
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end, { once: true });
  };
  const runButtonAction = (element: Extract<PptManualElement, { kind: 'button' }>) => {
    if (editable) return;
    if (element.action === 'slide' && element.targetSlideId)
      onNavigateSlide?.(element.targetSlideId);
    if (element.action === 'url' && element.url)
      window.open(element.url, '_blank', 'noopener,noreferrer');
  };
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {elements.map((element) => {
        const selected = editable && selectedElementId === element.id;
        const editingText =
          editingElementId === element.id && (element.kind === 'text' || element.kind === 'button');
        const style: React.CSSProperties = {
          left: `${(element.x / PPT_CONTENT_WIDTH) * 100}%`,
          top: `${(element.y / PPT_CONTENT_HEIGHT) * 100}%`,
          width: `${(element.width / PPT_CONTENT_WIDTH) * 100}%`,
          height: `${(element.height / PPT_CONTENT_HEIGHT) * 100}%`,
          transform: `rotate(${element.rotation || 0}deg)`,
          transformOrigin: 'center',
        };
        return (
          <div
            key={element.id}
            role={editable ? 'button' : undefined}
            tabIndex={editable ? 0 : undefined}
            className={`pointer-events-auto absolute ${editable ? 'cursor-grab touch-none active:cursor-grabbing' : ''}`}
            style={style}
            onPointerDown={(event) => beginMove(event, element)}
            onDoubleClick={(event) => beginTextEdit(event, element)}
            onClick={(event) => {
              event.stopPropagation();
              if (editable) onSelectElement?.(element.id);
            }}
          >
            {element.kind === 'image' ? (
              <img
                src={element.src}
                alt={element.alt || ''}
                draggable={false}
                className="h-full w-full object-contain"
              />
            ) : element.kind === 'text' ? (
              editingText ? (
                <div
                  ref={textEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="h-full w-full cursor-text whitespace-pre-wrap outline-none"
                  style={{
                    color: element.color,
                    fontFamily: element.fontFamily,
                    fontSize: `${(element.fontSize / PPT_CONTENT_HEIGHT) * 100}vh`,
                    fontWeight: element.bold ? 700 : 400,
                    textAlign: element.align,
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  onInput={(event) => setDraftText(event.currentTarget.innerText)}
                  onBlur={() => finishTextEdit(element)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      discardTextEditRef.current = true;
                      setEditingElementId(undefined);
                      event.currentTarget.blur();
                    }
                    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                      event.preventDefault();
                      event.currentTarget.blur();
                    }
                  }}
                />
              ) : (
                <div
                  className="h-full w-full whitespace-pre-wrap"
                  style={{
                    color: element.color,
                    fontFamily: element.fontFamily,
                    fontSize: `${(element.fontSize / PPT_CONTENT_HEIGHT) * 100}vh`,
                    fontWeight: element.bold ? 700 : 400,
                    textAlign: element.align,
                  }}
                >
                  {element.text}
                </div>
              )
            ) : editingText ? (
              <div
                ref={textEditorRef}
                contentEditable
                suppressContentEditableWarning
                className={`h-full w-full cursor-text rounded-2xl px-8 text-[clamp(12px,1.7vw,28px)] font-black outline-none transition ${buttonClass(element.variant)}`}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onInput={(event) => setDraftText(event.currentTarget.innerText)}
                onBlur={() => finishTextEdit(element)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    discardTextEditRef.current = true;
                    setEditingElementId(undefined);
                    event.currentTarget.blur();
                  }
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    event.currentTarget.blur();
                  }
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => runButtonAction(element)}
                className={`h-full w-full rounded-2xl px-8 text-[clamp(12px,1.7vw,28px)] font-black transition ${editable ? 'cursor-grab active:cursor-grabbing' : ''} ${buttonClass(element.variant)}`}
              >
                {element.text}
              </button>
            )}
            {selected ? (
              <WebEditableElementFrame
                visible
                showVisibilityControl={false}
                onToggleVisible={(event) => event.stopPropagation()}
                onRotatePointerDown={(event) => beginRotate(event, element)}
                onResizePointerDown={(event, handle) => beginResize(event, element, handle)}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function PptManualSlideCanvas({
  slide,
  editable = false,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  onNavigateSlide,
}: {
  slide: PptManualSlide;
  editable?: boolean;
  selectedElementId?: string;
  onSelectElement?: (elementId: string) => void;
  onUpdateElement?: (elementId: string, patch: Partial<PptManualElement>) => void;
  onNavigateSlide?: (slideId: string) => void;
}) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{ backgroundColor: slide.backgroundColor }}
    >
      <PptManualElementLayer
        elements={slide.elements}
        editable={editable}
        selectedElementId={selectedElementId}
        onSelectElement={onSelectElement}
        onUpdateElement={onUpdateElement}
        onNavigateSlide={onNavigateSlide}
      />
    </div>
  );
}

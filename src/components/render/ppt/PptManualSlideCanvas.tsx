import type React from 'react';

import type { PptManualElement, PptManualSlide } from '../video/shared/types';
import { PPT_CONTENT_HEIGHT, PPT_CONTENT_WIDTH } from './pptWorkspaceModel';

const buttonClass = (variant: 'primary' | 'secondary' | 'link') =>
  variant === 'primary'
    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/30'
    : variant === 'secondary'
      ? 'border-2 border-indigo-500 bg-white text-indigo-700'
      : 'bg-transparent text-indigo-300 underline underline-offset-4';

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
  const beginMove = (event: React.PointerEvent<HTMLDivElement>, element: PptManualElement) => {
    if (!editable || !onUpdateElement) return;
    event.stopPropagation();
    onSelectElement?.(element.id);
    const startX = event.clientX;
    const startY = event.clientY;
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const move = (moveEvent: PointerEvent) => {
      onUpdateElement(element.id, {
        x: Math.max(0, Math.min(PPT_CONTENT_WIDTH - element.width, element.x + ((moveEvent.clientX - startX) / rect.width) * PPT_CONTENT_WIDTH)),
        y: Math.max(0, Math.min(PPT_CONTENT_HEIGHT - element.height, element.y + ((moveEvent.clientY - startY) / rect.height) * PPT_CONTENT_HEIGHT)),
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
    if (element.action === 'slide' && element.targetSlideId) onNavigateSlide?.(element.targetSlideId);
    if (element.action === 'url' && element.url) window.open(element.url, '_blank', 'noopener,noreferrer');
  };
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ backgroundColor: slide.backgroundColor }}>
      {slide.elements.map((element) => {
        const selected = editable && selectedElementId === element.id;
        const style: React.CSSProperties = {
          left: `${(element.x / PPT_CONTENT_WIDTH) * 100}%`,
          top: `${(element.y / PPT_CONTENT_HEIGHT) * 100}%`,
          width: `${(element.width / PPT_CONTENT_WIDTH) * 100}%`,
          height: `${(element.height / PPT_CONTENT_HEIGHT) * 100}%`,
          transform: `rotate(${element.rotation || 0}deg)`,
        };
        return (
          <div
            key={element.id}
            role={editable ? 'button' : undefined}
            tabIndex={editable ? 0 : undefined}
            className={`absolute ${editable ? 'cursor-move touch-none' : ''} ${selected ? 'outline outline-4 outline-indigo-400 outline-offset-4' : ''}`}
            style={style}
            onPointerDown={(event) => beginMove(event, element)}
            onClick={(event) => {
              event.stopPropagation();
              if (editable) onSelectElement?.(element.id);
            }}
          >
            {element.kind === 'image' ? (
              <img src={element.src} alt={element.alt || ''} draggable={false} className="h-full w-full object-contain" />
            ) : element.kind === 'text' ? (
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
            ) : (
              <button
                type="button"
                onClick={() => runButtonAction(element)}
                className={`h-full w-full rounded-2xl px-8 text-[clamp(12px,1.7vw,28px)] font-black transition ${buttonClass(element.variant)}`}
              >
                {element.text}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

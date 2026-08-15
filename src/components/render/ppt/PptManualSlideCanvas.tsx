import type React from 'react';
import { useEffect, useRef, useState } from 'react';

import type {
  PptManualElement,
  PptManualElementWebStyle,
  PptManualSlide,
  PptSlideBackgroundStyle,
} from '../video/shared/types';
import {
  WebEditableElementFrame,
  type WebEditableResizeHandle,
} from '../web/WebEditableElementFrame';
import { PPT_CONTENT_HEIGHT, PPT_CONTENT_WIDTH } from './pptWorkspaceModel';
import { gradientFromStops, normalizeGradientStops } from '../web/webGradientStops';

const buttonClass = (variant: 'primary' | 'secondary' | 'link') =>
  variant === 'primary'
    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-950/30'
    : variant === 'secondary'
      ? 'border-2 border-indigo-500 bg-white text-indigo-700'
      : 'bg-transparent text-indigo-300 underline underline-offset-4';

const withAlpha = (color: string | undefined, alpha = 100, fallback = '#000000') => {
  const source = color || fallback;
  if (!/^#[0-9a-f]{6}$/i.test(source)) return source;
  const normalized = Math.max(0, Math.min(100, alpha)) / 100;
  const red = Number.parseInt(source.slice(1, 3), 16);
  const green = Number.parseInt(source.slice(3, 5), 16);
  const blue = Number.parseInt(source.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${normalized})`;
};

const gradientPaint = (style: PptManualElementWebStyle) => {
  const stops = style.backgroundGradientStops?.length
    ? [...style.backgroundGradientStops]
        .sort((left, right) => left.position - right.position)
        .map((stop) => `${withAlpha(stop.color, stop.alpha)} ${stop.position}%`)
        .join(', ')
    : `${style.backgroundGradientStart || '#0ea5e9'}, ${style.backgroundGradientEnd || '#0f172a'}`;
  if (style.backgroundGradientShape === 'radial') return `radial-gradient(circle, ${stops})`;
  if (style.backgroundGradientShape === 'diamond') return `conic-gradient(${stops})`;
  return `linear-gradient(${style.backgroundGradientAngle ?? 135}deg, ${stops})`;
};

const paintBackground = (style: PptManualElementWebStyle) => {
  if (style.fillEnabled === false) return 'transparent';
  if (style.backgroundType === 'gradient') return gradientPaint(style);
  if (style.backgroundType === 'image' && style.backgroundImageUrl)
    return `url("${style.backgroundImageUrl.replace(/"/g, '\\"')}") center / cover`;
  return style.backgroundColor;
};

const shadowPaint = (style: PptManualElementWebStyle) => {
  if (style.shadowEnabled === false) return undefined;
  const shadows = style.shadows?.length
    ? style.shadows.filter((shadow) => shadow.enabled !== false)
    : style.shadowOpacity
      ? [
          {
            color: style.shadowColor || '#000000',
            opacity: style.shadowOpacity,
            blur: style.shadowBlur || 0,
            offsetX: style.shadowOffsetX || 0,
            offsetY: style.shadowOffsetY || 0,
          },
        ]
      : [];
  return shadows
    .map(
      (shadow) =>
        `${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px ${withAlpha(shadow.color, shadow.opacity)}`,
    )
    .join(', ');
};

const borderPaint = (style: PptManualElementWebStyle) => {
  if (style.strokeEnabled === false || !style.borderWidth) return undefined;
  return `${style.borderWidth}px solid ${style.borderColor || '#ffffff'}`;
};

const textAlignStyle = (align: 'left' | 'center' | 'right' | undefined) => {
  if (align === 'center') return { justifyContent: 'center', textAlign: 'center' as const };
  if (align === 'right') return { justifyContent: 'flex-end', textAlign: 'right' as const };
  return { justifyContent: 'flex-start', textAlign: 'left' as const };
};

const slideBackgroundPaint = (background?: PptSlideBackgroundStyle): React.CSSProperties => {
  if (!background) return {};
  if (background.type === 'gradient') {
    return {
      background: gradientFromStops(
        background.gradientShape,
        background.gradientAngle,
        normalizeGradientStops(
          background.gradientStops,
          background.gradientStart,
          background.gradientEnd,
          background.color,
          background.color,
        ),
        {
          startX: background.gradientStartX,
          startY: background.gradientStartY,
          endX: background.gradientEndX,
          endY: background.gradientEndY,
        },
      ),
    };
  }
  if (background.type === 'image' && background.imageUrl) {
    return {
      backgroundImage: `url("${background.imageUrl.replace(/"/g, '\\"')}")`,
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'cover',
    };
  }
  return { backgroundColor: background.color };
};

const manualElementPaint = (element: PptManualElement): React.CSSProperties => {
  const style = element.webStyle || {};
  return {
    zIndex: style.zIndex,
    opacity: (style.opacity ?? 100) / 100,
    borderRadius: style.borderRadius,
    border: borderPaint(style),
    boxShadow: shadowPaint(style),
    background: element.kind === 'button' ? paintBackground(style) : undefined,
    backgroundSize: style.backgroundType === 'image' ? 'cover' : undefined,
    backgroundPosition: style.backgroundType === 'image' ? 'center' : undefined,
    mixBlendMode: style.blendMode as React.CSSProperties['mixBlendMode'],
  };
};

const manualTextPaint = (
  element: Extract<PptManualElement, { kind: 'text' | 'button' }>,
): React.CSSProperties => {
  const style = element.webStyle || {};
  const color = style.textColor || (element.kind === 'text' ? element.color : '#ffffff');
  const usesGradient = style.textColorType === 'gradient';
  const stops = style.textGradientStops?.length
    ? [...style.textGradientStops]
        .sort((left, right) => left.position - right.position)
        .map((stop) => `${withAlpha(stop.color, stop.alpha)} ${stop.position}%`)
        .join(', ')
    : `${style.textGradientStart || color}, ${style.textGradientEnd || '#0ea5e9'}`;
  return {
    color: usesGradient ? 'transparent' : withAlpha(color, style.textColorAlpha ?? 100, '#ffffff'),
    fontFamily: style.fontFamily || (element.kind === 'text' ? element.fontFamily : undefined),
    fontSize: `${((style.fontSize || (element.kind === 'text' ? element.fontSize : 28)) / PPT_CONTENT_HEIGHT) * 100}vh`,
    fontWeight: style.fontWeight || (element.kind === 'text' && element.bold ? 700 : 400),
    display: 'flex',
    alignItems: 'center',
    ...textAlignStyle(style.textAlign || (element.kind === 'text' ? element.align : 'center')),
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight,
    opacity: style.textVisible === false ? 0 : undefined,
    WebkitBackgroundClip: usesGradient ? 'text' : undefined,
    backgroundImage: usesGradient
      ? `linear-gradient(${style.textGradientAngle ?? 90}deg, ${stops})`
      : undefined,
    WebkitTextStroke:
      style.strokeEnabled && style.textStrokeWidth
        ? `${style.textStrokeWidth}px ${style.textStrokeColor || '#000000'}`
        : undefined,
  };
};

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
        if (element.visible === false && !editable) return null;
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
          ...manualElementPaint(element),
          opacity:
            element.visible === false && editable
              ? Math.min(0.3, (element.webStyle?.opacity ?? 100) / 100)
              : (element.webStyle?.opacity ?? 100) / 100,
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
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
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
                style={{
                  borderRadius: element.webStyle?.borderRadius,
                  border: borderPaint(element.webStyle || {}),
                  boxShadow: shadowPaint(element.webStyle || {}),
                }}
              />
            ) : element.kind === 'text' ? (
              editingText ? (
                <div
                  ref={textEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  className="h-full w-full cursor-text whitespace-pre-wrap outline-none"
                  style={{
                    ...manualTextPaint(element),
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
                    ...manualTextPaint(element),
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
                className={`h-full w-full cursor-text px-8 outline-none transition ${buttonClass(element.variant)}`}
                style={{ ...manualElementPaint(element), ...manualTextPaint(element) }}
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
                className={`h-full w-full px-8 transition ${editable ? 'cursor-grab active:cursor-grabbing' : ''} ${buttonClass(element.variant)}`}
                style={{ ...manualElementPaint(element), ...manualTextPaint(element) }}
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
  onSelectBackground,
}: {
  slide: PptManualSlide;
  editable?: boolean;
  selectedElementId?: string;
  onSelectElement?: (elementId: string) => void;
  onUpdateElement?: (elementId: string, patch: Partial<PptManualElement>) => void;
  onNavigateSlide?: (slideId: string) => void;
  onSelectBackground?: () => void;
}) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        backgroundColor: slide.backgroundColor,
        ...slideBackgroundPaint(slide.backgroundStyle),
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onSelectBackground?.();
      }}
    >
      {slide.backgroundStyle?.type === 'video' && slide.backgroundStyle.videoUrl ? (
        <video
          className="pointer-events-none absolute inset-0 h-full w-full"
          src={slide.backgroundStyle.videoUrl}
          autoPlay
          loop={slide.backgroundStyle.videoLoop !== false}
          muted={slide.backgroundStyle.videoMuted !== false}
          playsInline
          style={{ objectFit: slide.backgroundStyle.videoFit === 'fit' ? 'contain' : 'cover' }}
        />
      ) : null}
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

import { useRef } from 'react';
import type { CSSProperties } from 'react';
import type React from 'react';

import type { Language } from '../../../lib/i18n';
import { renderCopy } from '../video/shared/renderCopy';
import type { WebExportSettings, WebMenuElement } from '../video/shared/types';

type PlacementResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const placementResizeHandles: PlacementResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const resizeHandlePositionClass: Record<PlacementResizeHandle, string> = {
  n: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2',
  s: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
  e: 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2',
  w: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2',
  ne: 'right-0 top-0 translate-x-1/2 -translate-y-1/2',
  nw: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2',
  se: 'bottom-0 right-0 translate-x-1/2 translate-y-1/2',
  sw: 'bottom-0 left-0 -translate-x-1/2 translate-y-1/2',
};
const resizeHandleShapeClass: Record<PlacementResizeHandle, string> = {
  n: 'h-2.5 w-12 rounded-full',
  s: 'h-2.5 w-12 rounded-full',
  e: 'h-12 w-2.5 rounded-full',
  w: 'h-12 w-2.5 rounded-full',
  ne: 'h-4 w-4 rounded-full',
  nw: 'h-4 w-4 rounded-full',
  se: 'h-4 w-4 rounded-full',
  sw: 'h-4 w-4 rounded-full',
};
const resizeCursorByHandle: Record<PlacementResizeHandle, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};

const getResizeHandleStyle = (handle: PlacementResizeHandle): CSSProperties => {
  if (handle === 'n' || handle === 's') {
    return { width: 'min(72%, 120px)', minWidth: 24, cursor: resizeCursorByHandle[handle] };
  }
  if (handle === 'e' || handle === 'w') {
    return { height: 'min(72%, 120px)', minHeight: 24, cursor: resizeCursorByHandle[handle] };
  }
  return { cursor: resizeCursorByHandle[handle] };
};

type WebPreviewMenuPagesProps = {
  language: Language;
  settings: WebExportSettings;
  previewMode: 'edit' | 'test';
  selectedStartMenuElementId?: string | null;
  archiveOpen: boolean;
  settingsOpen: boolean;
  backgroundClass: string;
  backgroundStyle?: CSSProperties;
  boundsMinX: number;
  boundsMinY: number;
  boundsMaxX: number;
  boundsMaxY: number;
  archiveElements: WebMenuElement[];
  settingsElements: WebMenuElement[];
  choiceColor: string;
  choiceTextColor: string;
  previewControlsHidden: boolean;
  onCloseArchive: () => void;
  onCloseSettings: () => void;
  onNewGame: () => void;
  onToggleControls: () => void;
  onSelectElement?: (id: string | null) => void;
  onUpdateArchiveElement: (id: string, patch: Partial<WebMenuElement>) => void;
  onUpdateSettingsElement: (id: string, patch: Partial<WebMenuElement>) => void;
  onUpdateSettings: <K extends keyof WebExportSettings>(key: K, value: WebExportSettings[K]) => void;
};

export function WebPreviewMenuPages({
  language,
  settings,
  previewMode,
  selectedStartMenuElementId,
  archiveOpen,
  settingsOpen,
  backgroundClass,
  backgroundStyle,
  boundsMinX,
  boundsMinY,
  boundsMaxX,
  boundsMaxY,
  archiveElements,
  settingsElements,
  choiceColor,
  choiceTextColor,
  previewControlsHidden,
  onCloseArchive,
  onCloseSettings,
  onNewGame,
  onToggleControls,
  onSelectElement,
  onUpdateArchiveElement,
  onUpdateSettingsElement,
  onUpdateSettings,
}: WebPreviewMenuPagesProps) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  const archiveRootRef = useRef<HTMLDivElement>(null);
  const settingsRootRef = useRef<HTMLDivElement>(null);
  const elementDragRef = useRef<{
    page: 'archive' | 'settings';
    id: string;
    type: 'move' | 'resize';
    resizeHandle?: PlacementResizeHandle;
    startClientX: number;
    startClientY: number;
    initial: WebMenuElement;
    rect: DOMRect;
  } | null>(null);
  const constrainElement = (element: WebMenuElement) => {
    const width = Math.max(6, Math.min(element.width, boundsMaxX - boundsMinX));
    const height = Math.max(4, Math.min(element.height, boundsMaxY - boundsMinY));
    return {
      ...element,
      width: Number(width.toFixed(2)),
      height: Number(height.toFixed(2)),
      x: Number(Math.max(boundsMinX, Math.min(boundsMaxX - width, element.x)).toFixed(2)),
      y: Number(Math.max(boundsMinY, Math.min(boundsMaxY - height, element.y)).toFixed(2)),
    };
  };
  const updatePageElement = (page: 'archive' | 'settings', id: string, patch: Partial<WebMenuElement>) => {
    if (page === 'archive') onUpdateArchiveElement(id, patch);
    else onUpdateSettingsElement(id, patch);
  };
  const beginElementDrag = (
    page: 'archive' | 'settings',
    event: React.PointerEvent<HTMLElement>,
    element: WebMenuElement,
    type: 'move' | 'resize',
    resizeHandle?: PlacementResizeHandle,
  ) => {
    if (previewMode !== 'edit') return;
    const rect = (page === 'archive' ? archiveRootRef.current : settingsRootRef.current)?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectElement?.(element.id);
    elementDragRef.current = {
      page,
      id: element.id,
      type,
      resizeHandle,
      startClientX: event.clientX,
      startClientY: event.clientY,
      initial: element,
      rect,
    };
    document.body.style.cursor =
      type === 'resize' && resizeHandle ? resizeCursorByHandle[resizeHandle] : 'grabbing';
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const handleElementPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = elementDragRef.current;
    if (!drag) return;
    const dx = ((event.clientX - drag.startClientX) / drag.rect.width) * 100;
    const dy = ((event.clientY - drag.startClientY) / drag.rect.height) * 100;
    let next = { ...drag.initial };

    if (drag.type === 'move') {
      next.x = drag.initial.x + dx;
      next.y = drag.initial.y + dy;
    } else {
      const handle = drag.resizeHandle || 'se';
      if (handle.includes('e')) next.width = drag.initial.width + dx;
      if (handle.includes('s')) next.height = drag.initial.height + dy;
      if (handle.includes('w')) {
        next.x = drag.initial.x + dx;
        next.width = drag.initial.width - dx;
      }
      if (handle.includes('n')) {
        next.y = drag.initial.y + dy;
        next.height = drag.initial.height - dy;
      }
      if (next.width < 6) {
        if (handle.includes('w')) next.x = drag.initial.x + drag.initial.width - 6;
        next.width = 6;
      }
      if (next.height < 4) {
        if (handle.includes('n')) next.y = drag.initial.y + drag.initial.height - 4;
        next.height = 4;
      }
    }

    next = constrainElement(next);
    updatePageElement(drag.page, drag.id, next);
  };
  const endElementDrag = () => {
    if (!elementDragRef.current) return;
    elementDragRef.current = null;
    document.body.style.cursor = '';
  };
  return (
    <>
      {archiveOpen && (
        <div
          ref={archiveRootRef}
          className={`absolute inset-0 z-50 text-white ${backgroundClass}`}
          style={backgroundStyle}
          onPointerMove={handleElementPointerMove}
          onPointerUp={endElementDrag}
          onPointerCancel={endElementDrag}
        >
          <div className="absolute inset-0 z-0 bg-black/28" />
          <MenuPageElementLayer
            page="archive"
            elements={archiveElements}
            selectedElementId={selectedStartMenuElementId}
            previewMode={previewMode}
            choiceColor={choiceColor}
            choiceTextColor={choiceTextColor}
            onSelectElement={onSelectElement}
            onUpdateElement={onUpdateArchiveElement}
            onBeginElementDrag={beginElementDrag}
            onAction={(role) => {
              if (role === 'back') onCloseArchive();
              if (role === 'new') onNewGame();
            }}
          />
        </div>
      )}
      {settingsOpen && (
        <div
          ref={settingsRootRef}
          className={`absolute inset-0 z-50 text-white ${backgroundClass}`}
          style={backgroundStyle}
          onPointerMove={handleElementPointerMove}
          onPointerUp={endElementDrag}
          onPointerCancel={endElementDrag}
        >
          <div className="absolute inset-0 z-0 bg-black/28" />
          <MenuPageElementLayer
            page="settings"
            elements={settingsElements}
            selectedElementId={selectedStartMenuElementId}
            previewMode={previewMode}
            choiceColor={choiceColor}
            choiceTextColor={choiceTextColor}
            onSelectElement={onSelectElement}
            onUpdateElement={onUpdateSettingsElement}
            onBeginElementDrag={beginElementDrag}
            onAction={(role) => {
              if (role === 'back') onCloseSettings();
              if (role === 'auto') onUpdateSettings('autoAdvance', !settings.autoAdvance);
              if (role === 'controls') onToggleControls();
            }}
            renderSuffix={(element) => {
              if (element.role === 'auto') return settings.autoAdvance ? t('开启', 'オン', 'On') : t('关闭', 'オフ', 'Off');
              if (element.role === 'speed') return `${settings.typewriterSpeed}ms`;
              if (element.role === 'controls') return previewControlsHidden ? t('关闭', 'オフ', 'Off') : t('开启', 'オン', 'On');
              return '';
            }}
          />
        </div>
      )}
    </>
  );
}

type MenuPageElementLayerProps = {
  page: 'archive' | 'settings';
  elements: WebMenuElement[];
  selectedElementId?: string | null;
  previewMode: 'edit' | 'test';
  choiceColor: string;
  choiceTextColor: string;
  onSelectElement?: (id: string | null) => void;
  onUpdateElement: (id: string, patch: Partial<WebMenuElement>) => void;
  onBeginElementDrag: (
    page: 'archive' | 'settings',
    event: React.PointerEvent<HTMLElement>,
    element: WebMenuElement,
    type: 'move' | 'resize',
    resizeHandle?: PlacementResizeHandle,
  ) => void;
  onAction: (role: WebMenuElement['role']) => void;
  renderSuffix?: (element: WebMenuElement) => string;
};

function MenuPageElementLayer({
  page,
  elements,
  selectedElementId,
  previewMode,
  choiceColor,
  choiceTextColor,
  onSelectElement,
  onUpdateElement,
  onBeginElementDrag,
  onAction,
  renderSuffix,
}: MenuPageElementLayerProps) {
  const editable = previewMode === 'edit';

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20"
      onClick={() => {
        if (editable) onSelectElement?.(null);
      }}
    >
      {elements
        .filter((element) => element.visible !== false)
        .map((element) => {
          const selected = selectedElementId === element.id;
          const suffix = renderSuffix?.(element) || '';
          const commonStyle: CSSProperties = {
            left: `${element.x}%`,
            top: `${element.y}%`,
            width: `${element.width}%`,
            height: `${element.height}%`,
            transform: `rotate(${element.rotation || 0}deg) scale(${element.scale || 1})`,
            transformOrigin: 'center',
          };
          const contentStyle: CSSProperties = {
            fontSize: element.fontSize,
            color: element.textColor || (element.primary ? choiceTextColor : '#f8fafc'),
            borderRadius: element.borderRadius ?? (element.kind === 'text' ? 0 : 12),
          };

          if (element.kind === 'button') {
            const background =
              element.backgroundType === 'gradient'
                ? `linear-gradient(${element.backgroundGradientAngle ?? 135}deg, ${element.backgroundGradientStart || choiceColor}, ${element.backgroundGradientEnd || '#0f172a'})`
                : element.backgroundType === 'image' && element.backgroundImageUrl
                  ? `linear-gradient(180deg,rgba(0,0,0,0.16),rgba(0,0,0,0.38)),url("${element.backgroundImageUrl.replace(/"/g, '\\"')}")`
                  : element.backgroundColor || (element.primary ? choiceColor : 'rgba(255,255,255,0.10)');

            return (
              <button
                key={element.id}
                type="button"
                className={`pointer-events-auto absolute flex items-center justify-between gap-2 overflow-hidden border px-4 text-left font-black shadow-[0_12px_32px_rgba(0,0,0,0.18)] transition-transform ${
                  editable ? 'cursor-move' : 'active:scale-[0.99]'
                }`}
                style={{
                  ...commonStyle,
                  ...contentStyle,
                  background,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  borderColor: element.borderColor || 'rgba(255,255,255,0.16)',
                }}
                disabled={!editable && element.disabled}
                onPointerDown={(event) => {
                  if (editable) onBeginElementDrag(page, event, element, 'move');
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  if (editable) {
                    onSelectElement?.(element.id);
                    return;
                  }
                  onAction(element.role);
                }}
                onDoubleClick={(event) => {
                  if (!editable) return;
                  event.stopPropagation();
                  const next = window.prompt('', element.text);
                  if (next !== null) onUpdateElement(element.id, { text: next });
                }}
              >
                <span className="whitespace-pre-line">{element.text}</span>
                {suffix && <span className="text-xs opacity-70">{suffix}</span>}
                {selected && <SelectedElementFrame page={page} element={element} onBeginElementDrag={onBeginElementDrag} />}
              </button>
            );
          }

          if (element.kind === 'image') {
            return (
              <button
                key={element.id}
                type="button"
                className="pointer-events-auto absolute overflow-hidden border-0 bg-transparent p-0"
                style={commonStyle}
                onPointerDown={(event) => {
                  if (editable) onBeginElementDrag(page, event, element, 'move');
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  if (editable) onSelectElement?.(element.id);
                }}
              >
                {element.imageUrl ? (
                  <img
                    src={element.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    style={{ borderRadius: element.borderRadius ?? 12 }}
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center rounded-xl border border-white/16 bg-white/10 text-xs font-black text-white/60">
                    Image
                  </span>
                )}
                {selected && <SelectedElementFrame page={page} element={element} onBeginElementDrag={onBeginElementDrag} />}
              </button>
            );
          }

          return (
            <button
              key={element.id}
              type="button"
              className="pointer-events-auto absolute flex items-center border-0 bg-transparent p-0 text-left font-black"
              style={{ ...commonStyle, ...contentStyle }}
              onPointerDown={(event) => {
                if (editable) onBeginElementDrag(page, event, element, 'move');
              }}
              onClick={(event) => {
                event.stopPropagation();
                if (editable) onSelectElement?.(element.id);
              }}
              onDoubleClick={(event) => {
                if (!editable) return;
                event.stopPropagation();
                const next = window.prompt('', element.text);
                if (next !== null) onUpdateElement(element.id, { text: next });
              }}
            >
              <span className="whitespace-pre-line">{element.text}</span>
              {selected && <SelectedElementFrame page={page} element={element} onBeginElementDrag={onBeginElementDrag} />}
            </button>
          );
        })}
    </div>
  );
}

function SelectedElementFrame({
  page,
  element,
  onBeginElementDrag,
}: {
  page: 'archive' | 'settings';
  element: WebMenuElement;
  onBeginElementDrag: (
    page: 'archive' | 'settings',
    event: React.PointerEvent<HTMLElement>,
    element: WebMenuElement,
    type: 'move' | 'resize',
    resizeHandle?: PlacementResizeHandle,
  ) => void;
}) {
  return (
    <>
      <span className="pointer-events-none absolute inset-0 ring-2 ring-sky-300" />
      {placementResizeHandles.map((handle) => (
        <span
          key={handle}
          role="button"
          tabIndex={-1}
          className={`absolute border border-sky-200 bg-white shadow pointer-events-auto ${resizeHandlePositionClass[handle]} ${resizeHandleShapeClass[handle]}`}
          style={{
            ...getResizeHandleStyle(handle),
            zIndex: 30,
          }}
          onPointerDown={(event) => onBeginElementDrag(page, event, element, 'resize', handle)}
          onClick={(event) => event.stopPropagation()}
          aria-label="Resize"
        />
      ))}
    </>
  );
}

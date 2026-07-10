import type { CSSProperties } from 'react';
import type React from 'react';
import { useRef, useState } from 'react';

import type { Language } from '../../../lib/i18n';
import { renderCopy } from '../video/shared/renderCopy';
import type { WebExportSettings, WebMenuElement } from '../video/shared/types';
import { WebEditableElementFrame } from './WebEditableElementFrame';
import type { WebAlignmentGuideLine } from './webElementAlignmentGuides';
import {
  snapElementBoxToElementGuides,
  snapResizeBoxToElementGuides,
} from './webElementAlignmentGuides';
import { linearGradientFromStops, normalizeGradientStops } from './webGradientStops';

type PlacementResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

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

type WebPreviewMenuPagesProps = {
  language: Language;
  settings: WebExportSettings;
  previewMode: 'edit' | 'test';
  selectedStartMenuElementId?: string | null;
  archiveOpen: boolean;
  settingsOpen: boolean;
  backgroundClass: string;
  archiveBackgroundStyle?: CSSProperties;
  settingsBackgroundStyle?: CSSProperties;
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
  onUpdateArchiveElements: (elements: WebMenuElement[]) => void;
  onUpdateSettingsElements: (elements: WebMenuElement[]) => void;
  onUpdateSettings: <K extends keyof WebExportSettings>(
    key: K,
    value: WebExportSettings[K],
  ) => void;
};

export function WebPreviewMenuPages({
  language,
  settings,
  previewMode,
  selectedStartMenuElementId,
  archiveOpen,
  settingsOpen,
  backgroundClass,
  archiveBackgroundStyle,
  settingsBackgroundStyle,
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
  onUpdateArchiveElements,
  onUpdateSettingsElements,
  onUpdateSettings,
}: WebPreviewMenuPagesProps) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  const archiveRootRef = useRef<HTMLDivElement>(null);
  const settingsRootRef = useRef<HTMLDivElement>(null);
  const [activeGuideLines, setActiveGuideLines] = useState<WebAlignmentGuideLine[]>([]);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const marqueeRef = useRef<{
    page: 'archive' | 'settings';
    startClientX: number;
    startClientY: number;
    rect: DOMRect;
  } | null>(null);
  const marqueeBoxRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [marqueeBox, setMarqueeBox] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const elementDragRef = useRef<{
    page: 'archive' | 'settings';
    id: string;
    type: 'move' | 'resize' | 'rotate';
    resizeHandle?: PlacementResizeHandle;
    startClientX: number;
    startClientY: number;
    centerX?: number;
    centerY?: number;
    startAngle?: number;
    initial: WebMenuElement;
    groupInitial?: WebMenuElement[];
    groupIds?: string[];
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
  const updatePageElement = (
    page: 'archive' | 'settings',
    id: string,
    patch: Partial<WebMenuElement>,
  ) => {
    if (page === 'archive') onUpdateArchiveElement(id, patch);
    else onUpdateSettingsElement(id, patch);
  };
  const updatePageElements = (page: 'archive' | 'settings', elements: WebMenuElement[]) => {
    if (page === 'archive') onUpdateArchiveElements(elements);
    else onUpdateSettingsElements(elements);
  };
  const getPageElements = (page: 'archive' | 'settings') =>
    page === 'archive' ? archiveElements : settingsElements;
  const beginElementDrag = (
    page: 'archive' | 'settings',
    event: React.PointerEvent<HTMLElement>,
    element: WebMenuElement,
    type: 'move' | 'resize' | 'rotate',
    resizeHandle?: PlacementResizeHandle,
  ) => {
    if (previewMode !== 'edit') return;
    if (event.button === 2) return;
    const rect = (
      page === 'archive' ? archiveRootRef.current : settingsRootRef.current
    )?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.stopPropagation();
    onSelectElement?.(element.id);
    const shouldMoveGroup =
      type === 'move' && selectedElementIds.length > 1 && selectedElementIds.includes(element.id);
    const groupIds = shouldMoveGroup ? selectedElementIds : [element.id];
    const pageElements = getPageElements(page);
    const groupInitial = pageElements.filter((item) => groupIds.includes(item.id));
    if (!shouldMoveGroup) setSelectedElementIds([element.id]);
    const centerX = rect.left + ((element.x + element.width / 2) / 100) * rect.width;
    const centerY = rect.top + ((element.y + element.height / 2) / 100) * rect.height;
    const startAngle =
      Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI);
    elementDragRef.current = {
      page,
      id: element.id,
      type,
      resizeHandle,
      startClientX: event.clientX,
      startClientY: event.clientY,
      centerX,
      centerY,
      startAngle,
      initial: element,
      groupInitial,
      groupIds,
      rect,
    };
    document.body.style.cursor =
      type === 'rotate'
        ? 'alias'
        : type === 'resize' && resizeHandle
          ? resizeCursorByHandle[resizeHandle]
          : 'grabbing';
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const beginMarquee = (
    page: 'archive' | 'settings',
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    if (previewMode !== 'edit' || event.button !== 2) return;
    const root = page === 'archive' ? archiveRootRef.current : settingsRootRef.current;
    const rect = root?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.stopPropagation();
    marqueeRef.current = { page, startClientX: event.clientX, startClientY: event.clientY, rect };
    const nextBox = {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
      width: 0,
      height: 0,
    };
    marqueeBoxRef.current = nextBox;
    setMarqueeBox(nextBox);
  };
  const updateMarquee = (event: React.PointerEvent<HTMLDivElement>) => {
    const marquee = marqueeRef.current;
    if (!marquee) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = ((marquee.startClientX - marquee.rect.left) / marquee.rect.width) * 100;
    const startY = ((marquee.startClientY - marquee.rect.top) / marquee.rect.height) * 100;
    const currentX = ((event.clientX - marquee.rect.left) / marquee.rect.width) * 100;
    const currentY = ((event.clientY - marquee.rect.top) / marquee.rect.height) * 100;
    const left = Math.max(0, Math.min(startX, currentX));
    const top = Math.max(0, Math.min(startY, currentY));
    const right = Math.min(100, Math.max(startX, currentX));
    const bottom = Math.min(100, Math.max(startY, currentY));
    const nextBox = {
      x: left,
      y: top,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    };
    marqueeBoxRef.current = nextBox;
    setMarqueeBox(nextBox);
  };
  const finishMarquee = (event?: React.PointerEvent<HTMLDivElement>) => {
    const marquee = marqueeRef.current;
    const box = marqueeBoxRef.current;
    if (!marquee || !box) return;
    event?.preventDefault();
    event?.stopPropagation();
    const nextIds = getPageElements(marquee.page)
      .filter((element) => previewMode === 'edit' || element.visible !== false)
      .filter(
        (element) =>
          element.x < box.x + box.width &&
          element.x + element.width > box.x &&
          element.y < box.y + box.height &&
          element.y + element.height > box.y,
      )
      .map((element) => element.id);
    marqueeRef.current = null;
    marqueeBoxRef.current = null;
    setMarqueeBox(null);
    setSelectedElementIds(nextIds);
    onSelectElement?.(nextIds[nextIds.length - 1] || null);
  };
  const handleElementPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (marqueeRef.current) {
      updateMarquee(event);
      return;
    }
    const drag = elementDragRef.current;
    if (!drag) return;
    const dx = ((event.clientX - drag.startClientX) / drag.rect.width) * 100;
    const dy = ((event.clientY - drag.startClientY) / drag.rect.height) * 100;
    let next = { ...drag.initial };

    if (drag.type === 'rotate') {
      const centerX = drag.centerX ?? drag.rect.left;
      const centerY = drag.centerY ?? drag.rect.top;
      const startAngle = drag.startAngle ?? 0;
      const currentAngle =
        Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI);
      next.rotation = Number(((drag.initial.rotation || 0) + currentAngle - startAngle).toFixed(1));
      setActiveGuideLines([]);
    } else if (drag.type === 'move') {
      next.x = drag.initial.x + dx;
      next.y = drag.initial.y + dy;
      const snapped = snapElementBoxToElementGuides({
        x: next.x,
        y: next.y,
        width: next.width,
        height: next.height,
        rect: drag.rect,
        elements: getPageElements(drag.page),
        movingId: drag.id,
      });
      next.x = snapped.x;
      next.y = snapped.y;
      setActiveGuideLines(snapped.lines);
      const groupInitial =
        drag.groupInitial && drag.groupInitial.length > 0 ? drag.groupInitial : [drag.initial];
      if (groupInitial.length > 1) {
        const rawGroupDx = next.x - drag.initial.x;
        const rawGroupDy = next.y - drag.initial.y;
        const groupLeft = Math.min(...groupInitial.map((item) => item.x));
        const groupTop = Math.min(...groupInitial.map((item) => item.y));
        const groupRight = Math.max(...groupInitial.map((item) => item.x + item.width));
        const groupBottom = Math.max(...groupInitial.map((item) => item.y + item.height));
        const groupDx = Math.max(boundsMinX - groupLeft, Math.min(boundsMaxX - groupRight, rawGroupDx));
        const groupDy = Math.max(boundsMinY - groupTop, Math.min(boundsMaxY - groupBottom, rawGroupDy));
        const movingIds = new Set(drag.groupIds || [drag.id]);
        const initialById = new Map(groupInitial.map((item) => [item.id, item]));
        updatePageElements(
          drag.page,
          getPageElements(drag.page).map((item) =>
            movingIds.has(item.id) && initialById.has(item.id)
              ? constrainElement({
                  ...item,
                  x: initialById.get(item.id)!.x + groupDx,
                  y: initialById.get(item.id)!.y + groupDy,
                })
              : item,
          ),
        );
        return;
      }
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
      const snapped = snapResizeBoxToElementGuides({
        x: next.x,
        y: next.y,
        width: next.width,
        height: next.height,
        handle,
        rect: drag.rect,
        elements: getPageElements(drag.page),
        movingId: drag.id,
      });
      next.x = snapped.x;
      next.y = snapped.y;
      next.width = snapped.width;
      next.height = snapped.height;
      setActiveGuideLines(snapped.lines);
    }

    next = constrainElement(next);
    updatePageElement(drag.page, drag.id, next);
  };
  const endElementDrag = () => {
    if (marqueeRef.current) {
      finishMarquee();
      return;
    }
    if (!elementDragRef.current) return;
    elementDragRef.current = null;
    setActiveGuideLines([]);
    document.body.style.cursor = '';
  };
  return (
    <>
      {archiveOpen && (
        <div
          ref={archiveRootRef}
          className={`absolute inset-0 z-50 text-white ${backgroundClass}`}
          style={archiveBackgroundStyle}
          onPointerMove={handleElementPointerMove}
          onPointerUp={endElementDrag}
          onPointerCancel={endElementDrag}
          onPointerDown={(event) => beginMarquee('archive', event)}
          onContextMenu={(event) => {
            if (previewMode === 'edit') event.preventDefault();
          }}
        >
          <div className="absolute inset-0 z-0 bg-black/28" />
          <AlignmentGuideLayer lines={activeGuideLines} visible={previewMode === 'edit'} />
          <MarqueeLayer
            box={marqueeRef.current?.page === 'archive' ? marqueeBox : null}
            visible={previewMode === 'edit'}
          />
          <MenuPageElementLayer
            page="archive"
            elements={archiveElements}
            selectedElementId={selectedStartMenuElementId}
            selectedElementIds={selectedElementIds}
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
          style={settingsBackgroundStyle}
          onPointerMove={handleElementPointerMove}
          onPointerUp={endElementDrag}
          onPointerCancel={endElementDrag}
          onPointerDown={(event) => beginMarquee('settings', event)}
          onContextMenu={(event) => {
            if (previewMode === 'edit') event.preventDefault();
          }}
        >
          <div className="absolute inset-0 z-0 bg-black/28" />
          <AlignmentGuideLayer lines={activeGuideLines} visible={previewMode === 'edit'} />
          <MarqueeLayer
            box={marqueeRef.current?.page === 'settings' ? marqueeBox : null}
            visible={previewMode === 'edit'}
          />
          <MenuPageElementLayer
            page="settings"
            elements={settingsElements}
            selectedElementId={selectedStartMenuElementId}
            selectedElementIds={selectedElementIds}
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
              if (element.role === 'auto')
                return settings.autoAdvance ? t('开启', 'オン', 'On') : t('关闭', 'オフ', 'Off');
              if (element.role === 'speed') return `${settings.typewriterSpeed}ms`;
              if (element.role === 'controls')
                return previewControlsHidden ? t('关闭', 'オフ', 'Off') : t('开启', 'オン', 'On');
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
  selectedElementIds?: string[];
  previewMode: 'edit' | 'test';
  choiceColor: string;
  choiceTextColor: string;
  onSelectElement?: (id: string | null) => void;
  onUpdateElement: (id: string, patch: Partial<WebMenuElement>) => void;
  onBeginElementDrag: (
    page: 'archive' | 'settings',
    event: React.PointerEvent<HTMLElement>,
    element: WebMenuElement,
    type: 'move' | 'resize' | 'rotate',
    resizeHandle?: PlacementResizeHandle,
  ) => void;
  onAction: (role: WebMenuElement['role']) => void;
  renderSuffix?: (element: WebMenuElement) => string;
};

function MenuPageElementLayer({
  page,
  elements,
  selectedElementId,
  selectedElementIds = [],
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
        .filter((element) => editable || element.visible !== false)
        .map((element) => {
          const selected =
            selectedElementId === element.id || selectedElementIds.includes(element.id);
          const suffix = renderSuffix?.(element) || '';
          const commonStyle: CSSProperties = {
            left: `${element.x}%`,
            top: `${element.y}%`,
            width: `${element.width}%`,
            height: `${element.height}%`,
            transform: `rotate(${element.rotation || 0}deg) scale(${element.scale || 1})`,
            transformOrigin: 'center',
            opacity: element.visible === false ? 0.34 : (element.opacity ?? 100) / 100,
          };
          const contentStyle: CSSProperties = {
            fontSize: element.fontSize,
            fontWeight: element.fontWeight,
            color: element.textColor || (element.primary ? choiceTextColor : '#f8fafc'),
            borderRadius: element.borderRadius ?? (element.kind === 'text' ? 0 : 12),
          };
          const justifyContent =
            element.textAlign === 'left'
              ? 'flex-start'
              : element.textAlign === 'right'
                ? 'flex-end'
                : 'center';

          if (element.kind === 'button') {
            const background =
              element.backgroundType === 'gradient'
                ? linearGradientFromStops(
                    element.backgroundGradientAngle ?? 135,
                    normalizeGradientStops(
                      element.backgroundGradientStops,
                      element.backgroundGradientStart || choiceColor,
                      element.backgroundGradientEnd || '#0f172a',
                    ),
                  )
                : element.backgroundType === 'image' && element.backgroundImageUrl
                  ? `linear-gradient(180deg,rgba(0,0,0,0.16),rgba(0,0,0,0.38)),url("${element.backgroundImageUrl.replace(/"/g, '\\"')}")`
                  : element.backgroundColor ||
                    (element.primary ? choiceColor : 'rgba(255,255,255,0.10)');

            return (
              <button
                key={element.id}
                type="button"
                className={`pointer-events-auto absolute border text-left font-black shadow-[0_12px_32px_rgba(0,0,0,0.18)] ${
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
                    if (event.button === 2) return;
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
                <span
                  className="flex h-full w-full items-center gap-2 overflow-hidden px-4"
                  style={{
                    borderRadius: element.borderRadius ?? 12,
                    justifyContent: suffix ? 'space-between' : justifyContent,
                    textAlign: element.textAlign || 'center',
                  }}
                >
                  {element.textVisible !== false && (
                    <span className="whitespace-pre-line">{element.text}</span>
                  )}
                  {suffix && <span className="text-xs opacity-70">{suffix}</span>}
                </span>
                {selected && (
                  <SelectedElementFrame
                    page={page}
                    element={element}
                    onUpdateElement={onUpdateElement}
                    onBeginElementDrag={onBeginElementDrag}
                  />
                )}
              </button>
            );
          }

          if (element.kind === 'image') {
            return (
              <button
                key={element.id}
                type="button"
                className="pointer-events-auto absolute border-0 bg-transparent p-0"
                style={commonStyle}
                onPointerDown={(event) => {
                  if (editable) onBeginElementDrag(page, event, element, 'move');
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  if (editable && event.button !== 2) onSelectElement?.(element.id);
                }}
              >
                <span
                  className="block h-full w-full overflow-hidden"
                  style={{ borderRadius: element.borderRadius ?? 12 }}
                >
                  {element.imageUrl ? (
                    <img src={element.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="grid h-full w-full place-items-center rounded-xl border border-white/16 bg-white/10 text-xs font-black text-white/60">
                      Image
                    </span>
                  )}
                </span>
                {selected && (
                  <SelectedElementFrame
                    page={page}
                    element={element}
                    onUpdateElement={onUpdateElement}
                    onBeginElementDrag={onBeginElementDrag}
                  />
                )}
              </button>
            );
          }

          return (
            <button
              key={element.id}
              type="button"
              className="pointer-events-auto absolute flex items-center border-0 bg-transparent p-0 font-black"
              style={{
                ...commonStyle,
                ...contentStyle,
                justifyContent,
                textAlign: element.textAlign || 'left',
              }}
              onPointerDown={(event) => {
                if (editable) onBeginElementDrag(page, event, element, 'move');
              }}
              onClick={(event) => {
                event.stopPropagation();
                if (editable && event.button !== 2) onSelectElement?.(element.id);
              }}
              onDoubleClick={(event) => {
                if (!editable) return;
                event.stopPropagation();
                const next = window.prompt('', element.text);
                if (next !== null) onUpdateElement(element.id, { text: next });
              }}
            >
              {element.textVisible !== false && (
                <span className="whitespace-pre-line">{element.text}</span>
              )}
              {selected && (
                <SelectedElementFrame
                  page={page}
                  element={element}
                  onUpdateElement={onUpdateElement}
                  onBeginElementDrag={onBeginElementDrag}
                />
              )}
            </button>
          );
        })}
    </div>
  );
}

function SelectedElementFrame({
  page,
  element,
  onUpdateElement,
  onBeginElementDrag,
}: {
  page: 'archive' | 'settings';
  element: WebMenuElement;
  onUpdateElement: (id: string, patch: Partial<WebMenuElement>) => void;
  onBeginElementDrag: (
    page: 'archive' | 'settings',
    event: React.PointerEvent<HTMLElement>,
    element: WebMenuElement,
    type: 'move' | 'resize' | 'rotate',
    resizeHandle?: PlacementResizeHandle,
  ) => void;
}) {
  return (
    <WebEditableElementFrame
      visible={element.visible !== false}
      onRotatePointerDown={(event) => onBeginElementDrag(page, event, element, 'rotate')}
      onToggleVisible={(event) => {
        event.stopPropagation();
        onUpdateElement(element.id, { visible: element.visible === false });
      }}
      onResizePointerDown={(event, handle) =>
        onBeginElementDrag(page, event, element, 'resize', handle)
      }
    />
  );
}

function AlignmentGuideLayer({
  lines,
  visible,
}: {
  lines: WebAlignmentGuideLine[];
  visible: boolean;
}) {
  if (!visible || lines.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {lines.map((line, index) => (
        <div
          key={`${line.axis}-${line.value}-${index}`}
          className={
            line.axis === 'x'
              ? 'absolute top-0 h-full border-l-[1.5px] border-dashed border-[#ef4444] shadow-[0_0_5px_rgba(239,68,68,0.42)]'
              : 'absolute left-0 w-full border-t-[1.5px] border-dashed border-[#ef4444] shadow-[0_0_5px_rgba(239,68,68,0.42)]'
          }
          style={line.axis === 'x' ? { left: `${line.value}%` } : { top: `${line.value}%` }}
        />
      ))}
    </div>
  );
}

function MarqueeLayer({
  box,
  visible,
}: {
  box: { x: number; y: number; width: number; height: number } | null;
  visible: boolean;
}) {
  if (!visible || !box) return null;
  return (
    <div
      className="pointer-events-none absolute z-[70] border border-sky-400 bg-sky-400/14 shadow-[0_0_0_1px_rgba(14,165,233,0.24)]"
      style={{
        left: `${box.x}%`,
        top: `${box.y}%`,
        width: `${box.width}%`,
        height: `${box.height}%`,
      }}
    />
  );
}

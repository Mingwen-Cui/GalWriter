import type React from 'react';
import type { ReactNode, RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';

import { getRenderObjects } from '../video/shared/renderObjects';
import { getNodeDisplayTitle, stripHtml } from '../video/shared/storyNodes';
import type {
  RenderEditableObject,
  RenderEditableObjectKind,
  RenderStyle,
  WebExportSettings,
} from '../video/shared/types';
import { WebEditableElementFrame, type WebEditableResizeHandle } from './WebEditableElementFrame';
import {
  collectPixelGuideBoxes,
  type PixelGuideLine,
  snapPixelBoxToGuides,
} from './webPixelAlignmentGuides';

const resizeCursorByHandle: Record<WebEditableResizeHandle, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};

type WebPlaytestDialoguePanelProps = {
  dialogueBoxRef: RefObject<HTMLDivElement | null>;
  currentNode: any;
  currentNodeId: string | null;
  text: string;
  displayedPreviewText: string;
  audioUrl: string;
  currentAudioRef: RefObject<HTMLAudioElement | null>;
  settings: WebExportSettings;
  renderStyle: RenderStyle;
  titleStyle: React.CSSProperties;
  bodyStyle: React.CSSProperties;
  dialogueShellStyle: React.CSSProperties;
  hideCenteredTitle: boolean;
  nameplates:
    | ReactNode
    | ((
        onGuideLinesChange: (lines: PixelGuideLine[]) => void,
        selectedRenderObjectKinds: RenderEditableObjectKind[],
      ) => ReactNode);
  aboveChoices: ReactNode;
  belowChoices: ReactNode;
  previewMode?: 'edit' | 'test';
  onSelectRenderObject?: (kind: RenderEditableObjectKind) => void;
  onMoveRenderObject?: (kind: RenderEditableObjectKind, x: number, y: number) => void;
  onUpdateRenderObject?: (
    kind: RenderEditableObjectKind,
    patch: Partial<RenderEditableObject>,
  ) => void;
  t: (zh: string, ja: string, en: string) => string;
  onContinueFromText: () => void;
  onRecordCurrentAudio: () => void;
  onCurrentAudioEnded: () => void;
};

export function WebPlaytestDialoguePanel({
  dialogueBoxRef,
  currentNode,
  currentNodeId,
  text,
  displayedPreviewText,
  audioUrl,
  currentAudioRef,
  settings,
  renderStyle,
  titleStyle,
  bodyStyle,
  dialogueShellStyle,
  hideCenteredTitle,
  nameplates,
  aboveChoices,
  belowChoices,
  previewMode = 'test',
  onSelectRenderObject,
  onMoveRenderObject,
  onUpdateRenderObject,
  t,
  onContinueFromText,
  onRecordCurrentAudio,
  onCurrentAudioEnded,
}: WebPlaytestDialoguePanelProps) {
  const editMode = previewMode === 'edit';
  const [activeGuideLines, setActiveGuideLines] = useState<PixelGuideLine[]>([]);
  const [selectedRenderObjectKinds, setSelectedRenderObjectKinds] = useState<
    RenderEditableObjectKind[]
  >([]);
  const marqueeRef = useRef<{
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
  useEffect(() => {
    setSelectedRenderObjectKinds(
      renderStyle.selectedRenderObject ? [renderStyle.selectedRenderObject] : [],
    );
  }, [renderStyle.selectedRenderObject]);
  const selectionClass = (kind: RenderEditableObjectKind) =>
    editMode &&
    (renderStyle.selectedRenderObject === kind || selectedRenderObjectKinds.includes(kind))
      ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-transparent'
      : '';
  const selectObject = (event: React.MouseEvent, kind: RenderEditableObjectKind) => {
    if (!editMode) return;
    event.stopPropagation();
    setSelectedRenderObjectKinds([kind]);
    onSelectRenderObject?.(kind);
  };
  const startDrag = (event: React.PointerEvent, kind: RenderEditableObjectKind) => {
    if (event.button === 2) return;
    if (!editMode || !onMoveRenderObject) return;
    event.stopPropagation();
    event.preventDefault();
    document.body.style.cursor = 'grabbing';
    const groupKinds =
      selectedRenderObjectKinds.length > 1 && selectedRenderObjectKinds.includes(kind)
        ? selectedRenderObjectKinds
        : [kind];
    setSelectedRenderObjectKinds(groupKinds);
    onSelectRenderObject?.(kind);
    const renderObjects = getRenderObjects(renderStyle);
    const object = renderObjects[kind];
    const initialObjects = new Map(
      groupKinds.map((groupKind) => [groupKind, renderObjects[groupKind]]),
    );
    const container = dialogueBoxRef.current;
    const containerRect = container?.getBoundingClientRect();
    const targetRect = event.currentTarget.getBoundingClientRect();
    const targetStartX = containerRect ? targetRect.left - containerRect.left : 0;
    const targetStartY = containerRect ? targetRect.top - containerRect.top : 0;
    const guideBoxes = container ? collectPixelGuideBoxes(container, kind) : [];
    const startX = event.clientX;
    const startY = event.clientY;
    const initialX = object.x;
    const initialY = object.y;
    const move = (moveEvent: PointerEvent) => {
      let nextX = initialX + moveEvent.clientX - startX;
      let nextY = initialY + moveEvent.clientY - startY;
      if (containerRect && guideBoxes.length > 0) {
        const snapped = snapPixelBoxToGuides({
          x: targetStartX + moveEvent.clientX - startX,
          y: targetStartY + moveEvent.clientY - startY,
          width: targetRect.width,
          height: targetRect.height,
          boxes: guideBoxes,
        });
        nextX = initialX + snapped.x - targetStartX;
        nextY = initialY + snapped.y - targetStartY;
        setActiveGuideLines(snapped.lines);
      } else {
        setActiveGuideLines([]);
      }
      if (groupKinds.length > 1) {
        const groupDx = nextX - initialX;
        const groupDy = nextY - initialY;
        groupKinds.forEach((groupKind) => {
          const initialObject = initialObjects.get(groupKind);
          if (!initialObject) return;
          onMoveRenderObject(groupKind, initialObject.x + groupDx, initialObject.y + groupDy);
        });
      } else {
        onMoveRenderObject(kind, nextX, nextY);
      }
    };
    const end = () => {
      setActiveGuideLines([]);
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };
  const beginMarquee = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!editMode || event.button !== 2) return false;
    const rect = dialogueBoxRef.current?.getBoundingClientRect();
    if (!rect) return false;
    event.preventDefault();
    event.stopPropagation();
    marqueeRef.current = { startClientX: event.clientX, startClientY: event.clientY, rect };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const nextBox = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      width: 0,
      height: 0,
    };
    marqueeBoxRef.current = nextBox;
    setMarqueeBox(nextBox);
    return true;
  };
  const updateMarquee = (event: React.PointerEvent<HTMLDivElement>) => {
    const marquee = marqueeRef.current;
    if (!marquee) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = marquee.startClientX - marquee.rect.left;
    const startY = marquee.startClientY - marquee.rect.top;
    const currentX = event.clientX - marquee.rect.left;
    const currentY = event.clientY - marquee.rect.top;
    const left = Math.max(0, Math.min(startX, currentX));
    const top = Math.max(0, Math.min(startY, currentY));
    const right = Math.min(marquee.rect.width, Math.max(startX, currentX));
    const bottom = Math.min(marquee.rect.height, Math.max(startY, currentY));
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
    const container = dialogueBoxRef.current;
    if (!marquee || !box || !container) return;
    event?.preventDefault();
    event?.stopPropagation();
    const selectedKinds: RenderEditableObjectKind[] = [];
    Array.from(container.querySelectorAll<HTMLElement>('[data-render-object]')).forEach(
      (element) => {
        const kind = element.dataset.renderObject as RenderEditableObjectKind | undefined;
        if (!kind || kind === 'dialogBox') return;
        const rect = element.getBoundingClientRect();
        const elementBox = {
          x: rect.left - marquee.rect.left,
          y: rect.top - marquee.rect.top,
          width: rect.width,
          height: rect.height,
        };
        const intersects =
          elementBox.x < box.x + box.width &&
          elementBox.x + elementBox.width > box.x &&
          elementBox.y < box.y + box.height &&
          elementBox.y + elementBox.height > box.y;
        if (intersects) selectedKinds.push(kind);
      },
    );
    const uniqueKinds = Array.from(new Set(selectedKinds));
    marqueeRef.current = null;
    marqueeBoxRef.current = null;
    setMarqueeBox(null);
    setSelectedRenderObjectKinds(uniqueKinds);
    const activeKind = uniqueKinds[uniqueKinds.length - 1];
    if (activeKind) onSelectRenderObject?.(activeKind);
  };
  const objects = getRenderObjects(renderStyle);
  const dialogObject = objects.dialogBox;
  const selectedFrame = (kind: RenderEditableObjectKind) =>
    editMode &&
    (renderStyle.selectedRenderObject === kind || selectedRenderObjectKinds.includes(kind)) &&
    onUpdateRenderObject ? (
      <RenderObjectFrame kind={kind} object={objects[kind]} onUpdate={onUpdateRenderObject} />
    ) : null;

  return (
    <div
      className={`${
        settings.layoutMode === 'immersive'
          ? 'pointer-events-none absolute z-20 flex items-end justify-center'
          : 'relative'
      }`}
      style={{
        width:
          settings.layoutMode === 'immersive'
            ? `min(${dialogObject.width}%, calc(100% - 24px))`
            : `${dialogObject.width}%`,
        height:
          settings.layoutMode === 'immersive'
            ? `min(${dialogObject.height}%, calc(100% - 96px))`
            : undefined,
        maxHeight: settings.layoutMode === 'immersive' ? 'calc(100% - 96px)' : undefined,
        left: settings.layoutMode === 'immersive' ? '50%' : undefined,
        bottom: settings.layoutMode === 'immersive' ? '4%' : undefined,
        transform: settings.layoutMode === 'immersive' ? 'translateX(-50%)' : undefined,
        justifySelf: settings.layoutMode === 'classic' ? 'center' : undefined,
      }}
    >
      <div
        ref={dialogueBoxRef}
        className={`pointer-events-auto relative h-full w-full border-t border-white/10 py-4 ${
          settings.layoutMode === 'immersive'
            ? `${editMode ? 'overflow-visible' : 'overflow-y-auto'} rounded-xl border border-white/12 shadow-2xl shadow-black/30 backdrop-blur-xl`
            : 'rounded-b-lg border-x border-b border-white/10 px-4 shadow-2xl shadow-black/20 backdrop-blur-xl'
        } ${editMode ? 'cursor-grab' : ''} ${selectionClass('dialogBox')}`}
        style={dialogueShellStyle}
        data-dialogue-box="true"
        data-render-object="dialogBox"
        onClick={(event) => selectObject(event, 'dialogBox')}
        onPointerDown={(event) => {
          if (beginMarquee(event)) return;
          startDrag(event, 'dialogBox');
        }}
        onPointerMove={updateMarquee}
        onPointerUp={finishMarquee}
        onPointerCancel={finishMarquee}
        onContextMenu={(event) => {
          if (editMode) event.preventDefault();
        }}
      >
        {editMode && activeGuideLines.length > 0 && (
          <div className="pointer-events-none absolute inset-0 z-[80]">
            {activeGuideLines.map((line, index) => (
              <div
                key={`${line.axis}-${line.value}-${index}`}
                className={
                  line.axis === 'x'
                    ? 'absolute top-0 h-full border-l-[1.5px] border-dashed border-red-500 shadow-[0_0_5px_rgba(239,68,68,0.42)]'
                    : 'absolute left-0 w-full border-t-[1.5px] border-dashed border-red-500 shadow-[0_0_5px_rgba(239,68,68,0.42)]'
                }
                style={line.axis === 'x' ? { left: line.value } : { top: line.value }}
              />
            ))}
          </div>
        )}
        {selectedFrame('dialogBox')}
        {editMode && marqueeBox && (
          <div
            className="pointer-events-none absolute z-[250] border border-sky-400 bg-sky-400/14 shadow-[0_0_0_1px_rgba(14,165,233,0.24)]"
            style={{
              left: marqueeBox.x,
              top: marqueeBox.y,
              width: marqueeBox.width,
              height: marqueeBox.height,
            }}
          />
        )}
        {typeof nameplates === 'function'
          ? nameplates(setActiveGuideLines, selectedRenderObjectKinds)
          : nameplates}
        {aboveChoices}
        {(objects.title.visible || editMode) && !hideCenteredTitle && (
          <h2
            key={`${currentNodeId}-title-${renderStyle.titleAnimation}`}
            className={`relative z-20 mb-2 font-black ${editMode ? 'cursor-grab' : ''} ${selectionClass('title')}`}
            data-render-object="title"
            style={{
              ...titleStyle,
              display: editMode ? undefined : titleStyle.display,
              overflow: editMode ? 'visible' : titleStyle.overflow,
              opacity: objects.title.visible ? titleStyle.opacity : 0.34,
            }}
            onClick={(event) => selectObject(event, 'title')}
            onPointerDown={(event) => startDrag(event, 'title')}
          >
            {getNodeDisplayTitle(currentNode)}
            {selectedFrame('title')}
          </h2>
        )}
        <div
          key={`${currentNodeId}-body-${renderStyle.bodyAnimation}`}
          className={`relative mt-2 text-sm leading-relaxed text-slate-200 ${
            settings.layoutMode === 'classic' && settings.interactionMode === 'typewriter'
              ? 'relative'
              : ''
          } z-20 ${editMode ? 'cursor-grab' : ''} ${selectionClass('body')}`}
          data-render-object="body"
          style={{
            ...bodyStyle,
            display: editMode ? undefined : bodyStyle.display,
            overflow: editMode ? 'visible' : bodyStyle.overflow,
            opacity: objects.body.visible ? bodyStyle.opacity : 0.34,
          }}
          onClick={(event) => {
            if (editMode) {
              selectObject(event, 'body');
              return;
            }
            onContinueFromText();
          }}
          onPointerDown={(event) => startDrag(event, 'body')}
        >
          {selectedFrame('body')}
          {settings.interactionMode === 'typewriter' &&
            (settings.layoutMode === 'classic' ? (
              <>
                <span className="invisible block whitespace-pre-wrap" aria-hidden="true">
                  {stripHtml(text) || ' '}
                </span>
                <span
                  className="absolute inset-0 block whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: displayedPreviewText || '' }}
                />
              </>
            ) : (
              <span dangerouslySetInnerHTML={{ __html: displayedPreviewText || '' }} />
            ))}
          {settings.interactionMode !== 'typewriter' && (
            <span
              dangerouslySetInnerHTML={{
                __html: text || t('（无正文）', '（本文なし）', '(No body text)'),
              }}
            />
          )}
        </div>
        {audioUrl && (
          <audio
            key={currentNodeId}
            ref={currentAudioRef}
            src={audioUrl}
            preload="auto"
            onPlay={onRecordCurrentAudio}
            onEnded={onCurrentAudioEnded}
            className="hidden"
          />
        )}
        {belowChoices}
      </div>
    </div>
  );
}

function RenderObjectFrame({
  kind,
  object,
  onUpdate,
}: {
  kind: RenderEditableObjectKind;
  object: RenderEditableObject;
  onUpdate: (kind: RenderEditableObjectKind, patch: Partial<RenderEditableObject>) => void;
}) {
  const beginResize = (event: React.PointerEvent<HTMLElement>, handle: WebEditableResizeHandle) => {
    event.preventDefault();
    event.stopPropagation();
    document.body.style.cursor = resizeCursorByHandle[handle];
    const startX = event.clientX;
    const startY = event.clientY;
    const initial = object;
    const target = event.currentTarget.closest<HTMLElement>('[data-render-object]');
    const targetRect = target?.getBoundingClientRect();
    const widthUnitPerPx =
      targetRect && targetRect.width > 0 ? initial.width / targetRect.width : 1;
    const heightUnitPerPx =
      kind === 'dialogBox' && targetRect && targetRect.height > 0
        ? initial.height / targetRect.height
        : 1;
    const minWidth = kind === 'dialogBox' ? 35 : 8;
    const minHeight = kind === 'dialogBox' ? 16 : 8;
    const move = (moveEvent: PointerEvent) => {
      const dxPx = moveEvent.clientX - startX;
      const dyPx = moveEvent.clientY - startY;
      const widthDelta = dxPx * widthUnitPerPx;
      const heightDelta = dyPx * heightUnitPerPx;
      let nextX = initial.x;
      let nextY = initial.y;
      let nextWidth = initial.width;
      let nextHeight = initial.height;
      if (handle.includes('e')) nextWidth = initial.width + widthDelta;
      if (handle.includes('s')) nextHeight = initial.height + heightDelta;
      if (handle.includes('w')) {
        nextX = initial.x + dxPx;
        nextWidth = initial.width - widthDelta;
      }
      if (handle.includes('n')) {
        nextY = initial.y + dyPx;
        nextHeight = initial.height - heightDelta;
      }
      if (nextWidth < minWidth) {
        if (handle.includes('w')) nextX = initial.x + (initial.width - minWidth) / widthUnitPerPx;
        nextWidth = minWidth;
      }
      if (nextHeight < minHeight) {
        if (handle.includes('n'))
          nextY = initial.y + (initial.height - minHeight) / heightUnitPerPx;
        nextHeight = minHeight;
      }
      onUpdate(kind, {
        x: Math.round(nextX),
        y: Math.round(nextY),
        width: Math.round(nextWidth),
        height: Math.round(nextHeight),
      });
    };
    const end = () => {
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };
  const beginRotate = (event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    document.body.style.cursor = 'grabbing';
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const startAngle =
      Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI);
    const initialRotation = object.rotation || 0;
    const move = (moveEvent: PointerEvent) => {
      const angle =
        Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) * (180 / Math.PI);
      onUpdate(kind, { rotation: Math.round(initialRotation + angle - startAngle) });
    };
    const end = () => {
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };

  return (
    <WebEditableElementFrame
      visible={object.visible}
      onRotatePointerDown={beginRotate}
      onToggleVisible={(event) => {
        event.stopPropagation();
        onUpdate(kind, { visible: !object.visible });
      }}
      onResizePointerDown={beginResize}
    />
  );
}

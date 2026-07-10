import type React from 'react';
import type { ReactNode, RefObject } from 'react';
import { useState } from 'react';

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
  nameplates: ReactNode | ((onGuideLinesChange: (lines: PixelGuideLine[]) => void) => ReactNode);
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
  const selectionClass = (kind: RenderEditableObjectKind) =>
    editMode && renderStyle.selectedRenderObject === kind
      ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-transparent'
      : editMode
        ? 'outline outline-1 outline-indigo-400/35'
        : '';
  const selectObject = (event: React.MouseEvent, kind: RenderEditableObjectKind) => {
    if (!editMode) return;
    event.stopPropagation();
    onSelectRenderObject?.(kind);
  };
  const startDrag = (event: React.PointerEvent, kind: RenderEditableObjectKind) => {
    if (!editMode || !onMoveRenderObject) return;
    event.stopPropagation();
    event.preventDefault();
    document.body.style.cursor = 'grabbing';
    onSelectRenderObject?.(kind);
    const object = getRenderObjects(renderStyle)[kind];
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
      onMoveRenderObject(kind, nextX, nextY);
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
  const objects = getRenderObjects(renderStyle);
  const selectedFrame = (kind: RenderEditableObjectKind) =>
    editMode && renderStyle.selectedRenderObject === kind && onUpdateRenderObject ? (
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
            ? `min(${renderStyle.dialogWidth}%, calc(100% - 24px))`
            : `${renderStyle.dialogWidth}%`,
        height:
          settings.layoutMode === 'immersive'
            ? `min(${renderStyle.dialogHeight}%, calc(100% - 96px))`
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
        onPointerDown={(event) => startDrag(event, 'dialogBox')}
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
        {typeof nameplates === 'function' ? nameplates(setActiveGuideLines) : nameplates}
        {aboveChoices}
        {(objects.title.visible || editMode) && !hideCenteredTitle && (
          <h2
            key={`${currentNodeId}-title-${renderStyle.titleAnimation}`}
            className={`relative mb-2 font-black ${editMode ? 'cursor-grab' : ''} ${selectionClass('title')}`}
            data-render-object="title"
            style={{
              ...titleStyle,
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
          } ${editMode ? 'cursor-grab' : ''} ${selectionClass('body')}`}
          data-render-object="body"
          style={{
            ...bodyStyle,
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

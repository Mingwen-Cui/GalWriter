import type React from 'react';
import type { ReactNode, RefObject } from 'react';
import { useState } from 'react';

import { getRenderObjects } from '../video/shared/renderObjects';
import { getNodeDisplayTitle, stripHtml } from '../video/shared/storyNodes';
import type { RenderEditableObject, RenderEditableObjectKind, RenderStyle, WebExportSettings } from '../video/shared/types';
import {
  WebEditableElementFrame,
  type WebEditableResizeHandle,
} from './WebEditableElementFrame';

type PixelGuideLine = {
  axis: 'x' | 'y';
  value: number;
};

type PixelGuideBox = {
  id: RenderEditableObjectKind | 'dialogueBounds';
  x: number;
  y: number;
  width: number;
  height: number;
};

const getPixelGuideValues = (box: PixelGuideBox, axis: 'x' | 'y') => {
  const start = axis === 'x' ? box.x : box.y;
  const size = axis === 'x' ? box.width : box.height;
  return [start, start + size / 2, start + size];
};

const findClosestPixelGuide = (value: number, guides: number[], tolerance = 4) => {
  let closest: number | null = null;
  let closestDelta = tolerance;
  guides.forEach((guide) => {
    const delta = Math.abs(value - guide);
    if (delta <= closestDelta) {
      closest = guide;
      closestDelta = delta;
    }
  });
  return closest;
};

const snapPixelBoxToGuides = ({
  x,
  y,
  width,
  height,
  boxes,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  boxes: PixelGuideBox[];
}) => {
  const snapAxis = (start: number, size: number, axis: 'x' | 'y') => {
    const guides = boxes.flatMap((box) => getPixelGuideValues(box, axis));
    const candidates = [start, start + size / 2, start + size]
      .map((value, index) => {
        const line = findClosestPixelGuide(value, guides);
        if (line === null) return null;
        const offset = index === 0 ? 0 : index === 1 ? size / 2 : size;
        return { start: line - offset, line, delta: Math.abs(value - line) };
      })
      .filter((candidate): candidate is { start: number; line: number; delta: number } =>
        Boolean(candidate),
      );
    return candidates.reduce(
      (best, candidate) => (candidate.delta < best.delta ? candidate : best),
      { start, line: null as number | null, delta: 4 },
    );
  };
  const snappedX = snapAxis(x, width, 'x');
  const snappedY = snapAxis(y, height, 'y');
  const lines: PixelGuideLine[] = [];
  if (snappedX.line !== null) lines.push({ axis: 'x', value: snappedX.line });
  if (snappedY.line !== null) lines.push({ axis: 'y', value: snappedY.line });
  return { x: snappedX.start, y: snappedY.start, lines };
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
  nameplates: ReactNode;
  aboveChoices: ReactNode;
  belowChoices: ReactNode;
  previewMode?: 'edit' | 'test';
  onSelectRenderObject?: (kind: RenderEditableObjectKind) => void;
  onMoveRenderObject?: (kind: RenderEditableObjectKind, x: number, y: number) => void;
  onUpdateRenderObject?: (kind: RenderEditableObjectKind, patch: Partial<RenderEditableObject>) => void;
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
    onSelectRenderObject?.(kind);
    const object = getRenderObjects(renderStyle)[kind];
    const dialogueRect = dialogueBoxRef.current?.getBoundingClientRect();
    const currentObjects = getRenderObjects(renderStyle);
    const guideBoxes: PixelGuideBox[] = dialogueRect
      ? [
          { id: 'dialogueBounds', x: 0, y: 0, width: dialogueRect.width, height: dialogueRect.height },
          ...(['title', 'body'] as RenderEditableObjectKind[])
            .filter((guideKind) => guideKind !== kind && currentObjects[guideKind]?.visible)
            .map((guideKind) => ({
              id: guideKind,
              x: currentObjects[guideKind].x,
              y: currentObjects[guideKind].y,
              width: (currentObjects[guideKind].width / 100) * dialogueRect.width,
              height: currentObjects[guideKind].height,
            })),
        ]
      : [];
    const startX = event.clientX;
    const startY = event.clientY;
    const initialX = object.x;
    const initialY = object.y;
    const move = (moveEvent: PointerEvent) => {
      let nextX = initialX + moveEvent.clientX - startX;
      let nextY = initialY + moveEvent.clientY - startY;
      if (dialogueRect && guideBoxes.length > 0 && kind !== 'dialogBox') {
        const snapped = snapPixelBoxToGuides({
          x: nextX,
          y: nextY,
          width: (object.width / 100) * dialogueRect.width,
          height: object.height,
          boxes: guideBoxes,
        });
        nextX = snapped.x;
        nextY = snapped.y;
        setActiveGuideLines(snapped.lines);
      } else {
        setActiveGuideLines([]);
      }
      onMoveRenderObject(kind, nextX, nextY);
    };
    const end = () => {
      setActiveGuideLines([]);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };
  const objects = getRenderObjects(renderStyle);
  const selectedFrame = (kind: RenderEditableObjectKind) =>
    editMode && renderStyle.selectedRenderObject === kind && onUpdateRenderObject ? (
      <RenderObjectFrame
        kind={kind}
        object={objects[kind]}
        onUpdate={onUpdateRenderObject}
      />
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
        maxHeight: settings.layoutMode === 'immersive' ? 'calc(100% - 96px)' : undefined,
        left:
          settings.layoutMode === 'immersive'
            ? `${50 + Math.max(-100, Math.min(100, renderStyle.dialogOffsetX ?? 0)) * 0.5}%`
            : undefined,
        bottom:
          settings.layoutMode === 'immersive'
            ? `calc(4% - ${Math.max(-100, Math.min(100, renderStyle.dialogOffsetY ?? 0)) * 0.28}%)`
            : undefined,
        transform: settings.layoutMode === 'immersive' ? 'translateX(-50%)' : undefined,
        justifySelf: settings.layoutMode === 'classic' ? 'center' : undefined,
      }}
    >
      <div
        ref={dialogueBoxRef}
        className={`pointer-events-auto relative w-full border-t border-white/10 py-4 ${
          settings.layoutMode === 'immersive'
            ? `${editMode ? 'overflow-visible' : 'overflow-y-auto'} rounded-xl border border-white/12 shadow-2xl shadow-black/30 backdrop-blur-xl`
            : 'rounded-b-lg border-x border-b border-white/10 px-4 shadow-2xl shadow-black/20 backdrop-blur-xl'
        } ${selectionClass('dialogBox')}`}
        style={dialogueShellStyle}
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
        {nameplates}
        {aboveChoices}
        {(objects.title.visible || editMode) && !hideCenteredTitle && (
          <h2
            key={`${currentNodeId}-title-${renderStyle.titleAnimation}`}
            className={`relative mb-2 font-black ${selectionClass('title')}`}
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
          } ${selectionClass('body')}`}
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
    const startX = event.clientX;
    const startY = event.clientY;
    const initial = object;
    const move = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      let nextX = initial.x;
      let nextY = initial.y;
      let nextWidth = initial.width;
      let nextHeight = initial.height;
      if (handle.includes('e')) nextWidth = initial.width + dx;
      if (handle.includes('s')) nextHeight = initial.height + dy;
      if (handle.includes('w')) {
        nextX = initial.x + dx;
        nextWidth = initial.width - dx;
      }
      if (handle.includes('n')) {
        nextY = initial.y + dy;
        nextHeight = initial.height - dy;
      }
      if (nextWidth < 8) {
        if (handle.includes('w')) nextX = initial.x + initial.width - 8;
        nextWidth = 8;
      }
      if (nextHeight < 8) {
        if (handle.includes('n')) nextY = initial.y + initial.height - 8;
        nextHeight = 8;
      }
      onUpdate(kind, {
        x: Math.round(nextX),
        y: Math.round(nextY),
        width: Math.round(nextWidth),
        height: Math.round(nextHeight),
      });
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };
  const beginRotate = (event: React.PointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const startAngle = Math.atan2(event.clientY - centerY, event.clientX - centerX) * (180 / Math.PI);
    const initialRotation = object.rotation || 0;
    const move = (moveEvent: PointerEvent) => {
      const angle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) * (180 / Math.PI);
      onUpdate(kind, { rotation: Math.round(initialRotation + angle - startAngle) });
    };
    const end = () => {
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

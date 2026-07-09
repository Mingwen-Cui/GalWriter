import type React from 'react';
import type { ReactNode, RefObject } from 'react';

import { getNodeDisplayTitle, stripHtml } from '../video/shared/storyNodes';
import { getRenderObjects } from '../video/shared/renderObjects';
import type { RenderEditableObjectKind, RenderStyle, WebExportSettings } from '../video/shared/types';

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
  t,
  onContinueFromText,
  onRecordCurrentAudio,
  onCurrentAudioEnded,
}: WebPlaytestDialoguePanelProps) {
  const editMode = previewMode === 'edit';
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
    const startX = event.clientX;
    const startY = event.clientY;
    const initialX = object.x;
    const initialY = object.y;
    const move = (moveEvent: PointerEvent) => {
      onMoveRenderObject(kind, initialX + moveEvent.clientX - startX, initialY + moveEvent.clientY - startY);
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  };

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
            ? 'overflow-y-auto rounded-xl border border-white/12 shadow-2xl shadow-black/30 backdrop-blur-xl'
            : 'rounded-b-lg border-x border-b border-white/10 px-4 shadow-2xl shadow-black/20 backdrop-blur-xl'
        } ${selectionClass('dialogBox')}`}
        style={dialogueShellStyle}
        onClick={(event) => selectObject(event, 'dialogBox')}
        onPointerDown={(event) => startDrag(event, 'dialogBox')}
      >
        {nameplates}
        {aboveChoices}
        {renderStyle.titleVisible && !hideCenteredTitle && (
          <h2
            key={`${currentNodeId}-title-${renderStyle.titleAnimation}`}
            className={`mb-2 font-black ${selectionClass('title')}`}
            style={titleStyle}
            onClick={(event) => selectObject(event, 'title')}
            onPointerDown={(event) => startDrag(event, 'title')}
          >
            {getNodeDisplayTitle(currentNode)}
          </h2>
        )}
        <div
          key={`${currentNodeId}-body-${renderStyle.bodyAnimation}`}
          className={`mt-2 text-sm leading-relaxed text-slate-200 ${
            settings.layoutMode === 'classic' && settings.interactionMode === 'typewriter'
              ? 'relative'
              : ''
          } ${selectionClass('body')}`}
          style={bodyStyle}
          onClick={(event) => {
            if (editMode) {
              selectObject(event, 'body');
              return;
            }
            onContinueFromText();
          }}
          onPointerDown={(event) => startDrag(event, 'body')}
        >
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

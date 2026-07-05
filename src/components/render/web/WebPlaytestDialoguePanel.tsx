import type { ReactNode, RefObject } from 'react';

import { getNodeDisplayTitle, stripHtml } from '../video/shared/storyNodes';
import type { RenderStyle, WebExportSettings } from '../video/shared/types';

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
  t,
  onContinueFromText,
  onRecordCurrentAudio,
  onCurrentAudioEnded,
}: WebPlaytestDialoguePanelProps) {
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
        }`}
        style={dialogueShellStyle}
      >
        {nameplates}
        {aboveChoices}
        {renderStyle.titleVisible && !hideCenteredTitle && (
          <h2
            key={`${currentNodeId}-title-${renderStyle.titleAnimation}`}
            className="mb-2 font-black"
            style={titleStyle}
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
          }`}
          style={bodyStyle}
          onClick={onContinueFromText}
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

import type { RefObject } from 'react';

import type {
  CharacterNodeData,
  CharacterPresentation,
  InlinePresentationAction,
  StoryPresentation,
} from '../../../domain/project';
import {
  inlineActionAnimation,
  inlineActionCssVars,
  inlineActionTransform,
  latestPersistentInlineAction,
} from '../../../lib/inlinePresentationPlayback';
import {
  clampCharacterLayer,
  getCharacterEnterDelay,
  getCharacterStagePosition,
  getPresentationTransform,
} from '../../../lib/presentation';
import type { WebExportSettings } from '../video/shared/types';

type PresentedCharacter = {
  config: CharacterPresentation;
  data: CharacterNodeData;
  imageUrl: string;
};

type WebPlaytestMediaLayersProps = {
  currentNodeId: string | null;
  currentImageUrl: string;
  currentVideoUrl: string;
  currentVideoRef: RefObject<HTMLVideoElement | null>;
  settings: WebExportSettings;
  sceneStyle: React.CSSProperties;
  presentedCharacters: PresentedCharacter[];
  presentation: StoryPresentation;
  presentationExiting: boolean;
  presentationVisible: boolean;
  activeInlineAction: InlinePresentationAction | null;
  completedInlineActions: InlinePresentationAction[];
  emptyText: string;
  onVideoEnded: () => void;
};

export function WebPlaytestMediaLayers({
  currentNodeId,
  currentImageUrl,
  currentVideoUrl,
  currentVideoRef,
  settings,
  sceneStyle,
  presentedCharacters,
  presentation,
  presentationExiting,
  presentationVisible,
  activeInlineAction,
  completedInlineActions,
  emptyText,
  onVideoEnded,
}: WebPlaytestMediaLayersProps) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {currentImageUrl ? (
        <img
          key={`${currentNodeId}-${currentImageUrl}-${settings.layoutMode}`}
          src={currentImageUrl}
          alt=""
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
          className="preview-media-safe h-full w-full"
          style={sceneStyle}
        />
      ) : currentVideoUrl ? (
        <video
          ref={currentVideoRef}
          src={currentVideoUrl}
          controls
          playsInline
          autoPlay={settings.videoAutoPlay || settings.autoAdvance}
          muted={settings.videoAutoPlay}
          onEnded={onVideoEnded}
          className="h-full w-full"
          style={sceneStyle}
        />
      ) : (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm font-bold text-white/45">
          {emptyText}
        </div>
      )}
      {presentedCharacters.length > 0 && (
        <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
          {presentedCharacters.map(({ config, data, imageUrl }) => {
            const motion = presentationExiting ? config.exit : config.enter;
            const animationActive =
              settings.layoutMode === 'immersive' && (presentationExiting || !presentationVisible);
            const animationTransform =
              animationActive && motion
                ? getPresentationTransform(motion.type, presentationExiting)
                : '';
            const inlineAction =
              activeInlineAction?.kind === 'character' &&
              activeInlineAction.sourceNodeId === config.sourceNodeId
                ? activeInlineAction
                : latestPersistentInlineAction(
                    completedInlineActions,
                    'character',
                    config.sourceNodeId,
                  );
            const inlineDuration = inlineAction ? Math.max(80, inlineAction.duration || 300) : 0;
            return (
              <img
                key={config.sourceNodeId}
                src={imageUrl}
                alt={data.characterName}
                draggable={false}
                onDragStart={(event) => event.preventDefault()}
                className="preview-media-safe absolute max-h-[92%] max-w-[72%] w-auto object-contain object-bottom"
                style={{
                  ...getCharacterStagePosition(config),
                  zIndex: clampCharacterLayer(config.layer),
                  opacity: animationActive && motion.type === 'fade' ? 0 : 1,
                  transform: `translate(-50%, 0) ${animationTransform} scale(${config.scale}) scaleX(${config.flipX ? -1 : 1}) ${inlineActionTransform(inlineAction)}`,
                  animation: inlineActionAnimation(inlineAction),
                  ...inlineActionCssVars(inlineAction),
                  transformOrigin: 'center center',
                  transitionProperty: 'opacity, transform',
                  transitionDuration: inlineAction
                    ? `${inlineDuration}ms`
                    : settings.layoutMode === 'classic'
                      ? '0ms'
                      : `${motion.type === 'none' ? 0 : motion.duration}ms`,
                  transitionDelay:
                    settings.layoutMode === 'classic' || presentationExiting
                      ? '0ms'
                      : `${getCharacterEnterDelay(presentation)}ms`,
                  transitionTimingFunction: 'ease-out',
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

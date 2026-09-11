import type { RefObject } from 'react';

import type {
  CharacterNodeData,
  CharacterPresentation,
  InlinePresentationAction,
  SceneVisualStyle,
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
  getCharacterStageBounds,
  getPresentationTransform,
} from '../../../lib/presentation';
import { getSceneGroupStyle } from '../canvas/sceneCanvasStyle';
import type { WebExportSettings } from '../video/shared/types';
import { SceneLightOverlay } from '../shared/SceneLightOverlay';
import { SceneSwitchFlash } from '../shared/SceneSwitchFlash';

type PresentedCharacter = {
  config: CharacterPresentation;
  data: CharacterNodeData;
  imageUrl: string;
};

type WebPlaytestMediaLayersProps = {
  currentNodeId: string | null;
  currentImageUrl: string;
  currentVideoUrl: string;
  sceneSwitchImageUrl?: string;
  sceneSwitchDurationMs?: number;
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
  sceneVisualStyle?: SceneVisualStyle;
  scenePresetEnabled?: boolean;
};

export function WebPlaytestMediaLayers({
  currentNodeId,
  currentImageUrl,
  currentVideoUrl,
  sceneSwitchImageUrl,
  sceneSwitchDurationMs,
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
  sceneVisualStyle,
  scenePresetEnabled = false,
}: WebPlaytestMediaLayersProps) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0"
        data-split-visual-group={settings.layoutMode === 'classic' ? 'true' : undefined}
        style={settings.layoutMode === 'classic' ? getSceneGroupStyle(settings) : undefined}
      >
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
        <SceneSwitchFlash
          action={activeInlineAction}
          targetImageUrl={sceneSwitchImageUrl}
          targetImageStyle={sceneStyle}
          durationMs={sceneSwitchDurationMs}
        />
        {presentedCharacters.length > 0 && (
          <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
            {presentedCharacters.map(({ config, data, imageUrl }) => {
              const hasEnterCue = presentation.inlineActions?.some(
                (action) => action.timelinePhase === 'enter' && action.kind === 'character' && action.sourceNodeId === config.sourceNodeId,
              );
              const enterCueActive =
                activeInlineAction?.timelinePhase === 'enter' &&
                activeInlineAction.kind === 'character' &&
                activeInlineAction.sourceNodeId === config.sourceNodeId;
              const exitCueActive =
                activeInlineAction?.timelinePhase === 'exit' &&
                activeInlineAction.kind === 'character' &&
                activeInlineAction.sourceNodeId === config.sourceNodeId;
              const enterCueCompleted = completedInlineActions.some(
                (action) => action.timelinePhase === 'enter' && action.kind === 'character' && action.sourceNodeId === config.sourceNodeId,
              );
              const exitCueCompleted = completedInlineActions.some(
                (action) => action.timelinePhase === 'exit' && action.kind === 'character' && action.sourceNodeId === config.sourceNodeId,
              );
              const waitingForEnterCue = Boolean(hasEnterCue && !enterCueActive && !enterCueCompleted);
              const motion = presentationExiting || exitCueActive ? config.exit : config.enter;
              // Classic mode intentionally skips the card-level entrance, but a
              // Tag cue is an explicit timeline event and must still animate.
              const timelineCueAnimation = exitCueActive || exitCueCompleted || waitingForEnterCue;
              const animationActive =
                timelineCueAnimation ||
                (settings.layoutMode === 'immersive' && (presentationExiting || !presentationVisible));
              const animationTransform =
                animationActive && motion
                  ? getPresentationTransform(motion.type, presentationExiting || exitCueActive || exitCueCompleted)
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
                  className="preview-media-safe absolute w-auto object-contain object-bottom"
                  style={{
                    ...getCharacterStageBounds(config),
                    zIndex: clampCharacterLayer(config.layer),
                    opacity: animationActive && motion.type === 'fade' ? 0 : 1,
                    transform: `translate(-50%, 0) ${animationTransform} scale(${config.scale}) scaleX(${config.flipX ? -1 : 1}) ${inlineActionTransform(inlineAction)}`,
                    animation: inlineActionAnimation(inlineAction),
                    ...inlineActionCssVars(inlineAction),
                    transformOrigin: 'bottom center',
                    transitionProperty: 'opacity, transform',
                    transitionDuration: inlineAction
                      ? `${inlineDuration}ms`
                      : timelineCueAnimation
                        ? `${motion.type === 'none' ? 0 : motion.duration}ms`
                      : settings.layoutMode === 'classic'
                        ? '0ms'
                        : `${motion.type === 'none' ? 0 : motion.duration}ms`,
                    transitionDelay:
                      timelineCueAnimation || settings.layoutMode === 'classic' || presentationExiting
                        ? '0ms'
                        : `${getCharacterEnterDelay(presentation)}ms`,
                    transitionTimingFunction: 'ease-out',
                  }}
                />
              );
            })}
          </div>
        )}
        <SceneLightOverlay style={sceneVisualStyle} enabled={scenePresetEnabled} />
      </div>
    </div>
  );
}

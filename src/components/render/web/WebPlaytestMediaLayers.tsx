import { Fragment, type CSSProperties, type RefObject } from 'react';
import { getInlineSwitchAction, resolveCharacterImageUrl } from '../../../lib/inlineAssetSwitch';

import type {
  CharacterNodeData,
  CharacterPresentation,
  InlinePresentationAction,
  SceneVisualStyle,
  StoryPresentation,
} from '../../../domain/project';
import {
  getCharacterPlaybackMotion,
  getInlineTargetState,
  inlineActionAnimation,
  getInlineActionDuration,
  inlineActionCssVars,
  latestPersistentInlineAction,
} from '../../../lib/inlinePresentationPlayback';
import { clampCharacterLayer, getCharacterStageBounds } from '../../../lib/presentation';
import { getSceneGroupStyle } from '../canvas/sceneCanvasStyle';
import { SceneLightOverlay } from '../shared/SceneLightOverlay';
import { SceneSwitchFlash } from '../shared/SceneSwitchFlash';
import type { WebExportSettings } from '../video/shared/types';

type PresentedCharacter = {
  config: CharacterPresentation;
  data: CharacterNodeData;
  imageUrl: string;
};

type WebPlaytestMediaLayersProps = {
  playbackActive?: boolean;
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
  inlineActionPlaybackId?: number;
  activeInlineAction: InlinePresentationAction | null;
  completedInlineActions: InlinePresentationAction[];
  emptyText: string;
  onVideoEnded: () => void;
  sceneVisualStyle?: SceneVisualStyle;
  scenePresetEnabled?: boolean;
};

export function WebPlaytestMediaLayers({
  playbackActive = true,
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
  inlineActionPlaybackId = 0,
  completedInlineActions,
  emptyText,
  onVideoEnded,
  sceneVisualStyle,
  scenePresetEnabled = false,
}: WebPlaytestMediaLayersProps) {
  const animationRate = Math.max(0.5, Math.min(2, settings.animationSpeed ?? 1));
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
            autoPlay={playbackActive && (settings.videoAutoPlay || settings.autoAdvance)}
            muted={!settings.soundEnabled || settings.videoAutoPlay}
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
          <div
            className="absolute inset-0 z-10 overflow-hidden pointer-events-none"
            style={{ containerType: 'size' }}
          >
            {presentedCharacters.map(({ config, data, imageUrl }) => {
              const playbackMotion = getCharacterPlaybackMotion(
                config,
                presentation,
                activeInlineAction,
                completedInlineActions,
                presentationVisible,
                presentationExiting,
                settings.layoutMode === 'immersive',
              );
              const inlineAction =
                activeInlineAction?.kind === 'character' &&
                activeInlineAction.timelinePhase !== 'enter' &&
                activeInlineAction.timelinePhase !== 'exit' &&
                activeInlineAction.sourceNodeId === config.sourceNodeId
                  ? activeInlineAction
                  : latestPersistentInlineAction(
                      completedInlineActions,
                      'character',
                      config.sourceNodeId,
                    );
              const inlineState = getInlineTargetState(
                completedInlineActions,
                activeInlineAction,
                'character',
                config.sourceNodeId,
              );
              const inlineDuration = getInlineActionDuration(inlineAction);
              const actionPlaying = inlineAction === activeInlineAction && Boolean(inlineAction);
              const characterStyle: CSSProperties = {
                ...getCharacterStageBounds(config),
                zIndex: clampCharacterLayer(config.layer),
                ...inlineState.style,
                opacity: playbackMotion.opacity * Number(inlineState.style.opacity ?? 1),
                visibility: playbackMotion.visibility,
                transform: `translate(-50%, 0) ${playbackMotion.transform} scale(${config.scale}) scaleX(${config.flipX ? -1 : 1}) ${inlineState.transform}`,
                animation: actionPlaying
                  ? inlineActionAnimation(inlineAction, animationRate)
                  : undefined,

                ...inlineActionCssVars(inlineAction),
                transformOrigin: 'bottom center',
                transitionProperty: 'opacity, transform',
                transitionDuration: `${(actionPlaying ? inlineDuration : playbackMotion.duration) / animationRate}ms`,
                transitionDelay: `${actionPlaying ? 0 : playbackMotion.delay / animationRate}ms`,
                transitionTimingFunction: 'ease-out',
              };
              const switchAction = getInlineSwitchAction(
                'character',
                config.sourceNodeId,
                activeInlineAction,
              );
              const targetImageUrl = switchAction
                ? resolveCharacterImageUrl(data, config, switchAction)
                : undefined;
              const switchDuration = getInlineActionDuration(switchAction) / animationRate;
              const replayAnimation =
                actionPlaying && inlineActionAnimation(inlineAction, animationRate);
              return (
                <Fragment key={`${currentNodeId}-${config.sourceNodeId}`}>
                  <img
                    key={replayAnimation || targetImageUrl ? inlineActionPlaybackId : 'idle'}
                    src={imageUrl}
                    alt={data.characterName}
                    data-character-source-id={config.sourceNodeId}
                    draggable={false}
                    onDragStart={(event) => event.preventDefault()}
                    className="preview-media-safe absolute w-auto object-contain object-bottom"
                    style={
                      targetImageUrl
                        ? ({
                            ...characterStyle,
                            animation: `galInlineSwitchOut ${switchDuration}ms ease both`,
                            '--inline-switch-opacity': characterStyle.opacity,
                          } as CSSProperties)
                        : characterStyle
                    }
                  />
                  {targetImageUrl && (
                    <img
                      key={`switch-${inlineActionPlaybackId}`}
                      src={targetImageUrl}
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                      className="preview-media-safe absolute w-auto object-contain object-bottom"
                      style={
                        {
                          ...characterStyle,
                          animation: `galInlineSwitch ${switchDuration}ms ease both`,
                          '--inline-switch-opacity': characterStyle.opacity,
                        } as CSSProperties
                      }
                    />
                  )}
                </Fragment>
              );
            })}
          </div>
        )}
        <SceneLightOverlay style={sceneVisualStyle} enabled={scenePresetEnabled} />
      </div>
    </div>
  );
}

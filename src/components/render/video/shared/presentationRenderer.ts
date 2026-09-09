import { normalizeGradientStops } from '../../web/webGradientStops';
import { toHex8 } from '../../shared/paint/colorValue';
import type { Node as FlowNode } from '@xyflow/react';

import type {
  CharacterNodeData,
  InlinePresentationAction,
  PresentationMotion,
  SceneNodeData,
  StoryPresentation,
} from '../../../../domain/project';
import {
  CHARACTER_STAGE_MAX_HEIGHT_PERCENT,
  CHARACTER_STAGE_MAX_WIDTH_PERCENT,
  clampCharacterLayer,
  getCharacterEnterDelay,
  getPresentationMotionDuration,
  normalizeStoryPresentation,
} from '../../../../lib/presentation';
import {
  getInlineSwitchAction,
  resolveCharacterImageUrl,
  resolveSceneMedia,
} from '../../../../lib/inlineAssetSwitch';
import { latestPersistentInlineAction } from '../../../../lib/inlinePresentationPlayback';
import { clamp, loadCachedImage } from './mediaUtils';
import type { SharedCanvasSettings } from '../../canvas/canvasSettings';
import {
  getSceneLightOverlayOpacity,
  getSceneVisualFilter,
  resolveSceneLightOverlayUrl,
} from '../../../../lib/sceneVisualStyle';
import sceneSwitchFlashAssetUrl from '../../../../assets/effects/scene-switch-white-flash.png';

type MediaSource = { source: CanvasImageSource; width: number; height: number };

const easeOut = (value: number) => 1 - Math.pow(1 - clamp(value, 0, 1), 3);

const inlineCanvasState = (action: InlinePresentationAction | null | undefined, elapsed = 0) => {
  if (!action || action.action === 'none') {
    return { x: 0, y: 0, scale: 1, alpha: 1, rotation: 0, brightness: 1 };
  }
  const duration = Math.max(0.08, (action.duration || 400) / 1000);
  const progress = clamp(elapsed / duration, 0, 1);
  const repeats = Math.max(1, Math.round(action.repeats || 1));
  const wave = Math.sin(progress * Math.PI * 2 * repeats) * (1 - progress);
  const pulse = Math.sin(progress * Math.PI);
  if (action.action === 'shake-x')
    return {
      x: wave * (action.strength || 10),
      y: 0,
      scale: 1,
      alpha: 1,
      rotation: 0,
      brightness: 1,
    };
  if (action.action === 'shake-y')
    return {
      x: 0,
      y: wave * (action.strength || 10),
      scale: 1,
      alpha: 1,
      rotation: 0,
      brightness: 1,
    };
  if (action.action === 'translate') {
    return {
      x: (action.offsetX || action.strength || 0) * easeOut(progress),
      y: (action.offsetY || 0) * easeOut(progress),
      scale: 1,
      alpha: 1,
      rotation: 0,
      brightness: 1,
    };
  }
  if (action.action === 'translate-x')
    return {
      x: (action.offsetX || action.strength || 0) * easeOut(progress),
      y: 0,
      scale: 1,
      alpha: 1,
      rotation: 0,
      brightness: 1,
    };
  if (action.action === 'translate-y')
    return {
      x: 0,
      y: (action.offsetY || action.strength || 0) * easeOut(progress),
      scale: 1,
      alpha: 1,
      rotation: 0,
      brightness: 1,
    };
  if (action.action === 'scale')
    return {
      x: 0,
      y: 0,
      scale: 1 + ((action.scale || 1.08) - 1) * pulse,
      alpha: 1,
      rotation: 0,
      brightness: 1,
    };
  if (action.action === 'pulse')
    return {
      x: 0,
      y: 0,
      scale: 1,
      alpha: 0.55 + Math.abs(Math.cos(progress * Math.PI * 2 * repeats)) * 0.45,
      rotation: 0,
      brightness: 1,
    };
  if (action.action === 'rotate')
    return {
      x: 0,
      y: 0,
      scale: 1,
      alpha: 1,
      rotation: ((action.strength || 12) * easeOut(progress) * Math.PI) / 180,
      brightness: 1,
    };
  if (action.action === 'opacity') {
    const targetAlpha = clamp((action.strength || 0) / 100, 0, 1);
    return {
      x: 0,
      y: 0,
      scale: 1,
      alpha: 1 + (targetAlpha - 1) * easeOut(progress),
      rotation: 0,
      brightness: 1,
    };
  }
  if (action.action === 'brightness') {
    const targetBrightness = clamp((action.strength || 0) / 100, 0, 1);
    return {
      x: 0,
      y: 0,
      scale: 1,
      alpha: 1,
      rotation: 0,
      brightness: 1 + (targetBrightness - 1) * easeOut(progress),
    };
  }
  return { x: 0, y: 0, scale: 1, alpha: 1, rotation: 0, brightness: 1 };
};

const motionState = (
  motion: PresentationMotion,
  progress: number,
  exiting: boolean,
  width: number,
  height: number,
) => {
  const amount = exiting ? easeOut(progress) : 1 - easeOut(progress);
  let x = 0;
  let y = 0;
  let scale = 1;
  let alpha = 1;

  if (motion.type === 'fade') alpha = 1 - amount;
  if (motion.type === 'slide-left') x = (exiting ? -1 : 1) * width * amount;
  if (motion.type === 'slide-right') x = (exiting ? 1 : -1) * width * amount;
  if (motion.type === 'slide-up') y = (exiting ? -1 : 1) * height * amount;
  if (motion.type === 'slide-down') y = (exiting ? 1 : -1) * height * amount;
  if (motion.type === 'zoom') scale = 1 - 0.18 * amount;

  return { x, y, scale, alpha };
};

const activeMotionState = (
  enter: PresentationMotion,
  exit: PresentationMotion,
  elapsed: number,
  duration: number,
  width: number,
  height: number,
  enterDelayMs = 0,
  exitDelayMs = 0,
) => {
  const enterSeconds = Math.max(0, enter.duration) / 1000;
  const exitSeconds = Math.max(0, exit.duration) / 1000;
  const enterStart = Math.max(0, enterDelayMs) / 1000;
  const exitDelaySeconds = Math.max(0, exitDelayMs) / 1000;
  if (enter.type !== 'none' && enterSeconds > 0 && elapsed < enterStart + enterSeconds) {
    return motionState(
      enter,
      Math.max(0, elapsed - enterStart) / enterSeconds,
      false,
      width,
      height,
    );
  }
  if (
    exit.type !== 'none' &&
    exitSeconds > 0 &&
    elapsed > duration - exitSeconds - exitDelaySeconds
  ) {
    return motionState(
      exit,
      (elapsed - (duration - exitSeconds - exitDelaySeconds)) / exitSeconds,
      true,
      width,
      height,
    );
  }
  return { x: 0, y: 0, scale: 1, alpha: 1 };
};

const drawFitted = (
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  width: number,
  height: number,
  mode: 'cover' | 'contain' | 'stretch',
  offsetX = 0,
  offsetY = 0,
) => {
  if (mode === 'stretch') {
    ctx.drawImage(source, 0, 0, width, height);
    return;
  }
  const ratio =
    mode === 'contain'
      ? Math.min(width / sourceWidth, height / sourceHeight)
      : Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * ratio;
  const drawHeight = sourceHeight * ratio;
  const x = (width - drawWidth) / 2 + (offsetX / 100) * width;
  const y = (height - drawHeight) / 2 + (offsetY / 100) * height;
  ctx.drawImage(source, x, y, drawWidth, drawHeight);
};

export const drawPresentationVisuals = async ({
  ctx,
  node,
  nodes,
  width,
  height,
  media,
  elapsed = 0,
  duration = 0,
  activeInlineAction,
  activeInlineActionElapsed = 0,
  completedSwitchActions = [],
  completedInlineActions = [],
  canvasSettings,
}: {
  ctx: CanvasRenderingContext2D;
  node: FlowNode;
  nodes: FlowNode[];
  width: number;
  height: number;
  media?: MediaSource;
  elapsed?: number;
  duration?: number;
  activeInlineAction?: InlinePresentationAction | null;
  activeInlineActionElapsed?: number;
  completedSwitchActions?: InlinePresentationAction[];
  completedInlineActions?: InlinePresentationAction[];
  canvasSettings?: SharedCanvasSettings;
}) => {
  const presentation = normalizeStoryPresentation(
    node.data?.presentation as StoryPresentation | undefined,
  );
  const scene = presentation.scene;
  let background = media;

  if (!background) {
    const sceneNode = scene ? nodes.find((item) => item.id === scene.sourceNodeId) : undefined;
    const sceneData = sceneNode?.data as SceneNodeData | undefined;
    const selectedSceneImage = scene?.imageId
      ? sceneData?.images?.find((image) => image.id === scene.imageId)
      : undefined;
    const sceneMedia = resolveSceneMedia({
      data: sceneData,
      scene,
      fallbackImageUrl: (node.data?.imageUrl as string | undefined) || selectedSceneImage?.imageUrl,
      fallbackVideoUrl: selectedSceneImage?.videoUrl || (node.data?.videoUrl as string | undefined),
      switchAction: getInlineSwitchAction(
        'scene',
        scene?.sourceNodeId,
        null,
        completedSwitchActions,
      ),
    });
    const imageUrl = sceneMedia.videoUrl ? undefined : sceneMedia.imageUrl;
    if (imageUrl) {
      try {
        const image = await loadCachedImage(imageUrl);
        background = {
          source: image,
          width: image.naturalWidth || width,
          height: image.naturalHeight || height,
        };
      } catch {
        background = undefined;
      }
    }
  }

  if (canvasSettings?.sceneBackgroundVisible && canvasSettings.sceneBackgroundType === 'gradient') {
    const angle = (canvasSettings.sceneBackgroundGradientAngle * Math.PI) / 180;
    const length = Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle));
    const dx = Math.sin(angle) * length / 2;
    const dy = -Math.cos(angle) * length / 2;
    const gradient = ctx.createLinearGradient(
      width / 2 - dx,
      height / 2 - dy,
      width / 2 + dx,
      height / 2 + dy,
    );
    normalizeGradientStops(canvasSettings.sceneBackgroundGradientStops, canvasSettings.sceneBackgroundGradientStart, canvasSettings.sceneBackgroundGradientEnd).forEach(stop => gradient.addColorStop(stop.position / 100, toHex8(stop.color, stop.alpha)));
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = canvasSettings?.sceneBackgroundVisible
      ? canvasSettings.sceneBackgroundColor
      : '#111827';
  }
  ctx.fillRect(0, 0, width, height);
  if (
    canvasSettings?.sceneBackgroundVisible &&
    canvasSettings.sceneBackgroundType === 'image' &&
    canvasSettings.sceneBackgroundImageUrl
  ) {
    try {
      const backgroundImage = await loadCachedImage(canvasSettings.sceneBackgroundImageUrl);
      drawFitted(
        ctx,
        backgroundImage,
        backgroundImage.naturalWidth || width,
        backgroundImage.naturalHeight || height,
        width,
        height,
        'cover',
      );
    } catch {
      /* Keep the selected fallback color. */
    }
  }

  // The video canvas is always a single composited frame. The split-layout scale and
  // offset controls belong to the web/playtest DOM layout and must not shrink the
  // scene above a separately rendered dialogue area in the video preview/export.
  const presentationScaleX = scene?.scale || 1;
  const presentationScaleY = scene?.scale || 1;
  const characterEnterDelay = getCharacterEnterDelay(presentation);
  const sceneExitDuration = getPresentationMotionDuration(scene?.exit);
  ctx.save();
  ctx.translate(0, 0);
  ctx.translate(width / 2, height / 2);
  ctx.scale(presentationScaleX, presentationScaleY);
  ctx.translate(-width / 2, -height / 2);

  if (background) {
    const completedSceneAction = latestPersistentInlineAction(
      completedInlineActions,
      'scene',
      scene?.sourceNodeId,
    );
    const inlineState =
      activeInlineAction?.kind === 'scene' &&
      activeInlineAction.sourceNodeId === scene?.sourceNodeId
        ? inlineCanvasState(activeInlineAction, activeInlineActionElapsed)
        : completedSceneAction
          ? inlineCanvasState(completedSceneAction, Number.POSITIVE_INFINITY)
          : { x: 0, y: 0, scale: 1, alpha: 1, rotation: 0, brightness: 1 };
    const state = scene
      ? activeMotionState(scene.enter, scene.exit, elapsed, duration, width, height, 0, 0)
      : { x: 0, y: 0, scale: 1, alpha: 1 };
    ctx.save();
    ctx.globalAlpha = state.alpha * inlineState.alpha;
    ctx.translate(width / 2 + state.x + inlineState.x, height / 2 + state.y + inlineState.y);
    ctx.rotate(inlineState.rotation);
    ctx.scale(state.scale * inlineState.scale, state.scale * inlineState.scale);
    const sceneNodeForStyle = scene
      ? nodes.find((item) => item.id === scene.sourceNodeId && item.type === 'sceneNode')
      : undefined;
    const sceneDataForStyle = sceneNodeForStyle?.data as SceneNodeData | undefined;
    const scenePresetStyle =
      sceneDataForStyle?.scenePresetEnabled === true ? sceneDataForStyle.visualStyle : undefined;
    const backgroundFilter = getSceneVisualFilter(scenePresetStyle);
    ctx.filter =
      inlineState.brightness === 1
        ? backgroundFilter
        : `${backgroundFilter === 'none' ? '' : `${backgroundFilter} `}brightness(${inlineState.brightness})`.trim() ||
          'none';
    ctx.translate(-width / 2, -height / 2);
    drawFitted(
      ctx,
      background.source,
      background.width || width,
      background.height || height,
      width,
      height,
      canvasSettings?.sceneFit || scene?.cropMode || 'cover',
      0,
      0,
    );
    ctx.restore();

    // A scene switch is a wipe, not a replacement: keep the outgoing scene
    // visible and reveal the incoming image from the left under a travelling
    // white flash. This canvas path is shared by video preview and export.
    const activeSceneSwitch =
      activeInlineAction?.kind === 'scene' &&
      activeInlineAction.action === 'switch' &&
      activeInlineAction.sourceNodeId === scene?.sourceNodeId
        ? activeInlineAction
        : null;
    if (activeSceneSwitch) {
      const sceneNode = scene ? nodes.find((item) => item.id === scene.sourceNodeId) : undefined;
      const targetMedia = resolveSceneMedia({
        data: sceneNode?.data as SceneNodeData | undefined,
        scene,
        switchAction: activeSceneSwitch,
      });
      if (targetMedia.imageUrl) {
        try {
          const targetImage = await loadCachedImage(targetMedia.imageUrl);
          const switchDuration = Math.max(0.18, (activeSceneSwitch.duration || 420) / 1000);
          const progress = easeOut(activeInlineActionElapsed / switchDuration);
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, width * progress, height);
          ctx.clip();
          drawFitted(
            ctx,
            targetImage,
            targetImage.naturalWidth || width,
            targetImage.naturalHeight || height,
            width,
            height,
            canvasSettings?.sceneFit || scene?.cropMode || 'cover',
          );
          ctx.restore();

          const flash = await loadCachedImage(sceneSwitchFlashAssetUrl);
          const flashWidth = width * 0.58;
          const flashHeight = height * 1.56;
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.globalAlpha = Math.sin(progress * Math.PI);
          ctx.drawImage(flash, width * progress - flashWidth * 0.5, (height - flashHeight) / 2, flashWidth, flashHeight);
          ctx.restore();
        } catch {
          // A media load failure must not interrupt the render timeline.
        }
      }
    }
  }

  const characterImages = await Promise.all(
    presentation.characters.map(async (config) => {
      const sourceNode = nodes.find((item) => item.id === config.sourceNodeId);
      if (!sourceNode || sourceNode.type !== 'characterNode') return null;
      const data = sourceNode.data as CharacterNodeData;
      const imageUrl = resolveCharacterImageUrl(
        data,
        config,
        getInlineSwitchAction('character', config.sourceNodeId, null, completedSwitchActions),
      );
      if (!imageUrl) return null;
      try {
        return { config, image: await loadCachedImage(imageUrl) };
      } catch {
        return null;
      }
    }),
  );

  characterImages
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => clampCharacterLayer(a.config.layer) - clampCharacterLayer(b.config.layer))
    .forEach(({ config, image }) => {
      const sourceWidth = image.naturalWidth || width;
      const sourceHeight = image.naturalHeight || height;
      const fit = Math.min(
        (width * (CHARACTER_STAGE_MAX_WIDTH_PERCENT / 100)) / sourceWidth,
        (height * (CHARACTER_STAGE_MAX_HEIGHT_PERCENT / 100)) / sourceHeight,
      );
      const drawWidth = sourceWidth * fit;
      const drawHeight = sourceHeight * fit;
      const baseX = config.position === 'left' ? 0.24 : config.position === 'right' ? 0.76 : 0.5;
      const centerX = width * (baseX + config.offsetX / 1000);
      const bottom = height * (config.offsetY / 1000);
      const state = activeMotionState(
        config.enter,
        config.exit,
        elapsed,
        duration,
        width,
        height,
        characterEnterDelay,
        sceneExitDuration,
      );
      const completedCharacterAction = latestPersistentInlineAction(
        completedInlineActions,
        'character',
        config.sourceNodeId,
      );
      const inlineState =
        activeInlineAction?.kind === 'character' &&
        activeInlineAction.sourceNodeId === config.sourceNodeId
          ? inlineCanvasState(activeInlineAction, activeInlineActionElapsed)
          : completedCharacterAction
            ? inlineCanvasState(completedCharacterAction, Number.POSITIVE_INFINITY)
            : { x: 0, y: 0, scale: 1, alpha: 1, rotation: 0, brightness: 1 };

      ctx.save();
      ctx.globalAlpha = state.alpha * inlineState.alpha;
      ctx.translate(centerX + state.x + inlineState.x, height - bottom + state.y + inlineState.y);
      ctx.rotate(inlineState.rotation);
      ctx.scale(
        config.scale * state.scale * inlineState.scale * (config.flipX ? -1 : 1),
        config.scale * state.scale * inlineState.scale,
      );
      ctx.filter = inlineState.brightness === 1 ? 'none' : `brightness(${inlineState.brightness})`;
      ctx.drawImage(image, -drawWidth / 2, -drawHeight, drawWidth, drawHeight);
      ctx.restore();
    });

  const sceneNodeForLight = scene
    ? nodes.find((item) => item.id === scene.sourceNodeId && item.type === 'sceneNode')
    : undefined;
  const sceneDataForLight = sceneNodeForLight?.data as SceneNodeData | undefined;
  const lightOverlayUrl = resolveSceneLightOverlayUrl(
    sceneDataForLight?.visualStyle,
    sceneDataForLight?.scenePresetEnabled === true,
  );
  if (lightOverlayUrl) {
    try {
      const lightImage = await loadCachedImage(lightOverlayUrl);
      ctx.save();
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = getSceneLightOverlayOpacity(sceneDataForLight?.visualStyle);
      drawFitted(
        ctx,
        lightImage,
        lightImage.naturalWidth || width,
        lightImage.naturalHeight || height,
        width,
        height,
        'cover',
        0,
        0,
      );
      ctx.restore();
    } catch {
      /* Skip unavailable lighting overlays. */
    }
  }

  ctx.restore();
};

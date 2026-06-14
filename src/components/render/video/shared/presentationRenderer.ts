import type { Node as FlowNode } from '@xyflow/react';

import type {
  CharacterNodeData,
  PresentationAnimation,
  PresentationMotion,
  StoryPresentation,
} from '../../../../domain/project';
import { clampCharacterLayer, normalizeStoryPresentation } from '../../../../lib/presentation';
import { clamp, loadCachedImage } from './mediaUtils';

type MediaSource = { source: CanvasImageSource; width: number; height: number };

const easeOut = (value: number) => 1 - Math.pow(1 - clamp(value, 0, 1), 3);

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
) => {
  const enterSeconds = Math.max(0, enter.duration) / 1000;
  const exitSeconds = Math.max(0, exit.duration) / 1000;
  if (enter.type !== 'none' && enterSeconds > 0 && elapsed < enterSeconds) {
    return motionState(enter, elapsed / enterSeconds, false, width, height);
  }
  if (exit.type !== 'none' && exitSeconds > 0 && elapsed > duration - exitSeconds) {
    return motionState(
      exit,
      (elapsed - (duration - exitSeconds)) / exitSeconds,
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
}: {
  ctx: CanvasRenderingContext2D;
  node: FlowNode;
  nodes: FlowNode[];
  width: number;
  height: number;
  media?: MediaSource;
  elapsed?: number;
  duration?: number;
}) => {
  const presentation = normalizeStoryPresentation(
    node.data?.presentation as StoryPresentation | undefined,
  );
  const scene = presentation.scene;
  let background = media;

  if (!background) {
    const sceneNode = scene ? nodes.find((item) => item.id === scene.sourceNodeId) : undefined;
    const sceneData = sceneNode?.data as CharacterNodeData & {
      coverImageUrl?: string;
      images?: Array<{ id: string; imageUrl?: string }>;
    };
    const selectedSceneImage = scene?.imageId
      ? sceneData?.images?.find((image) => image.id === scene.imageId)
      : undefined;
    const imageUrl =
      (node.data?.imageUrl as string | undefined) ||
      selectedSceneImage?.imageUrl ||
      sceneData?.coverImageUrl;
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

  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, width, height);

  const presentationScale = scene?.scale || 1;
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(presentationScale, presentationScale);
  ctx.translate(-width / 2, -height / 2);

  if (background) {
    const state = scene
      ? activeMotionState(scene.enter, scene.exit, elapsed, duration, width, height)
      : { x: 0, y: 0, scale: 1, alpha: 1 };
    ctx.save();
    ctx.globalAlpha = state.alpha;
    ctx.translate(width / 2 + state.x, height / 2 + state.y);
    ctx.scale(state.scale, state.scale);
    ctx.translate(-width / 2, -height / 2);
    drawFitted(
      ctx,
      background.source,
      background.width || width,
      background.height || height,
      width,
      height,
      scene?.cropMode || 'cover',
      scene?.offsetX || 0,
      scene?.offsetY || 0,
    );
    ctx.restore();
  }

  const characterImages = await Promise.all(
    presentation.characters.map(async (config) => {
      const sourceNode = nodes.find((item) => item.id === config.sourceNodeId);
      if (!sourceNode || sourceNode.type !== 'characterNode') return null;
      const data = sourceNode.data as CharacterNodeData;
      const outfit = config.outfitId
        ? data.outfits?.find((item) => item.id === config.outfitId)
        : data.outfits?.find((item) => item.imageUrl);
      const imageUrl = outfit?.imageUrl || data.avatarUrl;
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
      const fit = Math.min((width * 0.72) / sourceWidth, (height * 0.92) / sourceHeight);
      const drawWidth = sourceWidth * fit;
      const drawHeight = sourceHeight * fit;
      const baseX = config.position === 'left' ? 0.24 : config.position === 'right' ? 0.76 : 0.5;
      const centerX = width * (baseX + config.offsetX / 1000);
      const bottom = height * (config.offsetY / 1000);
      const state = activeMotionState(config.enter, config.exit, elapsed, duration, width, height);

      ctx.save();
      ctx.globalAlpha = state.alpha;
      ctx.translate(centerX + state.x, height - bottom + state.y);
      ctx.scale(config.scale * state.scale * (config.flipX ? -1 : 1), config.scale * state.scale);
      ctx.drawImage(image, -drawWidth / 2, -drawHeight, drawWidth, drawHeight);
      ctx.restore();
    });

  ctx.restore();
};

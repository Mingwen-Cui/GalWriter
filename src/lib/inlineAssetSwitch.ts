import type {
  CharacterNodeData,
  CharacterPresentation,
  InlinePresentationAction,
  SceneNodeData,
  ScenePresentation,
} from '../domain/project';
import { createCharacterAppearance, getCharacterAppearanceAssetUrl } from './characterAppearance';

export type SwitchableAssetOption = {
  id: string;
  label: string;
  imageUrl?: string;
  videoUrl?: string;
};

export const isSwitchInlineAction = (
  action?: InlinePresentationAction | null,
): action is InlinePresentationAction & { targetAssetId: string } =>
  Boolean(action?.action === 'switch' && action.targetAssetId);

export const getInlineSwitchAction = (
  kind: 'character' | 'scene',
  sourceNodeId: string | undefined,
  activeAction?: InlinePresentationAction | null,
  completedActions: InlinePresentationAction[] = [],
) => {
  if (!sourceNodeId) return null;
  if (
    isSwitchInlineAction(activeAction) &&
    activeAction.kind === kind &&
    activeAction.sourceNodeId === sourceNodeId
  ) {
    return activeAction;
  }

  for (let index = completedActions.length - 1; index >= 0; index -= 1) {
    const action = completedActions[index];
    if (
      isSwitchInlineAction(action) &&
      action.kind === kind &&
      action.sourceNodeId === sourceNodeId
    ) {
      return action;
    }
  }

  return null;
};

export const characterSwitchOptions = (data: CharacterNodeData): SwitchableAssetOption[] =>
  (data.outfits || [])
    .filter((outfit) => Boolean(outfit.id && outfit.imageUrl))
    .map((outfit, index) => ({
      id: outfit.id,
      label: outfit.name?.trim() || `Outfit ${index + 1}`,
      imageUrl: outfit.imageUrl,
    }));

/**
 * A modular preset has four layers, so it must be drawn as a composite rather
 * than falling through to the clothing PNG. Custom cutouts always take
 * precedence and continue to use their supplied single image.
 */
export const resolveCharacterTemplateAppearance = (
  data: CharacterNodeData,
  config: CharacterPresentation,
  switchAction?: InlinePresentationAction | null,
) => {
  const targetAssetId = isSwitchInlineAction(switchAction)
    ? switchAction.targetAssetId
    : config.outfitId;
  const selectedOutfit = targetAssetId
    ? data.outfits?.find((item) => item.id === targetAssetId)
    : undefined;
  if (
    !data.appearanceTemplate ||
    data.appearancePresetEnabled === false ||
    data.tagSpriteUrl ||
    data.avatarUrl ||
    selectedOutfit?.imageUrl ||
    data.outfits?.some((item) => item.imageUrl)
  ) {
    return null;
  }

  return createCharacterAppearance(
    data.appearanceTemplate.gender === 'male' ? 'male' : 'female',
    data.appearanceTemplate,
  );
};

export const sceneSwitchOptions = (data: SceneNodeData): SwitchableAssetOption[] =>
  (data.images || [])
    .filter((image) => Boolean(image.id && (image.imageUrl || image.videoUrl)))
    .map((image, index) => ({
      id: image.id,
      label: image.name?.trim() || `Scene Media ${index + 1}`,
      imageUrl: image.imageUrl,
      videoUrl: image.videoUrl,
    }));

export const resolveCharacterImageUrl = (
  data: CharacterNodeData,
  config: CharacterPresentation,
  switchAction?: InlinePresentationAction | null,
) => {
  const targetAssetId = isSwitchInlineAction(switchAction)
    ? switchAction.targetAssetId
    : config.outfitId;
  const selectedOutfit = targetAssetId
    ? data.outfits?.find((item) => item.id === targetAssetId)
    : undefined;
  if (selectedOutfit?.imageUrl) return selectedOutfit.imageUrl;

  const userImageUrl =
    data.tagSpriteUrl ||
    data.outfits?.find((item) => item.imageUrl)?.imageUrl ||
    data.avatarUrl;
  if (userImageUrl) return userImageUrl;
  if (data.appearancePresetEnabled === false) return undefined;

  const templateGender = data.appearanceTemplate?.gender === 'male' ? 'male' : 'female';
  const templateAppearance = createCharacterAppearance(templateGender, data.appearanceTemplate);

  return (
    data.appearanceSpriteUrl ||
    getCharacterAppearanceAssetUrl(templateAppearance.outfitAssetPath)
  );
};

export const resolveSceneMedia = ({
  data,
  scene,
  fallbackImageUrl,
  fallbackVideoUrl,
  switchAction,
}: {
  data?: SceneNodeData;
  scene?: ScenePresentation;
  fallbackImageUrl?: string;
  fallbackVideoUrl?: string;
  switchAction?: InlinePresentationAction | null;
}) => {
  const targetAssetId = isSwitchInlineAction(switchAction)
    ? switchAction.targetAssetId
    : scene?.imageId;
  const selected = targetAssetId ? data?.images?.find((image) => image.id === targetAssetId) : null;

  if (selected?.videoUrl) {
    return { imageUrl: undefined, videoUrl: selected.videoUrl };
  }

  return {
    imageUrl: selected?.imageUrl || fallbackImageUrl || data?.coverImageUrl,
    videoUrl: selected?.imageUrl ? undefined : fallbackVideoUrl,
  };
};

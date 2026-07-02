import type {
  CharacterNodeData,
  CharacterPresentation,
  InlinePresentationAction,
  SceneNodeData,
  ScenePresentation,
} from '../domain/project';

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
  const outfit = targetAssetId
    ? data.outfits?.find((item) => item.id === targetAssetId)
    : data.outfits?.find((item) => item.imageUrl);
  return outfit?.imageUrl || data.avatarUrl;
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

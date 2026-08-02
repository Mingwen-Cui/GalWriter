import type { CharacterNodeData, SceneNodeData } from '../../domain/project';

export type AssistantCardDraft = {
  type?: 'story' | 'character' | 'scene' | 'number-condition';
  key?: string;
  chapterTitle?: string;
  batchTitle?: string;
  title?: string;
  text?: string;
  nodeValue?: number;
  characterName?: string;
  identity?: string;
  appearance?: string;
  traits?: string;
  personality?: string;
  habits?: string;
  speechStyle?: string;
  experience?: string;
  relationships?: string;
  notes?: string;
  avatarUrl?: string;
  threeViewUrl?: string;
  tagSpriteUrl?: string;
  outfits?: CharacterNodeData['outfits'];
  features?: string;
  background?: string;
  sceneName?: string;
  time?: string;
  weather?: string;
  visual?: string;
  sound?: string;
  description?: string;
  location?: string;
  items?: string;
  atmosphere?: string;
  other?: string;
  coverImageUrl?: string;
  images?: SceneNodeData['images'];
  libraryItemId?: string;
  threshold?: number;
  ranges?: Array<{ min: number; max: number }>;
  connectTo?: string[];
  branchTargets?: Array<{ target: string; handle?: string; label?: string }>;
  generateImage?: boolean;
  assistantCandidateKind?: 'article-role' | 'article-scene';
  assistantCandidateGroupId?: string;
  assistantTemplateId?: string;
  assistantTemplateName?: string;
  assistantTemplateInstruction?: string;
  assistantTemplateTeachingMode?: 'interactive' | 'lecture';
  assistantTemplateIsUserOwned?: boolean;
};

export type AssistantCardPlacementMode =
  | 'append'
  | 'fill-selected'
  | 'adjacent-revision'
  | 'future-targets'
  | 'bridge-to-target';

export type AssistantCardPlacementOptions = {
  targetNodeId?: string;
  targetNodeIds?: string[];
  /**
   * A library reference already has its full card data locally. Place it as a
   * complete setting card instead of first creating an empty Agent skeleton.
   */
  placeLibraryReferencesDirectly?: boolean;
  /** Keep setup cards immutable while a dependent assistant workflow runs. */
  lockPlacedNodes?: boolean;
  // Internal streaming flag: keep the seven-line placeholder height until
  // the final AI card content has arrived.
  keepAssistantHeightStreaming?: boolean;
};

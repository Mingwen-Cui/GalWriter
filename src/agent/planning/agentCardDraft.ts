export type AssistantCardDraft = {
  type?: 'story' | 'character' | 'scene';
  title?: string;
  text?: string;
  characterName?: string;
  traits?: string;
  personality?: string;
  features?: string;
  background?: string;
  sceneName?: string;
  description?: string;
  location?: string;
  items?: string;
  atmosphere?: string;
  other?: string;
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
};

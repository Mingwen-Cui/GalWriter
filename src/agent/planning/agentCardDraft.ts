export type AssistantCardDraft = {
  type?: 'story' | 'character' | 'scene' | 'number-condition';
  key?: string;
  title?: string;
  text?: string;
  nodeValue?: number;
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
  threshold?: number;
  ranges?: Array<{ min: number; max: number }>;
  connectTo?: string[];
  branchTargets?: Array<{ target: string; handle?: string; label?: string }>;
  generateImage?: boolean;
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

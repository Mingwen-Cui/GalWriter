import type { Dispatch, SetStateAction } from 'react';

import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';

import type { Language } from '../lib/i18n';

export type EdgeStyle = 'step' | 'bezier';
export type AiProvider =
  | 'gemini'
  | 'deepseek'
  | 'openai'
  | 'claude'
  | 'kimi'
  | 'qwen'
  | 'copilot'
  | 'glm'
  | 'custom'
  | (string & {});
export type ScrollMode = 'zoom' | 'pan';
export type ToolbarLayout = 'vertical' | 'horizontal';
export type SelectionMenuLayout = 'horizontal' | 'vertical';
export type EditorTheme = 'light' | 'dark';
export type BubbleStyle = 'glass' | 'flat';
export type StoryTitlePlacement = 'inside' | 'outside-left' | 'outside-right';
export type TtsNarrationMode = 'body' | 'title' | 'all';
export type MiniMapPosition = 'left' | 'right';
export type TtsProvider =
  | 'system'
  | 'youdao'
  | 'openai'
  | 'doubao'
  | 'gemini'
  | 'custom'
  | (string & {});
export type PlaytestLayoutMode = 'classic' | 'immersive';
export type PlaytestChoicesPosition = 'center' | 'aboveText' | 'belowText';
export type StoryCardShape = 'square' | 'rounded-rectangle' | 'diamond';
export type StoryCardVisualShape = StoryCardShape | 'trapezoid' | 'hexagon' | 'circle';
export type MediaObjectFit = 'cover' | 'contain' | 'fill' | 'playtest';
export type BatchReplaceScope = 'selected' | 'all' | 'group';
export type PlotDetailLevel = 'brief' | 'standard' | 'detailed';
export type AIActionType =
  | 'continue'
  | 'creative'
  | 'rewrite'
  | 'interpolate'
  | 'scene_only'
  | 'dialogue_only';

export interface AIPromptsConfig {
  basePrompt: string;
  continue: string;
  creative: string;
  rewrite: string;
  interpolate: string;
  sceneOnly: string;
  dialogueOnly: string;
  analyzeStructure: string;
  analyzeSuggestions: string;
  analyzeDirection: string;
  analyzeSolution: string;
  analyzeSummary: string;
}

export interface AIButtonsConfig {
  continue: boolean;
  creative: boolean;
  rewrite: boolean;
  interpolate: boolean;
  scene_only: boolean;
  dialogue_only: boolean;
}

export type AssistantMessage = {
  id: string;
  role: 'user' | 'assistant' | 'thought';
  content: string;
  collapsed?: boolean;
  cardPosition?: { x: number; y: number; zoom?: number };
  cardNodeIds?: string[];
  options?: AssistantMessageOption[];
};

export type AssistantMessageOption = {
  id: string;
  label: string;
  value: string;
  description?: string;
};

export type AssistantTask = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: AssistantMessage[];
};

export interface PlaytestSettings {
  playTestDarkMode: boolean;
  playTestChoicesColumns: number;
  playTestVideoAutoPlay: boolean;
  playTestLayoutMode: PlaytestLayoutMode;
  playTestInteractionMode: string;
  playTestTypewriterSpeed: number;
  playTestChoiceDelay: number;
  playTestChoicesPosition: PlaytestChoicesPosition;
  playTestBlurBackground: boolean;
  playTestBlurText: boolean;
  playTestSkipSingleChoicePopup: boolean;
  playTestDimBackground: boolean;
  playTestAutoAdvance: boolean;
  playTestAutoAdvanceDelay: number;
  playTestHideCharacterTags: boolean;
  playTestHideSceneTags: boolean;
}

export interface PlaytestSettingsSetters {
  setPlayTestDarkMode: Dispatch<SetStateAction<boolean>>;
  setPlayTestChoicesColumns: Dispatch<SetStateAction<number>>;
  setPlayTestVideoAutoPlay: Dispatch<SetStateAction<boolean>>;
  setPlayTestLayoutMode: Dispatch<SetStateAction<PlaytestLayoutMode>>;
  setPlayTestInteractionMode: Dispatch<SetStateAction<string>>;
  setPlayTestTypewriterSpeed: Dispatch<SetStateAction<number>>;
  setPlayTestChoiceDelay: Dispatch<SetStateAction<number>>;
  setPlayTestChoicesPosition: Dispatch<SetStateAction<PlaytestChoicesPosition>>;
  setPlayTestBlurBackground: Dispatch<SetStateAction<boolean>>;
  setPlayTestBlurText: Dispatch<SetStateAction<boolean>>;
  setPlayTestSkipSingleChoicePopup: Dispatch<SetStateAction<boolean>>;
  setPlayTestDimBackground: Dispatch<SetStateAction<boolean>>;
  setPlayTestAutoAdvance: Dispatch<SetStateAction<boolean>>;
  setPlayTestAutoAdvanceDelay: Dispatch<SetStateAction<number>>;
  setPlayTestHideCharacterTags: Dispatch<SetStateAction<boolean>>;
  setPlayTestHideSceneTags: Dispatch<SetStateAction<boolean>>;
}

export type PlaytestSettingsState = PlaytestSettings & PlaytestSettingsSetters;

export interface ApiKeySettings {
  customApiKey: string;
  deepseekApiKey: string;
  openaiApiKey: string;
  imageApiKey: string;
  ttsApiKey: string;
}

export type AIProfileKind = 'text' | 'image' | 'voice';
export type CharacterImageMode = 'three-view' | 'transparent-sprite';
export type SceneImageMode = 'storyboard-16:9' | 'follow-api';

export interface TextAIProfile {
  id: string;
  name: string;
  kind: 'text';
  provider: AiProvider;
  apiKey: string;
  apiUrl: string;
  model: string;
  thinkingMode: boolean;
}

export interface ImageAIProfile {
  id: string;
  name: string;
  kind: 'image';
  provider: string;
  apiKey: string;
  apiUrl: string;
  model: string;
  size: string;
  negativePrompt?: string;
  steps?: number;
  cfgScale?: number;
  sampler?: string;
  seed?: number;
  restoreFaces?: boolean;
  enableHr?: boolean;
  hrScale?: number;
  denoisingStrength?: number;
}

export interface VoiceAIProfile {
  id: string;
  name: string;
  kind: 'voice';
  provider: string;
  apiKey: string;
  apiUrl: string;
  model: string;
  voice: string;
  appKey: string;
}

export type SavedAIProfile = TextAIProfile | ImageAIProfile | VoiceAIProfile;

export interface ProjectAIProfilesExport {
  profiles: SavedAIProfile[];
  activeTextProfileId: string | null;
  activeImageProfileId: string | null;
  activeVoiceProfileId: string | null;
  exportedAt: string;
}

export interface ProjectSettings extends PlaytestSettings {
  canvasBg: string;
  edgeStyle: EdgeStyle;
  pasteAsPlainText: boolean;
  showNodeActions: boolean;
  showStats: boolean;
  saveAssistantConversations: boolean;
  opaqueAssistantMessagesInGlass: boolean;
  opaqueFooterInGlass: boolean;
  presetColors: string[];
  showPresetColors: boolean;
  showTitles: boolean;
  storyTitlePlacement: StoryTitlePlacement;
  showLastSavedTime: boolean;
  generateLength: string;
  aiProvider: AiProvider;
  imageApiUrl: string;
  imageModel: string;
  imageSize: string;
  ttsApiUrl: string;
  ttsModel: string;
  ttsVoice: string;
  ttsProvider: TtsProvider;
  ttsNarrationMode: TtsNarrationMode;
  thinkingMode: boolean;
  characterImageMode: CharacterImageMode;
  hideStoryImageButtonWithTags: boolean;
  sceneImageMode: SceneImageMode;
  customAiPromptsEnabled: boolean;
  aiPrompts?: AIPromptsConfig;
  aiButtonsConfig: AIButtonsConfig;
  scrollMode: ScrollMode;
  showMiniMap: boolean;
  miniMapPosition: MiniMapPosition;
  showControls: boolean;
  showHoverButtonAnimations: boolean;
  projectTitle: string;
  toolbarLayout: ToolbarLayout;
  selectionMenuLayout: SelectionMenuLayout;
  language: Language;
  theme: EditorTheme;
  bubbleStyle: BubbleStyle;
}

export interface ProjectSettingsSetters extends PlaytestSettingsSetters {
  setCanvasBg: Dispatch<SetStateAction<string>>;
  setEdgeStyle: Dispatch<SetStateAction<EdgeStyle>>;
  setPasteAsPlainText: Dispatch<SetStateAction<boolean>>;
  setShowNodeActions: Dispatch<SetStateAction<boolean>>;
  setShowStats: Dispatch<SetStateAction<boolean>>;
  setSaveAssistantConversations: Dispatch<SetStateAction<boolean>>;
  setOpaqueAssistantMessagesInGlass: Dispatch<SetStateAction<boolean>>;
  setOpaqueFooterInGlass: Dispatch<SetStateAction<boolean>>;
  setPresetColors: Dispatch<SetStateAction<string[]>>;
  setShowPresetColors: Dispatch<SetStateAction<boolean>>;
  setShowTitles: Dispatch<SetStateAction<boolean>>;
  setStoryTitlePlacement: Dispatch<SetStateAction<StoryTitlePlacement>>;
  setShowLastSavedTime: Dispatch<SetStateAction<boolean>>;
  setGenerateLength: Dispatch<SetStateAction<string>>;
  setTtsNarrationMode: Dispatch<SetStateAction<TtsNarrationMode>>;
  setImageSize: Dispatch<SetStateAction<string>>;
  setCharacterImageMode: Dispatch<SetStateAction<CharacterImageMode>>;
  setHideStoryImageButtonWithTags: Dispatch<SetStateAction<boolean>>;
  setSceneImageMode: Dispatch<SetStateAction<SceneImageMode>>;
  setCustomAiPromptsEnabled: Dispatch<SetStateAction<boolean>>;
  setAiPrompts: Dispatch<SetStateAction<AIPromptsConfig>>;
  setAiButtonsConfig: Dispatch<SetStateAction<AIButtonsConfig>>;
  setScrollMode: Dispatch<SetStateAction<ScrollMode>>;
  setShowMiniMap: Dispatch<SetStateAction<boolean>>;
  setMiniMapPosition: Dispatch<SetStateAction<MiniMapPosition>>;
  setShowControls: Dispatch<SetStateAction<boolean>>;
  setShowHoverButtonAnimations: Dispatch<SetStateAction<boolean>>;
  setProjectTitle: Dispatch<SetStateAction<string>>;
  setToolbarLayout: Dispatch<SetStateAction<ToolbarLayout>>;
  setSelectionMenuLayout: Dispatch<SetStateAction<SelectionMenuLayout>>;
  setLanguage: Dispatch<SetStateAction<Language>>;
  setTheme: Dispatch<SetStateAction<EditorTheme>>;
  setBubbleStyle: Dispatch<SetStateAction<BubbleStyle>>;
}

export interface ImportedProjectSettings extends Partial<
  Omit<ProjectSettings, 'aiPrompts' | 'aiButtonsConfig'>
> {
  aiPrompts?: Partial<AIPromptsConfig>;
  aiButtonsConfig?: Partial<AIButtonsConfig>;
}

export interface ProjectAssetRef {
  url: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'other';
  label?: string;
  mimeType?: string;
  source?: 'embedded' | 'blob' | 'external' | 'project-asset';
}

export type CharacterOutfit = {
  id: string;
  name: string;
  imageUrl?: string;
};

export type SceneImage = {
  id: string;
  name: string;
  imageUrl?: string;
  videoUrl?: string;
  isPanorama?: boolean;
};

export type PresentationAnimation =
  | 'none'
  | 'fade'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'zoom';

export interface PresentationMotion {
  type: PresentationAnimation;
  duration: number;
}

export interface CharacterPresentation {
  sourceNodeId: string;
  linkedByEdge?: boolean;
  outfitId?: string;
  position: 'left' | 'center' | 'right' | 'custom';
  offsetX: number;
  offsetY: number;
  scale: number;
  flipX: boolean;
  layer: number;
  enter: PresentationMotion;
  exit: PresentationMotion;
}

export interface ScenePresentation {
  sourceNodeId: string;
  linkedByEdge?: boolean;
  imageId?: string;
  cropMode: 'cover' | 'contain' | 'stretch';
  scale: number;
  offsetX: number;
  offsetY: number;
  videoStartTime?: number;
  videoEndTime?: number;
  videoLoop?: boolean;
  videoMaxDuration?: number;
  enter: PresentationMotion;
  exit: PresentationMotion;
  previousImageUrl?: string;
  previousVideoUrl?: string;
  previousShowTextOverlay?: boolean;
}

export interface StoryPresentation {
  scene?: ScenePresentation;
  characters: CharacterPresentation[];
}

export interface CharacterPresentationTemplate {
  id: string;
  name: string;
  settings: Omit<CharacterPresentation, 'sourceNodeId' | 'linkedByEdge' | 'outfitId'>;
}

export interface ScenePresentationTemplate {
  id: string;
  name: string;
  settings: Omit<
    ScenePresentation,
    | 'sourceNodeId'
    | 'linkedByEdge'
    | 'imageId'
    | 'previousImageUrl'
    | 'previousVideoUrl'
    | 'previousShowTextOverlay'
  >;
}

export interface PresentationTemplates {
  characters: CharacterPresentationTemplate[];
  scenes: ScenePresentationTemplate[];
}

export interface StoryAudioClip {
  id: string;
  name: string;
  url: string;
  source: 'tts' | 'recording' | 'imported';
  createdAt: number;
  skipped?: boolean;
}

export type HullPoint = {
  x: number;
  y: number;
};

export interface EditorNodeCallbacks {
  onUpdate?: (id: string, data: Record<string, unknown>) => void;
  onAddNode?: (sourceId: string, side: string) => void;
  onDelete?: (id: string) => void;
  onZenMode?: Dispatch<SetStateAction<string | null>>;
  onAIGenerate?: (id: string, action?: AIActionType) => void;
  onAIAnalyze?: (id: string, mode?: string) => Promise<void> | void;
  onGenerateImage?: (id: string) => Promise<void> | void;
  onGenerateSpeech?: (id: string) => Promise<void> | void;
  onGenerateSettingImage?: (id: string, type: 'character' | 'scene') => Promise<void> | void;
  onAddTextToImage?: (id: string) => void;
  onRemoveTextFromImage?: (id: string) => void;
  onExtractMedia?: (id: string) => void;
  onGenerateSettingText?: (id: string, type: 'character' | 'scene') => Promise<void> | void;
  onPlotStructureGenerate?: (params: unknown) => Promise<void> | void;
  onHighlightStoryline?: (id: string) => void;
}

export interface BaseEditorNodeData extends Record<string, unknown>, EditorNodeCallbacks {
  id: string;
  hidden?: boolean;
  locked?: boolean;
  language?: Language;
  theme?: EditorTheme;
  canvasBg?: string;
  showTitles?: boolean;
  storyTitlePlacement?: StoryTitlePlacement;
  showNodeActions?: boolean;
  pasteAsPlainText?: boolean;
  isAILoading?: boolean;
  isHighlighted?: boolean;
  isMinimized?: boolean;
}

export interface StoryNodeData extends BaseEditorNodeData {
  title: string;
  text: string;
  shape: StoryCardVisualShape;
  color: string;
  sizeMode?: 'auto' | 'custom';
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  audioClips?: StoryAudioClip[];
  objectFit?: MediaObjectFit;
  mediaScale?: number;
  mediaOffsetX?: number;
  mediaOffsetY?: number;
  showTextOverlay?: boolean;
  titleHeightAdded?: boolean;
  isRoot?: boolean;
  nodeValue?: number;
  skip?: boolean;
  presentation?: StoryPresentation;
  characterImageMode?: CharacterImageMode;
  hideStoryImageButtonWithTags?: boolean;
}

export interface CharacterNodeData extends BaseEditorNodeData {
  characterName: string;
  traits: string;
  personality?: string;
  features?: string;
  background?: string;
  other?: string;
  avatarUrl?: string;
  outfits?: CharacterOutfit[];
  isGlobal?: boolean;
  showPersonality?: boolean;
  showFeatures?: boolean;
  showBackground?: boolean;
  showOther?: boolean;
  generatedSettingImageId?: string;
}

export interface SceneNodeData extends BaseEditorNodeData {
  sceneName: string;
  description: string;
  location?: string;
  items?: string;
  atmosphere?: string;
  other?: string;
  coverImageUrl?: string;
  images?: SceneImage[];
  isGlobal?: boolean;
  showLocation?: boolean;
  showItems?: boolean;
  showAtmosphere?: boolean;
  showOther?: boolean;
  generatedSettingImageId?: string;
}

export interface AINodeData extends BaseEditorNodeData {
  title?: string;
  result?: string;
}

export interface RegionBackgroundMusic {
  url: string;
  name?: string;
  loop: boolean;
  volume: number;
  fadeIn: number;
  fadeOut: number;
}

export interface BackgroundNodeData extends BaseEditorNodeData {
  title?: string;
  color?: string;
  backgroundMusic?: RegionBackgroundMusic;
}

export interface GroupNodeData extends BaseEditorNodeData {
  title?: string;
  color?: string;
  childIds?: string[];
  gap?: number;
  hullPoints?: HullPoint[];
  backgroundMusic?: RegionBackgroundMusic;
}

export interface TextNodeData extends BaseEditorNodeData {
  content: string;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  isBold?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  initialEditing?: boolean;
}

export type SummaryNodeData = BaseEditorNodeData;

export interface NumberConditionRange {
  id: string;
  min: number;
  max: number;
}

export interface NumberConditionNodeData extends BaseEditorNodeData {
  threshold?: number;
  isReversed?: boolean;
  ranges?: NumberConditionRange[];
}

export interface BatchReplaceNodeData extends BaseEditorNodeData {
  findText?: string;
  replaceText?: string;
  scope?: BatchReplaceScope;
}

export interface RegionStoryItem {
  id: string;
  title: string;
  text: string;
}

export interface PlotStructureNodeData extends BaseEditorNodeData {
  cardCount?: number;
  detailLevel?: PlotDetailLevel;
  direction?: string;
  cachedRegionKey?: string;
  cachedRegionStoryNodes?: RegionStoryItem[];
}

export type EditorNodeData =
  | StoryNodeData
  | CharacterNodeData
  | SceneNodeData
  | AINodeData
  | BackgroundNodeData
  | GroupNodeData
  | TextNodeData
  | SummaryNodeData
  | NumberConditionNodeData
  | BatchReplaceNodeData
  | PlotStructureNodeData;

export type StoryFlowNode = FlowNode<StoryNodeData, 'storyNode'>;
export type CharacterFlowNode = FlowNode<CharacterNodeData, 'characterNode'>;
export type SceneFlowNode = FlowNode<SceneNodeData, 'sceneNode'>;
export type AIFlowNode = FlowNode<AINodeData, 'aiNode'>;
export type BackgroundFlowNode = FlowNode<BackgroundNodeData, 'backgroundNode'>;
export type GroupFlowNode = FlowNode<GroupNodeData, 'groupNode'>;
export type TextFlowNode = FlowNode<TextNodeData, 'textNode'>;
export type SummaryFlowNode = FlowNode<SummaryNodeData, 'summaryNode'>;
export type NumberConditionFlowNode = FlowNode<NumberConditionNodeData, 'numberConditionNode'>;
export type BatchReplaceFlowNode = FlowNode<BatchReplaceNodeData, 'batchReplaceNode'>;
export type PlotStructureFlowNode = FlowNode<PlotStructureNodeData, 'plotStructureNode'>;

export type StoryNode =
  | StoryFlowNode
  | CharacterFlowNode
  | SceneFlowNode
  | AIFlowNode
  | BackgroundFlowNode
  | GroupFlowNode
  | TextFlowNode
  | SummaryFlowNode
  | NumberConditionFlowNode
  | BatchReplaceFlowNode
  | PlotStructureFlowNode;

export interface StoryEdgeData extends Record<string, unknown> {
  label?: string;
}

export type StoryEdge = FlowEdge<StoryEdgeData>;

export interface StoryProject {
  nodes: StoryNode[];
  edges: StoryEdge[];
  settings: ProjectSettings;
  presentationTemplates?: PresentationTemplates;
  assistantTasks?: AssistantTask[];
  activeAssistantTaskId?: string;
  exportedAIProfiles?: ProjectAIProfilesExport;
}

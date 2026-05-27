import type { Dispatch, SetStateAction } from 'react';

import type { Language } from '../lib/i18n';

export type EdgeStyle = 'step' | 'bezier';
export type AiProvider = 'gemini' | 'deepseek' | 'openai';
export type ScrollMode = 'zoom' | 'pan';
export type ToolbarLayout = 'vertical' | 'horizontal';
export type SelectionMenuLayout = 'horizontal' | 'vertical';
export type EditorTheme = 'light' | 'dark';
export type BubbleStyle = 'glass' | 'flat';
export type MiniMapPosition = 'left' | 'right';
export type TtsProvider = 'system' | 'youdao';
export type PlaytestLayoutMode = 'classic' | 'immersive';
export type PlaytestChoicesPosition = 'center' | 'aboveText' | 'belowText';

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

export const defaultAIButtonsConfig: AIButtonsConfig = {
  continue: true,
  creative: true,
  rewrite: true,
  interpolate: true,
  scene_only: true,
  dialogue_only: true,
};

export const defaultAIPrompts: AIPromptsConfig = {
  basePrompt:
    '你是一位专业的互动剧本创作者，正在协助创作一部视觉小说。\n\n前文语境：\n{{contextText}}\n\n当前片段：\n{{currentText}}\n\n',
  continue:
    '请根据前文，自然地续写当前片段，{{generateLength}}。只返回续写内容，不要包含多余说明。',
  creative:
    '请根据前文，提供一种与原文风格不同的创意方向续写，{{generateLength}}。只返回续写内容，不要包含多余说明。',
  rewrite:
    '请对当前片段进行改写，保留核心含义但优化文笔与节奏，{{generateLength}}。只返回改写内容，不要包含多余说明。',
  interpolate:
    '你是一位专业的互动剧本创作者。正在协助补充剧情片段。\n\n前文：\n{{contextText}}\n\n后文：\n{{nextText}}\n\n当前正在补充的片段（可选参考）：\n{{currentText}}\n\n请在前后文之间补充一段承上启下的剧情，{{generateLength}}。只返回补充内容，不要包含多余说明。',
  sceneOnly:
    '请根据前文，只增加场景和环境的描写，不要包含任何人物对话，{{generateLength}}。只返回扩写后的内容，不要包含多余说明。',
  dialogueOnly:
    '请根据前文，只增加人物之间的对话，不要包含场景和动作描写，{{generateLength}}。只返回扩写后的内容，不要包含多余说明。',
  analyzeStructure:
    '你是一位剧本结构分析师。请分析以下剧本片段的剧情结构，并用 "卡片A -> 卡片B -> 卡片C" 的箭头形式清晰地展示剧情推进过程。指出其中的节奏起伏和转折点。\n\n剧本内容：\n{{combinedText}}',
  analyzeSuggestions:
    '你是一位创意策划。请根据以下剧本片段，提供至少3个后续剧情发展的构思建议，要求具有戏剧冲突和意想不到的转折。\n\n剧本内容：\n{{combinedText}}',
  analyzeDirection:
    '你是一位文学导师。请分析以下剧本片段的风格和基调，并为下文的写作提供明确的方向指导（包括遣词造句、氛围营造和人物动机）。\n\n剧本内容：\n{{combinedText}}',
  analyzeSolution:
    '你是一位专业的剧本顾问。以下是剧本片段：\n{{combinedText}}\n\n刚才的分析结果指出了如下问题或要点：\n{{previousResult}}\n\n请针对上述分析指出的问题或要点，提供具体的、可操作的剧本修改方案和对应的解法。直接返回解法建议，不要重复已有内容。',
  analyzeSummary:
    '你是一位资深的剧本编辑和逻辑分析师。以下是剧本中的多个片段，请对它们进行汇总分析，指出其中的逻辑漏洞、文笔风格的连贯性，并给出后续剧情发展的建议。\n\n剧本片段：\n{{combinedText}}\n\n请直接返回分析报告，不要包含多余说明。',
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
}

export type PlaytestSettingsState = PlaytestSettings & PlaytestSettingsSetters;

export interface EditorProjectSettings extends PlaytestSettings {
  canvasBg: string;
  edgeStyle: EdgeStyle;
  customApiKey: string;
  pasteAsPlainText: boolean;
  showNodeActions: boolean;
  showStats: boolean;
  presetColors: string[];
  showTitles: boolean;
  generateLength: string;
  aiProvider: AiProvider;
  deepseekApiKey: string;
  openaiApiKey: string;
  imageApiKey: string;
  imageApiUrl: string;
  imageModel: string;
  imageSize: string;
  ttsApiKey: string;
  ttsApiUrl: string;
  ttsModel: string;
  ttsVoice: string;
  ttsProvider: TtsProvider;
  thinkingMode: boolean;
  aiPrompts: AIPromptsConfig;
  aiButtonsConfig: AIButtonsConfig;
  scrollMode: ScrollMode;
  showMiniMap: boolean;
  miniMapPosition: MiniMapPosition;
  showControls: boolean;
  projectTitle: string;
  toolbarLayout: ToolbarLayout;
  selectionMenuLayout: SelectionMenuLayout;
  language: Language;
  theme: EditorTheme;
  bubbleStyle: BubbleStyle;
}

export interface EditorProjectSettingsSetters extends PlaytestSettingsSetters {
  setCanvasBg: Dispatch<SetStateAction<string>>;
  setEdgeStyle: Dispatch<SetStateAction<EdgeStyle>>;
  setCustomApiKey: Dispatch<SetStateAction<string>>;
  setPasteAsPlainText: Dispatch<SetStateAction<boolean>>;
  setShowNodeActions: Dispatch<SetStateAction<boolean>>;
  setShowStats: Dispatch<SetStateAction<boolean>>;
  setPresetColors: Dispatch<SetStateAction<string[]>>;
  setShowTitles: Dispatch<SetStateAction<boolean>>;
  setGenerateLength: Dispatch<SetStateAction<string>>;
  setAiProvider: Dispatch<SetStateAction<AiProvider>>;
  setDeepseekApiKey: Dispatch<SetStateAction<string>>;
  setOpenaiApiKey: Dispatch<SetStateAction<string>>;
  setImageApiKey: Dispatch<SetStateAction<string>>;
  setImageApiUrl: Dispatch<SetStateAction<string>>;
  setImageModel: Dispatch<SetStateAction<string>>;
  setImageSize: Dispatch<SetStateAction<string>>;
  setTtsApiKey: Dispatch<SetStateAction<string>>;
  setTtsApiUrl: Dispatch<SetStateAction<string>>;
  setTtsModel: Dispatch<SetStateAction<string>>;
  setTtsVoice: Dispatch<SetStateAction<string>>;
  setTtsProvider: Dispatch<SetStateAction<TtsProvider>>;
  setThinkingMode: Dispatch<SetStateAction<boolean>>;
  setAiPrompts: Dispatch<SetStateAction<AIPromptsConfig>>;
  setAiButtonsConfig: Dispatch<SetStateAction<AIButtonsConfig>>;
  setScrollMode: Dispatch<SetStateAction<ScrollMode>>;
  setShowMiniMap: Dispatch<SetStateAction<boolean>>;
  setMiniMapPosition: Dispatch<SetStateAction<MiniMapPosition>>;
  setShowControls: Dispatch<SetStateAction<boolean>>;
  setProjectTitle: Dispatch<SetStateAction<string>>;
  setToolbarLayout: Dispatch<SetStateAction<ToolbarLayout>>;
  setSelectionMenuLayout: Dispatch<SetStateAction<SelectionMenuLayout>>;
  setLanguage: Dispatch<SetStateAction<Language>>;
  setTheme: Dispatch<SetStateAction<EditorTheme>>;
  setBubbleStyle: Dispatch<SetStateAction<BubbleStyle>>;
}

export interface ImportedProjectSettings extends Partial<
  Omit<EditorProjectSettings, 'aiPrompts' | 'aiButtonsConfig'>
> {
  aiPrompts?: Partial<AIPromptsConfig>;
  aiButtonsConfig?: Partial<AIButtonsConfig>;
}

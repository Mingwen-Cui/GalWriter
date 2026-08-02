import type { Edge, Node } from '@xyflow/react';

import type { Language } from '../../../../lib/i18n';
import type { SharedCanvasSettings } from '../../canvas/canvasSettings';
import { drawRenderFrame } from '../../video/preview/frameRenderer';
import { getDialogueBoxLayout } from '../../video/shared/dialogueBoxRenderer';
import type {
  RenderEditableObjectKind,
  RenderStyle,
} from '../../video/shared/types';
import { getVideoTextRenderStyle } from '../../video/shared/videoTextScale';

export type PlaytestRuntimeSettings = {
  choicesColumns: number;
  interactionMode: 'immediate' | 'typewriter';
  typewriterSpeed: number;
  choiceDelay: number;
  blurBackground: boolean;
  blurText: boolean;
  autoAdvanceDelay: number;
};

export type PlaytestRuntimeSettingSetters = {
  setChoicesColumns: (value: number) => void;
  setInteractionMode: (value: PlaytestRuntimeSettings['interactionMode']) => void;
  setTypewriterSpeed: (value: number) => void;
  setChoiceDelay: (value: number) => void;
  setBlurBackground: (value: boolean) => void;
  setBlurText: (value: boolean) => void;
  setAutoAdvanceDelay: (value: number) => void;
};

export function createPlaytestRuntimeSettings({
  choicesColumns,
  interactionMode,
  typewriterSpeed,
  choiceDelay,
  blurBackground,
  blurText,
  autoAdvanceDelay,
}: Omit<PlaytestRuntimeSettings, 'interactionMode'> & { interactionMode: string }): PlaytestRuntimeSettings {
  return {
    choicesColumns,
    interactionMode: interactionMode === 'typewriter' ? 'typewriter' : 'immediate',
    typewriterSpeed,
    choiceDelay,
    blurBackground,
    blurText,
    autoAdvanceDelay,
  };
}

export function applyPlaytestRuntimeSettingsPatch(
  patch: Partial<PlaytestRuntimeSettings>,
  setters: PlaytestRuntimeSettingSetters,
) {
  if (patch.choicesColumns !== undefined) setters.setChoicesColumns(patch.choicesColumns);
  if (patch.interactionMode !== undefined) setters.setInteractionMode(patch.interactionMode);
  if (patch.typewriterSpeed !== undefined) setters.setTypewriterSpeed(patch.typewriterSpeed);
  if (patch.choiceDelay !== undefined) setters.setChoiceDelay(patch.choiceDelay);
  if (patch.blurBackground !== undefined) setters.setBlurBackground(patch.blurBackground);
  if (patch.blurText !== undefined) setters.setBlurText(patch.blurText);
  if (patch.autoAdvanceDelay !== undefined) setters.setAutoAdvanceDelay(patch.autoAdvanceDelay);
}

export type PlaytestCanvasSelection =
  | 'scene'
  | 'background'
  | RenderEditableObjectKind;

export type PlaytestCanvasModel = {
  canvasSettings: SharedCanvasSettings;
  runtimeSettings: PlaytestRuntimeSettings;
  renderStyle: RenderStyle;
  previewRenderStyle: RenderStyle;
  previewNodes: Node[];
  currentNode: Node;
  currentNodeIndex: number;
  outgoingEdges: Edge[];
  choiceTargets: Node[];
  showChoices: boolean;
  renderWidth: number;
  renderHeight: number;
  dialogue: ReturnType<typeof getDialogueBoxLayout>;
};

export function createPlaytestCanvasModel({
  canvasSettings,
  runtimeSettings,
  renderStyle,
  nodes,
  edges,
  nodeIndex,
  fallbackTitle,
  fallbackBody,
}: {
  canvasSettings: SharedCanvasSettings;
  runtimeSettings: PlaytestRuntimeSettings;
  renderStyle: RenderStyle;
  nodes: Node[];
  edges: Edge[];
  nodeIndex: number;
  fallbackTitle: string;
  fallbackBody: string;
}): PlaytestCanvasModel {
  const storyNodes = nodes.filter(
    (node) =>
      node.type === 'storyNode' ||
      typeof node.data?.text === 'string' ||
      typeof node.data?.title === 'string',
  );
  const fallbackNode: Node = {
    id: 'playtest-settings-preview',
    type: 'storyNode',
    position: { x: 0, y: 0 },
    data: { title: fallbackTitle, text: fallbackBody },
  };
  const previewNodes = storyNodes.length ? storyNodes : [fallbackNode];
  const currentNodeIndex = Math.min(Math.max(0, nodeIndex), previewNodes.length - 1);
  const currentNode = previewNodes[currentNodeIndex] || fallbackNode;
  const outgoingEdges = edges.filter((edge) => edge.source === currentNode.id);
  const targetNodes = outgoingEdges
    .map((edge) => previewNodes.find((node) => node.id === edge.target))
    .filter((node): node is Node => Boolean(node));
  const choiceTargets = targetNodes.length ? targetNodes : previewNodes.slice(0, 3);
  const longSide = Math.max(canvasSettings.canvasWidth, canvasSettings.canvasHeight);
  const renderScale = Math.min(1, 1920 / Math.max(1, longSide));
  const renderWidth = Math.max(320, Math.round(canvasSettings.canvasWidth * renderScale));
  const renderHeight = Math.max(180, Math.round(canvasSettings.canvasHeight * renderScale));
  const previewRenderStyle = getVideoTextRenderStyle(renderStyle, 'webRatio', renderHeight);
  const dialogue = getDialogueBoxLayout(
    renderWidth,
    renderHeight,
    previewRenderStyle,
  );

  return {
    canvasSettings,
    runtimeSettings,
    renderStyle,
    previewRenderStyle,
    previewNodes,
    currentNode,
    currentNodeIndex,
    outgoingEdges,
    choiceTargets,
    showChoices: choiceTargets.length > 1 || !canvasSettings.skipSingleChoicePopup,
    renderWidth,
    renderHeight,
    dialogue,
  };
}

export async function drawPlaytestCanvasModelFrame({
  context,
  model,
  language,
  elapsed,
}: {
  context: CanvasRenderingContext2D;
  model: PlaytestCanvasModel;
  language: Language;
  elapsed: number;
}) {
  const {
    canvasSettings,
    currentNode,
    previewNodes,
    renderHeight,
    renderStyle,
    renderWidth,
  } = model;
  context.clearRect(0, 0, renderWidth, renderHeight);
  paintPlaytestCanvasBackground(context, renderWidth, renderHeight, canvasSettings);
  await drawRenderFrame({
    ctx: context,
    node: currentNode,
    width: renderWidth,
    height: renderHeight,
    renderStyle,
    videoTextScaleMode: 'webRatio',
    animationLeadSeconds: 0,
    isZh: language === 'zh',
    elapsed,
    duration: 3,
    forceFinalText: elapsed >= 2.35,
    nodes: previewNodes,
    hideCharacterTags: canvasSettings.hideCharacterTags,
    hideSceneTags: canvasSettings.hideSceneTags,
    canvasSettings,
  });
}

export function getPlaytestCanvasSelectionBox(
  model: PlaytestCanvasModel,
  selection: PlaytestCanvasSelection,
) {
  if (selection === 'scene' || selection === 'background' || selection === 'nameplate') {
    return null;
  }
  const { dialogue, renderHeight: height, renderWidth: width } = model;
  const y =
    selection === 'dialogBox'
      ? dialogue.y
      : selection === 'title'
        ? dialogue.y + dialogue.height * 0.08
        : dialogue.y + dialogue.height * 0.36;
  const boxHeight =
    selection === 'dialogBox'
      ? dialogue.height
      : selection === 'title'
        ? dialogue.height * 0.24
        : dialogue.height * 0.52;
  const inset = selection === 'dialogBox' ? 0 : dialogue.paddingX ?? dialogue.padding;
  return {
    left: `${((dialogue.x + inset) / width) * 100}%`,
    top: `${(y / height) * 100}%`,
    width: `${((dialogue.width - inset * 2) / width) * 100}%`,
    height: `${(boxHeight / height) * 100}%`,
  };
}

export function resolvePlaytestCanvasSelection(
  model: PlaytestCanvasModel,
  point: { x: number; y: number },
): PlaytestCanvasSelection {
  const { canvasSettings, dialogue } = model;
  const insideDialogue =
    point.x >= dialogue.x &&
    point.x <= dialogue.x + dialogue.width &&
    point.y >= dialogue.y &&
    point.y <= dialogue.y + dialogue.height;
  if (!insideDialogue) return canvasSettings.layoutMode === 'classic' ? 'scene' : 'dialogBox';
  const relativeY = (point.y - dialogue.y) / Math.max(1, dialogue.height);
  return relativeY <= 0.33 ? 'title' : 'body';
}

function paintPlaytestCanvasBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  settings: SharedCanvasSettings,
) {
  if (settings.sceneBackgroundType === 'gradient') {
    const angle = ((settings.sceneBackgroundGradientAngle - 90) * Math.PI) / 180;
    const length = Math.hypot(width, height) / 2;
    const centerX = width / 2;
    const centerY = height / 2;
    const gradient = context.createLinearGradient(
      centerX - Math.cos(angle) * length,
      centerY - Math.sin(angle) * length,
      centerX + Math.cos(angle) * length,
      centerY + Math.sin(angle) * length,
    );
    gradient.addColorStop(0, settings.sceneBackgroundGradientStart);
    gradient.addColorStop(1, settings.sceneBackgroundGradientEnd);
    context.fillStyle = gradient;
  } else {
    context.fillStyle = settings.sceneBackgroundColor || '#020617';
  }
  context.fillRect(0, 0, width, height);
}

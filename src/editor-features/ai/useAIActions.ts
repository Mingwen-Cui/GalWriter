import type { Edge, Node } from '@xyflow/react';
import { useCallback } from 'react';

import type { AIPromptsConfig } from '../../editor-state/editorConfig';
import type { AiProvider, CharacterNodeData, SceneNodeData } from '../../domain/project';
import { createAIClient, type AITextResult } from '../../editor-services/aiClient';
import { formatCharacterNodeText, formatSceneNodeText } from '../../lib/export';
import type { AIActionType } from '../../domain/project';

interface UseAIActionsParams {
  nodes: Node[];
  edges: Edge[];
  aiPrompts: AIPromptsConfig;
  aiProvider: AiProvider;
  deepseekApiKey: string;
  openaiApiKey: string;
  customApiKey: string;
  thinkingMode: boolean;
  generateLength: string;
  handleUpdateNode: (nodeId: string, updates: Record<string, unknown>) => void;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setThinkingContent: React.Dispatch<React.SetStateAction<string | null>>;
}

const THINKING_DISPLAY_MS = 8000;

const showReasoningBriefly = (
  reasoning: string | undefined,
  setThinkingContent: React.Dispatch<React.SetStateAction<string | null>>,
) => {
  if (!reasoning) return;
  setThinkingContent(reasoning);
  window.setTimeout(() => setThinkingContent(null), THINKING_DISPLAY_MS);
};

export const useAIActions = ({
  nodes,
  edges,
  aiPrompts,
  aiProvider,
  deepseekApiKey,
  openaiApiKey,
  customApiKey,
  thinkingMode,
  generateLength,
  handleUpdateNode,
  setNodes,
  setThinkingContent,
}: UseAIActionsParams) => {
  const buildCharacterContext = useCallback(
    (nodeId: string): string => {
      const globalCharacters = nodes.filter(
        (node) => node.type === 'characterNode' && node.data?.isGlobal !== false,
      );

      const pathNodes = new Set<string>();
      let currentId: string | null = nodeId;

      while (currentId && !pathNodes.has(currentId)) {
        pathNodes.add(currentId);
        const incomingEdge = edges.find((edge) => edge.target === currentId);
        currentId = incomingEdge ? incomingEdge.source : null;
      }

      const linkedCharacters = nodes.filter(
        (node) =>
          node.type === 'characterNode' &&
          node.data?.isGlobal === false &&
          edges.some((edge) => edge.source === node.id && pathNodes.has(edge.target)),
      );

      const activeCharacters = Array.from(new Set([...globalCharacters, ...linkedCharacters]));
      if (activeCharacters.length === 0) return '';

      return (
        '\n【已知角色设定】\n' +
        activeCharacters
          .map(
            (character) =>
              `角色：${character.data.characterName || '未命名'}\n设定：${formatCharacterNodeText(character.data as Record<string, unknown>)}`,
          )
          .join('\n---\n') +
        '\n'
      );
    },
    [edges, nodes],
  );

  const buildSceneContext = useCallback(
    (nodeId: string): string => {
      const globalScenes = nodes.filter(
        (node) => node.type === 'sceneNode' && node.data?.isGlobal !== false,
      );

      const pathNodes = new Set<string>();
      let currentId: string | null = nodeId;

      while (currentId && !pathNodes.has(currentId)) {
        pathNodes.add(currentId);
        const incomingEdge = edges.find((edge) => edge.target === currentId);
        currentId = incomingEdge ? incomingEdge.source : null;
      }

      const linkedScenes = nodes.filter(
        (node) =>
          node.type === 'sceneNode' &&
          node.data?.isGlobal === false &&
          edges.some((edge) => edge.source === node.id && pathNodes.has(edge.target)),
      );

      const activeScenes = Array.from(new Set([...globalScenes, ...linkedScenes]));
      if (activeScenes.length === 0) return '';

      return (
        '\n【已知场景设定】\n' +
        activeScenes
          .map(
            (scene) =>
              `场景：${scene.data.sceneName || '未命名'}\n设定：${formatSceneNodeText(scene.data as Record<string, unknown>)}`,
          )
          .join('\n---\n') +
        '\n'
      );
    },
    [edges, nodes],
  );

  const buildContextText = useCallback(
    (nodeId: string): string => {
      let currentId: string | null = nodeId;
      const pathHistory: string[] = [];
      const visited = new Set<string>();

      while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        const incomingEdge = edges.find((edge) => edge.target === currentId);
        const parentNode = incomingEdge
          ? nodes.find((node) => node.id === incomingEdge.source)
          : null;

        if (parentNode && parentNode.type === 'storyNode') {
          const label =
            typeof incomingEdge?.data?.label === 'string'
              ? `[选择: ${incomingEdge.data.label}]`
              : '';
          pathHistory.unshift(`${parentNode.data.text} ${label}`);
        }

        currentId = parentNode ? parentNode.id : null;
      }

      return pathHistory.join('\n\n');
    },
    [edges, nodes],
  );

  const buildPrompt = useCallback(
    (action: AIActionType, contextText: string, currentText: string, nextText?: string): string => {
      const base = aiPrompts.basePrompt
        .replace('{{contextText}}', contextText || '')
        .replace('{{currentText}}', currentText || '');

      let specificPrompt = '';
      if (action === 'continue') specificPrompt = aiPrompts.continue;
      else if (action === 'creative') specificPrompt = aiPrompts.creative;
      else if (action === 'rewrite') specificPrompt = aiPrompts.rewrite;
      else if (action === 'scene_only') specificPrompt = aiPrompts.sceneOnly;
      else if (action === 'dialogue_only') specificPrompt = aiPrompts.dialogueOnly;
      else {
        specificPrompt = aiPrompts.interpolate
          .replace('{{contextText}}', contextText || '')
          .replace('{{currentText}}', currentText || '')
          .replace('{{nextText}}', nextText || '');
        return specificPrompt.replace('{{generateLength}}', generateLength);
      }

      return base + specificPrompt.replace('{{generateLength}}', generateLength);
    },
    [aiPrompts, generateLength],
  );

  const aiClient = createAIClient({
    provider: aiProvider,
    geminiApiKey: customApiKey,
    deepseekApiKey,
    openaiApiKey,
    thinkingMode,
  });

  const callAIForTextResult = useCallback(
    async (prompt: string): Promise<AITextResult> => aiClient.generateText(prompt),
    [aiClient],
  );

  const callAIForText = useCallback(
    async (prompt: string): Promise<string> => {
      const result = await callAIForTextResult(prompt);
      if (thinkingMode) {
        showReasoningBriefly(result.reasoning, setThinkingContent);
      }
      return result.content;
    },
    [callAIForTextResult, setThinkingContent, thinkingMode],
  );

  const handleAIGenerate = useCallback(
    async (nodeId: string, action: AIActionType): Promise<AITextResult> => {
      const targetNode = nodes.find((node) => node.id === nodeId);
      if (!targetNode) {
        return { content: '' };
      }

      const contextText = buildContextText(nodeId);
      const charContext = buildCharacterContext(nodeId);
      const sceneContext = buildSceneContext(nodeId);
      const currentText = ((targetNode.data.text as string) || '').trim();

      let nextText = '';
      if (action === 'interpolate') {
        const outgoingEdges = edges.filter((edge) => edge.source === nodeId);
        const children = outgoingEdges
          .map((edge) => nodes.find((node) => node.id === edge.target))
          .filter(Boolean);
        nextText = children.map((node) => node?.data.text).join('\n\n---\n\n');
      }

      const settingContext = [charContext, sceneContext].filter(Boolean).join('\n');
      const finalContextText = settingContext ? `${settingContext}\n\n${contextText}` : contextText;
      const prompt = buildPrompt(action, finalContextText, currentText, nextText);
      const result = await callAIForTextResult(prompt);

      showReasoningBriefly(result.reasoning, setThinkingContent);

      const updatedText = currentText ? `${currentText}\n\n${result.content}` : result.content;
      handleUpdateNode(nodeId, { text: updatedText });

      return result;
    },
    [
      buildCharacterContext,
      buildContextText,
      buildPrompt,
      buildSceneContext,
      callAIForTextResult,
      edges,
      handleUpdateNode,
      nodes,
      setThinkingContent,
    ],
  );

  const handleAIAnalyze = useCallback(
    async (nodeId: string, mode: string = 'summary') => {
      const aiNode = nodes.find((node) => node.id === nodeId);
      if (!aiNode) return;

      const incomingEdges = edges.filter((edge) => edge.target === nodeId);
      const inputNodes = incomingEdges
        .map((edge) => nodes.find((node) => node.id === edge.source))
        .filter(Boolean);

      if (inputNodes.length === 0) {
        throw new Error('请先将剧本节点连接到 AI 分析节点的左侧输入点');
      }

      const combinedText = inputNodes
        .map((node) => `【${node?.data.title}】\n${node?.data.text}`)
        .join('\n\n---\n\n');

      const previousResult = (aiNode.data.result as string) || '';
      const normalizedMode =
        mode === 'structure' ||
        mode === 'suggestions' ||
        mode === 'direction' ||
        mode === 'solution'
          ? mode
          : 'summary';
      const aiResult = await aiClient.analyze({
        mode: normalizedMode,
        combinedText,
        prompts: aiPrompts,
        previousResult,
      });
      showReasoningBriefly(aiResult.reasoning, setThinkingContent);

      let finalResult = aiResult.content;
      if (mode === 'solution') {
        finalResult = `${previousResult}\n\n---\n\n### 💡 修改解法\n\n${aiResult.content}`;
      }

      handleUpdateNode(nodeId, { result: finalResult });

      const outgoingEdges = edges.filter((edge) => edge.source === nodeId);
      if (outgoingEdges.length > 0) {
        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            const edge = outgoingEdges.find((candidate) => candidate.target === node.id);
            if (!edge || node.type !== 'storyNode') return node;

            const oldText = ((node.data.text as string) || '').trim();
            const divider = oldText ? '<br/><br/><hr/><br/>' : '';
            const modeLabel =
              mode === 'structure'
                ? '结构分析'
                : mode === 'suggestions'
                  ? '构思建议'
                  : mode === 'direction'
                    ? '写作方向'
                    : mode === 'solution'
                      ? '修改解法'
                      : '汇总报告';

            const formattedResult = aiResult.content
              .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
              .replace(/\n/g, '<br/>');

            return {
              ...node,
              data: {
                ...node.data,
                text: `${oldText}${divider}<strong style="color: #6366f1;">💡 AI ${modeLabel}</strong><br/>${formattedResult}`,
              },
            };
          }),
        );
      }
    },
    [aiClient, aiPrompts, edges, handleUpdateNode, nodes, setNodes, setThinkingContent],
  );

  const generateSetting = useCallback(
    async (nodeId: string, type: 'character' | 'scene') => {
      const targetNode = nodes.find((node) => node.id === nodeId);
      if (!targetNode) return;

      const request =
        type === 'character'
          ? ({
              type,
              data: targetNode.data as CharacterNodeData,
              language: 'zh',
            } as const)
          : ({
              type,
              data: targetNode.data as SceneNodeData,
              language: 'zh',
            } as const);

      const result = await aiClient.generateSetting(request);
      showReasoningBriefly(result.result.reasoning, setThinkingContent);
      if (Object.keys(result.updates).length > 0) {
        handleUpdateNode(nodeId, result.updates);
      }
      return result;
    },
    [aiClient, handleUpdateNode, nodes, setThinkingContent],
  );

  return {
    buildCharacterContext,
    buildSceneContext,
    buildContextText,
    buildPrompt,
    callAIForText,
    callAIForTextResult,
    generateSetting,
    handleAIGenerate,
    handleAIAnalyze,
  };
};

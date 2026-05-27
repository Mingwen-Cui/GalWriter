import type { Edge, Node } from '@xyflow/react';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

import type { TtsProvider } from '../../editor-state/editorConfig';
import { generateSpeechAudio, htmlToSpeechText } from '../../lib/tts';

interface UseSelectionActionsParams {
  nodes: Node[];
  edges: Edge[];
  language: 'zh' | 'en';
  ttsLoading: boolean;
  ttsProvider: TtsProvider;
  ttsApiKey: string;
  ttsApiUrl: string;
  ttsModel: string;
  ttsVoice: string;
  nodeClipboard: { nodes: Node[]; edges: Edge[] } | null;
  setNodeClipboard: Dispatch<SetStateAction<{ nodes: Node[]; edges: Edge[] } | null>>;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  setTtsLoading: Dispatch<SetStateAction<boolean>>;
  getCenterPosition: () => { x: number; y: number };
  showToast: (message: string) => void;
}

export const useSelectionActions = ({
  nodes,
  edges,
  language,
  ttsLoading,
  ttsProvider,
  ttsApiKey,
  ttsApiUrl,
  ttsModel,
  ttsVoice,
  nodeClipboard,
  setNodeClipboard,
  setNodes,
  setEdges,
  setTtsLoading,
  getCenterPosition,
  showToast,
}: UseSelectionActionsParams) => {
  const handleCopy = useCallback(() => {
    const selectedNodes = nodes.filter((node) => node.selected);
    if (selectedNodes.length === 0) return;

    const selectedNodeIds = new Set(selectedNodes.map((node) => node.id));
    const selectedEdges = edges.filter(
      (edge) => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target),
    );

    setNodeClipboard({ nodes: selectedNodes, edges: selectedEdges });
    showToast(
      language === 'zh'
        ? `已复制${selectedNodes.length} 个节点`
        : `${selectedNodes.length} nodes copied`,
    );
  }, [edges, language, nodes, setNodeClipboard, showToast]);

  const handlePaste = useCallback(async () => {
    if (nodeClipboard && nodeClipboard.nodes.length > 0) {
      const idMap: Record<string, string> = {};
      const center = getCenterPosition();

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      nodeClipboard.nodes.forEach((node) => {
        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + (node.measured?.width || 300));
        maxY = Math.max(maxY, node.position.y + (node.measured?.height || 200));
      });
      const groupCenterX = (minX + maxX) / 2;
      const groupCenterY = (minY + maxY) / 2;

      const offsetX = center.x - groupCenterX;
      const offsetY = center.y - groupCenterY;

      const newNodes = nodeClipboard.nodes.map((node) => {
        const newId = uuidv4();
        idMap[node.id] = newId;
        return {
          ...node,
          id: newId,
          position: { x: node.position.x + offsetX, y: node.position.y + offsetY },
          selected: true,
          data: {
            ...node.data,
            id: newId,
            isRoot: false,
          },
        };
      });

      const newEdges = nodeClipboard.edges.map((edge) => ({
        ...edge,
        id: uuidv4(),
        source: idMap[edge.source],
        target: idMap[edge.target],
      }));

      setNodes((nds) => [...nds.map((node) => ({ ...node, selected: false })), ...newNodes]);
      setEdges((eds) => [...eds, ...newEdges]);
      return;
    }

    try {
      if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
        showToast(
          language === 'zh'
            ? '当前环境不支持直接读取剪贴板，请使用快捷键 Ctrl+V'
            : 'Clipboard reading is not supported, please use Ctrl+V',
        );
        return;
      }
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        const center = getCenterPosition();
        const newId = uuidv4();
        const newNode: Node = {
          id: newId,
          type: 'storyNode',
          position: { x: center.x - 150, y: center.y - 100 },
          style: { width: 300, height: 200 },
          data: {
            id: newId,
            title: '粘贴卡片',
            shape: 'square',
            color: '#ffffff',
            text: text.trim(),
          },
        };
        setNodes((nds) => [...nds.map((node) => ({ ...node, selected: false })), newNode]);
      }
    } catch (error) {
      console.warn('Failed to read system clipboard', error);
    }
  }, [getCenterPosition, language, nodeClipboard, setEdges, setNodes, showToast]);

  const deleteSelected = useCallback(() => {
    const selectedNodes = nodes.filter((node) => node.selected);
    const selectedEdges = edges.filter((edge) => edge.selected);

    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;

    const nodeIdsToDelete = new Set(
      selectedNodes.filter((node) => !node.data?.isRoot).map((node) => node.id),
    );
    const edgeIdsToDelete = new Set(selectedEdges.map((edge) => edge.id));

    if (nodeIdsToDelete.size === 0 && edgeIdsToDelete.size === 0) {
      if (selectedNodes.length > 0) {
        showToast(
          language === 'zh'
            ? '起点节点受保护，无法删除'
            : 'Root node is protected and cannot be deleted',
        );
      }
      return;
    }

    setNodes((nds) => nds.filter((node) => !nodeIdsToDelete.has(node.id)));
    setEdges((eds) =>
      eds.filter(
        (edge) =>
          !edgeIdsToDelete.has(edge.id) &&
          !nodeIdsToDelete.has(edge.source) &&
          !nodeIdsToDelete.has(edge.target),
      ),
    );

    const totalDeleted = nodeIdsToDelete.size + edgeIdsToDelete.size;
    showToast(language === 'zh' ? `已删除${totalDeleted} 个项目` : `Deleted ${totalDeleted} items`);
  }, [edges, language, nodes, setEdges, setNodes, showToast]);

  const hideSelected = useCallback(() => {
    const selectedNodeIds = nodes.filter((node) => node.selected).map((node) => node.id);
    if (selectedNodeIds.length === 0) return;

    const selectedIdSet = new Set(selectedNodeIds);
    setNodes((nds) =>
      nds.map((node) => {
        if (!selectedIdSet.has(node.id)) return node;

        return {
          ...node,
          selected: false,
          data: {
            ...node.data,
            hidden: true,
          },
        };
      }),
    );

    showToast(
      language === 'zh'
        ? `已隐藏${selectedNodeIds.length} 个卡片`
        : `${selectedNodeIds.length} cards hidden`,
    );
  }, [language, nodes, setNodes, showToast]);

  const handleGenerateSelectedSpeech = useCallback(async () => {
    if (ttsLoading) return;
    const storyNodes = nodes
      .filter((node) => node.selected && node.type === 'storyNode')
      .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);

    if (storyNodes.length === 0) {
      showToast(
        language === 'zh' ? '请先框选需要朗读的剧情卡片' : 'Select story cards to narrate first',
      );
      return;
    }

    setTtsLoading(true);
    try {
      for (let index = 0; index < storyNodes.length; index += 1) {
        const node = storyNodes[index];
        const titleText = htmlToSpeechText(String(node.data.title || ''));
        const bodyText = htmlToSpeechText(String(node.data.text || ''));
        const speechText = [titleText, bodyText].filter(Boolean).join('\n\n').trim();
        if (!speechText) continue;

        showToast(
          language === 'zh'
            ? `正在生成朗读音频 ${index + 1}/${storyNodes.length}`
            : `Generating narration ${index + 1}/${storyNodes.length}`,
        );

        const audio = await generateSpeechAudio(speechText, {
          provider: ttsProvider,
          apiUrl: ttsApiUrl,
          apiKey: ttsApiKey,
          appKey: ttsModel,
          appSecret: ttsApiKey,
          model: ttsModel,
          voice: ttsVoice,
        });

        setNodes((nds) =>
          nds.map((current) =>
            current.id === node.id
              ? {
                  ...current,
                  data: {
                    ...current.data,
                    audioUrl: audio.url,
                    ttsGenerated: true,
                  },
                }
              : current,
          ),
        );
      }

      showToast(
        language === 'zh' ? '朗读音频已生成并关联到卡片' : 'Narration audio generated and attached',
      );
    } catch (error: any) {
      console.error('TTS generation failed:', error);
      alert(
        `${language === 'zh' ? '朗读音频生成失败' : 'Narration generation failed'}: ${error.message || 'Unknown error'}`,
      );
    } finally {
      setTtsLoading(false);
    }
  }, [
    language,
    nodes,
    setNodes,
    setTtsLoading,
    showToast,
    ttsApiKey,
    ttsApiUrl,
    ttsLoading,
    ttsModel,
    ttsProvider,
    ttsVoice,
  ]);

  const unhideAllNodes = useCallback(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: { ...node.data, hidden: false },
      })),
    );
    showToast(language === 'zh' ? '已恢复所有隐藏卡片' : 'All cards restored');
  }, [language, setNodes, showToast]);

  return {
    handleCopy,
    handlePaste,
    deleteSelected,
    hideSelected,
    handleGenerateSelectedSpeech,
    unhideAllNodes,
  };
};

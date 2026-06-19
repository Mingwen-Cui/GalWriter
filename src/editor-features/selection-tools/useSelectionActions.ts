import type { Edge, Node } from '@xyflow/react';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

import type { TtsNarrationMode, TtsProvider } from '../../editor-state/editorConfig';
import { ttsService } from '../../editor-services/ttsService';

import type { Language } from '../../lib/i18n';

interface UseSelectionActionsParams {
  nodes: Node[];
  edges: Edge[];
  language: Language;
  ttsLoading: boolean;
  ttsProvider: TtsProvider;
  ttsApiKey: string;
  ttsApiUrl: string;
  ttsAppKey: string;
  ttsModel: string;
  ttsVoice: string;
  ttsNarrationMode: TtsNarrationMode;
  nodeClipboard: { nodes: Node[]; edges: Edge[] } | null;
  setNodeClipboard: Dispatch<SetStateAction<{ nodes: Node[]; edges: Edge[] } | null>>;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  setTtsLoading: Dispatch<SetStateAction<boolean>>;
  getCenterPosition: () => { x: number; y: number };
  showToast: (message: string) => void;
}

type NodeClipboard = { nodes: Node[]; edges: Edge[] };

type SerializedNodeClipboard = NodeClipboard & {
  kind: 'galwriter-node-clipboard';
  version: 1;
};

const serializeNodeClipboard = (clipboard: NodeClipboard) =>
  JSON.stringify({
    kind: 'galwriter-node-clipboard',
    version: 1,
    nodes: clipboard.nodes,
    edges: clipboard.edges,
  } satisfies SerializedNodeClipboard);

const parseNodeClipboard = (text: string): NodeClipboard | null => {
  try {
    const parsed = JSON.parse(text) as Partial<SerializedNodeClipboard>;
    if (
      parsed?.kind !== 'galwriter-node-clipboard' ||
      parsed.version !== 1 ||
      !Array.isArray(parsed.nodes) ||
      !Array.isArray(parsed.edges)
    ) {
      return null;
    }
    return { nodes: parsed.nodes as Node[], edges: parsed.edges as Edge[] };
  } catch {
    return null;
  }
};

export const useSelectionActions = ({
  nodes,
  edges,
  language,
  ttsLoading,
  ttsProvider,
  ttsApiKey,
  ttsApiUrl,
  ttsAppKey,
  ttsModel,
  ttsVoice,
  ttsNarrationMode,
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

    const clipboard = { nodes: selectedNodes, edges: selectedEdges };
    setNodeClipboard(clipboard);
    navigator.clipboard?.writeText?.(serializeNodeClipboard(clipboard)).catch((error) => {
      console.warn('Failed to write node clipboard', error);
    });
    showToast(
      language === 'zh'
        ? selectedNodes.length === 1
          ? '已复制节点'
          : `已复制 ${selectedNodes.length} 个节点`
        : language === 'ja'
          ? `${selectedNodes.length} 個のノードをコピーしました`
          : `${selectedNodes.length} nodes copied`,
    );
  }, [edges, language, nodes, setNodeClipboard, showToast]);

  const pasteNodeClipboard = useCallback(
    (clipboard: NodeClipboard) => {
      if (clipboard.nodes.length === 0) return false;
      const idMap: Record<string, string> = {};
      const center = getCenterPosition();

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      clipboard.nodes.forEach((node) => {
        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + (node.measured?.width || 300));
        maxY = Math.max(maxY, node.position.y + (node.measured?.height || 200));
      });
      const groupCenterX = (minX + maxX) / 2;
      const groupCenterY = (minY + maxY) / 2;

      const offsetX = center.x - groupCenterX;
      const offsetY = center.y - groupCenterY;

      const newNodes: Node[] = clipboard.nodes.map((node) => {
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

      newNodes.forEach((node) => {
        if (node.type !== 'storyNode') return;
        const presentation = node.data.presentation as
          | {
              scene?: { sourceNodeId: string };
              characters?: Array<{ sourceNodeId: string }>;
            }
          | undefined;
        if (!presentation) return;

        node.data = {
          ...node.data,
          presentation: {
            ...presentation,
            scene: presentation.scene
              ? {
                  ...presentation.scene,
                  sourceNodeId:
                    idMap[presentation.scene.sourceNodeId] || presentation.scene.sourceNodeId,
                }
              : undefined,
            characters: presentation.characters?.map((character) => ({
              ...character,
              sourceNodeId: idMap[character.sourceNodeId] || character.sourceNodeId,
            })),
          },
        };
      });

      const newEdges = clipboard.edges.map((edge) => ({
        ...edge,
        id: uuidv4(),
        source: idMap[edge.source],
        target: idMap[edge.target],
      }));

      setNodes((nds) => [...nds.map((node) => ({ ...node, selected: false })), ...newNodes]);
      setEdges((eds) => [...eds, ...newEdges]);
      return true;
    },
    [getCenterPosition, setEdges, setNodes],
  );

  const handlePaste = useCallback(async () => {
    if (nodeClipboard && nodeClipboard.nodes.length > 0) {
      pasteNodeClipboard(nodeClipboard);
      return;
    }

    try {
      if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
        showToast(
          language === 'zh'
            ? '当前环境不支持直接读取剪贴板，请使用快捷键 Ctrl+V'
            : language === 'ja'
              ? '現在の環境ではクリップボードの直接読み取りがサポートされていません。Ctrl+Vを使用してください。'
              : 'Clipboard reading is not supported, please use Ctrl+V',
        );
        return;
      }
      const text = await navigator.clipboard.readText();
      const parsedClipboard = parseNodeClipboard(text);
      if (parsedClipboard && pasteNodeClipboard(parsedClipboard)) {
        setNodeClipboard(parsedClipboard);
        return;
      }
      if (text && text.trim()) {
        const center = getCenterPosition();
        const newId = uuidv4();
        const newNode: Node = {
          id: newId,
          type: 'storyNode',
          position: { x: center.x - 150, y: center.y - 110 },
          style: { width: 300, height: 220 },
          data: {
            id: newId,
            title: '粘贴卡片',
            shape: 'square',
            color: '#ffffff',
            sizeMode: 'auto',
            text: text.trim(),
          },
        };
        setNodes((nds) => [...nds.map((node) => ({ ...node, selected: false })), newNode]);
      }
    } catch (error) {
      console.warn('Failed to read system clipboard', error);
    }
  }, [getCenterPosition, language, nodeClipboard, pasteNodeClipboard, setNodeClipboard, setNodes, showToast]);

  const deleteSelected = useCallback(() => {
    const selectedNodes = nodes.filter((node) => node.selected);
    const selectedEdges = edges.filter((edge) => edge.selected);

    if (selectedNodes.length === 0 && selectedEdges.length === 0) return;

    const nodeIdsToDelete = new Set(selectedNodes.map((node) => node.id));
    const edgeIdsToDelete = new Set(selectedEdges.map((edge) => edge.id));

    if (nodeIdsToDelete.size === 0 && edgeIdsToDelete.size === 0) {
      if (selectedNodes.length > 0) {
        showToast(
          language === 'zh'
            ? '起点节点受保护，无法删除'
            : language === 'ja'
              ? 'スタートノードは保護されているため削除できません'
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
    showToast(
      language === 'zh'
        ? `已删除${totalDeleted} 个项目`
        : language === 'ja'
          ? `${totalDeleted} 個の項目を削除しました`
          : `Deleted ${totalDeleted} items`,
    );
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
        : language === 'ja'
          ? `${selectedNodeIds.length} 個のカードを非表示にしました`
          : `${selectedNodeIds.length} cards hidden`,
    );
  }, [language, nodes, setNodes, showToast]);

  const arrangeSelected = useCallback(() => {
    const selectedNodes = nodes.filter((node) => node.selected);
    if (selectedNodes.length < 2) return;

    const readDimension = (value: unknown, fallback: number) => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed)) return parsed;
      }
      return fallback;
    };
    const getNodeSize = (node: Node, fallbackWidth: number, fallbackHeight: number) => ({
      width: node.measured?.width ?? node.width ?? readDimension(node.style?.width, fallbackWidth),
      height:
        node.measured?.height ?? node.height ?? readDimension(node.style?.height, fallbackHeight),
    });
    const backgrounds = nodes.filter((node) => node.type === 'backgroundNode');
    const backgroundRects = backgrounds.map((node) => {
      const size = getNodeSize(node, 600, 400);
      return {
        x: node.position.x,
        y: node.position.y,
        width: size.width,
        height: size.height,
      };
    });
    const isProtectedByBackground = (node: Node) => {
      if (node.type === 'backgroundNode') return true;
      const fallbackWidth = node.type === 'characterNode' || node.type === 'sceneNode' ? 280 : 300;
      const fallbackHeight = node.type === 'characterNode' || node.type === 'sceneNode' ? 420 : 200;
      const size = getNodeSize(node, fallbackWidth, fallbackHeight);
      const center = {
        x: node.position.x + size.width / 2,
        y: node.position.y + size.height / 2,
      };
      return backgroundRects.some(
        (rect) =>
          center.x >= rect.x &&
          center.x <= rect.x + rect.width &&
          center.y >= rect.y &&
          center.y <= rect.y + rect.height,
      );
    };
    const movableNodes = selectedNodes.filter((node) => !isProtectedByBackground(node));
    if (movableNodes.length < 2) {
      showToast(
        language === 'zh'
          ? '背景卡片内部的卡片会保持原位，没有足够的外部卡片可整理'
          : language === 'ja'
            ? '背景カード内のカードは固定されます。整列できる外部カードが不足しています'
            : 'Cards inside background regions stay fixed; not enough outside cards to arrange',
      );
      return;
    }

    const ordered = [...movableNodes].sort(
      (a, b) => a.position.y - b.position.y || a.position.x - b.position.x,
    );
    const characters = ordered.filter((node) => node.type === 'characterNode');
    const scenes = ordered.filter((node) => node.type === 'sceneNode');
    const stories = ordered.filter((node) => node.type === 'storyNode');
    const numberConditions = ordered.filter((node) => node.type === 'numberConditionNode');
    const flowCards =
      numberConditions.length > 0
        ? [...stories, ...numberConditions].sort(
            (a, b) => a.position.y - b.position.y || a.position.x - b.position.x,
          )
        : stories;
    const others = ordered.filter(
      (node) =>
        node.type !== 'characterNode' &&
        node.type !== 'sceneNode' &&
        node.type !== 'storyNode' &&
        node.type !== 'numberConditionNode',
    );

    const minX = Math.min(...movableNodes.map((node) => node.position.x));
    const minY = Math.min(...movableNodes.map((node) => node.position.y));
    const maxX = Math.max(
      ...movableNodes.map(
        (node) =>
          node.position.x +
          getNodeSize(
            node,
            node.type === 'characterNode' || node.type === 'sceneNode' ? 280 : 300,
            node.type === 'characterNode' || node.type === 'sceneNode' ? 420 : 200,
          ).width,
      ),
    );
    const selectionCenterX = minX + (maxX - minX) / 2;
    const positions = new Map<string, { x: number; y: number }>();
    const horizontalGap = 60;
    const verticalGap = 100;
    let currentY = minY;

    const placeHorizontalRow = (row: Node[], defaultWidth: number, defaultHeight: number) => {
      if (row.length === 0) return;
      const widths = row.map(
        (node) => node.measured?.width || (node.style?.width as number) || defaultWidth,
      );
      const rowWidth =
        widths.reduce((sum, width) => sum + width, 0) + Math.max(0, row.length - 1) * horizontalGap;
      let currentX = selectionCenterX - rowWidth / 2;
      let rowHeight = defaultHeight;

      row.forEach((node, index) => {
        positions.set(node.id, { x: currentX, y: currentY });
        currentX += widths[index] + horizontalGap;
        rowHeight = Math.max(
          rowHeight,
          node.measured?.height || (node.style?.height as number) || defaultHeight,
        );
      });
      currentY += rowHeight + verticalGap;
    };

    placeHorizontalRow(characters, 280, 420);
    placeHorizontalRow(scenes, 280, 420);

    if (flowCards.length > 0) {
      const storyIds = new Set(flowCards.map((node) => node.id));
      const storyById = new Map(flowCards.map((node) => [node.id, node]));
      const outgoing = new Map<string, string[]>();
      const incomingCount = new Map(flowCards.map((node) => [node.id, 0]));

      edges.forEach((edge) => {
        if (!storyIds.has(edge.source) || !storyIds.has(edge.target)) return;
        const targets = outgoing.get(edge.source) || [];
        targets.push(edge.target);
        outgoing.set(edge.source, targets);
        incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1);
      });
      outgoing.forEach((targets) =>
        targets.sort(
          (a, b) => (storyById.get(a)?.position.x || 0) - (storyById.get(b)?.position.x || 0),
        ),
      );

      const roots = flowCards
        .filter((node) => (incomingCount.get(node.id) || 0) === 0)
        .sort((a, b) => a.position.x - b.position.x);
      if (roots.length === 0) roots.push(flowCards[0]);

      const depthById = new Map<string, number>();
      const depthQueue = roots.map((node) => ({ id: node.id, depth: 0 }));
      const depthVisits = new Map<string, number>();
      while (depthQueue.length > 0) {
        const current = depthQueue.shift()!;
        const visits = (depthVisits.get(current.id) || 0) + 1;
        depthVisits.set(current.id, visits);
        if (visits > flowCards.length) continue;
        depthById.set(current.id, Math.max(depthById.get(current.id) || 0, current.depth));
        (outgoing.get(current.id) || []).forEach((targetId) => {
          depthQueue.push({ id: targetId, depth: current.depth + 1 });
        });
      }

      let nextColumn = 0;
      const columnById = new Map<string, number>();
      const assigning = new Set<string>();
      const assignColumn = (nodeId: string): number => {
        const existing = columnById.get(nodeId);
        if (existing !== undefined) return existing;
        if (assigning.has(nodeId)) {
          const cycleColumn = nextColumn++;
          columnById.set(nodeId, cycleColumn);
          return cycleColumn;
        }

        assigning.add(nodeId);
        const childIds = (outgoing.get(nodeId) || []).filter((id) => storyIds.has(id));
        let column: number;
        if (childIds.length === 0) {
          column = nextColumn++;
        } else {
          const childColumns = childIds.map(assignColumn);
          column =
            childColumns.reduce((sum, childColumn) => sum + childColumn, 0) / childColumns.length;
        }
        assigning.delete(nodeId);
        columnById.set(nodeId, column);
        return column;
      };
      roots.forEach((node) => assignColumn(node.id));
      flowCards.forEach((node) => {
        if (!columnById.has(node.id)) {
          depthById.set(node.id, depthById.get(node.id) || 0);
          assignColumn(node.id);
        }
      });
      numberConditions.forEach((node) => {
        const childColumns = (outgoing.get(node.id) || [])
          .map((targetId) => columnById.get(targetId))
          .filter((column): column is number => typeof column === 'number');
        if (childColumns.length > 0) {
          columnById.set(node.id, Math.min(...childColumns) - 1);
        }
      });

      const columns = Array.from(columnById.values());
      const minColumn = Math.min(...columns);
      const maxColumn = Math.max(...columns);
      const columnWidth = 380;
      const graphWidth = (maxColumn - minColumn) * columnWidth;
      const graphLeft = selectionCenterX - graphWidth / 2;
      const levelHeights = new Map<number, number>();
      flowCards.forEach((node) => {
        const depth = depthById.get(node.id) || 0;
        const height =
          node.measured?.height ||
          (node.style?.height as number) ||
          (node.type === 'numberConditionNode' ? 240 : 200);
        levelHeights.set(depth, Math.max(levelHeights.get(depth) || 0, height));
      });
      const levelY = new Map<number, number>();
      let nextLevelY = currentY;
      const maxDepth = Math.max(...Array.from(depthById.values()), 0);
      for (let depth = 0; depth <= maxDepth; depth += 1) {
        levelY.set(depth, nextLevelY);
        nextLevelY += (levelHeights.get(depth) || 200) + 100;
      }

      const occupiedByDepth = new Map<number, number[]>();
      flowCards.forEach((node) => {
        const depth = depthById.get(node.id) || 0;
        const width = node.measured?.width || (node.style?.width as number) || 300;
        let column = columnById.get(node.id) || 0;
        const occupied = occupiedByDepth.get(depth) || [];
        while (occupied.some((usedColumn) => Math.abs(usedColumn - column) < 0.8)) {
          column += 1;
        }
        occupied.push(column);
        occupiedByDepth.set(depth, occupied);
        positions.set(node.id, {
          x: graphLeft + (column - minColumn) * columnWidth - width / 2,
          y: levelY.get(depth) || currentY,
        });
      });
      currentY = nextLevelY + 20;
    }

    placeHorizontalRow(others, 300, 200);

    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        const position = positions.get(node.id);
        return position ? { ...node, position } : node;
      }),
    );
    showToast(
      language === 'zh'
        ? `已整理 ${movableNodes.length} 张卡片，背景区域内的卡片保持原位`
        : language === 'ja'
          ? `${movableNodes.length} 枚のカードを整列し、背景領域内のカードは固定しました`
          : `Arranged ${movableNodes.length} cards; cards inside background regions stayed fixed`,
    );
  }, [edges, language, nodes, setNodes, showToast]);

  const handleGenerateSelectedSpeech = useCallback(async () => {
    if (ttsLoading) return;
    const storyNodes = nodes
      .filter((node) => node.selected && node.type === 'storyNode')
      .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);

    if (storyNodes.length === 0) {
      showToast(
        language === 'zh'
          ? '请先框选需要朗读的剧情卡片'
          : language === 'ja'
            ? '読み上げるストーリーカードを範囲選択してください'
            : 'Select story cards to narrate first',
      );
      return;
    }

    setTtsLoading(true);
    try {
      for (let index = 0; index < storyNodes.length; index += 1) {
        const node = storyNodes[index];
        const speechText = ttsService.buildSpeechText(
          String(node.data.title || ''),
          String(node.data.text || ''),
          ttsNarrationMode,
        );
        if (!speechText) continue;

        showToast(
          language === 'zh'
            ? `正在生成朗读音频 ${index + 1}/${storyNodes.length}`
            : language === 'ja'
              ? `音声生成中 ${index + 1}/${storyNodes.length}`
              : `Generating narration ${index + 1}/${storyNodes.length}`,
        );

        const audio = await ttsService.generate({
          text: speechText,
          provider: ttsProvider,
          apiUrl: ttsApiUrl,
          apiKey: ttsApiKey,
          appKey: ttsAppKey,
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
        language === 'zh'
          ? '朗读音频已生成并关联到卡片'
          : language === 'ja'
            ? '音声の生成が完了し、カードに関連付けられました'
            : 'Narration audio generated and attached',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('TTS generation failed:', error);
      alert(
        `${language === 'zh' ? '朗读音频生成失败' : language === 'ja' ? '音声の生成に失敗しました' : 'Narration generation failed'}: ${message}`,
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
    ttsAppKey,
    ttsLoading,
    ttsModel,
    ttsNarrationMode,
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
    showToast(
      language === 'zh'
        ? '已恢复所有隐藏卡片'
        : language === 'ja'
          ? '非表示のカードをすべて復元しました'
          : 'All cards restored',
    );
  }, [language, setNodes, showToast]);

  return {
    handleCopy,
    handlePaste,
    deleteSelected,
    hideSelected,
    arrangeSelected,
    handleGenerateSelectedSpeech,
    unhideAllNodes,
  };
};

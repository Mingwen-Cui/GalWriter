import type { Edge, Node } from '@xyflow/react';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { registerBlobAsset } from '../../lib/blobAssetRegistry';
import type { Language } from '../../lib/i18n';
import { MIN_STORY_CARD_HEIGHT } from '../../components/story-editor/constants';

interface UseNodeActionsParams {
  nodes: Node[];
  language: Language;
  showTitles: boolean;
  titleHeight: number;
  getCenterPosition: () => { x: number; y: number };
  getMediaDimensions: (url: string, type: string) => Promise<{ width: number; height: number }>;
  setNodes: Dispatch<SetStateAction<Node[]>>;
  setEdges: Dispatch<SetStateAction<Edge[]>>;
  setShowSaveNameModal: Dispatch<SetStateAction<boolean>>;
  dynamicWrapTitle: string;
  backgroundCardTitle: string;
}

const REGION_PADDING = 60;

function readNodeSize(node: Node, fallbackWidth = 300, fallbackHeight = 200) {
  const width = node.measured?.width ?? node.width ?? node.style?.width ?? fallbackWidth;
  const height = node.measured?.height ?? node.height ?? node.style?.height ?? fallbackHeight;

  return {
    width: typeof width === 'number' ? width : Number.parseFloat(String(width)) || fallbackWidth,
    height: typeof height === 'number' ? height : Number.parseFloat(String(height)) || fallbackHeight,
  };
}

function isRegionContentNode(node: Node) {
  return ![
    'backgroundNode',
    'groupNode',
    'batchReplaceNode',
    'plotStructureNode',
    'aiNode',
  ].includes(node.type || '');
}

export const useNodeActions = ({
  nodes,
  language,
  showTitles,
  titleHeight,
  getCenterPosition,
  getMediaDimensions,
  setNodes,
  setEdges,
  setShowSaveNameModal,
  dynamicWrapTitle,
  backgroundCardTitle,
}: UseNodeActionsParams) => {
  const addNewShape = useCallback(
    (shape: 'square' | 'diamond' | 'rounded-rectangle') => {
      const center = getCenterPosition();
      let newX = center.x - 150;
      let newY = center.y - 110;

      const isOccupied = (x: number, y: number, currentNodes: Node[]) =>
        currentNodes.some(
          (node) => Math.abs(node.position.x - x) < 50 && Math.abs(node.position.y - y) < 50,
        );

      let attempts = 0;
      while (isOccupied(newX, newY, nodes) && attempts < 10) {
        newX += 320;
        if (attempts > 3) newY += 220;
        attempts += 1;
      }

      const newId = uuidv4();
      const newNode: Node = {
        id: newId,
        type: 'storyNode',
        position: { x: newX, y: newY },
        style: { width: 300, height: MIN_STORY_CARD_HEIGHT },
        data: {
          id: newId,
          title: shape === 'square' ? '分支' : shape === 'diamond' ? '判断' : '状态',
          shape,
          color: '#ffffff',
          sizeMode: 'auto',
          text: '',
        },
      };
      setNodes((currentNodes) => [...currentNodes, newNode]);
    },
    [getCenterPosition, nodes, setNodes],
  );

  const addNewTextNode = useCallback(() => {
    const center = getCenterPosition();
    const newId = uuidv4();
    const newNode: Node = {
      id: newId,
      type: 'textNode',
      position: { x: center.x - 100, y: center.y - 30 },
      selected: true,
      data: {
        id: newId,
        content:
          language === 'zh'
            ? '在此处输入文本?..'
            : language === 'ja'
              ? 'ここにテキストを入力してください...'
              : 'Enter text here...',
        fontSize: 24,
        color: '#334155',
        fontFamily: 'system-ui, sans-serif',
        isBold: false,
        initialEditing: true,
      },
      style: { width: 200, height: 60 },
    };
    setNodes((currentNodes) => [
      ...currentNodes.map((node) => ({ ...node, selected: false })),
      newNode,
    ]);
  }, [getCenterPosition, language, setNodes]);

  const addNewSummaryNode = useCallback(() => {
    const center = getCenterPosition();
    const newId = uuidv4();
    const newNode: Node = {
      id: newId,
      type: 'summaryNode',
      position: { x: center.x - 175, y: center.y - 100 },
      data: { id: newId },
    };
    setNodes((currentNodes) => [...currentNodes, newNode]);
  }, [getCenterPosition, setNodes]);

  const addNewNumberConditionNode = useCallback(() => {
    const center = getCenterPosition();
    const newId = uuidv4();
    const newNode: Node = {
      id: newId,
      type: 'numberConditionNode',
      position: { x: center.x - 125, y: center.y - 100 },
      data: { id: newId, threshold: 0 },
    };
    setNodes((currentNodes) => [...currentNodes, newNode]);
  }, [getCenterPosition, setNodes]);

  const addNewBatchReplaceNode = useCallback(() => {
    const center = getCenterPosition();
    const newId = uuidv4();
    const newNode: Node = {
      id: newId,
      type: 'batchReplaceNode',
      position: { x: center.x - 160, y: center.y - 100 },
      data: { id: newId, scope: 'all' },
    };
    setNodes((currentNodes) => [...currentNodes, newNode]);
  }, [getCenterPosition, setNodes]);

  const addNewPlotStructureNode = useCallback(() => {
    const center = getCenterPosition();
    const newId = uuidv4();
    const newNode: Node = {
      id: newId,
      type: 'plotStructureNode',
      position: { x: center.x - 130, y: center.y - 100 },
      data: { id: newId, cardCount: 3, detailLevel: 'standard', direction: '' },
    };
    setNodes((currentNodes) => [...currentNodes, newNode]);
  }, [getCenterPosition, setNodes]);

  const addNewCharacterNode = useCallback(() => {
    const center = getCenterPosition();
    const newId = uuidv4();
    const newNode: Node = {
      id: newId,
      type: 'characterNode',
      position: { x: center.x - 140, y: center.y - 150 },
      data: {
        id: newId,
        characterName:
          language === 'zh' ? '新角色' : language === 'ja' ? '新キャラクター' : 'New Character',
        traits: '',
      },
    };
    setNodes((currentNodes) => [...currentNodes, newNode]);
  }, [getCenterPosition, setNodes]);

  const addNewSceneNode = useCallback(() => {
    const center = getCenterPosition();
    const newId = uuidv4();
    const newNode: Node = {
      id: newId,
      type: 'sceneNode',
      position: { x: center.x - 140, y: center.y - 150 },
      data: {
        id: newId,
        sceneName: language === 'zh' ? '新场景' : language === 'ja' ? '新シーン' : 'New Scene',
        description: '',
      },
    };
    setNodes((currentNodes) => [...currentNodes, newNode]);
  }, [getCenterPosition, language, setNodes]);

  const handleMediaUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      const center = getCenterPosition();
      const fileArray = Array.from(files);

      for (let index = 0; index < fileArray.length; index += 1) {
        const file = fileArray[index];
        const url = registerBlobAsset(URL.createObjectURL(file), file);
        const newId = uuidv4();

        let mediaData: Record<string, string> = {};
        let title = language === 'zh' ? '媒体' : language === 'ja' ? 'メディア' : 'Media';

        const { width, height } = await getMediaDimensions(url, file.type);
        let displayWidth = 400;
        let displayHeight = (height / width) * displayWidth;

        if (displayHeight > 500) {
          displayHeight = 500;
          displayWidth = (width / height) * displayHeight;
        }

        if (file.type.startsWith('image/')) {
          mediaData = { imageUrl: url };
          title = language === 'zh' ? '图片' : language === 'ja' ? '画像' : 'Image';
        } else if (file.type.startsWith('video/')) {
          mediaData = { videoUrl: url };
          title = language === 'zh' ? '视频' : language === 'ja' ? '動画' : 'Video';
        } else if (file.type.startsWith('audio/')) {
          mediaData = { audioUrl: url };
          title = language === 'zh' ? '音频' : language === 'ja' ? '音声' : 'Audio';
          displayWidth = 300;
          displayHeight = 150;
        }

        const newNode: Node = {
          id: newId,
          type: 'storyNode',
          position: {
            x: center.x - displayWidth / 2 + index * 30,
            y: center.y - displayHeight / 2 + index * 30,
          },
          style: { width: displayWidth, height: displayHeight + (showTitles ? titleHeight : 0) },
          data: {
            id: newId,
            title,
            shape: 'square',
            color: '#ffffff',
            sizeMode: 'auto',
            text: '',
            objectFit: 'playtest',
            titleHeightAdded: showTitles,
            ...mediaData,
          },
        };
        setNodes((currentNodes) => [...currentNodes, newNode]);
      }

      event.target.value = '';
    },
    [getCenterPosition, getMediaDimensions, language, setNodes, showTitles, titleHeight],
  );

  const handleExportJSON = useCallback(() => {
    setShowSaveNameModal(true);
  }, [setShowSaveNameModal]);

  const wrapWithDynamicGroup = useCallback(() => {
    const selected = nodes.filter(
      (node) => node.selected && node.type !== 'backgroundNode' && node.type !== 'groupNode',
    );
    if (selected.length === 0) return;

    const childIds = selected.map((node) => node.id);
    const newId = uuidv4();
    const newNode: Node = {
      id: newId,
      type: 'groupNode',
      position: { x: 0, y: 0 },
      selectable: true,
      draggable: true,
      data: { id: newId, title: dynamicWrapTitle, color: '#6366f1', childIds },
      style: { width: 100, height: 100, zIndex: -2 },
    };

    setNodes((currentNodes) => [
      ...currentNodes.map((node) => ({ ...node, selected: false })),
      { ...newNode, selected: true },
    ]);
  }, [dynamicWrapTitle, nodes, setNodes]);

  const wrapSelectedWithBackground = useCallback(() => {
    const selected = nodes.filter((node) => node.selected);
    if (selected.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    selected.forEach((node) => {
      const { x, y } = node.position;
      const width = node.measured?.width || 300;
      const height = node.measured?.height || 200;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    });

    const padding = REGION_PADDING;
    const newId = uuidv4();
    const newNode: Node = {
      id: newId,
      type: 'backgroundNode',
      position: { x: minX - padding, y: minY - padding },
      dragHandle: '.custom-drag-handle',
      style: { width: maxX - minX + padding * 2, height: maxY - minY + padding * 2, zIndex: -3 },
      data: { id: newId, title: backgroundCardTitle, color: '#f1f5f9' },
    };

    setNodes((currentNodes) => [
      ...currentNodes.map((node) => ({ ...node, selected: false })),
      newNode,
    ]);
  }, [backgroundCardTitle, nodes, setNodes]);

  const convertBackgroundToDynamicGroup = useCallback(
    (backgroundId: string) => {
      setNodes((currentNodes) => {
        const background = currentNodes.find(
          (node) => node.id === backgroundId && node.type === 'backgroundNode',
        );
        if (!background) return currentNodes;

        const backgroundSize = readNodeSize(background, 600, 400);
        const childIds = currentNodes
          .filter(isRegionContentNode)
          .filter((node) => {
            const size = readNodeSize(node);
            const centerX = node.position.x + size.width / 2;
            const centerY = node.position.y + size.height / 2;
            return (
              centerX >= background.position.x &&
              centerX <= background.position.x + backgroundSize.width &&
              centerY >= background.position.y &&
              centerY <= background.position.y + backgroundSize.height
            );
          })
          .map((node) => node.id);

        if (childIds.length === 0) return currentNodes;

        return currentNodes.map((node) =>
          node.id === backgroundId
            ? {
                ...node,
                type: 'groupNode',
                dragHandle: undefined,
                data: { ...node.data, childIds },
                style: { ...node.style, zIndex: -2 },
              }
            : node,
        );
      });
    },
    [setNodes],
  );

  const convertDynamicGroupToBackground = useCallback(
    (groupId: string) => {
      setNodes((currentNodes) => {
        const group = currentNodes.find((node) => node.id === groupId && node.type === 'groupNode');
        const childIds = Array.isArray(group?.data?.childIds) ? group.data.childIds : [];
        const children = currentNodes.filter(
          (node) => childIds.includes(node.id) && isRegionContentNode(node),
        );
        if (!group || children.length === 0) return currentNodes;

        const bounds = children.reduce(
          (result, node) => {
            const size = readNodeSize(node);
            return {
              minX: Math.min(result.minX, node.position.x),
              minY: Math.min(result.minY, node.position.y),
              maxX: Math.max(result.maxX, node.position.x + size.width),
              maxY: Math.max(result.maxY, node.position.y + size.height),
            };
          },
          { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
        );

        return currentNodes.map((node) => {
          if (node.id !== groupId) return node;
          const { childIds: _childIds, hullPoints: _hullPoints, ...data } = node.data || {};
          return {
            ...node,
            type: 'backgroundNode',
            position: { x: bounds.minX - REGION_PADDING, y: bounds.minY - REGION_PADDING },
            dragHandle: '.custom-drag-handle',
            data,
            style: {
              ...node.style,
              width: bounds.maxX - bounds.minX + REGION_PADDING * 2,
              height: bounds.maxY - bounds.minY + REGION_PADDING * 2,
              zIndex: -3,
            },
          };
        });
      });
    },
    [setNodes],
  );

  const connectSelectedToSummaryNode = useCallback(() => {
    const selected = nodes.filter(
      (node) => node.selected && node.type !== 'backgroundNode' && node.type !== 'summaryNode',
    );
    if (selected.length === 0) return;

    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    selected.forEach((node) => {
      const { x, y } = node.position;
      const width = node.measured?.width || 300;
      const height = node.measured?.height || 200;
      maxX = Math.max(maxX, x + width);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y + height);
    });

    const newId = uuidv4();
    const summaryX = maxX + 150;
    const summaryY = minY + (maxY - minY) / 2 - 125;
    const newNode: Node = {
      id: newId,
      type: 'summaryNode',
      position: { x: summaryX, y: summaryY },
      data: { id: newId },
    };
    const newEdges = selected.map((node) => ({
      id: `e-${node.id}-${newId}`,
      source: node.id,
      target: newId,
      type: 'customEdge',
    }));

    setNodes((currentNodes) => [
      ...currentNodes.map((node) => ({ ...node, selected: false })),
      newNode,
    ]);
    setEdges((currentEdges) => [...currentEdges, ...newEdges]);
  }, [nodes, setEdges, setNodes]);

  return {
    addNewShape,
    addNewTextNode,
    addNewSummaryNode,
    addNewNumberConditionNode,
    addNewBatchReplaceNode,
    addNewPlotStructureNode,
    addNewCharacterNode,
    addNewSceneNode,
    handleMediaUpload,
    handleExportJSON,
    wrapWithDynamicGroup,
    wrapSelectedWithBackground,
    convertBackgroundToDynamicGroup,
    convertDynamicGroupToBackground,
    connectSelectedToSummaryNode,
  };
};

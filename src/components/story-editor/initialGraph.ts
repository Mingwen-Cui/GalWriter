import { MarkerType, type Edge, type Node } from '@xyflow/react';

import { getAppAssetUrl } from '../../lib/appAssets';
import {
  createCharacterPresentation,
  createInlinePresentationAction,
  createScenePresentation,
} from '../../lib/presentation';

import {
  DEFAULT_ROOT_STORY_TEXT,
  DEFAULT_ROOT_STORY_TITLE,
  MIN_STORY_CARD_HEIGHT,
} from './constants';

export const createDefaultEdgeOptions = (edgeColor: string, arrowSize: number) => ({
  type: 'customEdge',
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: arrowSize,
    height: arrowSize,
    color: edgeColor,
  },
  style: { strokeWidth: 3, stroke: edgeColor },
});

export const INITIAL_NODES: Node[] = [
  {
    id: 'initial-story-background',
    type: 'backgroundNode',
    position: { x: 1660, y: 80 },
    dragHandle: '.custom-drag-handle',
    style: { width: 780, height: 1150, zIndex: -3 },
    data: {
      id: 'initial-story-background',
      title: '山中寺庙 · 初始化教程',
      color: '#f1f5f9',
    },
  },
  {
    id: 'root',
    type: 'storyNode',
    position: { x: 1740, y: 150 },
    style: { width: 300, height: MIN_STORY_CARD_HEIGHT },
    data: {
      id: 'root',
      title: DEFAULT_ROOT_STORY_TITLE,
      text: DEFAULT_ROOT_STORY_TEXT,
      shape: 'rounded-rectangle',
      color: '#ffffff',
      sizeMode: 'auto',
      isRoot: true,
      imageUrl: getAppAssetUrl('initial-assets/mountain-temple-distant.png'),
      showTextOverlay: true,
      presentation: {
        scene: {
          ...createScenePresentation('initial-mountain-temple'),
          imageId: 'initial-distant-mountain',
          cropMode: 'cover',
        },
        characters: [],
      },
    },
  },
  {
    id: 'initial-branch',
    type: 'storyNode',
    position: { x: 1740, y: 470 },
    style: { width: 300, height: MIN_STORY_CARD_HEIGHT },
    data: {
      id: 'initial-branch',
      title: '场景切换',
      text: '山里有座庙。\n镜头从远景切换到寺前。',
      shape: 'square',
      color: '#ffffff',
      sizeMode: 'auto',
      imageUrl: getAppAssetUrl('initial-assets/mountain-temple-background.png'),
      showTextOverlay: true,
      presentation: {
        scene: {
          ...createScenePresentation('initial-mountain-temple'),
          imageId: 'initial-temple-close',
          cropMode: 'cover',
        },
        characters: [],
        inlineActions: [
          {
            ...createInlinePresentationAction({
              id: 'initial-switch-to-temple',
              kind: 'scene',
              sourceNodeId: 'initial-mountain-temple',
              name: '切换至山中寺庙',
            }),
            action: 'switch',
            targetAssetId: 'initial-temple-close',
            duration: 650,
          },
        ],
      },
    },
  },
  {
    id: 'initial-dialogue',
    type: 'storyNode',
    position: { x: 1740, y: 820 },
    style: { width: 300, height: MIN_STORY_CARD_HEIGHT },
    data: {
      id: 'initial-dialogue',
      title: '人物对话',
      text: '小和尚：师父，山外的云好像一片海。\n老和尚：心静下来，脚下的石阶也能通向远方。',
      shape: 'rounded-rectangle',
      color: '#ffffff',
      sizeMode: 'auto',
      imageUrl: getAppAssetUrl('initial-assets/mountain-temple-background.png'),
      showTextOverlay: true,
      presentation: {
        scene: {
          ...createScenePresentation('initial-mountain-temple'),
          imageId: 'initial-temple-close',
          cropMode: 'cover',
        },
        characters: [
          {
            ...createCharacterPresentation('initial-old-monk'),
            position: 'left',
            scale: 0.78,
          },
          {
            ...createCharacterPresentation('initial-young-monk'),
            position: 'right',
            scale: 0.78,
          },
        ],
      },
    },
  },
  {
    id: 'initial-old-monk',
    type: 'characterNode',
    position: { x: 100, y: 120 },
    style: { width: 440 },
    data: {
      id: 'initial-old-monk',
      characterName: '老和尚',
      identity: '山中寺庙的住持',
      traits: '沉稳、慈祥、睿智',
      personality: '说话从容，喜欢用故事引导小和尚思考。',
      background: '长年居住在山中寺庙，守着晨钟暮鼓和一方清净。',
      avatarUrl: getAppAssetUrl('initial-assets/old-monk-avatar.png'),
      threeViewUrl: getAppAssetUrl('initial-assets/old-monk-three-view.png'),
      tagSpriteUrl: getAppAssetUrl('initial-assets/old-monk-tag-sprite.png'),
      isGlobal: true,
    },
  },
  {
    id: 'initial-young-monk',
    type: 'characterNode',
    position: { x: 620, y: 120 },
    style: { width: 440 },
    data: {
      id: 'initial-young-monk',
      characterName: '小和尚',
      identity: '寺庙中的小徒弟',
      traits: '好奇、天真、勤快',
      personality: '总有问不完的问题，喜欢跟着师父听故事。',
      background: '跟随老和尚在山中修行，日常负责洒扫和添香。',
      avatarUrl: getAppAssetUrl('initial-assets/young-monk-avatar.png'),
      threeViewUrl: getAppAssetUrl('initial-assets/young-monk-three-view.png'),
      tagSpriteUrl: getAppAssetUrl('initial-assets/young-monk-tag-sprite.png'),
      isGlobal: true,
    },
  },
  {
    id: 'initial-mountain-temple',
    type: 'sceneNode',
    position: { x: 1140, y: 120 },
    style: { width: 440 },
    data: {
      id: 'initial-mountain-temple',
      sceneName: '山中寺庙',
      description: '群山环抱中的一座古朴寺庙。',
      location: '云雾缭绕的山腰，寺前有石阶和一株老松。',
      items: '山门、钟楼、蒲团、木鱼、老松。',
      atmosphere: '清晨安静，偶尔传来悠长的钟声。',
      coverImageUrl: getAppAssetUrl('initial-assets/mountain-temple-background.png'),
      images: [
        {
          id: 'initial-distant-mountain',
          name: '远景：从前有座山',
          imageUrl: getAppAssetUrl('initial-assets/mountain-temple-distant.png'),
        },
        {
          id: 'initial-temple-close',
          name: '近景：山里有座庙',
          imageUrl: getAppAssetUrl('initial-assets/mountain-temple-background.png'),
        },
      ],
      isGlobal: true,
    },
  },
  {
    id: 'initial-plot-structure',
    type: 'plotStructureNode',
    position: { x: 2120, y: 160 },
    data: {
      id: 'initial-plot-structure',
      cardCount: 3,
      detailLevel: 'standard',
      direction: '围绕老和尚和小和尚在山中寺庙的日常，展开宁静温暖的故事。',
    },
  },
];

export const INITIAL_EDGES: Edge[] = [
  {
    id: 'initial-root-to-branch',
    source: 'root',
    sourceHandle: 'bottom',
    target: 'initial-branch',
    targetHandle: 'top',
    type: 'customEdge',
  },
  {
    id: 'initial-branch-to-dialogue',
    source: 'initial-branch',
    sourceHandle: 'bottom',
    target: 'initial-dialogue',
    targetHandle: 'top',
    type: 'customEdge',
  },
];

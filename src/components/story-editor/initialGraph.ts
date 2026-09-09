import { MarkerType, type Edge, type Node } from '@xyflow/react';

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
    id: 'root',
    type: 'storyNode',
    position: { x: 200, y: 100 },
    style: { width: 300, height: MIN_STORY_CARD_HEIGHT },
    data: {
      id: 'root',
      title: DEFAULT_ROOT_STORY_TITLE,
      text: DEFAULT_ROOT_STORY_TEXT,
      shape: 'rounded-rectangle',
      color: '#ffffff',
      sizeMode: 'auto',
      isRoot: true,
    },
  },
  {
    id: 'initial-branch',
    type: 'storyNode',
    position: { x: 200, y: 560 },
    style: { width: 300, height: MIN_STORY_CARD_HEIGHT },
    data: {
      id: 'initial-branch',
      title: '分支',
      text: '山里有座庙',
      shape: 'square',
      color: '#ffffff',
      sizeMode: 'auto',
    },
  },
  {
    id: 'initial-old-monk',
    type: 'characterNode',
    position: { x: 620, y: 100 },
    style: { width: 440 },
    data: {
      id: 'initial-old-monk',
      characterName: '老和尚',
      identity: '山中寺庙的住持',
      traits: '沉稳、慈祥、睿智',
      personality: '说话从容，喜欢用故事引导小和尚思考。',
      background: '长年居住在山中寺庙，守着晨钟暮鼓和一方清净。',
      isGlobal: true,
    },
  },
  {
    id: 'initial-young-monk',
    type: 'characterNode',
    position: { x: 1120, y: 100 },
    style: { width: 440 },
    data: {
      id: 'initial-young-monk',
      characterName: '小和尚',
      identity: '寺庙中的小徒弟',
      traits: '好奇、天真、勤快',
      personality: '总有问不完的问题，喜欢跟着师父听故事。',
      background: '跟随老和尚在山中修行，日常负责洒扫和添香。',
      isGlobal: true,
    },
  },
  {
    id: 'initial-mountain-temple',
    type: 'sceneNode',
    position: { x: 620, y: 700 },
    style: { width: 440 },
    data: {
      id: 'initial-mountain-temple',
      sceneName: '山中寺庙',
      description: '群山环抱中的一座古朴寺庙。',
      location: '云雾缭绕的山腰，寺前有石阶和一株老松。',
      items: '山门、钟楼、蒲团、木鱼、老松。',
      atmosphere: '清晨安静，偶尔传来悠长的钟声。',
      isGlobal: true,
    },
  },
  {
    id: 'initial-plot',
    type: 'storyNode',
    position: { x: 1120, y: 700 },
    style: { width: 300, height: MIN_STORY_CARD_HEIGHT },
    data: {
      id: 'initial-plot',
      title: '初始剧情',
      text: '从前有座山，山里有座庙。老和尚和小和尚在晨钟声中开始了新的一天。',
      shape: 'rounded-rectangle',
      color: '#ffffff',
      sizeMode: 'auto',
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
    id: 'initial-branch-to-plot',
    source: 'initial-branch',
    sourceHandle: 'bottom',
    target: 'initial-plot',
    targetHandle: 'top',
    type: 'customEdge',
  },
];

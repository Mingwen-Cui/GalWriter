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
];

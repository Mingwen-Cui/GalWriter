import { MarkerType, type Node } from '@xyflow/react';

import {
  AI_STORY_CARD_HEIGHT,
  DEFAULT_ROOT_STORY_TEXT,
  DEFAULT_ROOT_STORY_TITLE,
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
    position: { x: 400, y: 250 },
    style: { width: 300, height: AI_STORY_CARD_HEIGHT },
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
];

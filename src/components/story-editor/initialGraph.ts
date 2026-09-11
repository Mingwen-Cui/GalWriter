import { MarkerType, type Edge, type Node } from '@xyflow/react';

import mountainTempleBackgroundUrl from '../../assets/initial-tutorial/mountain-temple-background.png';
import mountainTempleDistantUrl from '../../assets/initial-tutorial/mountain-temple-distant.png';
import oldMonkAvatarUrl from '../../assets/initial-tutorial/old-monk-avatar.png';
import oldMonkTagSpriteUrl from '../../assets/initial-tutorial/old-monk-tag-sprite.png';
import oldMonkThreeViewUrl from '../../assets/initial-tutorial/old-monk-three-view.png';
import youngMonkAvatarUrl from '../../assets/initial-tutorial/young-monk-avatar.png';
import youngMonkTagSpriteUrl from '../../assets/initial-tutorial/young-monk-tag-sprite.png';
import youngMonkThreeViewUrl from '../../assets/initial-tutorial/young-monk-three-view.png';
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

const initialMention = (kind: 'scene' | 'character', name: string, id: string) =>
  `<span class="mention-chip mention-chip-${kind}" data-mention-kind="${kind}" data-mention-name="${name}" data-mention-id="${id}" contenteditable="false" draggable="false">${name}</span>`;

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
      text: `${initialMention('scene', '山中寺庙', 'initial-root-scene')}${DEFAULT_ROOT_STORY_TEXT}`,
      shape: 'rounded-rectangle',
      color: '#ffffff',
      sizeMode: 'auto',
      isRoot: true,
      hideTitleInPlayback: true,
      imageUrl: mountainTempleDistantUrl,
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
      text: `${initialMention('scene', '山中寺庙', 'initial-switch-to-temple')}山里有座庙。`,
      shape: 'square',
      color: '#ffffff',
      sizeMode: 'auto',
      hideTitleInPlayback: true,
      imageUrl: mountainTempleBackgroundUrl,
      showTextOverlay: true,
      presentation: {
        scene: {
          ...createScenePresentation('initial-mountain-temple'),
          // The switch action starts from the opening wide shot and reveals
          // this card's temple close shot as its target material.
          imageId: 'initial-distant-mountain',
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
      text:
        `${initialMention('scene', '山中寺庙', 'initial-dialogue-scene')}` +
        `${initialMention('character', '小和尚', 'initial-dialogue-young')}` +
        `${initialMention('character', '老和尚', 'initial-dialogue-old')}` +
        '小和尚：师父，山外的云好像一片海。<br />老和尚：心静下来，脚下的石阶也能通向远方。',
      shape: 'rounded-rectangle',
      color: '#ffffff',
      sizeMode: 'auto',
      hideTitleInPlayback: true,
      imageUrl: mountainTempleBackgroundUrl,
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
            position: 'right',
            offsetY: -100,
            scale: 1,
            enter: { type: 'slide-left', duration: 500 },
          },
          {
            ...createCharacterPresentation('initial-young-monk'),
            position: 'left',
            offsetY: -100,
            scale: 0.7,
            enter: { type: 'slide-right', duration: 500 },
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
      avatarUrl: oldMonkAvatarUrl,
      threeViewUrl: oldMonkThreeViewUrl,
      tagSpriteUrl: oldMonkTagSpriteUrl,
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
      avatarUrl: youngMonkAvatarUrl,
      threeViewUrl: youngMonkThreeViewUrl,
      tagSpriteUrl: youngMonkTagSpriteUrl,
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
      // The scene's default material is the opening wide shot. The following
      // story card switches it to the temple close shot.
      coverImageUrl: mountainTempleDistantUrl,
      images: [
        {
          id: 'initial-distant-mountain',
          name: '远景：从前有座山',
          imageUrl: mountainTempleDistantUrl,
        },
        {
          id: 'initial-temple-close',
          name: '近景：山里有座庙',
          imageUrl: mountainTempleBackgroundUrl,
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

import { getVideoTextForChinesePreference } from '../i18n';
import type { Node as FlowNode } from '@xyflow/react';

import type { AssetRegionOption } from '../shared/types';

export const readNumber = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

export const getNodeSize = (node: FlowNode, fallbackWidth = 220, fallbackHeight = 140) => ({
  width: readNumber(node.width ?? node.measured?.width ?? node.style?.width, fallbackWidth),
  height: readNumber(node.height ?? node.measured?.height ?? node.style?.height, fallbackHeight),
});

export const getNodeCenter = (node: FlowNode, fallbackWidth = 220, fallbackHeight = 140) => {
  const size = getNodeSize(node, fallbackWidth, fallbackHeight);
  return {
    x: node.position.x + size.width / 2,
    y: node.position.y + size.height / 2,
  };
};

export const pointInRect = (
  point: { x: number; y: number },
  rect: { x: number; y: number; width: number; height: number },
) =>
  point.x >= rect.x &&
  point.x <= rect.x + rect.width &&
  point.y >= rect.y &&
  point.y <= rect.y + rect.height;

export const getAssetRegionOptions = (nodes: FlowNode[], isZh: boolean): AssetRegionOption[] => {
  const regionOptions = nodes
    .filter(
      (node) => (node.type === 'groupNode' || node.type === 'backgroundNode') && !node.data?.hidden,
    )
    .map((node) => ({
      id: node.id,
      label: String(
        node.data?.title ||
          (node.type === 'groupNode'
            ? getVideoTextForChinesePreference(
                isZh,
                'componentsrendervideoassetsassetRegionsIsZhText46',
              )
            : getVideoTextForChinesePreference(
                isZh,
                'componentsrendervideoassetsassetRegionsIsZhText49',
              )),
      ),
      type: node.type === 'groupNode' ? ('dynamicGroup' as const) : ('background' as const),
    }));

  return [
    {
      id: 'all',
      label: getVideoTextForChinesePreference(
        isZh,
        'componentsrendervideoassetsassetRegionsIsZhText57',
      ),
      type: 'all',
    },
    {
      id: 'media:image',
      label: getVideoTextForChinesePreference(
        isZh,
        'componentsrendervideoassetsassetRegionsIsZhText58',
      ),
      type: 'mediaImage',
    },
    {
      id: 'media:video',
      label: getVideoTextForChinesePreference(
        isZh,
        'componentsrendervideoassetsassetRegionsIsZhText59',
      ),
      type: 'mediaVideo',
    },
    {
      id: 'media:audio',
      label: getVideoTextForChinesePreference(
        isZh,
        'componentsrendervideoassetsassetRegionsIsZhText60',
      ),
      type: 'mediaAudio',
    },
    {
      id: 'outside',
      label: getVideoTextForChinesePreference(
        isZh,
        'componentsrendervideoassetsassetRegionsIsZhText61',
      ),
      type: 'outside',
    },
    ...regionOptions,
  ];
};

export const getStoryNodeRegion = (node: FlowNode, nodes: FlowNode[]): AssetRegionOption | null => {
  const directGroup = nodes.find((regionNode) => {
    if (regionNode.type !== 'groupNode') return false;
    const childIds = (regionNode.data?.childIds as string[]) || [];
    return childIds.includes(node.id);
  });
  if (directGroup) {
    return {
      id: directGroup.id,
      label: String(directGroup.data?.title || '动态包裹'),
      type: 'dynamicGroup',
    };
  }

  const center = getNodeCenter(node);
  const containingBackgrounds = nodes
    .filter((regionNode) => regionNode.type === 'backgroundNode' && regionNode.id !== node.id)
    .map((regionNode) => {
      const size = getNodeSize(regionNode, 600, 400);
      return {
        node: regionNode,
        area: size.width * size.height,
        rect: {
          x: regionNode.position.x,
          y: regionNode.position.y,
          width: size.width,
          height: size.height,
        },
      };
    })
    .filter((region) => pointInRect(center, region.rect))
    .sort((a, b) => a.area - b.area);

  const background = containingBackgrounds[0]?.node;
  if (!background) return null;
  return {
    id: background.id,
    label: String(background.data?.title || '背景区域'),
    type: 'background',
  };
};

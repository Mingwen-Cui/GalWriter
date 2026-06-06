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
            ? isZh
              ? '动态包裹'
              : 'Dynamic wrap'
            : isZh
              ? '背景区域'
              : 'Background'),
      ),
      type: node.type === 'groupNode' ? ('dynamicGroup' as const) : ('background' as const),
    }));

  return [
    { id: 'all', label: isZh ? '全部素材' : 'All assets', type: 'all' },
    { id: 'media:image', label: isZh ? '图片素材' : 'Image assets', type: 'mediaImage' },
    { id: 'media:video', label: isZh ? '视频素材' : 'Video assets', type: 'mediaVideo' },
    { id: 'media:audio', label: isZh ? '音频素材' : 'Audio assets', type: 'mediaAudio' },
    { id: 'outside', label: isZh ? '画布外/未归组' : 'Outside regions', type: 'outside' },
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

import { getNodesBounds, getViewportForBounds, type Edge, type Node } from '@xyflow/react';

const THUMBNAIL_WIDTH = 480;
const THUMBNAIL_HEIGHT = 300;
const THUMBNAIL_PADDING = 0.18;
const DEFAULT_BACKGROUND = '#f8fafc';

type ProjectThumbnailOptions = {
  showTitles?: boolean;
  storyTitlePlacement?: 'inside' | 'outside-left' | 'outside-right' | 'outside';
};

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const toSvgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const normalizeColor = (color?: string | null) => {
  const normalized = color?.trim();
  return normalized || DEFAULT_BACKGROUND;
};

const readNumber = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const getNodeSize = (node: Node) => ({
  width: readNumber(node.width ?? node.measured?.width ?? node.style?.width, 260),
  height: readNumber(node.height ?? node.measured?.height ?? node.style?.height, 160),
});

type ThumbnailInternalNode = Node & {
  measured: {
    width?: number;
    height?: number;
  };
  internals: {
    positionAbsolute: {
      x: number;
      y: number;
    };
    z: number;
    userNode: Node;
  };
};

const getNodePositionWithOrigin = (node: Node) => {
  const size = getNodeSize(node);
  const origin = node.origin ?? [0, 0];
  return {
    x: node.position.x - size.width * origin[0],
    y: node.position.y - size.height * origin[1],
  };
};

const createThumbnailNodeLookup = (nodes: Node[]) => {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const absolutePositionCache = new Map<string, { x: number; y: number }>();

  const getAbsolutePosition = (node: Node): { x: number; y: number } => {
    const cached = absolutePositionCache.get(node.id);
    if (cached) return cached;

    const position = getNodePositionWithOrigin(node);
    const parent = node.parentId ? nodesById.get(node.parentId) : undefined;
    const parentPosition = parent ? getAbsolutePosition(parent) : { x: 0, y: 0 };
    const absolutePosition = {
      x: parentPosition.x + position.x,
      y: parentPosition.y + position.y,
    };
    absolutePositionCache.set(node.id, absolutePosition);
    return absolutePosition;
  };

  return new Map<string, ThumbnailInternalNode>(
    nodes.map((node) => {
      const size = getNodeSize(node);
      return [
        node.id,
        {
          ...node,
          measured: {
            width: size.width,
            height: size.height,
          },
          internals: {
            positionAbsolute: getAbsolutePosition(node),
            z: readNumber(node.zIndex, 0),
            userNode: node,
          },
        },
      ];
    }),
  );
};

const getNodeAbsolutePosition = (node: Node, nodeLookup: Map<string, ThumbnailInternalNode>) =>
  nodeLookup.get(node.id)?.internals.positionAbsolute ?? getNodePositionWithOrigin(node);

const getNodeCenter = (
  node: Node,
  viewport: { x: number; y: number; zoom: number },
  nodeLookup: Map<string, ThumbnailInternalNode>,
) => {
  const size = getNodeSize(node);
  const position = getNodeAbsolutePosition(node, nodeLookup);
  return {
    x: position.x * viewport.zoom + viewport.x + (size.width * viewport.zoom) / 2,
    y: position.y * viewport.zoom + viewport.y + (size.height * viewport.zoom) / 2,
  };
};

const getNodeFill = (node: Node) => {
  const dataColor = node.data?.color;
  if (typeof dataColor === 'string' && dataColor.trim()) return dataColor;
  const styleBackground = node.style?.background;
  if (typeof styleBackground === 'string' && styleBackground.trim()) return styleBackground;
  return node.type === 'backgroundNode' ? '#e2e8f0' : '#ffffff';
};

const stripHtml = (value: string) => value.replace(/<[^>]*>/g, '').trim();

const getNodeLabel = (node: Node, options: ProjectThumbnailOptions) => {
  const data = node.data ?? {};
  const storyTitlePlacement =
    options.storyTitlePlacement === 'outside' ? 'outside-right' : options.storyTitlePlacement;
  const showInsideStoryTitle =
    options.showTitles !== false &&
    storyTitlePlacement !== 'outside-left' &&
    storyTitlePlacement !== 'outside-right';

  if (node.type === 'storyNode') {
    const source = showInsideStoryTitle ? data.title : data.text;
    return typeof source === 'string' ? stripHtml(source).slice(0, 22) : '';
  }

  const label = data.title ?? data.characterName ?? data.sceneName ?? data.content ?? '';
  return typeof label === 'string' ? stripHtml(label).slice(0, 22) : '';
};

const createEmptyThumbnail = (backgroundColor?: string | null) => {
  const bg = escapeXml(normalizeColor(backgroundColor));
  return toSvgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="${THUMBNAIL_WIDTH}" height="${THUMBNAIL_HEIGHT}" viewBox="0 0 ${THUMBNAIL_WIDTH} ${THUMBNAIL_HEIGHT}">
  <rect width="100%" height="100%" fill="${bg}"/>
  <rect x="24" y="24" width="${THUMBNAIL_WIDTH - 48}" height="${THUMBNAIL_HEIGHT - 48}" rx="18" fill="rgba(255,255,255,0.72)" stroke="#cbd5e1" stroke-dasharray="8 8"/>
</svg>`);
};

export const createProjectThumbnail = (
  nodes: Node[],
  edges: Edge[] = [],
  backgroundColor?: string | null,
  options: ProjectThumbnailOptions = {},
) => {
  const visibleNodes = nodes.filter((node) => node.type !== 'backgroundNode');
  if (visibleNodes.length === 0) return createEmptyThumbnail(backgroundColor);
  const bg = escapeXml(normalizeColor(backgroundColor));
  const nodeLookup = createThumbnailNodeLookup(nodes);

  const viewport = getViewportForBounds(
    getNodesBounds(nodes, { nodeLookup }),
    THUMBNAIL_WIDTH,
    THUMBNAIL_HEIGHT,
    0.05,
    1.5,
    THUMBNAIL_PADDING,
  );
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const edgeSvg = edges
    .map((edge) => {
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      if (!source || !target) return '';
      const start = getNodeCenter(source, viewport, nodeLookup);
      const end = getNodeCenter(target, viewport, nodeLookup);
      return `<path d="M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${((start.x + end.x) / 2).toFixed(1)} ${start.y.toFixed(1)}, ${((start.x + end.x) / 2).toFixed(1)} ${end.y.toFixed(1)}, ${end.x.toFixed(1)} ${end.y.toFixed(1)}" fill="none" stroke="#818cf8" stroke-width="3" stroke-linecap="round" opacity="0.62"/>`;
    })
    .join('\n');

  const nodeSvg = nodes
    .map((node) => {
      const size = getNodeSize(node);
      const position = getNodeAbsolutePosition(node, nodeLookup);
      const x = position.x * viewport.zoom + viewport.x;
      const y = position.y * viewport.zoom + viewport.y;
      const width = Math.max(18, size.width * viewport.zoom);
      const height = Math.max(14, size.height * viewport.zoom);
      const isBackground = node.type === 'backgroundNode';
      const label = escapeXml(getNodeLabel(node, options));
      const text =
        label && width > 64 && height > 34
          ? `<text x="${(x + 10).toFixed(1)}" y="${(y + 22).toFixed(1)}" font-family="system-ui, sans-serif" font-size="13" font-weight="800" fill="#334155">${label}</text>`
          : '';

      return `<g opacity="${isBackground ? '0.34' : '0.96'}">
  <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" rx="${isBackground ? 14 : 10}" fill="${escapeXml(getNodeFill(node))}" stroke="${isBackground ? '#cbd5e1' : '#6366f1'}" stroke-width="${isBackground ? 2 : 3}"/>
  ${text}
</g>`;
    })
    .join('\n');

  return toSvgDataUrl(`
<svg xmlns="http://www.w3.org/2000/svg" width="${THUMBNAIL_WIDTH}" height="${THUMBNAIL_HEIGHT}" viewBox="0 0 ${THUMBNAIL_WIDTH} ${THUMBNAIL_HEIGHT}">
  <rect width="100%" height="100%" fill="${bg}"/>
  <g>${edgeSvg}</g>
  <g>${nodeSvg}</g>
</svg>`);
};

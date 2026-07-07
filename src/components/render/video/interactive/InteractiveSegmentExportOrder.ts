import type { GraphPoint, LayoutDirection } from './interactiveSegmentGraphLayout';
import { segmentLinkPath } from './interactiveSegmentGraphLayout';
import type { InteractiveSegmentDraft } from './interactiveSegments';

export type SegmentGraphLink = {
  id: string;
  fromSegmentId: string;
  toSegmentId: string;
  label: string;
};

export type ExportStructureImageArgs = {
  segments: InteractiveSegmentDraft[];
  graphLinks: SegmentGraphLink[];
  renderPositions: Map<string, GraphPoint>;
  exportOrderIds: string[];
  cardWidth: number;
  cardHeight: number;
  graphWidth: number;
  graphHeight: number;
  layoutDirection: LayoutDirection;
};

const byStoryFlow = (segments: InteractiveSegmentDraft[], startSegmentId?: string) => {
  const byId = new Map(segments.map((segment) => [segment.id, segment]));
  const incoming = new Map<string, number>();
  segments.forEach((segment) => {
    segment.choices.forEach((choice) => {
      if (byId.has(choice.targetSegmentId)) {
        incoming.set(choice.targetSegmentId, (incoming.get(choice.targetSegmentId) || 0) + 1);
      }
    });
  });

  const roots = segments.filter((segment) => !incoming.has(segment.id));
  const queue = [
    ...(startSegmentId && byId.has(startSegmentId) ? [startSegmentId] : []),
    ...roots.map((segment) => segment.id),
    ...segments.map((segment) => segment.id),
  ];
  const ordered: string[] = [];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    const segment = byId.get(id);
    if (!segment) continue;
    visited.add(id);
    ordered.push(id);
    segment.choices.forEach((choice) => queue.push(choice.targetSegmentId));
  }

  return ordered;
};

export const buildInteractiveSegmentExportOrder = (
  segments: InteractiveSegmentDraft[],
  startSegmentId?: string,
) => byStoryFlow(segments, startSegmentId);

export const reconcileInteractiveSegmentExportOrder = (
  segments: InteractiveSegmentDraft[],
  exportOrderIds: string[],
  startSegmentId?: string,
) => {
  const validIds = new Set(segments.map((segment) => segment.id));
  const kept = exportOrderIds.filter((id) => validIds.has(id));
  const missing = byStoryFlow(
    segments.filter((segment) => !kept.includes(segment.id)),
    startSegmentId,
  );
  return [...kept, ...missing];
};

export const exportOrderNumberMap = (exportOrderIds: string[]) =>
  new Map(exportOrderIds.map((id, index) => [id, index + 1]));

export const sortSegmentsByExportOrder = (
  segments: InteractiveSegmentDraft[],
  exportOrderIds: string[],
) => {
  const rank = new Map(exportOrderIds.map((id, index) => [id, index]));
  return [...segments].sort(
    (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
};

const createStructureCanvas = ({
  segments,
  graphLinks,
  renderPositions,
  exportOrderIds,
  cardWidth,
  cardHeight,
  graphWidth,
  graphHeight,
  layoutDirection,
}: ExportStructureImageArgs) => {
  if (typeof document === 'undefined') return null;

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(4096, Math.max(960, Math.ceil(graphWidth))) * scale;
  canvas.height = Math.min(4096, Math.max(640, Math.ceil(graphHeight + 76))) * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.scale(scale, scale);
  const width = canvas.width / scale;
  const height = canvas.height / scale;
  const order = exportOrderNumberMap(exportOrderIds);
  const byId = new Map(segments.map((segment) => [segment.id, segment]));

  ctx.fillStyle = '#f8fbff';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(84, 76, 238, 0.16)';
  for (let x = 24; x < width; x += 56) {
    for (let y = 96; y < height; y += 56) {
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = '#111827';
  ctx.font = '800 28px sans-serif';
  ctx.fillText('Interactive Segment Export Order', 32, 44);
  ctx.fillStyle = '#64748b';
  ctx.font = '700 14px sans-serif';
  ctx.fillText('Numbers show the recommended upload order for story logic.', 34, 68);

  graphLinks.forEach((link) => {
    const from = renderPositions.get(link.fromSegmentId);
    const to = renderPositions.get(link.toSegmentId);
    if (!from || !to) return;
    const path = new Path2D(segmentLinkPath(from, to, cardWidth, cardHeight, layoutDirection, 16));
    ctx.strokeStyle = 'rgba(84, 76, 238, 0.86)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke(path);
  });

  segments.forEach((segment) => {
    const position = renderPositions.get(segment.id);
    if (!position) return;
    const number = order.get(segment.id);
    const x = position.x;
    const y = position.y + 76;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#d9e2ef';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, cardWidth, cardHeight, 14);
    ctx.fill();
    ctx.stroke();

    if (number) {
      ctx.fillStyle = '#544cee';
      ctx.beginPath();
      ctx.arc(x + 34, y + 34, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(number), x + 34, y + 35);
      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';
    }

    ctx.fillStyle = '#172033';
    ctx.font = '900 18px sans-serif';
    ctx.fillText(segment.name.slice(0, 22), x + 70, y + 34);
    ctx.fillStyle = '#7b8aa0';
    ctx.font = '700 13px sans-serif';
    ctx.fillText(`${segment.nodeIds.length} cards`, x + 70, y + 58);

    const targets = segment.choices
      .map((choice) => byId.get(choice.targetSegmentId)?.name || choice.targetSegmentId)
      .join(' / ');
    ctx.fillText(targets ? `Next: ${targets.slice(0, 46)}` : 'End segment', x + 16, y + cardHeight - 24);
  });

  return canvas;
};

export const createInteractiveSegmentStructurePngBytes = async (args: ExportStructureImageArgs) => {
  const canvas = createStructureCanvas(args);
  if (!canvas) return new Uint8Array();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  return new Uint8Array(await (blob || new Blob()).arrayBuffer());
};

export const downloadInteractiveSegmentStructureImage = async (args: ExportStructureImageArgs) => {
  const bytes = await createInteractiveSegmentStructurePngBytes(args);
  if (bytes.length === 0) return;
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `interactive-segment-structure-${Date.now()}.png`;
  link.click();
  URL.revokeObjectURL(url);
};

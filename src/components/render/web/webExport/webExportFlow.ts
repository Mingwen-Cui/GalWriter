import type { Edge, Node } from '@xyflow/react';
import { buildInteractiveSegments } from '../../video/interactive/interactiveSegments';
import type { WebExportEdge, WebExportNode } from './webExportTypes';

/** Use the preview's real segments, with already packed media. Playback data stays unchanged. */
export function buildExportWebFlow(nodes: WebExportNode[], edges: WebExportEdge[]) {
  const segments = buildInteractiveSegments(
    nodes.map((node) => ({ ...node, position: { x: 0, y: 0 } })) as Node[],
    edges.map((edge) => ({ ...edge, data: { label: edge.label } })) as Edge[],
  );
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const firstId = new Map(segments.map((segment) => [segment.id, segment.nodeIds[0]]));
  return {
    nodes: segments.map((segment) => ({
      ...byId.get(segment.nodeIds[0])!,
      segmentId: segment.id,
      nodeIds: segment.nodeIds,
    })),
    edges: segments.flatMap((segment) =>
      segment.choices.map((choice) => ({
        id: choice.id,
        source: segment.nodeIds[0],
        target: firstId.get(choice.targetSegmentId)!,
        label: choice.label,
        isChoice: segment.choices.length > 1,
      })),
    ),
  };
}

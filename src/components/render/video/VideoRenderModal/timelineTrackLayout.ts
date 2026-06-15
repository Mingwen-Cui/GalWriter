import type { Node as FlowNode } from '@xyflow/react';

import { stripHtml } from '../shared/storyNodes';
import type { TimelineSegmentMetric } from '../shared/types';

export const isVisualTimelineNode = (node?: FlowNode | null) =>
  Boolean(
    node?.data?.videoUrl ||
      node?.data?.imageUrl ||
      stripHtml(String(node?.data?.text || '')).trim(),
  );

export const isAudioOnlyNode = (node?: FlowNode | null) =>
  Boolean(node?.data?.audioUrl) && !isVisualTimelineNode(node);

const overlaps = (startA: number, endA: number, startB: number, endB: number) =>
  startA < endB - 0.001 && endA > startB + 0.001;

export const calculateVideoTrackLayout = ({
  segments,
  changedIds,
  trackIds,
  trackByNodeId,
  createTrackId,
}: {
  segments: TimelineSegmentMetric[];
  changedIds: Set<string>;
  trackIds: string[];
  trackByNodeId: Record<string, string>;
  createTrackId: () => string;
}) => {
  const visualSegments = segments.filter((segment) => isVisualTimelineNode(segment.node));
  if (visualSegments.length === 0) return null;

  const changedTrackCounts = new Map<string, number>();
  changedIds.forEach((id) => {
    const trackId = trackByNodeId[id] || trackIds[0];
    if (trackId) changedTrackCounts.set(trackId, (changedTrackCounts.get(trackId) || 0) + 1);
  });
  const sharedTrackId =
    changedIds.size > 1
      ? [...changedTrackCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ||
        trackIds[0] ||
        'video-1'
      : undefined;

  const orderedSegments = visualSegments
    .map((segment) => ({
      ...segment,
      currentTrackId: trackByNodeId[segment.node.id] || trackIds[0] || 'video-1',
    }))
    .sort((a, b) => {
      const priorityDifference =
        Number(changedIds.has(b.node.id)) - Number(changedIds.has(a.node.id));
      if (priorityDifference !== 0) return priorityDifference;
      if (a.start !== b.start) return a.start - b.start;
      return a.end - b.end;
    });

  const nextTrackIds = [...trackIds];
  const nextTrackByNodeId = { ...trackByNodeId };
  const trackOccupancy = new Map<string, (typeof orderedSegments)[number][]>();
  const ensureTrack = (trackId: string) => {
    if (!trackOccupancy.has(trackId)) trackOccupancy.set(trackId, []);
    if (!nextTrackIds.includes(trackId)) nextTrackIds.push(trackId);
  };
  const canPlace = (trackId: string, segment: (typeof orderedSegments)[number]) =>
    !(trackOccupancy.get(trackId) || []).some((other) =>
      overlaps(segment.start, segment.end, other.start, other.end),
    );
  const place = (trackId: string, segment: (typeof orderedSegments)[number]) => {
    ensureTrack(trackId);
    trackOccupancy.get(trackId)!.push(segment);
    nextTrackByNodeId[segment.node.id] = trackId;
  };

  orderedSegments.forEach((segment) => {
    const preferredTrackId =
      (changedIds.has(segment.node.id) ? sharedTrackId : undefined) || segment.currentTrackId;
    const candidateTrackIds = [preferredTrackId, ...nextTrackIds].filter(
      (trackId, index, list): trackId is string => !!trackId && list.indexOf(trackId) === index,
    );
    place(
      candidateTrackIds.find((trackId) => canPlace(trackId, segment)) || createTrackId(),
      segment,
    );
  });

  return { trackIds: nextTrackIds, trackByNodeId: nextTrackByNodeId, visualSegments };
};

import type { TimelineScaleMode, TimelineSegmentMetric } from '../shared/types';

type TrackKind = 'video' | 'audio';

export const snapTimelineTime = ({
  time,
  enabled,
  scaleMode,
  frameRate,
}: {
  time: number;
  enabled: boolean;
  scaleMode: TimelineScaleMode;
  frameRate: number;
}) => {
  if (!enabled) return Math.max(0, time);
  const step = scaleMode === 'frames' ? 1 / frameRate : 0.25;
  return Math.max(0, Math.round(time / step) * step);
};

export const snapToTimelineClipEdges = ({
  nodeId,
  wantedStart,
  duration,
  enabled,
  pixelsPerSecond,
  segments,
  snapTime,
  excludedNodeIds,
  snapToTime,
}: {
  nodeId: string;
  wantedStart: number;
  duration: number;
  enabled: boolean;
  pixelsPerSecond: number;
  segments: TimelineSegmentMetric[];
  snapTime: (time: number) => number;
  excludedNodeIds?: Iterable<string>;
  snapToTime?: number;
}) => {
  if (!enabled) return Math.max(0, wantedStart);
  const gridStart = snapTime(wantedStart);
  const excludedIds = new Set(excludedNodeIds || [nodeId]);
  excludedIds.add(nodeId);
  const tolerance = Math.max(0.12, 18 / Math.max(1, pixelsPerSecond));
  const candidates = segments
    .filter((segment) => !excludedIds.has(segment.node.id))
    .flatMap((segment) => [
      segment.start,
      segment.end,
      segment.start - duration,
      segment.end - duration,
    ])
    .concat(
      typeof snapToTime === 'number'
        ? [snapToTime, snapToTime - duration]
        : [],
    )
    .map((candidate) => Math.max(0, candidate));
  const nearestEdge = candidates.reduce<{ time: number; distance: number } | null>(
    (nearest, candidate) => {
      const distance = Math.abs(candidate - wantedStart);
      if (distance > tolerance || (nearest && distance >= nearest.distance)) return nearest;
      return { time: candidate, distance };
    },
    null,
  );
  return nearestEdge?.time ?? gridStart;
};

export const findNonOverlappingTrackStart = ({
  nodeId,
  wantedStart,
  duration,
  trackKind,
  trackId,
  segments,
  videoTrackByNodeId,
  audioTrackByNodeId,
  snapToEdges,
  snapTime,
}: {
  nodeId: string;
  wantedStart: number;
  duration: number;
  trackKind: TrackKind;
  trackId: string;
  segments: TimelineSegmentMetric[];
  videoTrackByNodeId: Record<string, string>;
  audioTrackByNodeId: Record<string, string>;
  snapToEdges: (nodeId: string, wantedStart: number, duration: number) => number;
  snapTime: (time: number) => number;
}) => {
  const assignedTrackByNodeId = trackKind === 'video' ? videoTrackByNodeId : audioTrackByNodeId;
  const siblings = segments
    .filter(
      (segment) =>
        segment.node.id !== nodeId &&
        assignedTrackByNodeId[segment.node.id] === trackId,
    )
    .sort((a, b) => a.start - b.start);
  let nextStart = snapToEdges(nodeId, wantedStart, duration);
  const overlaps = (start: number, segment: TimelineSegmentMetric) =>
    start < segment.end - 0.001 && start + duration > segment.start + 0.001;

  for (const segment of siblings) {
    if (!overlaps(nextStart, segment)) continue;
    if (nextStart < segment.start) {
      const beforeStart = snapTime(Math.max(0, segment.start - duration));
      if (!overlaps(beforeStart, segment)) return beforeStart;
    }
    nextStart = snapTime(segment.end);
  }
  return nextStart;
};

export const hasTrackSpace = ({
  nodeId,
  start,
  duration,
  trackId,
  segments,
  trackByNodeId,
}: {
  nodeId: string;
  start: number;
  duration: number;
  trackId: string;
  segments: TimelineSegmentMetric[];
  trackByNodeId: Record<string, string>;
}) =>
  !segments.some(
    (segment) =>
      segment.node.id !== nodeId &&
      trackByNodeId[segment.node.id] === trackId &&
      start < segment.end - 0.001 &&
      start + duration > segment.start + 0.001,
  );

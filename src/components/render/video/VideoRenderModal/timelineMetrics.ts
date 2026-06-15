import type { Node as FlowNode } from '@xyflow/react';

import type { TimelineSegmentMetric } from '../shared/types';

export type VideoTimelineMetrics = {
  segments: TimelineSegmentMetric[];
  totalDuration: number;
  displayDuration: number;
  width: number;
  pixelsPerSecond: number;
};

export const calculateTimelineMetrics = ({
  nodes,
  durationById,
  startById,
  defaultSeconds,
  speed,
  displayDuration,
  pixelsPerSecond,
}: {
  nodes: FlowNode[];
  durationById: Record<string, number>;
  startById: Record<string, number>;
  defaultSeconds: number;
  speed: number;
  displayDuration: number;
  pixelsPerSecond: number;
}): VideoTimelineMetrics => {
  let cursor = 0;
  const segments = nodes.map((node) => {
    const mediaDuration = durationById[node.id] || defaultSeconds;
    const duration = Math.max(0.25, mediaDuration / speed);
    const start = startById[node.id] ?? cursor;
    const metric = { node, start, duration, end: start + duration };
    cursor += duration;
    return metric;
  });
  const totalDuration = Math.max(0.25, ...segments.map((segment) => segment.end));
  const resolvedDisplayDuration = Math.max(totalDuration, displayDuration);
  const width = Math.max(1, Math.ceil(resolvedDisplayDuration * pixelsPerSecond));

  return {
    segments,
    totalDuration,
    displayDuration: resolvedDisplayDuration,
    width,
    pixelsPerSecond: width / resolvedDisplayDuration,
  };
};

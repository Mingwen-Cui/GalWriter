import type { Node } from '@xyflow/react';

import { resolveRegionBackgroundMusic } from '../../../../lib/regionMusic';
import type { SegmentRenderInfo, TimelineSegmentMetric } from '../shared/types';

/** Build BGM independently of voice/video audio so adjacent cards never restart it. */
export const buildRegionMusicSegments = (
  nodes: Node[],
  metrics: TimelineSegmentMetric[],
): SegmentRenderInfo[] => {
  const segments: SegmentRenderInfo[] = [];
  for (const metric of [...metrics].sort((a, b) => a.start - b.start)) {
    const sourceId = metric.node.data?.timelineSourceNodeId;
    const source = nodes.find(node => node.id === (sourceId || metric.node.id)) || metric.node;
    const match = resolveRegionBackgroundMusic(nodes, source);
    if (!match || metric.duration <= 0) continue;
    const previous = [...segments].reverse().find(segment =>
      segment.node.data.regionId === match.regionId && segment.audioUrl === match.music.url &&
      (segment.startSecs || 0) + segment.durationSecs >= metric.start - 0.000001);
    const key = `region-music:${match.regionId}`;
    if (previous) {
      previous.durationSecs = Math.max((previous.startSecs || 0) + previous.durationSecs, metric.end) - (previous.startSecs || 0);
      continue;
    }
    segments.push({
      node: {
        id: `${key}:${metric.node.id}:${metric.start}`, type: 'regionMusic', position: { x: 0, y: 0 },
        data: { ...match.music, audioUrl: match.music.url, title: match.music.name || source.data?.title || match.regionId, regionId: match.regionId },
      },
      startSecs: metric.start, durationSecs: metric.duration, audioUrl: match.music.url,
      volume: match.music.volume, loop: match.music.loop,
      fadeIn: match.music.fadeIn, fadeOut: match.music.fadeOut,
    });
  }
  return segments;
};

export const regionMusicTimelineMetrics = (segments: SegmentRenderInfo[]): TimelineSegmentMetric[] =>
  segments.map(segment => ({
    node: segment.node, start: segment.startSecs || 0,
    duration: segment.durationSecs, end: (segment.startSecs || 0) + segment.durationSecs,
  }));

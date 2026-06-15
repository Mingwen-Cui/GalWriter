import type { Node as FlowNode } from '@xyflow/react';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect } from 'react';

import { getAudioDuration, loadVideo, validDuration } from '../shared/mediaUtils';

export const useMediaDurations = ({
  timelineNodes,
  defaultSeconds,
  speed,
  setTimelineDurationById,
}: {
  timelineNodes: FlowNode[];
  defaultSeconds: number;
  speed: number;
  setTimelineDurationById: Dispatch<SetStateAction<Record<string, number>>>;
}) => {
  const getNodeMediaDuration = useCallback(
    async (node: FlowNode) => {
      const videoUrl = node.data?.videoUrl as string | undefined;
      const audioUrl = node.data?.audioUrl as string | undefined;
      let videoDuration = 0;
      let audioDuration = 0;

      if (videoUrl) {
        try {
          videoDuration = validDuration((await loadVideo(videoUrl)).duration);
        } catch {
          videoDuration = 0;
        }
      }
      if (audioUrl) audioDuration = validDuration(await getAudioDuration(audioUrl));

      const mediaDuration = Math.max(videoDuration, audioDuration);
      return mediaDuration > 0 ? mediaDuration : defaultSeconds;
    },
    [defaultSeconds],
  );

  const getNodeRenderDuration = useCallback(
    async (node: FlowNode) => (await getNodeMediaDuration(node)) / speed,
    [getNodeMediaDuration, speed],
  );

  useEffect(() => {
    let cancelled = false;
    const measure = async () => {
      const entries: [string, number][] = [];
      for (const node of timelineNodes) {
        if (cancelled) return;
        entries.push([node.id, await getNodeMediaDuration(node)]);
      }
      if (!cancelled) setTimelineDurationById(Object.fromEntries(entries));
    };
    void measure();
    return () => {
      cancelled = true;
    };
  }, [getNodeMediaDuration, setTimelineDurationById, timelineNodes]);

  return { getNodeMediaDuration, getNodeRenderDuration };
};

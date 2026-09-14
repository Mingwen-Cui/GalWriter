import type { Node as FlowNode } from '@xyflow/react';
import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect } from 'react';

import { getAudioDuration, loadVideo, validDuration } from '../shared/mediaUtils';
import type { StoryPresentation } from '../../../../domain/project';
import {
  getPresentationEnterDuration,
  getPresentationExitDuration,
  normalizeStoryPresentation,
} from '../../../../lib/presentation';
import {
  buildInlinePlaybackSteps,
  getInlineActionDuration,
} from '../../../../lib/inlinePresentationPlayback';

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
  const getInlineMotionDuration = useCallback((node: FlowNode) => {
    const presentation = normalizeStoryPresentation(
      node.data?.presentation as StoryPresentation | undefined,
    );
    const steps = buildInlinePlaybackSteps(String(node.data?.text || ''), presentation, {
      hideCharacterTags: false,
      hideSceneTags: false,
    });
    const actionDurationMs = steps.reduce(
      (sum, step) => (step.kind === 'action' ? sum + getInlineActionDuration(step.action) : sum),
      0,
    );
    return actionDurationMs / 1000;
  }, []);

  const getPresentationNodeDuration = useCallback((node: FlowNode) => {
    const presentation = normalizeStoryPresentation(
      node.data?.presentation as StoryPresentation | undefined,
    );
    return (
      (getPresentationEnterDuration(presentation) + getPresentationExitDuration(presentation)) /
      1000
    );
  }, []);

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
      const inlineDuration = getInlineMotionDuration(node);
      const presentationDuration = getPresentationNodeDuration(node);
      const renderedDuration =
        presentationDuration + Math.max(mediaDuration, inlineDuration + 0.1, defaultSeconds);
      return renderedDuration > 0 ? renderedDuration : defaultSeconds;
    },
    [defaultSeconds, getInlineMotionDuration, getPresentationNodeDuration],
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

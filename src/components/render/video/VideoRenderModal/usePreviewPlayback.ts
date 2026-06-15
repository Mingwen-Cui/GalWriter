import type { Node as FlowNode } from '@xyflow/react';
import type { Dispatch, SetStateAction } from 'react';
import { useEffect } from 'react';

import type { RenderStatus, TimelineSegmentMetric } from '../shared/types';
import type { PreviewAudioSegment } from './usePreviewAudio';

export const usePreviewPlayback = ({
  focusedPreviewNode,
  focusedTimelineMetric,
  activeAudioSegments,
  activeTimelineTime,
  previewPlaying,
  previewTime,
  previewDuration,
  speed,
  status,
  timelineTotalDuration,
  getNodeMediaDuration,
  getSegmentAudioSources,
  stopPreviewAudio,
  syncPreviewAudioSegments,
  seekTimelineTime,
  setPreviewDuration,
  setPreviewPlaying,
  setPreviewTime,
  setTimelinePreviewTime,
}: {
  focusedPreviewNode?: FlowNode;
  focusedTimelineMetric?: TimelineSegmentMetric;
  activeAudioSegments: TimelineSegmentMetric[];
  activeTimelineTime: number;
  previewPlaying: boolean;
  previewTime: number;
  previewDuration: number;
  speed: number;
  status: RenderStatus;
  timelineTotalDuration: number;
  getNodeMediaDuration: (node: FlowNode) => Promise<number>;
  getSegmentAudioSources: (
    node: FlowNode,
  ) => { kind: string; url: string }[];
  stopPreviewAudio: () => void;
  syncPreviewAudioSegments: (
    segments: PreviewAudioSegment[],
    shouldPlay: boolean,
  ) => Promise<void>;
  seekTimelineTime: (
    time: number,
    options?: { keepPlaying?: boolean; preserveFocus?: boolean },
  ) => void;
  setPreviewDuration: Dispatch<SetStateAction<number>>;
  setPreviewPlaying: Dispatch<SetStateAction<boolean>>;
  setPreviewTime: Dispatch<SetStateAction<number>>;
  setTimelinePreviewTime: Dispatch<SetStateAction<number>>;
}) => {
  useEffect(() => {
    if (!focusedPreviewNode) {
      setPreviewDuration(Math.max(0.1, timelineTotalDuration));
      return;
    }
    let cancelled = false;
    void getNodeMediaDuration(focusedPreviewNode).then((duration) => {
      if (!cancelled) setPreviewDuration(duration);
    });
    return () => {
      cancelled = true;
    };
  }, [
    focusedPreviewNode,
    getNodeMediaDuration,
    setPreviewDuration,
    timelineTotalDuration,
  ]);

  useEffect(() => {
    if (status === 'rendering') {
      stopPreviewAudio();
      return;
    }
    if (focusedPreviewNode) {
      void syncPreviewAudioSegments(
        getSegmentAudioSources(focusedPreviewNode).map((source) => ({
          key: `focused-${source.kind}`,
          audioUrl: source.url,
          localTime: previewTime,
        })),
        previewPlaying,
      );
      return;
    }
    const segments = activeAudioSegments
      .filter(
        (metric) =>
          activeTimelineTime >= metric.start && activeTimelineTime < metric.end,
      )
      .flatMap((metric) =>
        getSegmentAudioSources(metric.node).map((source) => ({
          key: `${metric.node.id}-${source.kind}`,
          audioUrl: source.url,
          localTime: (activeTimelineTime - metric.start) * speed,
        })),
      );
    void syncPreviewAudioSegments(segments, previewPlaying);
  }, [
    activeAudioSegments,
    activeTimelineTime,
    focusedPreviewNode,
    getSegmentAudioSources,
    previewPlaying,
    previewTime,
    speed,
    status,
    stopPreviewAudio,
    syncPreviewAudioSegments,
  ]);

  useEffect(() => {
    if (!previewPlaying || status === 'rendering') return;
    const startedAt = performance.now();
    const startTimelineTime = activeTimelineTime;
    const startPreviewTime = previewTime;
    const timer = window.setInterval(() => {
      const elapsed = (performance.now() - startedAt) / 1000;
      if (focusedTimelineMetric) {
        const nextPreviewTime = startPreviewTime + elapsed * speed;
        if (nextPreviewTime >= previewDuration) {
          setPreviewTime(previewDuration);
          setTimelinePreviewTime(focusedTimelineMetric.end);
          setPreviewPlaying(false);
          return;
        }
        setPreviewTime(nextPreviewTime);
        setTimelinePreviewTime(
          focusedTimelineMetric.start + nextPreviewTime / speed,
        );
        return;
      }
      const nextTime = startTimelineTime + elapsed;
      if (nextTime >= timelineTotalDuration) {
        seekTimelineTime(timelineTotalDuration);
        setPreviewPlaying(false);
        return;
      }
      seekTimelineTime(nextTime, { keepPlaying: true });
    }, 120);
    return () => window.clearInterval(timer);
  }, [
    activeTimelineTime,
    focusedTimelineMetric,
    previewDuration,
    previewPlaying,
    previewTime,
    seekTimelineTime,
    setPreviewPlaying,
    setPreviewTime,
    setTimelinePreviewTime,
    speed,
    status,
    timelineTotalDuration,
  ]);
};

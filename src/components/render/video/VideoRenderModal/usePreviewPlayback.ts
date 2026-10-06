import type { Node as FlowNode } from '@xyflow/react';
import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useRef } from 'react';

import type { RenderStatus, TimelineSegmentMetric } from '../shared/types';
import type { PreviewAudioSegment } from './usePreviewAudio';

export const usePreviewPlayback = ({
  focusedPreviewNode,
  focusedTimelineMetric,
  activeAudioSegments,
  regionAudioSegments,
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
  regionAudioSegments: TimelineSegmentMetric[];
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
  const playbackFrameRef = useRef<number | null>(null);
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
    const regionSegments = regionAudioSegments
      .filter(metric => activeTimelineTime >= metric.start && activeTimelineTime < metric.end)
      .map(metric => ({
        key: metric.node.id,
        audioUrl: String(metric.node.data.audioUrl),
        localTime: (activeTimelineTime - metric.start) * speed,
        duration: metric.duration * speed,
        loop: metric.node.data.loop === true,
        volume: Number(metric.node.data.volume ?? 0.5),
        fadeIn: Number(metric.node.data.fadeIn ?? 0) * speed,
        fadeOut: Number(metric.node.data.fadeOut ?? 0) * speed,
      }));
    if (focusedPreviewNode) {
      void syncPreviewAudioSegments(
        [...getSegmentAudioSources(focusedPreviewNode).map((source) => ({
          key: `focused-${source.kind}`,
          audioUrl: source.url,
          localTime: previewTime,
        })), ...regionSegments],
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
    void syncPreviewAudioSegments([...segments, ...regionSegments], previewPlaying);
  }, [
    activeAudioSegments,
    regionAudioSegments,
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
    const tick = () => {
      const elapsed = (performance.now() - startedAt) / 1000;
      if (focusedTimelineMetric) {
        const nextPreviewTime = startPreviewTime + elapsed * speed;
        if (nextPreviewTime >= previewDuration) {
          setPreviewTime(previewDuration);
          setTimelinePreviewTime(focusedTimelineMetric.end);
          setPreviewPlaying(false);
          playbackFrameRef.current = null;
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
        playbackFrameRef.current = null;
        return;
      }
      seekTimelineTime(nextTime, { keepPlaying: true });
      playbackFrameRef.current = window.requestAnimationFrame(tick);
    };
    playbackFrameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (playbackFrameRef.current !== null) {
        window.cancelAnimationFrame(playbackFrameRef.current);
        playbackFrameRef.current = null;
      }
    };
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

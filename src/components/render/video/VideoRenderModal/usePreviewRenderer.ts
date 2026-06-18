import type { Node as FlowNode } from '@xyflow/react';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef } from 'react';

import { clamp, loadVideo, seekVideo } from '../shared/mediaUtils';
import type {
  RenderStatus,
  RenderStyle,
  TimelineSegmentMetric,
  VideoTextScaleMode,
} from '../shared/types';
import { drawRenderFrame } from '../preview/frameRenderer';

type Resolution = { width: number; height: number };
type FrameMedia = { source: CanvasImageSource; width: number; height: number };

export const usePreviewRenderer = ({
  canvasRef,
  nodes,
  focusedPreviewNode,
  previewTime,
  previewDuration,
  timelinePreviewTime,
  timelineSegments,
  videoTrackByNodeId,
  videoTrackIds,
  resolution,
  renderStyle,
  videoTextScaleMode,
  animationLeadSeconds,
  isZh,
  hideCharacterTags,
  hideSceneTags,
  speed,
  status,
  segmentText,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  nodes: FlowNode[];
  focusedPreviewNode?: FlowNode;
  previewTime: number;
  previewDuration: number;
  timelinePreviewTime: number;
  timelineSegments: TimelineSegmentMetric[];
  videoTrackByNodeId: Record<string, string>;
  videoTrackIds: string[];
  resolution: Resolution;
  renderStyle: RenderStyle;
  videoTextScaleMode: VideoTextScaleMode;
  animationLeadSeconds: number;
  isZh: boolean;
  hideCharacterTags: boolean;
  hideSceneTags: boolean;
  speed: number;
  status: RenderStatus;
  segmentText: (node: FlowNode) => string;
}) => {
  const previewVideoRef = useRef<{ url: string; video: HTMLVideoElement } | null>(null);
  const previewDrawIdRef = useRef(0);

  const drawFrame = useCallback(
    async (
      ctx: CanvasRenderingContext2D,
      node: FlowNode,
      width: number,
      height: number,
      media?: FrameMedia,
      elapsed?: number,
      duration?: number,
      forceFinalText = false,
    ) => {
      await drawRenderFrame({
        ctx,
        node,
        width,
        height,
        media,
        elapsed,
        duration,
        forceFinalText,
        renderStyle,
        videoTextScaleMode,
        animationLeadSeconds,
        isZh,
        nodes,
        hideCharacterTags,
        hideSceneTags,
      });
    },
    [
      animationLeadSeconds,
      hideCharacterTags,
      hideSceneTags,
      isZh,
      nodes,
      renderStyle,
      videoTextScaleMode,
    ],
  );

  const getTopVisualTimelineSegment = useCallback(
    (time: number) =>
      timelineSegments
        .filter((metric) => {
          const trackId = videoTrackByNodeId[metric.node.id] || videoTrackIds[0];
          return (
            videoTrackIds.includes(trackId) &&
            time >= metric.start &&
            time < metric.end &&
            (metric.node.data?.videoUrl ||
              metric.node.data?.imageUrl ||
              segmentText(metric.node))
          );
        })
        .sort((a, b) => {
          const aIndex = videoTrackIds.indexOf(
            videoTrackByNodeId[a.node.id] || videoTrackIds[0],
          );
          const bIndex = videoTrackIds.indexOf(
            videoTrackByNodeId[b.node.id] || videoTrackIds[0],
          );
          return bIndex - aIndex;
        })[0],
    [segmentText, timelineSegments, videoTrackByNodeId, videoTrackIds],
  );

  const drawTimelineCompositeFrame = useCallback(
    async (ctx: CanvasRenderingContext2D, width: number, height: number, time: number) => {
      const segment = getTopVisualTimelineSegment(time);
      if (!segment) {
        ctx.fillStyle = '#111827';
        ctx.fillRect(0, 0, width, height);
        return;
      }
      const localTime = clamp((time - segment.start) * speed, 0, segment.duration * speed);
      const videoUrl = segment.node.data?.videoUrl as string | undefined;
      if (videoUrl) {
        if (previewVideoRef.current?.url !== videoUrl) {
          previewVideoRef.current?.video.pause();
          previewVideoRef.current = { url: videoUrl, video: await loadVideo(videoUrl) };
        }
        const video = previewVideoRef.current.video;
        await seekVideo(video, localTime);
        await drawFrame(
          ctx,
          segment.node,
          width,
          height,
          {
            source: video,
            width: video.videoWidth || width,
            height: video.videoHeight || height,
          },
          localTime,
          segment.duration * speed,
        );
        return;
      }
      await drawFrame(
        ctx,
        segment.node,
        width,
        height,
        undefined,
        localTime,
        segment.duration * speed,
      );
    },
    [drawFrame, getTopVisualTimelineSegment, speed],
  );

  useEffect(() => {
    if (status === 'rendering') return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let cancelled = false;
    if (canvas.width !== resolution.width) canvas.width = resolution.width;
    if (canvas.height !== resolution.height) canvas.height = resolution.height;

    const drawPreview = async () => {
      const drawId = ++previewDrawIdRef.current;
      if (!focusedPreviewNode) {
        await drawTimelineCompositeFrame(
          ctx,
          resolution.width,
          resolution.height,
          timelinePreviewTime,
        );
        return;
      }
      const videoUrl = focusedPreviewNode.data?.videoUrl as string | undefined;
      if (videoUrl) {
        try {
          if (previewVideoRef.current?.url !== videoUrl) {
            previewVideoRef.current?.video.pause();
            previewVideoRef.current = { url: videoUrl, video: await loadVideo(videoUrl) };
          }
          const video = previewVideoRef.current.video;
          await seekVideo(video, previewTime);
          if (cancelled || drawId !== previewDrawIdRef.current) return;
          await drawFrame(
            ctx,
            focusedPreviewNode,
            resolution.width,
            resolution.height,
            {
              source: video,
              width: video.videoWidth || resolution.width,
              height: video.videoHeight || resolution.height,
            },
            previewTime,
            previewDuration,
          );
          return;
        } catch {
          if (cancelled) return;
        }
      } else if (previewVideoRef.current) {
        previewVideoRef.current.video.pause();
        previewVideoRef.current = null;
      }
      if (cancelled || drawId !== previewDrawIdRef.current) return;
      await drawFrame(
        ctx,
        focusedPreviewNode,
        resolution.width,
        resolution.height,
        undefined,
        previewTime,
        previewDuration,
      );
    };

    void drawPreview().catch(() => {
      if (cancelled) return;
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, resolution.width, resolution.height);
    });
    return () => {
      cancelled = true;
    };
  }, [
    canvasRef,
    drawFrame,
    drawTimelineCompositeFrame,
    focusedPreviewNode,
    previewDuration,
    previewTime,
    resolution.height,
    resolution.width,
    status,
    timelinePreviewTime,
  ]);

  useEffect(
    () => () => {
      previewVideoRef.current?.video.pause();
      previewVideoRef.current = null;
    },
    [],
  );

  return { drawFrame };
};

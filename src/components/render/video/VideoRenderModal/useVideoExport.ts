import type { Node as FlowNode } from '@xyflow/react';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { useRef, useState } from 'react';

import type { Language } from '../../../../lib/i18n';
import { resolveRegionBackgroundMusic } from '../../../../lib/regionMusic';
import { buildAudioBuffer } from '../audio/audioTrack';
import { saveRenderedImage, saveRenderedVideo } from '../export/tauriRenderAdapter';
import { renderVideoCoverPngBytes } from '../export/videoCover';
import { getVideoTextForChinesePreference } from '../i18n';
import { formatVideoText } from '../i18n';
import { DEFAULT_VIDEO_BITRATE } from '../shared/constants';
import { loadVideo, seekVideo, validDuration } from '../shared/mediaUtils';
import type {
  ExportFormat,
  RenderStatus,
  SegmentRenderInfo,
  TimelineSegmentMetric,
  VideoCoverSettings,
} from '../shared/types';

type DrawFrame = (
  ctx: CanvasRenderingContext2D,
  node: FlowNode,
  width: number,
  height: number,
  media?: { source: CanvasImageSource; width: number; height: number },
  elapsed?: number,
  duration?: number,
  forceFinalText?: boolean,
) => Promise<void>;

export const useVideoExport = ({
  canvasRef,
  nodes,
  selectedNodes,
  activeAudioSegments,
  status,
  language,
  isZh,
  isDesktopApp,
  resolution,
  frameRate,
  exportFormat,
  outputDir,
  speed,
  videoCover,
  drawFrame,
  getNodeRenderDuration,
  getSegmentAudioSources,
  setStatus,
  setError,
  setSavedPath,
  setProgress,
  setProgressValue,
}: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  nodes: FlowNode[];
  selectedNodes: FlowNode[];
  activeAudioSegments: TimelineSegmentMetric[];
  status: RenderStatus;
  language: Language;
  isZh: boolean;
  isDesktopApp: boolean;
  resolution: { width: number; height: number };
  frameRate: number;
  exportFormat: ExportFormat;
  outputDir: string;
  speed: number;
  videoCover?: VideoCoverSettings | null;
  drawFrame: DrawFrame;
  getNodeRenderDuration: (node: FlowNode) => Promise<number>;
  getSegmentAudioSources: (node: FlowNode) => { kind: string; url: string }[];
  setStatus: Dispatch<SetStateAction<RenderStatus>>;
  setError: Dispatch<SetStateAction<string>>;
  setSavedPath: Dispatch<SetStateAction<string>>;
  setProgress: Dispatch<SetStateAction<string>>;
  setProgressValue: Dispatch<SetStateAction<number>>;
}) => {
  const [isCancellingRender, setIsCancellingRender] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const renderVideo = async (options?: {
    fileName?: string;
    frameRate?: number;
    exportFormat?: ExportFormat;
    speed?: number;
    videoBitrate?: number;
    nodes?: FlowNode[];
    audioSegments?: TimelineSegmentMetric[];
    outputDir?: string;
    progressPrefix?: string;
    returnBytes?: boolean;
  }) => {
    const resolvedFrameRate = options?.frameRate ?? frameRate;
    const resolvedFormat = options?.exportFormat ?? exportFormat;
    const resolvedSpeed = options?.speed ?? speed;
    const resolvedVideoBitrate = options?.videoBitrate ?? DEFAULT_VIDEO_BITRATE;
    const renderNodes = options?.nodes ?? selectedNodes;
    const renderAudioSegments = options?.audioSegments ?? activeAudioSegments;
    const resolvedOutputDir = options?.outputDir ?? outputDir;
    const fileName = options?.fileName;
    if (renderNodes.length === 0 || (status === 'rendering' && !options?.returnBytes)) return;
    const canvas2d =
      canvasRef.current ?? (options?.returnBytes ? document.createElement('canvas') : null);
    const ctx2d = canvas2d?.getContext('2d');
    if (!canvas2d || !ctx2d) return;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setIsCancellingRender(false);
    setStatus('rendering');
    setError('');
    setSavedPath('');
    setProgressValue(0);
    setProgress(
      formatVideoText(language, 'componentsrendervideoVideoRenderModaluseVideoExportText110'),
    );

    const canvas = canvas2d;
    const throwIfCancelled = () => abortController.signal.throwIfAborted();

    try {
      throwIfCancelled();
      canvas.width = resolution.width;
      canvas.height = resolution.height;
      const nodeDurations: number[] = [];
      let totalDuration = 0;
      for (const node of renderNodes) {
        throwIfCancelled();
        const duration = await getNodeRenderDuration(node);
        nodeDurations.push(duration);
        totalDuration += duration;
      }
      const totalFrames = Math.max(1, Math.ceil(totalDuration * resolvedFrameRate));

      const audioSegments: SegmentRenderInfo[] = renderAudioSegments.flatMap((segment) =>
        getSegmentAudioSources(segment.node).map((source) => ({
          node: segment.node,
          startSecs: segment.start,
          durationSecs: segment.duration,
          audioUrl: source.url,
          volume: Number(segment.node.data?.volume ?? 1),
          fadeIn: Number(segment.node.data?.fadeIn ?? 0),
          fadeOut: Number(segment.node.data?.fadeOut ?? 0),
        })),
      );
      let regionCursor = 0;
      renderNodes.forEach((node, index) => {
        const duration = nodeDurations[index];
        if (renderAudioSegments.length === 0) {
          getSegmentAudioSources(node).forEach((source) => {
            audioSegments.push({
              node,
              startSecs: regionCursor,
              durationSecs: duration,
              audioUrl: source.url,
              volume: Number(node.data?.volume ?? 1),
              fadeIn: Number(node.data?.fadeIn ?? 0),
              fadeOut: Number(node.data?.fadeOut ?? 0),
            });
          });
        }
        const match = resolveRegionBackgroundMusic(nodes, node);
        const previous = audioSegments[audioSegments.length - 1];
        const canExtend =
          match &&
          previous?.node.id === `region-music:${match.regionId}` &&
          previous.audioUrl === match.music.url &&
          previous.startSecs !== undefined &&
          previous.startSecs + previous.durationSecs === regionCursor;
        if (canExtend) {
          previous.durationSecs += duration;
          previous.fadeOut = match.music.fadeOut;
        } else if (match) {
          audioSegments.push({
            node: {
              id: `region-music:${match.regionId}`,
              type: 'regionMusic',
              position: { x: 0, y: 0 },
              data: {},
            },
            startSecs: regionCursor,
            durationSecs: duration,
            audioUrl: match.music.url,
            volume: match.music.volume,
            loop: match.music.loop,
            fadeIn: match.music.fadeIn,
            fadeOut: match.music.fadeOut,
          });
        }
        regionCursor += duration;
      });
      const audioBuffer = await buildAudioBuffer(audioSegments, resolvedSpeed, totalDuration);
      throwIfCancelled();

      const videoCache = new Map<string, HTMLVideoElement>();
      for (const node of renderNodes) {
        throwIfCancelled();
        const videoUrl = node.data?.videoUrl as string | undefined;
        if (videoUrl && !videoCache.has(videoUrl)) {
          videoCache.set(videoUrl, await loadVideo(videoUrl));
        }
      }
      const nodeStartTimes: number[] = [];
      let cursor = 0;
      nodeDurations.forEach((duration) => {
        nodeStartTimes.push(cursor);
        cursor += duration;
      });
      const resolveFrame = (timestamp: number) => {
        let nodeIndex = renderNodes.length - 1;
        for (let index = 0; index < renderNodes.length; index += 1) {
          if (timestamp < nodeStartTimes[index] + nodeDurations[index]) {
            nodeIndex = index;
            break;
          }
        }
        const node = renderNodes[nodeIndex];
        const nodeDuration = nodeDurations[nodeIndex];
        return {
          node,
          nodeIndex,
          nodeDuration,
          localTime: (timestamp - nodeStartTimes[nodeIndex]) * resolvedSpeed,
        };
      };
      const loadFrameMedia = async (node: FlowNode, localTime: number) => {
        const videoUrl = node.data?.videoUrl as string | undefined;
        const video = videoUrl ? videoCache.get(videoUrl) : undefined;
        if (!video) return undefined;
        await seekVideo(video, Math.min(localTime, validDuration(video.duration)));
        return {
          source: video,
          width: video.videoWidth || resolution.width,
          height: video.videoHeight || resolution.height,
        };
      };
      const reportNode = (node: FlowNode, nodeIndex: number) =>
        setProgress(
          `${options?.progressPrefix ? `${options.progressPrefix} ` : ''}${nodeIndex + 1}/${renderNodes.length} ${String(node.data?.title || '')}`,
        );

      const drawFrame2D = async (_frameIndex: number, timestamp: number) => {
        throwIfCancelled();
        const { node, nodeIndex, nodeDuration, localTime } = resolveFrame(timestamp);
        await drawFrame(
          ctx2d,
          node,
          resolution.width,
          resolution.height,
          await loadFrameMedia(node, localTime),
          localTime,
          nodeDuration * resolvedSpeed,
        );
        reportNode(node, nodeIndex);
      };
      const { renderVideoToBuffer } = await import('../export/browserVideoEncoder');
      const bytes = await renderVideoToBuffer({
        canvas,
        format: resolvedFormat,
        frameRate: resolvedFrameRate,
        totalFrames,
        drawFrame: drawFrame2D,
        audioBuffer: audioBuffer || undefined,
        onProgress: (current, total) => {
          setProgressValue(Math.round((current / total) * 100));
        },
        signal: abortController.signal,
      });
      throwIfCancelled();

      if (options?.returnBytes) {
        return bytes;
      }

      const baseFileName = fileName?.trim() || `galwriter-render-${Date.now()}`;
      const coverBytes = videoCover
        ? await renderVideoCoverPngBytes({
            settings: videoCover,
            nodes,
            width: videoCover.canvasSettings?.canvasWidth || resolution.width,
            height: videoCover.canvasSettings?.canvasHeight || resolution.height,
          })
        : null;

      if (isDesktopApp) {
        const result = await saveRenderedVideo({
          fileName: baseFileName,
          format: resolvedFormat,
          bytes: Array.from(bytes),
          outputDir: resolvedOutputDir,
          videoBitrate: String(resolvedVideoBitrate),
        });
        if (coverBytes) {
          const coverResult = await saveRenderedImage({
            fileName: `${baseFileName}-cover`,
            bytes: Array.from(coverBytes),
            outputDir: resolvedOutputDir,
          });
          setSavedPath(`${result.path}\n${coverResult.path}`);
        } else {
          setSavedPath(result.path);
        }
      } else {
        const mimeType =
          resolvedFormat === 'mov'
            ? 'video/quicktime'
            : resolvedFormat === 'mkv'
              ? 'video/x-matroska'
              : 'video/mp4';
        const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `${baseFileName}.${resolvedFormat}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        if (coverBytes) {
          const coverUrl = URL.createObjectURL(new Blob([coverBytes], { type: 'image/png' }));
          const coverLink = document.createElement('a');
          coverLink.href = coverUrl;
          coverLink.download = `${baseFileName}-cover.png`;
          document.body.appendChild(coverLink);
          coverLink.click();
          coverLink.remove();
          URL.revokeObjectURL(coverUrl);
          setSavedPath(`${baseFileName}.${resolvedFormat}\n${baseFileName}-cover.png`);
        } else {
          setSavedPath(`${baseFileName}.${resolvedFormat}`);
        }
      }
      setStatus('done');
      setProgressValue(100);
      setProgress(
        getVideoTextForChinesePreference(
          isZh,
          'componentsrendervideoVideoRenderModaluseVideoExportIsZhText299',
        ),
      );
      return bytes;
    } catch (error: any) {
      if (error?.name === 'AbortError' || abortController.signal.aborted) {
        setStatus('idle');
        setError('');
        setProgressValue(0);
        setProgress(
          formatVideoText(language, 'componentsrendervideoVideoRenderModaluseVideoExportText304'),
        );
      } else {
        console.error('Video render failed:', error);
        setStatus('error');
        setError(
          error?.message ||
            formatVideoText(language, 'componentsrendervideoVideoRenderModaluseVideoExportText309'),
        );
      }
    } finally {
      if (abortControllerRef.current === abortController) abortControllerRef.current = null;
      setIsCancellingRender(false);
    }
  };

  const cancelVideoRender = () => {
    const controller = abortControllerRef.current;
    if (!controller || controller.signal.aborted) return;
    setIsCancellingRender(true);
    setProgress(
      formatVideoText(language, 'componentsrendervideoVideoRenderModaluseVideoExportText322'),
    );
    controller.abort();
  };

  return { isCancellingRender, renderVideo, cancelVideoRender };
};

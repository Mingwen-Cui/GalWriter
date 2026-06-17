import type { Node as FlowNode } from '@xyflow/react';
import { Pause, Play } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import { RangeControl } from '../controls/RenderControls';
import { renderCopy } from '../shared/renderCopy';
import type { RenderStatus } from '../shared/types';
import { formatSeconds } from '../timeline/timelineUtils';
import type { Language } from '../../../../lib/i18n';

type VideoPreviewPanelProps = {
  language: Language;
  resolution: { label: string; width: number; height: number };
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  activeTimelineFrame: number;
  activeTimelineTime: number;
  frameRate: number;
  timelineScaleMode: 'seconds' | 'frames';
  focusedPreviewNode?: FlowNode;
  activePreviewNode?: FlowNode;
  focusedTimelineMetric?: { start: number };
  previewPlaying: boolean;
  previewTime: number;
  previewDuration: number;
  timelinePreviewTime: number;
  timelineNodes: FlowNode[];
  timelineMetrics: { totalDuration: number };
  status: RenderStatus;
  speed: number;
  setPreviewPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  setPreviewTime: (value: number) => void;
  setTimelinePreviewTime: (value: number) => void;
  seekTimelineTime: (time: number) => void;
  openContextMenu: (
    event: React.MouseEvent<HTMLElement>,
    target: { kind: 'preview'; nodeId?: string },
  ) => void;
};

export function VideoPreviewPanel({
  language,
  resolution,
  canvasRef,
  activeTimelineFrame,
  activeTimelineTime,
  frameRate,
  timelineScaleMode,
  focusedPreviewNode,
  activePreviewNode,
  focusedTimelineMetric,
  previewPlaying,
  previewTime,
  previewDuration,
  timelinePreviewTime,
  timelineNodes,
  timelineMetrics,
  status,
  speed,
  setPreviewPlaying,
  setPreviewTime,
  setTimelinePreviewTime,
  seekTimelineTime,
  openContextMenu,
}: VideoPreviewPanelProps) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const controlBarRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [controlBarHeight, setControlBarHeight] = useState(0);

  const videoAspect = useMemo(
    () => Math.max(0.01, resolution.width / Math.max(1, resolution.height)),
    [resolution.height, resolution.width],
  );

  useLayoutEffect(() => {
    const element = stageRef.current;
    if (!element) return;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      setStageSize({ width: rect.width, height: rect.height });
    };

    measure();

    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => measure());
    observer.observe(element);
    return () => observer.disconnect();
  }, [resolution.height, resolution.width]);

  useLayoutEffect(() => {
    const element = controlBarRef.current;
    if (!element) return;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      setControlBarHeight(rect.height);
    };

    measure();

    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => measure());
    observer.observe(element);
    return () => observer.disconnect();
  }, [previewPlaying, previewDuration, timelineNodes.length, resolution.width, resolution.height]);

  const fittedSize = useMemo(() => {
    const videoMaxHeight = Math.max(0, stageSize.height - controlBarHeight);
    if (stageSize.width <= 0 || videoMaxHeight <= 0) return null;

    const widthLimitedHeight = stageSize.width / videoAspect;
    if (widthLimitedHeight <= videoMaxHeight) {
      return { width: stageSize.width, height: widthLimitedHeight };
    }

    return { width: videoMaxHeight * videoAspect, height: videoMaxHeight };
  }, [controlBarHeight, stageSize.height, stageSize.width, videoAspect]);

  return (
    <section className="min-h-0 min-w-0 flex flex-1 flex-col overflow-hidden bg-[var(--vr-surface-soft)]">
      <div className="grid h-12 grid-cols-[1fr_auto_1fr] items-center border-b border-[var(--vr-border)] px-4">
        <div className="flex min-w-0 items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--vr-text-soft)]">
          <Play className="w-4 h-4 text-[var(--vr-accent)]" />
          {t('测试预览窗口', 'プレビュー画面', 'Preview Monitor')}
        </div>
        <div className="rounded bg-[var(--vr-surface)] px-2 py-1 text-[11px] font-black tabular-nums text-[var(--vr-text)]">
          {timelineScaleMode === 'frames'
            ? `${t('帧', 'フレーム', 'Frame')} ${activeTimelineFrame}`
            : `${formatSeconds(activeTimelineTime)} / ${activeTimelineFrame}f`}
        </div>
        <div className="flex min-w-0 items-center justify-end gap-3 text-[11px] font-bold text-[var(--vr-text-muted)]">
          <span>{resolution.label}</span>
          <span>{frameRate} fps</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 p-4 xl:p-5">
        <div ref={stageRef} className="flex h-full min-h-0 items-center justify-center overflow-hidden">
          <div
            className="flex min-w-0 flex-col"
            style={{
              width: fittedSize ? `${fittedSize.width}px` : '100%',
              maxWidth: '100%',
              visibility: fittedSize ? 'visible' : 'hidden',
            }}
          >
            <div
              className="relative w-full overflow-hidden rounded-t-lg border border-[var(--vr-border-strong)] border-b-0 bg-black"
              style={{
                height: fittedSize ? `${fittedSize.height}px` : '100%',
                boxShadow: 'var(--vr-shadow)',
              }}
              onContextMenu={(event) =>
                openContextMenu(event, {
                  kind: 'preview',
                  nodeId: focusedPreviewNode?.id || activePreviewNode?.id,
                })
              }
            >
              <div className="absolute inset-0 bg-black">
                <canvas ref={canvasRef} className="block h-full w-full bg-black" />
              </div>
            </div>

            <div
              ref={controlBarRef}
              className="w-full rounded-b-lg border border-[var(--vr-border)] bg-[var(--vr-surface)] px-3 py-2 shadow-sm"
            >
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (focusedPreviewNode) {
                      if (previewTime >= previewDuration) setPreviewTime(0);
                    } else if (timelinePreviewTime >= timelineMetrics.totalDuration) {
                      setTimelinePreviewTime(0);
                    }
                    setPreviewPlaying((prev) => !prev);
                  }}
                  disabled={timelineNodes.length === 0 || status === 'rendering'}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--vr-accent-soft)] text-[var(--vr-accent-strong)] hover:bg-[var(--vr-surface-soft)] disabled:opacity-40"
                  title={
                    previewPlaying
                      ? t('暂停预览', 'プレビューを一時停止', 'Pause preview')
                      : t('播放预览', 'プレビューを再生', 'Play preview')
                  }
                >
                  {previewPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </button>
                <div className="min-w-0 flex-1">
                  <RangeControl
                    label={t('预览位置', 'プレビュー位置', 'Preview position')}
                    min={0}
                    max={Math.max(0.1, previewDuration)}
                    step={0.05}
                    value={
                      focusedPreviewNode
                        ? Math.min(previewTime, previewDuration)
                        : Math.min(timelinePreviewTime, previewDuration)
                    }
                    valueLabel={`${
                      focusedPreviewNode
                        ? formatSeconds(previewTime)
                        : formatSeconds(timelinePreviewTime)
                    } / ${formatSeconds(previewDuration)}`}
                    disabled={timelineNodes.length === 0 || status === 'rendering'}
                    hideLabel
                    onChange={(nextValue) => {
                      setPreviewPlaying(false);
                      const safeValue = Math.max(0, nextValue || 0);
                      if (focusedTimelineMetric) {
                        setPreviewTime(safeValue);
                        setTimelinePreviewTime(focusedTimelineMetric.start + safeValue / speed);
                        return;
                      }
                      setTimelinePreviewTime(safeValue);
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

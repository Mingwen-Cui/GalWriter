import type { Node as FlowNode } from '@xyflow/react';
import { Pause, Play } from 'lucide-react';

import { MIN_PREVIEW_WIDTH } from '../shared/constants';
import { RangeControl } from '../controls/RenderControls';
import { renderCopy } from '../shared/renderCopy';
import type { RenderStatus } from '../shared/types';
import { formatSeconds } from '../timeline/timelineUtils';
import type { Language } from '../../../../lib/i18n';

type VideoPreviewPanelProps = {
  language: Language;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  activeTimelineFrame: number;
  activeTimelineTime: number;
  resolution: { label: string };
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
  openContextMenu: (event: React.MouseEvent<HTMLElement>, target: { kind: 'preview'; nodeId?: string }) => void;
};

export function VideoPreviewPanel({
  language,
  canvasRef,
  activeTimelineFrame,
  activeTimelineTime,
  resolution,
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

  return (
              <section
                className="min-h-0 min-w-0 bg-[var(--vr-surface-soft)] flex flex-col flex-1"
                style={{ minWidth: MIN_PREVIEW_WIDTH }}
              >
                <div className="grid h-12 grid-cols-[1fr_auto_1fr] items-center border-b border-[var(--vr-border)] px-4">
                  <div className="flex min-w-0 items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--vr-text-soft)]">
                    <Play className="w-4 h-4 text-[var(--vr-accent)]" />
                    {t('测试预览窗口', 'プレビューモニター', 'Preview Monitor')}
                  </div>
                  <div className="rounded bg-[var(--vr-surface)] px-2 py-1 text-[11px] font-black tabular-nums text-[var(--vr-text)]">
                    {timelineScaleMode === 'frames'
                      ? `${t('帧', 'フレーム', 'Frame')} ${activeTimelineFrame}`
                      : `${formatSeconds(activeTimelineTime)} · ${activeTimelineFrame}f`}
                  </div>
                  <div className="flex min-w-0 items-center justify-end gap-3 text-[11px] font-bold text-[var(--vr-text-muted)]">
                    <span>{resolution.label}</span>
                    <span>{frameRate} fps</span>
                  </div>
                </div>
                <div className="min-h-0 flex-1 p-4 xl:p-5">
                  <div className="h-full min-h-0 flex items-center justify-center">
                    <div className="grid h-full w-fit max-w-full grid-rows-[minmax(0,1fr)_auto] gap-3">
                      <div className="min-h-0">
                        <div
                          className="relative h-full max-h-full max-w-full aspect-video rounded-lg bg-black border border-[var(--vr-border-strong)] overflow-hidden"
                          style={{ boxShadow: 'var(--vr-shadow)' }}
                          onContextMenu={(event) =>
                            openContextMenu(event, {
                              kind: 'preview',
                              nodeId: focusedPreviewNode?.id || activePreviewNode?.id,
                            })
                          }
                        >
                          <canvas ref={canvasRef} className="w-full h-full block bg-black" />
                        </div>
                      </div>
                      <div className="w-full rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface)] px-3 py-2 shadow-sm">
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
                            className="h-7 w-7 rounded-md bg-[var(--vr-accent-soft)] text-[var(--vr-accent-strong)] flex items-center justify-center hover:bg-[var(--vr-surface-soft)] disabled:opacity-40"
                            title={
                              previewPlaying
                                ? t('暂停预览', 'プレビューを一時停止', 'Pause preview')
                                : t('播放预览', 'プレビューを再生', 'Play preview')
                            }
                          >
                            {previewPlaying ? (
                              <Pause className="h-3.5 w-3.5" />
                            ) : (
                              <Play className="h-3.5 w-3.5" />
                            )}
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

import type { Node as FlowNode } from '@xyflow/react';
import { Lock, LockKeyholeOpen, Maximize, Minimize, Pause, Play } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { Language } from '../../../../lib/i18n';
import { htmlToSpeechText } from '../../../../lib/tts';
import type { SharedCanvasSettings } from '../../canvas/canvasSettings';
import { RangeControl } from '../controls/RenderControls';
import { getDialogueBoxLayout } from '../shared/dialogueBoxRenderer';
import { getRenderObjects, updateRenderObject } from '../shared/renderObjects';
import { renderCopy } from '../shared/renderCopy';
import { wrapText } from '../shared/storyNodes';
import type { RenderEditableObjectKind, RenderStatus, RenderStyle, VideoTextScaleMode } from '../shared/types';
import { getVideoTextRenderStyle } from '../shared/videoTextScale';
import { formatSeconds } from '../timeline/timelineUtils';
import { WebEditableElementFrame, type WebEditableResizeHandle } from '../../web/WebEditableElementFrame';

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
  renderStyle: RenderStyle;
  updateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
  canvasSettings: SharedCanvasSettings;
  videoTextScaleMode: VideoTextScaleMode;
  canvasSelected: boolean;
  setCanvasSelected: (selected: boolean) => void;
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
  renderStyle,
  updateRenderStyle,
  canvasSettings,
  videoTextScaleMode,
  canvasSelected,
  setCanvasSelected,
}: VideoPreviewPanelProps) {
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const controlBarRef = useRef<HTMLDivElement | null>(null);
  const previewFullscreenRef = useRef<HTMLDivElement | null>(null);
  const selectionBeforeFullscreenRef = useRef<{ kind?: RenderEditableObjectKind; canvas: boolean } | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [controlBarHeight, setControlBarHeight] = useState(0);
  const [previewObjectSelectionLocked, setPreviewObjectSelectionLocked] = useState(false);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [activeAlignmentGuides, setActiveAlignmentGuides] = useState<{ x?: number; y?: number }>({});

  const videoAspect = useMemo(
    () => Math.max(0.01, resolution.width / Math.max(1, resolution.height)),
    [resolution.height, resolution.width],
  );

  useEffect(() => {
    const syncFullscreenState = () => {
      const fullscreen = document.fullscreenElement === previewFullscreenRef.current;
      setPreviewFullscreen(fullscreen);
      if (!fullscreen && selectionBeforeFullscreenRef.current) {
        const selection = selectionBeforeFullscreenRef.current;
        selectionBeforeFullscreenRef.current = null;
        setCanvasSelected(selection.canvas);
        updateRenderStyle('selectedRenderObject', selection.kind);
      }
    };
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => document.removeEventListener('fullscreenchange', syncFullscreenState);
  }, [updateRenderStyle]);

  const togglePreviewFullscreen = async () => {
    if (document.fullscreenElement === previewFullscreenRef.current) {
      await document.exitFullscreen?.();
      return;
    }
    selectionBeforeFullscreenRef.current = {
      kind: renderStyle.selectedRenderObject,
      canvas: canvasSelected,
    };
    setCanvasSelected(false);
    updateRenderStyle('selectedRenderObject', undefined);
    await previewFullscreenRef.current?.requestFullscreen?.();
  };

  const updateObject = (kind: RenderEditableObjectKind, patch: Parameters<typeof updateRenderObject>[2]) => {
    updateRenderStyle('renderObjects', updateRenderObject(renderStyle, kind, patch));
  };

  const videoRenderStyle = useMemo(
    () => getVideoTextRenderStyle(renderStyle, videoTextScaleMode, resolution.height),
    [renderStyle, resolution.height, videoTextScaleMode],
  );
  const editableFrames = useMemo(() => {
    const objects = getRenderObjects(renderStyle);
    const dialog = getDialogueBoxLayout(resolution.width, resolution.height, videoRenderStyle);
    const paddingX = dialog.paddingX ?? dialog.padding;
    const paddingY = dialog.paddingY ?? dialog.padding;
    const contentWidth = Math.max(48, dialog.width - paddingX * 2);
    const titleSize = Math.max(18, videoRenderStyle.titleFontSize);
    const bodySize = Math.max(16, videoRenderStyle.bodyFontSize);
    const titleLineHeight = Math.round(titleSize * Math.max(0.8, videoRenderStyle.titleLineHeight));
    const bodyLineHeight = Math.round(bodySize * Math.max(0.8, videoRenderStyle.bodyLineHeight));
    const textContext = canvasRef.current?.getContext('2d');
    const currentNode = focusedPreviewNode || activePreviewNode;
    const titleWidth = contentWidth * Math.max(0.08, objects.title.width / 100);
    const bodyWidth = contentWidth * Math.max(0.08, objects.body.width / 100);
    if (textContext) textContext.font = `800 ${titleSize}px ${videoRenderStyle.titleFontFamily}`;
    const titleLines = objects.title.visible
      ? wrapText(textContext || ({ measureText: () => ({ width: 0 }) } as unknown as CanvasRenderingContext2D), htmlToSpeechText(String(currentNode?.data?.title || '')) || ' ', titleWidth).slice(0, 2)
      : [];
    if (textContext) textContext.font = `500 ${bodySize}px ${videoRenderStyle.bodyFontFamily}`;
    const bodyLines = wrapText(textContext || ({ measureText: () => ({ width: 0 }) } as unknown as CanvasRenderingContext2D), htmlToSpeechText(String(currentNode?.data?.text || '')) || ' ', bodyWidth).slice(0, 7);
    const textGap = titleLines.length && bodyLines.length ? Math.round(bodySize * 0.6) : 0;
    const fixedTextHeight = titleLines.length * titleLineHeight + textGap + bodyLines.length * bodyLineHeight;
    const textBaselineOffset = Math.round(bodySize * 0.35);
    const textTop = dialog.y + Math.max(paddingY, (dialog.height - fixedTextHeight) / 2) + textBaselineOffset;
    const renderedTitleHeight = Math.max(titleLineHeight, titleLines.length * titleLineHeight);
    const titleHeight = Math.max(titleLineHeight, renderedTitleHeight + (objects.title.height - 24));
    const bodyHeight = Math.max(bodyLineHeight, bodyLines.length * bodyLineHeight + (objects.body.height - 64));
    const nameplateHeight = Math.max(20, videoRenderStyle.nameplateFontSize * 2.1 + (objects.nameplate.height - 42));
    return {
      dialogBox: { x: dialog.x, y: dialog.y, width: dialog.width, height: dialog.height },
      title: { x: dialog.x + paddingX + objects.title.x, y: textTop + objects.title.y - titleSize, width: titleWidth, height: titleHeight },
      body: { x: dialog.x + paddingX + objects.body.x, y: textTop + renderedTitleHeight + textGap + objects.body.y - bodySize, width: bodyWidth, height: bodyHeight },
      nameplate: { x: dialog.x + dialog.width * 0.33 + objects.nameplate.x, y: dialog.y - nameplateHeight + objects.nameplate.y, width: dialog.width * 0.34 * Math.max(0.5, objects.nameplate.width / 100), height: nameplateHeight },
    };
  }, [activePreviewNode, canvasRef, focusedPreviewNode, renderStyle, resolution.height, resolution.width, videoRenderStyle]);

  const startMove = (event: React.PointerEvent<HTMLDivElement>, kind: RenderEditableObjectKind) => {
    if (previewObjectSelectionLocked || event.button === 2) return;
    event.preventDefault(); event.stopPropagation();
    setCanvasSelected(false);
    updateRenderStyle('selectedRenderObject', kind);
    const object = getRenderObjects(renderStyle)[kind];
    const frame = editableFrames[kind];
    const startX = event.clientX; const startY = event.clientY;
    const hostRect = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!hostRect) return;
    const move = (moveEvent: PointerEvent) => {
      const rawDx = (moveEvent.clientX - startX) * resolution.width / hostRect.width;
      const rawDy = (moveEvent.clientY - startY) * resolution.height / hostRect.height;
      const otherFrames = Object.entries(editableFrames)
        .filter(([otherKind]) => otherKind !== kind)
        .map(([, otherFrame]) => otherFrame);
      const xCandidates = [0, resolution.width / 2, resolution.width, ...otherFrames.flatMap((otherFrame) => [otherFrame.x, otherFrame.x + otherFrame.width / 2, otherFrame.x + otherFrame.width])];
      const yCandidates = [0, resolution.height / 2, resolution.height, ...otherFrames.flatMap((otherFrame) => [otherFrame.y, otherFrame.y + otherFrame.height / 2, otherFrame.y + otherFrame.height])];
      const snapAxis = (origin: number, size: number, delta: number, candidates: number[]) => {
        const movingPoints = [origin + delta, origin + delta + size / 2, origin + delta + size];
        let closest: { adjustment: number; guide: number } | null = null;
        movingPoints.forEach((point) => candidates.forEach((candidate) => {
          const adjustment = candidate - point;
          if (Math.abs(adjustment) > 8 || (closest && Math.abs(adjustment) >= Math.abs(closest.adjustment))) return;
          closest = { adjustment, guide: candidate };
        }));
        return closest;
      };
      const xSnap = snapAxis(frame.x, frame.width, rawDx, xCandidates);
      const ySnap = snapAxis(frame.y, frame.height, rawDy, yCandidates);
      const dx = rawDx + (xSnap?.adjustment || 0);
      const dy = rawDy + (ySnap?.adjustment || 0);
      setActiveAlignmentGuides({ x: xSnap?.guide, y: ySnap?.guide });
      if (kind === 'dialogBox') updateObject(kind, { x: Math.round(object.x + dx * 200 / Math.max(1, resolution.width - frame.width)), y: Math.round(object.y + dy * 100 / Math.max(1, resolution.height - frame.height)) });
      else updateObject(kind, { x: Math.round(object.x + dx), y: Math.round(object.y + dy) });
    };
    const end = () => { setActiveAlignmentGuides({}); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end);
  };
  const startResize = (event: React.PointerEvent<HTMLElement>, kind: RenderEditableObjectKind, handle: WebEditableResizeHandle) => {
    if (previewObjectSelectionLocked) return;
    const object = getRenderObjects(renderStyle)[kind]; const frame = editableFrames[kind];
    const startX = event.clientX; const startY = event.clientY;
    const hostRect = event.currentTarget.parentElement?.parentElement?.getBoundingClientRect();
    if (!hostRect) return;
    const move = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) * resolution.width / hostRect.width;
      const dy = (moveEvent.clientY - startY) * resolution.height / hostRect.height;
      const widthDelta = kind === 'dialogBox' ? dx * 100 / resolution.width : dx * 100 / Math.max(1, frame.width);
      const heightDelta = kind === 'dialogBox' ? dy * 100 / resolution.height : dy * 100 / Math.max(1, frame.height);
      const minWidth = kind === 'dialogBox' ? 35 : 8;
      const minHeight = kind === 'dialogBox' ? 16 : 8;
      let nextWidth = object.width + (handle.includes('e') ? widthDelta : handle.includes('w') ? -widthDelta : 0);
      let nextHeight = object.height + (handle.includes('s') ? heightDelta : handle.includes('n') ? -heightDelta : 0);
      const offsetX = kind === 'dialogBox' ? dx * 200 / Math.max(1, resolution.width - frame.width) : dx;
      const offsetY = kind === 'dialogBox' ? dy * 100 / Math.max(1, resolution.height - frame.height) : dy;
      const nextX = handle.includes('w') ? object.x + offsetX : object.x;
      const nextY = handle.includes('n') ? object.y + offsetY : object.y;
      nextWidth = Math.max(minWidth, nextWidth);
      nextHeight = Math.max(minHeight, nextHeight);
      updateObject(kind, { x: Math.round(nextX), y: Math.round(nextY), width: Math.round(nextWidth), height: Math.round(nextHeight) });
    };
    const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', end);
  };

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
      <div className="border-b border-[var(--vr-border)] px-4 py-2">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center">
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
        <div className="mt-2 flex min-w-0 items-center gap-1.5">
          {([
            ['scene', t('画面', '画面', 'Scene')],
            ['dialogBox', t('对话框背景', 'ダイアログ背景', 'Dialog box')],
            ['title', t('标题', 'タイトル', 'Title')],
            ['body', t('正文', '本文', 'Body')],
            ['nameplate', t('人物名牌', 'ネームプレート', 'Nameplate')],
          ] as Array<[RenderEditableObjectKind | 'scene', string]>).map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              onClick={() => {
                const selectingCanvas = kind === 'scene';
                setCanvasSelected(selectingCanvas);
                updateRenderStyle('selectedRenderObject', selectingCanvas ? undefined : kind);
              }}
              className={`h-7 rounded-md px-2.5 text-xs font-bold transition-colors ${(kind === 'scene' ? canvasSelected : !canvasSelected && renderStyle.selectedRenderObject === kind) ? 'bg-[var(--vr-accent)] text-white' : 'bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] hover:bg-[var(--vr-accent-soft)]'}`}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={previewObjectSelectionLocked}
            onClick={() => setPreviewObjectSelectionLocked((locked) => !locked)}
            className={`ml-auto flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-bold transition-colors ${previewObjectSelectionLocked ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] hover:bg-[var(--vr-accent-soft)]'}`}
          >
            {previewObjectSelectionLocked ? <Lock className="h-3.5 w-3.5" /> : <LockKeyholeOpen className="h-3.5 w-3.5" />}
            {previewObjectSelectionLocked ? t('已锁定', 'ロック中', 'Locked') : t('未锁定', '未ロック', 'Unlocked')}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 p-4 xl:p-5">
        <div ref={stageRef} className="flex h-full min-h-0 items-center justify-center overflow-hidden">
          <div
            ref={previewFullscreenRef}
            className={`flex min-w-0 flex-col ${previewFullscreen ? 'h-screen w-screen items-center justify-center bg-black' : ''}`}
            style={{
              width: previewFullscreen ? '100vw' : fittedSize ? `${fittedSize.width}px` : '100%',
              maxWidth: previewFullscreen ? 'none' : '100%',
              height: previewFullscreen ? '100vh' : undefined,
              visibility: fittedSize ? 'visible' : 'hidden',
            }}
          >
            <div
              className={`relative w-full overflow-hidden rounded-t-lg border border-b-0 bg-black ${canvasSettings.layoutMode === 'classic' && !renderStyle.selectedRenderObject ? 'border-indigo-500 ring-2 ring-inset ring-indigo-500/70' : 'border-[var(--vr-border-strong)]'}`}
              style={{
                height: previewFullscreen
                  ? 'min(calc(100vh - 44px), calc(100vw * 9 / 16))'
                  : fittedSize ? `${fittedSize.height}px` : '100%',
                width: previewFullscreen ? '100vw' : undefined,
                boxShadow: 'var(--vr-shadow)',
              }}
              onClick={() => {
                if (previewObjectSelectionLocked || previewFullscreen) return;
                setCanvasSelected(true);
                updateRenderStyle('selectedRenderObject', undefined);
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
              {canvasSelected && !previewObjectSelectionLocked && !previewFullscreen && (
                <div className="pointer-events-none absolute inset-0 z-20 ring-2 ring-inset ring-indigo-500" />
              )}
              {!previewFullscreen && (activeAlignmentGuides.x !== undefined || activeAlignmentGuides.y !== undefined) && (
                <div className="pointer-events-none absolute inset-0 z-30">
                  {activeAlignmentGuides.x !== undefined && (
                    <div
                      className="absolute top-0 h-full border-l-[1.5px] border-dashed border-red-500 shadow-[0_0_5px_rgba(239,68,68,0.55)]"
                      style={{ left: `${activeAlignmentGuides.x / resolution.width * 100}%` }}
                    />
                  )}
                  {activeAlignmentGuides.y !== undefined && (
                    <div
                      className="absolute left-0 w-full border-t-[1.5px] border-dashed border-red-500 shadow-[0_0_5px_rgba(239,68,68,0.55)]"
                      style={{ top: `${activeAlignmentGuides.y / resolution.height * 100}%` }}
                    />
                  )}
                </div>
              )}
              {!previewObjectSelectionLocked && !previewFullscreen && (Object.entries(editableFrames) as Array<[RenderEditableObjectKind, typeof editableFrames.dialogBox]>).map(([kind, frame]) => {
                const selected = !canvasSelected && renderStyle.selectedRenderObject === kind;
                return (
                  <div
                    key={kind}
                    className={`absolute z-20 touch-none ${selected ? 'cursor-grab' : 'cursor-pointer'}`}
                    data-render-object={kind}
                    style={{ left: `${frame.x / resolution.width * 100}%`, top: `${frame.y / resolution.height * 100}%`, width: `${frame.width / resolution.width * 100}%`, height: `${frame.height / resolution.height * 100}%` }}
                    onPointerDown={(event) => { event.stopPropagation(); startMove(event, kind); }}
                    onClick={(event) => { event.stopPropagation(); setCanvasSelected(false); updateRenderStyle('selectedRenderObject', kind); }}
                  >
                    {selected && <WebEditableElementFrame
                      visible
                      showAuxiliaryControls={false}
                      onToggleVisible={() => undefined}
                      onRotatePointerDown={() => undefined}
                      onResizePointerDown={(event, handle) => startResize(event, kind, handle)}
                    />}
                  </div>
                );
              })}
            </div>

            <div
              ref={controlBarRef}
              className="w-full shrink-0 rounded-b-lg border border-[var(--vr-border)] bg-[var(--vr-surface)] px-3 py-2 shadow-sm"
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
                <button
                  type="button"
                  onClick={togglePreviewFullscreen}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--vr-text-soft)] transition-colors hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)]"
                  title={previewFullscreen ? t('退出全屏', '全画面を終了', 'Exit fullscreen') : t('全屏预览', '全画面プレビュー', 'Fullscreen preview')}
                  aria-label={previewFullscreen ? t('退出全屏', '全画面を終了', 'Exit fullscreen') : t('全屏预览', '全画面プレビュー', 'Fullscreen preview')}
                >
                  {previewFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

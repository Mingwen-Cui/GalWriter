import type { Edge, Node } from '@xyflow/react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  GripHorizontal,
  MonitorPlay,
  RotateCcw,
  Type,
  X,
} from 'lucide-react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { Language } from '../../../lib/i18n';
import type { SharedCanvasSettings } from '../canvas/canvasSettings';
import { CanvasSettingsSection } from '../canvas/CanvasSettingsSection';
import { RenderObjectSettingsSection } from '../shared/inspectors/RenderObjectSettingsSection';
import { renderObjectText } from '../video/objectInspector/i18n';
import type { RenderEditableObjectKind, RenderStyle } from '../video/shared/types';
import { getPlaytestText } from './i18n';
import {
  createPlaytestCanvasModel,
  drawPlaytestCanvasModelFrame,
  getPlaytestCanvasSelectionBox,
  type PlaytestCanvasSelection,
  type PlaytestRuntimeSettings,
  resolvePlaytestCanvasSelection,
} from './model/playtestCanvasModel';

export type { PlaytestRuntimeSettings } from './model/playtestCanvasModel';

export type PlaytestSettingsWorkbenchProps = {
  language: Language;
  canvasSettings: SharedCanvasSettings;
  onCanvasSettingsChange: (patch: Partial<SharedCanvasSettings>) => void;
  runtimeSettings: PlaytestRuntimeSettings;
  onRuntimeSettingsChange: (patch: Partial<PlaytestRuntimeSettings>) => void;
  renderStyle: RenderStyle;
  updateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
  nodes?: Node[];
  edges?: Edge[];
  showPreview?: boolean;
};

type WorkbenchSelection = PlaytestCanvasSelection;
type PreviewPosition = { x: number; y: number };
type PreviewResizeCorner = 'top-left' | 'top-right' | 'bottom-right' | 'bottom-left';

const PREVIEW_EDGE_PADDING = 12;
const PREVIEW_MIN_WIDTH = 420;
const PREVIEW_MIN_HEIGHT = 320;
const PREVIEW_MAX_WIDTH = 960;
const PREVIEW_MAX_HEIGHT = 720;

export function PlaytestSettingsWorkbench({
  language,
  canvasSettings,
  onCanvasSettingsChange,
  runtimeSettings,
  onRuntimeSettingsChange,
  renderStyle,
  updateRenderStyle,
  nodes = [],
  edges = [],
  showPreview = true,
}: PlaytestSettingsWorkbenchProps) {
  const text = getPlaytestText(language);
  const objectText = renderObjectText(language);
  const [selection, setSelection] = useState<WorkbenchSelection>(
    canvasSettings.layoutMode === 'classic'
      ? 'scene'
      : renderStyle.selectedRenderObject || 'dialogBox',
  );
  const previewWindowRef = useRef<HTMLDivElement>(null);
  const previewDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const previewResizeRef = useRef<{
    pointerId: number;
    corner: PreviewResizeCorner;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    originWidth: number;
    originHeight: number;
    aspectRatio: number;
  } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showParameterDescriptions, setShowParameterDescriptions] = useState(true);
  const [previewWidth, setPreviewWidth] = useState(560);
  const [previewPosition, setPreviewPosition] = useState<PreviewPosition>(() => ({
    x: typeof window === 'undefined' ? 24 : Math.max(12, (window.innerWidth - 560) / 2),
    y: 72,
  }));

  const clampPreviewPosition = (position: PreviewPosition): PreviewPosition => {
    if (typeof window === 'undefined') return position;
    const bounds = previewWindowRef.current?.getBoundingClientRect();
    const width = bounds?.width || Math.min(previewWidth, window.innerWidth - PREVIEW_EDGE_PADDING * 2);
    const height = bounds?.height || 400;
    return {
      x: Math.max(
        PREVIEW_EDGE_PADDING,
        Math.min(position.x, window.innerWidth - width - PREVIEW_EDGE_PADDING),
      ),
      y: Math.max(
        PREVIEW_EDGE_PADDING,
        Math.min(position.y, window.innerHeight - height - PREVIEW_EDGE_PADDING),
      ),
    };
  };

  const getPreviewWidthLimits = (aspectRatio: number) => {
    const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
    const viewportHeight = typeof window === 'undefined' ? 720 : window.innerHeight;
    const availableWidth = Math.max(280, viewportWidth - previewPosition.x - PREVIEW_EDGE_PADDING);
    const availableHeight = Math.max(240, viewportHeight - previewPosition.y - PREVIEW_EDGE_PADDING);
    const maximum = Math.max(
      280,
      Math.min(PREVIEW_MAX_WIDTH, PREVIEW_MAX_HEIGHT * aspectRatio, availableWidth, availableHeight * aspectRatio),
    );
    const minimum = Math.min(
      maximum,
      Math.max(PREVIEW_MIN_WIDTH, PREVIEW_MIN_HEIGHT * aspectRatio),
    );
    return { minimum, maximum };
  };

  useEffect(() => {
    if (!showPreview) setPreviewOpen(false);
  }, [showPreview]);

  useEffect(() => {
    const selectedObject = renderStyle.selectedRenderObject;
    if (selectedObject && selection !== selectedObject) {
      setSelection(selectedObject);
    }
  }, [renderStyle.selectedRenderObject, selection]);

  useEffect(() => {
    if (!previewOpen) return;
    const keepPreviewVisible = () => {
      const bounds = previewWindowRef.current?.getBoundingClientRect();
      const aspectRatio = bounds && bounds.height > 0 ? bounds.width / bounds.height : 1.4;
      const limits = getPreviewWidthLimits(aspectRatio);
      setPreviewWidth((current) => Math.max(limits.minimum, Math.min(current, limits.maximum)));
      setPreviewPosition((current) => clampPreviewPosition(current));
    };
    keepPreviewVisible();
    window.addEventListener('resize', keepPreviewVisible);
    return () => window.removeEventListener('resize', keepPreviewVisible);
  }, [previewOpen]);

  const beginPreviewDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
    event.preventDefault();
    previewDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: previewPosition.x,
      originY: previewPosition.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const movePreview = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = previewDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    setPreviewPosition(
      clampPreviewPosition({
        x: drag.originX + event.clientX - drag.startX,
        y: drag.originY + event.clientY - drag.startY,
      }),
    );
  };
  const endPreviewDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (previewDragRef.current?.pointerId !== event.pointerId) return;
    previewDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const beginPreviewResize =
    (corner: PreviewResizeCorner) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = previewWindowRef.current?.getBoundingClientRect();
    if (!bounds) return;
    previewResizeRef.current = {
      pointerId: event.pointerId,
      corner,
      startX: event.clientX,
      startY: event.clientY,
      originX: bounds.x,
      originY: bounds.y,
      originWidth: bounds.width,
      originHeight: bounds.height,
      aspectRatio: bounds.width / Math.max(1, bounds.height),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const resizePreview = (event: ReactPointerEvent<HTMLDivElement>) => {
    const resize = previewResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const changesFromLeft = resize.corner.includes('left');
    const changesFromTop = resize.corner.includes('top');
    const deltaX = (event.clientX - resize.startX) * (changesFromLeft ? -1 : 1);
    const deltaYAsWidth =
      (event.clientY - resize.startY) * (changesFromTop ? -1 : 1) * resize.aspectRatio;
    const delta = Math.abs(deltaX) >= Math.abs(deltaYAsWidth) ? deltaX : deltaYAsWidth;
    const horizontalRoom = changesFromLeft
      ? resize.originX + resize.originWidth - PREVIEW_EDGE_PADDING
      : window.innerWidth - resize.originX - PREVIEW_EDGE_PADDING;
    const verticalRoom = changesFromTop
      ? resize.originY + resize.originHeight - PREVIEW_EDGE_PADDING
      : window.innerHeight - resize.originY - PREVIEW_EDGE_PADDING;
    const maximum = Math.max(
      280,
      Math.min(
        PREVIEW_MAX_WIDTH,
        PREVIEW_MAX_HEIGHT * resize.aspectRatio,
        horizontalRoom,
        verticalRoom * resize.aspectRatio,
      ),
    );
    const minimum = Math.min(
      maximum,
      Math.max(PREVIEW_MIN_WIDTH, PREVIEW_MIN_HEIGHT * resize.aspectRatio),
    );
    const nextWidth = Math.max(minimum, Math.min(resize.originWidth + delta, maximum));
    const nextHeight = resize.originHeight + (nextWidth - resize.originWidth) / resize.aspectRatio;
    setPreviewWidth(nextWidth);
    setPreviewPosition({
      x: changesFromLeft ? resize.originX + resize.originWidth - nextWidth : resize.originX,
      y: changesFromTop ? resize.originY + resize.originHeight - nextHeight : resize.originY,
    });
  };
  const endPreviewResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const completedResize = previewResizeRef.current;
    if (completedResize?.pointerId !== event.pointerId) return;
    previewResizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    window.requestAnimationFrame(() => {
      const bounds = previewWindowRef.current?.getBoundingClientRect();
      setPreviewPosition((current) =>
        clampPreviewPosition({
          x:
            bounds && completedResize.corner.includes('left')
              ? completedResize.originX + completedResize.originWidth - bounds.width
              : current.x,
          y:
            bounds && completedResize.corner.includes('top')
              ? completedResize.originY + completedResize.originHeight - bounds.height
              : current.y,
        }),
      );
    });
  };

  useEffect(() => {
    if (
      canvasSettings.layoutMode !== 'classic' &&
      (selection === 'scene' || selection === 'background')
    ) {
      setSelection('dialogBox');
      updateRenderStyle('selectedRenderObject', 'dialogBox');
    }
  }, [canvasSettings.layoutMode, selection, updateRenderStyle]);

  const inspector = (
    <div className="video-render-workspace min-w-0 space-y-4">
      <div
        className={`grid items-center gap-3 ${
          showPreview
            ? 'grid-cols-[28px_minmax(0,1fr)_32px]'
            : 'grid-cols-[28px_minmax(0,1fr)]'
        }`}
      >
        <button
          type="button"
          onClick={() => setShowParameterDescriptions((visible) => !visible)}
          aria-label={showParameterDescriptions
            ? text.hideParameterDescriptions
            : text.showParameterDescriptions}
          title={showParameterDescriptions
            ? text.hideParameterDescriptions
            : text.showParameterDescriptions}
          aria-pressed={showParameterDescriptions}
          className={`inline-grid h-7 w-7 place-items-center rounded-lg border shadow-sm transition-colors ${
            showParameterDescriptions
              ? 'border-indigo-200/80 bg-indigo-50 text-indigo-600 dark:border-indigo-400/20 dark:bg-indigo-400/10 dark:text-indigo-300'
              : 'border-slate-200/80 bg-white/80 text-slate-400 hover:text-indigo-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-500 dark:hover:text-indigo-300'
          }`}
        >
          <CircleAlert className="h-3.5 w-3.5" />
        </button>

        <div className="grid min-w-0 grid-cols-4 gap-2 rounded-2xl border border-slate-200/80 bg-white/70 p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.035]">
          {(['dialogBox', 'title', 'body', 'nameplate'] as RenderEditableObjectKind[]).map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={selection === kind}
              data-render-selection={kind}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                setSelection(kind);
                updateRenderStyle('selectedRenderObject', kind);
              }}
              className={`h-9 min-w-0 truncate rounded-lg px-2 text-left text-xs font-bold transition-colors ${
                selection === kind
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100/90 text-slate-700 hover:bg-slate-200/90 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/10'
              }`}
            >
              {objectText.object[kind]}
            </button>
          ))}
        </div>

        {showPreview ? (
          <button
            type="button"
            onClick={() => setPreviewOpen((open) => !open)}
            aria-label={previewOpen ? text.hidePreview : text.openPreview}
            title={previewOpen ? text.hidePreview : text.openPreview}
            aria-pressed={previewOpen}
            className={`inline-grid h-8 w-8 place-items-center rounded-lg border shadow-sm transition-colors ${
              previewOpen
                ? 'border-indigo-500/20 bg-indigo-600 text-white shadow-indigo-500/20'
                : 'border-slate-200/80 bg-white/80 text-slate-500 hover:text-indigo-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-400 dark:hover:text-indigo-300'
            }`}
          >
            <MonitorPlay className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {showPreview ? (
        <div className="grid min-w-0 items-start gap-x-4 lg:grid-cols-2">
          <div className="min-w-0 space-y-5">
            <CanvasSettingsSection
              language={language}
              value={canvasSettings}
              onChange={onCanvasSettingsChange}
              showDescriptions={showParameterDescriptions}
            />
            <RenderObjectSettingsSection
              language={language}
              renderStyle={renderStyle}
              updateRenderStyle={updateRenderStyle}
              surface="playtest"
              showDescriptions={showParameterDescriptions}
              canvasSettings={canvasSettings}
              onCanvasSettingsChange={onCanvasSettingsChange}
              selection={selection}
              onSelectionChange={setSelection}
              hideSelectionBar
              singleColumn
              visibleGroups={['position', 'text', 'animation']}
            />
          </div>

          <div className="min-w-0 space-y-5">
            <PlaytestRuntimeSettingsSection
              language={language}
              value={runtimeSettings}
              onChange={onRuntimeSettingsChange}
              choicesPosition={canvasSettings.choicesPosition}
              showDescriptions={showParameterDescriptions}
            />
            {selection !== 'scene' && selection !== 'background' ? (
              <RenderObjectSettingsSection
                language={language}
                renderStyle={renderStyle}
                updateRenderStyle={updateRenderStyle}
                surface="playtest"
                showDescriptions={showParameterDescriptions}
                canvasSettings={canvasSettings}
                onCanvasSettingsChange={onCanvasSettingsChange}
                selection={selection}
                onSelectionChange={setSelection}
                hideSelectionBar
                singleColumn
                visibleGroups={['fill', 'stroke', 'shadow']}
              />
            ) : null}
          </div>
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-y-5">
          <CanvasSettingsSection
            language={language}
            value={canvasSettings}
            onChange={onCanvasSettingsChange}
            showDescriptions={showParameterDescriptions}
          />
          <PlaytestRuntimeSettingsSection
            language={language}
            value={runtimeSettings}
            onChange={onRuntimeSettingsChange}
            choicesPosition={canvasSettings.choicesPosition}
            showDescriptions={showParameterDescriptions}
          />
          <RenderObjectSettingsSection
            language={language}
            renderStyle={renderStyle}
            updateRenderStyle={updateRenderStyle}
            surface="playtest"
            showDescriptions={showParameterDescriptions}
            canvasSettings={canvasSettings}
            onCanvasSettingsChange={onCanvasSettingsChange}
            selection={selection}
            onSelectionChange={setSelection}
            hideSelectionBar
            singleColumn
          />
        </div>
      )}
    </div>
  );

  if (!showPreview) return inspector;

  return (
    <div className="min-h-0">
      {inspector}
      {previewOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={previewWindowRef}
            data-playtest-preview-window
            className="video-render-workspace fixed z-[360] max-w-[calc(100vw-24px)] drop-shadow-[0_28px_70px_rgba(2,6,23,0.42)]"
            style={{ left: previewPosition.x, top: previewPosition.y, width: previewWidth }}
          >
            <PlaytestInteractivePreview
              language={language}
              canvasSettings={canvasSettings}
              runtimeSettings={runtimeSettings}
              renderStyle={renderStyle}
              updateRenderStyle={updateRenderStyle}
              nodes={nodes}
              edges={edges}
              selection={selection}
              onSelectionChange={setSelection}
              floating
              onDragStart={beginPreviewDrag}
              onDragMove={movePreview}
              onDragEnd={endPreviewDrag}
              onClose={() => setPreviewOpen(false)}
            />
            {(['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const).map((corner) => (
              <div
                key={corner}
                role="separator"
                aria-label={text.resizePreview}
                data-playtest-preview-resize-handle={corner}
                className={`absolute z-40 h-4 w-4 touch-none ${
                  corner === 'top-left'
                    ? '-left-1 -top-1 cursor-nwse-resize'
                    : corner === 'top-right'
                      ? '-right-1 -top-1 cursor-nesw-resize'
                      : corner === 'bottom-right'
                        ? '-bottom-1 -right-1 cursor-nwse-resize'
                        : '-bottom-1 -left-1 cursor-nesw-resize'
                }`}
                onPointerDown={beginPreviewResize(corner)}
                onPointerMove={resizePreview}
                onPointerUp={endPreviewResize}
                onPointerCancel={endPreviewResize}
              />
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

function PlaytestInteractivePreview({
  language,
  canvasSettings,
  runtimeSettings,
  renderStyle,
  updateRenderStyle,
  nodes,
  edges,
  selection,
  onSelectionChange,
  floating = false,
  onDragStart,
  onDragMove,
  onDragEnd,
  onClose,
}: {
  language: Language;
  canvasSettings: SharedCanvasSettings;
  runtimeSettings: PlaytestRuntimeSettings;
  renderStyle: RenderStyle;
  updateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
  nodes: Node[];
  edges: Edge[];
  selection: WorkbenchSelection;
  onSelectionChange: (selection: WorkbenchSelection) => void;
  floating?: boolean;
  onDragStart?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDragMove?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDragEnd?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onClose?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodeIndex, setNodeIndex] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const text = getPlaytestText(language);
  const canvasModel = useMemo(
    () =>
      createPlaytestCanvasModel({
        canvasSettings,
        runtimeSettings,
        renderStyle,
        nodes,
        edges,
        nodeIndex,
        fallbackTitle: text.sampleTitle,
        fallbackBody: text.sampleBody,
      }),
    [
      canvasSettings,
      edges,
      nodeIndex,
      nodes,
      renderStyle,
      runtimeSettings,
      text.sampleBody,
      text.sampleTitle,
    ],
  );
  const {
    choiceTargets,
    currentNode,
    previewNodes,
    renderHeight,
    renderWidth,
    showChoices,
  } = canvasModel;

  useEffect(() => {
    setNodeIndex((current) => Math.min(current, Math.max(0, previewNodes.length - 1)));
  }, [previewNodes.length]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    let cancelled = false;
    let timer = 0;
    const startedAt = performance.now();

    const paint = async () => {
      if (cancelled) return;
      const elapsed = Math.min(2.4, (performance.now() - startedAt) / 1000);
      try {
        await drawPlaytestCanvasModelFrame({
          context,
          model: canvasModel,
          language,
          elapsed,
        });
      } catch (error) {
        console.error('Playtest settings preview failed:', error);
      }
      if (!cancelled && elapsed < 2.4) timer = window.setTimeout(paint, 42);
    };

    void paint();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    canvasModel,
    currentNode,
    language,
    previewNodes,
    renderHeight,
    renderWidth,
    replayKey,
  ]);

  const goToNode = (node: Node) => {
    const nextIndex = previewNodes.findIndex((candidate) => candidate.id === node.id);
    if (nextIndex >= 0) {
      setNodeIndex(nextIndex);
      setReplayKey((current) => current + 1);
    }
  };
  const stepNode = (direction: -1 | 1) => {
    setNodeIndex((current) => {
      const length = previewNodes.length;
      return length <= 1 ? 0 : (current + direction + length) % length;
    });
    setReplayKey((current) => current + 1);
  };
  const selectPreviewObject = (next: WorkbenchSelection) => {
    onSelectionChange(next);
    if (next !== 'scene' && next !== 'background') {
      updateRenderStyle('selectedRenderObject', next);
    }
  };
  const choicePositionClass =
    canvasSettings.choicesPosition === 'center'
      ? 'left-1/2 top-1/2 w-[54%] -translate-x-1/2 -translate-y-1/2'
      : canvasSettings.choicesPosition === 'aboveText'
        ? 'bottom-[36%] left-1/2 w-[72%] -translate-x-1/2'
        : 'bottom-[3%] left-1/2 w-[72%] -translate-x-1/2';
  const selectionBox = getPlaytestCanvasSelectionBox(canvasModel, selection);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[var(--vr-border)] bg-[var(--vr-surface-strong)] shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
      <div
        data-playtest-preview-drag-handle={floating ? 'true' : undefined}
        className={`flex min-h-12 touch-none flex-wrap items-center gap-2 border-b border-[var(--vr-border)] px-3 py-2 ${floating ? 'cursor-grab select-none active:cursor-grabbing' : ''}`}
        title={floating ? text.movePreview : undefined}
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerCancel={onDragEnd}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--vr-accent-soft)] text-[var(--vr-accent-strong)]">
            <MonitorPlay className="h-4 w-4" />
          </span>
          {floating && <GripHorizontal className="h-4 w-4 shrink-0 text-[var(--vr-text-muted)]" />}
          <div className="min-w-0">
            <div className="truncate text-xs font-black text-[var(--vr-text)]">{text.livePreview}</div>
            <div className="truncate text-[10px] font-medium text-[var(--vr-text-muted)]">
              {canvasSettings.canvasWidth} × {canvasSettings.canvasHeight} · {nodeIndex + 1}/
              {previewNodes.length}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-[var(--vr-surface-soft)] p-1">
          <PreviewToolButton label={text.previous} onClick={() => stepNode(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </PreviewToolButton>
          <PreviewToolButton label={text.replay} onClick={() => setReplayKey((current) => current + 1)}>
            <RotateCcw className="h-4 w-4" />
          </PreviewToolButton>
          <PreviewToolButton label={text.next} onClick={() => stepNode(1)}>
            <ChevronRight className="h-4 w-4" />
          </PreviewToolButton>
          {floating && onClose && (
            <PreviewToolButton label={text.closePreview} onClick={onClose}>
              <X className="h-4 w-4" />
            </PreviewToolButton>
          )}
        </div>
      </div>

      <div className="p-3">
        <div
          className="relative w-full overflow-hidden rounded-xl bg-slate-950 shadow-inner"
          style={{ aspectRatio: `${renderWidth} / ${renderHeight}` }}
          onClick={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            const point = {
              x: ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * renderWidth,
              y: ((event.clientY - bounds.top) / Math.max(1, bounds.height)) * renderHeight,
            };
            selectPreviewObject(resolvePlaytestCanvasSelection(canvasModel, point));
          }}
        >
          <canvas
            ref={canvasRef}
            width={renderWidth}
            height={renderHeight}
            className="absolute inset-0 h-full w-full"
          />
          {showChoices && runtimeSettings.blurBackground && (
            <div
              className={`pointer-events-none absolute inset-0 bg-slate-950/10 backdrop-blur-[3px] ${runtimeSettings.blurText ? 'backdrop-blur-[6px]' : ''}`}
            />
          )}
          {selectionBox && (
            <button
              type="button"
              className="absolute z-10 rounded border-2 border-indigo-400 bg-indigo-400/5 shadow-[0_0_0_1px_rgba(255,255,255,0.55)]"
              style={selectionBox}
              aria-label={text.selectedObject}
              onClick={(event) => {
                event.stopPropagation();
                selectPreviewObject(selection);
              }}
            />
          )}
          {showChoices && (
            <div
              className={`absolute z-30 grid gap-2 ${choicePositionClass}`}
              style={{ gridTemplateColumns: `repeat(${Math.max(1, runtimeSettings.choicesColumns)}, minmax(0, 1fr))` }}
            >
              {choiceTargets.slice(0, Math.max(1, runtimeSettings.choicesColumns * 2)).map((node, index) => (
                <button
                  key={`${node.id}-${index}`}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    goToNode(node);
                  }}
                  className="min-h-9 rounded-xl border border-white/25 bg-slate-950/75 px-3 py-2 text-[clamp(10px,1vw,14px)] font-bold text-white shadow-lg backdrop-blur-md transition-colors hover:bg-indigo-600"
                >
                  {String(node.data?.title || `${text.choice} ${index + 1}`)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PlaytestRuntimeSettingsSection({
  language,
  value,
  onChange,
  choicesPosition,
  showDescriptions,
}: {
  language: Language;
  value: PlaytestRuntimeSettings;
  onChange: (patch: Partial<PlaytestRuntimeSettings>) => void;
  choicesPosition: SharedCanvasSettings['choicesPosition'];
  showDescriptions: boolean;
}) {
  const text = getPlaytestText(language);
  const [collapsed, setCollapsed] = useState(false);
  const descriptionSlot = (label?: string) =>
    showDescriptions ? (
      <div className="mb-1 h-4 px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">
        {label || '\u00a0'}
      </div>
    ) : null;
  return (
    <section className={`rounded-[22px] bg-sky-50 p-3 dark:bg-sky-950/25 ${showDescriptions ? '' : '[&_.playtest-runtime-description]:hidden'}`}>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-3">
        <div className="min-w-0">
          {descriptionSlot()}
          <div className="flex h-10 min-w-0 items-center gap-2 rounded-xl bg-sky-100 px-3 text-sm font-bold text-slate-900 dark:bg-white/5 dark:text-[var(--vr-text)]">
            <Type className="h-4 w-4 shrink-0" />
            <span className="truncate">{text.textSettings}</span>
          </div>
        </div>
        <div className="min-w-0">
          {descriptionSlot(text.textPlayback)}
          <Segmented
            value={value.interactionMode}
            options={[
              ['immediate', text.immediate],
              ['typewriter', text.typewriter],
            ]}
            onChange={(interactionMode) =>
              onChange({ interactionMode: interactionMode as PlaytestRuntimeSettings['interactionMode'] })
            }
          />
        </div>
        <div>
          {descriptionSlot()}
          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            className="grid h-10 w-11 place-items-center rounded-xl bg-sky-100 text-slate-900 dark:bg-white/5 dark:text-[var(--vr-text)]"
            title={collapsed ? text.expandSettings : text.collapseSettings}
            aria-label={collapsed ? text.expandSettings : text.collapseSettings}
            aria-expanded={!collapsed}
          >
            <ChevronDown className={`h-5 w-5 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-3">
            <RuntimeField label={text.choiceColumns} disabled={choicesPosition === 'center'}>
              <Segmented
                value={String(value.choicesColumns)}
                options={[
                  ['1', '1'],
                  ['2', '2'],
                  ['3', '3'],
                ]}
                onChange={(choicesColumns) => onChange({ choicesColumns: Number(choicesColumns) })}
              />
            </RuntimeField>
            <RuntimeNumber
              label={text.typewriterSpeed}
              value={value.typewriterSpeed}
              unit="ms"
              min={0}
              max={500}
              onChange={(typewriterSpeed) => onChange({ typewriterSpeed })}
            />
            <div className="h-10 w-11" aria-hidden="true" />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-3">
            <RuntimeField label={text.blurBackground}>
              <Segmented
                value={value.blurBackground ? 'on' : 'off'}
                options={[
                  ['on', text.on],
                  ['off', text.off],
                ]}
                onChange={(next) => onChange({ blurBackground: next === 'on' })}
              />
            </RuntimeField>
            <RuntimeField label={text.blurText} disabled={!value.blurBackground}>
              <Segmented
                value={value.blurText ? 'on' : 'off'}
                options={[
                  ['on', text.on],
                  ['off', text.off],
                ]}
                onChange={(next) => onChange({ blurText: next === 'on' })}
              />
            </RuntimeField>
            <div className="h-10 w-11" aria-hidden="true" />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px] gap-3">
            <RuntimeNumber
              label={text.choiceDelay}
              value={value.choiceDelay}
              unit="s"
              min={0}
              max={60}
              onChange={(choiceDelay) => onChange({ choiceDelay })}
            />
            <RuntimeNumber
              label={text.autoAdvanceDelay}
              value={value.autoAdvanceDelay}
              unit="s"
              min={0}
              max={60}
              onChange={(autoAdvanceDelay) => onChange({ autoAdvanceDelay })}
            />
            <div className="h-10 w-11" aria-hidden="true" />
          </div>
        </div>
      )}
    </section>
  );
}

function RuntimeField({
  label,
  disabled = false,
  children,
}: {
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`min-w-0 space-y-1 ${disabled ? 'pointer-events-none opacity-40' : ''}`}>
      <span className="playtest-runtime-description block truncate px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function RuntimeNumber({
  label,
  value,
  unit,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <RuntimeField label={label}>
      <span className="grid h-10 grid-cols-[minmax(0,1fr)_40px] items-center overflow-hidden rounded-xl bg-[var(--vr-surface-soft)]">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(event) =>
            onChange(Math.min(max, Math.max(min, Number(event.target.value) || 0)))
          }
          className="h-full min-w-0 bg-transparent px-3 text-sm font-bold tabular-nums text-[var(--vr-text)] outline-none"
        />
        <span className="text-xs font-medium text-[var(--vr-text-muted)]">{unit}</span>
      </span>
    </RuntimeField>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <span
      className="grid h-10 overflow-hidden rounded-xl bg-[var(--vr-surface-soft)]"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map(([optionValue, label]) => (
        <button
          key={optionValue}
          type="button"
          onClick={() => onChange(optionValue)}
          className={`min-w-0 truncate px-2 text-xs font-bold transition-colors ${
            value === optionValue
              ? 'bg-[var(--vr-accent)] text-white'
              : 'text-[var(--vr-text-soft)] hover:bg-[var(--vr-accent-soft)]'
          }`}
        >
          {label}
        </button>
      ))}
    </span>
  );
}

function PreviewToolButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg text-[var(--vr-text-muted)] transition-colors hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)]"
    >
      {children}
    </button>
  );
}

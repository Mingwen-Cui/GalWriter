import type { Edge, Node } from '@xyflow/react';
import {
  ChevronLeft,
  ChevronRight,
  Gauge,
  MonitorPlay,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { Language } from '../lib/i18n';
import type { SharedCanvasSettings } from './render/canvas/canvasSettings';
import { CanvasSettingsSection } from './render/canvas/CanvasSettingsSection';
import {
  createPlaytestCanvasModel,
  drawPlaytestCanvasModelFrame,
  getPlaytestCanvasSelectionBox,
  type PlaytestCanvasSelection,
  type PlaytestRuntimeSettings,
  resolvePlaytestCanvasSelection,
} from './render/canvas/playtestCanvasModel';
import { RenderObjectSettingsSection } from './render/video/panels/render-object-settings-section';
import type { RenderStyle } from './render/video/shared/types';

export type { PlaytestRuntimeSettings } from './render/canvas/playtestCanvasModel';

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
  const [selection, setSelection] = useState<WorkbenchSelection>(
    canvasSettings.layoutMode === 'classic'
      ? 'scene'
      : renderStyle.selectedRenderObject || 'dialogBox',
  );

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
      <WorkbenchTitle icon={SlidersHorizontal} label={copy(language).canvasSettings} />
      <CanvasSettingsSection
        language={language}
        value={canvasSettings}
        onChange={onCanvasSettingsChange}
      />

      <WorkbenchTitle icon={Gauge} label={copy(language).runtimeSettings} />
      <PlaytestRuntimeSettingsSection
        language={language}
        value={runtimeSettings}
        onChange={onRuntimeSettingsChange}
        choicesPosition={canvasSettings.choicesPosition}
      />

      <WorkbenchTitle icon={SlidersHorizontal} label={copy(language).objectSettings} />
      <div className="rounded-[22px] border border-[var(--vr-border)] bg-[var(--vr-surface)] p-3">
        <RenderObjectSettingsSection
          language={language}
          renderStyle={renderStyle}
          updateRenderStyle={updateRenderStyle}
          surface="playtest"
          showDescriptions
          canvasSettings={canvasSettings}
          onCanvasSettingsChange={onCanvasSettingsChange}
          selection={selection}
          onSelectionChange={setSelection}
        />
      </div>
    </div>
  );

  if (!showPreview) return inspector;

  return (
    <div className="grid min-h-0 gap-5 2xl:grid-cols-[minmax(0,1.6fr)_minmax(380px,0.9fr)] xl:grid-cols-[minmax(0,1.45fr)_minmax(370px,0.9fr)]">
      <div className="min-w-0 xl:sticky xl:top-0 xl:self-start">
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
        />
      </div>
      <div className="min-w-0">{inspector}</div>
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
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nodeIndex, setNodeIndex] = useState(0);
  const [replayKey, setReplayKey] = useState(0);
  const text = copy(language);
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
    <section className="overflow-hidden rounded-[24px] border border-[var(--vr-border)] bg-[var(--vr-surface-strong)] shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
      <div className="flex min-h-12 flex-wrap items-center gap-2 border-b border-[var(--vr-border)] px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[var(--vr-accent-soft)] text-[var(--vr-accent-strong)]">
            <MonitorPlay className="h-4 w-4" />
          </span>
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
        </div>
      </div>

      <div className="p-3">
        <div
          className="relative w-full overflow-hidden rounded-2xl bg-slate-950 shadow-inner"
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
        <p className="mt-2 text-[10px] font-medium leading-4 text-[var(--vr-text-muted)]">
          {text.previewHint}
        </p>
      </div>
    </section>
  );
}

function PlaytestRuntimeSettingsSection({
  language,
  value,
  onChange,
  choicesPosition,
}: {
  language: Language;
  value: PlaytestRuntimeSettings;
  onChange: (patch: Partial<PlaytestRuntimeSettings>) => void;
  choicesPosition: SharedCanvasSettings['choicesPosition'];
}) {
  const text = copy(language);
  return (
    <section className="rounded-[22px] bg-sky-50 p-3 dark:bg-sky-950/25">
      <div className="grid gap-3 sm:grid-cols-2">
        <RuntimeField label={text.textPlayback}>
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
        </RuntimeField>
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
        <RuntimeNumber
          label={text.typewriterSpeed}
          value={value.typewriterSpeed}
          unit="ms"
          min={0}
          max={500}
          onChange={(typewriterSpeed) => onChange({ typewriterSpeed })}
        />
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
      </div>
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
      <span className="block truncate px-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">
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

function WorkbenchTitle({ icon: Icon, label }: { icon: typeof Gauge; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
      <Icon className="h-3.5 w-3.5 text-[var(--vr-accent)]" />
      <span>{label}</span>
    </div>
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

function copy(language: Language) {
  if (language === 'zh') {
    return {
      canvasSettings: '画布与布局',
      runtimeSettings: '播放与选项',
      objectSettings: '画面对象',
      livePreview: '实时测试屏幕',
      sampleTitle: '测试场景',
      sampleBody: '点击画面中的标题、正文或文字框，可以直接编辑对应样式。',
      previous: '上一节点',
      replay: '重新播放',
      next: '下一节点',
      previewHint: '点击画面对象切换右侧属性；选项按钮会跳转到对应节点。',
      selectedObject: '当前选中的画面对象',
      editTitle: '编辑标题',
      editBody: '编辑正文',
      choice: '选项',
      textPlayback: '文字播放方式',
      immediate: '立即显示',
      typewriter: '打字机',
      choiceColumns: '选项列数',
      blurBackground: '选项出现时虚化背景',
      blurText: '同时虚化文字',
      on: '开启',
      off: '关闭',
      typewriterSpeed: '打字速度',
      choiceDelay: '选项出现延迟',
      autoAdvanceDelay: '自动翻页延迟',
    };
  }
  if (language === 'ja') {
    return {
      canvasSettings: 'キャンバスとレイアウト', runtimeSettings: '再生と選択肢', objectSettings: '画面オブジェクト', livePreview: 'ライブテスト画面', sampleTitle: 'テストシーン', sampleBody: 'タイトル、本文、テキストボックスをクリックして編集できます。', previous: '前へ', replay: 'リプレイ', next: '次へ', previewHint: '画面の要素をクリックして右側の設定を切り替えます。', selectedObject: '選択中のオブジェクト', editTitle: 'タイトルを編集', editBody: '本文を編集', choice: '選択肢', textPlayback: 'テキスト表示', immediate: 'すぐ表示', typewriter: 'タイプライター', choiceColumns: '選択肢の列数', blurBackground: '背景をぼかす', blurText: '文字もぼかす', on: 'オン', off: 'オフ', typewriterSpeed: 'タイプ速度', choiceDelay: '選択肢の遅延', autoAdvanceDelay: '自動送りの遅延',
    };
  }
  return {
    canvasSettings: 'Canvas and layout', runtimeSettings: 'Playback and choices', objectSettings: 'Screen objects', livePreview: 'Live playtest screen', sampleTitle: 'Test scene', sampleBody: 'Click the title, body, or dialogue box to edit its style.', previous: 'Previous node', replay: 'Replay', next: 'Next node', previewHint: 'Click a screen object to switch the inspector; choice buttons navigate between nodes.', selectedObject: 'Selected screen object', editTitle: 'Edit title', editBody: 'Edit body', choice: 'Choice', textPlayback: 'Text playback', immediate: 'Immediate', typewriter: 'Typewriter', choiceColumns: 'Choice columns', blurBackground: 'Blur background for choices', blurText: 'Blur text too', on: 'On', off: 'Off', typewriterSpeed: 'Typewriter speed', choiceDelay: 'Choice delay', autoAdvanceDelay: 'Auto-advance delay',
  };
}

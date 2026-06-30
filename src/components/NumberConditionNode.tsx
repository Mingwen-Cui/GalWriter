import {
  Handle,
  NodeProps,
  Position,
  useStore,
  useStoreApi,
  useUpdateNodeInternals,
} from '@xyflow/react';
import {
  AlertCircle,
  ArrowUpDown,
  Calculator,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import React, { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { useDialog } from '../editor-shell/DialogProvider';
import type { Language } from '../lib/i18n';
import { NumberInput } from './NumberInput';

export function NumberConditionNode({ id, data, selected }: NodeProps) {
  const { confirm: showDialogConfirm } = useDialog();
  const lang = (data.language as Language) || 'zh';
  const tr = (zh: string, ja: string, en: string) => (lang === 'zh' ? zh : lang === 'ja' ? ja : en);
  const [sum, setSum] = useState(0);
  const [pendingFocusRangeId, setPendingFocusRangeId] = useState<string | null>(null);
  const [draggingRangeId, setDraggingRangeId] = useState<string | null>(null);
  const [rangeHandleTops, setRangeHandleTops] = useState<Record<string, number>>({});
  const [conditionHandleTops, setConditionHandleTops] = useState<Record<string, number>>({});
  const nodeRef = useRef<HTMLDivElement>(null);
  const greaterConditionRef = useRef<HTMLDivElement>(null);
  const lessConditionRef = useRef<HTMLDivElement>(null);
  const rangeRowRefs = useRef(new Map<string, HTMLDivElement>());
  // NOTE: 将最小化状态存储在 React Flow 的节点 data 中，以实现保存/载入项目文件时能够自动持久化该状态
  const isMinimized = !!data.isMinimized;

  /**
   * 更新节点的最小化状态，并通过 onUpdate 回调将变更同步到上层 React Flow 状态中
   * @param minimized 是否最小化
   */
  const setIsMinimized = (minimized: boolean) => {
    if (data && typeof data.onUpdate === 'function') {
      (data.onUpdate as Function)(id, { isMinimized: minimized });
    }
  };
  const threshold = (data.threshold as number) || 0;
  const isReversed = (data.isReversed as boolean) || false;
  const ranges = (data.ranges as { id: string; min: number; max: number }[]) || [];

  // NOTE: useStoreApi 用于在事件处理时按需读取，不产生订阅关系
  const storeApi = useStoreApi();
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    // 立即通知 React Flow 重新计算 Handle 位置，确保连线准确
    updateNodeInternals(id);

    // 对于复杂的 DOM 变动（如最小化展开动画），保留一个短延迟的二次更新
    const timer = setTimeout(() => {
      updateNodeInternals(id);
    }, 100);
    return () => clearTimeout(timer);
  }, [isMinimized, isReversed, id, ranges.length]);

  const updateNodeData = (updates: any) => {
    if (data.onUpdate) {
      (data.onUpdate as Function)(id, updates);
    }
  };

  const addRange = () => {
    const id = Math.random().toString(36).substr(2, 9);
    const lastMax = ranges.reduce((max, range) => Math.max(max, range.max), -1);
    const min = lastMax >= 0 ? lastMax + 1 : 0;
    const newRanges = [...ranges, { id, min, max: min + 10 }];
    updateNodeData({ ranges: newRanges });
    setPendingFocusRangeId(id);
  };

  const removeRange = async (rangeId: string) => {
    const sourceHandle = `out-range-${rangeId}`;
    const hasConnection = storeApi
      .getState()
      .edges.some((edge) => edge.source === id && edge.sourceHandle === sourceHandle);
    if (
      hasConnection &&
      !(await showDialogConfirm({
        title: tr('确认删除范围分支', '範囲分岐を削除しますか', 'Delete this range branch?'),
        description: tr(
          '删除这个范围分支后，对应连线也会被移除。确定删除吗？',
          'この範囲分岐を削除すると、接続も削除されます。削除しますか？',
          'Deleting this range branch will also remove its connection. Continue?',
        ),
        tone: 'warning',
        confirmLabel: tr('确认删除', '削除する', 'Delete'),
      }))
    ) {
      return;
    }
    if (hasConnection && typeof data.onDeleteOutputEdges === 'function') {
      (data.onDeleteOutputEdges as Function)(id, sourceHandle);
    }
    const newRanges = ranges.filter((r) => r.id !== rangeId);
    updateNodeData({ ranges: newRanges });
  };

  const updateRange = (rangeId: string, updates: Partial<{ min: number; max: number }>) => {
    const newRanges = ranges.map((r) => (r.id === rangeId ? { ...r, ...updates } : r));
    updateNodeData({ ranges: newRanges });
  };

  const moveRange = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const draggedIndex = ranges.findIndex((range) => range.id === draggedId);
    const targetIndex = ranges.findIndex((range) => range.id === targetId);
    if (draggedIndex < 0 || targetIndex < 0) return;
    const nextRanges = [...ranges];
    const [draggedRange] = nextRanges.splice(draggedIndex, 1);
    nextRanges.splice(targetIndex, 0, draggedRange);
    updateNodeData({ ranges: nextRanges });
  };

  useEffect(() => {
    if (!pendingFocusRangeId) return;
    const frame = requestAnimationFrame(() => {
      const row = rangeRowRefs.current.get(pendingFocusRangeId);
      row?.querySelector<HTMLInputElement>('input[data-range-min]')?.focus();
      setPendingFocusRangeId(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingFocusRangeId, ranges.length]);

  useLayoutEffect(() => {
    if (isMinimized || !nodeRef.current) return;

    const getElementCenterTop = (element: HTMLElement) => {
      let top = element.offsetHeight / 2;
      let current: HTMLElement | null = element;
      while (current && current !== nodeRef.current) {
        top += current.offsetTop;
        current = current.offsetParent as HTMLElement | null;
      }
      return top;
    };

    const updateHandlePositions = () => {
      if (!nodeRef.current) return;
      const nextTops: Record<string, number> = {};
      ranges.forEach((range) => {
        const row = rangeRowRefs.current.get(range.id);
        if (!row) return;
        nextTops[range.id] = getElementCenterTop(row);
      });
      setRangeHandleTops((current) => {
        const unchanged =
          Object.keys(nextTops).length === Object.keys(current).length &&
          Object.entries(nextTops).every(
            ([rangeId, top]) => Math.abs((current[rangeId] ?? -1000) - top) < 0.5,
          );
        return unchanged ? current : nextTops;
      });
      const nextConditionTops = {
        greater: greaterConditionRef.current
          ? getElementCenterTop(greaterConditionRef.current)
          : 195,
        less: lessConditionRef.current ? getElementCenterTop(lessConditionRef.current) : 235,
      };
      setConditionHandleTops((current) => {
        const unchanged = Object.entries(nextConditionTops).every(
          ([condition, top]) => Math.abs((current[condition] ?? -1000) - top) < 0.5,
        );
        return unchanged ? current : nextConditionTops;
      });
      updateNodeInternals(id);
    };

    updateHandlePositions();
    const observer = new ResizeObserver(updateHandlePositions);
    observer.observe(nodeRef.current);
    if (greaterConditionRef.current) observer.observe(greaterConditionRef.current);
    if (lessConditionRef.current) observer.observe(lessConditionRef.current);
    rangeRowRefs.current.forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  }, [id, isMinimized, ranges, updateNodeInternals]);

  // NOTE: 用精确选择器订阅"所有祖先节点的 nodeValue 之和"这个原始数字。
  // React Flow 内部用 Object.is 比较选择器返回值，只有数字真正变化才重渲染，
  // 不会订阅整个 edges/nodes 数组引用，彻底切断无限循环。
  const computedSum = useStore((state) => {
    // Parallel upstream branches are alternatives; compare against the largest serial path total.
    const nodeById = new Map(state.nodes.map((node) => [node.id, node]));
    const incomingEdgesByTarget = new Map<string, typeof state.edges>();
    for (const edge of state.edges) {
      const incomingEdges = incomingEdgesByTarget.get(edge.target) || [];
      incomingEdges.push(edge);
      incomingEdgesByTarget.set(edge.target, incomingEdges);
    }

    const maxSerialSumByNodeId = new Map<string, number>();
    const visiting = new Set<string>();
    const getMaxSerialSumToNode = (nodeId: string): number => {
      const cached = maxSerialSumByNodeId.get(nodeId);
      if (typeof cached === 'number') return cached;
      if (visiting.has(nodeId)) return 0;

      visiting.add(nodeId);
      const node = nodeById.get(nodeId);
      const ownValue =
        node && typeof node.data.nodeValue === 'number' && Number.isFinite(node.data.nodeValue)
          ? node.data.nodeValue
          : 0;
      const incomingEdges = incomingEdgesByTarget.get(nodeId) || [];
      const maxUpstreamValue = incomingEdges.reduce(
        (maxValue, edge) => Math.max(maxValue, getMaxSerialSumToNode(edge.source)),
        0,
      );
      const total = ownValue + maxUpstreamValue;
      visiting.delete(nodeId);
      maxSerialSumByNodeId.set(nodeId, total);
      return total;
    };

    const directIncomingEdges = incomingEdgesByTarget.get(id) || [];
    return directIncomingEdges.reduce(
      (maxValue, edge) => Math.max(maxValue, getMaxSerialSumToNode(edge.source)),
      0,
    );
  });

  // NOTE: 将精确选择器的结果同步到 sum state，只有 computedSum 变化才执行
  useEffect(() => {
    setSum(computedSum);
  }, [computedSum]);

  const isInRange = (r: { min: number; max: number }) => sum >= r.min && sum <= r.max;
  const matchedRangeId = ranges.find((range) => range.min <= range.max && isInRange(range))?.id;

  const hasInput = useStore((state) => state.edges.some((edge) => edge.target === id));
  const hasMatchedThreshold = sum === threshold;
  const isGreaterVisualActive = hasInput && sum >= threshold;
  const isLessVisualActive = hasInput && (hasMatchedThreshold || sum < threshold);
  const getConditionBoxClasses = (isActive: boolean) =>
    isActive
      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
      : 'border-zinc-400/60 bg-[var(--app-bg)]/55 text-[var(--text-primary)]';

  const inputRingClasses = hasInput
    ? ''
    : 'ring-2 ring-offset-2 ring-offset-[var(--card-bg)] ring-zinc-400/60';
  const hasGreaterOutput = useStore((state) =>
    state.edges.some((edge) => edge.source === id && edge.sourceHandle === 'out-greater'),
  );
  const hasLessEqualOutput = useStore((state) =>
    state.edges.some((edge) => edge.source === id && edge.sourceHandle === 'out-less-equal'),
  );
  const connectedRangeHandles = useStore((state) =>
    state.edges
      .filter(
        (edge) =>
          edge.source === id &&
          typeof edge.sourceHandle === 'string' &&
          edge.sourceHandle.startsWith('out-range-'),
      )
      .map((edge) => edge.sourceHandle)
      .sort()
      .join('|'),
  );
  const activeOutputRingClasses =
    'ring-2 ring-offset-2 ring-offset-[var(--card-bg)] ring-emerald-500';
  const idleOutputRingClasses =
    'ring-2 ring-offset-2 ring-offset-[var(--card-bg)] ring-zinc-400/60';
  const invalidOutputRingClasses = 'ring-2 ring-offset-2 ring-offset-[var(--card-bg)] ring-red-500';
  const warningOutputRingClasses =
    'ring-2 ring-offset-2 ring-offset-[var(--card-bg)] ring-orange-400';
  const outputHandleClasses =
    'w-3 h-3 !bg-black border-2 border-[var(--card-bg)] rounded-full transition-[ring,transform,opacity] -right-1.5';
  const handleClasses =
    'w-3 h-3 !bg-black border-2 border-[var(--card-bg)] rounded-full transition-transform hover:scale-150 shadow-sm';
  const inputHandleClasses = `${handleClasses} ${inputRingClasses}`;

  return (
    <div
      ref={nodeRef}
      className={`w-[300px] bg-[var(--card-bg)] rounded-xl shadow-lg border-2 transition-all ${selected ? 'border-amber-500 shadow-amber-500/20' : 'border-[var(--card-border)]'} flex flex-col relative group`}
    >
      {/* 内部包装器用于实现 overflow-hidden 效果 */}
      <div className="flex flex-col w-full h-full rounded-xl overflow-hidden">
        {/* Header */}
        <div className="bg-[var(--header-bg)] border-b border-[var(--header-border)] px-3 py-2 flex items-center justify-between z-10 cursor-grab active:cursor-grabbing">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-bold text-[var(--text-primary)]">
              {lang === 'zh' ? '数值判断' : lang === 'ja' ? '数値判定' : 'Number Condition'}
            </span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => updateNodeData({ isReversed: !isReversed })}
              className={`px-1.5 py-1 rounded transition-colors flex items-center justify-center ${isReversed ? 'text-amber-400 bg-amber-500/20 hover:bg-amber-500/30' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-bg)]'}`}
              title={tr('反转输出节点位置', '出力位置を反転', 'Reverse output positions')}
            >
              <ArrowUpDown className="w-3 h-3" />
            </button>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="px-1.5 py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-bg)] rounded transition-colors flex items-center justify-center"
              title={
                isMinimized ? tr('展开', '展開', 'Expand') : tr('最小化', '最小化', 'Minimize')
              }
            >
              {isMinimized ? (
                <ChevronRight className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
            <button
              onClick={() => (data.onDelete as Function)(id)}
              className="px-1.5 py-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors flex items-center justify-center"
              title={tr('删除卡片', 'カードを削除', 'Delete card')}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <div className="p-4 flex flex-col gap-4 text-[var(--text-secondary)]">
            <div className="flex justify-between items-center bg-[var(--app-bg)] p-2 rounded-lg border border-[var(--card-border)]">
              <span className="text-xs font-medium text-[var(--text-muted)]">
                {tr('前置节点累计值', '前段ノードの合計値', 'Upstream total')}
              </span>
              <span className="text-sm font-bold text-amber-500">{sum}</span>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-[var(--text-muted)]">
                {tr('判断阈值（设定数字）', '判定しきい値', 'Condition threshold')}
              </label>
              <NumberInput
                value={threshold}
                onChange={(val) => updateNodeData({ threshold: val })}
                accentColor="amber"
              />
            </div>

            <div className="flex flex-col gap-2 mt-2">
              {!isReversed ? (
                <>
                  <div
                    ref={greaterConditionRef}
                    className={`flex justify-between items-center p-2 rounded-lg border transition-colors ${getConditionBoxClasses(isGreaterVisualActive)}`}
                  >
                    <span className="text-xs font-bold">
                      {tr('累计', '合計', 'Total')} ≥ {threshold}{' '}
                      {tr('（大于等于）', '（以上）', '(greater or equal)')}
                    </span>
                  </div>
                  <div
                    ref={lessConditionRef}
                    className={`flex justify-between items-center p-2 rounded-lg border transition-colors ${getConditionBoxClasses(isLessVisualActive)}`}
                  >
                    <span className="text-xs font-bold">
                      {tr('累计', '合計', 'Total')} &lt; {threshold}{' '}
                      {tr('（小于）', '（未満）', '(less)')}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div
                    ref={lessConditionRef}
                    className={`flex justify-between items-center p-2 rounded-lg border transition-colors ${getConditionBoxClasses(isLessVisualActive)}`}
                  >
                    <span className="text-xs font-bold">
                      {tr('累计', '合計', 'Total')} &lt; {threshold}{' '}
                      {tr('（小于）', '（未満）', '(less)')}
                    </span>
                  </div>
                  <div
                    ref={greaterConditionRef}
                    className={`flex justify-between items-center p-2 rounded-lg border transition-colors ${getConditionBoxClasses(isGreaterVisualActive)}`}
                  >
                    <span className="text-xs font-bold">
                      {tr('累计', '合計', 'Total')} ≥ {threshold}{' '}
                      {tr('（大于等于）', '（以上）', '(greater or equal)')}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Custom range branches */}
            {ranges.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2 px-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                    {tr('自定义范围', 'カスタム範囲', 'Custom ranges')}
                  </span>
                  <div className="h-px flex-1 bg-[var(--card-border)]" />
                </div>
                <div className="flex flex-col gap-2">
                  {ranges.map((range, index) => {
                    const isInvalid = range.min > range.max;
                    const overlapIndex = ranges.findIndex(
                      (other, otherIndex) =>
                        otherIndex !== index &&
                        other.min <= other.max &&
                        !isInvalid &&
                        range.min <= other.max &&
                        range.max >= other.min,
                    );
                    const isOverlapping = overlapIndex >= 0;
                    const rowStateClasses = isInvalid
                      ? 'border-red-500/70 bg-red-500/5'
                      : isOverlapping
                        ? 'border-orange-400/70 bg-orange-500/5'
                        : hasInput && matchedRangeId === range.id
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-zinc-400/60 bg-[var(--app-bg)]/55';

                    return (
                      <div
                        key={range.id}
                        ref={(element) => {
                          if (element) rangeRowRefs.current.set(range.id, element);
                          else rangeRowRefs.current.delete(range.id);
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          const draggedId =
                            event.dataTransfer.getData('text/range-id') || draggingRangeId;
                          if (draggedId) moveRange(draggedId, range.id);
                          setDraggingRangeId(null);
                        }}
                        className={`group/range animate-in fade-in slide-in-from-top-1 duration-200 rounded-lg border px-2 py-2 transition-[border-color,background-color,opacity] ${rowStateClasses} ${draggingRangeId === range.id ? 'opacity-45' : ''}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            draggable
                            onDragStart={(event) => {
                              event.stopPropagation();
                              event.dataTransfer.effectAllowed = 'move';
                              event.dataTransfer.setData('text/range-id', range.id);
                              setDraggingRangeId(range.id);
                            }}
                            onDragEnd={() => setDraggingRangeId(null)}
                            className="nodrag nopan -ml-1 cursor-grab rounded p-1 text-[var(--text-muted)] opacity-45 transition-opacity hover:bg-[var(--card-bg)] hover:opacity-100 active:cursor-grabbing"
                            title={tr('拖动排序', 'ドラッグして並べ替え', 'Drag to reorder')}
                          >
                            <GripVertical className="h-3.5 w-3.5" />
                          </button>
                          <span className="shrink-0 text-[11px] font-medium text-[var(--text-secondary)]">
                            {tr('累计值在', '合計値が', 'Total from')}
                          </span>
                          <input
                            data-range-min
                            type="number"
                            value={range.min}
                            onChange={(event) =>
                              updateRange(range.id, { min: Number(event.target.value) })
                            }
                            aria-label={tr('范围起始值', '範囲の開始値', 'Range start')}
                            className="nodrag nopan w-12 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-1 py-1 text-center text-xs font-bold text-[var(--text-primary)] outline-none transition-colors hover:border-amber-500/60 focus:border-amber-500"
                          />
                          <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                            {tr('至', 'から', 'to')}
                          </span>
                          <input
                            type="number"
                            value={range.max}
                            onChange={(event) =>
                              updateRange(range.id, { max: Number(event.target.value) })
                            }
                            aria-label={tr('范围结束值', '範囲の終了値', 'Range end')}
                            className="nodrag nopan w-12 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-1 py-1 text-center text-xs font-bold text-[var(--text-primary)] outline-none transition-colors hover:border-amber-500/60 focus:border-amber-500"
                          />
                          <span className="shrink-0 text-[11px] font-medium text-[var(--text-secondary)]">
                            {tr('之间', 'の間', '')}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeRange(range.id)}
                            className="nodrag nopan ml-auto rounded p-1 text-[var(--text-muted)] opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover/range:opacity-100 focus:opacity-100"
                            title={tr('删除范围分支', '範囲分岐を削除', 'Delete range branch')}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {(isInvalid || isOverlapping) && (
                          <div
                            className={`mt-1.5 flex items-center gap-1 pl-7 text-[10px] ${isInvalid ? 'text-red-400' : 'text-orange-400'}`}
                          >
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            <span>
                              {isInvalid
                                ? tr(
                                    '起始值不能大于结束值',
                                    '開始値は終了値以下にしてください',
                                    'Start cannot be greater than end',
                                  )
                                : tr(
                                    `与范围 ${overlapIndex + 1} 重叠`,
                                    `範囲 ${overlapIndex + 1} と重複しています`,
                                    `Overlaps range ${overlapIndex + 1}`,
                                  )}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              onClick={addRange}
              className="nodrag nopan w-full py-2 border border-dashed border-[var(--card-border)] hover:border-amber-500/80 hover:bg-amber-500/5 text-[var(--text-muted)] hover:text-amber-500 rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              {tr('添加范围分支', '範囲分岐を追加', 'Add range branch')}
            </button>
          </div>
        )}
      </div>

      {/* 两组输入源 (左侧、顶部) */}
      <Handle
        type="target"
        position={Position.Top}
        id="in-top"
        className={`${inputHandleClasses} -top-1.5 left-1/2 -translate-x-1/2 !z-50`}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="in-left"
        className={`${inputHandleClasses} -left-1.5 !z-50`}
        style={{ top: isMinimized ? '20px' : '133px' }}
      />

      {/* 两组输出源 (右侧对应不同条件) */}
      {!isMinimized && (
        <span
          aria-hidden
          style={{ top: `${conditionHandleTops.greater ?? (isReversed ? 235 : 195)}px` }}
          className="pointer-events-none absolute right-0 h-px w-4 -translate-y-1/2 bg-[var(--text-muted)] opacity-50 !z-40"
        />
      )}
      <Handle
        type="source"
        position={Position.Right}
        id="out-greater"
        style={{
          top: isMinimized
            ? '20px'
            : `${conditionHandleTops.greater ?? (isReversed ? 235 : 195)}px`,
        }}
        className={`${outputHandleClasses} ${
          hasGreaterOutput
            ? ''
            : isGreaterVisualActive
              ? activeOutputRingClasses
              : idleOutputRingClasses
        } !z-50`}
      />

      {!isMinimized && (
        <span
          aria-hidden
          style={{ top: `${conditionHandleTops.less ?? (isReversed ? 195 : 235)}px` }}
          className="pointer-events-none absolute right-0 h-px w-4 -translate-y-1/2 bg-[var(--text-muted)] opacity-50 !z-40"
        />
      )}
      <Handle
        type="source"
        position={Position.Right}
        id="out-less-equal"
        style={{
          top: isMinimized ? '20px' : `${conditionHandleTops.less ?? (isReversed ? 195 : 235)}px`,
        }}
        className={`${outputHandleClasses} ${
          hasLessEqualOutput
            ? ''
            : isLessVisualActive
              ? activeOutputRingClasses
              : idleOutputRingClasses
        } !z-50`}
      />

      {/* 动态范围输出源 */}
      {ranges.map((range, index) => {
        const isValid = range.min <= range.max;
        const isActive = hasInput && isValid && matchedRangeId === range.id;
        const isOverlapping = ranges.some(
          (other) =>
            other.id !== range.id &&
            other.min <= other.max &&
            isValid &&
            range.min <= other.max &&
            range.max >= other.min,
        );
        const sourceHandle = `out-range-${range.id}`;
        const isConnected = connectedRangeHandles.split('|').includes(sourceHandle);
        const topPos = rangeHandleTops[range.id] ?? 330 + index * 64;
        return (
          <React.Fragment key={range.id}>
            {!isMinimized && (
              <span
                aria-hidden
                style={{ top: `${topPos}px` }}
                className="pointer-events-none absolute right-0 h-px w-4 -translate-y-1/2 bg-[var(--text-muted)] opacity-50 !z-40"
              />
            )}
            <Handle
              type="source"
              position={Position.Right}
              id={sourceHandle}
              isConnectable={isValid}
              style={{ top: isMinimized ? '20px' : `${topPos}px` }}
              className={`${outputHandleClasses} ${!isValid ? 'opacity-40' : ''} ${
                isConnected
                  ? ''
                  : !isValid
                    ? invalidOutputRingClasses
                    : isOverlapping
                      ? warningOutputRingClasses
                      : isActive
                        ? activeOutputRingClasses
                        : idleOutputRingClasses
              } !z-50`}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
}

export const MemoizedNumberConditionNode = memo(NumberConditionNode);

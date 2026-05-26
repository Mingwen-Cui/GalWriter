import {
  Handle,
  NodeProps,
  Position,
  useStore,
  useStoreApi,
  useUpdateNodeInternals,
} from '@xyflow/react';
import { ArrowUpDown, Calculator, ChevronDown, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import React, { memo, useEffect, useState } from 'react';

import { NumberInput } from './NumberInput';

export function NumberConditionNode({ id, data, selected }: NodeProps) {
  const [sum, setSum] = useState(0);
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
    const newRanges = [...ranges, { id: Math.random().toString(36).substr(2, 9), min: 0, max: 10 }];
    updateNodeData({ ranges: newRanges });
  };

  const removeRange = (rangeId: string) => {
    const newRanges = ranges.filter((r) => r.id !== rangeId);
    updateNodeData({ ranges: newRanges });
  };

  const updateRange = (rangeId: string, updates: Partial<{ min: number; max: number }>) => {
    const newRanges = ranges.map((r) => (r.id === rangeId ? { ...r, ...updates } : r));
    updateNodeData({ ranges: newRanges });
  };

  // NOTE: 用精确选择器订阅"所有祖先节点的 nodeValue 之和"这个原始数字。
  // React Flow 内部用 Object.is 比较选择器返回值，只有数字真正变化才重渲染，
  // 不会订阅整个 edges/nodes 数组引用，彻底切断无限循环。
  const computedSum = useStore((state) => {
    const ancestors = new Set<string>();
    const queue = [id];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      for (const edge of state.edges) {
        if (edge.target === currentId && !ancestors.has(edge.source)) {
          ancestors.add(edge.source);
          queue.push(edge.source);
        }
      }
    }
    let total = 0;
    for (const nodeId of ancestors) {
      const node = state.nodes.find((n) => n.id === nodeId);
      if (node && typeof node.data.nodeValue === 'number') {
        total += node.data.nodeValue;
      }
    }
    return total;
  });

  // NOTE: 将精确选择器的结果同步到 sum state，只有 computedSum 变化才执行
  useEffect(() => {
    setSum(computedSum);
  }, [computedSum]);

  const isGreater = sum > threshold;
  const isInRange = (r: { min: number; max: number }) => sum >= r.min && sum <= r.max;

  // NOTE: 根据用户需求定义的视觉样式逻辑：
  // 1. 如果结果为绿色（isGreater 为 true），两个端口都变成绿色
  // 2. 如果结果为蓝色（!isGreater 为 true），另一个端口变成红色
  const greaterStyles = isGreater
    ? {
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500',
        text: 'text-emerald-400',
        handle: 'bg-emerald-400 ring-emerald-500/50',
      }
    : {
        bg: 'bg-red-500/10',
        border: 'border-red-500',
        text: 'text-red-400',
        handle: 'bg-red-400 ring-red-500/50',
      };

  const lessEqualStyles = isGreater
    ? {
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500',
        text: 'text-emerald-400',
        handle: 'bg-emerald-400 ring-emerald-500/50',
      }
    : {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500',
        text: 'text-blue-400',
        handle: 'bg-blue-400 ring-blue-500/50',
      };

  // NOTE: 使用 getState() 读取当前边连接状态，避免订阅整个 edges 数组
  const hasInput = storeApi.getState().edges.some((e) => e.target === id);
  const inputRingClasses = hasInput
    ? ''
    : 'ring-2 ring-offset-2 ring-offset-[var(--card-bg)] ring-amber-500/50';
  const handleClasses =
    'w-3 h-3 bg-amber-300 border-2 border-[var(--card-bg)] rounded-full transition-[transform,background-color] hover:scale-150 hover:bg-amber-500 shadow-sm';
  const inputHandleClasses = `${handleClasses} ${inputRingClasses}`;

  return (
    <div
      className={`w-[250px] bg-[var(--card-bg)] rounded-xl shadow-lg border-2 transition-all ${selected ? 'border-amber-500 shadow-amber-500/20' : 'border-[var(--card-border)]'} flex flex-col relative group`}
    >
      {/* 内部包装器用于实现 overflow-hidden 效果 */}
      <div className="flex flex-col w-full h-full rounded-xl overflow-hidden">
        {/* Header */}
        <div className="bg-[var(--header-bg)] border-b border-[var(--header-border)] px-3 py-2 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-bold text-[var(--text-primary)]">数值判断</span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => updateNodeData({ isReversed: !isReversed })}
              className={`px-1.5 py-1 rounded transition-colors flex items-center justify-center ${isReversed ? 'text-amber-400 bg-amber-500/20 hover:bg-amber-500/30' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-bg)]'}`}
              title="反转输出节点位置"
            >
              <ArrowUpDown className="w-3 h-3" />
            </button>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="px-1.5 py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-bg)] rounded transition-colors flex items-center justify-center"
              title={isMinimized ? '展开' : '最小化'}
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
              title="删除卡片"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <div className="p-4 flex flex-col gap-4 text-[var(--text-secondary)]">
            <div className="flex justify-between items-center bg-[var(--app-bg)] p-2 rounded-lg border border-[var(--card-border)]">
              <span className="text-xs font-medium text-[var(--text-muted)]">前置节点累计值</span>
              <span className="text-sm font-bold text-amber-500">{sum}</span>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-[var(--text-muted)]">
                判断阈值 (设定数字)
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
                    className={`flex justify-between items-center p-2 rounded-lg border-2 transition-colors ${greaterStyles.bg} ${greaterStyles.border}`}
                  >
                    <span className={`text-xs font-bold ${greaterStyles.text}`}>
                      累计 &gt; {threshold} (大于)
                    </span>
                  </div>
                  <div
                    className={`flex justify-between items-center p-2 rounded-lg border-2 transition-colors ${lessEqualStyles.bg} ${lessEqualStyles.border}`}
                  >
                    <span className={`text-xs font-bold ${lessEqualStyles.text}`}>
                      累计 ≤ {threshold} (小于等于)
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className={`flex justify-between items-center p-2 rounded-lg border-2 transition-colors ${lessEqualStyles.bg} ${lessEqualStyles.border}`}
                  >
                    <span className={`text-xs font-bold ${lessEqualStyles.text}`}>
                      累计 ≤ {threshold} (小于等于)
                    </span>
                  </div>
                  <div
                    className={`flex justify-between items-center p-2 rounded-lg border-2 transition-colors ${greaterStyles.bg} ${greaterStyles.border}`}
                  >
                    <span className={`text-xs font-bold ${greaterStyles.text}`}>
                      累计 &gt; {threshold} (大于)
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Ranges Section */}
            {ranges.length > 0 && (
              <div className="flex flex-col gap-2">
                {ranges.map((range, index) => (
                  <div
                    key={range.id}
                    className={`flex flex-col gap-2 p-2 rounded-lg border-2 transition-colors ${isInRange(range) ? 'bg-amber-500/10 border-amber-500' : 'bg-[var(--card-bg)] border-[var(--card-border)]'}`}
                  >
                    <div className="flex justify-between items-center">
                      <span
                        className={`text-[10px] font-bold ${isInRange(range) ? 'text-amber-400' : 'text-[var(--text-muted)]'}`}
                      >
                        范围限制 {index + 1}
                      </span>
                      <button
                        onClick={() => removeRange(range.id)}
                        className="text-[var(--text-muted)] hover:text-red-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <NumberInput
                        value={range.min}
                        onChange={(val) => updateRange(range.id, { min: val })}
                        className="flex-1"
                        accentColor="amber"
                      />
                      <span className="text-[var(--text-muted)] font-bold">~</span>
                      <NumberInput
                        value={range.max}
                        onChange={(val) => updateRange(range.id, { max: val })}
                        className="flex-1"
                        accentColor="amber"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={addRange}
              className="w-full py-1.5 border-2 border-dashed border-[var(--card-border)] hover:border-amber-500 text-[var(--text-muted)] hover:text-amber-500 rounded-lg text-[10px] font-bold transition-colors flex items-center justify-center gap-1"
            >
              <Plus className="w-3 h-3" />
              添加范围输出
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
      <Handle
        type="source"
        position={Position.Right}
        id="out-greater"
        style={{ top: isMinimized ? '20px' : isReversed ? '235px' : '195px' }}
        className={`w-3 h-3 border-2 border-[var(--card-bg)] rounded-full transition-[background-color,ring,transform] -right-1.5 ${greaterStyles.handle} ring-2 ring-offset-2 ring-offset-[var(--card-bg)] !z-50`}
      />
      {!isMinimized && (
        <span
          className={`absolute right-3 text-[9px] font-bold pointer-events-none transition-colors ${greaterStyles.text} !z-40`}
          style={{ top: isReversed ? '229px' : '189px' }}
        >
          &gt;
        </span>
      )}

      <Handle
        type="source"
        position={Position.Right}
        id="out-less-equal"
        style={{ top: isMinimized ? '20px' : isReversed ? '195px' : '235px' }}
        className={`w-3 h-3 border-2 border-[var(--card-bg)] rounded-full transition-[background-color,ring,transform] -right-1.5 ${lessEqualStyles.handle} ring-2 ring-offset-2 ring-offset-[var(--card-bg)] !z-50`}
      />
      {!isMinimized && (
        <span
          className={`absolute right-3 text-[9px] font-bold pointer-events-none transition-colors ${lessEqualStyles.text} !z-40`}
          style={{ top: isReversed ? '189px' : '229px' }}
        >
          ≤
        </span>
      )}

      {/* 动态范围输出源 */}
      {ranges.map((range, index) => {
        const isActive = isInRange(range);
        const topPos = 282 + index * 74;
        return (
          <React.Fragment key={range.id}>
            <Handle
              type="source"
              position={Position.Right}
              id={`out-range-${range.id}`}
              style={{ top: isMinimized ? '20px' : `${topPos}px` }}
              className={`w-3 h-3 border-2 border-[var(--card-bg)] rounded-full transition-[background-color,ring,transform] -right-1.5 ${isActive ? 'bg-amber-400 ring-2 ring-amber-500/50 ring-offset-2 ring-offset-[var(--card-bg)]' : 'bg-[var(--text-muted)]'} !z-50`}
            />
            {!isMinimized && (
              <span
                className="absolute right-3 text-[9px] font-bold text-[var(--text-muted)] pointer-events-none !z-40"
                style={{ top: `${topPos - 6}px` }}
              >
                R{index + 1}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export const MemoizedNumberConditionNode = memo(NumberConditionNode);

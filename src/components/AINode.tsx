import {
  Handle,
  NodeProps,
  NodeResizer,
  Position,
  useStoreApi,
  useUpdateNodeInternals,
} from '@xyflow/react';
import {
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Lightbulb,
  Loader2,
  MoveRight,
  Sparkles,
  Trash2,
} from 'lucide-react';
import React, { memo, useEffect, useState } from 'react';

/**
 * AI 情节分析卡片组件
 * 以数值判断卡片为模板重新设计，符合相同的板式结构与圆点形状
 * 同时支持鼠标拉拽调整宽高
 */
export function AINode({ id, data, selected }: NodeProps) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
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
  const title = (data.title as string) ?? 'AI 剧情分析';

  const storeApi = useStoreApi();
  const updateNodeInternals = useUpdateNodeInternals();

  // NOTE: 不订阅整个 edges/nodes 数组，在渲染时通过 getState() 读取快照以避免循环更新
  const { edges: currentEdges, nodes: currentNodes } = storeApi.getState();
  const selectionCount = currentNodes.filter((n) => n.selected).length;
  const hasInput = currentEdges.some((e) => e.target === id);

  // 当最小化状态改变时，更新节点内部布局以重新计算连线位置
  useEffect(() => {
    updateNodeInternals(id);
    const timer = setTimeout(() => {
      updateNodeInternals(id);
    }, 100);
    return () => clearTimeout(timer);
  }, [isMinimized, id]);

  const updateNodeData = (updates: any) => {
    if (data.onUpdate) {
      (data.onUpdate as Function)(id, updates);
    }
  };

  const onAnalyze = async (mode: string = 'summary') => {
    if (data.onAIAnalyze) {
      setLoading(true);
      await (data.onAIAnalyze as Function)(id, mode);
      setLoading(false);
    }
  };

  const onCopy = () => {
    if (data.result) {
      navigator.clipboard.writeText(data.result as string);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  /**
   * 格式化分析结果，适配新版卡片样式
   */
  const formatResult = (text: string) => {
    if (!text) return '';
    let html = text;
    // 处理标题
    html = html.replace(
      /^# (.*$)/gm,
      '<h1 class="text-sm font-black text-[var(--text-primary)] mt-3 mb-1.5 flex items-center gap-2"><span class="w-1 h-3.5 bg-emerald-500 rounded-full"></span>$1</h1>',
    );
    html = html.replace(
      /^## (.*$)/gm,
      '<h2 class="text-xs font-bold text-emerald-500 mt-3 mb-1 border-b border-[var(--card-border)] pb-0.5">$1</h2>',
    );
    html = html.replace(
      /^### (.*$)/gm,
      '<h3 class="text-[10px] font-bold text-[var(--text-secondary)] mt-2 mb-0.5">$1</h3>',
    );
    // 处理加粗
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="text-emerald-500 font-bold">$1</strong>');
    // 处理列表
    html = html.replace(
      /^\s*-\s+(.*$)/gm,
      '<div class="flex items-start gap-1.5 ml-1 mb-1"><span class="mt-1 w-1 h-1 rounded-full bg-emerald-400 shrink-0"></span><span class="text-[10px] text-[var(--text-secondary)]">$1</span></div>',
    );

    return html;
  };

  const ANALYSIS_MODES = [
    {
      id: 'summary',
      label: '汇总分析',
      icon: <Sparkles className="w-3 h-3" />,
      color: 'bg-indigo-500',
    },
    {
      id: 'structure',
      label: '剧情结构',
      icon: <ChevronRight className="w-3 h-3" />,
      color: 'bg-emerald-500',
    },
    {
      id: 'suggestions',
      label: '构思建议',
      icon: <Lightbulb className="w-3 h-3" />,
      color: 'bg-amber-500',
    },
    {
      id: 'direction',
      label: '写作方向',
      icon: <MoveRight className="w-3 h-3" />,
      color: 'bg-rose-500',
    },
  ];

  // NOTE: 不再订阅 edges/nodes， hasInput 已在上方通过 getState() 计算
  const inputRingClasses = hasInput
    ? ''
    : 'ring-2 ring-offset-2 ring-offset-[var(--card-bg)] ring-emerald-500/50';
  const handleClasses =
    'w-3 h-3 bg-emerald-300 border-2 border-[var(--card-bg)] rounded-full transition-[transform,background-color] hover:scale-150 hover:bg-emerald-500 shadow-sm';
  const inputHandleClasses = `${handleClasses} ${inputRingClasses}`;

  return (
    <div
      className={`w-full bg-[var(--card-bg)] rounded-xl shadow-lg border-2 transition-all ${selected ? 'border-emerald-500 shadow-emerald-500/20' : 'border-[var(--card-border)]'} flex flex-col relative group`}
      style={{
        height: isMinimized ? 'auto' : '100%',
        minHeight: isMinimized ? 'auto' : '150px',
      }}
    >
      <NodeResizer
        minWidth={250}
        minHeight={150}
        isVisible={!isMinimized && selected && selectionCount === 1}
        lineStyle={{ border: 'none' }}
        handleClassName="!w-2.5 !h-2.5 !bg-white !border-2 !border-emerald-500 !rounded-sm"
      />

      <div className="flex flex-col w-full h-full rounded-xl overflow-hidden">
        {/* Header */}
        <div className="bg-[var(--header-bg)] border-b border-[var(--header-border)] px-3 py-2 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-emerald-500" />
            <input
              type="text"
              value={title}
              onChange={(e) => updateNodeData({ title: e.target.value })}
              onFocus={(e) => e.target.select()}
              className="bg-transparent border-none outline-none text-xs font-bold text-[var(--text-primary)] w-full cursor-text"
            />
          </div>
          <div className="flex gap-1">
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
          <div className="p-4 flex flex-col gap-4 text-[var(--text-secondary)] flex-1 overflow-hidden">
            <p className="text-[10px] text-[var(--text-muted)] leading-relaxed shrink-0">
              连接剧本节点到此处，AI 将汇总所有输入并生成全局分析、逻辑检核或后续建议。
            </p>

            <div className="flex flex-wrap gap-2 shrink-0">
              {ANALYSIS_MODES.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => onAnalyze(mode.id)}
                  disabled={loading}
                  className={`flex-1 min-w-[100px] py-2 px-1 ${mode.color} hover:opacity-90 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50`}
                  title={mode.label}
                >
                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : mode.icon}
                  {mode.label}
                </button>
              ))}
            </div>

            {data.result && (
              <div className="mt-2 bg-[var(--app-bg)] rounded-lg border border-[var(--card-border)] flex flex-col overflow-hidden flex-1">
                <div className="flex justify-between items-center px-3 py-2 border-b border-[var(--card-border)] bg-[var(--header-bg)]/50 shrink-0">
                  <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                    分析结果
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={onCopy}
                      className="p-1 hover:bg-emerald-500/10 rounded transition-colors text-[var(--text-secondary)]"
                      title="复制分析结果"
                    >
                      {copied ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-[var(--card-border)] nodrag select-text">
                  <div
                    className="text-[10px] text-[var(--text-secondary)] leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: formatResult(data.result as string) }}
                  />
                  {!(data.result as string)?.includes('### 💡 修改解法') && (
                    <button
                      onClick={() => onAnalyze('solution')}
                      disabled={loading}
                      className="mt-4 w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50"
                      title="根据以上分析获取修改解法"
                    >
                      {loading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Lightbulb className="w-3 h-3" />
                      )}
                      获取对应解法
                    </button>
                  )}
                </div>
              </div>
            )}
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
        style={{ top: isMinimized ? '20px' : '50%' }}
      />

      {/* 输出源 (右侧) */}
      <Handle
        type="source"
        position={Position.Right}
        id="out-result"
        style={{ top: isMinimized ? '20px' : '50%' }}
        className={`w-3 h-3 bg-emerald-400 border-2 border-[var(--card-bg)] rounded-full transition-[background-color,ring,transform] -right-1.5 ring-2 ring-emerald-500/30 ring-offset-2 ring-offset-[var(--card-bg)] !z-50 hover:scale-150`}
      />
    </div>
  );
}

export const MemoizedAINode = memo(AINode);

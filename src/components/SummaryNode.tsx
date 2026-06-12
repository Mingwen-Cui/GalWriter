import { Handle, NodeProps, Position, useStoreApi, useUpdateNodeInternals } from '@xyflow/react';
import { ChevronDown, ChevronRight, Copy, FileText, RefreshCw, Trash2 } from 'lucide-react';
import React, { memo, useEffect, useState } from 'react';

import { formatCharacterNodeText, formatSceneNodeText } from '../lib/export';
import type { Language } from '../lib/i18n';

export function SummaryNode({ id, data, selected }: NodeProps) {
  const lang = (data.language as Language) || 'zh';
  const tr = (zh: string, ja: string, en: string) => (lang === 'zh' ? zh : lang === 'ja' ? ja : en);
  const [content, setContent] = useState('');
  const [copying, setCopying] = useState(false);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useArrows, setUseArrows] = useState(false);
  const [includeTitles, setIncludeTitles] = useState(true);
  const [traceToRoot, setTraceToRoot] = useState(false);
  // NOTE: 将最小化状态存储在 React Flow 的节点 data 中，以实现保存/载入项目文件时能够自动持久化该状态
  const isMinimized = !!data.isMinimized;

  /**
   * 更新节点的最小化状态，并通过 onUpdate 回调将变更同步到上层 React Flow 状态中
   * @param minimized 是否最小化
   */
  const setIsMinimized = (minimized: boolean) => {
    if (data && typeof data.onUpdate === 'function') {
      data.onUpdate(id, { isMinimized: minimized });
    }
  };

  const storeApi = useStoreApi();
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    updateNodeInternals(id);
    const timer = setTimeout(() => updateNodeInternals(id), 100);
    return () => clearTimeout(timer);
  }, [isMinimized, id]);

  const handleDelete = () => {
    if (data && typeof data.onDelete === 'function') {
      data.onDelete(id);
    }
  };

  const handleConvert = () => {
    // NOTE: 在函数调用时读取快照，而不订阅整个数组，避免不必要的重渲染
    const { edges, nodes } = storeApi.getState();
    // 找出所有可以到达当前汇总卡片的节点 (向后追溯)
    const ancestors = new Set<string>();
    const queue = [id];

    // BFS 找到所有祖先
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const incomingEdges = edges.filter((e) => e.target === currentId);
      for (const edge of incomingEdges) {
        if (!ancestors.has(edge.source)) {
          ancestors.add(edge.source);
          // 如果开启了追溯至开头，则继续向上寻找；否则只处理直接连接的卡片
          if (traceToRoot) {
            queue.push(edge.source);
          }
        }
      }
    }

    // NOTE: 过滤掉没有其他真实连接的孤立节点（例如通过批量导出被强制连接到当前汇总节点的原本孤立的卡片）
    const validAncestors = new Set<string>();
    for (const nodeId of ancestors) {
      const hasOtherConnections = edges.some(
        (e) => (e.source === nodeId && e.target !== id) || (e.target === nodeId && e.source !== id),
      );
      // 如果它有其他连接，或者是其他祖先节点，保留它
      if (hasOtherConnections) {
        validAncestors.add(nodeId);
      }
    }

    // 构建针对这些祖先节点的邻接表和入度表（只考虑在 validAncestors 集合中的边）
    const inDegree = new Map<string, number>();
    const graph = new Map<string, string[]>();

    for (const nodeId of validAncestors) {
      inDegree.set(nodeId, 0);
      graph.set(nodeId, []);
    }

    for (const edge of edges) {
      if (validAncestors.has(edge.source) && validAncestors.has(edge.target)) {
        graph.get(edge.source)!.push(edge.target);
        inDegree.set(edge.target, inDegree.get(edge.target)! + 1);
      }
    }

    // 拓扑排序 (Kahn算法)
    const sortedNodeIds: string[] = [];
    const q: string[] = [];

    // 初始化入度为 0 的节点
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0) {
        q.push(nodeId);
      }
    }

    while (q.length > 0) {
      const u = q.shift()!;
      sortedNodeIds.push(u);
      for (const v of graph.get(u)!) {
        inDegree.set(v, inDegree.get(v)! - 1);
        if (inDegree.get(v) === 0) {
          q.push(v);
        }
      }
    }

    // 处理图中存在环的情况：将未能排序的节点追加在后面
    const remaining = Array.from(validAncestors).filter((n) => !sortedNodeIds.includes(n));
    sortedNodeIds.push(...remaining);

    // 映射到实际的 Node 对象（剧情卡片 + 人物设定卡片）
    const connectedNodes = sortedNodeIds
      .map((nodeId) => nodes.find((n) => n.id === nodeId))
      .filter(
        (n) =>
          n && (n.type === 'storyNode' || n.type === 'characterNode' || n.type === 'sceneNode'),
      );

    // 提取纯文本
    const textArray = connectedNodes.map((n, idx) => {
      const headerParts = [];
      if (useNumbers) headerParts.push(`${idx + 1}.`);

      if (n!.type === 'characterNode') {
        const charName =
          (n!.data?.characterName as string) ||
          tr('未命名角色', '名前未設定のキャラクター', 'Unnamed Character');
        if (includeTitles) headerParts.push(charName);
        const header = headerParts.length > 0 ? `### ${headerParts.join(' ')}\n` : '';
        const body = formatCharacterNodeText(n!.data as Record<string, unknown>);
        return `${header}${body}`;
      }

      if (n!.type === 'sceneNode') {
        const sceneName =
          (n!.data?.sceneName as string) || tr('未命名场景', '名前未設定のシーン', 'Unnamed Scene');
        if (includeTitles) headerParts.push(sceneName);
        const header = headerParts.length > 0 ? `### ${headerParts.join(' ')}\n` : '';
        const body = formatSceneNodeText(n!.data as Record<string, unknown>);
        return `${header}${body}`;
      }

      const title = n?.data?.title || '';
      const text = n?.data?.text || '';

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = typeof text === 'string' ? text : '';
      const formattedText = (tempDiv.textContent || '').trim();
      if (includeTitles) headerParts.push(title || tr('卡片', 'カード', 'Card'));

      const header = headerParts.length > 0 ? `### ${headerParts.join(' ')}\n` : '';

      return `${header}${formattedText}`;
    });

    // 用箭头或空行给串起来
    const separator = useArrows ? '\n\n→\n\n' : '\n\n';
    const convertedText = textArray.join(separator);
    setContent(convertedText);
  };

  const handleCopy = async () => {
    if (!content) return;

    // NOTE: navigator.clipboard 仅在 HTTPS 或 localhost 等安全上下文中可用，
    // 在 HTTP 环境下为 undefined，需要前置判断后再降级到 execCommand 方案。
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(content);
        setCopying(true);
        setTimeout(() => setCopying(false), 2000);
        return;
      } catch {
        // Clipboard API 调用失败（如权限被拒绝），降级到备用方案
      }
    }

    // 备用复制方法：兼容非安全上下文或旧版浏览器
    const textArea = document.createElement('textarea');
    textArea.value = content;
    // 防止触发页面滚动
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  const renderContent = () => {
    if (!content)
      return (
        <div className="text-[var(--text-muted)] text-sm text-center py-8 select-none">
          {tr(
            '点击上方转化按钮，获取连接卡片的文字内容。',
            '上の変換ボタンを押すと、接続されたカードのテキストを取得できます。',
            'Click Convert above to collect text from connected cards.',
          )}
        </div>
      );

    const lines = content.split('\n');
    return lines.map((line, index) => {
      if (line.startsWith('### ')) {
        return (
          <h3 key={index} className="text-sm font-bold text-[var(--text-primary)] mt-4 mb-2">
            {line.replace('### ', '')}
          </h3>
        );
      }
      return (
        <p
          key={index}
          className="text-sm text-[var(--text-secondary)] mb-1 leading-relaxed break-words"
        >
          {line}
        </p>
      );
    });
  };

  // NOTE: 使用 getState() 读取当前边连接状态，避免订阅整个 edges 数组引发重渲染
  const hasInput = storeApi.getState().edges.some((e) => e.target === id);
  const ringClasses = hasInput
    ? ''
    : 'ring-2 ring-offset-2 ring-offset-[var(--card-bg)] ring-indigo-500/30';
  const handleClasses = `w-3 h-3 bg-indigo-400 border-2 border-[var(--card-bg)] rounded-full transition-all hover:bg-indigo-600 shadow-sm ${ringClasses}`;

  return (
    <div
      className={`w-[350px] bg-[var(--card-bg)] rounded-xl shadow-lg border-2 transition-all ${selected ? 'border-indigo-500 shadow-indigo-500/20' : 'border-[var(--card-border)]'} flex flex-col relative group`}
    >
      <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none border border-transparent" />

      {/* 内部包装器用于实现 overflow-hidden 效果 */}
      <div className="flex flex-col w-full h-full rounded-xl overflow-hidden">
        {/* 头部工具栏 */}
        <div className="bg-[var(--header-bg)] border-b border-[var(--header-border)] px-3 py-2 flex items-center justify-between z-10 relative cursor-grab active:cursor-grabbing">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-bold text-[var(--text-primary)]">
              {lang === 'zh' ? '文本导出' : lang === 'ja' ? 'テキスト書き出し' : 'Text Export'}
            </span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={handleConvert}
              className="px-2.5 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded text-[10px] font-bold transition-colors flex items-center gap-1 shadow-sm"
              title={tr(
                '将连接的卡片转换为纯文本',
                '接続されたカードをプレーンテキストに変換',
                'Convert connected cards to plain text',
              )}
            >
              <RefreshCw className="w-3 h-3" />
              {tr('转化', '変換', 'Convert')}
            </button>
            <button
              onClick={handleCopy}
              className={`px-2.5 py-1.5 rounded text-[10px] font-bold transition-colors flex items-center gap-1 shadow-sm border ${copying ? 'bg-green-500/10 border-green-500/50 text-green-500' : 'bg-[var(--app-bg)] border-[var(--card-border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--header-border)]'}`}
            >
              <Copy className="w-3 h-3" />
              {copying ? tr('已复制', 'コピー済み', 'Copied') : tr('复制', 'コピー', 'Copy')}
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
              onClick={handleDelete}
              className="px-1.5 py-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-colors flex items-center justify-center"
              title={tr('删除卡片', 'カードを削除', 'Delete card')}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* 设置选项 */}
            <div className="bg-[var(--app-bg)] border-b border-[var(--card-border)] px-3 py-2 flex flex-wrap items-center justify-start gap-4 text-[10px] text-[var(--text-secondary)] nodrag">
              <label className="flex items-center gap-1 cursor-pointer hover:text-[var(--text-primary)] transition-colors">
                <input
                  type="checkbox"
                  checked={useNumbers}
                  onChange={(e) => {
                    setUseNumbers(e.target.checked);
                    if (e.target.checked) setUseArrows(false);
                  }}
                  className="rounded border-[var(--card-border)] text-indigo-500 focus:ring-indigo-500 bg-[var(--card-bg)]"
                />
                <span className="font-medium">
                  {tr('数字编号', '番号を付ける', 'Number items')}
                </span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer hover:text-[var(--text-primary)] transition-colors">
                <input
                  type="checkbox"
                  checked={useArrows}
                  onChange={(e) => {
                    setUseArrows(e.target.checked);
                    if (e.target.checked) setUseNumbers(false);
                  }}
                  className="rounded border-[var(--card-border)] text-indigo-500 focus:ring-indigo-500 bg-[var(--card-bg)]"
                />
                <span className="font-medium">
                  {tr('使用箭头(→)连接', '矢印(→)で接続', 'Join with arrows (→)')}
                </span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer hover:text-[var(--text-primary)] transition-colors">
                <input
                  type="checkbox"
                  checked={includeTitles}
                  onChange={(e) => setIncludeTitles(e.target.checked)}
                  className="rounded border-[var(--card-border)] text-indigo-500 focus:ring-indigo-500 bg-[var(--card-bg)]"
                />
                <span className="font-medium">
                  {tr('包含标题', 'タイトルを含める', 'Include titles')}
                </span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer hover:text-[var(--text-primary)] transition-colors">
                <input
                  type="checkbox"
                  checked={traceToRoot}
                  onChange={(e) => setTraceToRoot(e.target.checked)}
                  className="rounded border-[var(--card-border)] text-indigo-500 focus:ring-indigo-500 bg-[var(--card-bg)]"
                />
                <span className="font-medium">
                  {tr('追溯至开头', '開始まで遡る', 'Trace to beginning')}
                </span>
              </label>
            </div>

            {/* 内容展示区 - 可选中文本 */}
            <div
              className="flex-1 p-4 overflow-y-auto max-h-[400px] min-h-[150px] nodrag cursor-text select-text"
              style={{ userSelect: 'text', WebkitUserSelect: 'text' }}
            >
              {renderContent()}
            </div>
          </>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className={`${handleClasses} -top-1.5 left-1/2 -translate-x-1/2 !z-50`}
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        style={{ top: isMinimized ? '20px' : '50%' }}
        className={`${handleClasses} -left-1.5 ${!isMinimized ? '-translate-y-1/2' : ''} !z-50`}
      />
    </div>
  );
}

export const MemoizedSummaryNode = memo(SummaryNode);

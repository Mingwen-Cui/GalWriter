import { NodeProps, useStore, useStoreApi } from '@xyflow/react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';

import type { Language } from '../lib/i18n';
import {
  buildRegionStoryItems,
  formatRegionStoryForPrompt,
  type RegionStoryItem,
  sortContentNodesInRegion,
} from '../lib/plotStructure';
import { findContainingRegion, isNodeInsideRegion, isStoryContentNode } from '../lib/regionUtils';

type DetailLevel = 'brief' | 'standard' | 'detailed';

export type PlotStructureGenerateParams = {
  toolNodeId: string;
  cardCount: number;
  detailLevel: DetailLevel;
  direction: string;
  regionStoryNodes: RegionStoryItem[];
  region: { id: string; type: 'dynamicGroup' | 'background' } | null;
};

export function PlotStructureNode({ id, data, selected }: NodeProps) {
  const lang = (data.language as Language) || 'zh';
  const tr = (zh: string, ja: string, en: string) => (lang === 'zh' ? zh : lang === 'ja' ? ja : en);
  const [cardCount, setCardCount] = useState(Number(data.cardCount) || 3);
  const [detailLevel, setDetailLevel] = useState<DetailLevel>(
    (data.detailLevel as DetailLevel) || 'standard',
  );
  const [direction, setDirection] = useState(String(data.direction || ''));
  const [isGenerating, setIsGenerating] = useState(false);

  /**
   * 手动刷新用。
   * 不再用 useEffect setState 更新预览，避免 Maximum update depth exceeded。
   */
  const [refreshTick, setRefreshTick] = useState(0);

  const storeApi = useStoreApi();
  const isMinimized = !!data.isMinimized;

  /**
   * 订阅 nodes / edges。
   * 区域内卡片新增、删除、连线变化后，regionStoryNodes 会重新计算。
   */
  const flowNodes = useStore((state) => state.nodes);
  const flowEdges = useStore((state) => state.edges);

  const detectedRegion = useStore((state) => findContainingRegion(state, id));

  const currentRegionKey = useMemo(() => {
    if (!detectedRegion) return '';
    return `${detectedRegion.type}:${detectedRegion.id}`;
  }, [detectedRegion?.id, detectedRegion?.type]);

  /**
   * 用 ref 缓存上一次可用的剧情内容。
   * 重点：ref 改变不会触发 render，所以不会造成无限循环。
   */
  const storyCacheRef = useRef<{
    regionKey: string;
    items: RegionStoryItem[];
  }>({
    regionKey: String(data.cachedRegionKey || ''),
    items: Array.isArray(data.cachedRegionStoryNodes)
      ? (data.cachedRegionStoryNodes as RegionStoryItem[])
      : [],
  });

  const updateNodeData = useCallback(
    (updates: Record<string, unknown>) => {
      if (typeof data.onUpdate === 'function') {
        (data.onUpdate as Function)(id, updates);
      }
    },
    [data.onUpdate, id],
  );

  const regionStoryNodes = useMemo(() => {
    const state = storeApi.getState();
    const region = findContainingRegion(state, id);
    if (!region) return [];

    const contentNodeIds = state.nodes
      .filter((node: any) => {
        if (node.id === id || !isStoryContentNode(node)) return false;
        return isNodeInsideRegion(state, node, region);
      })
      .map((node: any) => node.id);

    const orderedIds = sortContentNodesInRegion(contentNodeIds, state.nodes, state.edges);
    return buildRegionStoryItems(state.nodes, state.edges, orderedIds);
  }, [storeApi, id, currentRegionKey, flowNodes, flowEdges, refreshTick]);

  /**
   * 当前区域识别到内容时，更新 ref 缓存。
   * 注意：这里只改 ref，不 setState，不 updateNodeData，所以不会无限循环。
   */
  if (currentRegionKey && regionStoryNodes.length > 0) {
    storyCacheRef.current = {
      regionKey: currentRegionKey,
      items: regionStoryNodes,
    };
  }

  const cachedStoryNodes =
    currentRegionKey && storyCacheRef.current.regionKey === currentRegionKey
      ? storyCacheRef.current.items
      : [];

  /**
   * 真正用于生成的剧情内容：
   * 1. 当前区域有卡片，用当前识别内容。
   * 2. 当前区域没卡片，用上一次缓存内容。
   */
  const availableStoryNodes = regionStoryNodes.length > 0 ? regionStoryNodes : cachedStoryNodes;

  const isUsingCachedStory = regionStoryNodes.length === 0 && availableStoryNodes.length > 0;

  const detectedCount = regionStoryNodes.length;

  const previewContent = useMemo(() => {
    if (availableStoryNodes.length === 0) return '';
    return formatRegionStoryForPrompt(availableStoryNodes);
  }, [availableStoryNodes]);

  const setIsMinimized = (minimized: boolean) => {
    if (typeof data.onUpdate === 'function') {
      (data.onUpdate as Function)(id, { isMinimized: minimized });
    }
  };

  const handleRefreshPreview = () => {
    setRefreshTick((prev) => prev + 1);
  };

  const handleGenerate = async () => {
    if (!detectedRegion) {
      alert(
        tr(
          '请先将此卡片放入背景区域或动态包裹内部',
          'このカードを背景エリアまたは動的グループ内に配置してください',
          'Place this card inside a background area or dynamic group first',
        ),
      );
      return;
    }

    const storyNodesForGenerate =
      regionStoryNodes.length > 0 ? regionStoryNodes : availableStoryNodes;

    if (storyNodesForGenerate.length === 0) {
      alert(
        tr(
          '区域内未找到可识别的剧情卡片，也没有可复用的上一次识别内容',
          'エリア内に認識可能なストーリーカードがなく、再利用できる前回の内容もありません',
          'No recognizable story cards or reusable previous content were found in this area',
        ),
      );
      return;
    }

    if (!direction.trim()) {
      alert(tr('请填写后续发展走向', '今後の展開を入力してください', 'Describe the desired story direction'));
      return;
    }

    if (typeof data.onPlotStructureGenerate !== 'function') {
      alert(
        tr(
          '生成功能未就绪，请刷新页面后重试',
          '生成機能の準備ができていません。ページを再読み込みしてください',
          'Generation is not ready. Refresh the page and try again',
        ),
      );
      return;
    }

    if (currentRegionKey) {
      storyCacheRef.current = {
        regionKey: currentRegionKey,
        items: storyNodesForGenerate,
      };
    }

    setIsGenerating(true);

    /**
     * 这里只在点击生成时写回 data。
     * 不在 useEffect 里写回，避免无限循环。
     */
    updateNodeData({
      cardCount,
      detailLevel,
      direction,
      cachedRegionKey: currentRegionKey,
      cachedRegionStoryNodes: storyNodesForGenerate,
    });

    try {
      await (data.onPlotStructureGenerate as Function)({
        toolNodeId: id,
        cardCount: Math.max(1, Math.min(20, cardCount)),
        detailLevel,
        direction: direction.trim(),
        regionStoryNodes: storyNodesForGenerate,
        region: { id: detectedRegion.id, type: detectedRegion.type },
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = () => {
    if (typeof data.onDelete === 'function') {
      (data.onDelete as Function)(id);
    }
  };

  const detailOptions: { value: DetailLevel; label: string }[] = [
    { value: 'brief', label: tr('简略', '簡潔', 'Brief') },
    { value: 'standard', label: tr('标准', '標準', 'Standard') },
    { value: 'detailed', label: tr('详细', '詳細', 'Detailed') },
  ];

  return (
    <div
      className={`w-[260px] bg-[var(--card-bg)] rounded-xl shadow-lg border-2 transition-all duration-300 ${
        selected ? 'border-yellow-500 shadow-yellow-500/20' : 'border-[var(--card-border)]'
      } flex flex-col relative group overflow-hidden`}
    >
      <div className="bg-[var(--header-bg)] border-b border-[var(--header-border)] px-3 py-2 flex items-center justify-between z-10 relative cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-yellow-500" />
          <span className="text-xs font-bold text-[var(--text-primary)] tracking-tight">
            {lang === 'zh'
              ? '剧情结构设计'
              : lang === 'ja'
                ? 'ストーリー構成設計'
                : 'Story Structure Design'}
          </span>
        </div>

        <div className="flex gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="px-1.5 py-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--app-bg)] rounded transition-colors flex items-center justify-center"
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
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="p-4 flex flex-col gap-4 text-[var(--text-secondary)] nodrag">
          {detectedRegion ? (
            <div className="flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-2.5 py-2 text-[10px] leading-relaxed text-yellow-700">
              <Layers className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div className="flex flex-col">
                <span className="font-black">
                  {tr('已检测到', '検出済み：', 'Detected ')}
                  {detectedRegion.type === 'background'
                    ? tr('背景区域', '背景エリア', 'background area')
                    : tr('动态包裹', '動的グループ', 'dynamic group')}
                  {lang === 'zh' ? '：' : ': '}
                  {detectedRegion.title}
                </span>

                <span className="opacity-80">
                  {isUsingCachedStory
                    ? tr(
                        `当前区域暂无卡片，将复用上一次识别的 ${availableStoryNodes.length} 张内容`,
                        `現在のエリアにカードがないため、前回認識した ${availableStoryNodes.length} 件を再利用します`,
                        `No cards are currently in this area; reusing ${availableStoryNodes.length} previously detected item${availableStoryNodes.length === 1 ? '' : 's'}`,
                      )
                    : tr(
                        `已识别 ${detectedCount} 张卡片及其顺序`,
                        `${detectedCount} 枚のカードと順序を認識しました`,
                        `Detected ${detectedCount} card${detectedCount === 1 ? '' : 's'} and their order`,
                      )}
                </span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-2 text-[10px] text-amber-700">
              {tr(
                '请将此卡片拖入背景区域或动态包裹内部，以识别区域内剧情。',
                'エリア内のストーリーを認識するには、このカードを背景エリアまたは動的グループ内へ移動してください。',
                'Move this card into a background area or dynamic group to detect its story content.',
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">
              {tr('新增卡片数量', '追加カード数', 'New cards')}
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={cardCount}
              onChange={(event) => setCardCount(Number(event.target.value) || 1)}
              className="w-full bg-[var(--app-bg)] border-2 border-[var(--card-border)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-yellow-500 transition-all"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">
              {tr('剧情详细程度', 'ストーリーの詳細度', 'Detail level')}
            </label>

            <div className="grid grid-cols-3 gap-1 bg-[var(--app-bg)] p-1 rounded-lg border border-[var(--card-border)]">
              {detailOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDetailLevel(option.value)}
                  className={`py-1.5 rounded-md text-[9px] font-bold transition-all ${
                    detailLevel === option.value
                      ? 'bg-white shadow-sm text-yellow-600 ring-1 ring-yellow-500/10'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">
              {tr('后续发展走向', '今後の展開', 'Story direction')}
            </label>
            <textarea
              value={direction}
              onChange={(event) => setDirection(event.target.value)}
              placeholder={tr(
                '描述希望后续剧情如何发展，例如：主角发现真相后与反派对峙...',
                '今後の展開を入力してください。例：主人公が真相を知り、敵と対峙する...',
                'Describe the desired continuation, e.g. the protagonist discovers the truth and confronts the villain...',
              )}
              rows={3}
              className="w-full bg-[var(--app-bg)] border-2 border-[var(--card-border)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-yellow-500 transition-all resize-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                {tr('已识别内容预览', '認識した内容のプレビュー', 'Detected content preview')}
              </span>

              <button
                onClick={handleRefreshPreview}
                className="text-[10px] font-bold text-yellow-600 hover:text-yellow-700 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                {tr('刷新', '更新', 'Refresh')}
              </button>
            </div>

            <div className="bg-[var(--app-bg)] border border-[var(--card-border)] rounded-lg p-2.5 max-h-[120px] overflow-y-auto text-[10px] leading-relaxed text-[var(--text-secondary)]">
              {previewContent ? (
                previewContent.split('\n').map((line, index) =>
                  line.startsWith('### ') ? (
                    <p key={index} className="font-bold text-[var(--text-primary)] mt-1 first:mt-0">
                      {line.replace('### ', '')}
                    </p>
                  ) : (
                    <p key={index} className="mb-1 break-words">
                      {line || '\u00A0'}
                    </p>
                  ),
                )
              ) : (
                <span className="text-[var(--text-muted)]">
                  {tr('暂无内容', '内容がありません', 'No content')}
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || !detectedRegion || availableStoryNodes.length === 0}
            className="w-full py-2.5 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-black text-[10px] flex items-center justify-center gap-1.5 shadow-md shadow-yellow-600/20 active:scale-95 transition-all"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                {tr('生成中...', '生成中...', 'Generating...')}
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                {tr('一键生成后续故事', '続きを一括生成', 'Generate continuation')}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export const MemoizedPlotStructureNode = memo(PlotStructureNode);

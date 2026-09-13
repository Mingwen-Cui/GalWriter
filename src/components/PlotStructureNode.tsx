import { NodeProps, useStore, useStoreApi } from '@xyflow/react';
import { BookOpen, ChevronDown, ChevronRight, Gamepad2, Loader2, Play, Trash2 } from 'lucide-react';
import React, { memo, useMemo, useRef, useState } from 'react';

import type { PlotStructureFlowNode, StoryNodeData } from '../domain/project';
import type { Language } from '../lib/i18n';
import {
  buildRegionStoryItems,
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

export function PlotStructureNode({ id, data, selected }: NodeProps<PlotStructureFlowNode>) {
  const lang = (data.language as Language) || 'zh';
  const tr = (zh: string, ja: string, en: string) => (lang === 'zh' ? zh : lang === 'ja' ? ja : en);
  const mode = data.creationMode === 'play' ? 'play' : 'continue';
  const cardCount = Math.max(1, Math.min(20, Number(data.cardCount) || 3));
  const detailLevel = data.detailLevel || 'standard';
  const direction = data.direction || '';
  const [isGenerating, setIsGenerating] = useState(false);
  const busyRef = useRef(false);
  const storeApi = useStoreApi();
  const flowNodes = useStore((state) => state.nodes);
  const flowEdges = useStore((state) => state.edges);
  const detectedRegion = useStore((state) => findContainingRegion(state, id));
  const regionStoryNodes = useMemo(() => {
    const state = storeApi.getState();
    const region = findContainingRegion(state, id);
    if (!region) return [];
    const ids = flowNodes
      .filter(
        (node) =>
          node.id !== id && isStoryContentNode(node) && isNodeInsideRegion(state, node, region),
      )
      .map((node) => node.id);
    return buildRegionStoryItems(
      flowNodes,
      flowEdges,
      sortContentNodesInRegion(ids, flowNodes, flowEdges),
    );
  }, [flowNodes, flowEdges, id, storeApi]);
  const lastStory = regionStoryNodes.filter((node) => node.type === 'storyNode').at(-1);
  const update = (updates: Partial<PlotStructureFlowNode['data']>) => data.onUpdate?.(id, updates);

  const handleAction = async () => {
    if (!detectedRegion || !lastStory || busyRef.current) return;
    busyRef.current = true;
    setIsGenerating(true);
    try {
      if (mode === 'play') {
        const storyData = flowNodes.find((node) => node.id === lastStory.id)?.data as
          | StoryNodeData
          | undefined;
        const sceneNode = flowNodes.find(
          (node) =>
            node.type === 'sceneNode' && node.id === storyData?.presentation?.scene?.sourceNodeId,
        );
        await data.onEnterCreativeStory?.({
          toolNodeId: id,
          title: detectedRegion.title,
          storyNodes: regionStoryNodes,
          availableNodeIds: flowNodes
            .filter((node) => node.type === 'storyNode')
            .map((node) => node.id),
          choiceInterval: data.choiceInterval ?? 4,
          prefetchCount: data.prefetchCount ?? 3,
          scene:
            sceneNode && typeof sceneNode.data.sceneName === 'string'
              ? { nodeId: sceneNode.id, name: sceneNode.data.sceneName }
              : undefined,
        });
      } else {
        await data.onPlotStructureGenerate?.({
          toolNodeId: id,
          cardCount,
          detailLevel,
          direction:
            direction.trim() ||
            tr(
              '承接最后一张剧情卡，自然推进后续故事。',
              '最後のカードから自然に物語を続けてください。',
              'Continue naturally from the final story card.',
            ),
          regionStoryNodes,
          region: { id: detectedRegion.id, type: detectedRegion.type },
        });
      }
    } finally {
      busyRef.current = false;
      setIsGenerating(false);
    }
  };
  const ready = Boolean(
    detectedRegion &&
    lastStory &&
    (mode === 'play' ? data.onEnterCreativeStory : data.onPlotStructureGenerate),
  );
  const fieldClass =
    'rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)] px-2 py-1.5 text-[11px] text-[var(--text-primary)] outline-none focus:border-yellow-500';
  return (
    <div
      className={
        'w-[260px] bg-[var(--card-bg)] rounded-xl shadow-lg border-2 flex flex-col overflow-hidden ' +
        (selected ? 'border-yellow-500 shadow-yellow-500/20' : 'border-[var(--card-border)]')
      }
    >
      <div className="bg-[var(--header-bg)] border-b border-[var(--header-border)] px-3 py-2 flex items-center justify-between cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-yellow-500" />
          <span className="text-xs font-bold text-[var(--text-primary)]">
            {tr('剧情结构设计', 'ストーリー構成設計', 'Story Structure Design')}
          </span>
        </div>
        <div className="flex gap-1 nodrag">
          <button
            onClick={() => update({ isMinimized: !data.isMinimized })}
            aria-label={tr('展开或收起', '展開・折りたたみ', 'Expand or collapse')}
            className="p-1 text-[var(--text-secondary)] hover:bg-[var(--app-bg)] rounded"
          >
            {data.isMinimized ? (
              <ChevronRight className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>
          <button
            onClick={() => data.onDelete?.(id)}
            aria-label={tr('删除', '削除', 'Delete')}
            className="p-1 text-red-400 hover:bg-red-500/10 rounded"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
      {!data.isMinimized && (
        <div className="p-3 flex flex-col gap-3 nodrag nowheel text-[var(--text-secondary)]">
          <div
            className="grid grid-cols-2 gap-1 rounded-lg bg-[var(--app-bg)] p-1"
            role="group"
            aria-label={tr('创作模式', '創作モード', 'Creation mode')}
          >
            {(['continue', 'play'] as const).map((value) => (
              <button
                key={value}
                disabled={isGenerating}
                aria-pressed={mode === value}
                onClick={() => update({ creationMode: value })}
                className={
                  'rounded-md px-1 py-2 text-[11px] font-bold transition-colors disabled:opacity-50 ' +
                  (mode === value
                    ? 'bg-[var(--card-bg)] text-yellow-600 shadow-sm'
                    : 'hover:text-[var(--text-primary)]')
                }
              >
                {value === 'continue'
                  ? tr('普通续写', '続きを書く', 'Continue')
                  : tr('进入故事创作', '物語で創作', 'Play & create')}
              </button>
            ))}
          </div>
          <div className="text-[10px] leading-relaxed px-1">
            {lastStory ? (
              <>
                <div className="truncate text-[var(--text-muted)]" title={detectedRegion?.title}>
                  {detectedRegion?.title}
                </div>
                <div className="truncate" title={lastStory.title}>
                  {tr('承接：', '続き：', 'Continue from: ')}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {lastStory.title}
                  </span>
                </div>
              </>
            ) : (
              tr(
                '放入有剧情卡片的背景区域或动态包裹，即可开始。',
                'ストーリーカードのある背景エリアか動的グループに配置してください。',
                'Place this card in a background area or dynamic group containing a story.',
              )
            )}
          </div>
          {mode === 'continue' ? (
            <>
              <label className="flex items-center justify-between text-[11px] px-1">
                {tr('新增卡片', '追加カード', 'New cards')}
                <input
                  aria-label={tr('新增卡片数量', '追加カード数', 'New card count')}
                  type="number"
                  min={1}
                  max={20}
                  value={cardCount}
                  disabled={isGenerating}
                  onChange={(event) =>
                    update({
                      cardCount: Math.max(1, Math.min(20, Number(event.target.value) || 1)),
                    })
                  }
                  className={'w-16 ' + fieldClass}
                />
              </label>
              <textarea
                aria-label={tr(
                  '后续方向（可选）',
                  '展開の希望（任意）',
                  'Story direction (optional)',
                )}
                value={direction}
                disabled={isGenerating}
                onChange={(event) => update({ direction: event.target.value })}
                placeholder={tr(
                  '想往哪个方向发展？留空则自然续写',
                  '展開の希望は？空欄なら自然に続けます',
                  'A direction in mind? Leave blank to continue naturally',
                )}
                rows={2}
                className={'w-full resize-none ' + fieldClass}
              />
              <label className="flex flex-col gap-2 px-1 text-[11px]">
                <span>{tr('详细程度', '詳細度', 'Detail level')}</span>
                <input
                  type="range"
                  aria-label={tr('详细程度', '詳細度', 'Detail level')}
                  aria-valuetext={
                    detailLevel === 'brief'
                      ? tr('简略', '簡潔', 'Brief')
                      : detailLevel === 'detailed'
                        ? tr('详细', '詳細', 'Detailed')
                        : tr('标准', '標準', 'Standard')
                  }
                  min={0}
                  max={2}
                  step={1}
                  value={['brief', 'standard', 'detailed'].indexOf(detailLevel)}
                  disabled={isGenerating}
                  onChange={(event) =>
                    update({
                      detailLevel: (['brief', 'standard', 'detailed'] as const)[
                        Number(event.target.value)
                      ],
                    })
                  }
                  className="w-full accent-yellow-600 cursor-ew-resize disabled:cursor-not-allowed"
                />
                <span className="flex justify-between text-[10px] text-[var(--text-muted)]">
                  <span>{tr('简略', '簡潔', 'Brief')}</span>
                  <span>{tr('标准', '標準', 'Standard')}</span>
                  <span>{tr('详细', '詳細', 'Detailed')}</span>
                </span>
              </label>
            </>
          ) : (
            <>
              <p className="px-1 text-[11px] leading-relaxed">
                {tr(
                  '进入测试界面，边玩边聊。你的选择和想法会成为接下来的剧情。',
                  'テスト画面で遊びながら会話し、選択やアイデアで続きを創作します。',
                  'Open the playtest and chat as you play. Your choices and ideas shape what happens next.',
                )}
              </p>
              <label className="flex flex-col gap-2 px-1 text-[11px]">
                <span className="flex justify-between">
                  <span>{tr('选择节奏', '選択の間隔', 'Choice pacing')}</span>
                  <span>
                    {tr('约', '約', 'About ')} {data.choiceInterval ?? 4}{' '}
                    {tr('张剧情卡', '枚', 'cards')}
                  </span>
                </span>
                <input
                  type="range"
                  min={1}
                  max={12}
                  step={1}
                  value={data.choiceInterval ?? 4}
                  onChange={(event) => update({ choiceInterval: Number(event.target.value) })}
                  className="w-full accent-yellow-600 cursor-ew-resize"
                />
                <span className="flex justify-between text-[10px] text-[var(--text-muted)]">
                  <span>{tr('紧凑', '頻繁', 'Frequent')}</span>
                  <span>{tr('舒缓', 'ゆったり', 'Relaxed')}</span>
                </span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {tr(
                    '仅在关键分歧出现选项，不按张数强制弹出。',
                    '重要な分岐のみで選択。枚数で強制しません。',
                    'Choices appear at meaningful branches, never on a fixed card timer.',
                  )}
                </span>
              </label>
              <label className="flex items-center justify-between px-1 text-[11px]">
                {tr('提前准备路线', '先読みルート', 'Prepare routes ahead')}
                <select
                  value={data.prefetchCount ?? 3}
                  onChange={(event) => update({ prefetchCount: Number(event.target.value) })}
                  className={fieldClass}
                >
                  {[1, 2, 3].map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <button
            onClick={() => void handleAction()}
            disabled={isGenerating || !ready}
            className="w-full py-2.5 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors"
          >
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : mode === 'play' ? (
              <Gamepad2 className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3 h-3 fill-current" />
            )}
            {isGenerating
              ? tr('正在准备…', '準備中…', 'Preparing…')
              : mode === 'play'
                ? tr('进入故事', '物語に入る', 'Enter story')
                : tr('续写后续剧情', '続きを生成', 'Generate continuation')}
          </button>
        </div>
      )}
    </div>
  );
}
export const MemoizedPlotStructureNode = memo(PlotStructureNode);

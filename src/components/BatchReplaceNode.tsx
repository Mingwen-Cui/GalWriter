import { NodeProps, useStore, useStoreApi } from '@xyflow/react';
import {
  ChevronDown,
  ChevronRight,
  Highlighter,
  Layers,
  Play,
  RefreshCw,
  Replace,
  Search,
  Trash2,
  Type,
  Undo2,
  X,
} from 'lucide-react';
import React, { memo, useEffect, useRef, useState } from 'react';

import { Language, translations } from '../lib/i18n';

type Point = {
  x: number;
  y: number;
};

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type RegionInfo = {
  id: string;
  type: 'dynamicGroup' | 'background';
  title: string;
  area: number;
  origin?: Point;
  points?: Point[];
  rect?: Rect;
};

type ChildSnapshot = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 80;
const DEFAULT_BACKGROUND_WIDTH = 600;
const DEFAULT_BACKGROUND_HEIGHT = 400;
const DEFAULT_BATCH_WIDTH = 260;
const DEFAULT_BATCH_HEIGHT = 300;
const DEFAULT_GROUP_GAP = 38;

function asNumber(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function getNodeType(node: any) {
  return String(node?.type || '');
}

function isStoryNode(node: any) {
  return getNodeType(node) === 'storyNode';
}

function isBackgroundNode(node: any) {
  return getNodeType(node) === 'backgroundNode';
}

function isDynamicGroupNode(node: any) {
  return getNodeType(node) === 'groupNode';
}

function getInternalNode(state: any, nodeId: string) {
  return state?.nodeLookup?.get?.(nodeId);
}

function getAbsolutePosition(state: any, node: any): Point {
  const internalNode = getInternalNode(state, node.id);
  const absolutePosition = internalNode?.internals?.positionAbsolute;

  return {
    x: absolutePosition?.x ?? node?.position?.x ?? 0,
    y: absolutePosition?.y ?? node?.position?.y ?? 0,
  };
}

function getNodeSize(
  state: any,
  node: any,
  fallbackWidth = DEFAULT_NODE_WIDTH,
  fallbackHeight = DEFAULT_NODE_HEIGHT,
) {
  const internalNode = getInternalNode(state, node.id);
  const measured = internalNode?.measured ?? node?.measured;

  return {
    width: measured?.width ?? node?.width ?? asNumber(node?.style?.width, fallbackWidth),
    height: measured?.height ?? node?.height ?? asNumber(node?.style?.height, fallbackHeight),
  };
}

function getNodeCenter(
  state: any,
  node: any,
  fallbackWidth = DEFAULT_NODE_WIDTH,
  fallbackHeight = DEFAULT_NODE_HEIGHT,
): Point {
  const position = getAbsolutePosition(state, node);
  const size = getNodeSize(state, node, fallbackWidth, fallbackHeight);

  return {
    x: position.x + size.width / 2,
    y: position.y + size.height / 2,
  };
}

function getRectForNode(
  state: any,
  node: any,
  fallbackWidth = DEFAULT_BACKGROUND_WIDTH,
  fallbackHeight = DEFAULT_BACKGROUND_HEIGHT,
): Rect {
  const position = getAbsolutePosition(state, node);
  const size = getNodeSize(state, node, fallbackWidth, fallbackHeight);

  return {
    x: position.x,
    y: position.y,
    width: size.width,
    height: size.height,
  };
}

function pointInRect(point: Point, rect: Rect) {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function polygonArea(points: Point[]) {
  if (points.length < 3) return 0;

  let area = 0;

  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];

    area += current.x * next.y - next.x * current.y;
  }

  return area / 2;
}

function pointInPolygon(point: Point, polygon: Point[]) {
  if (polygon.length < 3) return false;

  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const current = polygon[i];
    const previous = polygon[j];

    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) / (previous.y - current.y || 0.00001) +
          current.x;

    if (intersects) inside = !inside;
  }

  return inside;
}

function cross(o: Point, a: Point, b: Point) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function getConvexHull(points: Point[]): Point[] {
  if (points.length <= 3) return points;

  const sorted = [...points].sort((a, b) => {
    if (a.x === b.x) return a.y - b.y;
    return a.x - b.x;
  });

  const lower: Point[] = [];

  for (const point of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0
    ) {
      lower.pop();
    }

    lower.push(point);
  }

  const upper: Point[] = [];

  for (let i = sorted.length - 1; i >= 0; i--) {
    const point = sorted[i];

    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0
    ) {
      upper.pop();
    }

    upper.push(point);
  }

  upper.pop();
  lower.pop();

  return lower.concat(upper);
}

function lineIntersection(p1: Point, d1: Point, p2: Point, d2: Point): Point | null {
  const denominator = d1.x * d2.y - d1.y * d2.x;

  if (Math.abs(denominator) < 0.00001) {
    return null;
  }

  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const t = (dx * d2.y - dy * d2.x) / denominator;

  return {
    x: p1.x + d1.x * t,
    y: p1.y + d1.y * t,
  };
}

function inflateConvexPolygon(points: Point[], gap: number): Point[] {
  if (points.length < 3) return points;

  const area = polygonArea(points);
  const isClockwise = area < 0;

  const offsetLines = points.map((current, index) => {
    const next = points[(index + 1) % points.length];

    const dx = next.x - current.x;
    const dy = next.y - current.y;
    const length = Math.hypot(dx, dy) || 1;

    const normal = isClockwise
      ? {
          x: -dy / length,
          y: dx / length,
        }
      : {
          x: dy / length,
          y: -dx / length,
        };

    return {
      point: {
        x: current.x + normal.x * gap,
        y: current.y + normal.y * gap,
      },
      direction: {
        x: dx,
        y: dy,
      },
      normal,
    };
  });

  const inflated: Point[] = [];

  for (let i = 0; i < points.length; i++) {
    const previousLine = offsetLines[(i - 1 + points.length) % points.length];
    const currentLine = offsetLines[i];

    const intersection = lineIntersection(
      previousLine.point,
      previousLine.direction,
      currentLine.point,
      currentLine.direction,
    );

    if (intersection) {
      inflated.push(intersection);
    } else {
      const originalPoint = points[i];
      const nx = previousLine.normal.x + currentLine.normal.x;
      const ny = previousLine.normal.y + currentLine.normal.y;
      const normalLength = Math.hypot(nx, ny) || 1;

      inflated.push({
        x: originalPoint.x + (nx / normalLength) * gap,
        y: originalPoint.y + (ny / normalLength) * gap,
      });
    }
  }

  return inflated;
}

function buildLiveHullPoints(
  childNodes: ChildSnapshot[],
  groupX: number,
  groupY: number,
  gap: number,
): Point[] {
  if (childNodes.length === 0) return [];

  const cardCornerPoints: Point[] = [];

  childNodes.forEach((node) => {
    const x1 = node.x - groupX;
    const y1 = node.y - groupY;
    const x2 = node.x - groupX + node.width;
    const y2 = node.y - groupY + node.height;

    cardCornerPoints.push({ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 });
  });

  const baseHull = getConvexHull(cardCornerPoints);

  if (baseHull.length < 3) {
    return baseHull;
  }

  return inflateConvexPolygon(baseHull, gap);
}

function buildDynamicGroupRegion(state: any, groupNode: any): RegionInfo | null {
  const childIds = ((groupNode.data?.childIds as string[]) || []).filter(Boolean);
  const groupPosition = getAbsolutePosition(state, groupNode);
  const groupGap = typeof groupNode.data?.gap === 'number' ? groupNode.data.gap : DEFAULT_GROUP_GAP;

  const childIdSet = new Set(childIds);

  const childNodes: ChildSnapshot[] = state.nodes
    .filter((node: any) => childIdSet.has(node.id))
    .map((node: any) => {
      const position = getAbsolutePosition(state, node);
      const size = getNodeSize(state, node);

      return {
        id: node.id,
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
      };
    });

  let points = buildLiveHullPoints(childNodes, groupPosition.x, groupPosition.y, groupGap);

  if (points.length < 3) {
    points = (groupNode.data?.hullPoints as Point[]) || [];
  }

  if (points.length < 3) return null;

  return {
    id: groupNode.id,
    type: 'dynamicGroup',
    title: (groupNode.data?.title as string) || '动态包裹',
    area: Math.abs(polygonArea(points)),
    origin: groupPosition,
    points,
  };
}

function buildBackgroundRegion(state: any, backgroundNode: any): RegionInfo {
  const rect = getRectForNode(
    state,
    backgroundNode,
    DEFAULT_BACKGROUND_WIDTH,
    DEFAULT_BACKGROUND_HEIGHT,
  );

  return {
    id: backgroundNode.id,
    type: 'background',
    title: (backgroundNode.data?.title as string) || '背景区域',
    area: rect.width * rect.height,
    rect,
  };
}

function isPointInsideRegion(point: Point, region: RegionInfo) {
  if (region.type === 'background' && region.rect) {
    return pointInRect(point, region.rect);
  }

  if (region.type === 'dynamicGroup' && region.origin && region.points) {
    return pointInPolygon(
      {
        x: point.x - region.origin.x,
        y: point.y - region.origin.y,
      },
      region.points,
    );
  }

  return false;
}

function findContainingRegion(state: any, nodeId: string): RegionInfo | null {
  const thisNode = state.nodes.find((node: any) => node.id === nodeId);

  if (!thisNode) return null;

  const center = getNodeCenter(state, thisNode, DEFAULT_BATCH_WIDTH, DEFAULT_BATCH_HEIGHT);

  const regions: RegionInfo[] = [];

  state.nodes.forEach((node: any) => {
    if (node.id === nodeId) return;

    if (isDynamicGroupNode(node)) {
      const region = buildDynamicGroupRegion(state, node);

      if (region && isPointInsideRegion(center, region)) {
        regions.push(region);
      }
    }

    if (isBackgroundNode(node)) {
      const region = buildBackgroundRegion(state, node);

      if (isPointInsideRegion(center, region)) {
        regions.push(region);
      }
    }
  });

  if (regions.length === 0) return null;

  /**
   * 如果同时处在动态包裹和普通背景里，优先选面积更小的那个区域。
   * 这样可以避免“大背景盖住小包裹”的情况。
   */
  return regions.sort((a, b) => a.area - b.area)[0];
}

function isNodeInsideRegion(state: any, node: any, region: RegionInfo) {
  const center = getNodeCenter(state, node);

  return isPointInsideRegion(center, region);
}

export function BatchReplaceNode({ id, data, selected }: NodeProps) {
  const [findText, setFindText] = useState<string>(
    typeof data.findText === 'string' ? data.findText : '',
  );
  const [replaceText, setReplaceText] = useState<string>(
    typeof data.replaceText === 'string' ? data.replaceText : '',
  );
  const [scope, setScope] = useState<'selected' | 'all' | 'group'>(
    data.scope === 'selected' || data.scope === 'all' || data.scope === 'group'
      ? data.scope
      : 'group',
  );
  const [lastResult, setLastResult] = useState<{
    count: number;
    time: string;
    history: { id: string; text: string }[];
  } | null>(null);
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);

  const storeApi = useStoreApi();
  const lang = (data.language as Language) || 'zh';
  const t = translations[lang];
  const tr = (zh: string, ja: string, en: string) => (lang === 'zh' ? zh : lang === 'ja' ? ja : en);

  // NOTE: 将最小化状态存储在 React Flow 的节点 data 中，以实现保存/载入项目文件时能够自动持久化该状态
  const isMinimized = !!data.isMinimized;

  const detectedRegion = useStore((state) => {
    return findContainingRegion(state, id);
  });

  /**
   * 只在“刚进入一个区域”时自动切到区域内。
   * 不锁定范围按钮：用户之后仍然可以手动切到“选中 / 全局”。
   */
  const lastAutoRegionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!detectedRegion) {
      lastAutoRegionIdRef.current = null;
      return;
    }

    if (lastAutoRegionIdRef.current === detectedRegion.id) {
      return;
    }

    lastAutoRegionIdRef.current = detectedRegion.id;
    setScope('group');

    if (data.onUpdate) {
      (data.onUpdate as Function)(id, {
        scope: 'group',
        autoRegionId: detectedRegion.id,
        autoRegionType: detectedRegion.type,
      });
    }
  }, [detectedRegion?.id, detectedRegion?.type, data, id]);

  /**
   * 更新节点的最小化状态，并通过 onUpdate 回调将变更同步到上层 React Flow 状态中
   * @param minimized 是否最小化
   */
  const setIsMinimized = (minimized: boolean) => {
    if (data && typeof data.onUpdate === 'function') {
      (data.onUpdate as Function)(id, { isMinimized: minimized });
    }
  };

  const updateNodeData = (updates: any) => {
    if (data.onUpdate) {
      (data.onUpdate as Function)(id, updates);
    }
  };

  const handleScopeChange = (nextScope: 'selected' | 'all' | 'group') => {
    setScope(nextScope);
    updateNodeData({ scope: nextScope });
  };

  const getTargetNodes = () => {
    // NOTE: 在函数调用时读取快照，而不订阅整个数组，避免订阅引发不必要的重渲染
    const state = storeApi.getState();
    const nodes = state.nodes;
    let targetNodes: any[] = [];

    if (scope === 'all') {
      targetNodes = nodes.filter((node: any) => isStoryNode(node));
    } else if (scope === 'selected') {
      targetNodes = nodes.filter(
        (node: any) => node.selected && isStoryNode(node) && node.id !== id,
      );
    } else {
      const activeRegion = findContainingRegion(state, id);

      if (activeRegion) {
        targetNodes = nodes.filter((node: any) => {
          if (!isStoryNode(node) || node.id === id) return false;

          return isNodeInsideRegion(state, node, activeRegion);
        });
      } else {
        const thisNode = nodes.find((node: any) => node.id === id);

        if (thisNode) {
          const parentGroup = nodes.find(
            (node: any) =>
              isDynamicGroupNode(node) && (node.data.childIds as string[])?.includes(id),
          );

          if (parentGroup) {
            const childIds = (parentGroup.data.childIds as string[]) || [];
            targetNodes = nodes.filter(
              (node: any) => childIds.includes(node.id) && isStoryNode(node) && node.id !== id,
            );
          } else {
            const myCenter = getNodeCenter(
              state,
              thisNode,
              DEFAULT_BATCH_WIDTH,
              DEFAULT_BATCH_HEIGHT,
            );

            const containingBg = nodes.find((node: any) => {
              if (!isBackgroundNode(node)) return false;

              const rect = getRectForNode(
                state,
                node,
                DEFAULT_BACKGROUND_WIDTH,
                DEFAULT_BACKGROUND_HEIGHT,
              );

              return pointInRect(myCenter, rect);
            });

            if (containingBg) {
              const region = buildBackgroundRegion(state, containingBg);

              targetNodes = nodes.filter((node: any) => {
                if (!isStoryNode(node) || node.id === id) return false;

                return isNodeInsideRegion(state, node, region);
              });
            }
          }
        }
      }
    }

    return targetNodes;
  };

  const handleExecute = () => {
    if (!findText) {
      alert(tr('请输入查找内容', '検索する文字列を入力してください', 'Please enter text to find'));
      return;
    }

    const targetNodes = getTargetNodes();

    if (targetNodes.length === 0) {
      alert(
        tr(
          '范围内未找到可替换的剧情卡片',
          '範囲内に置換可能なストーリーカードがありません',
          'No story cards found in scope',
        ),
      );
      return;
    }

    let totalCount = 0;
    const history: { id: string; text: string }[] = [];

    targetNodes.forEach((node) => {
      const text = node.data.text || '';

      if (typeof text === 'string' && text.includes(findText)) {
        const matches = text.split(findText).length - 1;
        totalCount += matches;
        history.push({ id: node.id, text });

        const newText = text.replaceAll(findText, replaceText);

        if (data.onUpdate) {
          (data.onUpdate as Function)(node.id, { text: newText });
        }
      }
    });

    setLastResult({
      count: totalCount,
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      history,
    });

    updateNodeData({ findText, replaceText, scope });
  };

  const handleUndo = () => {
    if (!lastResult || !lastResult.history.length) return;

    lastResult.history.forEach((item) => {
      if (data.onUpdate) {
        (data.onUpdate as Function)(item.id, { text: item.text });
      }
    });

    setLastResult(null);
  };

  const toggleHighlight = () => {
    if (!findText) return;

    const targetNodes = getTargetNodes();
    const highlightTag = 'data-replace-highlight="true"';
    const highlightStyle =
      'style="color: red; font-weight: bold; background: rgba(239, 68, 68, 0.1); padding: 0 2px; border-radius: 2px;"';

    targetNodes.forEach((node) => {
      const text = node.data.text || '';

      if (typeof text !== 'string') return;

      if (!isHighlighting) {
        const highlighted = text.replaceAll(
          findText,
          `<span ${highlightTag} ${highlightStyle}>${findText}</span>`,
        );

        if (data.onUpdate) {
          (data.onUpdate as Function)(node.id, { text: highlighted });
        }
      } else {
        const regex = new RegExp(`<span ${highlightTag} [^>]*>(.*?)</span>`, 'g');
        const stripped = text.replace(regex, '$1');

        if (data.onUpdate) {
          (data.onUpdate as Function)(node.id, { text: stripped });
        }
      }
    });

    setIsHighlighting(!isHighlighting);
  };

  const handleSwap = () => {
    setIsSwapping(true);

    const temp = findText;
    setFindText(replaceText);
    setReplaceText(temp);

    setTimeout(() => setIsSwapping(false), 500);
  };

  const handleDelete = () => {
    if (data.onDelete) {
      (data.onDelete as Function)(id);
    }
  };

  return (
    <div
      className={`w-[260px] bg-[var(--card-bg)] rounded-xl shadow-lg border-2 transition-all duration-300 ${
        selected ? 'border-teal-500 shadow-teal-500/20' : 'border-[var(--card-border)]'
      } flex flex-col relative group overflow-hidden`}
    >
      {/* Header */}
      <div className="bg-[var(--header-bg)] border-b border-[var(--header-border)] px-3 py-2 flex items-center justify-between z-10 relative cursor-grab active:cursor-grabbing">
        <div className="flex items-center gap-2">
          <Replace className="w-4 h-4 text-teal-500" />
          <span className="text-xs font-bold text-[var(--text-primary)] tracking-tight">
            {lang === 'zh'
              ? '批量替换工具'
              : lang === 'ja'
                ? '一括置換ツール'
                : 'Batch Replace Tool'}
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
          {detectedRegion && (
            <div className="flex items-start gap-2 rounded-lg border border-teal-500/20 bg-teal-500/10 px-2.5 py-2 text-[10px] leading-relaxed text-teal-700">
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
                  {tr(
                    '选择“区域内”时，只会作用于该区域内部的剧情卡片；范围按钮不会锁定。',
                    '「エリア内」を選ぶと、このエリア内のストーリーカードだけが対象になります。範囲ボタンは固定されません。',
                    'Area scope affects only story cards inside this region; the scope buttons remain editable.',
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Result Info Area with Undo on Hover */}
          <div className="relative group/result flex justify-between items-center bg-[var(--app-bg)] p-2.5 rounded-lg border border-[var(--card-border)] shadow-inner transition-all overflow-hidden">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                {tr('最新操作结果', '最新の操作結果', 'Latest result')}
              </span>
              <span
                className={`text-xs font-black ${
                  lastResult ? 'text-teal-600' : 'text-[var(--text-muted)]'
                }`}
              >
                {lastResult
                  ? tr(
                      `已替换 ${lastResult.count} 处`,
                      `${lastResult.count} 件を置換しました`,
                      `Replaced ${lastResult.count} occurrence${lastResult.count === 1 ? '' : 's'}`,
                    )
                  : tr('等待任务...', '待機中...', 'Waiting...')}
              </span>
            </div>

            {lastResult && (
              <button
                onClick={handleUndo}
                className="absolute inset-y-0 right-0 px-3 bg-teal-600 text-white flex items-center gap-1.5 translate-x-full group-hover/result:translate-x-0 transition-transform duration-300 shadow-[-4px_0_10px_rgba(0,0,0,0.1)]"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold">{tr('撤销', '元に戻す', 'Undo')}</span>
              </button>
            )}
          </div>

          {/* Inputs Section */}
          <div className="flex flex-col gap-4">
            {/* Find Input Row */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-[var(--text-muted)] px-1 flex items-center gap-1.5 uppercase tracking-wider">
                <Search className="w-3 h-3 text-teal-500" />
                {tr('查找内容', '検索文字列', 'Find')}
              </label>

              <div className="flex gap-2">
                <div className="relative flex-1 group/input">
                  <input
                    type="text"
                    value={findText}
                    onChange={(event) => setFindText(event.target.value)}
                    placeholder={tr('查找...', '検索...', 'Find...')}
                    className="w-full bg-[var(--app-bg)] border-2 border-[var(--card-border)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-teal-500 transition-all pr-8"
                  />

                  {findText && (
                    <button
                      onClick={() => setFindText('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-teal-500 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Square Swap Button */}
                <button
                  onClick={handleSwap}
                  className="w-[36px] h-[36px] shrink-0 bg-[var(--card-bg)] border-2 border-[var(--card-border)] text-teal-500 rounded-lg shadow-sm hover:border-teal-500 hover:text-teal-600 transition-all flex items-center justify-center active:bg-teal-50"
                  title={tr('交换内容', '検索と置換を入れ替える', 'Swap find and replace')}
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 transition-transform duration-500 ${
                      isSwapping ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Replace Input Row */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-[var(--text-muted)] px-1 flex items-center gap-1.5 uppercase tracking-wider">
                <Type className="w-3 h-3 text-teal-500" />
                {tr('替换为', '置換後', 'Replace with')}
              </label>

              <div className="relative group/input">
                <input
                  type="text"
                  value={replaceText}
                  onChange={(event) => setReplaceText(event.target.value)}
                  placeholder={tr('替换为...', '置換後...', 'Replace with...')}
                  className="w-full bg-[var(--app-bg)] border-2 border-[var(--card-border)] rounded-lg px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-teal-500 transition-all pr-8"
                />

                {replaceText && (
                  <button
                    onClick={() => setReplaceText('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-teal-500 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons: Highlight & Execute */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={toggleHighlight}
              disabled={!findText}
              className={`flex-1 py-2 rounded-lg border-2 font-bold text-[10px] flex items-center justify-center gap-1.5 transition-all ${
                isHighlighting
                  ? 'bg-red-500 border-red-500 text-white shadow-md'
                  : 'border-teal-500/30 text-teal-600 hover:bg-teal-500/5 hover:border-teal-500'
              }`}
            >
              <Highlighter className="w-3.5 h-3.5" />
              {isHighlighting
                ? tr('取消标红', '強調を解除', 'Clear highlight')
                : tr('标出文本', '文字列を強調', 'Highlight matches')}
            </button>

            <button
              onClick={handleExecute}
              className="flex-[1.5] py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-black text-[10px] flex items-center justify-center gap-1.5 shadow-md shadow-teal-600/20 active:scale-95 transition-all"
            >
              <Play className="w-3 h-3 fill-current" />
              {tr('执行替换', '置換を実行', 'Replace')}
            </button>
          </div>

          {/* Scope Controls */}
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest px-1">
              {tr('范围控制', '対象範囲', 'Scope')}
            </label>

            <div className="grid grid-cols-3 gap-1 bg-[var(--app-bg)] p-1 rounded-lg border border-[var(--card-border)]">
              {(['group', 'selected', 'all'] as const).map((nextScope) => (
                <button
                  key={nextScope}
                  onClick={() => handleScopeChange(nextScope)}
                  className={`py-1.5 rounded-md text-[9px] font-bold transition-all ${
                    scope === nextScope
                      ? 'bg-white shadow-sm text-teal-600 ring-1 ring-teal-500/10'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {nextScope === 'group'
                    ? tr('区域内', 'エリア内', 'Area')
                    : nextScope === 'selected'
                      ? tr('选中', '選択中', 'Selected')
                      : tr('全局', '全体', 'All')}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {isMinimized && (
        <div className="px-3 py-2 flex items-center justify-between bg-teal-50/30">
          <div className="flex items-center gap-1.5 min-w-0">
            <Replace className="w-3 h-3 text-teal-500 shrink-0" />
            <span className="text-[10px] text-teal-600 font-bold opacity-80 truncate">
              {findText
                ? `${tr('查找', '検索', 'Find')}: ${findText}`
                : tr('准备就绪', '準備完了', 'Ready')}
            </span>
          </div>

          {lastResult && (
            <span className="text-[9px] bg-teal-500 text-white px-1.5 rounded-full font-black">
              {lastResult.count}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export const MemoizedBatchReplaceNode = memo(BatchReplaceNode);

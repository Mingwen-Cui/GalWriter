import React, { memo, useCallback, useMemo } from 'react';
import { NodeProps, NodeToolbar, Position, useStore } from '@xyflow/react';
import { Lock, Replace, Unlock, BookOpen } from 'lucide-react';

/**
 * 动态包裹组件
 *
 * 新增：
 * 1. 动态检测批量修改/批量替换工具是否位于当前动态包裹区域内部。
 * 2. 顶部 NodeToolbar 显示“批量工具 ×N”标签。
 * 3. 顶部小标题胶囊也同步显示一个小计数标记。
 */

type Point = {
  x: number;
  y: number;
};

type ChildSnapshot = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type ToolSnapshot = {
  id: string;
  center: Point;
};

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 80;
const DEFAULT_BATCH_TOOL_WIDTH = 260;
const DEFAULT_BATCH_TOOL_HEIGHT = 260;

/**
 * 这里控制动态边框与内部卡片之间的距离。
 * 想更宽就改大，比如 44 / 52。
 * 想更紧就改小，比如 24 / 28。
 */
const DEFAULT_GROUP_GAP = 38;

function cross(o: Point, a: Point, b: Point) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function getPolygonArea(points: Point[]) {
  if (points.length < 3) return 0;

  let area = 0;

  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];

    area += current.x * next.y - next.x * current.y;
  }

  return area / 2;
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

function lineIntersection(
  p1: Point,
  d1: Point,
  p2: Point,
  d2: Point
): Point | null {
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

/**
 * 将凸包整体向外扩张 gap。
 * 这个比“给每个卡片四角单独加 padding”更稳定。
 */
function inflateConvexPolygon(points: Point[], gap: number): Point[] {
  if (points.length < 3) return points;

  const area = getPolygonArea(points);
  const isClockwise = area < 0;

  const offsetLines = points.map((current, index) => {
    const next = points[(index + 1) % points.length];

    const dx = next.x - current.x;
    const dy = next.y - current.y;
    const length = Math.hypot(dx, dy) || 1;

    /**
     * 对于逆时针多边形，外侧是边的右法线。
     * 对于顺时针多边形，外侧是边的左法线。
     */
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
      currentLine.direction
    );

    if (intersection) {
      inflated.push(intersection);
    } else {
      /**
       * 极少数情况下两条线接近平行，用平均法线兜底。
       */
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

/**
 * 根据内部卡片真实边缘计算动态包裹点。
 */
function buildLiveHullPoints(
  childNodes: ChildSnapshot[],
  groupX: number,
  groupY: number,
  gap: number
): Point[] {
  if (childNodes.length === 0) return [];

  const cardCornerPoints: Point[] = [];

  childNodes.forEach((node) => {
    const x1 = node.x - groupX;
    const y1 = node.y - groupY;
    const x2 = node.x - groupX + node.width;
    const y2 = node.y - groupY + node.height;

    cardCornerPoints.push(
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 }
    );
  });

  const baseHull = getConvexHull(cardCornerPoints);

  if (baseHull.length < 3) {
    return baseHull;
  }

  return inflateConvexPolygon(baseHull, gap);
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
      ((previous.x - current.x) * (point.y - current.y)) /
      ((previous.y - current.y) || 0.00001) +
      current.x;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function readNumber(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function isBatchToolNode(node: any) {
  const type = String(node?.type || '').toLowerCase();
  const toolType = String(node?.data?.toolType || '').toLowerCase();
  const nodeKind = String(node?.data?.nodeKind || '').toLowerCase();
  const title = String(node?.data?.title || node?.data?.label || '').toLowerCase();

  return (
    type === 'batchreplacenode' ||
    type === 'batchreplace' ||
    type === 'batchreplacetool' ||
    type === 'batchtoolnode' ||
    type === 'plotstructurenode' ||
    toolType === 'batchreplace' ||
    toolType === 'plotstructure' ||
    nodeKind === 'batchreplace' ||
    nodeKind === 'plotstructure' ||
    title.includes('批量替换') ||
    title.includes('批量修改') ||
    title.includes('剧情结构设计')
  );
}

export function GroupNode({ id, data, selected, width, height }: NodeProps) {
  const childIds = (data.childIds as string[]) || [];
  const color = (data.color as string) || '#6366f1';
  const title = (data.title as string) ?? '动态包裹';
  const locked = data.locked === true;

  /**
   * 允许你以后从 data 里单独控制距离。
   * 例如创建节点时传 data.gap = 50。
   */
  const groupGap =
    typeof data.gap === 'number'
      ? data.gap
      : DEFAULT_GROUP_GAP;

  const fallbackHullPoints = (data.hullPoints as Point[]) || [];

  const updateNodeData = useCallback(
    (updates: any) => {
      if (data.onUpdate) {
        (data.onUpdate as Function)(id, updates);
      }
    },
    [data, id]
  );

  const toggleLock = useCallback(() => {
    updateNodeData({ locked: !locked });
  }, [locked, updateNodeData]);

  const selectionCount = useStore((state) => {
    return state.nodes.filter((node) => node.selected).length;
  });

  /**
   * 使用 nodeLookup 里的 internals.positionAbsolute。
   * 这样即使子节点以后有 parentId，也不会因为相对坐标导致边距算错。
   */
  const groupPosition = useStore((state) => {
    const nodeLookup = (state as any).nodeLookup;
    const internalGroupNode = nodeLookup?.get?.(id);
    const publicGroupNode = state.nodes.find((node) => node.id === id);

    return {
      x:
        internalGroupNode?.internals?.positionAbsolute?.x ??
        publicGroupNode?.position?.x ??
        0,
      y:
        internalGroupNode?.internals?.positionAbsolute?.y ??
        publicGroupNode?.position?.y ??
        0,
    };
  });

  const childNodes = useStore((state) => {
    if (childIds.length === 0) return [];

    const nodeLookup = (state as any).nodeLookup;
    const childIdSet = new Set(childIds);

    return state.nodes
      .filter((node) => childIdSet.has(node.id))
      .map((node) => {
        const internalNode = nodeLookup?.get?.(node.id);
        const absolutePosition = internalNode?.internals?.positionAbsolute;
        const measured = internalNode?.measured ?? (node as any).measured;

        return {
          id: node.id,
          x:
            absolutePosition?.x ??
            node.position?.x ??
            0,
          y:
            absolutePosition?.y ??
            node.position?.y ??
            0,
          width:
            measured?.width ??
            node.width ??
            DEFAULT_NODE_WIDTH,
          height:
            measured?.height ??
            node.height ??
            DEFAULT_NODE_HEIGHT,
        };
      });
  });

  const hullPoints = useMemo(() => {
    const livePoints = buildLiveHullPoints(
      childNodes,
      groupPosition.x,
      groupPosition.y,
      groupGap
    );

    if (livePoints.length >= 3) {
      return livePoints;
    }

    return fallbackHullPoints;
  }, [
    childNodes,
    groupPosition.x,
    groupPosition.y,
    groupGap,
    fallbackHullPoints,
  ]);

  const batchToolSnapshots = useStore((state) => {
    const nodeLookup = (state as any).nodeLookup;

    return state.nodes
      .filter((node) => node.id !== id && isBatchToolNode(node))
      .map((node) => {
        const internalNode = nodeLookup?.get?.(node.id);
        const absolutePosition = internalNode?.internals?.positionAbsolute;
        const measured = internalNode?.measured ?? (node as any).measured;

        const x = absolutePosition?.x ?? node.position?.x ?? 0;
        const y = absolutePosition?.y ?? node.position?.y ?? 0;
        const nodeWidth =
          measured?.width ??
          node.width ??
          readNumber(node.style?.width, DEFAULT_BATCH_TOOL_WIDTH);
        const nodeHeight =
          measured?.height ??
          node.height ??
          readNumber(node.style?.height, DEFAULT_BATCH_TOOL_HEIGHT);

        return {
          id: node.id,
          center: {
            x: x + nodeWidth / 2,
            y: y + nodeHeight / 2,
          },
        };
      });
  });

  /**
   * 动态包裹专用检测：
   * 把批量工具中心点转换成当前 GroupNode 内部坐标，再用凸包判断是否在区域内部。
   */
  const batchToolsInside = useMemo<ToolSnapshot[]>(() => {
    if (hullPoints.length < 3) return [];

    return batchToolSnapshots.filter((tool) => {
      const localCenter = {
        x: tool.center.x - groupPosition.x,
        y: tool.center.y - groupPosition.y,
      };

      return pointInPolygon(localCenter, hullPoints);
    });
  }, [batchToolSnapshots, groupPosition.x, groupPosition.y, hullPoints]);

  const batchToolCount = batchToolsInside.length;

  const pathData = useMemo(() => {
    if (hullPoints.length < 3) return '';

    return (
      hullPoints.reduce((acc, point, index) => {
        return acc + (index === 0 ? `M ${point.x} ${point.y}` : ` L ${point.x} ${point.y}`);
      }, '') + ' Z'
    );
  }, [hullPoints]);

  const badgePosition = useMemo(() => {
    if (hullPoints.length === 0) {
      return {
        x: 20,
        y: -20,
      };
    }

    let topPoint = hullPoints[0];

    hullPoints.forEach((point) => {
      if (point.y < topPoint.y) {
        topPoint = point;
      }
    });

    return {
      x: topPoint.x,
      y: topPoint.y - 12,
    };
  }, [hullPoints]);

  /**
   * 不用动态 minX / minY 去改 viewBox。
   * 否则 SVG 会被重新缩放，导致视觉上的缝隙不准确。
   */
  const dimensions = useMemo(() => {
    if (width && height) {
      return {
        w: width,
        h: height,
      };
    }

    if (hullPoints.length === 0) {
      return {
        w: 100,
        h: 100,
      };
    }

    let maxX = 100;
    let maxY = 100;

    hullPoints.forEach((point) => {
      maxX = Math.max(maxX, point.x + 80);
      maxY = Math.max(maxY, point.y + 80);
    });

    return {
      w: maxX,
      h: maxY,
    };
  }, [width, height, hullPoints]);

  return (
    <div
      className="w-full h-full relative group overflow-visible"
      onContextMenu={(event) => {
        if (locked) {
          event.preventDefault();
        }
      }}
    >
      {!locked && (
        <NodeToolbar
          isVisible={selected && selectionCount === 1}
          position={Position.Top}
          offset={25}
        >
          <div className="toolbar-bubble-surface bg-[var(--toolbar-bg)] backdrop-blur-md px-3 py-1.5 rounded-xl shadow-2xl border border-[var(--toolbar-border)] flex gap-2 items-center pointer-events-auto animate-in zoom-in-95 duration-200">
            <button
              onClick={toggleLock}
              className={`p-1.5 rounded-lg hover:bg-[var(--app-bg)] transition-colors ${locked
                ? 'text-indigo-500 bg-indigo-500/10'
                : 'text-[var(--text-secondary)]'
                }`}
              title={locked ? '点击解锁' : '点击锁定'}
            >
              {locked ? (
                <Lock className="w-4 h-4" />
              ) : (
                <Unlock className="w-4 h-4" />
              )}
            </button>

            <div className="w-px h-4 bg-[var(--card-border)] mx-1" />

            <input
              type="text"
              value={title}
              onChange={(event) => updateNodeData({ title: event.target.value })}
              onFocus={(event) => event.target.select()}
              className="bg-transparent border-none outline-none text-xs font-bold text-[var(--text-primary)] w-24 cursor-text"
            />

            <input
              type="color"
              value={color}
              onChange={(event) => updateNodeData({ color: event.target.value })}
              className="w-5 h-5 rounded-full overflow-hidden border-none p-0 cursor-pointer shadow-sm"
            />

            {batchToolCount > 0 && (
              <div className="flex items-center gap-1 rounded-full bg-teal-500/10 border border-teal-500/20 px-2 py-1 text-[10px] font-black text-teal-600 whitespace-nowrap">
                <Replace className="w-3 h-3" />
                区域工具 ×{batchToolCount}
              </div>
            )}

            <button
              onClick={() => (data.onDelete as Function)?.(id)}
              className="text-red-500 hover:text-red-700 text-xs font-bold px-2 hover:bg-red-50 rounded-md py-1 transition-colors"
            >
              删除
            </button>
          </div>
        </NodeToolbar>
      )}

      <div
        className={`w-full h-full absolute inset-0 overflow-visible ${locked ? 'opacity-60' : 'opacity-100'
          }`}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${dimensions.w || 100} ${dimensions.h || 100}`}
          preserveAspectRatio="none"
          className="overflow-visible"
          style={{
            overflow: 'visible',
          }}
        >
          <path
            d={pathData}
            fill={color}
            fillOpacity={0.15}
          />

          <path
            d={pathData}
            fill="none"
            stroke={selected ? '#4f46e5' : color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      <div
        className="absolute pointer-events-auto z-10 will-change-transform"
        style={{
          left: 0,
          top: 0,
          transform: `translate3d(${badgePosition.x - 20}px, ${badgePosition.y}px, 0)`,
        }}
      >
        <button
          onClick={(event) => {
            event.stopPropagation();
            toggleLock();
          }}
          className="backdrop-blur-md px-3 py-1 rounded-full shadow-xl flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
          style={{
            backgroundColor: 'var(--card-bg)',
            opacity: 0.95,
            border: `1.5px solid ${color}`,
          }}
        >
          {locked ? (
            <Lock className="w-3 h-3" style={{ color }} />
          ) : (
            <div
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: color,
              }}
            />
          )}

          <span
            className="text-[11px] font-black uppercase tracking-tighter whitespace-nowrap"
            style={{
              color,
            }}
          >
            {title}
          </span>

          {batchToolCount > 0 && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full ml-1 font-bold flex items-center gap-1"
              style={{
                backgroundColor: `${color}20`,
                color,
              }}
            >
              <Replace className="w-2.5 h-2.5" />
              {batchToolCount}
            </span>
          )}

          {locked && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded-full ml-1 font-bold"
              style={{
                backgroundColor: `${color}20`,
                color,
              }}
            >
              解锁
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

export const MemoizedGroupNode = memo(GroupNode);

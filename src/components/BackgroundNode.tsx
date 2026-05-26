import React, { memo } from 'react';
import {
  NodeProps,
  NodeResizer,
  NodeToolbar,
  Position,
  useStore,
} from '@xyflow/react';
import { Lock, Unlock, Replace, BookOpen } from 'lucide-react';
import {
  isBatchReplaceNode,
  isPlotStructureNode,
} from '../lib/regionUtils';

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

const DEFAULT_BACKGROUND_WIDTH = 600;
const DEFAULT_BACKGROUND_HEIGHT = 400;
const DEFAULT_BATCH_WIDTH = 260;
const DEFAULT_BATCH_HEIGHT = 300;

function asNumber(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
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
  fallbackWidth: number,
  fallbackHeight: number
) {
  const internalNode = getInternalNode(state, node.id);
  const measured = internalNode?.measured ?? node?.measured;

  return {
    width:
      measured?.width ??
      node?.width ??
      asNumber(node?.style?.width, fallbackWidth),
    height:
      measured?.height ??
      node?.height ??
      asNumber(node?.style?.height, fallbackHeight),
  };
}

function getNodeRect(
  state: any,
  node: any,
  fallbackWidth = DEFAULT_BACKGROUND_WIDTH,
  fallbackHeight = DEFAULT_BACKGROUND_HEIGHT
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

function getNodeCenter(
  state: any,
  node: any,
  fallbackWidth = DEFAULT_BATCH_WIDTH,
  fallbackHeight = DEFAULT_BATCH_HEIGHT
): Point {
  const rect = getNodeRect(state, node, fallbackWidth, fallbackHeight);

  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
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

function isBatchReplaceNodeLocal(node: any) {
  return isBatchReplaceNode(node);
}

function isPlotStructureNodeLocal(node: any) {
  return isPlotStructureNode(node);
}

export function BackgroundNode({ id, data, selected }: NodeProps) {
  const color = (data.color as string) || '#f1f5f9';
  const title = (data.title as string) ?? '背景区域';

  const locked = data.locked === true;

  const selectionCount = useStore((state) => {
    return state.nodes.filter((node) => node.selected).length;
  });

  /**
   * 检测当前背景区域内部有没有批量替换工具。
   * 使用 positionAbsolute + measured，拖动时会实时更新。
   */
  const batchToolCount = useStore((state) => {
    const selfNode = state.nodes.find((node) => node.id === id);

    if (!selfNode) return 0;

    const backgroundRect = getNodeRect(
      state,
      selfNode,
      DEFAULT_BACKGROUND_WIDTH,
      DEFAULT_BACKGROUND_HEIGHT
    );

    return state.nodes.filter((node) => {
      if (node.id === id || !isBatchReplaceNodeLocal(node)) return false;

      const center = getNodeCenter(
        state,
        node,
        DEFAULT_BATCH_WIDTH,
        DEFAULT_BATCH_HEIGHT
      );

      return pointInRect(center, backgroundRect);
    }).length;
  });

  const plotStructureToolCount = useStore((state) => {
    const selfNode = state.nodes.find((node) => node.id === id);
    if (!selfNode) return 0;

    const backgroundRect = getNodeRect(
      state,
      selfNode,
      DEFAULT_BACKGROUND_WIDTH,
      DEFAULT_BACKGROUND_HEIGHT
    );

    return state.nodes.filter((node) => {
      if (node.id === id || !isPlotStructureNodeLocal(node)) return false;

      const center = getNodeCenter(
        state,
        node,
        DEFAULT_BATCH_WIDTH,
        DEFAULT_BATCH_HEIGHT
      );

      return pointInRect(center, backgroundRect);
    }).length;
  });

  const updateNodeData = (updates: any) => {
    if (data.onUpdate) {
      (data.onUpdate as Function)(id, updates);
    }
  };

  const toggleLock = () => {
    updateNodeData({ locked: !locked });
  };

  return (
    <div
      className="w-full h-full relative group"
      onContextMenu={(event) => {
        if (locked) {
          event.preventDefault();
        }
      }}
    >
      {!locked && (
        <NodeResizer
          minWidth={200}
          minHeight={150}
          isVisible={selected && selectionCount === 1}
          lineClassName="!border-slate-400 !border-2"
          handleClassName="!w-3 !h-3 !bg-white !border-2 !border-slate-400 !rounded-full"
        />
      )}

      <NodeToolbar
        isVisible={selected && selectionCount === 1}
        position={Position.Top}
        offset={10}
      >
        <div className="toolbar-bubble-surface bg-[var(--toolbar-bg)] backdrop-blur-md px-3 py-1.5 rounded-lg shadow-xl border border-[var(--toolbar-border)] flex gap-2 items-center">
          <button
            onClick={toggleLock}
            className={`p-1 rounded hover:bg-[var(--app-bg)] transition-colors ${locked ? 'text-indigo-500' : 'text-[var(--text-secondary)]'
              }`}
            title={locked ? '解锁位置与大小' : '锁定位置与大小'}
          >
            {locked ? (
              <Lock className="w-4 h-4" />
            ) : (
              <Unlock className="w-4 h-4" />
            )}
          </button>

          <div className="w-px h-4 bg-[var(--toolbar-border)] mx-1" />

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
            className="w-5 h-5 rounded-full overflow-hidden border-none p-0 cursor-pointer"
          />

          {batchToolCount > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-teal-500/10 border border-teal-500/20 px-2 py-1 text-[10px] font-black text-teal-600 whitespace-nowrap">
              <Replace className="w-3 h-3" />
              批量工具 ×{batchToolCount}
            </div>
          )}

          {plotStructureToolCount > 0 && (
            <div className="flex items-center gap-1 rounded-full bg-violet-500/10 border border-violet-500/20 px-2 py-1 text-[10px] font-black text-violet-600 whitespace-nowrap">
              <BookOpen className="w-3 h-3" />
              结构设计 ×{plotStructureToolCount}
            </div>
          )}

          <button
            onClick={() => (data.onDelete as Function)(id)}
            className="text-red-500 hover:text-red-700 text-xs font-bold px-1"
          >
            删除
          </button>
        </div>
      </NodeToolbar>

      <div
        className={`w-full h-full rounded-3xl border-2 border-dashed custom-drag-handle transition-[border-color,ring,shadow] duration-300 ${selected
            ? 'border-indigo-500 ring-4 ring-indigo-500/20 shadow-2xl'
            : 'border-slate-300'
          }`}
        style={{ backgroundColor: color + '40' }}
      >
        <div className="absolute top-4 left-6 nodrag flex flex-col gap-1 w-1/2 pointer-events-auto">
          <div className="flex items-center gap-1">
            <button
              onClick={(event) => {
                event.stopPropagation();
                toggleLock();
              }}
              className={`p-1.5 rounded-lg transition-all shadow-sm flex items-center justify-center ${locked
                  ? 'bg-indigo-500 text-white hover:bg-indigo-600 scale-110'
                  : 'bg-[var(--card-bg)] text-[var(--text-secondary)] hover:bg-[var(--app-bg)]'
                }`}
              title={locked ? '点击解锁' : '点击锁定'}
            >
              {locked ? (
                <Lock className="w-4 h-4" />
              ) : (
                <Unlock className="w-4 h-4" />
              )}
            </button>

            <input
              type="text"
              value={title}
              disabled={locked}
              onChange={(event) => updateNodeData({ title: event.target.value })}
              onFocus={(event) => event.target.select()}
              className={`bg-transparent border-none outline-none text-[var(--text-secondary)] font-bold uppercase tracking-widest text-[12px] w-full placeholder:text-[var(--text-muted)] cursor-text ${locked ? 'cursor-not-allowed opacity-50' : ''
                }`}
              placeholder="设置名称..."
            />
          </div>

          <div className="h-0.5 w-full bg-[var(--card-border)]/30 rounded-full" />

          {batchToolCount > 0 && (
            <div className="flex items-center gap-1.5 w-fit rounded-full bg-[var(--card-bg)]/90 border border-teal-500/20 px-2 py-1 text-[10px] font-black text-teal-600 shadow-sm backdrop-blur-sm">
              <Replace className="w-3 h-3" />
              批量工具 ×{batchToolCount}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const MemoizedBackgroundNode = memo(BackgroundNode);

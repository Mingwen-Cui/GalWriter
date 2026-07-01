import {
  BaseEdge,
  EdgeLabelRenderer,
  EdgeProps,
  getBezierPath,
  getSmoothStepPath,
} from '@xyflow/react';
import { X } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';

/** 长按触发删除的等待时间（毫秒） */
const LONG_PRESS_DURATION_MS = 500;
/** 双击（Double Tap）的最大时间间隔（毫秒） */
const DOUBLE_TAP_DELAY_MS = 300;

export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps) {
  const isBezier = data?.edgeStyle === 'bezier';
  const isMobile = Boolean(data?.isMobile);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastTapRef = useRef<number>(0);
  
  // NOTE: 长按进行中时，给路径添加颤抖动画以提示用户
  const [isLongPressing, setIsLongPressing] = useState(false);

  const [smoothPath, sLabelX, sLabelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const [bezierPath, bLabelX, bLabelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgePath = isBezier ? bezierPath : smoothPath;
  const labelX = isBezier ? bLabelX : sLabelX;
  const labelY = isBezier ? bLabelY : sLabelY;

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setIsLongPressing(false);
    touchStartPosRef.current = null;
  }, []);

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (!isMobile || event.touches.length !== 1) return;
      const touch = event.touches[0];
      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };
      setIsLongPressing(false);

      // NOTE: 手机端双触（Double Tap）检测
      const now = Date.now();
      if (now - lastTapRef.current < DOUBLE_TAP_DELAY_MS) {
        // 触发反转回调
        (data?.onReverse as ((id: string) => void) | undefined)?.(id);
        clearLongPress();
        lastTapRef.current = 0; // 重置
        return;
      }
      lastTapRef.current = now;

      longPressTimerRef.current = setTimeout(() => {
        setIsLongPressing(true);
        // NOTE: 短暂延迟让颤抖动画播放一帧，再执行删除
        setTimeout(() => {
          (data?.onDelete as ((id: string) => void) | undefined)?.(id);
          clearLongPress();
        }, 150);
      }, LONG_PRESS_DURATION_MS);
    },
    [clearLongPress, data?.onDelete, data?.onReverse, id, isMobile],
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (!isMobile || !touchStartPosRef.current) return;
      const touch = event.touches[0];
      const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
      const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);
      // NOTE: 手指移动超过 8px 则视为滑动，取消长按
      if (dx > 8 || dy > 8) {
        clearLongPress();
      }
    },
    [clearLongPress, isMobile],
  );

  const handleTouchEnd = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const clearTextSelection = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.getSelection()?.removeAllRanges();
  }, []);

  return (
    <g
      className={`group ${isLongPressing ? 'edge-long-press-shake' : ''}`}
      onMouseDown={(event) => {
        if (event.detail > 1) {
          event.preventDefault();
        }
      }}
      onContextMenu={(e) => {
        // NOTE: 桌面端：右键删除；手机端禁用右键菜单（由长按处理）
        e.preventDefault();
        if (!isMobile) {
          (data?.onDelete as ((id: string) => void) | undefined)?.(id);
        }
      }}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        clearTextSelection();
        // NOTE: 桌面端双击反转（手机端在 TouchStart 中独立模拟）
        if (!isMobile) {
          (data?.onReverse as ((id: string) => void) | undefined)?.(id);
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* NOTE: 透明宽路径用于扩大触摸/点击区域，避免细线难以命中 */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
        style={isLongPressing ? { stroke: 'rgba(239, 68, 68, 0.3)' } : undefined}
      />
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={
          isLongPressing
            ? { ...style, stroke: '#ef4444', strokeDasharray: '6 3', filter: 'drop-shadow(0 0 6px rgba(239,68,68,0.7))' }
            : style
        }
      />
    </g>
  );
}

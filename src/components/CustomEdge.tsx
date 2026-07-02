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

const clampNumber = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseFloat(value)
        : Number.NaN;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const buildArrowPath = (size: number, angle: number) => {
  const center = size / 2;
  const halfAngle = (angle * Math.PI) / 360;
  const lengthByHeight = (size * 0.46) / Math.tan(halfAngle);
  const arrowLength = Math.max(2, Math.min(size * 0.86, lengthByHeight));
  const halfBase = Math.min(size * 0.46, arrowLength * Math.tan(halfAngle));
  const baseX = size - arrowLength;
  return `M ${baseX} ${center - halfBase} L ${size} ${center} L ${baseX} ${center + halfBase} Z`;
};

export function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
}: EdgeProps) {
  const isBezier = data?.edgeStyle === 'bezier';
  const isMobile = Boolean(data?.isMobile);
  const arrowSize = clampNumber(data?.arrowSize, 20, 12, 36);
  const arrowCornerRadius = clampNumber(data?.arrowCornerRadius, 2, 0, 12);
  const arrowTipAngle = clampNumber(data?.arrowTipAngle, 60, 20, 160);
  const edgeColor =
    typeof data?.edgeColor === 'string' && data.edgeColor.trim()
      ? data.edgeColor
      : typeof style?.stroke === 'string'
        ? style.stroke
        : '#6366f1';
  const edgeColors = Array.isArray(data?.edgeColors)
    ? data.edgeColors.filter(
        (color): color is string => typeof color === 'string' && color.trim().length > 0,
      )
    : [];
  const uniqueEdgeColors = Array.from(new Set(edgeColors));
  const markerId = `custom-arrow-${String(id).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const arrowPath = buildArrowPath(arrowSize, arrowTipAngle);

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
  const hasMultipleColors = uniqueEdgeColors.length > 1;
  const strokeWidth = clampNumber(style?.strokeWidth, 3, 1, 12);
  const dashLength = Math.max(8, strokeWidth * 1.8);
  const dashGap = Math.max(8, strokeWidth * 1.8);
  const dashStep = dashLength + dashGap;
  const dashCycle = dashStep * Math.max(1, uniqueEdgeColors.length);
  const isHighlighted = Boolean(data?.isHighlighted);
  const arrowColor = uniqueEdgeColors[uniqueEdgeColors.length - 1] || edgeColor;

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
      {hasMultipleColors && !isLongPressing ? (
        uniqueEdgeColors.map((color, index) => (
          <path
            key={`${color}-${index}`}
            d={edgePath}
            fill="none"
            markerEnd={index === uniqueEdgeColors.length - 1 ? `url(#${markerId})` : undefined}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
            strokeLinejoin="round"
            strokeDasharray={`${dashLength} ${dashCycle - dashLength}`}
            strokeDashoffset={-index * dashStep}
            style={{
              opacity: style?.opacity,
              filter: style?.filter,
              transition: style?.transition,
            }}
          >
            <animate
              attributeName="stroke-dashoffset"
              from={`${-index * dashStep}`}
              to={`${-index * dashStep - dashCycle}`}
              dur="1.4s"
              repeatCount="indefinite"
            />
          </path>
        ))
      ) : isHighlighted && !isLongPressing ? (
        <path
          d={edgePath}
          fill="none"
          markerEnd={`url(#${markerId})`}
          stroke={edgeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
          strokeLinejoin="round"
          strokeDasharray={`${dashLength} ${dashGap}`}
          style={{
            opacity: style?.opacity,
            filter: style?.filter,
            transition: style?.transition,
          }}
        >
          <animate
            attributeName="stroke-dashoffset"
            from="0"
            to={`${-(dashLength + dashGap)}`}
            dur="1.1s"
            repeatCount="indefinite"
          />
        </path>
      ) : (
        <BaseEdge
          path={edgePath}
          markerEnd={`url(#${markerId})`}
          style={
            isLongPressing
              ? {
                  ...style,
                  stroke: '#ef4444',
                  strokeDasharray: '6 3',
                  filter: 'drop-shadow(0 0 6px rgba(239,68,68,0.7))',
                }
              : style
          }
        />
      )}
      <defs>
        <marker
          id={markerId}
          markerWidth={arrowSize}
          markerHeight={arrowSize}
          refX={arrowSize}
          refY={arrowSize / 2}
          orient="auto"
          markerUnits="userSpaceOnUse"
          overflow="visible"
        >
          <path
            d={arrowPath}
            fill={isLongPressing ? '#ef4444' : arrowColor}
            stroke={isLongPressing ? '#ef4444' : arrowColor}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeWidth={arrowCornerRadius}
          />
        </marker>
      </defs>
    </g>
  );
}

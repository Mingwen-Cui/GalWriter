import React from 'react';
import { BaseEdge, EdgeLabelRenderer, EdgeProps, getSmoothStepPath, getBezierPath } from '@xyflow/react';
import { X } from 'lucide-react';

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

  return (
    <g className="group" onContextMenu={(e) => { e.preventDefault(); (data?.onDelete as Function)?.(id); }}>
      {/* Invisible wider path for easier hover/click */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction cursor-pointer"
      />
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
    </g>
  );
}

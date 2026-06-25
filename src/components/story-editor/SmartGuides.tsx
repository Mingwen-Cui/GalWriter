import { useStore } from '@xyflow/react';

export function SmartGuides({ hLines, vLines }: { hLines: number[]; vLines: number[] }) {
  const transform = useStore((state) => state.transform);
  if (vLines.length === 0 && hLines.length === 0) return null;
  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      {vLines.map((vLine, i) => (
        <line
          key={`v-${i}`}
          x1={vLine * transform[2] + transform[0]}
          y1={0}
          x2={vLine * transform[2] + transform[0]}
          y2="100%"
          stroke="#f43f5e"
          strokeWidth="1.5"
          strokeDasharray="5,5"
        />
      ))}
      {hLines.map((hLine, i) => (
        <line
          key={`h-${i}`}
          x1={0}
          y1={hLine * transform[2] + transform[1]}
          x2="100%"
          y2={hLine * transform[2] + transform[1]}
          stroke="#f43f5e"
          strokeWidth="1.5"
          strokeDasharray="5,5"
        />
      ))}
    </svg>
  );
}

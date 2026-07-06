import type { PlotStructureGenerateDirection } from '../../domain/project';

export const PLOT_STRUCTURE_DIRECTION_CONFIG: Record<
  PlotStructureGenerateDirection,
  {
    sourceHandle: 'top' | 'right' | 'bottom' | 'left';
    targetHandle: 'top' | 'right' | 'bottom' | 'left';
    primaryStep: number;
    primaryDelta: number;
    primaryAxis: 'x' | 'y';
    collisionStep: number;
    collisionAxis: 'x' | 'y';
    label: string;
  }
> = {
  right: {
    sourceHandle: 'right',
    targetHandle: 'left',
    primaryStep: 420,
    primaryDelta: 420,
    primaryAxis: 'x',
    collisionStep: 220,
    collisionAxis: 'y',
    label: '向右',
  },
  left: {
    sourceHandle: 'left',
    targetHandle: 'right',
    primaryStep: 420,
    primaryDelta: -420,
    primaryAxis: 'x',
    collisionStep: 220,
    collisionAxis: 'y',
    label: '向左',
  },
  down: {
    sourceHandle: 'bottom',
    targetHandle: 'top',
    primaryStep: 320,
    primaryDelta: 320,
    primaryAxis: 'y',
    collisionStep: 420,
    collisionAxis: 'x',
    label: '向下',
  },
  up: {
    sourceHandle: 'top',
    targetHandle: 'bottom',
    primaryStep: 320,
    primaryDelta: -320,
    primaryAxis: 'y',
    collisionStep: 420,
    collisionAxis: 'x',
    label: '向上',
  },
};

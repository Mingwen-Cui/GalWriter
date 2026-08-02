import type { Edge, Node } from '@xyflow/react';

import { buildCodeProjectPreview, buildCodeProjectZip } from './exportProject';
import type { RenpyExportSettings } from './types';

export type { CodeProjectPreview as RenpyProjectPreview } from './exportProject';
export type { AssetEntry, CodeDiagnostic, RenpyExportSettings } from './types';

export const buildRenpyProjectPreview = (
  nodes: Node[],
  edges: Edge[],
  settings?: Partial<RenpyExportSettings>,
  projectName = 'galwriter',
) => buildCodeProjectPreview(nodes, edges, projectName, settings, 'renpy');
export const buildRenpyProjectZip = (
  nodes: Node[],
  edges: Edge[],
  projectName: string,
  settings?: Partial<RenpyExportSettings>,
) => buildCodeProjectZip(nodes, edges, projectName, settings, 'renpy');

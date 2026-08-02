import { manifestAssets } from '../assets/assetManifest';
import type { GalWriterIr, IrCondition, IrStatement, IrSupportLevel } from '../ir/irTypes';
import type { CodeDiagnostic, RenpyFile } from '../types';
import type {
  CodeExportTarget,
  TargetAssetCopy,
  TargetCapability,
  TargetManifest,
} from './targetTypes';

export const serializeLiteral = (
  value: number | boolean | string,
  style: 'python' | 'javascript' | 'godot',
) => {
  if (typeof value === 'number') return String(Number.isFinite(value) ? value : 0);
  if (typeof value === 'boolean')
    return style === 'python'
      ? value
        ? 'True'
        : 'False'
      : style === 'javascript'
        ? String(value)
        : String(value);
  return JSON.stringify(value);
};

export const conditionExpression = (
  condition: IrCondition,
  style: 'python' | 'javascript' | 'dialogic',
) => {
  const variable =
    style === 'javascript'
      ? `f.${condition.kind === 'else' ? '' : condition.codeName}`
      : style === 'dialogic'
        ? `{${condition.kind === 'else' ? '' : condition.codeName}}`
        : condition.kind === 'else'
          ? ''
          : condition.codeName;
  if (condition.kind === 'range')
    return style === 'javascript'
      ? `(${variable} >= ${condition.min} && ${variable} <= ${condition.max})`
      : style === 'dialogic'
        ? `${variable} >= ${condition.min} and ${variable} <= ${condition.max}`
        : `${condition.min} <= ${variable} <= ${condition.max}`;
  if (condition.kind === 'gte') return `${variable} >= ${condition.value}`;
  return style === 'python' ? 'True' : 'true';
};

export const targetDiagnostics = (ir: GalWriterIr, target: CodeExportTarget): CodeDiagnostic[] =>
  ir.chapters
    .flatMap((chapter) => chapter.blocks)
    .flatMap((block) =>
      block.statements.flatMap((statement) => {
        if (statement.kind !== 'todo') return [];
        const level = statement.feature.startsWith('missing-')
          ? ('error' as const)
          : ('warning' as const);
        return [
          {
            id: `${target}-todo-${block.nodeId}-${statement.feature}`,
            level,
            message: `${target}: ${statement.detail}`,
            nodeId: block.nodeId,
          },
        ];
      }),
    );

export const supportDiagnostics = (
  target: CodeExportTarget,
  capabilities: TargetCapability[],
): CodeDiagnostic[] =>
  capabilities
    .filter((item) => item.level !== 'full')
    .map((item) => ({
      id: `${target}-support-${item.id}`,
      level: item.level === 'unsupported' ? 'warning' : 'info',
      message: `${item.label}: ${item.detail}`,
    }));

export const reportFile = (
  target: CodeExportTarget,
  ir: GalWriterIr,
  diagnostics: CodeDiagnostic[],
  capabilities: TargetCapability[],
): RenpyFile => ({
  path: 'CODE_EXPORT_REPORT.md',
  generated: true,
  content: [
    `# GalWriter AI ${target} export report`,
    '',
    `- Entry: ${ir.metadata.entryNodeId || 'not found'}`,
    `- Chapters: ${ir.chapters.length}`,
    `- Blocks: ${ir.chapters.reduce((sum, chapter) => sum + chapter.blocks.length, 0)}`,
    `- Errors: ${diagnostics.filter((item) => item.level === 'error').length}`,
    `- Warnings: ${diagnostics.filter((item) => item.level === 'warning').length}`,
    '',
    '## Capability support',
    '',
    ...capabilities.map(
      (item) => `- **${item.level.toUpperCase()}** ${item.label}: ${item.detail}`,
    ),
    '',
    '## TODO and diagnostics',
    '',
    ...(diagnostics.length
      ? diagnostics.map(
          (item) =>
            `- **${item.level.toUpperCase()}**${item.nodeId ? ` (${item.nodeId})` : ''}: ${item.message}`,
        )
      : ['- None.']),
    '',
    '## Unused assets',
    '',
    ...(ir.assets
      .filter((asset) => !asset.referenced)
      .map((asset) => `- ${asset.path} (${asset.sourceNodeIds.join(', ')})`).length
      ? ir.assets
          .filter((asset) => !asset.referenced)
          .map((asset) => `- ${asset.path} (${asset.sourceNodeIds.join(', ')})`)
      : ['- None.']),
    '',
  ].join('\n'),
});

export const buildManifest = (
  target: CodeExportTarget,
  ir: GalWriterIr,
  nodes: TargetManifest['nodes'],
  copies: TargetAssetCopy[],
): TargetManifest => ({
  format: 'galwriter-code-manifest',
  version: 3,
  target,
  entryId: ir.metadata.entryNodeId,
  nodes,
  assets: manifestAssets(ir.assets, copies),
});

export const escapeAttribute = (value: string) =>
  value.replace(/"/g, '&quot;').replace(/\r?\n/g, ' ');
export const todoComment = (statement: Extract<IrStatement, { kind: 'todo' }>, prefix: string) =>
  `${prefix} TODO [${statement.feature}] ${statement.detail}`;
export const capability = (
  id: string,
  label: string,
  level: IrSupportLevel,
  detail: string,
): TargetCapability => ({ id, label, level, detail });

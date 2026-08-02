import { defaultAssetCopies } from '../../assets/assetManifest';
import type { GalWriterIr } from '../../ir/irTypes';
import type { TargetBuild } from '../targetTypes';
import { buildManifest, capability, reportFile } from '../targetUtils';

export const generateIrJsonTarget = (ir: GalWriterIr): TargetBuild => {
  const capabilities = [
    capability(
      'ir',
      'GalWriter semantic IR',
      'full',
      'All normalized story semantics, trace IDs and asset metadata are preserved.',
    ),
    capability(
      'presentation',
      'Target-specific presentation',
      'degraded',
      'The IR stores portable presentation operations and explicit TODOs, not engine-specific UI themes.',
    ),
  ];
  const copies = defaultAssetCopies('ir-json', ir.assets);
  const nodes = Object.fromEntries(
    ir.chapters.flatMap((chapter) =>
      chapter.blocks.map((block) => [
        block.nodeId,
        { file: 'galwriter_project.ir.json', label: block.label },
      ]),
    ),
  );
  const manifest = buildManifest('ir-json', ir, nodes, copies);
  const diagnostics = ir.chapters
    .flatMap((chapter) => chapter.blocks)
    .flatMap((block) =>
      block.statements
        .filter((statement) => statement.kind === 'todo')
        .map((statement) => ({
          id: `ir-json-todo-${block.nodeId}-${statement.kind === 'todo' ? statement.feature : ''}`,
          level: 'warning' as const,
          message: statement.kind === 'todo' ? statement.detail : '',
          nodeId: block.nodeId,
        })),
    );
  return {
    target: 'ir-json',
    files: [
      {
        path: 'galwriter_project.ir.json',
        content: `${JSON.stringify(ir, null, 2)}\n`,
        generated: true,
      },
      {
        path: 'galwriter_manifest.json',
        content: `${JSON.stringify(manifest, null, 2)}\n`,
        generated: true,
      },
      reportFile('ir-json', ir, diagnostics, capabilities),
      {
        path: 'README.md',
        content:
          '# GalWriter IR JSON\n\n`galwriter_project.ir.json` is the stable, engine-independent interface for custom exporters. Trace each block and operation back through `nodeId` and `edgeId`.\n',
        generated: true,
      },
    ],
    manifest,
    diagnostics,
    capabilities,
    assetCopies: copies,
  };
};

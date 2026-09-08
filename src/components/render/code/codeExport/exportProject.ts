import { packageGameInterface } from '../design/packageGameInterface';
import { applyGameInterface } from '../design/exportGameInterface';
import type { Edge, Node } from '@xyflow/react';
import JSZip from 'jszip';

import { materializeAssets } from './assets/materializeAssets';
import type { GalWriterIr } from './ir/irTypes';
import { normalizeProjectToIr } from './ir/normalizeProjectToIr';
import { generateDialogicTarget } from './targets/dialogic/generateDialogic';
import { normalizeGodotProject } from './targets/dialogic/normalizeGodotProject';
import { generateIrJsonTarget } from './targets/irJson/generateIrJson';
import { generateRenpyTarget } from './targets/renpy/generateRenpy';
import type { CodeExportTarget, TargetBuild } from './targets/targetTypes';
import { reportFile } from './targets/targetUtils';
import { generateTyranoTarget } from './targets/tyrano/generateTyrano';
import type { AssetEntry, CodeDiagnostic, RenpyExportSettings, RenpyFile } from './types';
import { validateIr } from './validation/validateIr';

export type CodeProjectPreview = {
  target: CodeExportTarget;
  files: RenpyFile[];
  diagnostics: CodeDiagnostic[];
  entryId?: string;
  assets: AssetEntry[];
  manifest: TargetBuild['manifest'];
  settings: RenpyExportSettings;
  capabilities: TargetBuild['capabilities'];
  ir: GalWriterIr;
};

const generatorFor = (target: CodeExportTarget) =>
  target === 'renpy'
    ? generateRenpyTarget
    : target === 'tyrano'
      ? generateTyranoTarget
      : target === 'dialogic'
        ? generateDialogicTarget
        : generateIrJsonTarget;
const safeFilePart = (value: string, fallback: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || fallback;

export const buildCodeProjectPreview = (
  nodes: Node[],
  edges: Edge[],
  projectName: string,
  settings: Partial<RenpyExportSettings> | undefined,
  target: CodeExportTarget,
): CodeProjectPreview => {
  const normalized = (target === 'dialogic' ? normalizeGodotProject : normalizeProjectToIr)(
    nodes,
    edges,
    projectName,
    settings,
  );
  const irDiagnostics = validateIr(normalized.ir).filter(
    (item) =>
      target !== 'dialogic' ||
      (!item.id.startsWith('asset-risk-') && !item.id.startsWith('ir-code-')),
  );
  const build = generatorFor(target)(normalized.ir);
  const diagnostics = [...normalized.diagnostics, ...irDiagnostics, ...build.diagnostics].filter(
    (item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index,
  );
  const targetFiles = applyGameInterface(build.files, normalized.ir.settings, target).map((file) =>
    file.path === 'CODE_EXPORT_REPORT.md'
      ? reportFile(target, normalized.ir, diagnostics, build.capabilities)
      : file,
  );
  const files =
    target === 'ir-json'
      ? targetFiles
      : [
          ...targetFiles.filter((file) => file.path !== 'CODE_EXPORT_REPORT.md'),
          {
            path: 'galwriter_project.ir.json',
            content: `${JSON.stringify(normalized.ir, null, 2)}\n`,
            generated: true,
          },
          ...targetFiles.filter((file) => file.path === 'CODE_EXPORT_REPORT.md'),
        ];
  return {
    target,
    files,
    diagnostics,
    entryId: normalized.ir.metadata.entryNodeId || undefined,
    assets: normalized.ir.assets,
    manifest: build.manifest,
    settings: normalized.ir.settings,
    capabilities: build.capabilities,
    ir: normalized.ir,
  };
};

export const buildCodeProjectZip = async (
  nodes: Node[],
  edges: Edge[],
  projectName: string,
  settings: Partial<RenpyExportSettings> | undefined,
  target: CodeExportTarget,
) => {
  const preview = buildCodeProjectPreview(nodes, edges, projectName, settings, target);
  if (preview.diagnostics.some((item) => item.level === 'error'))
    throw new Error(`Fix blocking ${target} export errors before creating the project.`);
  const build = generatorFor(target)(preview.ir);
  const zip = new JSZip();
  preview.files.forEach((file) => zip.file(file.path, file.content));
  if (target === 'dialogic') {
    const { packageGodotAssets } = await import('./targets/dialogic/packageGodotAssets');
    await packageGodotAssets(zip, preview.assets);
  } else await materializeAssets(zip, preview.assets, build.assetCopies);
  await packageGameInterface(zip, preview.settings, target);
  return {
    blob: await zip.generateAsync({ type: 'blob' }),
    fileName: `${safeFilePart(projectName, 'galwriter')}-${target === 'dialogic' ? 'godot' : target}.zip`,
    preview,
  };
};

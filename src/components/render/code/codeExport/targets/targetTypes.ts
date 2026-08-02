import type { GalWriterIr, IrSupportLevel } from '../ir/irTypes';
import type { CodeDiagnostic, RenpyFile, RenpyManifestNode } from '../types';

export type CodeExportTarget = 'renpy' | 'tyrano' | 'dialogic' | 'ir-json';
export type TargetCapability = { id: string; label: string; level: IrSupportLevel; detail: string };
export type TargetAssetCopy = { assetPath: string; targetPath: string };
export type TargetManifest = {
  format: 'galwriter-code-manifest';
  version: 3;
  target: CodeExportTarget;
  entryId: string | null;
  nodes: Record<string, RenpyManifestNode>;
  assets: Array<{ sourcePath: string; targetPaths: string[]; sourceNodeIds: string[] }>;
};

export type TargetBuild = {
  target: CodeExportTarget;
  files: RenpyFile[];
  manifest: TargetManifest;
  diagnostics: CodeDiagnostic[];
  capabilities: TargetCapability[];
  assetCopies: TargetAssetCopy[];
};

export type TargetGenerator = (ir: GalWriterIr) => TargetBuild;

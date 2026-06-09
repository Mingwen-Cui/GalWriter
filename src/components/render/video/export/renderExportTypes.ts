import type { ExportFormat } from '../shared/types';

export type RenderOutputDirectoryResult = {
  path?: string | null;
};

export type RenderSaveResult = {
  path: string;
};

export type SaveRenderedVideoInput = {
  fileName: string;
  format: ExportFormat;
  bytes: number[];
  outputDir: string;
  videoBitrate: string;
};

export type SaveRenderedWebZipInput = {
  fileName: string;
  bytes: number[];
  outputDir: string;
};

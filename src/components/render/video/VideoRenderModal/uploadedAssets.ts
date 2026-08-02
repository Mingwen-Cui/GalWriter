import { getMediaFileKind } from '../../../../lib/mediaImport';

export type UploadedAssetKind = 'image' | 'video' | 'audio';

export const getUploadedAssetKind = (file: File): UploadedAssetKind | null => {
  return getMediaFileKind(file);
};

export const isInternalGalWriterDrag = (event: DragEvent<HTMLElement>) =>
  event.dataTransfer.types.includes('application/x-galwriter-node') ||
  event.dataTransfer.types.includes('application/x-galwriter-nodes');
import type { DragEvent } from 'react';

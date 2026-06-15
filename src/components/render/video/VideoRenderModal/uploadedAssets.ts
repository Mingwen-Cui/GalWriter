export type UploadedAssetKind = 'image' | 'video' | 'audio';

const extensionsByKind: Record<UploadedAssetKind, string[]> = {
  image: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'],
  video: ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'],
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'],
};

export const getUploadedAssetKind = (file: File): UploadedAssetKind | null => {
  const mimeKind = file.type.split('/')[0];
  if (mimeKind === 'image' || mimeKind === 'video' || mimeKind === 'audio') return mimeKind;

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  return (
    (Object.entries(extensionsByKind).find(([, extensions]) =>
      extensions.includes(extension),
    )?.[0] as UploadedAssetKind | undefined) || null
  );
};

export const isInternalGalWriterDrag = (event: DragEvent<HTMLElement>) =>
  event.dataTransfer.types.includes('application/x-galwriter-node') ||
  event.dataTransfer.types.includes('application/x-galwriter-nodes');
import type { DragEvent } from 'react';

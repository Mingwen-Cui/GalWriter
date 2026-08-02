export type MediaFileKind = 'image' | 'video' | 'audio';

const extensionsByKind: Record<MediaFileKind, string[]> = {
  image: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'],
  video: ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'],
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'],
};

/**
 * Windows does not always provide a MIME type for QuickTime files. Keep the
 * extension fallback in one place so every import path treats MOV consistently.
 */
export const getMediaFileKind = (file: File): MediaFileKind | null => {
  const mimeKind = file.type.split('/')[0];
  if (mimeKind === 'image' || mimeKind === 'video' || mimeKind === 'audio') return mimeKind;

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  return (
    (Object.entries(extensionsByKind).find(([, extensions]) =>
      extensions.includes(extension),
    )?.[0] as MediaFileKind | undefined) || null
  );
};

export const MEDIA_FILE_ACCEPT = 'image/*,video/*,audio/*,.mov,video/quicktime';
export const VIDEO_FILE_ACCEPT = 'video/*,.mov,video/quicktime';

import { stableHash } from './model';
import type { AssetEntry, AssetKind, CodeDiagnostic } from './types';

const extensionFromSource = (source: string, fallback: string) => {
  const mime = source.match(/^data:([^;,]+)/i)?.[1]?.toLowerCase();
  const byMime: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/flac': 'flac',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  };
  return (
    (mime && byMime[mime]) ||
    source
      .split(/[?#]/)[0]
      .match(/\.([a-z0-9]{2,5})$/i)?.[1]
      ?.toLowerCase() ||
    fallback
  );
};

const compatibilityFor = (kind: AssetKind, extension: string) => {
  const compatible: Record<AssetKind, Set<string>> = {
    image: new Set(['png', 'jpg', 'jpeg', 'webp']),
    audio: new Set(['ogg', 'opus', 'mp3', 'wav']),
    video: new Set(['webm', 'mp4']),
  };
  if (!extension)
    return {
      compatibility: 'unknown' as const,
      note: 'Unknown file format; manual conversion may be required.',
    };
  if (compatible[kind].has(extension)) {
    if (kind === 'video' && extension === 'mp4')
      return {
        compatibility: 'risk' as const,
        note: 'MP4 support depends on the codec; WebM/VP9 is safer for Ren’Py distribution.',
      };
    return { compatibility: 'compatible' as const };
  }
  return {
    compatibility: 'risk' as const,
    note: `.${extension} may require conversion for Ren’Py.`,
  };
};

export const isFetchableAssetSource = (source: string) =>
  /^(blob:|data:|https?:\/\/)/i.test(source) || /^\.?\//.test(source);

export const createAssetRegistry = () => {
  const entries = new Map<string, AssetEntry>();
  const register = (
    source: string,
    kind: AssetKind,
    sourceNodeId: string,
    hint: string,
    referenced = true,
  ) => {
    if (!source.trim()) return '';
    const key = `${kind}:${source}`;
    const existing = entries.get(key);
    if (existing) {
      if (!existing.sourceNodeIds.includes(sourceNodeId)) existing.sourceNodeIds.push(sourceNodeId);
      existing.referenced ||= referenced;
      return existing.path;
    }
    const extension = extensionFromSource(
      source,
      kind === 'image' ? 'png' : kind === 'audio' ? 'ogg' : 'mp4',
    );
    const directory = kind === 'image' ? 'images' : kind === 'audio' ? 'audio' : 'movies';
    const slug =
      hint
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 38) || kind;
    const path = `${directory}/${slug}-${stableHash(key).slice(0, 8)}.${extension}`;
    const compatibility = isFetchableAssetSource(source)
      ? compatibilityFor(kind, extension)
      : {
          compatibility: 'unreadable' as const,
          note: 'The source is not a readable data, blob, HTTP, or project-relative URL.',
        };
    entries.set(key, {
      id: stableHash(key),
      source,
      sourceNodeIds: [sourceNodeId],
      path,
      kind,
      extension,
      compatibility: compatibility.compatibility,
      referenced,
      note: compatibility.note,
    });
    return path;
  };
  return { entries, register };
};

export const assetDiagnostics = (assets: AssetEntry[]): CodeDiagnostic[] => {
  const diagnostics: CodeDiagnostic[] = [];
  assets.forEach((asset) => {
    if (asset.compatibility === 'unreadable')
      diagnostics.push({
        id: `asset-unreadable-${asset.id}`,
        level: 'error',
        message: asset.note || 'Asset cannot be read.',
        nodeId: asset.sourceNodeIds[0],
        assetPath: asset.path,
      });
    else if (asset.compatibility === 'unknown' || asset.compatibility === 'risk')
      diagnostics.push({
        id: `asset-risk-${asset.id}`,
        level: 'warning',
        message: asset.note || 'Asset compatibility is uncertain.',
        nodeId: asset.sourceNodeIds[0],
        assetPath: asset.path,
      });
  });
  return diagnostics;
};

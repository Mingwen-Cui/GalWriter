import type { CodeExportTarget, TargetAssetCopy } from '../targets/targetTypes';
import type { AssetEntry } from '../types';

const fileName = (path: string) => path.split('/').pop() || path;

export const defaultAssetCopies = (
  target: CodeExportTarget,
  assets: AssetEntry[],
): TargetAssetCopy[] =>
  assets
    .filter((asset) => asset.referenced)
    .map((asset) => ({
      assetPath: asset.path,
      targetPath:
        target === 'renpy'
          ? `game/${asset.path}`
          : target === 'dialogic'
            ? `assets/${asset.path}`
            : target === 'tyrano'
              ? `data/${asset.kind === 'image' ? 'image/galwriter' : asset.kind === 'audio' ? 'sound' : 'video'}/${fileName(asset.path)}`
              : asset.path,
    }));

export const targetPathForAsset = (
  target: CodeExportTarget,
  assetPath: string,
  kind: AssetEntry['kind'],
) => {
  const name = fileName(assetPath);
  if (target === 'renpy') return assetPath;
  if (target === 'dialogic') return `res://assets/${assetPath}`;
  if (target === 'tyrano')
    return kind === 'image' ? `../image/galwriter/${name}` : kind === 'audio' ? name : name;
  return assetPath;
};

export const manifestAssets = (assets: AssetEntry[], copies: TargetAssetCopy[]) =>
  assets.map((asset) => ({
    sourcePath: asset.path,
    targetPaths: copies
      .filter((copy) => copy.assetPath === asset.path)
      .map((copy) => copy.targetPath),
    sourceNodeIds: asset.sourceNodeIds,
  }));

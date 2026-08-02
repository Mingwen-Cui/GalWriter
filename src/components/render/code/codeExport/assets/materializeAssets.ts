import JSZip from 'jszip';

import { isFetchableAssetSource } from '../assets';
import type { TargetAssetCopy } from '../targets/targetTypes';
import type { AssetEntry } from '../types';

export const materializeAssets = async (
  zip: JSZip,
  assets: AssetEntry[],
  copies: TargetAssetCopy[],
) => {
  const assetByPath = new Map(assets.map((asset) => [asset.path, asset]));
  const bytes = new Map<string, ArrayBuffer>();
  const failures: string[] = [];
  await Promise.all(
    [...new Set(copies.map((copy) => copy.assetPath))].map(async (assetPath) => {
      const asset = assetByPath.get(assetPath);
      if (!asset || !isFetchableAssetSource(asset.source)) {
        failures.push(`${assetPath}: unreadable source`);
        return;
      }
      try {
        const response = await fetch(asset.source);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        bytes.set(assetPath, await response.arrayBuffer());
      } catch (error) {
        failures.push(`${assetPath}: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }),
  );
  if (failures.length)
    throw new Error(
      `Code export stopped because ${failures.length} referenced asset(s) could not be packaged:\n${failures.join('\n')}`,
    );
  copies.forEach((copy) => {
    const data = bytes.get(copy.assetPath);
    if (data) zip.file(copy.targetPath, data);
  });
};

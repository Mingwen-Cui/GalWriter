const blobAssets = new Map<string, Blob>();

export const registerBlobAsset = (url: string, blob: Blob) => {
  if (!url.startsWith('blob:')) return url;
  blobAssets.set(url, blob);
  return url;
};

export const getRegisteredBlobAsset = (url?: string) =>
  url?.startsWith('blob:') ? blobAssets.get(url) : undefined;

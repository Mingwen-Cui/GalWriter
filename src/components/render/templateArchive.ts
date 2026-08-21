const imageUrlKey = /image(?:url)?$/i;
const supportedImageExtension = /\.(avif|bmp|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;

const fileExtensionForImage = (url: string, mimeType: string) => {
  const extension = url.match(supportedImageExtension)?.[1]?.toLowerCase();
  if (extension) return extension === 'jpeg' ? 'jpg' : extension;
  const byMimeType: Record<string, string> = {
    'image/avif': 'avif',
    'image/bmp': 'bmp',
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/svg+xml': 'svg',
    'image/webp': 'webp',
  };
  return byMimeType[mimeType.toLowerCase()] || 'png';
};

const canPackageImage = (key: string, value: string) =>
  imageUrlKey.test(key) &&
  (value.startsWith('data:image/') ||
    value.startsWith('blob:') ||
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('/') ||
    supportedImageExtension.test(value));

/**
 * Packages a portable template: template.json keeps the design data and every
 * reachable image used by that data is copied to assets/ beside it.
 */
export const downloadTemplateArchive = async ({
  filename,
  template,
}: {
  filename: string;
  template: unknown;
}) => {
  if (typeof document === 'undefined') return;

  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const packagedImages = new Map<string, string>();
  let imageIndex = 0;

  const packageImage = async (url: string) => {
    const existing = packagedImages.get(url);
    if (existing) return existing;
    try {
      const response = await fetch(url);
      if (!response.ok) return url;
      const image = await response.blob();
      if (!image.type.startsWith('image/')) return url;
      const assetPath = `assets/image-${++imageIndex}.${fileExtensionForImage(url, image.type)}`;
      zip.file(assetPath, image);
      packagedImages.set(url, assetPath);
      return assetPath;
    } catch {
      // A cross-origin image may not allow downloading. Keep its source URL so
      // that the exported template does not silently lose that artwork.
      return url;
    }
  };

  const copyWithPackagedImages = async (value: unknown, key = ''): Promise<unknown> => {
    if (typeof value === 'string') {
      return canPackageImage(key, value) ? packageImage(value) : value;
    }
    if (Array.isArray(value)) {
      return Promise.all(value.map((item) => copyWithPackagedImages(item)));
    }
    if (!value || typeof value !== 'object') return value;

    const entries = await Promise.all(
      Object.entries(value as Record<string, unknown>).map(async ([entryKey, entryValue]) => [
        entryKey,
        await copyWithPackagedImages(entryValue, entryKey),
      ]),
    );
    return Object.fromEntries(entries);
  };

  const portableTemplate = await copyWithPackagedImages(template);
  zip.file('template.json', JSON.stringify(portableTemplate, null, 2));
  const archive = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(archive);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.zip') ? filename : `${filename}.zip`;
  link.click();
  URL.revokeObjectURL(url);
};

export type ExportAssetKind = 'image' | 'audio' | 'video';

/** Reject empty downloads, error pages, and image payloads that cannot decode. */
export const validateExportAssetBlob = async (
  blob: Blob,
  kind: ExportAssetKind,
  source: string,
) => {
  if (blob.size === 0) throw new Error('The response is empty.');
  if (blob.type && blob.type !== 'application/octet-stream' && !blob.type.startsWith(`${kind}/`)) {
    throw new Error(`Expected ${kind} media but received ${blob.type} from ${source}.`);
  }
  if (kind !== 'image') return;

  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
  } catch {
    throw new Error(
      `Could not decode image data${blob.type ? ` (${blob.type})` : ''} from ${source}.`,
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

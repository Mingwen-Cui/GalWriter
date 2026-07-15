const isImageDataUrl = (value: string) => value.startsWith('data:image/');
const isBase64DataUrl = (value: string) => /;base64,/i.test(value);
const PPT_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml']);

const mimeFromImageBytes = async (blob: Blob) => {
  if (blob.type.startsWith('image/')) return blob.type;
  const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (String.fromCharCode(...bytes.slice(0, 3)) === 'GIF') return 'image/gif';
  return undefined;
};

const readBlobAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Could not read image data'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });

const rasterizeImageUrlAsPng = async (source: string) => {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Could not decode image'));
    image.src = source;
  });
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('Image has no dimensions');

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create image canvas');
  context.drawImage(image, 0, 0);
  return canvas.toDataURL('image/png');
};

const rasterizeBlobAsPng = async (blob: Blob) => {
  const imageUrl = URL.createObjectURL(blob);
  try {
    return await rasterizeImageUrlAsPng(imageUrl);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
};

const fetchImageData = async (source: string) => {
  const response = await fetch(source);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  const mime = await mimeFromImageBytes(blob);
  if (!mime) return undefined;
  if (!PPT_IMAGE_MIME_TYPES.has(mime)) return rasterizeBlobAsPng(blob);
  const data = await readBlobAsDataUrl(blob);
  return isImageDataUrl(data) ? data.replace(/^data:[^;,]+/i, `data:${mime}`) : undefined;
};

const isPptSafeImageDataUrl = (value: string) =>
  isImageDataUrl(value) &&
  isBase64DataUrl(value) &&
  /^data:image\/(png|jpeg|gif|svg\+xml);base64,/i.test(value);
const isPptSafeVideoDataUrl = (value: string) =>
  /^data:video\/[a-z0-9.+-]+;base64,/i.test(value);
const videoLastFrameCache = new Map<string, Promise<string | undefined>>();

export const getPptImageDimensions = async (data: string) => {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Could not read image dimensions'));
    image.src = data;
  });
  if (!image.naturalWidth || !image.naturalHeight)
    throw new Error('Image has no dimensions');
  return { width: image.naturalWidth, height: image.naturalHeight };
};

/**
 * Project assets are usually Blob URLs. PptxGenJS can only embed base64 image
 * data in a browser build, so materialize the asset before adding it to a slide.
 */
export async function toPptImageData(url?: string): Promise<string | undefined> {
  const source = url?.trim();
  if (!source) return undefined;
  if (isPptSafeImageDataUrl(source)) return source;

  try {
    // Tauri's WebView can display a Blob URL in <img> while fetch(url) fails.
    // Decode through the same image pipeline used by the preview first.
    return await rasterizeImageUrlAsPng(source);
  } catch (imageError) {
    try {
      return await fetchImageData(source);
    } catch (fetchError) {
      console.warn('Could not embed image in PPTX:', { imageError, fetchError });
      return undefined;
    }
  }
}

/**
 * PPTX media cannot point to the editor's Blob URLs. Materialise videos in the
 * same way as images, but preserve the original video bytes rather than
 * rasterising them. PowerPoint is most reliable with MP4/H.264 assets.
 */
export async function toPptVideoData(url?: string): Promise<string | undefined> {
  const source = url?.trim();
  if (!source) return undefined;
  if (isPptSafeVideoDataUrl(source)) return source;

  try {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    if (!blob.type.startsWith('video/')) throw new Error(`Unsupported media type: ${blob.type}`);
    const data = await readBlobAsDataUrl(blob);
    return isPptSafeVideoDataUrl(data) ? data : undefined;
  } catch (error) {
    console.warn('Could not embed video in PPTX:', error);
    return undefined;
  }
}

/**
 * Choice slides must remain static after a scene video ends. Capture the final
 * decodable frame as a PNG so the exported choice slide matches the editor.
 */
export function toPptVideoLastFrameData(url?: string): Promise<string | undefined> {
  const source = url?.trim();
  if (!source) return Promise.resolve(undefined);
  const cached = videoLastFrameCache.get(source);
  if (cached) return cached;

  const capture = new Promise<string | undefined>((resolve) => {
    const video = document.createElement('video');
    let settled = false;
    const isRemote = /^https?:\/\//i.test(source);
    if (isRemote) video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    const finish = (value?: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      video.removeAttribute('src');
      video.load();
      resolve(value);
    };
    const timeout = window.setTimeout(() => finish(), 15000);
    const captureFrame = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        if (!context || !canvas.width || !canvas.height) {
          finish();
          return;
        }
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish(canvas.toDataURL('image/png'));
      } catch {
        finish();
      }
    };
    video.onerror = () => finish();
    video.onloadedmetadata = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        finish();
        return;
      }
      const lastFrameTime = Math.max(0, video.duration - Math.min(0.08, video.duration / 20));
      if (lastFrameTime <= 0) {
        video.onloadeddata = captureFrame;
        return;
      }
      video.onseeked = captureFrame;
      video.currentTime = lastFrameTime;
    };
    video.src = source;
    video.load();
  });
  videoLastFrameCache.set(source, capture);
  return capture;
}

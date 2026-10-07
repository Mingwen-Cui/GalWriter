import { getRegisteredBlobAsset } from '../../../lib/blobAssetRegistry';
import { isTauriRuntime } from '../../../lib/tauriRuntime';
import { toPowerPointMp4Blob } from './pptVideoConversion';

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
  if (!mime) throw new Error('Unsupported image format or unreadable image bytes');
  if (!PPT_IMAGE_MIME_TYPES.has(mime)) return rasterizeBlobAsPng(blob);
  const data = await readBlobAsDataUrl(blob);
  return isImageDataUrl(data) ? data.replace(/^data:[^;,]+/i, `data:${mime}`) : undefined;
};

const isPptSafeImageDataUrl = (value: string) =>
  isImageDataUrl(value) &&
  isBase64DataUrl(value) &&
  /^data:image\/(png|jpeg|gif|svg\+xml);base64,/i.test(value);
const isPptSafeVideoDataUrl = (value: string) => /^data:video\/[a-z0-9.+-]+;base64,/i.test(value);

export async function toPptAudioData(url: string): Promise<{ data: string; extn: string }> {
  const blob = getRegisteredBlobAsset(url) || (await readVideoBlob(url));
  const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const wave = String.fromCharCode(...bytes.slice(8, 12));
  const mp3 =
    String.fromCharCode(...bytes.slice(0, 3)) === 'ID3' ||
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  if (riff === 'RIFF' && wave === 'WAVE')
    return { data: await readBlobAsDataUrl(blob), extn: 'wav' };
  if (mp3) return { data: await readBlobAsDataUrl(blob), extn: 'mp3' };
  // Normalise other decodable browser audio formats to PCM for PowerPoint.
  const { buildAudioTrack } = await import('../video/audio/audioTrack');
  const { getAudioDuration } = await import('../video/shared/mediaUtils');
  const duration = await getAudioDuration(url);
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Could not read BGM duration');
  const wav = await buildAudioTrack(
    [
      {
        node: { id: 'ppt-bgm', position: { x: 0, y: 0 }, data: {} },
        audioUrl: url,
        durationSecs: duration,
      },
    ],
    1,
  );
  if (!wav) throw new Error('Could not decode BGM for PowerPoint');
  return {
    data: await readBlobAsDataUrl(new Blob([new Uint8Array(wav)], { type: 'audio/wav' })),
    extn: 'wav',
  };
}
const videoLastFrameCache = new Map<string, Promise<string | undefined>>();

const readVideoBlobWithXhr = (source: string) =>
  new Promise<Blob>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('GET', source, true);
    request.responseType = 'blob';
    request.onload = () => {
      // Blob URLs report a status of 0 in some WebViews even when the read worked.
      if (
        (request.status >= 200 && request.status < 300) ||
        (request.status === 0 && request.response)
      ) {
        resolve(request.response);
        return;
      }
      reject(new Error(`HTTP ${request.status}`));
    };
    request.onerror = () => reject(new Error('The video source could not be read'));
    request.onabort = () => reject(new Error('The video source read was cancelled'));
    request.send();
  });

const readVideoBlob = async (source: string) => {
  try {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.blob();
  } catch (fetchError) {
    try {
      // Tauri WebView can play a Blob URL while fetch(blob:) is unavailable.
      return await readVideoBlobWithXhr(source);
    } catch (xhrError) {
      throw new Error(
        `Could not read the video source (${fetchError instanceof Error ? fetchError.message : 'fetch failed'}; ${
          xhrError instanceof Error ? xhrError.message : 'fallback read failed'
        })`,
      );
    }
  }
};

export const getPptImageDimensions = async (data: string) => {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Could not read image dimensions'));
    image.src = data;
  });
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('Image has no dimensions');
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
      throw new Error(
        `Could not embed image (${imageError instanceof Error ? imageError.message : 'decode failed'}; ${fetchError instanceof Error ? fetchError.message : 'fetch failed'})`,
      );
    }
  }
}

/**
 * PPTX media cannot point to the editor's Blob URLs. Materialise videos in the
 * same way as images. Compatible H.264/AAC MP4s retain their original bytes;
 * other desktop video sources are converted locally with Mediabunny.
 * Failure is surfaced to the export dialog so
 * we never create a seemingly successful deck with the video silently missing.
 */
export async function toPptVideoData(url?: string): Promise<string | undefined> {
  const source = url?.trim();
  if (!source) return undefined;
  const original = getRegisteredBlobAsset(source) || (await readVideoBlob(source));
  const blob = await toPowerPointMp4Blob(original, isTauriRuntime());
  const data = await readBlobAsDataUrl(blob);
  // A video can be recognised from its bytes even when the original Blob was
  // registered as application/octet-stream. FileReader preserves that generic
  // MIME header, which made a valid MP4 fail the data-URL validation below.
  // Mediabunny has verified the codecs or produced a compatible MP4, so
  // normalise only the data-URL header while keeping its bytes.
  const mp4Data = data.replace(/^data:[^;,]+/i, 'data:video/mp4');
  if (!isPptSafeVideoDataUrl(mp4Data))
    throw new Error('Could not encode the video for PPT export.');
  return mp4Data;
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

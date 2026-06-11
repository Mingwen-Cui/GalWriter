export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const isTauriRuntime = () => {
  if (typeof window === 'undefined') return false;
  const runtimeWindow = window as Window & {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  };
  return !!runtimeWindow.__TAURI__ || !!runtimeWindow.__TAURI_INTERNALS__;
};

export const imageLoadCache = new Map<string, Promise<HTMLImageElement>>();

export const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const prefersCrossOrigin = /^https?:\/\//i.test(src);
    const tryLoad = (useCrossOrigin: boolean) => {
      const img = new window.Image();
      if (useCrossOrigin) img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => {
        if (!useCrossOrigin) {
          tryLoad(true);
          return;
        }
        reject(new Error('Failed to load image.'));
      };
      img.src = src;
    };
    tryLoad(prefersCrossOrigin);
  });

export const loadCachedImage = (src: string) => {
  const cached = imageLoadCache.get(src);
  if (cached) return cached;

  const request = loadImage(src).catch((error) => {
    imageLoadCache.delete(src);
    throw error;
  });
  imageLoadCache.set(src, request);
  return request;
};

export const getAudioDuration = (src: string) =>
  new Promise<number>((resolve) => {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
    audio.onerror = () => resolve(0);
    audio.src = src;
  });

export const validDuration = (duration: number) =>
  Number.isFinite(duration) && duration > 0 ? duration : 0;

export const loadVideo = (src: string) =>
  new Promise<HTMLVideoElement>((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => resolve(video);
    video.onerror = () => reject(new Error('Failed to load video.'));
    video.src = src;
    video.load();
  });

export const seekVideo = (video: HTMLVideoElement, time: number) =>
  new Promise<void>((resolve, reject) => {
    const targetTime = Math.max(0, Math.min(time, Math.max(0, (video.duration || 0) - 0.05)));
    if (Math.abs(video.currentTime - targetTime) < 0.01) {
      resolve();
      return;
    }
    const cleanup = () => {
      video.onseeked = null;
      video.onerror = null;
    };
    video.onseeked = () => {
      cleanup();
      resolve();
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('Failed to seek video.'));
    };
    video.currentTime = targetTime;
  });

export const canvasToPngBytes = (canvas: HTMLCanvasElement) =>
  new Promise<number[]>((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        reject(new Error('Canvas could not be exported as PNG.'));
        return;
      }
      resolve(Array.from(new Uint8Array(await blob.arrayBuffer())));
    }, 'image/png');
  });

export const fetchArrayBuffer = async (src: string) => {
  const response = await fetch(src);
  if (!response.ok) throw new Error('Failed to load media bytes.');
  return response.arrayBuffer();
};

export const encodeWav = (buffer: AudioBuffer) => {
  const channels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const samples = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = samples * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);
  let offset = 0;

  const writeString = (value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
    offset += value.length;
  };

  writeString('RIFF');
  view.setUint32(offset, 36 + dataSize, true);
  offset += 4;
  writeString('WAVE');
  writeString('fmt ');
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, channels, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * blockAlign, true);
  offset += 4;
  view.setUint16(offset, blockAlign, true);
  offset += 2;
  view.setUint16(offset, bytesPerSample * 8, true);
  offset += 2;
  writeString('data');
  view.setUint32(offset, dataSize, true);
  offset += 4;

  const channelData = Array.from({ length: channels }, (_, index) => buffer.getChannelData(index));
  for (let i = 0; i < samples; i += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][i] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return Array.from(new Uint8Array(arrayBuffer));
};

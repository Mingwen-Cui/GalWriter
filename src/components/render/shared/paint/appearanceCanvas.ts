import { resolveKnownAppAssetUrl } from '../../../../lib/appAssets';
import { loadCachedImage } from '../../video/shared/mediaUtils';
import type { PaintLayer, SurfaceAppearance } from './appearance';
import { toHex8 } from './colorValue';
import { normalizeGradientStops } from './gradient';

const videos = new Map<string, HTMLVideoElement>();
async function videoFrame(url: string, time: number) {
  let video = videos.get(url);
  if (!video) {
    video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'auto';
    video.src = resolveKnownAppAssetUrl(url);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Video fill load timed out')), 15000);
      video!.onloadeddata = () => {
        clearTimeout(timeout);
        resolve();
      };
      video!.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Unable to load video fill'));
      };
    });
    videos.set(url, video);
  }
  const target =
    Number.isFinite(video.duration) && video.duration > 0 ? Math.max(0, time) % video.duration : 0;
  if (Math.abs(video.currentTime - target) > 0.03)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Video fill seek timed out')), 10000);
      video!.onseeked = () => {
        clearTimeout(timeout);
        resolve();
      };
      video!.currentTime = target;
    });
  return video;
}
function gradient(
  ctx: CanvasRenderingContext2D,
  f: PaintLayer,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const angle = (f.gradientAngle * Math.PI) / 180;
  const dx = Math.sin(angle),
    dy = -Math.cos(angle),
    length = Math.abs(w * dx) + Math.abs(h * dy);
  const g =
    f.gradientShape === 'radial'
      ? ctx.createRadialGradient(
          x + w / 2,
          y + h / 2,
          0,
          x + w / 2,
          y + h / 2,
          Math.hypot(w, h) / 2,
        )
      : f.gradientShape === 'diamond'
        ? ctx.createConicGradient(angle - Math.PI / 2, x + w / 2, y + h / 2)
        : ctx.createLinearGradient(
            x + w / 2 - (dx * length) / 2,
            y + h / 2 - (dy * length) / 2,
            x + w / 2 + (dx * length) / 2,
            y + h / 2 + (dy * length) / 2,
          );
  normalizeGradientStops(f.gradientStops, f.gradientStart, f.gradientEnd).forEach((s) =>
    g.addColorStop(s.position / 100, toHex8(s.color, s.alpha)),
  );
  return g;
}
export async function drawAppearance(
  ctx: CanvasRenderingContext2D,
  value: SurfaceAppearance,
  rect: { x: number; y: number; width: number; height: number },
  corners: number | number[] = 0,
  time = 0,
) {
  const { x, y, width: w, height: h } = rect;
  if (w <= 0 || h <= 0) return;
  const path = (offset = 0) => {
    ctx.beginPath();
    ctx.roundRect(
      x - offset,
      y - offset,
      Math.max(0, w + offset * 2),
      Math.max(0, h + offset * 2),
      (Array.isArray(corners) ? corners : [corners]).map((r) =>
        Math.max(0, Math.min(r + offset, (w + offset * 2) / 2, (h + offset * 2) / 2)),
      ),
    );
  };
  for (const s of [...value.shadows].reverse().filter((s) => s.enabled && !s.inset)) {
    ctx.save();
    ctx.shadowColor = s.color;
    ctx.shadowBlur = s.blur;
    ctx.shadowOffsetX = s.x;
    ctx.shadowOffsetY = s.y;
    path(s.spread);
    ctx.fillStyle = s.color;
    ctx.fill();
    ctx.restore();
  }
  for (const f of [...value.fills].reverse().filter((f) => f.enabled && f.opacity > 0)) {
    ctx.save();
    path();
    ctx.clip();
    ctx.globalAlpha *= f.opacity / 100;
    if (f.type === 'image' || f.type === 'video') {
      const source =
        f.type === 'video'
          ? f.videoUrl
            ? await videoFrame(f.videoUrl, time)
            : null
          : f.imageUrl
            ? await loadCachedImage(resolveKnownAppAssetUrl(f.imageUrl))
            : null;
      if (source) {
        const sw = source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
        const sh = source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
        if (sw && sh) {
          const scale =
            (f.type === 'video' && f.videoFit === 'fit') ||
            (f.type === 'image' && f.imageFit === 'fit')
              ? Math.min(w / sw, h / sh)
              : f.type === 'image' && f.imageFit === 'crop'
                ? ((w / sw) * (f.imageScale ?? 100)) / 100
                : Math.max(w / sw, h / sh);
          ctx.translate(x + w / 2 + (f.imageOffsetX || 0), y + h / 2 + (f.imageOffsetY || 0));
          if (f.type === 'image') ctx.rotate(((f.imageAngle || 0) * Math.PI) / 180);
          ctx.drawImage(source, (-sw * scale) / 2, (-sh * scale) / 2, sw * scale, sh * scale);
        }
      }
    } else {
      ctx.fillStyle = f.type === 'gradient' ? gradient(ctx, f, x, y, w, h) : f.color;
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  }
  for (const s of [...value.shadows].reverse().filter((s) => s.enabled && s.inset)) {
    ctx.save();
    path();
    ctx.clip();
    ctx.shadowColor = s.color;
    ctx.shadowBlur = s.blur;
    ctx.shadowOffsetX = s.x;
    ctx.shadowOffsetY = s.y;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = Math.max(1, s.spread * 2 + 1);
    path();
    ctx.stroke();
    ctx.restore();
  }
  for (const s of [...value.strokes].reverse().filter((s) => s.enabled && s.width > 0)) {
    ctx.save();
    ctx.lineWidth = s.width;
    ctx.strokeStyle = s.paint?.type === 'gradient' ? gradient(ctx, s.paint, x, y, w, h) : s.color;
    if (s.paint?.type === 'image' && s.paint.imageUrl) {
      const image = await loadCachedImage(resolveKnownAppAssetUrl(s.paint.imageUrl));
      ctx.strokeStyle = ctx.createPattern(image, 'repeat') || s.color;
    }
    path(s.position === 'inside' ? -s.width / 2 : s.position === 'outside' ? s.width / 2 : 0);
    ctx.stroke();
    ctx.restore();
  }
}
export async function renderAppearancePng(
  value: SurfaceAppearance,
  width: number,
  height: number,
  corners: number | number[] = 0,
  includeOverflow = true,
) {
  const canvas = document.createElement('canvas');
  const padding = includeOverflow
    ? Math.ceil(
        Math.max(
          0,
          ...value.shadows
            .filter((s) => s.enabled)
            .map(
              (s) => Math.max(Math.abs(s.x), Math.abs(s.y)) + s.blur * 2 + Math.max(0, s.spread),
            ),
          ...value.strokes.filter((s) => s.enabled).map((s) => s.width),
        ),
      )
    : 0;
  canvas.width = Math.max(1, Math.ceil(width + padding * 2));
  canvas.height = Math.max(1, Math.ceil(height + padding * 2));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  await drawAppearance(ctx, value, { x: padding, y: padding, width, height }, corners);
  return {
    data: canvas.toDataURL('image/png'),
    padding,
    width: canvas.width,
    height: canvas.height,
  };
}

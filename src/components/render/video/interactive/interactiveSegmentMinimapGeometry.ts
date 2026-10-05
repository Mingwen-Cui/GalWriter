/** Shared with the offline player: preserve aspect ratio and clip the visible graph area. */
export function buildMinimapGeometry(
  width: number,
  height: number,
  graphWidth: number,
  graphHeight: number,
  pan: { x: number; y: number },
  zoom: number,
  viewportSize: { width: number; height: number },
) {
  const mapWidth = Math.max(1, width);
  const mapHeight = Math.max(1, height);
  const graphW = Math.max(1, graphWidth);
  const graphH = Math.max(1, graphHeight);
  const padding = Math.min(8, mapWidth / 4, mapHeight / 4);
  const scale = Math.min((mapWidth - padding * 2) / graphW, (mapHeight - padding * 2) / graphH);
  const offsetX = (mapWidth - graphW * scale) / 2;
  const offsetY = (mapHeight - graphH * scale) / 2;
  const safeZoom = Math.max(0.01, zoom);
  const left = Math.max(0, Math.min(graphW, -pan.x / safeZoom));
  const top = Math.max(0, Math.min(graphH, -pan.y / safeZoom));
  const right = Math.max(0, Math.min(graphW, (viewportSize.width - pan.x) / safeZoom));
  const bottom = Math.max(0, Math.min(graphH, (viewportSize.height - pan.y) / safeZoom));
  return {
    scale, offsetX, offsetY,
    viewport: {
      x: offsetX + left * scale,
      y: offsetY + top * scale,
      width: Math.max(0, right - left) * scale,
      height: Math.max(0, bottom - top) * scale,
    },
  };
}

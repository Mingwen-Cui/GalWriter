import type { CSSProperties } from 'react';

import type { SceneVisualStyle } from '../../../domain/project';
import {
getSceneLightOverlayDomStyle,
resolveSceneLightOverlayUrl,
} from '../../../lib/sceneVisualStyle';

type SceneLightOverlayProps = {
  style?: SceneVisualStyle;
  enabled?: boolean;
  className?: string;
  imageStyle?: CSSProperties;
};

/** Full-frame lighting layer drawn above characters (z above character layer). */
export function SceneLightOverlay({
  style,
  enabled = true,
  className = '',
  imageStyle,
}: SceneLightOverlayProps) {
  const url = resolveSceneLightOverlayUrl(style, enabled);
  if (!url) return null;

  return (
    <img
      src={url}
      alt=""
      draggable={false}
      onDragStart={(event) => event.preventDefault()}
      className={`preview-media-safe pointer-events-none absolute inset-0 z-20 h-full w-full object-cover ${className}`}
      style={{ ...getSceneLightOverlayDomStyle(style), ...imageStyle }}
    />
  );
}

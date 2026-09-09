import type { CSSProperties } from 'react';

import type { InlinePresentationAction } from '../../../domain/project';
import sceneSwitchFlashAssetUrl from '../../../assets/effects/scene-switch-white-flash.png';

/** Bundled overlay used only while a scene material is being switched. */

type SceneSwitchFlashProps = {
  action: InlinePresentationAction | null | undefined;
  targetImageUrl?: string;
  targetImageStyle?: CSSProperties;
};

export function SceneSwitchFlash({
  action,
  targetImageUrl,
  targetImageStyle,
}: SceneSwitchFlashProps) {
  if (action?.kind !== 'scene' || action.action !== 'switch' || !targetImageUrl) return null;

  const duration = Math.max(180, action.duration || 420);
  const style = {
    '--scene-switch-flash-duration': `${duration}ms`,
  } as CSSProperties;

  return (
    <>
      <div key={`scene-switch-reveal-${action.id}`} className="gal-scene-switch-reveal" style={style}>
        <img
          src={targetImageUrl}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="preview-media-safe h-full w-full"
          style={targetImageStyle}
        />
      </div>
      <img
        key={`scene-switch-flash-${action.id}`}
        src={sceneSwitchFlashAssetUrl}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="gal-scene-switch-flash"
        style={style}
      />
    </>
  );
}

import type { CSSProperties } from 'react';

import type { InlinePresentationAction } from '../../../domain/project';
import { getInlineActionDuration } from '../../../lib/inlinePresentationPlayback';
import sceneSwitchFlashAssetUrl from '../../../assets/effects/scene-switch-white-flash.png';

/** Bundled overlay used only while a scene material is being switched. */

type SceneSwitchFlashProps = {
  action: InlinePresentationAction | null | undefined;
  targetImageUrl?: string;
  targetVideoUrl?: string;
  targetImageStyle?: CSSProperties;
  durationMs?: number;
};

export function SceneSwitchFlash({
  action,
  targetImageUrl,
  targetVideoUrl,
  targetImageStyle,
  durationMs,
}: SceneSwitchFlashProps) {
  if (
    action?.kind !== 'scene' ||
    action.action !== 'switch' ||
    (!targetImageUrl && !targetVideoUrl)
  )
    return null;

  const duration = getInlineActionDuration({ ...action, duration: durationMs ?? action.duration });
  const style = {
    '--scene-switch-flash-duration': `${duration}ms`,
  } as CSSProperties;

  return (
    <>
      <div
        key={`scene-switch-reveal-${action.id}`}
        className="gal-scene-switch-reveal"
        style={style}
      >
        {targetVideoUrl ? (
          <video
            src={targetVideoUrl}
            aria-hidden="true"
            playsInline
            muted
            preload="auto"
            className="preview-media-safe h-full w-full"
            style={targetImageStyle}
          />
        ) : (
          <img
            src={targetImageUrl}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="preview-media-safe h-full w-full"
            style={targetImageStyle}
          />
        )}
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

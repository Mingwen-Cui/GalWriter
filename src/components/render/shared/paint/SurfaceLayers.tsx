import type { SurfaceAppearance } from './appearance';
import { paintLayerBackground } from './appearanceStyle';
import { resolveKnownAppAssetUrl } from '../../../../lib/appAssets';

/** Absolute visual layers; the host owns positioning and content. No project state here. */
export function SurfaceLayers({
  value,
  radius = 0,
}: {
  value?: SurfaceAppearance;
  radius?: number | string;
}) {
  if (!value) return null;
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: radius,
        pointerEvents: 'none',
        isolation: 'isolate',
        zIndex: 0,
      }}
    >
      {value.shadows
        .filter((s) => s.enabled)
        .map((s) => (
          <span
            key={s.id}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: radius,
              boxShadow: `${s.inset ? 'inset ' : ''}${s.x}px ${s.y}px ${s.blur}px ${s.spread}px ${s.color}`,
            }}
          />
        ))}
      <span style={{ position: 'absolute', inset: 0, borderRadius: radius, overflow: 'hidden' }}>
        {[...value.fills]
          .reverse()
          .filter((f) => f.enabled)
          .map((f) =>
            f.type === 'video' ? (
              <video
                key={f.id}
                src={resolveKnownAppAssetUrl(f.videoUrl || '')}
                autoPlay
                loop={f.videoLoop !== false}
                muted={f.videoMuted !== false}
                playsInline
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: f.videoFit === 'fit' ? 'contain' : 'cover',
                  opacity: f.opacity / 100,
                }}
              />
            ) : (
              <span
                key={f.id}
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: paintLayerBackground(f),
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  opacity: f.opacity / 100,
                }}
              />
            ),
          )}
      </span>
      {[...value.strokes]
        .reverse()
        .filter((s) => s.enabled)
        .map((s) => (
          <span
            key={s.id}
            style={{
              position: 'absolute',
              inset:
                s.position === 'outside' ? -s.width : s.position === 'center' ? -s.width / 2 : 0,
              borderRadius: radius,
              border: `${s.width}px solid ${s.color}`,
              boxSizing: 'border-box',
            }}
          />
        ))}
    </span>
  );
}

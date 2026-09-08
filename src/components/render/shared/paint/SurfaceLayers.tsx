import { resolveKnownAppAssetUrl } from '../../../../lib/appAssets';
import type { SurfaceAppearance } from './appearance';
import { paintLayerBackground } from './appearanceStyle';

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
                  backgroundSize:
                    f.imageFit === 'fit'
                      ? 'contain'
                      : f.imageFit === 'crop'
                        ? `${f.imageScale ?? 100}%`
                        : 'cover',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: `calc(50% + ${f.imageOffsetX ?? 0}px) calc(50% + ${f.imageOffsetY ?? 0}px)`,
                  transform: f.type === 'image' ? `rotate(${f.imageAngle || 0}deg)` : undefined,
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
              border: s.paint ? undefined : `${s.width}px solid ${s.color}`,
              ...(s.paint
                ? {
                    padding: s.width,
                    background: paintLayerBackground(s.paint),
                    mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                    maskComposite: 'exclude',
                  }
                : {}),
              boxSizing: 'border-box',
            }}
          />
        ))}
    </span>
  );
}

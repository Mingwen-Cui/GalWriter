import { useId } from 'react';

import type { PptAnimationPhase, PptTransitionEffect } from '../video/shared/types';

const star = '14,3 17.2,10.1 25,11 19.2,16.2 20.8,24 14,20 7.2,24 8.8,16.2 3,11 10.8,10.1';
const phaseColors = {
  enter: { stroke: '#16a34a', fill: '#dcfce7' },
  emphasis: { stroke: '#d97706', fill: '#fef3c7' },
  exit: { stroke: '#dc2626', fill: '#fee2e2' },
};

/** The star marks the phase; the overlaid drawing describes an existing effect. */
export function PptAnimationIcon({
  phase,
  effect = 'phase',
  muted = false,
  className = 'h-7 w-7',
}: {
  phase: PptAnimationPhase;
  effect?: string;
  muted?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, '');
  const color =
    muted || effect === 'none' ? { stroke: '#94a3b8', fill: '#f1f5f9' } : phaseColors[phase];
  const vertical = effect === 'shake-y';
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke={color.stroke}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <defs>
        <clipPath id={id}>
          <polygon points={star} />
        </clipPath>
      </defs>
      <polygon points={star} fill={color.fill} />
      {effect === 'opacity' && (
        <rect
          x="14"
          y="3"
          width="12"
          height="22"
          fill={color.stroke}
          fillOpacity="0.45"
          stroke="none"
          clipPath={`url(#${id})`}
        />
      )}
      {effect === 'brightness' && (
        <>
          <circle cx="14" cy="13" r="3" fill={color.stroke} stroke="none" />
          <path d="M14 7v1m0 10v1m-6-6h1m10 0h1m-10-4 1 1m6 6 1 1m0-8-1 1m-6 6-1 1" />
        </>
      )}
      {(effect === 'line' || effect === 'translate') && (
        <path d={phase === 'exit' ? 'M7 28h18m-4-3 4 3-4 3' : 'M25 28H7m4-3-4 3 4 3'} />
      )}
      {(effect === 'shake-x' || effect === 'shake-y') && (
        <path
          transform={vertical ? 'rotate(90 14 14)' : undefined}
          d="M1 18V9m2 2-2-2-2 2M28 9v9m-2-2 2 2 2-2"
        />
      )}
      {(effect === 'scale' || effect === 'pulse') && (
        <path d="M1 5V1h4m22 26v4h-4M1 1l6 6m24 24-6-6" />
      )}
      {effect === 'pulse' && <path d="M27 5h3M4 27H1" />}
      {effect === 'rotate' && <path d="M22 5a11 11 0 0 1 7 14m-3-3 3 3 2-4" />}
      {effect === 'switch' && <path d="M2 28h10l-3-3m21 3H20l3 3" />}
      {effect === 'line-wipe' && <path d="M9 11h10m-10 4h7m-7 4h4" />}
      {effect === 'add' && (
        <>
          <circle cx="25" cy="25" r="5" fill="white" />
          <path d="M25 22v6m-3-3h6" />
        </>
      )}
      {effect === 'phase' &&
        (phase === 'emphasis' ? (
          <circle cx="14" cy="14" r="2.3" fill={color.stroke} stroke="none" />
        ) : (
          <path d={phase === 'enter' ? 'M14 18V10m-3 3 3-3 3 3' : 'M14 10v8m-3-3 3 3 3-3'} />
        ))}
    </svg>
  );
}

/** Page silhouettes distinguish the transition vocabulary already supported. */
export function PptTransitionIcon({
  effect,
  className = 'h-7 w-7',
}: {
  effect: PptTransitionEffect;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect
        x="5"
        y="6"
        width="22"
        height="20"
        rx="2"
        fill="currentColor"
        fillOpacity={effect === 'none' ? 0 : 0.08}
        strokeDasharray={effect === 'fade' ? '2 3' : undefined}
      />
      {effect === 'none' && <path d="m10 11 12 10m0-10L10 21" opacity="0.6" />}
      {effect === 'smooth' && <path d="m10 16 6-6 6 6-6 6Z" />}
      {effect === 'push' && <path d="M1 16h19m-4-4 4 4-4 4" />}
      {effect === 'wipe' && (
        <>
          <path d="M15 6v20" />
          <path d="M5 6h10v20H5Z" fill="currentColor" fillOpacity="0.25" stroke="none" />
        </>
      )}
      {effect === 'split' && <path d="M16 6v20M14 16H2m4-3-4 3 4 3m12-3h12m-4-3 4 3-4 3" />}
      {effect === 'reveal' && (
        <>
          <rect x="10" y="11" width="12" height="10" rx="1" fill="currentColor" fillOpacity="0.2" />
          <path d="m16 8-2 3h4Z" fill="currentColor" />
        </>
      )}
      {effect === 'cut' && <path d="m19 6-6 9h7l-6 11" />}
      {effect === 'randomBars' && (
        <path d="M9 9v8m4-8v14m4-14v10m4-10v14m3-14v6" strokeWidth="2.4" />
      )}
      {effect === 'fade' && <circle cx="16" cy="16" r="5" strokeDasharray="1 3" />}
    </svg>
  );
}

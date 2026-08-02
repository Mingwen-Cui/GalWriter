import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DotLottie } from '@lottiefiles/dotlottie-react';

import startupAnimation from '../animation/startup-splash/startup-animation.lottie';
import './StartupSplash.css';

const STORAGE_KEY = 'galwriter.startupSplash.played';
const FAIL_OPEN_AFTER_MS = 2500;
const REDUCED_DURATION_MS = 250;

export function StartupSplash() {
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const finishTimerRef = useRef<number | null>(null);
  const finishedRef = useRef(false);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
    try { window.sessionStorage.setItem(STORAGE_KEY, '1'); } catch { /* storage is optional */ }
    setVisible(false);
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(STORAGE_KEY) === '1') {
        finish();
        return undefined;
      }
    } catch { /* play the animation if storage is unavailable */ }

    finishTimerRef.current = window.setTimeout(finish, reducedMotion ? REDUCED_DURATION_MS : FAIL_OPEN_AFTER_MS);
    return () => {
      if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current);
    };
  }, [finish, reducedMotion]);

  const attachPlayer = useCallback((player: DotLottie | null) => {
    if (!player) return;
    player.addEventListener('complete', finish);
    player.addEventListener('loadError', finish);
  }, [finish]);

  if (!visible) return null;

  return (
    <div className="startup-splash" aria-hidden="true">
      {reducedMotion ? (
        <div className="startup-splash__reduced-mark" />
      ) : (
        <DotLottieReact
          src={startupAnimation}
          autoplay
          className="startup-splash__animation"
          dotLottieRefCallback={attachPlayer}
          loop={false}
          renderConfig={{ autoResize: true }}
        />
      )}
    </div>
  );
}

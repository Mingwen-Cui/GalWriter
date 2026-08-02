import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Lottie from 'lottie-react';

import logoAnimation from '../animation/startup-splash/logo-animation.json';
import wipeAnimation from '../animation/startup-splash/wipe-animation.json';
import './StartupSplash.css';

const STORAGE_KEY = 'galwriter.startupSplash.played';
const COLORS = ['#21BFD0', '#63D081', '#EF3E43', '#FF8A24', '#E83E82'];
const HANDOFF_AT = 1450;
const REVEAL_AT = 2250;
const FINISH_AT = 3180;
const REDUCED_DURATION = 450;

type Metrics = {
  height: number;
  logoSize: number;
  nodeDiameter: number;
  nodeX: number[];
  nodeY: number[];
  curtainWidths: number[];
  curtainCenters: number[];
};

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

function buildMetrics(width: number, height: number): Metrics {
  const logoSize = clamp(Math.min(width * 0.82, height * 0.9), 220, 920);
  const nodeDiameter = clamp(logoSize * 0.1092, 38, 112);
  const normalizedX = [0.167, 0.333, 0.5, 0.667, 0.83];
  const normalizedY = [0.396, 0.396, 0.476, 0.396, 0.396];
  const nodeX = normalizedX.map((x) => width / 2 + (x - 0.5) * logoSize);
  const nodeY = normalizedY.map((y) => height / 2 + (y - 0.5) * logoSize);
  const stableWidth = Math.min(width, height * 2.05);
  const middle = stableWidth * 0.18;
  const remaining = Math.max(0, width - middle * 3);
  const curtainWidths = [remaining * (22 / 46), middle, middle, middle, remaining * (24 / 46)];
  let cursor = 0;
  const curtainCenters = curtainWidths.map((curtainWidth) => {
    const center = cursor + curtainWidth / 2;
    cursor += curtainWidth;
    return center;
  });

  return { height, logoSize, nodeDiameter, nodeX, nodeY, curtainWidths, curtainCenters };
}

function ReducedLogo() {
  return (
    <svg className="startup-splash__reduced-logo" viewBox="0 0 240 240" aria-hidden="true">
      <g fill="none" stroke="#2338E8" strokeLinecap="round" strokeLinejoin="round" strokeWidth="12">
        <path d="M120 54v62" />
        <path d="M120 83c0 30-18 43-47 43M120 83c0 30 18 43 47 43" />
        <path d="M120 110c0 35-49 32-66 72M120 110c0 30-23 34-28 72M120 110v89M120 110c0 30 23 34 28 72M120 110c0 35 49 32 66 72" />
      </g>
      <g fill="#2338E8"><circle cx="120" cy="44" r="22" /><circle cx="54" cy="190" r="16" /><circle cx="92" cy="190" r="16" /><circle cx="120" cy="207" r="16" /><circle cx="148" cy="190" r="16" /><circle cx="186" cy="190" r="16" /></g>
    </svg>
  );
}

export function StartupSplash() {
  const containerRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<number[]>([]);
  const finishedRef = useRef(false);
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [phase, setPhase] = useState<'logo' | 'handoff' | 'reveal' | 'reduced'>('logo');
  const [metrics, setMetrics] = useState(() => buildMetrics(1280, 720));

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearTimers();
    try { window.sessionStorage.setItem(STORAGE_KEY, '1'); } catch { /* storage is optional */ }
    setVisible(false);
  }, [clearTimers]);

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

    if (reducedMotion) {
      setPhase('reduced');
      timersRef.current.push(window.setTimeout(finish, REDUCED_DURATION));
    } else {
      timersRef.current.push(window.setTimeout(() => setPhase('handoff'), HANDOFF_AT));
      timersRef.current.push(window.setTimeout(() => setPhase('reveal'), REVEAL_AT));
      timersRef.current.push(window.setTimeout(finish, FINISH_AT));
    }
    return clearTimers;
  }, [clearTimers, finish, reducedMotion]);

  useEffect(() => {
    const measure = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) setMetrics(buildMetrics(rect.width, rect.height));
    };
    measure();
    window.addEventListener('resize', measure, { passive: true });
    return () => window.removeEventListener('resize', measure);
  }, []);

  const curtainStyles = useMemo(() => COLORS.map((color, index) => ({
    '--curtain-color': color,
    '--slot-x': `${metrics.curtainCenters[index]}px`,
    '--panel-width': `${metrics.curtainWidths[index] + 2}px`,
    '--node-d': `${metrics.nodeDiameter}px`,
    '--pill-width': `${metrics.nodeDiameter * 1.08}px`,
    '--pill-height': `${metrics.nodeDiameter * 2.45}px`,
    '--start-dx': `${metrics.nodeX[index] - metrics.curtainCenters[index]}px`,
    '--start-dy': `${metrics.nodeY[index] - metrics.height / 2}px`,
    '--drop-delay': index === 2 ? '100ms' : '0ms',
    '--drop-duration': index === 2 ? '300ms' : '400ms',
    '--wipe-delay': index === 2 ? '980ms' : '930ms',
  } as React.CSSProperties)), [metrics]);

  if (!visible) return null;
  const showCurtains = phase === 'handoff' || phase === 'reveal';

  return <div ref={containerRef} className={`startup-splash startup-splash--${phase}`} style={{ '--logo-size': `${metrics.logoSize}px` } as React.CSSProperties} aria-hidden="true">
    {phase === 'reduced' ? <ReducedLogo /> : <>
      <div className="startup-splash__logo"><Lottie animationData={logoAnimation} autoplay loop={false} onDataFailed={finish} renderer="svg" /></div>
      {showCurtains && <div className="startup-splash__curtains">
        {curtainStyles.map((style, index) => <div className="startup-splash__slot" style={style} key={COLORS[index]}><div className="startup-splash__drop"><div className="startup-splash__wipe"><div className="startup-splash__shape" /></div></div></div>)}
        <div className="startup-splash__edge">{curtainStyles.map((style, index) => <span style={{ width: style['--panel-width'], background: COLORS[index] }} key={COLORS[index]} />)}</div>
      </div>}
      {showCurtains && <div className="startup-splash__clock"><Lottie animationData={wipeAnimation} autoplay loop={false} onDataFailed={finish} onComplete={finish} renderer="svg" /></div>}
    </>}
  </div>;
}

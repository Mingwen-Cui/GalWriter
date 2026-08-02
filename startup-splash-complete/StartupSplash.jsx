import React, {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Lottie from 'lottie-react';
import logoAnimation from './logo-animation.json';
import wipeAnimation from './wipe-animation.json';
import './StartupSplash.css';

const DEFAULT_STORAGE_KEY = 'branchwriter.startupSplash.played';
const COLORS = ['#21BFD0', '#63D081', '#EF3E43', '#FF8A24', '#E83E82'];
const NORMAL_DURATION = 3000;
const HANDOFF_AT = 1450;
const REVEAL_AT = 2250;
const REDUCED_DURATION = 450;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function ReducedLogo() {
  return (
    <svg
      className="startupReducedLogo"
      viewBox="0 0 240 240"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <g fill="none" stroke="#2338E8" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round">
        <path d="M120 54v62" />
        <path d="M120 83c0 30-18 43-47 43" />
        <path d="M120 83c0 30 18 43 47 43" />
        <path d="M120 110c0 35-49 32-66 72" />
        <path d="M120 110c0 30-23 34-28 72" />
        <path d="M120 110v89" />
        <path d="M120 110c0 30 23 34 28 72" />
        <path d="M120 110c0 35 49 32 66 72" />
      </g>
      <g fill="#2338E8">
        <circle cx="120" cy="44" r="22" />
        <circle cx="54" cy="190" r="16" />
        <circle cx="92" cy="190" r="16" />
        <circle cx="120" cy="207" r="16" />
        <circle cx="148" cy="190" r="16" />
        <circle cx="186" cy="190" r="16" />
      </g>
    </svg>
  );
}

class SplashErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);

  return reduced;
}

function buildMetrics(width, height, dpr) {
  const logoSize = clamp(Math.min(width * 0.82, height * 0.9), 220, 920);
  const nodeDiameter = clamp(logoSize * 0.1092, 38, 112);
  // Pixel-matched to the last rendered frame of logo-animation.json.
  const normalizedX = [0.167, 0.333, 0.5, 0.667, 0.83];
  const normalizedY = [0.396, 0.396, 0.476, 0.396, 0.396];
  const nodeX = normalizedX.map((x) => width / 2 + (x - 0.5) * logoSize);
  const nodeY = normalizedY.map((y) => height / 2 + (y - 0.5) * logoSize);

  // Keep the middle three visually stable. On ultrawide windows, distribute the
  // extra width only to the outer curtains in the requested 22:24 ratio.
  const stableWidth = Math.min(width, height * 2.05);
  const middle = stableWidth * 0.18;
  const remaining = Math.max(0, width - middle * 3);
  const curtainWidths = [remaining * (22 / 46), middle, middle, middle, remaining * (24 / 46)];
  const curtainCenters = [];
  let cursor = 0;
  curtainWidths.forEach((curtainWidth) => {
    curtainCenters.push(cursor + curtainWidth / 2);
    cursor += curtainWidth;
  });

  return {
    width,
    height,
    dpr,
    logoSize,
    nodeDiameter,
    nodeX,
    nodeY,
    curtainWidths,
    curtainCenters,
  };
}

function StartupSplashInner({
  oncePerSession = true,
  forcePlay = false,
  storageKey = DEFAULT_STORAGE_KEY,
  onComplete,
}) {
  const containerRef = useRef(null);
  const logoRef = useRef(null);
  const wipeClockRef = useRef(null);
  const timersRef = useRef([]);
  const finishedRef = useRef(false);
  const logoLoadedRef = useRef(false);
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(true);
  const [phase, setPhase] = useState('logo');
  const [metrics, setMetrics] = useState(() => buildMetrics(1280, 720, 1));

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearTimers();
    try {
      if (oncePerSession) window.sessionStorage.setItem(storageKey, '1');
    } catch {
      // Storage can be unavailable in privacy modes; animation still completes.
    }
    logoRef.current?.destroy?.();
    wipeClockRef.current?.destroy?.();
    setVisible(false);
    onComplete?.();
  }, [clearTimers, oncePerSession, onComplete, storageKey]);

  const failOpen = useCallback(() => {
    document.documentElement.dataset.startupSplashFailed = 'true';
    finish();
  }, [finish]);

  useEffect(() => {
    if (!forcePlay && oncePerSession) {
      try {
        if (window.sessionStorage.getItem(storageKey) === '1') {
          finish();
          return undefined;
        }
      } catch {
        // Ignore storage failures and play once for this mount.
      }
    }

    if (reduced) {
      setPhase('reduced');
      timersRef.current.push(window.setTimeout(finish, REDUCED_DURATION));
      return clearTimers;
    }

    setPhase('logo');
    timersRef.current.push(window.setTimeout(() => setPhase('handoff'), HANDOFF_AT));
    timersRef.current.push(window.setTimeout(() => setPhase('reveal'), REVEAL_AT));
    timersRef.current.push(window.setTimeout(finish, NORMAL_DURATION + 180));
    timersRef.current.push(window.setTimeout(() => {
      if (!logoLoadedRef.current) failOpen();
    }, 900));

    return clearTimers;
  }, [clearTimers, failOpen, finish, forcePlay, oncePerSession, reduced, storageKey]);

  useEffect(() => {
    if (!visible || !containerRef.current) return undefined;
    const element = containerRef.current;
    let resolutionQuery;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      setMetrics(buildMetrics(rect.width, rect.height, window.devicePixelRatio || 1));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener('resize', measure, { passive: true });

    const watchDpr = () => {
      resolutionQuery?.removeEventListener?.('change', watchDpr);
      resolutionQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      resolutionQuery.addEventListener?.('change', watchDpr);
      measure();
    };
    watchDpr();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      resolutionQuery?.removeEventListener?.('change', watchDpr);
    };
  }, [visible]);

  useEffect(() => () => {
    clearTimers();
    logoRef.current?.destroy?.();
    wipeClockRef.current?.destroy?.();
  }, [clearTimers]);

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
  })), [metrics]);

  if (!visible) return null;

  const showCurtains = phase === 'handoff' || phase === 'reveal';
  const rootStyle = {
    '--logo-size': `${metrics.logoSize}px`,
    '--device-pixel-ratio': metrics.dpr,
  };

  return (
    <div
      ref={containerRef}
      className={`startupSplash startupSplash--${phase}`}
      style={rootStyle}
      role="presentation"
      aria-hidden="true"
    >
      {phase === 'reduced' ? (
        <ReducedLogo />
      ) : (
        <>
          <div className="startupLogoStage">
            <Lottie
              lottieRef={logoRef}
              animationData={logoAnimation}
              autoplay
              loop={false}
              onDOMLoaded={() => { logoLoadedRef.current = true; }}
              onDataFailed={failOpen}
              renderer="svg"
              rendererSettings={{ preserveAspectRatio: 'xMidYMid meet', progressiveLoad: true }}
            />
          </div>

          {showCurtains && (
            <div className="startupCurtainLayer">
              {curtainStyles.map((style, index) => (
                <div className="startupCurtainSlot" style={style} key={COLORS[index]}>
                  <div className="startupDropTrack">
                    <div className="startupWipeTrack">
                      <div className="startupCurtainShape" />
                    </div>
                  </div>
                </div>
              ))}
              <div className="startupEdgeLine">
                {curtainStyles.map((style, index) => (
                  <span style={{ width: style['--panel-width'], background: COLORS[index] }} key={COLORS[index]} />
                ))}
              </div>
            </div>
          )}

          {showCurtains && (
            <div className="startupWipeClock" aria-hidden="true">
              <Lottie
                lottieRef={wipeClockRef}
                animationData={wipeAnimation}
                autoplay
                loop={false}
                onComplete={finish}
                onDataFailed={failOpen}
                renderer="svg"
                rendererSettings={{ preserveAspectRatio: 'xMidYMid meet', progressiveLoad: true }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function StartupSplash(props) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <SplashErrorBoundary onError={() => setFailed(true)}>
      <StartupSplashInner {...props} />
    </SplashErrorBoundary>
  );
}

import { useEffect, useState } from 'react';

const DESKTOP_MIN_WIDTH = 768;
const DESKTOP_MIN_ASPECT_RATIO = 6 / 5;

const getIsDesktopViewport = () => {
  if (typeof window === 'undefined') return false;

  return (
    window.innerWidth >= DESKTOP_MIN_WIDTH &&
    window.innerWidth / Math.max(1, window.innerHeight) >= DESKTOP_MIN_ASPECT_RATIO
  );
};

export function useDesktopViewport() {
  const [isDesktopViewport, setIsDesktopViewport] = useState(getIsDesktopViewport);

  useEffect(() => {
    const updateViewport = () => setIsDesktopViewport(getIsDesktopViewport());
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    updateViewport();

    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
    };
  }, []);

  return isDesktopViewport;
}

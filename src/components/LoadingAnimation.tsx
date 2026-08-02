import './LoadingAnimation.css';

import { DotLottieReact } from '@lottiefiles/dotlottie-react';

import startupAnimation from '../animation/startup-splash/startup-animation.lottie';

type LoadingAnimationProps = {
  className?: string;
};

/** Uses the startup animation as the single loading indicator throughout the app. */
export function LoadingAnimation({ className = '' }: LoadingAnimationProps) {
  return (
    <span className={`loading-animation ${className}`.trim()} aria-hidden="true">
      <DotLottieReact
        src={startupAnimation}
        autoplay
        loop
        className="loading-animation__player"
        renderConfig={{ autoResize: true }}
      />
      <span className="loading-animation__reduced-mark" />
    </span>
  );
}

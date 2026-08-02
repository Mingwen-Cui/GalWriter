import './index.css';

import { setWasmUrl } from '@lottiefiles/dotlottie-react';
import dotLottieWasmUrl from '@lottiefiles/dotlottie-web/dotlottie-player.wasm?url';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.tsx';

// Keep the dotLottie runtime on the same origin. The library otherwise downloads
// its WASM runtime from a public CDN, which can make every animation appear blank
// for a long time on slower or restricted networks.
setWasmUrl(dotLottieWasmUrl);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

requestAnimationFrame(() => {
  requestAnimationFrame(() => window.dispatchEvent(new Event('galwriter:app-ready')));
});

import { lazy } from 'react';

export const PlayTestModal = lazy(() =>
  import('../PlayTestModal').then((module) => ({ default: module.PlayTestModal })),
);
export const ZenEditor = lazy(() =>
  import('../ZenEditor').then((module) => ({ default: module.ZenEditor })),
);
export const SettingsModal = lazy(() =>
  import('../SettingsModal').then((module) => ({ default: module.SettingsModal })),
);
export const VideoRenderModal = lazy(() =>
  import('../VideoRenderModal').then((module) => ({ default: module.VideoRenderModal })),
);

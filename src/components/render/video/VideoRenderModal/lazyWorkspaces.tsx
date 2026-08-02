import { lazy } from 'react';

import type { RenderWorkspaceMode } from '../shared/types';

const loadWebWorkspace = () => import('../../web/WebWorkspace');
const loadPptWorkspace = () => import('../../ppt/PptWorkspace');
const loadCodeWorkspace = () => import('../../code/CodeWorkspace');

export const LazyWebWorkspace = lazy(() =>
  loadWebWorkspace().then((module) => ({ default: module.WebWorkspace })),
);

export const LazyPptWorkspace = lazy(() =>
  loadPptWorkspace().then((module) => ({ default: module.PptWorkspace })),
);

export const LazyCodeWorkspace = lazy(() =>
  loadCodeWorkspace().then((module) => ({ default: module.CodeWorkspace })),
);

export const preloadRenderWorkspace = (mode: RenderWorkspaceMode) => {
  if (mode === 'web') return loadWebWorkspace().then(() => undefined);
  if (mode === 'ppt') return loadPptWorkspace().then(() => undefined);
  if (mode === 'code') return loadCodeWorkspace().then(() => undefined);
  return Promise.resolve();
};

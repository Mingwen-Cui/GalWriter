import type { PptAnimationTarget, PptExportSettings, PptSlideTransition } from '../video/shared/types';

export type PptWorkspaceViewMode = 'normal' | 'sorter' | 'reading';
export type PptWorkspaceSidebarTab = 'timeline' | 'style' | 'export';
export type PptSlideItem = {
  id: string;
  title: string;
  kind: 'cover' | 'scene' | 'choice';
  sceneId?: string;
};
export type PptSelection = { target: PptAnimationTarget; targetId?: string; label: string };
export type PptCanvasLayout = PptExportSettings['layout'];

export const PPT_CONTENT_WIDTH = 1920;
export const PPT_CONTENT_HEIGHT = 1080;
export const pptCanvasViewportClass = (layout: PptCanvasLayout) =>
  layout === 'LAYOUT_STANDARD' ? 'aspect-[4/3]' : 'aspect-video';

export const DEFAULT_PPT_TRANSITION: PptSlideTransition = {
  effect: 'none',
  durationMs: 700,
  direction: 'left',
  advanceOnClick: true,
};

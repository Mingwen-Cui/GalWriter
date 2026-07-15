import type { PptAnimationTarget, PptExportSettings, PptManualSlide, PptSlideTransition } from '../video/shared/types';

export type PptWorkspaceViewMode = 'normal' | 'sorter' | 'reading';
export type PptWorkspaceSidebarTab = 'timeline' | 'style' | 'export';
export type PptSlideItem = {
  id: string;
  title: string;
  kind: 'cover' | 'scene' | 'choice' | 'manual';
  sceneId?: string;
  manualSlideId?: string;
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

export const composePptSlides = (
  generatedSlides: PptSlideItem[],
  manualSlides: PptManualSlide[],
  savedOrder: string[] | undefined,
) => {
  const manualItems: PptSlideItem[] = manualSlides.map((slide) => ({
    id: slide.id,
    title: slide.title,
    kind: 'manual',
    manualSlideId: slide.id,
  }));
  const allById = new Map([...generatedSlides, ...manualItems].map((slide) => [slide.id, slide]));
  const ordered = (savedOrder || []).flatMap((id) => {
    const slide = allById.get(id);
    return slide ? [slide] : [];
  });
  const included = new Set(ordered.map((slide) => slide.id));
  return [...ordered, ...generatedSlides.filter((slide) => !included.has(slide.id)), ...manualItems.filter((slide) => !included.has(slide.id))];
};

export const insertPptSlideOrder = (order: string[] | undefined, ids: string[], afterId: string, newId: string) => {
  const base = order?.filter((id) => ids.includes(id)) || ids;
  const index = base.indexOf(afterId);
  return [...base.slice(0, index < 0 ? base.length : index + 1), newId, ...base.slice(index < 0 ? base.length : index + 1)];
};

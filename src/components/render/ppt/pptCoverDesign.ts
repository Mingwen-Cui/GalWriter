import type { PptManualElement, PptSlideBackgroundStyle } from '../video/shared/types';

export const usesDefaultPptCoverDesign = (
  background: PptSlideBackgroundStyle | undefined,
  fallbackImageUrl: string | undefined,
) => {
  if (background?.coverDesign === 'universal') return true;
  if (background?.appearance || (background && background.type !== 'image')) return false;
  const image = background ? background.imageUrl : fallbackImageUrl;
  return Boolean(image?.includes('default-main-interface-background'));
};

/** Use only the editor's existing basic shapes; all remain individually editable. */
export const createPptCoverDecorations = (): PptManualElement[] => [
  {
    id: 'ppt-cover-decoration-accent', kind: 'shape',
    x: 170, y: 282, width: 64, height: 6, rotation: 0,
    webStyle: {
      shapeType: 'rectangle', backgroundColor: '#625bf6',
      fillEnabled: true, strokeEnabled: false, shadowEnabled: false, zIndex: 1,
    },
  },
  {
    id: 'ppt-cover-decoration-divider', kind: 'shape',
    x: 172, y: 758, width: 464, height: 2, rotation: 0,
    webStyle: {
      shapeType: 'rectangle', backgroundColor: '#dce1ee',
      fillEnabled: true, strokeEnabled: false, shadowEnabled: false, zIndex: 1,
    },
  },
  {
    id: 'ppt-cover-decoration-circle', kind: 'shape',
    x: 746, y: 270, width: 28, height: 28, rotation: 0,
    webStyle: {
      shapeType: 'circle', borderColor: '#c3c7df', borderWidth: 1.5,
      fillEnabled: false, strokeEnabled: true, shadowEnabled: false, zIndex: 1,
    },
  },
];

export const resolvePptCoverElements = (
  elements: PptManualElement[] | undefined,
  background: PptSlideBackgroundStyle | undefined,
  fallbackImageUrl: string | undefined,
) => elements ?? (usesDefaultPptCoverDesign(background, fallbackImageUrl) ? createPptCoverDecorations() : []);

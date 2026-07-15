import type {
  PptManualButtonElement,
  PptManualElement,
  PptManualImageElement,
  PptManualSlide,
  PptManualTextElement,
} from '../video/shared/types';

const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export const createManualSlide = (title: string): PptManualSlide => ({
  id: createId('manual-slide'),
  title,
  backgroundColor: '#0f172a',
  elements: [],
});

export const createManualText = (text: string): PptManualTextElement => ({
  id: createId('manual-text'),
  kind: 'text',
  text,
  x: 260,
  y: 250,
  width: 1400,
  height: 140,
  fontSize: 52,
  color: '#ffffff',
  fontFamily: 'Arial',
  align: 'center',
  bold: true,
});

export const createManualImage = (src: string, alt?: string): PptManualImageElement => ({
  id: createId('manual-image'),
  kind: 'image',
  src,
  alt,
  x: 480,
  y: 220,
  width: 960,
  height: 640,
});

export const createManualButton = (text: string): PptManualButtonElement => ({
  id: createId('manual-button'),
  kind: 'button',
  text,
  x: 720,
  y: 760,
  width: 480,
  height: 100,
  variant: 'primary',
  action: 'none',
});

export const duplicateManualSlide = (slide: PptManualSlide, title: string): PptManualSlide => ({
  ...slide,
  id: createId('manual-slide'),
  title,
  elements: slide.elements.map((element) => ({ ...element, id: createId(`manual-${element.kind}`) })),
});

export const updateManualElement = (
  slide: PptManualSlide,
  elementId: string,
  patch: Partial<PptManualElement>,
) => ({
  ...slide,
  elements: slide.elements.map((element) => (element.id === elementId ? { ...element, ...patch } as PptManualElement : element)),
});

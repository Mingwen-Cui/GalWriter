/** Apply the saved logical slide order to PptxGenJS's physical slide list. */
export const reorderPptSlides = <T extends { _slideNum: number }>(
  slides: T[],
  slideById: Map<string, T>,
  orderedSlideIds: string[],
) => {
  const ordered = orderedSlideIds.flatMap((id) => {
    const slide = slideById.get(id);
    return slide ? [slide] : [];
  });
  slides.splice(0, slides.length, ...ordered);
  slides.forEach((slide, index) => {
    slide._slideNum = index + 1;
  });
  return ordered;
};

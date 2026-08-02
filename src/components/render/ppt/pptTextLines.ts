/**
 * Export-only soft wrapping. CJK glyphs are treated as full-width and Latin
 * glyphs as roughly half-width, keeping editable PPT line objects close to
 * the stage layout without changing the authored story text.
 */
const glyphWidth = (character: string) =>
  /[\u2e80-\u9fff\uff00-\uffef]/.test(character) ? 1 : /\s/.test(character) ? 0.32 : 0.56;

export const splitPptTextLines = (text: string, maxWidthPt: number, fontSizePt: number) => {
  const capacity = Math.max(4, maxWidthPt / Math.max(1, fontSizePt));
  const lines: string[] = [];
  for (const paragraph of (text || ' ').split(/\r?\n/)) {
    if (!paragraph) {
      lines.push(' ');
      continue;
    }
    let line = '';
    let width = 0;
    for (const character of paragraph) {
      const nextWidth = glyphWidth(character);
      if (line && width + nextWidth > capacity) {
        lines.push(line);
        line = character;
        width = nextWidth;
      } else {
        line += character;
        width += nextWidth;
      }
    }
    if (line) lines.push(line);
  }
  return lines.slice(0, 8);
};

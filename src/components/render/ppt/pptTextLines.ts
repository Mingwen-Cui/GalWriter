/**
 * Export-only soft wrapping. CJK glyphs are treated as full-width and Latin
 * glyphs as roughly half-width, keeping editable PPT line objects close to
 * the stage layout without changing the authored story text.
 */
const glyphWidth = (character: string) =>
  /[\u2e80-\u9fff\uff00-\uffef]/.test(character) ? 1 : /\s/.test(character) ? 0.32 : 0.56;

export type PptTypewriterGlyph = { char: string; widthPt: number };
export type PptTypewriterLine = { glyphs: PptTypewriterGlyph[]; widthPt: number };

export const splitPptTypewriterChars = (
  text: string,
  maxWidthPt: number,
  fontSizePt: number,
  maxLines = 40,
): PptTypewriterLine[] => {
  const capacity = Math.max(4, maxWidthPt / Math.max(1, fontSizePt));
  const lines: PptTypewriterLine[] = [];
  for (const paragraph of (text || ' ').split(/\r?\n/)) {
    if (!paragraph) {
      const widthPt = glyphWidth(' ') * fontSizePt;
      lines.push({ glyphs: [{ char: ' ', widthPt }], widthPt });
      continue;
    }
    let glyphs: PptTypewriterGlyph[] = [];
    let width = 0;
    for (const character of paragraph) {
      const charWidth = glyphWidth(character);
      const nextWidthPt = charWidth * fontSizePt;
      if (glyphs.length && width + charWidth > capacity) {
        lines.push({ glyphs, widthPt: width * fontSizePt });
        glyphs = [];
        width = 0;
      }
      glyphs.push({ char: character, widthPt: nextWidthPt });
      width += charWidth;
    }
    if (glyphs.length) lines.push({ glyphs, widthPt: width * fontSizePt });
  }
  return lines.slice(0, maxLines);
};

export const splitPptTextLines = (
  text: string,
  maxWidthPt: number,
  fontSizePt: number,
  maxLines = 8,
) => {
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
  return lines.slice(0, maxLines);
};

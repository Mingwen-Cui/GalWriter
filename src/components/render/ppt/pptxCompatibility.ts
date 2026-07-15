import JSZip from 'jszip';

const CONTENT_TYPES_PATH = '[Content_Types].xml';

/**
 * PptxGenJS 4.0.1 registers a slide-master override for every slide, even
 * though the package contains only one slide master. PowerPoint treats those
 * references as broken and repairs the presentation on open.
 */
const removeMissingSlideMasterOverrides = (contentTypes: string) =>
  contentTypes.replace(
    /<Override PartName="\/ppt\/slideMasters\/slideMaster(?!1\.xml")[^"]*"[^>]*\/>/g,
    '',
  );

/**
 * CSS font stacks are valid in the editor but invalid in OOXML attributes
 * when they contain quoted fallbacks. PPTX needs one installed font family.
 */
export const toPptFontFace = (fontFamily?: string) => {
  const firstFamily = fontFamily?.split(',')[0]?.trim().replace(/["']/g, '');
  return firstFamily || 'Arial';
};

export async function finalizePptxForPowerPoint(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  const archive = await JSZip.loadAsync(buffer);
  const contentTypes = await archive.file(CONTENT_TYPES_PATH)?.async('string');
  if (!contentTypes) throw new Error('PPTX export is missing [Content_Types].xml');

  archive.file(CONTENT_TYPES_PATH, removeMissingSlideMasterOverrides(contentTypes));
  return archive.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
}

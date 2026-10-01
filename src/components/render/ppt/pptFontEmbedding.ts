import JSZip from 'jszip';

import type { RenderCustomFont } from '../video/shared/types';

const FONT_RELATIONSHIP =
  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/font';
const FONT_CONTENT_TYPE = 'application/x-fontdata';
const FONT_PART_DIRECTORY = 'ppt/fonts';
const MAX_FONT_BYTES = 64 * 1024 * 1024;

type FontTable = { offset: number; length: number };
type ParsedFont = {
  bytes: Uint8Array;
  family: string;
  style: string;
  fullName: string;
  version: string;
  fsType: number;
  weight: number;
  italic: boolean;
  panose: Uint8Array;
  unicodeRanges: number[];
  codePageRanges: number[];
  checkSumAdjustment: number;
};

export type PptFontEmbeddingResult = {
  font: RenderCustomFont;
  embedded: boolean;
  reason?: 'format' | 'license' | 'readOnly' | 'bitmapOnly' | 'invalid' | 'duplicateFace';
};

const readU16 = (bytes: Uint8Array, offset: number) => (bytes[offset] << 8) | bytes[offset + 1];
const readU32 = (bytes: Uint8Array, offset: number) =>
  bytes[offset] * 0x1000000 +
  (bytes[offset + 1] << 16) +
  (bytes[offset + 2] << 8) +
  bytes[offset + 3];
const decodeFontDataUrl = (dataUrl: string) => {
  const match = dataUrl.match(/^data:[^,]*;base64,([\s\S]+)$/i);
  if (!match) throw new Error('Invalid font data URL.');
  const binary = atob(match[1]);
  if (binary.length > MAX_FONT_BYTES) throw new Error('Font is larger than 64 MB.');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

const decodeName = (bytes: Uint8Array, platform: number, offset: number, length: number) => {
  if (offset + length > bytes.length) return '';
  if (platform === 0 || platform === 3) {
    const chars: number[] = [];
    for (let index = 0; index + 1 < length; index += 2)
      chars.push((bytes[offset + index] << 8) | bytes[offset + index + 1]);
    return String.fromCharCode(...chars)
      .replace(/\0/g, '')
      .trim();
  }
  return Array.from(bytes.subarray(offset, offset + length), (value) => String.fromCharCode(value))
    .join('')
    .replace(/\0/g, '')
    .trim();
};

const parseFont = (bytes: Uint8Array): ParsedFont => {
  if (bytes.length < 12) throw new Error('Font file is too small.');
  const signature = String.fromCharCode(...bytes.subarray(0, 4));
  if (signature !== '\u0000\u0001\u0000\u0000' && signature !== 'OTTO')
    throw new Error('Only TrueType and OpenType fonts can be embedded in PPTX.');

  const tableCount = readU16(bytes, 4);
  if (tableCount === 0 || 12 + tableCount * 16 > bytes.length)
    throw new Error('Invalid OpenType table directory.');
  const tables = new Map<string, FontTable>();
  for (let index = 0; index < tableCount; index++) {
    const record = 12 + index * 16;
    const tag = String.fromCharCode(...bytes.subarray(record, record + 4));
    const offset = readU32(bytes, record + 8);
    const length = readU32(bytes, record + 12);
    if (offset + length > bytes.length) throw new Error(`Invalid ${tag} font table.`);
    tables.set(tag, { offset, length });
  }
  const tableBytes = (tag: string) => {
    const table = tables.get(tag);
    return table ? bytes.subarray(table.offset, table.offset + table.length) : undefined;
  };

  const os2 = tableBytes('OS/2');
  const fsType = os2 && os2.length >= 10 ? readU16(os2, 8) : 0;
  const weight = os2 && os2.length >= 6 ? readU16(os2, 4) : 400;
  const selection = os2 && os2.length >= 64 ? readU16(os2, 62) : 0;
  const panose = new Uint8Array(10);
  if (os2 && os2.length >= 42) panose.set(os2.subarray(32, 42));
  const unicodeRanges = [0, 1, 2, 3].map((index) =>
    os2 && os2.length >= 58 + index * 4 ? readU32(os2, 42 + index * 4) : 0,
  );
  const codePageRanges = [0, 1].map((index) =>
    os2 && os2.length >= 86 + index * 4 ? readU32(os2, 78 + index * 4) : 0,
  );
  const head = tableBytes('head');
  const name = tableBytes('name');
  const names = new Map<number, Array<{ value: string; english: boolean; unicode: boolean }>>();
  if (name && name.length >= 6) {
    const count = readU16(name, 2);
    const storageOffset = readU16(name, 4);
    for (let index = 0; index < count; index++) {
      const record = 6 + index * 12;
      if (record + 12 > name.length) break;
      const platform = readU16(name, record);
      const language = readU16(name, record + 4);
      const id = readU16(name, record + 6);
      const length = readU16(name, record + 8);
      const offset = storageOffset + readU16(name, record + 10);
      const value = decodeName(name, platform, offset, length);
      if (!value) continue;
      const current = names.get(id) || [];
      current.push({
        value,
        english: language === 0x0409 || language === 0,
        unicode: platform === 0 || platform === 3,
      });
      names.set(id, current);
    }
  }
  const getName = (id: number, fallback: string) => {
    const choices = names.get(id) || [];
    return (
      choices.find((item) => item.english && item.unicode)?.value ||
      choices.find((item) => item.unicode)?.value ||
      choices.find((item) => item.english)?.value ||
      choices[0]?.value ||
      fallback
    );
  };

  return {
    bytes,
    family: getName(1, 'Embedded Font'),
    style: getName(2, 'Regular'),
    fullName: getName(4, 'Embedded Font'),
    version: getName(5, 'Version 1.0'),
    fsType,
    weight,
    italic: Boolean(selection & 1),
    panose,
    unicodeRanges,
    codePageRanges,
    checkSumAdjustment: head && head.length >= 12 ? readU32(head, 8) : 0,
  };
};

const embeddingReason = (font: ParsedFont): PptFontEmbeddingResult['reason'] => {
  if (font.fsType & 0x0002) return 'license';
  if (font.fsType & 0x0200) return 'bitmapOnly';
  if (font.fsType & 0x0004 && !(font.fsType & 0x0008)) return 'readOnly';
  return undefined;
};

export const inspectPptFontEmbedding = (fonts: RenderCustomFont[]): PptFontEmbeddingResult[] =>
  fonts.map((font) => {
    if (font.format !== 'truetype' && font.format !== 'opentype')
      return { font, embedded: false, reason: 'format' };
    try {
      const parsed = parseFont(decodeFontDataUrl(font.dataUrl));
      const reason = embeddingReason(parsed);
      return reason ? { font, embedded: false, reason } : { font, embedded: true };
    } catch {
      return { font, embedded: false, reason: 'invalid' };
    }
  });

const xmlEscape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const toUtf16Le = (value: string) => {
  const bytes = new Uint8Array(value.length * 2);
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    bytes[index * 2] = code & 0xff;
    bytes[index * 2 + 1] = code >>> 8;
  }
  return bytes;
};

const createEot = (font: ParsedFont) => {
  const chunks: Uint8Array[] = [];
  let bodyLength = 0;
  const push = (chunk: Uint8Array) => {
    chunks.push(chunk);
    bodyLength += chunk.length;
  };
  const u16 = (value: number) => {
    const bytes = new Uint8Array(2);
    new DataView(bytes.buffer).setUint16(0, value, true);
    return bytes;
  };
  const u32 = (value: number) => {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
    return bytes;
  };
  const names = [font.family, font.style, font.version, font.fullName].map(toUtf16Le);
  const namesBytes = names.reduce((total, name) => total + name.length, 0) + 38;
  const headerLength = 82;
  const totalLength = headerLength + namesBytes + font.bytes.length;
  push(u32(totalLength)); // EOTSize
  push(u32(font.bytes.length)); // FontDataSize
  push(u32(0x00020002)); // Version 2.0.2
  push(u32(0)); // Raw, uncompressed SFNT data
  push(font.panose);
  push(new Uint8Array([1, font.italic ? 1 : 0]));
  push(u32(font.weight));
  push(u16(font.fsType));
  push(u16(0x504c));
  font.unicodeRanges.forEach((value) => push(u32(value)));
  font.codePageRanges.forEach((value) => push(u32(value)));
  push(u32(font.checkSumAdjustment));
  for (let index = 0; index < 4; index++) push(u32(0));
  push(u16(0)); // Padding1
  names.forEach((name, index) => {
    push(u16(name.length));
    push(name);
    if (index < names.length - 1) push(u16(0)); // Padding1-4
  });
  push(u16(0)); // Padding5
  push(u16(0)); // Empty RootString
  push(u32(0x50475342)); // Checksum of empty RootString
  push(u32(0)); // EUDCCodePage
  push(u16(0)); // Padding6
  push(u16(0)); // SignatureSize
  push(u32(0)); // EUDCFlags
  push(u32(0)); // EUDCFontSize
  push(font.bytes);
  const result = new Uint8Array(bodyLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    result.set(chunk, offset);
    offset += chunk.length;
  });
  if (bodyLength !== totalLength || headerLength + namesBytes !== bodyLength - font.bytes.length)
    throw new Error('Invalid EOT font header length.');
  return result;
};

const nextRelationshipId = (relationships: string) => {
  const ids = [...relationships.matchAll(/\bId="rId(\d+)"/g)].map((match) => Number(match[1]));
  return Math.max(0, ...ids) + 1;
};

const isFontUsed = async (archive: JSZip, family: string) => {
  const escapedFamily = xmlEscape(family);
  const xmlFiles = Object.values(archive.files).filter(
    (file) => !file.dir && file.name.endsWith('.xml'),
  );
  for (const file of xmlFiles) {
    const xml = await file.async('string');
    if (xml.includes(escapedFamily)) return true;
  }
  return false;
};

export const embedCustomFontsInPptx = async (
  archive: JSZip,
  fonts: RenderCustomFont[] = [],
): Promise<PptFontEmbeddingResult[]> => {
  const results = inspectPptFontEmbedding(fonts);
  const embeddable: Array<{
    parsed: ParsedFont;
    font: RenderCustomFont;
    face: 'regular' | 'bold' | 'italic' | 'boldItalic';
  }> = [];
  const familyFaces = new Map<string, Set<string>>();
  for (const result of results) {
    if (!result.embedded) continue;
    const parsed = parseFont(decodeFontDataUrl(result.font.dataUrl));
    if (!(await isFontUsed(archive, result.font.family))) {
      result.embedded = false;
      continue;
    }
    const bold = parsed.weight >= 600;
    const face = parsed.italic ? (bold ? 'boldItalic' : 'italic') : bold ? 'bold' : 'regular';
    const faces = familyFaces.get(parsed.family) || new Set<string>();
    if (faces.has(face)) {
      result.embedded = false;
      result.reason = 'duplicateFace';
      continue;
    }
    faces.add(face);
    familyFaces.set(parsed.family, faces);
    embeddable.push({ parsed, font: result.font, face });
  }
  if (!embeddable.length) return results;

  const presentationPath = 'ppt/presentation.xml';
  const relationshipsPath = 'ppt/_rels/presentation.xml.rels';
  let presentation = await archive.file(presentationPath)?.async('string');
  let relationships = await archive.file(relationshipsPath)?.async('string');
  let contentTypes = await archive.file('[Content_Types].xml')?.async('string');
  if (!presentation || !relationships || !contentTypes)
    throw new Error('PPTX export is missing font embedding package parts.');

  const initialRelationshipId = nextRelationshipId(relationships);
  const relationshipEntries: string[] = [];
  const fontEntriesByFamily = new Map<string, string[]>();
  embeddable.forEach(({ parsed, face }, index) => {
    const relationshipId = `rId${initialRelationshipId + index}`;
    const partName = `font${index + 1}.fntdata`;
    const partPath = `${FONT_PART_DIRECTORY}/${partName}`;
    archive.file(partPath, createEot(parsed));
    const faces = fontEntriesByFamily.get(parsed.family) || [];
    faces.push(`<p:${face} r:id="${relationshipId}"/>`);
    fontEntriesByFamily.set(parsed.family, faces);
    relationshipEntries.push(
      `<Relationship Id="${relationshipId}" Type="${FONT_RELATIONSHIP}" Target="fonts/${partName}"/>`,
    );
  });
  const embeddedFontEntries = [...fontEntriesByFamily.entries()]
    .map(
      ([family, faces]) =>
        `<p:embeddedFont><p:font typeface="${xmlEscape(family)}" pitchFamily="34" charset="0"/>${faces.join('')}</p:embeddedFont>`,
    )
    .join('');
  relationships = relationships.replace(
    '</Relationships>',
    `${relationshipEntries.join('')}</Relationships>`,
  );
  if (!/<Default\s+Extension="fntdata"/i.test(contentTypes))
    contentTypes = contentTypes.replace(
      '</Types>',
      `<Default Extension="fntdata" ContentType="${FONT_CONTENT_TYPE}"/></Types>`,
    );
  presentation = presentation.replace(
    /<p:presentation\b/,
    '<p:presentation embedTrueTypeFonts="1" saveSubsetFonts="0"',
  );
  const fontList = `<p:embeddedFontLst>${embeddedFontEntries}</p:embeddedFontLst>`;
  if (presentation.includes('<p:embeddedFontLst'))
    presentation = presentation.replace(
      /<p:embeddedFontLst\b[\s\S]*?<\/p:embeddedFontLst>/,
      fontList,
    );
  else if (presentation.includes('</p:notesSz>'))
    presentation = presentation.replace('</p:notesSz>', `</p:notesSz>${fontList}`);
  else if (presentation.includes('<p:defaultTextStyle'))
    presentation = presentation.replace('<p:defaultTextStyle', `${fontList}<p:defaultTextStyle`);
  else throw new Error('PPTX presentation has no valid embedded-font insertion point.');

  archive.file(presentationPath, presentation);
  archive.file(relationshipsPath, relationships);
  archive.file('[Content_Types].xml', contentTypes);
  const xmlFiles = Object.values(archive.files).filter(
    (file) => !file.dir && file.name.endsWith('.xml') && !file.name.endsWith('.rels'),
  );
  for (const { font, parsed } of embeddable) {
    const alias = xmlEscape(font.family);
    const family = xmlEscape(parsed.family);
    if (alias === family) continue;
    for (const file of xmlFiles) {
      const xml = await file.async('string');
      if (xml.includes(`typeface="${alias}"`))
        archive.file(file.name, xml.replaceAll(`typeface="${alias}"`, `typeface="${family}"`));
    }
  }
  return results;
};

export const createEotFontForTest = (dataUrl: string) =>
  createEot(parseFont(decodeFontDataUrl(dataUrl)));

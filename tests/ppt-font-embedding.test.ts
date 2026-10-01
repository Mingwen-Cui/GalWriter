import assert from 'node:assert/strict';
import { test } from 'node:test';

import JSZip from 'jszip';

import {
  createEotFontForTest,
  embedCustomFontsInPptx,
  inspectPptFontEmbedding,
} from '../src/components/render/ppt/pptFontEmbedding';
import type { RenderCustomFont } from '../src/components/render/video/shared/types';

const writeU16 = (view: DataView, offset: number, value: number) =>
  view.setUint16(offset, value, false);
const writeU32 = (view: DataView, offset: number, value: number) =>
  view.setUint32(offset, value, false);

const createMinimalTtf = (fsType = 0) => {
  const fontNames = [
    [1, 'Embedding Test'],
    [2, 'Regular'],
    [4, 'Embedding Test Regular'],
    [5, 'Version 1.0'],
  ] as const;
  const nameStrings = fontNames.map(([, value]) =>
    Uint8Array.from(value, (character) => character.charCodeAt(0)).reduce<number[]>(
      (bytes, character) => bytes.concat([0, character]),
      [],
    ),
  );
  const nameDataLength = nameStrings.reduce((total, value) => total + value.length, 0);
  const nameLength = 6 + fontNames.length * 12 + nameDataLength;
  const os2Length = 86;
  const headLength = 12;
  const directoryLength = 12 + 3 * 16;
  const totalLength = directoryLength + os2Length + headLength + nameLength;
  const bytes = new Uint8Array(totalLength);
  const view = new DataView(bytes.buffer);
  writeU32(view, 0, 0x00010000);
  writeU16(view, 4, 3);

  const tables = [
    { tag: 'OS/2', offset: directoryLength, length: os2Length },
    { tag: 'head', offset: directoryLength + os2Length, length: headLength },
    {
      tag: 'name',
      offset: directoryLength + os2Length + headLength,
      length: nameLength,
    },
  ];
  tables.forEach((table, index) => {
    const record = 12 + index * 16;
    for (let character = 0; character < 4; character++)
      bytes[record + character] = table.tag.charCodeAt(character);
    writeU32(view, record + 8, table.offset);
    writeU32(view, record + 12, table.length);
  });

  const os2Offset = tables[0].offset;
  writeU16(view, os2Offset + 4, 400);
  writeU16(view, os2Offset + 8, fsType);
  writeU16(view, os2Offset + 62, 0);
  writeU32(view, tables[1].offset + 8, 0x12345678);

  const nameOffset = tables[2].offset;
  writeU16(view, nameOffset, 0);
  writeU16(view, nameOffset + 2, fontNames.length);
  writeU16(view, nameOffset + 4, 6 + fontNames.length * 12);
  let stringOffset = 0;
  fontNames.forEach(([nameId], index) => {
    const record = nameOffset + 6 + index * 12;
    writeU16(view, record, 3); // Windows Unicode
    writeU16(view, record + 2, 1);
    writeU16(view, record + 4, 0x0409);
    writeU16(view, record + 6, nameId);
    writeU16(view, record + 8, nameStrings[index].length);
    writeU16(view, record + 10, stringOffset);
    bytes.set(nameStrings[index], nameOffset + 6 + fontNames.length * 12 + stringOffset);
    stringOffset += nameStrings[index].length;
  });
  return bytes;
};

const makeFont = (bytes: Uint8Array): RenderCustomFont => ({
  id: 'font-1',
  label: 'Embedding Test',
  family: 'GalWriter Custom Test',
  format: 'truetype',
  dataUrl: `data:font/ttf;base64,${Buffer.from(bytes).toString('base64')}`,
});

test('builds an EOT part around a TrueType font without changing its bytes', () => {
  const source = createMinimalTtf();
  const eot = createEotFontForTest(makeFont(source).dataUrl);
  const view = new DataView(eot.buffer);
  assert.equal(view.getUint32(0, true), eot.length);
  assert.equal(view.getUint32(4, true), source.length);
  assert.equal(view.getUint32(8, true), 0x00020002);
  assert.equal(view.getUint32(12, true), 0);
  assert.equal(view.getUint16(32, true), 0);
  assert.equal(view.getUint16(34, true), 0x504c);
  assert.deepEqual(eot.slice(-source.length), source);
});

test('embeds permitted fonts in the PPTX font part graph', async () => {
  const font = makeFont(createMinimalTtf());
  const zip = new JSZip();
  zip.file(
    'ppt/presentation.xml',
    '<p:presentation xmlns:p="p" xmlns:r="r"><p:notesSz cx="1" cy="1"/><p:defaultTextStyle/></p:presentation>',
  );
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    '<Relationships><Relationship Id="rId1" Type="slide" Target="slides/slide1.xml"/></Relationships>',
  );
  zip.file('[Content_Types].xml', '<Types></Types>');
  zip.file('ppt/slides/slide1.xml', `<p:sld><a:rPr typeface="${font.family}"/></p:sld>`);

  const results = await embedCustomFontsInPptx(zip, [font]);
  assert.equal(results[0].embedded, true);
  const presentation = await zip.file('ppt/presentation.xml')!.async('string');
  const relationships = await zip.file('ppt/_rels/presentation.xml.rels')!.async('string');
  const contentTypes = await zip.file('[Content_Types].xml')!.async('string');
  const fontPart = await zip.file('ppt/fonts/font1.fntdata')!.async('uint8array');

  assert.match(presentation, /embedTrueTypeFonts="1"/);
  assert.match(presentation, /saveSubsetFonts="0"/);
  assert.match(presentation, /<p:embeddedFontLst>/);
  assert.match(presentation, /typeface="Embedding Test"/);
  assert.match(relationships, /relationships\/font/);
  assert.match(relationships, /Target="fonts\/font1\.fntdata"/);
  assert.match(contentTypes, /Extension="fntdata" ContentType="application\/x-fontdata"/);
  const slide = await zip.file('ppt/slides/slide1.xml')!.async('string');
  assert.match(slide, /typeface="Embedding Test"/);
  assert.equal(new DataView(fontPart.buffer).getUint32(0, true), fontPart.length);
});

test('does not embed fonts whose OS/2 flags disallow embedding', () => {
  const font = makeFont(createMinimalTtf(0x0002));
  assert.deepEqual(
    inspectPptFontEmbedding([font]).map((item) => item.reason),
    ['license'],
  );
});

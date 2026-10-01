import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';

import type { PptObjectAnimation } from '../src/components/render/video/shared/types';
import {
  orderPptAnimationTargets,
  type PptAnimationExportTarget,
} from '../src/components/render/ppt/pptxCompatibility';
import { reorderPptSlides } from '../src/components/render/ppt/pptSlideOrder';

const animation = (id: string): PptObjectAnimation =>
  ({
    id,
    target: 'character',
    phase: 'enter',
    effect: 'fade',
    start: 'withPrevious',
  }) as PptObjectAnimation;

test('character and its nameplate effects stay adjacent in the PowerPoint sequence', () => {
  const entrance = animation('character-enter');
  const dialogue = { ...animation('dialogue'), target: 'dialog-body' } as PptObjectAnimation;
  const targets: PptAnimationExportTarget[] = [
    { slideNumber: 1, objectName: 'ppt-character-scene-actor', animation: entrance },
    { slideNumber: 1, objectName: 'ppt-dialog-body-scene', animation: dialogue },
    { slideNumber: 1, objectName: 'ppt-nameplate-scene-actor', animation: entrance },
    { slideNumber: 1, objectName: 'ppt-nameplate-scene-actor-text', animation: entrance },
  ];

  const ordered = orderPptAnimationTargets(
    targets,
    new Map([
      [
        1,
        new Map([
          ['character-enter', 0],
          ['dialogue', 1],
        ]),
      ],
    ]),
  );

  assert.deepEqual(
    ordered.map((target) => target.objectName),
    [
      'ppt-character-scene-actor',
      'ppt-nameplate-scene-actor',
      'ppt-nameplate-scene-actor-text',
      'ppt-dialog-body-scene',
    ],
  );
});

test('saved slide order physically reorders PPT slides and refreshes their slide numbers', () => {
  const sceneA = { id: 'scene-a', _slideNum: 1 };
  const choiceA = { id: 'choice:scene-a', _slideNum: 2 };
  const sceneB = { id: 'scene-b', _slideNum: 3 };
  const slides = [sceneA, choiceA, sceneB];

  reorderPptSlides(slides, new Map(slides.map((slide) => [slide.id, slide])), [
    'scene-a',
    'scene-b',
    'choice:scene-a',
  ]);

  assert.deepEqual(
    slides.map((slide) => slide.id),
    ['scene-a', 'scene-b', 'choice:scene-a'],
  );
  assert.deepEqual(
    slides.map((slide) => slide._slideNum),
    [1, 2, 3],
  );
});

test('interactive branch hyperlinks still target the correct slide after reordering', async () => {
  const PptxConstructor =
    (PptxGenJS as unknown as { default?: typeof PptxGenJS }).default || PptxGenJS;
  const pptx = new PptxConstructor();
  pptx.layout = 'LAYOUT_WIDE';
  const sceneA = pptx.addSlide();
  sceneA.addText('Scene A');
  const choice = pptx.addSlide();
  choice.addText('Go to Scene B', { hyperlink: { slide: 2 } });
  const sceneB = pptx.addSlide();
  sceneB.addText('Scene B');

  const pptxSlides = (pptx as unknown as { slides: Array<PptxGenJS.Slide & { _slideNum: number }> })
    .slides;
  reorderPptSlides(
    pptxSlides,
    new Map([
      ['scene-a', sceneA],
      ['choice:scene-a', choice],
      ['scene-b', sceneB],
    ]) as Map<string, PptxGenJS.Slide & { _slideNum: number }>,
    ['scene-a', 'scene-b', 'choice:scene-a'],
  );

  const buffer = (await pptx.write({ outputType: 'arraybuffer' })) as ArrayBuffer;
  const archive = await JSZip.loadAsync(buffer);
  const orderedTargetSlide = await archive.file('ppt/slides/slide2.xml')?.async('string');
  const reorderedChoiceRels = await archive
    .file('ppt/slides/_rels/slide3.xml.rels')
    ?.async('string');

  assert.match(orderedTargetSlide || '', /Scene B/);
  assert.match(reorderedChoiceRels || '', /Target="slide2\.xml"/);
});

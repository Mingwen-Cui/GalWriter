import JSZip from 'jszip';
import type { Edge, Node } from '@xyflow/react';

import { DEFAULT_RENDER_STYLE } from '../src/components/render/video/VideoRenderModal/workspaceStorage';
import { materializeAssets } from '../src/components/render/code/codeExport/assets/materializeAssets';
import { renderVideoCoverPngBytes } from '../src/components/render/video/export/videoCover';
import { DEFAULT_VIDEO_COVER } from '../src/components/render/video/export/videoCover';
import { preflightVideoExportImages } from '../src/components/render/video/export/videoExportPreflight';
import { renderVideoToBuffer } from '../src/components/render/video/export/browserVideoEncoder';
import { buildPptxBuffer } from '../src/components/render/ppt/pptExport';
import {
  createInteractiveSegmentStructurePngBytes,
  selectExportedInteractiveSegmentStructure,
} from '../src/components/render/video/interactive/InteractiveSegmentExportOrder';
import {
  buildSegmentLayout,
  graphBoundsFromPositions,
} from '../src/components/render/video/interactive/interactiveSegmentGraphLayout';
import type {
  PptExportSettings,
  PptSlideBackgroundStyle,
  WebExportSettings,
} from '../src/components/render/video/shared/types';
import { buildInteractiveWebZipBlob } from '../src/components/render/web/webExport';

const result = document.querySelector<HTMLPreElement>('#results')!;
const storyNode = (patch: Record<string, unknown> = {}, id = 'scene-a'): Node => ({
  id,
  type: 'storyNode',
  position: { x: 0, y: 0 },
  data: { title: 'Scene A', text: '<p>Regression scene</p>', isRoot: true, ...patch },
});
const webSettings = {
  canvasWidth: 1920,
  canvasHeight: 1080,
  sceneBackgroundColor: '#102030',
} as WebExportSettings;
const pptSettings = (backgroundStyle?: PptSlideBackgroundStyle): PptExportSettings => ({
  layout: 'LAYOUT_WIDE',
  branchMode: 'interactive',
  density: 'oneNodePerSlide',
  includeCover: false,
  includeNotes: false,
  slideBackgroundStyles: backgroundStyle ? { 'scene-a': backgroundStyle } : {},
});
const edges: Edge[] = [];
const checks: { name: string; passed: boolean; detail: string }[] = [];

const check = async (name: string, run: () => Promise<string>) => {
  try {
    checks.push({ name, passed: true, detail: await run() });
  } catch (error) {
    checks.push({
      name,
      passed: false,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
  result.textContent = checks
    .map(({ name: label, passed, detail }) => `${passed ? 'PASS' : 'FAIL'} ${label}\n  ${detail}`)
    .join('\n');
};

await check('web package contains runnable entry points', async () => {
  const blob = await buildInteractiveWebZipBlob([], [], { language: 'en' });
  const zip = await JSZip.loadAsync(blob);
  if (!zip.file('index.html') || !zip.file('content.js') || !zip.file('start-preview.cmd')) {
    throw new Error('Web ZIP is missing index.html, content.js, or its preview launcher.');
  }
  return 'ZIP includes the player, content bundle, and local preview launcher.';
});

await check('web package reports an unreadable image', async () => {
  try {
    await buildInteractiveWebZipBlob(
      [storyNode({ imageUrl: '/__export-regression-missing__/background.png' })],
      edges,
      { language: 'en' },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('asset(s) could not be read') || !message.includes('background')) {
      throw new Error(`The image failure was not identified clearly: ${message}`);
    }
    return message;
  }
  throw new Error('Export unexpectedly succeeded with a missing image.');
});

await check('web package reports an unreadable audio track', async () => {
  try {
    await buildInteractiveWebZipBlob(
      [storyNode({ audioUrl: '/__export-regression-missing__/music.mp3' })],
      edges,
      { language: 'en' },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('asset(s) could not be read') || !message.includes('audio')) {
      throw new Error(`The audio failure was not identified clearly: ${message}`);
    }
    return message;
  }
  throw new Error('Export unexpectedly succeeded with a missing audio track.');
});

await check('web package reports an unreadable video clip', async () => {
  try {
    await buildInteractiveWebZipBlob(
      [storyNode({ videoUrl: '/__export-regression-missing__/scene.mp4' })],
      edges,
      { language: 'en' },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('asset(s) could not be read') || !message.includes('video')) {
      throw new Error(`The video failure was not identified clearly: ${message}`);
    }
    return message;
  }
  throw new Error('Export unexpectedly succeeded with a missing video clip.');
});

await check('code package reports an unreadable image payload', async () => {
  try {
    await materializeAssets(
      new JSZip(),
      [
        {
          id: 'missing-image',
          source: '/__export-regression-missing__/sprite.png',
          sourceNodeIds: ['scene-a'],
          path: 'images/sprite.png',
          kind: 'image',
          extension: 'png',
          compatibility: 'compatible',
          referenced: true,
        },
      ],
      [{ assetPath: 'images/sprite.png', targetPath: 'game/images/sprite.png' }],
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('could not be packaged') || !message.includes('text/html')) {
      throw new Error(`The code-export asset failure was not identified clearly: ${message}`);
    }
    return message;
  }
  throw new Error('Code package unexpectedly accepted a missing image.');
});

await check('PPT export embeds a gradient background in the slide', async () => {
  const backgroundStyle: PptSlideBackgroundStyle = {
    type: 'gradient',
    color: '#0f172a',
    gradientStart: '#f97316',
    gradientEnd: '#4338ca',
    gradientAngle: 35,
    gradientShape: 'linear',
  };
  const buffer = await buildPptxBuffer({
    nodes: [storyNode()],
    edges,
    projectName: 'Export Regression',
    settings: webSettings,
    style: DEFAULT_RENDER_STYLE,
    pptSettings: pptSettings(backgroundStyle),
    language: 'en',
  });
  const zip = await JSZip.loadAsync(buffer);
  const images = Object.keys(zip.files).filter((path) => /^ppt\/media\/.*\.png$/i.test(path));
  if (images.length === 0) throw new Error('The PPT ZIP contains no rendered gradient image.');
  const slide = await zip.file('ppt/slides/slide1.xml')?.async('string');
  if (!slide?.includes('<p:pic>'))
    throw new Error('The generated scene slide does not reference an image.');
  return `Generated ${images.length} PNG image(s); the scene slide contains the gradient image.`;
});

await check('PPT branch choice buttons retain their gradient fill', async () => {
  const choice = DEFAULT_RENDER_STYLE.renderObjects!.choice;
  const style = {
    ...DEFAULT_RENDER_STYLE,
    renderObjects: {
      ...DEFAULT_RENDER_STYLE.renderObjects!,
      choice: {
        ...choice,
        fill: {
          ...choice.fill,
          type: 'gradient' as const,
          gradientType: 'linear' as const,
          gradientAngle: 45,
          gradientStops: [
            { id: 'start', color: '#f97316', alpha: 100, position: 0 },
            { id: 'end', color: '#4338ca', alpha: 100, position: 100 },
          ],
        },
      },
    },
  };
  const nodes = [
    storyNode(),
    storyNode({ title: 'Scene B', isRoot: false }, 'scene-b'),
    storyNode({ title: 'Scene C', isRoot: false }, 'scene-c'),
  ];
  const branchEdges: Edge[] = [
    { id: 'choice-b', source: 'scene-a', target: 'scene-b', label: 'Route B' },
    { id: 'choice-c', source: 'scene-a', target: 'scene-c', label: 'Route C' },
  ];
  const buffer = await buildPptxBuffer({
    nodes,
    edges: branchEdges,
    projectName: 'Branch Gradient Regression',
    settings: webSettings,
    style,
    pptSettings: pptSettings(),
    language: 'en',
  });
  const zip = await JSZip.loadAsync(buffer);
  const media = Object.keys(zip.files).filter((path) => /^ppt\/media\/.*\.png$/i.test(path));
  if (media.length < 2) throw new Error('Gradient choice fills were not rasterized into the PPT.');
  return `Generated ${media.length} PNG image(s) for the branched deck.`;
});

await check('PPT export reports an unreadable scene image', async () => {
  try {
    await buildPptxBuffer({
      nodes: [storyNode({ imageUrl: '/__export-regression-missing__/scene.png' })],
      edges,
      projectName: 'Export Regression',
      settings: webSettings,
      style: DEFAULT_RENDER_STYLE,
      pptSettings: pptSettings(),
      language: 'en',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('asset(s) could not be read') || !message.includes('background')) {
      throw new Error(`The image failure was not identified clearly: ${message}`);
    }
    return message;
  }
  throw new Error('Export unexpectedly succeeded with a missing image.');
});

await check('video export preflight reports an unreadable scene image', async () => {
  try {
    await preflightVideoExportImages(
      [storyNode({ imageUrl: '/__export-regression-missing__/video-scene.png' })],
      [storyNode({ imageUrl: '/__export-regression-missing__/video-scene.png' })],
      DEFAULT_RENDER_STYLE,
      undefined,
      'en',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('asset(s) could not be read') || !message.includes('scene background')) {
      throw new Error(`The video image failure was not identified clearly: ${message}`);
    }
    return message;
  }
  throw new Error('Video preflight unexpectedly accepted a missing image.');
});

await check('browser route map omits unavailable clips and exports a PNG', async () => {
  const segments = [
    {
      id: 'start',
      name: 'Start',
      enabled: true,
      source: 'edited' as const,
      nodeIds: ['scene-a'],
      choices: [
        { id: 'to-disabled', label: 'Disabled', targetSegmentId: 'disabled', targetNodeId: 'b' },
        { id: 'to-next', label: 'Next', targetSegmentId: 'next', targetNodeId: 'c' },
      ],
    },
    {
      id: 'disabled',
      name: 'Disabled',
      enabled: false,
      source: 'edited' as const,
      nodeIds: ['scene-b'],
      choices: [],
    },
    {
      id: 'next',
      name: 'Next',
      enabled: true,
      source: 'edited' as const,
      nodeIds: ['scene-c'],
      choices: [],
    },
  ];
  const structure = selectExportedInteractiveSegmentStructure(
    segments,
    ['start', 'disabled', 'next'],
    ['start', 'next'],
  );
  if (structure.segments.some((segment) => segment.id === 'disabled')) {
    throw new Error('Disabled segment leaked into the route map.');
  }
  if (structure.graphLinks.length !== 1 || structure.graphLinks[0].toSegmentId !== 'next') {
    throw new Error('Route map contains an edge to a segment that was not exported.');
  }
  const positions = buildSegmentLayout(structure.segments, 'right', 280, 222);
  const bounds = graphBoundsFromPositions(positions, 280, 222);
  const png = await createInteractiveSegmentStructurePngBytes({
    ...structure,
    renderPositions: positions,
    cardWidth: 280,
    cardHeight: 222,
    graphWidth: bounds.maxX + 120,
    graphHeight: bounds.maxY + 120,
    layoutDirection: 'right',
  });
  if (png[0] !== 137 || png[1] !== 80 || png[2] !== 78 || png[3] !== 71) {
    throw new Error('The route map did not render as a PNG.');
  }
  return `${structure.segments.length} exported clips, ${structure.graphLinks.length} valid route(s), ${png.length} PNG bytes.`;
});

await check('video cover image failure is surfaced to the exporter', async () => {
  try {
    await renderVideoCoverPngBytes({
      settings: {
        ...DEFAULT_VIDEO_COVER,
        sourceType: 'image',
        imageUrl: '/__export-regression-missing__/cover.png',
      },
      nodes: [],
      width: 320,
      height: 180,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('Selected cover image could not be loaded')) throw error;
    return message;
  }
  throw new Error('Cover export unexpectedly succeeded with a missing image.');
});

await check('video cover gradient produces a valid PNG', async () => {
  const bytes = await renderVideoCoverPngBytes({
    settings: { ...DEFAULT_VIDEO_COVER, sourceType: 'gradient', title: 'Cover regression' },
    nodes: [],
    width: 320,
    height: 180,
  });
  if (bytes[0] !== 137 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71) {
    throw new Error('The generated cover does not have a PNG signature.');
  }
  return `${bytes.byteLength} PNG bytes generated.`;
});

await check('browser video encoder produces a complete MP4 buffer', async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 180;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('The browser did not provide a 2D canvas context.');
  const bytes = await renderVideoToBuffer({
    canvas,
    format: 'mp4',
    frameRate: 2,
    totalFrames: 3,
    drawFrame: async (frame) => {
      context.fillStyle = frame % 2 === 0 ? '#f97316' : '#4338ca';
      context.fillRect(0, 0, canvas.width, canvas.height);
    },
  });
  const signature = String.fromCharCode(...bytes.slice(4, 8));
  if (signature !== 'ftyp' || bytes.length < 256) {
    throw new Error(
      `The browser encoder returned an incomplete MP4 (${signature}, ${bytes.length} bytes).`,
    );
  }
  return `${bytes.length} MP4 bytes generated with three encoded frames.`;
});

const failures = checks.filter(({ passed }) => !passed);
document.body.dataset.result = failures.length === 0 ? 'passed' : 'failed';
result.textContent += `\n\n${checks.length - failures.length}/${checks.length} browser checks passed.`;

// Keep a failing fixture visible in automated browser runs and the devtools console.
if (failures.length > 0)
  throw new Error(`${failures.length} browser export regression check(s) failed.`);

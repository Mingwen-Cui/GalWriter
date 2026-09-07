import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';
import { normalizeSharedCanvasSettings, updateSharedCanvasSettings } from '../src/components/render/canvas/canvasSettings';
import { canvasRatio, migrateVideoCanvasSettings, resizeCanvas } from '../src/components/render/canvas/canvasDimensions';
import { getSceneBackgroundStyle } from '../src/components/render/canvas/sceneCanvasStyle';
import { applyStylePatch } from '../src/components/render/shared/inspectors/styleState';
import { DEFAULT_RENDER_STYLE } from '../src/components/render/video/VideoRenderModal/workspaceStorage';
import { getRenderObjects, updateRenderObject } from '../src/components/render/video/shared/renderObjects';
import { parseColorValue } from '../src/components/render/shared/paint/colorValue';
import { normalizeGameInterface, resolveGameInterface } from '../src/components/render/code/design/gameInterface';
import { buildCodeProjectPreview, buildCodeProjectZip } from '../src/components/render/code/codeExport/exportProject';
import type { CodeExportTarget } from '../src/components/render/code/codeExport/targets/targetTypes';

const nodes = [{id:'root',type:'storyNode',position:{x:0,y:0},data:{title:'Start',content:'Hello',text:'Hello',isStart:true}}];
const design = normalizeGameInterface({width:1600,height:900,panelX:10,panelY:60,panelWidth:80,panelHeight:30,panelColor:'#123456',panelAlpha:50,fontSize:32,textColor:'#ffeedd',nameColor:'#abcdef',accentColor:'#654321',textSpeed:60});

test('locked size edits preserve the aspect ratio and update both dimensions', () => {
  const value = normalizeSharedCanvasSettings();
  assert.deepEqual(resizeCanvas(value,'canvasWidth',1280),{canvasWidth:1280,canvasHeight:720,canvasRatioWidth:16,canvasRatioHeight:9});
  assert.deepEqual(resizeCanvas(value,'canvasHeight',720),{canvasWidth:1280,canvasHeight:720,canvasRatioWidth:16,canvasRatioHeight:9});
  assert.deepEqual(resizeCanvas(value,'canvasWidth',NaN),{});
});
test('unlocked dimensions and custom ratios remain internally consistent', () => {
  const next = resizeCanvas(normalizeSharedCanvasSettings({canvasRatioLocked:false}),'canvasWidth',1080);
  assert.equal(next.canvasHeight,1080); assert.equal(next.canvasRatioWidth,1);
  const ratio = canvasRatio(1366,768); assert.ok(Math.abs(ratio.canvasRatioWidth/ratio.canvasRatioHeight - 1366/768)<0.001);
});
test('legacy video resolution wins over web canvas; new canvas survives reloading', () => {
  const migrated = migrateVideoCanvasSettings({webSettings:{canvasWidth:900,canvasHeight:1600},resolutionWidth:1280,resolutionHeight:720});
  assert.equal(migrated.canvasWidth,1280); assert.equal(migrated.canvasHeight,720);
  const persisted = JSON.parse(JSON.stringify({videoCanvasSettings:{...migrated,canvasRatioLocked:false}}));
  assert.equal(migrateVideoCanvasSettings(persisted).canvasRatioLocked,false);
});
test('visibility settings are normalized without forcing enabled values', () => {
  const value = normalizeSharedCanvasSettings({hideCharacterTags:false,hideSceneTags:false});
  assert.equal(value.hideCharacterTags,false); assert.equal(value.hideSceneTags,false);
});
test('one object patch updates all compatibility fields without mutating the input', () => {
  const previous = structuredClone(DEFAULT_RENDER_STYLE);
  const objects = updateRenderObject(previous,'dialogBox',{width:72,fill:{...getRenderObjects(previous).dialogBox.fill,color:'#123456',alpha:45}});
  const next = applyStylePatch(previous,'renderObjects',objects);
  assert.equal(next.panelColor,'#123456');assert.equal(next.panelColorAlpha,45);assert.equal(next.dialogWidth,72);
  assert.equal(getRenderObjects(next).dialogBox.fill.color,'#123456');assert.equal(previous.panelColor,'#111827');
});
test('scene preview preserves stop positions and alpha', () => {
  const style = getSceneBackgroundStyle(normalizeSharedCanvasSettings({sceneBackgroundType:'gradient',sceneBackgroundGradientAngle:90,sceneBackgroundGradientStops:[{id:'a',color:'#ff0000',alpha:0,position:10},{id:'b',color:'#0000ff',alpha:50,position:90}]}));
  assert.match(String(style.background),/10%/); assert.match(String(style.background),/90%/);
});
test('color parsing keeps color and opacity as separate values', () => {
  assert.deepEqual(parseColorValue('#12345680'),{hex:'#123456',alpha:50});
  assert.deepEqual(parseColorValue('#abc'),{hex:'#aabbcc',alpha:100});
});
test('game engine profiles do not leak into other engines', () => {
  const profiles={dialogic:design}; assert.equal(resolveGameInterface(profiles,'dialogic').fontSize,32);
  assert.equal(resolveGameInterface(profiles,'renpy').fontSize,24);
  const restored=JSON.parse(JSON.stringify(profiles));assert.equal(resolveGameInterface(restored,'dialogic').panelColor,'#123456');
});
for (const target of ['renpy','tyrano','dialogic'] as CodeExportTarget[]) {
  test(`${target}: generated files consume the chosen design`, () => {
    const preview = buildCodeProjectPreview(nodes,[],'Inspector QA',{interfaceDesigns:{[target]:design}},target);
    assert.equal(preview.settings.interfaceDesigns?.[target]?.fontSize,32);
    const find=(name:string)=>preview.files.find(file=>file.path===name)?.content || '';
    if(target==='renpy'){assert.match(find('game/galwriter_interface.rpy'),/screen say\(who, what\)/);assert.match(find('game/galwriter_interface.rpy'),/size 32/);assert.match(find('game/galwriter_interface.rpy'),/#12345680/);}
    if(target==='tyrano'){assert.match(find('data/scenario/first.ks'),/\[deffont size="32"/);assert.match(find('data/scenario/first.ks'),/color="0x123456"/);}
    if(target==='dialogic'){assert.match(find('project.godot'),/viewport_width=1600/);assert.match(find('game/GalWriter.gd'),/Vector2\(1600, 900\)/);assert.match(find('game/GalWriter.gd'),/theme.default_font_size = 32/);assert.match(find('game/GalWriter.gd'),/#12345680/);}
  });
}
test('real ZIP contains the same interface file as the source preview', async () => {
  const {blob,preview} = await buildCodeProjectZip(nodes,[],'Inspector QA',{interfaceDesigns:{renpy:design}},'renpy');
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const actual = await zip.file('game/galwriter_interface.rpy')?.async('string');
  assert.equal(actual,preview.files.find(file=>file.path==='game/galwriter_interface.rpy')?.content);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { WebHistoryGesture } from '../src/components/render/web/webHistoryGesture';
import { combineWebSelection, webMarqueeHits, webSelectionMode } from '../src/components/render/web/webCanvasSelection';
import { buildSettingsPageElements, resolveSettingsPageElements } from '../src/components/render/web/webMenuPageElements';
import { buttonMotionForPreset, resolveWebButtonMotionPreset } from '../src/components/render/web/webButtonMotion';

test('one drag records its starting position or value, and the next drag is independent', () => {
  for (const initial of [{ x: 8, y: 52 }, { value: 30 }]) {
    const history = new WebHistoryGesture<typeof initial>();
    history.begin(initial);
    assert.equal(history.record({ ...initial }), initial);
    for (let i = 0; i < 100; i++) assert.equal(history.record({ ...initial }), null);
    history.end();
    const second = { ...initial };
    history.begin(second);
    assert.equal(history.record(second), second);
    history.end();
    assert.equal(history.record(initial), initial);
  }
});

test('clicking without changing creates no record, and undo during a drag cancels further updates', () => {
  const history = new WebHistoryGesture<number>();
  history.begin(30);
  history.end();
  history.begin(40);
  assert.equal(history.record(41), 40);
  history.cancel();
  assert.equal(history.cancelled, true);
  assert.equal(history.record(42), null);
  history.end();
  assert.equal(history.cancelled, false);
});

test('shift adds and ctrl subtracts for clicks and marquee without duplicating IDs', () => {
  assert.deepEqual(combineWebSelection(['a', 'b'], ['b', 'c'], 'add'), ['a', 'b', 'c']);
  assert.deepEqual(combineWebSelection(['a', 'b', 'c'], ['b', 'd'], 'remove'), ['a', 'c']);
  assert.deepEqual(combineWebSelection(['a'], [], 'add'), ['a']);
  assert.deepEqual(combineWebSelection(['a'], [], 'replace'), []);
  assert.equal(webSelectionMode({ shiftKey: true, ctrlKey: false, metaKey: false }), 'add');
  assert.equal(webSelectionMode({ shiftKey: false, ctrlKey: true, metaKey: false }), 'remove');
  const box = { x: 55, y: 45, width: 39, height: 54 };
  assert.equal(webMarqueeHits({ id: 'settings-background', x: 5, y: 5, width: 90, height: 94 }, box), false);
  assert.equal(webMarqueeHits({ id: 'settings-auto', x: 56, y: 52, width: 30, height: 10 }, box), true);
});

test('saved settings adopt compact controls and no motion once, preserving subsequent authored changes', () => {
  const defaults = buildSettingsPageElements('zh', '#625bf6', '#fff');
  const saved = defaults.map((element) => ({ ...element, settingsLayoutVersion: 6,
    ...(element.role === 'sound' ? { width: 36, x: 51, buttonMotion: buttonMotionForPreset('strong') } : {}),
  }));
  const migrated = resolveSettingsPageElements({ settingsPageElements: saved, settingsPageElementsInitialized: true }, 'zh', '#625bf6', '#fff');
  const sound = migrated.find((element) => element.role === 'sound')!;
  assert.equal(sound.width, 26);
  assert.equal(sound.x, 38);
  assert.equal(resolveWebButtonMotionPreset(sound.buttonMotion), 'none');
  for (const element of migrated.filter((element) => element.kind === 'button' && !['back', 'reset'].includes(element.role || ''))) {
    assert.equal(resolveWebButtonMotionPreset(element.buttonMotion), 'none');
    if (!['preview', 'reset', 'back'].includes(element.role || '')) assert.equal(element.width, defaults.find((item) => item.id === element.id)!.width);
  }
  assert.equal(migrated.find((element) => element.role === 'reset')!.y, 92);
  assert.equal(migrated.find((element) => element.role === 'back')!.x, 84);
  const edited = migrated.map((element) => element.role === 'sound' ? { ...element, width: 27, buttonMotion: buttonMotionForPreset('soft') } : element);
  assert.equal(resolveSettingsPageElements({ settingsPageElements: edited, settingsPageElementsInitialized: true }, 'zh', '#625bf6', '#fff'), edited);
});

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getImmediatelySettledInlineActions,
} from '../src/lib/inlinePresentationPlayback';
import {
  createCharacterPresentation,
  createScenePresentation,
  getPresentationContentWindow,
  getPresentationEnterDuration,
  getPresentationExitDuration,
  getPresentationMotionDuration,
  updatePresentationMotionType,
} from '../src/lib/presentation';

test('choosing an effect from a disabled motion supplies a playable duration', () => {
  assert.deepEqual(
    updatePresentationMotionType(createCharacterPresentation('actor').enter, 'fade'),
    {
      type: 'fade',
      duration: 500,
    },
  );
  assert.equal(
    updatePresentationMotionType({ type: 'fade', duration: 1400 }, 'zoom').duration,
    1400,
  );
});

test('legacy zero/invalid motion durations play, while none stays disabled', () => {
  for (const duration of [0, -100, NaN, Infinity]) {
    assert.equal(getPresentationMotionDuration({ type: 'slide-left', duration }), 500);
  }
  assert.equal(getPresentationMotionDuration({ type: 'none', duration: 1000 }), 0);
  assert.equal(getPresentationMotionDuration(undefined), 0);
});

test('immediate playback does not pre-settle exit timeline cues', () => {
  const enter = {
    id: 'enter',
    kind: 'character' as const,
    sourceNodeId: 'actor',
    action: 'none' as const,
    duration: 500,
    strength: 10,
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    timelinePhase: 'enter' as const,
  };
  const exit = { ...enter, id: 'exit', timelinePhase: 'exit' as const };
  assert.deepEqual(
    getImmediatelySettledInlineActions([enter, exit]).map((action) => action.id),
    ['enter'],
  );
});

test('content waits for the scene and every character and ends before exits', () => {
  const presentation = {
    scene: {
      ...createScenePresentation('scene'),
      enter: { type: 'fade' as const, duration: 600 },
      exit: { type: 'fade' as const, duration: 700 },
    },
    characters: [
      {
        ...createCharacterPresentation('a'),
        enter: { type: 'fade' as const, duration: 400 },
        exit: { type: 'fade' as const, duration: 300 },
      },
      {
        ...createCharacterPresentation('b'),
        enter: { type: 'zoom' as const, duration: 900 },
        exit: { type: 'zoom' as const, duration: 800 },
      },
    ],
  };
  assert.equal(getPresentationEnterDuration(presentation), 1500);
  assert.equal(getPresentationExitDuration(presentation), 1500);
  assert.deepEqual(getPresentationContentWindow(presentation, 8), {
    start: 1.5,
    end: 6.5,
    duration: 5,
  });
  assert.equal(getPresentationContentWindow(presentation, 1).duration, 0);
});

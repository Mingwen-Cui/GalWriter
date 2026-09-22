import assert from 'node:assert/strict';
import test from 'node:test';

import type { AssistantTask } from '../src/domain/project';
import {
  checkpointCreativeMessages,
  selectCreativeChoice,
} from '../src/editor-features/assistant/creativeChoiceHistory';

function fixture(): AssistantTask {
  const session = {
    id: 'session',
    status: 'setup' as const,
    chapter: 1,
    turns: [],
    chapterSummaries: [],
    createdAt: 1,
    updatedAt: 1,
  };
  return {
    id: 'task',
    title: 'Setup',
    createdAt: 1,
    updatedAt: 1,
    creativeSession: session,
    messages: [
      {
        id: 'genre',
        role: 'assistant',
        content: 'Genre?',
        creativeCheckpoint: {
          session: structuredClone(session),
          workflow: { type: 'creative-genre-awaiting' },
        },
        options: ['romance', 'mystery'].map((id) => ({
          id,
          label: id,
          value: `__creative_genre__:${id}`,
        })),
      },
    ],
  };
}

test('repeated selection is a no-op and leaves subsequent answers intact', () => {
  const first = selectCreativeChoice(fixture(), 'genre', '__creative_genre__:romance')!;
  first.task.messages.push({ id: 'next', role: 'assistant', content: 'Role?' });
  assert.equal(selectCreativeChoice(first.task, 'genre', '__creative_genre__:romance'), null);
  assert.equal(first.task.messages.length, 2);
  assert.equal(first.task.messages[0].options?.filter((option) => option.selected).length, 1);
});

test('changing an earlier answer removes only dependent messages and restores its session', () => {
  const first = selectCreativeChoice(fixture(), 'genre', '__creative_genre__:romance')!;
  first.task.creativeSession!.direction = {
    genreId: 'romance',
    genre: 'Romance',
    rolePreference: 'Detective',
  };
  first.task.messages.push({ id: 'old-answer', role: 'user', content: 'Detective' });
  const next = selectCreativeChoice(first.task, 'genre', '__creative_genre__:mystery')!;
  assert.deepEqual(
    next.task.messages.map((message) => message.id),
    ['genre'],
  );
  assert.equal(next.task.creativeSession?.direction, undefined);
  assert.equal(next.workflow.type, 'creative-genre-awaiting');
  assert.deepEqual(
    next.task.messages[0].options?.map((option) => option.selected),
    [false, true],
  );
  assert.equal(first.task.messages.length, 2, 'previous history stays immutable for undo');
});

test('role checkpoints survive serialization and do not retain later trait answers', () => {
  const task = fixture();
  task.creativeSession!.direction = { genreId: 'mystery', genre: 'Mystery' };
  const messages = checkpointCreativeMessages(
    [
      {
        id: 'role',
        role: 'assistant',
        content: 'Role?',
        options: [{ id: 'custom', label: 'Custom', value: '__creative_role_preference_custom__' }],
      },
    ],
    [],
    task,
    { type: 'creative-role-preference-awaiting', sessionId: 'session' },
  );
  task.messages.push(...messages);
  task.creativeSession!.direction.roleTraits = { initiative: 5 };
  const restored = JSON.parse(JSON.stringify(task)) as AssistantTask;
  const choice = selectCreativeChoice(restored, 'role', '__creative_role_preference_custom__')!;
  assert.equal(choice.workflow.type, 'creative-role-preference-awaiting');
  assert.deepEqual(choice.task.creativeSession?.direction, {
    genreId: 'mystery',
    genre: 'Mystery',
  });
});

test('old saved genre prompts can still be revised; stale or unknown options are ignored', () => {
  const task = fixture();
  delete task.messages[0].creativeCheckpoint;
  assert.ok(selectCreativeChoice(task, 'genre', '__creative_genre__:mystery'));
  assert.equal(selectCreativeChoice(task, 'removed-message', '__creative_genre__:mystery'), null);
  assert.equal(selectCreativeChoice(task, 'genre', '__creative_genre__:unknown'), null);
});

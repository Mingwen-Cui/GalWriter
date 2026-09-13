import assert from 'node:assert/strict';
import test from 'node:test';
import type { AssistantTask, CreativeStorySource } from '../src/domain/project';
import { createCreativeStorySessionHandlers } from '../src/editor-features/assistant/creativeStorySession';

const source: CreativeStorySource = {
  toolNodeId: 'plot-tool',
  title: '山中寺庙',
  storyNodes: [
    { id: 'first', type: 'storyNode', title: '开始', text: '从前有座山。' },
    { id: 'last', type: 'storyNode', title: '对话', text: '小和尚问师父山外有什么。' },
    { id: 'setting', type: 'sceneNode', title: '寺庙', text: '山中的古寺。' },
  ],
};

function fixture(
  initialTasks: AssistantTask[] = [],
  overrides: Partial<Parameters<typeof createCreativeStorySessionHandlers>[0]> = {},
) {
  const tasksRef = { current: initialTasks };
  const activeTaskIdRef = { current: '' };
  const continuationGenerationRef = { current: 0 };
  let opened = 0;
  const handlers = () =>
    createCreativeStorySessionHandlers({
      activeTask: tasksRef.current.find((task) => task.id === activeTaskIdRef.current),
      tasks: tasksRef.current,
      tasksRef,
      activeTaskIdRef,
      setTasks: (value) => {
        tasksRef.current = typeof value === 'function' ? value(tasksRef.current) : value;
      },
      setActiveTaskId: (value) => {
        activeTaskIdRef.current =
          typeof value === 'function' ? value(activeTaskIdRef.current) : value;
      },
      setMessages: () => {},
      setLoading: () => {},
      workflowRef: { current: { type: 'idle' } },
      continuationGenerationRef,
      language: 'zh',
      hasTextApiKey: false,
      onOpenCreativePlaytest: () => {
        opened += 1;
      },
      callAIForTextResult: async () => {
        throw new Error('Entry must not generate a replacement story');
      },
      createAssistantCards: async () => {
        throw new Error('Entry must reuse existing cards');
      },
      ...overrides,
    });
  return { handlers, tasksRef, activeTaskIdRef, opened: () => opened };
}

test('enter existing story directly at its last story card, retaining earlier context', async () => {
  const f = fixture();
  await f.handlers().start(source);
  const session = f.tasksRef.current[0].creativeSession!;
  assert.equal(f.opened(), 1);
  assert.equal(session.status, 'playing');
  assert.equal(session.turns[0].nodeId, 'last');
  assert.equal(session.turns[0].story, source.storyNodes[1].text);
  assert.match(session.chapterSummaries[0], /从前有座山/);
  assert.match(session.chapterSummaries[0], /山中的古寺/);
});

test('re-entering the same tool resumes its session and clears an interrupted decision', async () => {
  const f = fixture();
  await f.handlers().start(source);
  const task = f.tasksRef.current[0];
  task.creativeSession!.status = 'paused';
  task.creativeSession!.pendingDecision = '旧请求';
  await f.handlers().start(source);
  assert.equal(f.tasksRef.current.length, 1);
  assert.equal(f.activeTaskIdRef.current, task.id);
  assert.equal(f.tasksRef.current[0].creativeSession!.pendingDecision, undefined);
  assert.equal(f.opened(), 2);
});

test('another plot tool does not resume an unrelated creative story', async () => {
  const f = fixture();
  await f.handlers().start(source);
  const oldSession = f.tasksRef.current[0].creativeSession!.id;
  await f.handlers().start({ ...source, toolNodeId: 'another-tool' });
  assert.equal(f.tasksRef.current.length, 2);
  assert.notEqual(f.tasksRef.current[0].creativeSession!.id, oldSession);
});

test('settings without a story do not open the playtest', async () => {
  const f = fixture();
  await f.handlers().start({ ...source, storyNodes: source.storyNodes.slice(2) });
  assert.equal(f.opened(), 0);
  assert.equal(f.tasksRef.current.length, 0);
});

for (const decision of ['继续', '去山门看看']) {
  test(`creative continuation keeps scene/story IDs aligned for ${decision}`, async () => {
    let placed: Parameters<
      Parameters<typeof createCreativeStorySessionHandlers>[0]['createAssistantCards']
    >[0] = [];
    let direct = false;
    const f = fixture([], {
      hasTextApiKey: true,
      callAIForTextResult: async () => ({
        content: JSON.stringify({
          reply: '他们走到山门前。',
          question: '',
          options: [],
          sceneName: '山门',
          cards: [{ type: 'story', title: '山门前', text: '他们走到山门前。' }],
        }),
      }),
      createAssistantCards: async (cards, _mode, options) => {
        placed = cards;
        direct = options?.skipAnimation === true;
        return { count: cards.length, nodeIds: cards.map((_card, index) => `new-${index}`) };
      },
    });
    await f.handlers().start({ ...source, scene: { nodeId: 'temple', name: '寺庙' } });
    await f.handlers().decide(decision);
    assert.equal(direct, true);
    assert.equal(placed[0].type, 'scene');
    const storyCards = placed.filter((card) => card.type === 'story');
    assert.ok(storyCards.every((card) => card.text?.trim()));
    assert.equal(storyCards.length, decision === '继续' ? 1 : 2);
    assert.equal(
      f.tasksRef.current[0].creativeSession!.turns.at(-1)!.nodeId,
      `new-${placed.length - 1}`,
    );
  });
}

test('continuing in the same scene reuses its setting and fallback text appears only once', async () => {
  let placed: Parameters<
    Parameters<typeof createCreativeStorySessionHandlers>[0]['createAssistantCards']
  >[0] = [];
  const f = fixture([], {
    hasTextApiKey: true,
    callAIForTextResult: async () => {
      throw new Error('Simulated unavailable AI');
    },
    createAssistantCards: async (cards) => {
      placed = cards;
      return { count: cards.length, nodeIds: ['next'] };
    },
  });
  await f.handlers().start({ ...source, scene: { nodeId: 'temple', name: '寺庙' } });
  await f.handlers().decide('继续');
  assert.equal(placed.length, 1);
  assert.equal(placed[0].type, 'story');
  assert.ok(placed[0].text?.trim());
});

test('prefetch prepares at most three routes without placing cards, then reuses the chosen route', async () => {
  let requests = 0;
  let placements = 0;
  let anchor: string | undefined;
  const f = fixture([], {
    hasTextApiKey: true,
    callAIForTextResult: async (prompt) => {
      requests += 1;
      assert.match(prompt, /约 9 张剧情卡/);
      return {
        content: JSON.stringify({
          reply: '走出山门。',
          question: '',
          options: [],
          cards: [
            { title: '山门外', text: '走出山门。' },
            { title: '山道', text: '山道向远处延伸。' },
          ],
        }),
      };
    },
    createAssistantCards: async (cards, _mode, options) => {
      placements += 1;
      anchor = options?.targetNodeIds?.[0];
      return { count: cards.length, nodeIds: cards.map((_card, index) => 'placed-' + index) };
    },
  });
  await f.handlers().start({ ...source, choiceInterval: 9, prefetchCount: 3 });
  const turn = f.tasksRef.current[0].creativeSession!.turns[0];
  turn.options = ['上山', '下山', '留下', '去别处'];
  turn.question = '前往哪里？';
  turn.endNodeId = 'last-page';
  await f.handlers().prefetch();
  await f.handlers().prefetch();
  assert.equal(requests, 3);
  assert.equal(placements, 0);
  await f.handlers().decide('下山');
  assert.equal(requests, 3);
  assert.equal(placements, 1);
  assert.equal(anchor, 'last-page');
  // New scene, question, decision, and two narrative cards.
  assert.equal(f.tasksRef.current[0].creativeSession!.turns.at(-1)?.nodeId, 'placed-3');
  assert.equal(f.tasksRef.current[0].creativeSession!.turns.at(-1)?.endNodeId, 'placed-4');
});

test('narrative-only turns prefetch one continuation and respect a changed pacing setting', async () => {
  let requests = 0;
  const f = fixture([], {
    hasTextApiKey: true,
    callAIForTextResult: async () => {
      requests += 1;
      return { content: JSON.stringify({ reply: '夜色渐深。', cards: [{ text: '夜色渐深。' }] }) };
    },
  });
  await f.handlers().start({ ...source, prefetchCount: 3 });
  await f.handlers().prefetch();
  assert.equal(requests, 1);
  f.tasksRef.current[0].creativeSession!.choiceInterval = 8;
  await f.handlers().prefetch();
  assert.equal(requests, 2);
});

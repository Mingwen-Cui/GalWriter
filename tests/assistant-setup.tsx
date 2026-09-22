import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useAssistantPanel } from '../src/editor-features/assistant/useAssistantPanel';
import { DialogProvider } from '../src/editor-shell/DialogProvider';

const settle = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
const noop = () => {};

function Fixture() {
  const [report, setReport] = useState('Ready');
  const opened = useRef(false);
  const cardCount = useRef(0);
  const assistant = useAssistantPanel({
    language: 'zh',
    isMobile: false,
    flowWidth: 1200,
    nodes: [],
    selectedAssistantTargetNodes: [],
    // Intentionally invalid model output exercises the existing local fallback without network calls.
    callAIForTextResult: async () => ({ content: '{}' }),
    createAssistantCards: async (cards) => ({
      count: cards.length,
      nodeIds: cards.map(() => `fixture-${++cardCount.current}`),
    }),
    hasTextApiKey: true,
    assistantMemorySkillEnabled: false,
    assistantMemoryNotes: [],
    setAssistantMemoryNotes: noop,
    settingLibraryContext: '',
    savedSettingLibraryItems: [],
    presetSettingLibraryItems: [],
    onOpenCreativePlaytest: () => {
      opened.current = true;
    },
  });
  const current = useRef(assistant);
  current.current = assistant;
  const run = async () => {
    const passed: string[] = [];
    const check = (condition: boolean, label: string) => {
      if (!condition) throw Error(label);
      passed.push(`PASS ${label}`);
    };
    const choose = async (messageId: string, value: string) => {
      await current.current.handleAssistantOptionSelect(value, messageId);
      await settle();
    };
    const last = () => current.current.assistantMessages.at(-1)!;
    try {
      await current.current.handleStartCreativeStory();
      await settle();
      const genre = last();
      const romance = genre.options![0].value;
      await Promise.all([
        current.current.handleAssistantOptionSelect(romance, genre.id),
        current.current.handleAssistantOptionSelect(romance, genre.id),
      ]);
      await settle();
      check(
        current.current.assistantMessages.length === 2,
        'rapid repeated choice advances only once',
      );
      const role = last();
      await choose(role.id, '__creative_role_preference_custom__');
      check(Boolean(last().inputPrompt), 'custom role produces an editable prompt');
      await current.current.handleAssistantSend('一位隐瞒身份的图书管理员');
      await settle();
      check(
        !current.current.assistantLoading && Boolean(last().characterTraitControls),
        'custom text advances and releases loading state',
      );
      await choose(genre.id, genre.options![1].value);
      check(
        current.current.assistantMessages.length === 2 &&
          !current.current.creativeStorySession?.direction?.rolePreference,
        'genre revision removes dependent messages and role state',
      );
      await choose(last().id, last().options![0].value);
      await choose(last().id, '__creative_traits__:3,3,3,3');
      const player = last();
      check(
        Boolean(player.options?.[0].value.startsWith('__creative_player__:')),
        'trait confirmation generates player options',
      );
      await choose(player.id, player.options![0].value);
      await choose(player.id, player.options![1].value);
      check(
        last().options?.length === player.options!.length - 1 &&
          !current.current.creativeStorySession?.lead,
        'revising player regenerates one lead choice step',
      );
      await choose(last().id, last().options![0].value);
      check(last().options?.[0].value === '__creative_enter__', 'lead choice reaches story entry');
      await choose(last().id, '__creative_enter__');
      check(
        opened.current && current.current.creativeStorySession?.status === 'playing',
        'enter story remains actionable',
      );
      setReport(passed.join('\n'));
    } catch (error) {
      setReport([...passed, `FAIL ${String(error)}`].join('\n'));
    }
  };
  return (
    <>
      <button onClick={() => void run()}>运行助手引导回归</button>
      <pre data-testid="report">{report}</pre>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <DialogProvider language="zh">
    <Fixture />
  </DialogProvider>,
);

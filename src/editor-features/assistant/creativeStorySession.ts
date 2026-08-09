import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { v4 as uuidv4 } from 'uuid';

import type {
  AssistantCardDraft,
  AssistantCardPlacementMode,
  AssistantCardPlacementOptions,
} from '../../agent/planning/agentCardDraft';
import type {
  AssistantMessage,
  AssistantTask,
  CreativeStorySession,
} from '../../editor-state/editorConfig';
import { assistantPanelCopy } from '../../editor-shell/i18n/assistant';
import type { Language } from '../../lib/i18n';
import {
  extractFirstJsonObject,
  getAssistantDraftType,
  normalizeAssistantStoryDraftText,
  type AssistantCardPlacementResult,
  type AssistantWorkflowState,
} from './assistantPanelHelpers';

type CreativeStorySessionParams = {
  activeTask: AssistantTask | undefined;
  tasks: AssistantTask[];
  tasksRef: MutableRefObject<AssistantTask[]>;
  activeTaskIdRef: MutableRefObject<string>;
  setTasks: Dispatch<SetStateAction<AssistantTask[]>>;
  setActiveTaskId: Dispatch<SetStateAction<string>>;
  setMessages: Dispatch<SetStateAction<AssistantMessage[]>>;
  setLoading: Dispatch<SetStateAction<boolean>>;
  workflowRef: MutableRefObject<AssistantWorkflowState>;
  continuationGenerationRef: MutableRefObject<number>;
  language: Language;
  hasTextApiKey: boolean;
  onMissingTextApiKeyRequest?: () => void;
  onOpenCreativePlaytest?: () => void;
  callAIForTextResult: (prompt: string) => Promise<{ content: string }>;
  createAssistantCards: (
    cards: AssistantCardDraft[],
    mode?: AssistantCardPlacementMode,
    options?: AssistantCardPlacementOptions,
  ) => Promise<AssistantCardPlacementResult>;
};

type CreativeStoryGenre = {
  id: string;
  label: string;
  description: string;
};

type CreativeStoryOpening = {
  id: string;
  label: string;
  description: string;
};

const normalizeCharacterCards = (content: string): AssistantCardDraft[] => {
  try {
    const parsed = JSON.parse(extractFirstJsonObject(content)) as {
      cards?: unknown[];
      characters?: unknown[];
      roles?: unknown[];
      data?: { cards?: unknown[]; characters?: unknown[]; roles?: unknown[] };
    };
    const rawCards =
      parsed.cards ||
      parsed.characters ||
      parsed.roles ||
      parsed.data?.cards ||
      parsed.data?.characters ||
      parsed.data?.roles ||
      [];
    return rawCards
      .filter((card): card is Record<string, unknown> => Boolean(card) && typeof card === 'object')
      .map((card) => ({
        ...card,
        type: 'character' as const,
        characterName: String(card.characterName || card.name || card.title || '').trim(),
        identity: String(card.identity || card.role || card.occupation || '').trim(),
        appearance: String(card.appearance || card.look || '').trim(),
        personality: String(card.personality || card.traits || '').trim(),
        habits: String(card.habits || '').trim(),
        speechStyle: String(card.speechStyle || card.speech || '').trim(),
        experience: String(card.experience || card.backstory || '').trim(),
        relationships: String(card.relationships || card.relationship || '').trim(),
        notes: String(card.notes || card.description || '').trim(),
      }))
      .filter((card) => Boolean(card.characterName));
  } catch {
    return [];
  }
};

const buildFallbackCharacterCards = (session: CreativeStorySession): AssistantCardDraft[] => {
  const genre = session.direction?.genre || '这个故事';
  const rolePreference = session.direction?.rolePreference || '有故事的人';
  return [
    {
      type: 'character',
      characterName: '林见星',
      identity: rolePreference,
      appearance: '干净利落，却总像在观察周围。',
      personality: '克制、敏锐，愿意为重要的人冒险。',
      habits: '会把没说出口的话写进随身笔记。',
      experience: `原本只是过着普通生活，却被卷入「${genre}」的故事。`,
      relationships: '与其他人尚未确定，需要由玩家选择。',
      notes: '适合作为玩家主角。',
    },
    {
      type: 'character',
      characterName: '顾遥',
      identity: '看似可靠的同行者',
      appearance: '气质沉静，笑起来让人难以判断真心。',
      personality: '温和、坚定，也擅长隐瞒。',
      habits: '总会在关键时刻提前准备好退路。',
      experience: `比任何人都更早知道「${genre}」背后的秘密。`,
      relationships: '可以成为最重要的伙伴、对手或感情对象。',
      notes: '适合作为主要角色。',
    },
    {
      type: 'character',
      characterName: '周弥',
      identity: '不请自来的知情人',
      appearance: '总是带着不合时宜的从容。',
      personality: '风趣、难以捉摸，却会在危险时出手。',
      habits: '喜欢用玩笑试探别人的底线。',
      experience: '掌握一段会改变所有人关系的过去。',
      relationships: '既可能帮忙，也可能把故事推向失控。',
      notes: '适合作为制造转折的角色。',
    },
    {
      type: 'character',
      characterName: '苏澈',
      identity: '立场不明的关键人物',
      appearance: '冷静克制，目光总停留在细节上。',
      personality: '理性、有原则，不轻易站队。',
      habits: '习惯先问问题，再给出答案。',
      experience: '曾因一次选择失去重要的人，因此不再相信巧合。',
      relationships: '会迫使玩家重新审视自己的选择。',
      notes: '适合作为对照与冲突来源。',
    },
  ];
};

type CreativeStoryOpeningPayload = {
  reply: string;
  question: string;
  options: string[];
  sceneName: string;
  chapterSummary?: string;
  cards: AssistantCardDraft[];
};

const normalizeOpeningPayload = (content: string): CreativeStoryOpeningPayload | null => {
  try {
    const parsed = JSON.parse(extractFirstJsonObject(content)) as {
      reply?: unknown;
      story?: unknown;
      content?: unknown;
      question?: unknown;
      prompt?: unknown;
      sceneName?: unknown;
      scene?: unknown;
      chapterSummary?: unknown;
      options?: unknown[];
      choices?: unknown[];
      cards?: unknown[];
      storyCards?: unknown[];
      data?: { cards?: unknown[]; storyCards?: unknown[] };
    };
    const reply = String(parsed.reply || parsed.story || parsed.content || '').trim();
    const rawCards = parsed.cards || parsed.storyCards || parsed.data?.cards || parsed.data?.storyCards || [];
    const cards = rawCards
      .filter((card): card is Record<string, unknown> => Boolean(card) && typeof card === 'object')
      .map((card) => ({
        ...card,
        type: 'story' as const,
        title: String(card.title || card.name || '').trim(),
        text: normalizeAssistantStoryDraftText(String(card.text || card.content || card.description || '')),
      }))
      .filter((card) => Boolean(card.text));
    const storyCards = cards.length > 0 ? cards.slice(0, 3) : reply ? [{ type: 'story' as const, text: reply }] : [];
    if (storyCards.length === 0) return null;
    const options = (parsed.options || parsed.choices || [])
      .map((option) => (typeof option === 'string' ? option : String((option as { label?: unknown })?.label || '')))
      .map((option) => option.trim())
      .filter(Boolean)
      .slice(0, 3);
    return {
      reply: reply || storyCards.map((card) => card.text || '').join('\n'),
      question: String(parsed.question || parsed.prompt || '接下来你想怎么做？').trim(),
      options,
      sceneName: String(parsed.sceneName || parsed.scene || '').trim(),
      chapterSummary: String(parsed.chapterSummary || '').trim(),
      cards: storyCards,
    };
  } catch {
    return null;
  }
};

const buildFallbackContinuation = (
  session: CreativeStorySession,
  decision: string,
): CreativeStoryOpeningPayload => {
  const player = session.player?.name || '你';
  const lead = session.lead?.name || '对方';
  const previous = session.turns.at(-1);
  const sceneName = previous?.sceneName || session.direction?.genre || session.background?.name || '故事进行中';
  const reply = `${player}做出了选择：「${decision}」。${lead}沉默了片刻，随后给出了一个没有完全说透的回应。空气里的紧张感没有消失，反而让你意识到，这件事比最初想象的更重要。`;
  return {
    reply,
    question: `${lead}在等你决定下一步。你想怎么继续？`,
    options: ['追问刚才没有说清的部分', '先观察周围的变化', '提出自己的条件再继续'],
    sceneName,
    cards: [
      { type: 'story', title: '你的决定', text: `${player}选择了：${decision}` },
      { type: 'story', title: '新的变化', text: reply },
    ],
  };
};

const buildFallbackOpening = (session: CreativeStorySession): CreativeStoryOpeningPayload => {
  const genre = session.direction?.genre || session.background?.name || '这个故事';
  const player = session.player?.name || '你';
  const lead = session.lead?.name || '对方';
  const sceneName = `${genre}的第一夜`;
  const reply = `夜色刚刚落下，${player}在熟悉又陌生的街角停住脚步。${lead}已经在那里等候，手里握着一件与今晚有关、却还不能解释的东西。你们都知道，只要开口，原本平静的生活就会开始改变。`;
  return {
    reply,
    question: `${lead}看向你，像是在等一个答案。你想先怎么做？`,
    options: ['先问清楚发生了什么', '先观察对方隐藏的细节', '带着疑问答应同行'],
    sceneName,
    cards: [
      { type: 'story', title: '第一幕', text: reply },
      {
        type: 'story',
        title: '等待回答',
        text: `${lead}没有催促，只把选择留给了${player}。故事从这一刻真正开始。`,
      },
    ],
  };
};

const getCreativeStoryGenres = (language: Language): CreativeStoryGenre[] => {
  if (language === 'en') {
    return [
      { id: 'romance', label: 'Romance', description: 'Meet someone who changes everything.' },
      { id: 'time-travel', label: 'Time slip', description: 'Return to a moment that should be unreachable.' },
      { id: 'history', label: 'Historical drama', description: 'Be a small person at a turning point in history.' },
      { id: 'mystery', label: 'Mystery', description: 'Everyone is hiding something, and you need the truth.' },
      { id: 'fantasy', label: 'Fantasy adventure', description: 'Magic, other worlds, and an unknown journey.' },
      { id: 'sci-fi', label: 'Near-future sci-fi', description: 'Choose among AI, memory, and a changing city.' },
      { id: 'healing', label: 'Healing & growth', description: 'Repair yourself and a relationship in everyday life.' },
      { id: 'survival', label: 'Survival', description: 'Decide what remains worth protecting in a broken world.' },
    ];
  }
  if (language === 'ja') {
    return [
      { id: 'romance', label: '恋愛', description: 'すべてを変える誰かと出会う。' },
      { id: 'time-travel', label: '時空越え', description: '戻れないはずの瞬間へ向かう。' },
      { id: 'history', label: '歴史ドラマ', description: '時代の転換点にいる小さな人物になる。' },
      { id: 'mystery', label: 'ミステリー', description: '誰もが隠し事をしていて、真実を探す。' },
      { id: 'fantasy', label: 'ファンタジー冒険', description: '魔法、異世界、未知への旅。' },
      { id: 'sci-fi', label: '近未来SF', description: 'AI、記憶、変わる都市の中で選ぶ。' },
      { id: 'healing', label: '癒やしと成長', description: '日常の中で自分と関係を取り戻す。' },
      { id: 'survival', label: '終末サバイバル', description: '壊れた世界で守るものを選ぶ。' },
    ];
  }
  return [
    { id: 'romance', label: '心动恋爱', description: '在靠近与错过之间，遇见改变你的人。' },
    { id: 'time-travel', label: '穿越时空', description: '回到不该回去的时刻，或来到陌生未来。' },
    { id: 'history', label: '历史风云', description: '站在时代转折处，成为改变故事的小人物。' },
    { id: 'mystery', label: '悬疑迷雾', description: '每个人都在隐瞒，而你需要找出真相。' },
    { id: 'fantasy', label: '奇幻冒险', description: '魔法、异世界、契约与未知旅程。' },
    { id: 'sci-fi', label: '近未来科幻', description: 'AI、记忆与赛博城市中的选择。' },
    { id: 'healing', label: '治愈成长', description: '在普通日常里，慢慢修复自己与关系。' },
    { id: 'survival', label: '末日生存', description: '在崩坏世界里，决定要守住什么。' },
  ];
};

const getCreativeStoryRolePreferences = (language: Language): CreativeStoryOpening[] => {
  if (language === 'en') {
    return [
      { id: 'ordinary', label: 'An ordinary person', description: 'A relatable person swept into an unusual story.' },
      { id: 'secret', label: 'Someone with a secret', description: 'The character is hiding a past, motive, or identity.' },
      { id: 'special', label: 'A special identity', description: 'Give the character a rare role, status, or ability.' },
      { id: 'grey', label: 'A conflicted person', description: 'Let them make difficult choices in a grey area.' },
    ];
  }
  if (language === 'ja') {
    return [
      { id: 'ordinary', label: '普通の人', description: '身近な人物が特別な物語に巻き込まれる。' },
      { id: 'secret', label: '秘密を持つ人', description: '過去、動機、正体を隠している。' },
      { id: 'special', label: '特別な身分', description: '珍しい役割、地位、能力を与える。' },
      { id: 'grey', label: '葛藤を抱えた人', description: '簡単に正解を選べない人物にする。' },
    ];
  }
  return [
    { id: 'ordinary', label: '普通但有故事的人', description: '容易代入，却被卷进不普通的故事。' },
    { id: 'secret', label: '藏着秘密的人', description: '角色有不能轻易说出的过去、动机或身份。' },
    { id: 'special', label: '拥有特殊身份的人', description: '给角色一个稀有的职业、地位或能力。' },
    { id: 'grey', label: '有矛盾感的人', description: '让角色面临不容易选对的立场与抉择。' },
  ];
};

const getCreativeStoryOpenings = (
  genreId: string,
  language: Language,
): CreativeStoryOpening[] => {
  const localized = (zh: CreativeStoryOpening[], en: CreativeStoryOpening[], ja: CreativeStoryOpening[]) =>
    language === 'en' ? en : language === 'ja' ? ja : zh;
  if (genreId === 'romance') {
    return localized(
      [
        { id: 'reunion', label: '久别重逢', description: '那个以为不会再见的人，突然出现。' },
        { id: 'forced-together', label: '被迫同行', description: '你们必须一起完成一件事。' },
        { id: 'familiar-stranger', label: '熟悉的陌生人', description: '明明第一次见面，却像早已认识。' },
      ],
      [
        { id: 'reunion', label: 'A reunion', description: 'Someone you never expected to see appears.' },
        { id: 'forced-together', label: 'Forced together', description: 'You have to finish something together.' },
        { id: 'familiar-stranger', label: 'A familiar stranger', description: 'You just met, but it feels like you know them.' },
      ],
      [
        { id: 'reunion', label: '久しぶりの再会', description: 'もう会わないと思っていた人が現れる。' },
        { id: 'forced-together', label: '一緒に行動する', description: '二人で何かを終えなければならない。' },
        { id: 'familiar-stranger', label: '見知らぬ懐かしさ', description: '初対面なのに、昔から知っている気がする。' },
      ],
    );
  }
  if (genreId === 'history') {
    return localized(
      [
        { id: 'secret-letter', label: '一封密信', description: '你收到一封本不该属于你的信。' },
        { id: 'turning-point', label: '关键时刻', description: '你恰好站在会改变时代的一天。' },
        { id: 'hidden-identity', label: '身份暴露', description: '你努力隐藏的过去被人发现。' },
      ],
      [
        { id: 'secret-letter', label: 'A secret letter', description: 'A letter that was never meant for you arrives.' },
        { id: 'turning-point', label: 'A turning point', description: 'You stand inside a day that can change an era.' },
        { id: 'hidden-identity', label: 'Identity exposed', description: 'Someone discovers the past you hid.' },
      ],
      [
        { id: 'secret-letter', label: '一通の密書', description: 'あなた宛てではないはずの手紙が届く。' },
        { id: 'turning-point', label: '時代の分岐点', description: '時代を変える一日の中に立っている。' },
        { id: 'hidden-identity', label: '正体の露見', description: '隠してきた過去を誰かに知られる。' },
      ],
    );
  }
  if (genreId === 'time-travel') {
    return localized(
      [
        { id: 'regret-day', label: '回到遗憾那天', description: '你得到一次改写过去的机会。' },
        { id: 'two-timelines', label: '两条时间线', description: '你与另一个人活在不同的时间里。' },
        { id: 'borrowed-life', label: '借来的身份', description: '醒来后，你成了另一个时代的人。' },
      ],
      [
        { id: 'regret-day', label: 'The day of regret', description: 'You get one chance to rewrite the past.' },
        { id: 'two-timelines', label: 'Two timelines', description: 'You and someone else live in different times.' },
        { id: 'borrowed-life', label: 'A borrowed identity', description: 'You wake up as someone from another era.' },
      ],
      [
        { id: 'regret-day', label: '後悔したあの日', description: '過去を書き換える機会を一度だけ得る。' },
        { id: 'two-timelines', label: '二つの時間線', description: 'あなたと誰かは異なる時間を生きている。' },
        { id: 'borrowed-life', label: '借りた身分', description: '目覚めると別の時代の誰かになっている。' },
      ],
    );
  }
  return localized(
    [
      { id: 'unexpected-visitor', label: '意外来客', description: '一个不该出现的人打破了平静。' },
      { id: 'strange-request', label: '奇怪委托', description: '你收到一个无法轻易拒绝的请求。' },
      { id: 'first-discovery', label: '发现异常', description: '你先发现了这个世界不对劲的地方。' },
    ],
    [
      { id: 'unexpected-visitor', label: 'An unexpected visitor', description: 'Someone who should not be here breaks the calm.' },
      { id: 'strange-request', label: 'A strange request', description: 'You receive a request that is hard to refuse.' },
      { id: 'first-discovery', label: 'The first clue', description: 'You notice the first thing wrong with this world.' },
    ],
    [
      { id: 'unexpected-visitor', label: '思いがけない来客', description: '現れるはずのない人が静けさを壊す。' },
      { id: 'strange-request', label: '奇妙な依頼', description: '簡単には断れない頼みが届く。' },
      { id: 'first-discovery', label: '最初の違和感', description: '世界のどこかがおかしいと最初に気づく。' },
    ],
  );
};

export const createCreativeStorySessionHandlers = ({
  activeTask,
  tasks,
  tasksRef,
  activeTaskIdRef,
  setTasks,
  setActiveTaskId,
  setMessages,
  setLoading,
  workflowRef,
  continuationGenerationRef,
  language,
  hasTextApiKey,
  onMissingTextApiKeyRequest,
  onOpenCreativePlaytest,
  callAIForTextResult,
  createAssistantCards,
}: CreativeStorySessionParams) => {
  const creativeStorySession =
    activeTask?.creativeSession ||
    [...tasks]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .find((task) => task.creativeSession)?.creativeSession ||
    null;
  const creativeCopy = assistantPanelCopy(language).creativeStory;
  const getTask = (sessionId?: string) =>
    tasksRef.current.find(
      (task) => task.creativeSession && (!sessionId || task.creativeSession.id === sessionId),
    ) || null;
  const updateSession = (taskId: string, session: CreativeStorySession) =>
    setTasks((current) => {
      const nextTasks = current.map((task) =>
        task.id === taskId ? { ...task, creativeSession: session, updatedAt: session.updatedAt } : task,
      );
      tasksRef.current = nextTasks;
      return nextTasks;
    });

  const openStoryDoors = async (taskId: string, session: CreativeStorySession) => {
    if (!hasTextApiKey) return onMissingTextApiKeyRequest?.();
    setLoading(true);
    try {
      const direction = session.direction;
      const result = await callAIForTextResult(`你是视觉小说的实时创作导演。作者想先看到可进入的故事门，而不是被要求写完整设定。
题材：${direction?.genre || '由 AI 带领探索'}
角色偏好：${direction?.rolePreference || '由 AI 选择一个有吸引力的角色切入点'}

请生成恰好 3 个彼此明显不同、可以直接开始游玩的故事背景。每个背景都要有具体地点、时间或世界规则、一个立即发生的矛盾；不要写人物设定或后续剧情。只返回 JSON：
{"cards":[{"type":"scene","sceneName":"不超过12字的故事门标题","location":"","time":"","weather":"","visual":"","sound":"","items":"","notes":"不超过45字的沉浸式钩子"}]}`);
      const parsed = JSON.parse(extractFirstJsonObject(result.content)) as { cards?: AssistantCardDraft[] };
      const candidates = (parsed.cards || [])
        .filter((card) => getAssistantDraftType(card) === 'scene')
        .slice(0, 3)
        .map((scene, index) => ({
          id: uuidv4(),
          name: scene.sceneName || scene.title || `故事门 ${index + 1}`,
          description: scene.notes || scene.description || scene.visual || scene.location || '',
          scene,
        }));
      if (candidates.length !== 3) throw new Error('Missing story door candidates');
      workflowRef.current = {
        type: 'creative-background-candidate-awaiting',
        sessionId: session.id,
        candidates,
      };
      setMessages((messages) => [
        ...messages,
        {
          id: uuidv4(),
          role: 'assistant',
          content: creativeCopy.chooseStoryDoor,
          options: [
            ...candidates.map((candidate) => ({
              id: uuidv4(),
              label: candidate.name,
              description: candidate.description,
              value: `__creative_story_door__:${candidate.id}`,
            })),
            { id: uuidv4(), label: creativeCopy.changeDoors, value: '__creative_story_doors_refresh__' },
          ],
        },
      ]);
    } catch {
      setMessages((messages) => [
        ...messages,
        { id: uuidv4(), role: 'assistant', content: creativeCopy.storyDoorFailed },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const chooseGenre = (genreId: string) => {
    const genre = getCreativeStoryGenres(language).find((candidate) => candidate.id === genreId);
    const task = getTask();
    if (!genre || !task?.creativeSession) return;
    const session: CreativeStorySession = {
      ...task.creativeSession,
      direction: { genreId: genre.id, genre: genre.label },
      updatedAt: Date.now(),
    };
    updateSession(task.id, session);
    workflowRef.current = { type: 'creative-role-preference-awaiting', sessionId: session.id };
    setMessages((messages) => [
      ...messages,
      {
        id: uuidv4(),
        role: 'assistant',
        content: creativeCopy.chooseRolePreference,
        options: [
          ...getCreativeStoryRolePreferences(language).map((preference) => ({
            id: uuidv4(),
            label: preference.label,
            description: preference.description,
            value: `__creative_role_preference__:${preference.id}`,
          })),
          { id: uuidv4(), label: creativeCopy.customDirection, value: '__creative_role_preference_custom__' },
        ],
      },
    ]);
  };

  const chooseRolePreference = async (preferenceId: string) => {
    const workflow = workflowRef.current;
    if (workflow.type !== 'creative-role-preference-awaiting') return;
    const preference = getCreativeStoryRolePreferences(language).find(
      (candidate) => candidate.id === preferenceId,
    );
    const task = getTask(workflow.sessionId);
    if (!preference || !task?.creativeSession) return;
    const session: CreativeStorySession = {
      ...task.creativeSession,
      direction: {
        ...(task.creativeSession.direction || { genreId: 'custom', genre: '' }),
        rolePreference: preference.label,
      },
      updatedAt: Date.now(),
    };
    updateSession(task.id, session);
    await beginCharacterSelection(task.id, session);
  };

  const startCustomDirection = () => {
    const task = getTask();
    if (!task?.creativeSession) return;
    workflowRef.current = { type: 'creative-direction-custom-awaiting', sessionId: task.creativeSession.id };
    setMessages((messages) => [
      ...messages,
      { id: uuidv4(), role: 'assistant', content: creativeCopy.directionHint },
    ]);
  };

  const submitCustomDirection = async (description: string) => {
    const workflow = workflowRef.current;
    if (workflow.type !== 'creative-direction-custom-awaiting') return;
    const task = getTask(workflow.sessionId);
    if (!task?.creativeSession) return;
    const session: CreativeStorySession = {
      ...task.creativeSession,
      direction: { genreId: 'custom', genre: description },
      updatedAt: Date.now(),
    };
    updateSession(task.id, session);
    workflowRef.current = { type: 'creative-role-preference-awaiting', sessionId: session.id };
    setMessages((messages) => [
      ...messages,
      {
        id: uuidv4(),
        role: 'assistant',
        content: creativeCopy.chooseRolePreference,
        options: [
          ...getCreativeStoryRolePreferences(language).map((preference) => ({
            id: uuidv4(),
            label: preference.label,
            description: preference.description,
            value: `__creative_role_preference__:${preference.id}`,
          })),
          { id: uuidv4(), label: creativeCopy.customDirection, value: '__creative_role_preference_custom__' },
        ],
      },
    ]);
  };

  const surpriseMe = async () => {
    const task = getTask();
    if (!task?.creativeSession) return;
    const session: CreativeStorySession = {
      ...task.creativeSession,
      direction: { genreId: 'surprise', genre: language === 'zh' ? '由 AI 带领探索' : 'Surprise me' },
      updatedAt: Date.now(),
    };
    updateSession(task.id, session);
    workflowRef.current = { type: 'creative-role-preference-awaiting', sessionId: session.id };
    setMessages((messages) => [
      ...messages,
      {
        id: uuidv4(),
        role: 'assistant',
        content: creativeCopy.chooseRolePreference,
        options: [
          ...getCreativeStoryRolePreferences(language).map((preference) => ({
            id: uuidv4(),
            label: preference.label,
            description: preference.description,
            value: `__creative_role_preference__:${preference.id}`,
          })),
          { id: uuidv4(), label: creativeCopy.customDirection, value: '__creative_role_preference_custom__' },
        ],
      },
    ]);
  };

  const startRolePreferenceCustom = () => {
    const workflow = workflowRef.current;
    if (workflow.type !== 'creative-role-preference-awaiting') return;
    workflowRef.current = {
      type: 'creative-role-preference-custom-awaiting',
      sessionId: workflow.sessionId,
    };
    setMessages((messages) => [
      ...messages,
      { id: uuidv4(), role: 'assistant', content: creativeCopy.rolePreferenceHint },
    ]);
  };

  const submitRolePreference = async (rolePreference: string) => {
    const workflow = workflowRef.current;
    if (workflow.type !== 'creative-role-preference-custom-awaiting') return;
    const task = getTask(workflow.sessionId);
    if (!task?.creativeSession) return;
    const session: CreativeStorySession = {
      ...task.creativeSession,
      direction: {
        ...(task.creativeSession.direction || { genreId: 'custom', genre: '' }),
        rolePreference,
      },
      updatedAt: Date.now(),
    };
    updateSession(task.id, session);
    await beginCharacterSelection(task.id, session);
  };

  const beginCharacterSelection = async (taskId: string, session: CreativeStorySession) => {
    if (!hasTextApiKey) return onMissingTextApiKeyRequest?.();
    setLoading(true);
    try {
      const prompt = `你是视觉小说的实时创作导演。题材是「${
        session.direction?.genre || session.background?.name || '未命名题材'
      }」，作者想扮演的角色类型是「${session.direction?.rolePreference || '由你提供有反差感的候选人'}」。生成恰好 4 位彼此差异明显、适合互动故事的角色；其中至少一位要贴近作者想扮演的类型。只返回 JSON：
{"cards":[{"type":"character","characterName":"","identity":"","appearance":"","personality":"","habits":"","speechStyle":"","experience":"","relationships":"","notes":""}]}
不要返回剧情或场景卡。`;
      let cards: AssistantCardDraft[] = [];
      let usedFallback = false;
      try {
        cards = normalizeCharacterCards((await callAIForTextResult(prompt)).content).slice(0, 4);
        if (cards.length < 2) {
          cards = normalizeCharacterCards(
            (
              await callAIForTextResult(
                `${prompt}\n上一次输出无法读取。请只返回一个 JSON 对象，使用 cards 或 characters 数组，并确保每位角色都有 characterName。`,
              )
            ).content,
          ).slice(0, 4);
        }
      } catch {
        cards = [];
      }
      if (cards.length < 2) {
        cards = buildFallbackCharacterCards(session);
        usedFallback = true;
      }
      const placement = await createAssistantCards(cards, 'append');
      const candidates = cards.map((card, index) => ({
        nodeId: placement.nodeIds?.[index] || uuidv4(),
        name: card.characterName || card.title || `角色 ${index + 1}`,
        imageUrl: card.avatarUrl,
      }));
      workflowRef.current = {
        type: 'creative-player-awaiting',
        sessionId: session.id,
        backgroundNodeId: session.background?.nodeId || '',
        backgroundName: session.background?.name || '',
        candidates,
      };
      setMessages((messages) => [
        ...messages,
        {
          id: uuidv4(),
          role: 'assistant',
          content: usedFallback
            ? `${creativeCopy.characterFallback}\n\n${creativeCopy.choosePlayer}`
            : creativeCopy.choosePlayer,
          cardPosition: placement.position,
          cardNodeIds: placement.nodeIds,
          options: candidates.map((candidate) => ({
            id: uuidv4(),
            label: candidate.name,
            value: `__creative_player__:${candidate.nodeId}`,
          })),
        },
      ]);
    } catch {
      setMessages((messages) => [
        ...messages,
        { id: uuidv4(), role: 'assistant', content: creativeCopy.generatedCharactersFailed },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const chooseStoryDoor = async (doorId: string) => {
    const workflow = workflowRef.current;
    if (workflow.type !== 'creative-background-candidate-awaiting') return;
    const candidate = workflow.candidates.find((item) => item.id === doorId);
    const task = getTask(workflow.sessionId);
    if (!candidate || !task?.creativeSession) return;
    try {
      const placement = await createAssistantCards([candidate.scene], 'append', {
        lockPlacedNodes: true,
      });
      const nodeId = placement.nodeIds?.[0];
      if (!nodeId) throw new Error('Missing scene node');
      const session: CreativeStorySession = {
        ...task.creativeSession,
        background: {
          nodeId,
          name: candidate.name,
          imageUrl: candidate.scene.coverImageUrl,
        },
        updatedAt: Date.now(),
      };
      updateSession(task.id, session);
      await beginCharacterSelection(task.id, session);
    } catch {
      setMessages((messages) => [
        ...messages,
        { id: uuidv4(), role: 'assistant', content: creativeCopy.storyDoorFailed },
      ]);
    }
  };

  const prepareOpening = async (taskId: string, session: CreativeStorySession) => {
    if (!hasTextApiKey) return onMissingTextApiKeyRequest?.();
    setLoading(true);
    try {
      const prompt = `你是视觉小说的实时创作导演。题材是「${
        session.background?.name || session.direction?.genre || ''
      }」，玩家扮演「${session.player?.name || ''}」，主要角色是「${session.lead?.name || ''}」。先演出 2 到 3 个很短的剧情节拍，然后停在一个必须由玩家决定的关键时刻。只返回 JSON：
{"reply":"给玩家看的简短开场","question":"带有情绪和具体分歧的提问","options":["选项一","选项二","选项三"],"sceneName":"当前适合的场景名","cards":[{"type":"story","title":"","text":""}]}
cards 只能是 2 到 3 张 story 卡。每张卡必须自然写到题材和两位角色的名字。`;
      let opening: CreativeStoryOpeningPayload | null = null;
      let usedFallback = false;
      try {
        opening = normalizeOpeningPayload((await callAIForTextResult(prompt)).content);
        if (!opening) {
          opening = normalizeOpeningPayload(
            (
              await callAIForTextResult(
                `${prompt}\n上一次输出无法读取。请只返回一个 JSON 对象，包含 reply、question、options 和 cards；cards 中每一项必须有 text。`,
              )
            ).content,
          );
        }
      } catch {
        opening = null;
      }
      if (!opening) {
        opening = buildFallbackOpening(session);
        usedFallback = true;
      }
      let placement: AssistantCardPlacementResult | undefined;
      try {
        placement = await createAssistantCards(opening.cards, 'append', {
          setFirstStoryAsRoot: true,
        });
      } catch {
        usedFallback = true;
      }
      const now = Date.now();
      updateSession(taskId, {
        ...session,
        status: 'playing',
        turns: [
          {
            id: uuidv4(),
            chapter: session.chapter,
            story: opening.reply,
            question: opening.question,
            options: opening.options.length > 0 ? opening.options : buildFallbackOpening(session).options,
            sceneName: opening.sceneName || session.background?.name || session.direction?.genre,
            nodeId: placement?.nodeIds?.[0],
            createdAt: now,
          },
        ],
        updatedAt: now,
      });
      setMessages((messages) => [
        ...messages,
        {
          id: uuidv4(),
          role: 'assistant',
          content: usedFallback
            ? `${creativeCopy.openingFallback}\n\n${creativeCopy.preparing}`
            : creativeCopy.preparing,
          cardPosition: placement?.position,
          cardNodeIds: placement?.nodeIds,
          options: [{ id: uuidv4(), label: creativeCopy.enter, value: '__creative_enter__' }],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const start = async () => {
    const existing = [...tasksRef.current]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .find((task) => task.creativeSession && task.creativeSession.status !== 'setup');
    if (existing?.creativeSession) {
      activeTaskIdRef.current = existing.id;
      setActiveTaskId(existing.id);
      updateSession(existing.id, {
        ...existing.creativeSession,
        status: 'playing',
        updatedAt: Date.now(),
      });
      onOpenCreativePlaytest?.();
      return;
    }
    const now = Date.now();
    const session: CreativeStorySession = {
      id: uuidv4(), status: 'setup', chapter: 1, turns: [], chapterSummaries: [], createdAt: now, updatedAt: now,
    };
    const task: AssistantTask = {
      id: uuidv4(), title: creativeCopy.taskTitle, createdAt: now, updatedAt: now, kind: 'creative-playtest', creativeSession: session,
      messages: [{
        id: uuidv4(), role: 'assistant', content: creativeCopy.chooseGenre,
        options: [
          ...getCreativeStoryGenres(language).map((genre) => ({
            id: uuidv4(),
            label: genre.label,
            description: genre.description,
            value: `__creative_genre__:${genre.id}`,
          })),
          { id: uuidv4(), label: creativeCopy.surpriseMe, value: '__creative_surprise__' },
          { id: uuidv4(), label: creativeCopy.customDirection, value: '__creative_direction_custom__' },
        ],
      }],
    };
    workflowRef.current = { type: 'creative-genre-awaiting' };
    activeTaskIdRef.current = task.id;
    setTasks((current) => [task, ...current]);
    setActiveTaskId(task.id);
  };

  const decide = async (decision: string) => {
    const task = getTask(creativeStorySession?.id);
    const session = task?.creativeSession;
    const input = decision.trim();
    if (!task || !session || !input || !hasTextApiKey) {
      if (!hasTextApiKey) onMissingTextApiKeyRequest?.();
      return;
    }
    const generation = ++continuationGenerationRef.current;
    updateSession(task.id, { ...session, pendingDecision: input, updatedAt: Date.now() });
    setLoading(true);
    try {
      const previous = session.turns.at(-1);
      const history = session.turns.slice(-7).map((turn) => `演出：${turn.story}\n提问：${turn.question}\n决定：${turn.decision || '未选择'}`).join('\n---\n');
      const summarize = session.turns.length >= 8;
      const prompt = `你是视觉小说的实时创作导演。严格承接故事，不要替玩家决定方向，也不要让故事结束。题材「${session.background?.name || session.direction?.genre || ''}」，玩家「${session.player?.name || ''}」，主要角色「${session.lead?.name || ''}」。\n${history}\n\n玩家刚刚决定：${input}\n\n只演出下一小段（2 到 3 个短节拍），再提出具体问题。${summarize ? '本章已较长，请同时给出 80 字以内 chapterSummary，供开启新章节使用。' : ''}\n只返回 JSON：{"reply":"","question":"","options":["","",""],"sceneName":"","chapterSummary":"","cards":[{"type":"story","title":"","text":""}]}。cards 只能有 2 到 3 张 story 卡。`;
      let continuation: CreativeStoryOpeningPayload | null = null;
      try {
        continuation = normalizeOpeningPayload((await callAIForTextResult(prompt)).content);
        if (!continuation) {
          continuation = normalizeOpeningPayload(
            (
              await callAIForTextResult(
                `${prompt}\n上一次输出无法读取。请只返回一个 JSON 对象，包含 reply、question、options 和 cards；不要结束故事。`,
              )
            ).content,
          );
        }
      } catch {
        continuation = null;
      }
      // The player can withdraw while AI is writing; ignore that stale response.
      if (generation !== continuationGenerationRef.current) return;
      const next = continuation || buildFallbackContinuation(session, input);
      const summary = summarize ? next.chapterSummary || `${session.chapter} 章：${history.slice(-260)}` : '';
      let placement: AssistantCardPlacementResult | undefined;
      try {
        placement = await createAssistantCards([
          ...(previous ? [{ type: 'story' as const, title: 'AI 创作提问', text: previous.question }, { type: 'story' as const, title: '作者决定', text: input }] : []),
          ...(summary ? [{ type: 'story' as const, title: `第 ${session.chapter} 章创作总结`, text: summary }] : []),
          ...next.cards,
        ], 'append', previous?.nodeId ? { targetNodeIds: [previous.nodeId] } : undefined);
      } catch {
        placement = undefined;
      }
      if (generation !== continuationGenerationRef.current) return;
      const now = Date.now();
      const nextTurn = {
        id: uuidv4(), chapter: summarize ? session.chapter + 1 : session.chapter,
        story: next.reply,
        question: next.question,
        options: next.options.length > 0 ? next.options : buildFallbackContinuation(session, input).options,
        sceneName: next.sceneName || previous?.sceneName || session.background?.name || session.direction?.genre,
        nodeId: placement?.nodeIds?.[(previous ? 2 : 0) + (summary ? 1 : 0)],
        createdAt: now,
      };
      updateSession(task.id, {
        ...session, status: 'playing', chapter: nextTurn.chapter, pendingDecision: undefined,
        turns: summarize ? [nextTurn] : [...session.turns.slice(0, -1), ...(previous ? [{ ...previous, decision: input }] : []), nextTurn],
        chapterSummaries: summary ? [...session.chapterSummaries, summary] : session.chapterSummaries, updatedAt: now,
      });
      setMessages((messages) => [...messages, { id: uuidv4(), role: 'user', content: input }, { id: uuidv4(), role: 'assistant', content: nextTurn.story, cardPosition: placement?.position, cardNodeIds: placement?.nodeIds }]);
    } finally {
      if (generation === continuationGenerationRef.current) setLoading(false);
    }
  };

  const exit = () => {
    continuationGenerationRef.current += 1;
    const task = getTask(creativeStorySession?.id);
    if (task?.creativeSession) updateSession(task.id, { ...task.creativeSession, status: 'paused', updatedAt: Date.now() });
  };

  const withdrawPendingDecision = () => {
    const task = getTask(creativeStorySession?.id);
    const session = task?.creativeSession;
    if (!task || !session?.pendingDecision) return;
    continuationGenerationRef.current += 1;
    updateSession(task.id, {
      ...session,
      pendingDecision: undefined,
      updatedAt: Date.now(),
    });
    setLoading(false);
  };

  const returnToPreviousDecision = () => {
    const task = getTask(creativeStorySession?.id);
    const session = task?.creativeSession;
    if (!task || !session || session.turns.length < 2) return;
    continuationGenerationRef.current += 1;
    // Keep generated canvas cards intact. Only move the active play session back
    // to the earlier question so the next choice creates a sibling branch.
    updateSession(task.id, {
      ...session,
      pendingDecision: undefined,
      turns: session.turns.slice(0, -1),
      updatedAt: Date.now(),
    });
    setLoading(false);
  };

  return {
    creativeStorySession,
    getTask,
    updateSession,
    beginCharacterSelection,
    prepareOpening,
    chooseGenre,
    chooseRolePreference,
    startCustomDirection,
    submitCustomDirection,
    startRolePreferenceCustom,
    submitRolePreference,
    surpriseMe,
    start,
    decide,
    withdrawPendingDecision,
    returnToPreviousDecision,
    exit,
  };
};

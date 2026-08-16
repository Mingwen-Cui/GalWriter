import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { v4 as uuidv4 } from 'uuid';

import type {
  AssistantCardDraft,
  AssistantCardPlacementMode,
  AssistantCardPlacementOptions,
} from '../../agent/planning/agentCardDraft';
import type {
  CreativeStoryTraitKey,
  CreativeStoryTraitLevel,
  CreativeStoryTraitLevels,
} from '../../domain/project';
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

const creativeStoryTraitKeys: CreativeStoryTraitKey[] = [
  'initiative',
  'emotionalOpenness',
  'secretDepth',
  'moralFlexibility',
];

const getCreativeStoryTraitQuestion = (trait: CreativeStoryTraitKey, language: Language) => {
  const localized = <T,>(zh: T, en: T, ja: T) => (language === 'en' ? en : language === 'ja' ? ja : zh);
  const question = (
    zh: string,
    en: string,
    ja: string,
    zhLevels: Array<[string, string]>,
    enLevels: Array<[string, string]>,
    jaLevels: Array<[string, string]>,
  ) => ({
    title: localized(zh, en, ja),
    levels: localized(zhLevels, enLevels, jaLevels),
    lowerLabel: localized('弱', 'Low', '弱'),
    upperLabel: localized('强', 'High', '強'),
    currentLabel: localized('当前强度', 'Current strength', '現在の強さ'),
    groupTitle: localized('同时微调四项角色细节', 'Fine-tune all four character traits', '4つの人物特性をまとめて調整'),
    confirmLabel: localized('确认并生成角色', 'Confirm and generate characters', '決定して人物を生成'),
    skipLabel: localized('跳过微调', 'Skip fine-tuning', '調整をスキップ'),
    completedLabel: localized('角色细节已确认', 'Character traits confirmed', '人物の細部を確認しました'),
    skippedLabel: localized('已跳过角色细节微调', 'Character trait fine-tuning skipped', '人物の細部調整をスキップしました'),
  });

  if (trait === 'initiative') {
    return question(
      '1. 主角会多主动地推动故事？',
      '1. How actively should the protagonist drive the story?',
      '1. 主人公はどれくらい自分から物語を動かしますか？',
      [
        ['1 观察为主', '先看清局势，通常由事件推动。'],
        ['2 谨慎回应', '会行动，但需要明确的理由或邀请。'],
        ['3 有分寸地行动', '在关键点能作出自己的决定。'],
        ['4 主动推进', '会寻找线索、提出要求并带动关系。'],
        ['5 无法袖手旁观', '总会先迈出那一步，改变局面。'],
      ],
      [
        ['1 Mostly observant', 'Watches the situation and is usually moved by events.'],
        ['2 Cautiously responsive', 'Acts with a clear reason or invitation.'],
        ['3 Decisive when needed', 'Makes their own choice at key moments.'],
        ['4 Proactive', 'Seeks clues, makes requests, and drives relationships forward.'],
        ['5 Cannot stand aside', 'Steps in first and changes the situation.'],
      ],
      [
        ['1 観察が中心', 'まず状況を見極め、事件に動かされることが多い。'],
        ['2 慎重に応じる', '理由や誘いがあれば行動する。'],
        ['3 要所で決断する', '大事な場面では自分で選ぶ。'],
        ['4 自ら進める', '手がかりを探し、関係を動かしていく。'],
        ['5 見過ごせない', '最初の一歩を踏み出して局面を変える。'],
      ],
    );
  }
  if (trait === 'emotionalOpenness') {
    return question(
      '2. 主角会把真实情绪表露到什么程度？',
      '2. How openly should the protagonist show real emotions?',
      '2. 主人公は本音をどの程度表に出しますか？',
      [
        ['1 极度克制', '即使受伤或心动，也很少让人看出来。'],
        ['2 不轻易表露', '只有在安全的人面前露出一点破绽。'],
        ['3 慢热真诚', '会犹豫，但会逐渐说出真实想法。'],
        ['4 感受清晰', '能够直说喜欢、愤怒和不安。'],
        ['5 情绪外显', '情绪会直接影响语气、选择和关系。'],
      ],
      [
        ['1 Highly restrained', 'Rarely shows hurt or attraction.'],
        ['2 Guarded', 'Shows a crack only around people who feel safe.'],
        ['3 Slow to warm, sincere', 'Hesitates, then gradually speaks honestly.'],
        ['4 Emotionally clear', 'Can plainly voice affection, anger, and fear.'],
        ['5 Emotionally expressive', 'Feelings directly shape tone, choices, and relationships.'],
      ],
      [
        ['1 強く抑える', '傷つきや好意をほとんど見せない。'],
        ['2 簡単には見せない', '安心できる相手にだけ少し隙を見せる。'],
        ['3 慣れるまで時間がかかる', '迷いながらも少しずつ本音を話す。'],
        ['4 感情が明確', '好意、不安、怒りを言葉にできる。'],
        ['5 感情が表に出る', '口調、選択、関係に感情が強く現れる。'],
      ],
    );
  }
  if (trait === 'secretDepth') {
    return question(
      '3. 主角身上要藏多深的秘密？',
      '3. How deep should the protagonist’s secret run?',
      '3. 主人公はどれほど深い秘密を抱えていますか？',
      [
        ['1 几乎透明', '过去坦荡，没有需要刻意隐瞒的事。'],
        ['2 小小保留', '有些经历暂时不想提起。'],
        ['3 不愿触碰的过去', '一个经历会影响目前的判断和亲近。'],
        ['4 会改变关系的秘密', '真相说出口后，重要关系将被重新定义。'],
        ['5 足以颠覆故事', '身份、动机或记忆可能改变所有人的理解。'],
      ],
      [
        ['1 Nearly transparent', 'Has an open past and little to deliberately hide.'],
        ['2 Small reservations', 'Some experiences are not ready to be discussed.'],
        ['3 A past they avoid', 'One experience changes judgement and closeness.'],
        ['4 A relationship-changing secret', 'The truth will redefine an important bond.'],
        ['5 Story-upending secret', 'Identity, motive, or memory can change everyone’s understanding.'],
      ],
      [
        ['1 ほぼ隠し事がない', '過去は開かれており、隠す必要がほとんどない。'],
        ['2 小さな留保', 'まだ話したくない経験がある。'],
        ['3 触れたくない過去', 'ある出来事が判断や距離感に影響する。'],
        ['4 関係を変える秘密', '真実を知れば大切な関係が変わる。'],
        ['5 物語を覆す秘密', '身分、動機、記憶が全員の理解を変えうる。'],
      ],
    );
  }
  return question(
    '4. 面对两难时，主角会为重要的人变通到什么程度？',
    '4. How far will the protagonist bend for someone important?',
    '4. 大切な人のために、主人公はどこまで柔軟に振る舞いますか？',
    [
      ['1 坚守原则', '即使失去机会，也不越过自己的底线。'],
      ['2 有条件的变通', '会帮忙，但会先划清界限。'],
      ['3 权衡代价', '愿意做灰色选择，并承担后果。'],
      ['4 必要时越界', '为了重要的人会冒险违背常规。'],
      ['5 不惜代价', '一旦认定要守护，就会把自己也押进去。'],
    ],
    [
      ['1 Principled', 'Will not cross a personal line, even at a real cost.'],
      ['2 Flexible with limits', 'Will help, but draws a boundary first.'],
      ['3 Weighs the cost', 'Can make a grey choice and bear its consequence.'],
      ['4 Breaks rules when needed', 'Will risk convention for someone important.'],
      ['5 All in', 'Once committed to protecting someone, stakes themselves too.'],
    ],
    [
      ['1 原則を守る', '大きな代償があっても自分の一線を越えない。'],
      ['2 条件付きで柔軟', '助けるが、先に境界線を決める。'],
      ['3 代償を量る', '灰色の選択をし、その結果を引き受ける。'],
      ['4 必要なら越える', '大切な人のために常識を破る危険を取る。'],
      ['5 すべてを賭ける', '守ると決めたら、自分自身も賭けに出す。'],
    ],
  );
};

const getCreativeStoryTraitPromptContext = (
  traits: Partial<CreativeStoryTraitLevels> | undefined,
) => {
  const value = (trait: CreativeStoryTraitKey) => traits?.[trait] ?? 3;
  const initiative = ['多观察、被事件推动', '谨慎回应', '关键处自主行动', '主动推动线索与关系', '无法袖手旁观，带头改变局面'][value('initiative') - 1];
  const emotionalOpenness = ['极度克制', '不轻易表露', '慢热但真诚', '感受清晰、愿意表达', '情绪强烈外显'][value('emotionalOpenness') - 1];
  const secretDepth = ['几乎没有秘密', '有小小保留', '有不愿触碰的过去', '秘密会改变关系', '秘密足以颠覆故事'][value('secretDepth') - 1];
  const moralFlexibility = ['坚守原则', '有条件地变通', '会权衡灰色代价', '必要时愿意越界', '为重要的人不惜代价'][value('moralFlexibility') - 1];
  return `行动倾向 ${value('initiative')}/5（${initiative}）；情感表达 ${value('emotionalOpenness')}/5（${emotionalOpenness}）；秘密深度 ${value('secretDepth')}/5（${secretDepth}）；底线弹性 ${value('moralFlexibility')}/5（${moralFlexibility}）`;
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
      .map((card): AssistantCardDraft => {
        const gender: AssistantCardDraft['gender'] =
          card.gender === 'male' ? 'male' : card.gender === 'female' ? 'female' : undefined;
        return {
          ...card,
          type: 'character',
          characterName: String(card.characterName || card.name || card.title || '').trim(),
          gender,
          identity: String(card.identity || card.role || card.occupation || '').trim(),
          appearance: String(card.appearance || card.look || '').trim(),
          personality: String(card.personality || card.traits || '').trim(),
          habits: String(card.habits || '').trim(),
          speechStyle: String(card.speechStyle || card.speech || '').trim(),
          experience: String(card.experience || card.backstory || '').trim(),
          relationships: String(card.relationships || card.relationship || '').trim(),
          notes: String(card.notes || card.description || '').trim(),
        };
      })
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
      gender: 'female',
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
      gender: 'male',
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
      gender: 'female',
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
      gender: 'male',
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
  sceneEnvironment?: 'indoor' | 'outdoor';
  affectionDelta?: number;
  chapterSummary?: string;
  cards: AssistantCardDraft[];
};

const normalizeCreativeSceneEnvironment = (
  value: unknown,
): 'indoor' | 'outdoor' | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === 'indoor' ||
    normalized === 'inner' ||
    normalized === '室内' ||
    normalized === '屋内'
  ) {
    return 'indoor';
  }
  if (
    normalized === 'outdoor' ||
    normalized === 'outter' ||
    normalized === 'outer' ||
    normalized === '室外' ||
    normalized === '户外'
  ) {
    return 'outdoor';
  }
  return undefined;
};

/**
 * When the beat moves to a new named place, create a scene setting card so the
 * canvas gets a modular scene preset (background + no lighting by default).
 */
const buildCreativeSceneSettingCard = (
  sceneName: string | undefined,
  sceneEnvironment: 'indoor' | 'outdoor' | undefined,
  previousSceneName?: string,
): AssistantCardDraft | null => {
  const name = String(sceneName || '').trim();
  if (!name) return null;
  if (previousSceneName && previousSceneName.trim() === name) return null;
  return {
    type: 'scene',
    sceneName: name,
    sceneEnvironment,
    location: name,
    visual: name,
    notes: '',
  };
};

const withCreativeSceneSettingCard = (
  cards: AssistantCardDraft[],
  sceneName: string | undefined,
  sceneEnvironment: 'indoor' | 'outdoor' | undefined,
  previousSceneName?: string,
) => {
  const sceneCard = buildCreativeSceneSettingCard(sceneName, sceneEnvironment, previousSceneName);
  return {
    cards: sceneCard ? [sceneCard, ...cards] : cards,
    sceneCardCount: sceneCard ? 1 : 0,
  };
};

const CREATIVE_STORY_BEAT_RULES = `演出长度约 3 到 10 句。
规则：
- 日常对白、情绪反应、环境描写：只返回正文，question 必须是 ""，options 必须是 []。
- 仅在关系转折、不可逆后果、立场冲突或真正的路线分叉时，才提出一个具体问题，并给出对应选项。
- 问题必须具体，指向当下可做的事或要表态的立场；禁止空泛的「你想怎么做」「接下来呢」。
- 选项数量不限，可以只有 1 个；没有关键分歧时不要硬凑选项。
- 可根据剧情填写好感度：在 JSON 顶层给出整数 affectionDelta（可正可负），并在对应 story 卡上写 nodeValue（与本段变化一致）。
- 必须填写 sceneName（当前演出发生的地点名）。若地点相对上一段发生变化，sceneName 必须换成新地点。
- 同时填写 sceneEnvironment，值只能是 indoor 或 outdoor，仅用于内部场景预设，不要写进对白。`;

const parseFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const applyAffectionToCards = (
  cards: AssistantCardDraft[],
  affectionDelta: number | undefined,
): AssistantCardDraft[] => {
  if (!affectionDelta || cards.length === 0) return cards;
  const hasNodeValue = cards.some(
    (card) => typeof card.nodeValue === 'number' && Number.isFinite(card.nodeValue) && card.nodeValue !== 0,
  );
  if (hasNodeValue) return cards;
  return cards.map((card, index) =>
    index === cards.length - 1 ? { ...card, nodeValue: affectionDelta } : card,
  );
};

const resolveAffectionDelta = (
  payload: Pick<CreativeStoryOpeningPayload, 'affectionDelta' | 'cards'>,
): number => {
  if (typeof payload.affectionDelta === 'number' && Number.isFinite(payload.affectionDelta)) {
    return payload.affectionDelta;
  }
  return payload.cards.reduce((sum, card) => {
    const value = typeof card.nodeValue === 'number' && Number.isFinite(card.nodeValue) ? card.nodeValue : 0;
    return sum + value;
  }, 0);
};

const normalizeOpeningPayload = (content: string): CreativeStoryOpeningPayload | null => {
  try {
    const parsed = JSON.parse(extractFirstJsonObject(content)) as {
      reply?: unknown;
      story?: unknown;
      content?: unknown;
      question?: unknown;
      prompt?: unknown;
      needsChoice?: unknown;
      sceneName?: unknown;
      scene?: unknown;
      sceneEnvironment?: unknown;
      affectionDelta?: unknown;
      affection?: unknown;
      favorability?: unknown;
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
      .map((card) => {
        const nodeValue =
          parseFiniteNumber(card.nodeValue) ??
          parseFiniteNumber(card.affection) ??
          parseFiniteNumber(card.affectionDelta) ??
          parseFiniteNumber(card.favorability);
        return {
          ...card,
          type: 'story' as const,
          title: String(card.title || card.name || '').trim(),
          text: normalizeAssistantStoryDraftText(String(card.text || card.content || card.description || '')),
          ...(nodeValue !== undefined ? { nodeValue } : {}),
        };
      })
      .filter((card) => Boolean(card.text));
    const storyCards = cards.length > 0 ? cards.slice(0, 3) : reply ? [{ type: 'story' as const, text: reply }] : [];
    if (storyCards.length === 0) return null;
    const options = (parsed.options || parsed.choices || [])
      .map((option) => (typeof option === 'string' ? option : String((option as { label?: unknown })?.label || '')))
      .map((option) => option.trim())
      .filter(Boolean)
      .slice(0, 8);
    const question = String(parsed.question || parsed.prompt || '').trim();
    const affectionDelta =
      parseFiniteNumber(parsed.affectionDelta) ??
      parseFiniteNumber(parsed.affection) ??
      parseFiniteNumber(parsed.favorability);
    const hasChoice = options.length > 0 || parsed.needsChoice === true;
    const normalizedCards = applyAffectionToCards(storyCards, affectionDelta);
    return {
      reply: reply || normalizedCards.map((card) => card.text || '').join('\n'),
      question: hasChoice ? question : '',
      options: hasChoice ? options : [],
      sceneName: String(parsed.sceneName || parsed.scene || '').trim(),
      sceneEnvironment: normalizeCreativeSceneEnvironment(parsed.sceneEnvironment),
      affectionDelta,
      chapterSummary: String(parsed.chapterSummary || '').trim(),
      cards: normalizedCards,
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
  const isContinue = decision === '继续';
  const reply = isContinue
    ? `${lead}没有立刻催促。气氛缓了一拍，${player}能听清彼此的呼吸，也听清那些还没说出口的话。`
    : `${player}做出了选择：「${decision}」。${lead}沉默了片刻，随后给出了一个没有完全说透的回应。空气里的紧张感没有消失，反而让你意识到，这件事比最初想象的更重要。`;
  return {
    reply,
    question: isContinue ? '' : `${lead}看着你，等你明确表态：要追问真相，还是先稳住局面？`,
    options: isContinue ? [] : ['追问刚才没有说清的部分', '先稳住局面，再找机会'],
    affectionDelta: isContinue ? 0 : 1,
    sceneName,
    cards: [
      {
        type: 'story',
        title: isContinue ? '继续' : '你的决定',
        text: isContinue ? reply : `${player}选择了：${decision}`,
        nodeValue: isContinue ? 0 : 1,
      },
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
    question: `${lead}把那件东西半递过来，目光停在你脸上：你是现在问清来历，还是先接过去再谈？`,
    options: ['现在就问清来历', '先接过去，稍后再谈'],
    affectionDelta: 0,
    sceneName,
    cards: [
      { type: 'story', title: '第一幕', text: reply, nodeValue: 0 },
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
      { id: 'observer', label: 'A sharp observer', description: 'They notice what everyone else overlooks.' },
      { id: 'protector', label: 'A protector', description: 'They have someone or something they cannot leave behind.' },
      { id: 'outsider', label: 'An outsider', description: 'They do not quite belong in this place, group, or era.' },
      { id: 'idealist', label: 'An idealist', description: 'They still believe something can be made better.' },
      { id: 'ambitious', label: 'Someone with an agenda', description: 'They know what they want, even if they cannot say why.' },
      { id: 'survivor', label: 'A wounded survivor', description: 'They have endured something that still shapes every choice.' },
      { id: 'trickster', label: 'An unpredictable disruptor', description: 'They change the room’s balance and keep people guessing.' },
      { id: 'leader', label: 'A reluctant leader', description: 'Others look to them when no one wants to decide.' },
    ];
  }
  if (language === 'ja') {
    return [
      { id: 'ordinary', label: '普通の人', description: '身近な人物が特別な物語に巻き込まれる。' },
      { id: 'secret', label: '秘密を持つ人', description: '過去、動機、正体を隠している。' },
      { id: 'special', label: '特別な身分', description: '珍しい役割、地位、能力を与える。' },
      { id: 'grey', label: '葛藤を抱えた人', description: '簡単に正解を選べない人物にする。' },
      { id: 'observer', label: '鋭い観察者', description: '誰も見落とす細部に気づく。' },
      { id: 'protector', label: '守るものがある人', description: '置いていけない人や場所がある。' },
      { id: 'outsider', label: 'どこにも属せない人', description: 'この場所、集団、時代にうまく馴染めない。' },
      { id: 'idealist', label: '理想を諦めない人', description: '何かを良くできると今も信じている。' },
      { id: 'ambitious', label: '目的を持つ人', description: '言えない理由があっても、欲しいものを知っている。' },
      { id: 'survivor', label: '傷を抱えた生存者', description: '乗り越えた出来事が、今も選択を形づくっている。' },
      { id: 'trickster', label: '読めない攪乱者', description: '場の均衡を変え、周囲を予測させない。' },
      { id: 'leader', label: '押し出されたリーダー', description: '誰も決められない時、周囲がその人を見る。' },
    ];
  }
  return [
    { id: 'ordinary', label: '普通但有故事的人', description: '容易代入，却被卷进不普通的故事。' },
    { id: 'secret', label: '藏着秘密的人', description: '角色有不能轻易说出的过去、动机或身份。' },
    { id: 'special', label: '拥有特殊身份的人', description: '给角色一个稀有的职业、地位或能力。' },
    { id: 'grey', label: '有矛盾感的人', description: '让角色面临不容易选对的立场与抉择。' },
    { id: 'observer', label: '敏锐的观察者', description: '总能先发现别人忽略的细节和情绪。' },
    { id: 'protector', label: '有想守护的人', description: '有一个人、地方或承诺绝不能轻易放下。' },
    { id: 'outsider', label: '格格不入的外来者', description: '在这个群体、城市或时代里都有一点不合拍。' },
    { id: 'idealist', label: '不肯放弃理想的人', description: '仍相信事情可以变得更好，也愿意去尝试。' },
    { id: 'ambitious', label: '目标明确的野心家', description: '知道自己想要什么，只是暂时不能说出原因。' },
    { id: 'survivor', label: '带着伤痕的幸存者', description: '曾经历的事仍在影响现在每一次选择。' },
    { id: 'trickster', label: '难以捉摸的搅局者', description: '总能改变气氛，让所有人猜不透下一步。' },
    { id: 'leader', label: '被推到前面的领导者', description: '没人敢决定时，其他人会下意识看向他。' },
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
{"cards":[{"type":"scene","sceneName":"不超过12字的故事门标题","sceneEnvironment":"indoor 或 outdoor","location":"","time":"","weather":"","visual":"","sound":"","items":"","notes":"不超过45字的沉浸式钩子"}]}
sceneEnvironment 只用于内部场景预设，不要把室内/室外写进 notes 或其他可见字段。`);
      const parsed = JSON.parse(extractFirstJsonObject(result.content)) as { cards?: AssistantCardDraft[] };
      const candidates = (parsed.cards || [])
        .filter((card) => getAssistantDraftType(card) === 'scene')
        .slice(0, 3)
        .map((scene, index) => {
          const sceneEnvironment = normalizeCreativeSceneEnvironment(
            (scene as { sceneEnvironment?: unknown }).sceneEnvironment,
          );
          const normalizedScene: AssistantCardDraft = {
            ...scene,
            type: 'scene',
            sceneName: scene.sceneName || scene.title || `故事门 ${index + 1}`,
            ...(sceneEnvironment ? { sceneEnvironment } : {}),
          };
          return {
            id: uuidv4(),
            name: normalizedScene.sceneName || `故事门 ${index + 1}`,
            description:
              normalizedScene.notes ||
              normalizedScene.description ||
              normalizedScene.visual ||
              normalizedScene.location ||
              '',
            scene: normalizedScene,
          };
        });
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
    beginCharacterTraitCalibration(session);
  };

  const beginCharacterTraitCalibration = (session: CreativeStorySession) => {
    const questions = creativeStoryTraitKeys.map((trait) => ({
      trait,
      ...getCreativeStoryTraitQuestion(trait, language),
    }));
    const firstQuestion = questions[0];
    if (!firstQuestion) return;
    workflowRef.current = {
      type: 'creative-character-traits-awaiting',
      sessionId: session.id,
    };
    setMessages((messages) => [
      ...messages,
      {
        id: uuidv4(),
        role: 'assistant',
        content: firstQuestion.groupTitle,
        characterTraitControls: {
          controls: questions.map((question) => ({
            trait: question.trait,
            title: question.title,
            levels: question.levels.map(([, description], index) => ({
              value: (index + 1) as CreativeStoryTraitLevel,
              description,
            })),
            lowerLabel: question.lowerLabel,
            upperLabel: question.upperLabel,
            currentLabel: question.currentLabel,
          })),
          confirmLabel: firstQuestion.confirmLabel,
          skipLabel: firstQuestion.skipLabel,
          completedLabel: firstQuestion.completedLabel,
          skippedLabel: firstQuestion.skippedLabel,
        },
      },
    ]);
  };

  const chooseCharacterTraits = async (levels?: number[]) => {
    const workflow = workflowRef.current;
    if (workflow.type !== 'creative-character-traits-awaiting') return;
    const isSkipped = levels === undefined;
    if (
      levels &&
      (levels.length !== creativeStoryTraitKeys.length ||
        levels.some((level) => !Number.isInteger(level) || level < 1 || level > 5))
    ) return;
    const task = getTask(workflow.sessionId);
    if (!task?.creativeSession) return;
    setMessages((messages) => {
      const nextMessages = [...messages];
      for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
        const controls = nextMessages[index].characterTraitControls;
        if (controls && !controls.selectedValues && !controls.skipped) {
          nextMessages[index] = {
            ...nextMessages[index],
            characterTraitControls: {
              ...controls,
              skipped: isSkipped,
              selectedValues: isSkipped
                ? undefined
                : Object.fromEntries(
                    creativeStoryTraitKeys.map((trait, index) => [
                      trait,
                      levels?.[index] as CreativeStoryTraitLevel,
                    ]),
                  ),
            },
          };
          break;
        }
      }
      return nextMessages;
    });
    const session: CreativeStorySession = {
      ...task.creativeSession,
      direction: {
        ...(task.creativeSession.direction || { genreId: 'custom', genre: '' }),
        roleTraits: isSkipped
          ? undefined
          : Object.fromEntries(
              creativeStoryTraitKeys.map((trait, index) => [
                trait,
                levels?.[index] as CreativeStoryTraitLevels[CreativeStoryTraitKey],
              ]),
            ),
      },
      updatedAt: Date.now(),
    };
    updateSession(task.id, session);
    workflowRef.current = { type: 'idle' };
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
    beginCharacterTraitCalibration(session);
  };

  const beginCharacterSelection = async (taskId: string, session: CreativeStorySession) => {
    if (!hasTextApiKey) return onMissingTextApiKeyRequest?.();
    setLoading(true);
    try {
      const prompt = `你是视觉小说的实时创作导演。题材是「${
        session.direction?.genre || session.background?.name || '未命名题材'
      }」，作者想扮演的角色类型是「${session.direction?.rolePreference || '由你提供有反差感的候选人'}」。角色细节强度为：${getCreativeStoryTraitPromptContext(session.direction?.roleTraits)}。生成恰好 4 位彼此差异明显、适合互动故事的角色；四位都必须在核心行为上符合这四项五级调节，因此无论作者选中哪一位作为玩家，都能继续保持一致。至少一位要贴近作者想扮演的类型。用可观察的习惯、语言、关系边界和过去经历体现强度，避免只贴标签。只返回 JSON：
{"cards":[{"type":"character","characterName":"","gender":"male 或 female","identity":"","appearance":"","personality":"","habits":"","speechStyle":"","experience":"","relationships":"","notes":""}]}
gender 仅用于内部人物预设的性别选择，不要把性别写进任何人物文字字段。不要返回剧情或场景卡。`;
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
      // Interactive-story characters use the built-in modular portrait first,
      // so the first player choice is immediately visual without waiting for
      // an image-model request. An avatar returned by the model is preserved.
      const placement = await createAssistantCards(
        cards.map((card) => ({ ...card, generateImage: false })),
        'append',
      );
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
      const leadName = session.lead?.name || '主要角色';
      const prompt = `你是视觉小说的实时创作导演。题材是「${
        session.background?.name || session.direction?.genre || ''
      }」，玩家扮演「${session.player?.name || ''}」，主要角色是「${leadName}」。玩家角色细节为：${getCreativeStoryTraitPromptContext(session.direction?.roleTraits)}。让人物的动作、语气、犹豫和关系距离持续符合这些五级设定，不要只在介绍里提一次。当前对「${leadName}」的好感度为 0。
${CREATIVE_STORY_BEAT_RULES}
先写出开场演出。只返回 JSON：
{"reply":"给玩家看的开场正文","question":"","options":[],"affectionDelta":0,"sceneName":"当前适合的场景名","sceneEnvironment":"indoor 或 outdoor","cards":[{"type":"story","title":"","text":"","nodeValue":0}]}
cards 只能是 2 到 3 张 story 卡。每张卡必须自然写到题材和两位角色的名字。有关键分歧时再填写具体 question 与 options；否则 question 为 ""，options 为 []。`;
      let opening: CreativeStoryOpeningPayload | null = null;
      let usedFallback = false;
      try {
        opening = normalizeOpeningPayload((await callAIForTextResult(prompt)).content);
        if (!opening) {
          opening = normalizeOpeningPayload(
            (
              await callAIForTextResult(
                `${prompt}\n上一次输出无法读取。请只返回一个 JSON 对象，包含 reply、question、options、affectionDelta、sceneName、sceneEnvironment 和 cards；cards 中每一项必须有 text。无关键分歧时 question 为 ""、options 为 []。`,
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
      const openingSceneName =
        opening.sceneName || session.background?.name || session.direction?.genre;
      const { cards: openingCards, sceneCardCount } = withCreativeSceneSettingCard(
        opening.cards,
        openingSceneName,
        opening.sceneEnvironment,
        session.background?.name,
      );
      let placement: AssistantCardPlacementResult | undefined;
      try {
        placement = await createAssistantCards(openingCards, 'append', {
          setFirstStoryAsRoot: true,
        });
      } catch {
        usedFallback = true;
      }
      const affectionDelta = resolveAffectionDelta(opening);
      const now = Date.now();
      updateSession(taskId, {
        ...session,
        status: 'playing',
        affection: affectionDelta,
        turns: [
          {
            id: uuidv4(),
            chapter: session.chapter,
            story: opening.reply,
            question: opening.question,
            options: opening.options,
            affectionDelta,
            sceneName: openingSceneName,
            nodeId: placement?.nodeIds?.[sceneCardCount],
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
      id: uuidv4(), status: 'setup', chapter: 1, affection: 0, turns: [], chapterSummaries: [], createdAt: now, updatedAt: now,
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
      const leadName = session.lead?.name || '主要角色';
      const currentAffection = session.affection ?? 0;
      const chapterContext = session.chapterSummaries
        .slice(-3)
        .map((summary) => `章节总结：${summary}`)
        .join('\n');
      const history = session.turns
        .slice(-7)
        .map((turn) => {
          const choiceLine =
            turn.decision || (turn === previous ? '未选择' : turn.options.length > 0 ? '未选择' : '（本段无玩家选择）');
          const affectionLine =
            typeof turn.affectionDelta === 'number' ? `\n好感变化：${turn.affectionDelta}` : '';
          return `演出：${turn.story}\n提问：${turn.question || '（无）'}\n决定：${choiceLine}${affectionLine}`;
        })
        .join('\n---\n');
      const summarize = session.turns.length >= 8;
      const playerAction =
        input === '继续' && (!previous || previous.options.length === 0)
          ? '玩家已读完上一段，请自然续写，不要复述。'
          : `玩家刚刚决定：${input}`;
      const prompt = `你是视觉小说的实时创作导演。严格承接故事，不要替玩家决定方向，也不要让故事结束。题材「${session.background?.name || session.direction?.genre || ''}」，玩家「${session.player?.name || ''}」，主要角色「${leadName}」。玩家角色细节为：${getCreativeStoryTraitPromptContext(session.direction?.roleTraits)}。后续的动作、情绪表达、秘密揭露速度与道德取舍必须持续符合这些五级设定。当前对「${leadName}」的好感度为 ${currentAffection}。
${chapterContext ? `${chapterContext}\n` : ''}${history}

${playerAction}

${CREATIVE_STORY_BEAT_RULES}
上一段场景名：${previous?.sceneName || session.background?.name || '未知'}。若本段地点改变，必须换成新的 sceneName 与对应 sceneEnvironment。
${summarize ? '本章已较长，请同时给出 80 字以内 chapterSummary，供开启新章节使用。' : ''}
只返回 JSON：{"reply":"","question":"","options":[],"affectionDelta":0,"sceneName":"","sceneEnvironment":"indoor 或 outdoor","chapterSummary":"","cards":[{"type":"story","title":"","text":"","nodeValue":0}]}。cards 只能有 2 到 3 张 story 卡。有关键分歧时再填写具体 question 与 options；否则 question 为 ""，options 为 []。`;
      let continuation: CreativeStoryOpeningPayload | null = null;
      try {
        continuation = normalizeOpeningPayload((await callAIForTextResult(prompt)).content);
        if (!continuation) {
          continuation = normalizeOpeningPayload(
            (
              await callAIForTextResult(
                `${prompt}\n上一次输出无法读取。请只返回一个 JSON 对象，包含 reply、question、options、affectionDelta、sceneName、sceneEnvironment 和 cards；不要结束故事。无关键分歧时 question 为 ""、options 为 []。`,
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
      const affectionDelta = resolveAffectionDelta(next);
      const nextAffection = currentAffection + affectionDelta;
      const summary = summarize ? next.chapterSummary || `${session.chapter} 章：${history.slice(-260)}` : '';
      const nextSceneName =
        next.sceneName || previous?.sceneName || session.background?.name || session.direction?.genre;
      const { cards: continuationSceneAndStoryCards, sceneCardCount } = withCreativeSceneSettingCard(
        next.cards,
        nextSceneName,
        next.sceneEnvironment,
        previous?.sceneName || session.background?.name,
      );
      let placement: AssistantCardPlacementResult | undefined;
      try {
        placement = await createAssistantCards([
          ...(previous
            ? [
                ...(previous.question
                  ? [{ type: 'story' as const, title: 'AI 创作提问', text: previous.question }]
                  : []),
                { type: 'story' as const, title: '作者决定', text: input },
              ]
            : []),
          ...(summary ? [{ type: 'story' as const, title: `第 ${session.chapter} 章创作总结`, text: summary }] : []),
          ...continuationSceneAndStoryCards,
        ], 'append', previous?.nodeId ? { targetNodeIds: [previous.nodeId] } : undefined);
      } catch {
        placement = undefined;
      }
      if (generation !== continuationGenerationRef.current) return;
      const now = Date.now();
      const bookkeepingCount =
        (previous ? 1 + (previous.question ? 1 : 0) : 0) + (summary ? 1 : 0);
      const nextTurn = {
        id: uuidv4(), chapter: summarize ? session.chapter + 1 : session.chapter,
        story: next.reply,
        question: next.question,
        options: next.options,
        affectionDelta,
        sceneName: nextSceneName,
        // The earlier cards record the question, decision, and optional chapter
        // summary; a scene setting card may also precede the new story cards.
        // The active playtest turn must point to the first new story card.
        nodeId: placement?.nodeIds?.[bookkeepingCount + sceneCardCount],
        createdAt: now,
      };
      updateSession(task.id, {
        ...session, status: 'playing', chapter: nextTurn.chapter, pendingDecision: undefined,
        affection: nextAffection,
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
    chooseCharacterTraits,
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

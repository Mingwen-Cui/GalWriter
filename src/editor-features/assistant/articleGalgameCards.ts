import type { AssistantCardDraft } from '../../agent/planning/agentCardDraft';
import { createArticleDefaultSceneCards, getAssistantDraftType } from './assistantPanelHelpers';

/** Turn model output into one playable, forward-moving teaching flow. */
export const prepareArticleGalgameCards = (
  drafts: AssistantCardDraft[],
  selection: { characterName: string; sceneName?: string; useScene?: boolean; chapters?: string[] },
): AssistantCardDraft[] => {
  const stories = drafts.filter(
    (card) => getAssistantDraftType(card) === 'story' && card.text?.trim(),
  );
  if (!stories.length) throw new Error('没有收到有效剧情卡，请重新生成文章教学内容。');

  // The chosen character is placed locally; never let the model replace its settings.
  const scenes = selection.sceneName || selection.useScene === false
    ? []
    : drafts.filter((card) => getAssistantDraftType(card) === 'scene' && (card.sceneName || card.title));
  if (!selection.sceneName && selection.useScene !== false && !scenes.length) {
    scenes.push({ ...createArticleDefaultSceneCards()[0], sceneEnvironment: 'indoor' });
  }
  const sceneNames = selection.sceneName
    ? [selection.sceneName]
    : scenes.map((card) => String(card.sceneName || card.title).trim());
  const chapters = selection.chapters?.filter((title) => title.trim()) || [];
  const fallbackCount = Math.min(3, stories.length);
  let currentChapter = '';
  const normalized = stories.map((card, index) => {
    currentChapter = card.chapterTitle?.trim() || currentChapter || chapters[0] || '文章导读';
    const chapterTitle = card.chapterTitle?.trim() || (
      chapters.length
        ? chapters[Math.min(chapters.length - 1, Math.floor(index * chapters.length / stories.length))]
        : stories.some((story) => story.chapterTitle?.trim())
          ? currentChapter
          : ['文章导读', '核心讲解', '总结回顾'][Math.floor(index * fallbackCount / stories.length)]
    );
    let text = card.text!.trim();
    if (!text.includes(selection.characterName)) text = `${selection.characterName}，${text}`;
    const sceneName = sceneNames.find((name) => text.includes(name)) || sceneNames[0];
    if (sceneName && !text.includes(sceneName)) text = `${sceneName}，${text}`;
    return { ...card, type: 'story' as const, text, chapterTitle };
  });
  // Keep chapters contiguous, using the analyzed order when the model used its titles.
  const chapterOrder = [...new Set([...chapters, ...normalized.map((card) => card.chapterTitle)])];
  normalized.sort((a, b) => chapterOrder.indexOf(a.chapterTitle) - chapterOrder.indexOf(b.chapterTitle));

  const refs = new Map<string, number>();
  normalized.forEach((card, index) => {
    [card.key, card.title].forEach((ref) => {
      if (ref?.trim() && !refs.has(ref.trim().toLocaleLowerCase())) {
        refs.set(ref.trim().toLocaleLowerCase(), index);
      }
    });
  });
  const keys = normalized.map((_, index) => `article-story-${index + 1}`);
  const connected = normalized.map((card, index) => {
    const resolve = (ref: string) => {
      const target = refs.get(ref.trim().toLocaleLowerCase());
      return target !== undefined && target > index ? keys[target] : undefined;
    };
    const branchTargets = (card.branchTargets || [])
      .map((branch) => ({ ...branch, target: resolve(branch.target) }))
      .filter((branch): branch is NonNullable<AssistantCardDraft['branchTargets']>[number] =>
        Boolean(branch.target && branch.label?.trim()),
      )
      .filter((branch, i, list) => list.findIndex((other) => other.target === branch.target) === i);
    const branchKeys = new Set(branchTargets.map((branch) => branch.target));
    const connectTo = [...new Set((card.connectTo || []).map(resolve).filter(
      (ref): ref is string => Boolean(ref && !branchKeys.has(ref)),
    ))];
    // Missing next links should not switch the entire batch into disconnected explicit mode.
    if (!branchTargets.length && !connectTo.length && index < normalized.length - 1) {
      connectTo.push(keys[index + 1]);
    }
    return { ...card, key: keys[index], connectTo, branchTargets };
  });
  const reachable = new Set([keys[0]]);
  connected.forEach((card) => {
    if (!reachable.has(card.key)) return;
    card.connectTo.forEach((key) => reachable.add(key));
    card.branchTargets.forEach((branch) => reachable.add(branch.target));
  });
  // A malformed branch can skip whole chapters. Fall back to the chapter sequence
  // instead of leaving unreachable teaching cards or inventing player choices.
  if (reachable.size !== connected.length) {
    connected.forEach((card, index) => {
      card.connectTo = index < connected.length - 1 ? [keys[index + 1]] : [];
      card.branchTargets = [];
    });
  }
  return [
    ...scenes.map((card) => ({ ...card, type: 'scene' as const, generateImage: false })),
    ...connected,
  ];
};

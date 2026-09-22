import type { AssistantMessage, AssistantTask, CreativeStoryWorkflow } from '../../domain/project';

export function isCreativeWorkflow(workflow: { type: string }): workflow is CreativeStoryWorkflow {
  return workflow.type.startsWith('creative-');
}

export function checkpointCreativeMessages(
  messages: AssistantMessage[],
  previous: AssistantMessage[],
  task: AssistantTask,
  workflow: CreativeStoryWorkflow,
): AssistantMessage[] {
  const existing = new Set(previous.map((message) => message.id));
  return messages.map((message) =>
    !existing.has(message.id) &&
    task.creativeSession &&
    (message.options?.some((option) => option.value.startsWith('__creative_')) ||
      message.characterTraitControls ||
      message.inputPrompt)
      ? {
          ...message,
          creativeCheckpoint: structuredClone({ workflow, session: task.creativeSession }),
        }
      : message,
  );
}

/** Replacing an answer discards only the dependent conversation, never user canvas cards. */
export function selectCreativeChoice(task: AssistantTask, messageId: string, value: string) {
  const index = task.messages.findIndex((message) => message.id === messageId);
  const message = task.messages[index];
  if (
    !message ||
    message.selectedChoice === value ||
    message.options?.some((option) => option.value === value && option.selected)
  )
    return null;
  if (
    !message.options?.some((option) => option.value === value) &&
    !(message.characterTraitControls && value.startsWith('__creative_traits__:'))
  )
    return null;
  let checkpoint = message.creativeCheckpoint;
  // Projects saved before checkpoints existed still allow revising genre and role choices.
  if (!checkpoint && task.creativeSession) {
    const session = structuredClone(task.creativeSession);
    session.status = 'setup';
    session.background = undefined;
    session.player = undefined;
    session.lead = undefined;
    session.turns = [];
    session.chapterSummaries = [];
    session.pendingDecision = undefined;
    session.chapter = 1;
    session.affection = 0;
    if (
      value.startsWith('__creative_genre__:') ||
      value === '__creative_direction_custom__' ||
      value === '__creative_surprise__'
    ) {
      session.direction = undefined;
      checkpoint = { workflow: { type: 'creative-genre-awaiting' }, session };
    } else if (value.startsWith('__creative_role_preference')) {
      if (session.direction)
        session.direction = { genreId: session.direction.genreId, genre: session.direction.genre };
      checkpoint = {
        workflow: { type: 'creative-role-preference-awaiting', sessionId: session.id },
        session,
      };
    }
  }
  if (!checkpoint) return null;
  const messages = task.messages.slice(0, index + 1);
  messages[index] = {
    ...message,
    creativeCheckpoint: checkpoint,
    selectedChoice: value,
    options: message.options?.map((option) => ({ ...option, selected: option.value === value })),
    characterTraitControls: message.characterTraitControls
      ? { ...message.characterTraitControls, selectedValues: undefined, skipped: false }
      : undefined,
  };
  return {
    task: {
      ...task,
      messages,
      creativeSession: structuredClone(checkpoint.session),
      updatedAt: Date.now(),
    },
    workflow: structuredClone(checkpoint.workflow),
  };
}

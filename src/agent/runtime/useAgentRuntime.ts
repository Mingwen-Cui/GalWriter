import { useCallback, useRef, useState } from 'react';

import type {
  AgentCardPlacementRequest,
  AgentCardPlacementResult,
  AgentStep,
  AgentRunState,
} from '../core/agentTypes';
import type { AssistantCardDraft } from '../planning/agentCardDraft';
import { buildAgentCardPlacementPlan } from '../planning/agentPlanBuilder';

const INITIAL_CURSOR = { x: 96, y: 96 };
const DEFAULT_STEP_DURATION_MS = 360;

const delay = (durationMs: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs);
  });

const waitForPaint = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });

const escapeAttributeValue = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const getElementPoint = (element: Element) => {
  const rect = element.getBoundingClientRect();
  return {
    x: Math.max(8, rect.left + Math.min(22, rect.width / 2)),
    y: Math.max(8, rect.top + rect.height / 2),
  };
};

const resolveStepCursor = (
  step: { cardIndex?: number; fieldKey?: string; cursor?: { x: number; y: number } },
  nodeIds?: string[],
) => {
  const nodeId = typeof step.cardIndex === 'number' ? nodeIds?.[step.cardIndex] : undefined;
  if (!nodeId) return undefined;

  const safeNodeId = escapeAttributeValue(nodeId);
  const nodeElement = document.querySelector(
    `[data-agent-node-id="${safeNodeId}"], .react-flow__node[data-id="${safeNodeId}"]`,
  );
  if (!nodeElement) return undefined;

  if (step.fieldKey) {
    const safeFieldKey = escapeAttributeValue(step.fieldKey);
    const fieldElement = nodeElement.querySelector(`[data-agent-field="${safeFieldKey}"]`);
    if (fieldElement) return getElementPoint(fieldElement);
  }

  return getElementPoint(nodeElement);
};

interface RunAgentCardPlacementParams
  extends AgentCardPlacementRequest<AssistantCardDraft> {
  execute: () => AgentCardPlacementResult;
  applyStep?: (
    step: AgentStep,
    result: AgentCardPlacementResult,
    shouldSkip: () => boolean,
  ) => Promise<void>;
}

export const useAgentRuntime = () => {
  const skipRequestedRef = useRef(false);
  const [agentState, setAgentState] = useState<AgentRunState>({
    running: false,
    phase: 'idle',
    plan: null,
    activeStepIndex: -1,
    cursor: INITIAL_CURSOR,
    lockedNodeIds: [],
    skipRequested: false,
  });

  const requestSkipAgent = useCallback(() => {
    skipRequestedRef.current = true;
    setAgentState((state) => ({ ...state, skipRequested: true }));
  }, []);

  const runAgentCardPlacement = useCallback(
    async ({
      cards,
      mode,
      options,
      selectedCount,
      execute,
      applyStep,
    }: RunAgentCardPlacementParams): Promise<AgentCardPlacementResult> => {
      if (cards.length === 0) return execute();

      const plan = buildAgentCardPlacementPlan({ cards, mode, options, selectedCount });
      skipRequestedRef.current = false;
      setAgentState({
        running: true,
        phase: 'running',
        plan,
        activeStepIndex: 0,
        cursor: agentState.cursor,
        lockedNodeIds: options?.targetNodeIds || [],
        skipRequested: false,
      });

      let result: AgentCardPlacementResult | null = null;
      const firstActionIndex = plan.steps.findIndex(
        (step) => step.type === 'create-card' || step.type === 'focus',
      );
      const executeAtIndex = firstActionIndex >= 0 ? firstActionIndex : 0;

      for (let index = 0; index < plan.steps.length; index += 1) {
        const step = plan.steps[index];
        if (!result && index >= executeAtIndex) {
          result = execute();
          await waitForPaint();
        }

        const resolvedCursor = resolveStepCursor(step, result?.nodeIds);
        setAgentState((state) => ({
          ...state,
          activeStepIndex: index,
          cursor: resolvedCursor || state.cursor,
          lockedNodeIds: result?.nodeIds || state.lockedNodeIds,
        }));

        if (applyStep) {
          await applyStep(step, result, () => skipRequestedRef.current);
        }

        if (!skipRequestedRef.current && step.type !== 'type-field') {
          await delay(step.durationMs ?? DEFAULT_STEP_DURATION_MS);
        }
      }

      if (!result) result = execute();

      await delay(skipRequestedRef.current ? 80 : 260);
      setAgentState({
        running: false,
        phase: 'idle',
        plan: null,
        activeStepIndex: -1,
        cursor: INITIAL_CURSOR,
        lockedNodeIds: [],
        skipRequested: false,
      });
      skipRequestedRef.current = false;

      return result;
    },
    [agentState.cursor],
  );

  const startAgentWaiting = useCallback(
    (title: string, label: string, nodeIds?: string[]) => {
      const cursor = resolveStepCursor({ cardIndex: 0 }, nodeIds) || agentState.cursor;
      setAgentState({
        running: true,
        phase: 'waiting',
        plan: {
          id: 'agent-waiting',
          title,
          steps: [
            {
              id: 'agent-waiting-step',
              type: 'think',
              label,
            },
          ],
        },
        activeStepIndex: 0,
        cursor,
        lockedNodeIds: nodeIds || [],
        skipRequested: false,
      });
    },
    [agentState.cursor],
  );

  const stopAgentWaiting = useCallback(() => {
    setAgentState((state) => {
      if (state.phase !== 'waiting') return state;
      return {
        running: false,
        phase: 'idle',
        plan: null,
        activeStepIndex: -1,
        cursor: state.cursor,
        lockedNodeIds: [],
        skipRequested: false,
      };
    });
  }, []);

  return {
    agentState,
    runAgentCardPlacement,
    startAgentWaiting,
    stopAgentWaiting,
    requestSkipAgent,
  };
};

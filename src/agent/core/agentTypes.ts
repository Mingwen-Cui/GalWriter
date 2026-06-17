import type { AssistantCardPlacementMode, AssistantCardPlacementOptions } from '../planning/agentCardDraft';

export type AgentStepType =
  | 'think'
  | 'move-pointer'
  | 'click'
  | 'focus'
  | 'create-card'
  | 'type-field'
  | 'connect'
  | 'arrange'
  | 'complete';

export type AgentStepStatus = 'pending' | 'running' | 'done';

export interface AgentCursorTarget {
  x: number;
  y: number;
}

export interface AgentStep {
  id: string;
  type: AgentStepType;
  label: string;
  durationMs?: number;
  cursor?: AgentCursorTarget;
  cardIndex?: number;
  fieldKey?: string;
  status?: AgentStepStatus;
}

export interface AgentPlan {
  id: string;
  title: string;
  steps: AgentStep[];
}

export interface AgentRunState {
  running: boolean;
  phase: 'idle' | 'running' | 'waiting';
  plan: AgentPlan | null;
  activeStepIndex: number;
  cursor: AgentCursorTarget;
  lockedNodeIds: string[];
  skipRequested: boolean;
}

export interface AgentCardPlacementRequest<TCardDraft> {
  cards: TCardDraft[];
  mode: AssistantCardPlacementMode;
  options?: AssistantCardPlacementOptions;
  selectedCount: number;
}

export interface AgentCardPlacementResult {
  count: number;
  position?: { x: number; y: number; zoom?: number };
  nodeIds?: string[];
}

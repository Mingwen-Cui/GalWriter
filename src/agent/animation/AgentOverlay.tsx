import { MousePointer2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { AgentCursorTarget, AgentRunState, AgentStep } from '../core/agentTypes';
import '../styles/agent.css';

interface AgentOverlayProps {
  state: AgentRunState;
  onSkip: () => void;
}

interface AgentNodeRect {
  nodeId: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

const escapeAttributeValue = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const getElementPoint = (element: Element): AgentCursorTarget => {
  const rect = element.getBoundingClientRect();
  return {
    x: Math.max(8, rect.left + Math.min(22, rect.width / 2)),
    y: Math.max(8, rect.top + rect.height / 2),
  };
};

const findNodeElement = (nodeId: string) => {
  const safeNodeId = escapeAttributeValue(nodeId);
  return document.querySelector(
    `[data-agent-node-id="${safeNodeId}"], .react-flow__node[data-id="${safeNodeId}"]`,
  );
};

const readCursorTarget = (
  state: AgentRunState,
  activeStep: AgentStep | undefined,
): AgentCursorTarget | null => {
  const nodeId =
    typeof activeStep?.cardIndex === 'number'
      ? state.lockedNodeIds[activeStep.cardIndex]
      : state.lockedNodeIds[0];
  if (!nodeId) return null;

  const nodeElement = findNodeElement(nodeId);
  if (!nodeElement) return null;

  if (activeStep?.fieldKey) {
    const safeFieldKey = escapeAttributeValue(activeStep.fieldKey);
    const fieldElement = nodeElement.querySelector(`[data-agent-field="${safeFieldKey}"]`);
    if (fieldElement) return getElementPoint(fieldElement);
  }

  return getElementPoint(nodeElement);
};

const readNodeRects = (nodeIds: string[]): AgentNodeRect[] =>
  nodeIds
    .map((nodeId) => {
      const element = findNodeElement(nodeId);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        nodeId,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
    })
    .filter((rect): rect is AgentNodeRect => Boolean(rect));

export function AgentOverlay({ state, onSkip }: AgentOverlayProps) {
  const [nodeRects, setNodeRects] = useState<AgentNodeRect[]>([]);
  const [displayCursor, setDisplayCursor] = useState<AgentCursorTarget>(state.cursor);
  const activeStep = state.plan?.steps[state.activeStepIndex];
  const isWaiting = state.phase === 'waiting';
  const isTyping = activeStep?.type === 'type-field';
  const badgeText = isWaiting
    ? '正在生成...'
    : activeStep?.type === 'type-field'
      ? '正在输入...'
      : activeStep?.type === 'create-card'
        ? '正在创建...'
        : activeStep?.type === 'arrange'
          ? '正在整理...'
          : '正在处理...';
  const lockedNodeIdsKey = useMemo(() => state.lockedNodeIds.join('|'), [state.lockedNodeIds]);

  useEffect(() => {
    if (!state.running || state.lockedNodeIds.length === 0) {
      setNodeRects([]);
      setDisplayCursor(state.cursor);
      return;
    }

    let frameId = 0;
    let stopped = false;
    const updateRects = () => {
      setNodeRects(readNodeRects(state.lockedNodeIds));
      setDisplayCursor(readCursorTarget(state, activeStep) || state.cursor);
      if (!stopped) frameId = window.requestAnimationFrame(updateRects);
    };

    updateRects();
    return () => {
      stopped = true;
      window.cancelAnimationFrame(frameId);
    };
  }, [activeStep, lockedNodeIdsKey, state]);

  if (!state.running || !state.plan) return null;

  return (
    <div className="agent-overlay" aria-live="polite">
      {nodeRects.map((rect, index) => (
        <div
          key={`lock-${rect.nodeId}`}
          className="agent-card-lock"
          style={{
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
          }}
        >
          {index === 0 && (
            <div className="agent-card-badge">
              <span className="agent-card-badge-dot" />
              <span>{badgeText}</span>
              {!isWaiting && (
                <button type="button" onClick={onSkip}>
                  跳过
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      <div
        className={`agent-cursor ${isWaiting ? 'agent-cursor-waiting' : ''} ${
          isTyping ? 'agent-cursor-typing' : ''
        }`}
        style={{
          transform: `translate3d(${displayCursor.x}px, ${displayCursor.y}px, 0)`,
        }}
      >
        {isTyping ? (
          <i className="agent-text-caret" aria-hidden="true" />
        ) : (
          <MousePointer2 size={24} strokeWidth={2.5} />
        )}
        {!isWaiting && <span>AI Agent</span>}
      </div>
    </div>
  );
}

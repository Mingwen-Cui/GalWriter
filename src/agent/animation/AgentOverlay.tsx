import { MousePointer2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { AgentRunState } from '../core/agentTypes';
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

const readNodeRects = (nodeIds: string[]): AgentNodeRect[] =>
  nodeIds
    .map((nodeId) => {
      const safeNodeId = escapeAttributeValue(nodeId);
      const element = document.querySelector(
        `[data-agent-node-id="${safeNodeId}"], .react-flow__node[data-id="${safeNodeId}"]`,
      );
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
  const activeStep = state.plan?.steps[state.activeStepIndex];
  const isWaiting = state.phase === 'waiting';
  const lockedNodeIdsKey = useMemo(() => state.lockedNodeIds.join('|'), [state.lockedNodeIds]);

  useEffect(() => {
    if (!state.running || state.lockedNodeIds.length === 0) {
      setNodeRects([]);
      return;
    }

    let frameId = 0;
    let stopped = false;
    const updateRects = () => {
      setNodeRects(readNodeRects(state.lockedNodeIds));
      if (!stopped) frameId = window.requestAnimationFrame(updateRects);
    };

    updateRects();
    return () => {
      stopped = true;
      window.cancelAnimationFrame(frameId);
    };
  }, [state.running, lockedNodeIdsKey, state.lockedNodeIds]);

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
              <span>{activeStep?.label || state.plan.title}</span>
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
        className={`agent-cursor ${isWaiting ? 'agent-cursor-waiting' : ''}`}
        style={{
          transform: `translate3d(${state.cursor.x}px, ${state.cursor.y}px, 0)`,
        }}
      >
        <MousePointer2 size={24} strokeWidth={2.5} />
        {!isWaiting && <span>AI Agent</span>}
      </div>
    </div>
  );
}

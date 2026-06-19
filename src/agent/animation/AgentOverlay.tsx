import { MousePointer2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { AgentCursorTarget, AgentRunState, AgentStep } from '../core/agentTypes';
import type { Language } from '../../lib/i18n';
import '../styles/agent.css';

interface AgentOverlayProps {
  state: AgentRunState;
  language: Language;
}

interface AgentNodeRect {
  nodeId: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

const escapeAttributeValue = (value: string) => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const getElementPoint = (element: Element): AgentCursorTarget => {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + Math.min(22, rect.width / 2),
    y: rect.top + rect.height / 2,
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

const agentLabelByLanguage: Record<Language, string> = {
  zh: 'AI 助手',
  ja: 'AIエージェント',
  en: 'AI Agent',
};

const EDGE_INDICATOR_MARGIN = 30;

const isCursorInViewport = (cursor: AgentCursorTarget, viewport: ViewportSize) =>
  cursor.x >= 0 &&
  cursor.y >= 0 &&
  cursor.x <= Math.max(0, viewport.width - EDGE_INDICATOR_MARGIN) &&
  cursor.y <= Math.max(0, viewport.height - EDGE_INDICATOR_MARGIN);

const getOffscreenIndicator = (cursor: AgentCursorTarget, viewport: ViewportSize) => {
  const x = Math.min(
    Math.max(cursor.x, EDGE_INDICATOR_MARGIN),
    Math.max(EDGE_INDICATOR_MARGIN, viewport.width - EDGE_INDICATOR_MARGIN),
  );
  const y = Math.min(
    Math.max(cursor.y, EDGE_INDICATOR_MARGIN),
    Math.max(EDGE_INDICATOR_MARGIN, viewport.height - EDGE_INDICATOR_MARGIN),
  );
  const angle = (Math.atan2(cursor.y - y, cursor.x - x) * 180) / Math.PI;
  return { x, y, angle };
};

export function AgentOverlay({ state, language }: AgentOverlayProps) {
  const [nodeRects, setNodeRects] = useState<AgentNodeRect[]>([]);
  const [displayCursor, setDisplayCursor] = useState<AgentCursorTarget>(state.cursor);
  const [viewport, setViewport] = useState<ViewportSize>(() => ({
    width: typeof window === 'undefined' ? 0 : window.innerWidth,
    height: typeof window === 'undefined' ? 0 : window.innerHeight,
  }));
  const activeStep = state.plan?.steps[state.activeStepIndex];
  const isWaiting = state.phase === 'waiting';
  const isTyping = activeStep?.type === 'type-field';
  const agentLabel = agentLabelByLanguage[language];
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
  const cursorVisible = isCursorInViewport(displayCursor, viewport);
  const offscreenIndicator = cursorVisible
    ? null
    : getOffscreenIndicator(displayCursor, viewport);

  useEffect(() => {
    const updateViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

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
            </div>
          )}
        </div>
      ))}

      <div
        className={`agent-cursor ${isWaiting ? 'agent-cursor-waiting' : ''} ${
          isTyping ? 'agent-cursor-typing' : ''
        } ${cursorVisible ? '' : 'agent-cursor-offscreen'}`}
        style={{
          transform: `translate3d(${displayCursor.x}px, ${displayCursor.y}px, 0)`,
        }}
      >
        {isTyping ? (
          <i className="agent-text-caret" aria-hidden="true" />
        ) : isWaiting ? (
          <>
            <MousePointer2 size={24} strokeWidth={2.5} />
            <div className="agent-waiting-stack" aria-label={agentLabel}>
              <span className="agent-loader" aria-hidden="true" />
              <span className="agent-waiting-pill">
                <span className="agent-waiting-label">{agentLabel}</span>
              </span>
            </div>
          </>
        ) : (
          <MousePointer2 size={24} strokeWidth={2.5} />
        )}
        {!isWaiting && <span>{agentLabel}</span>}
      </div>

      {offscreenIndicator && (
        <div
          className="agent-offscreen-indicator"
          style={{
            transform: `translate3d(${offscreenIndicator.x}px, ${offscreenIndicator.y}px, 0) translate(-50%, -50%)`,
          }}
          aria-label={agentLabel}
        >
          <span
            className="agent-offscreen-arrow"
            style={{ transform: `rotate(${offscreenIndicator.angle}deg)` }}
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
}

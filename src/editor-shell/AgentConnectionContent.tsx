import { Bot, Check, Copy, Download, X } from 'lucide-react';
import { useState } from 'react';

import { FULL_BUILD_DOWNLOAD_URL } from '../lib/appAssets';
import type { Language } from '../lib/i18n';
import { isTauriRuntime } from '../lib/tauriRuntime';
import { assistantPanelCopy } from './i18n/assistant';

export function AgentConnectionContent({
  language,
  connected,
  showConnectionIndicator = false,
  onShowConnectionIndicatorChange,
  inline = false,
  onClose,
}: {
  language: Language;
  connected: boolean;
  showConnectionIndicator?: boolean;
  onShowConnectionIndicatorChange?: (checked: boolean) => void;
  inline?: boolean;
  onClose?: () => void;
}) {
  const ui = assistantPanelCopy(language);
  const [status, setStatus] = useState('');
  const titleId = inline ? 'assistant-agent-connect-settings-title' : 'assistant-agent-connect-title';
  const canObserveConnection = isTauriRuntime() || import.meta.env.DEV;
  const isConnected = connected;

  const content = (
    <section
      className={`assistant-agent-connect-dialog${inline ? ' assistant-agent-connect-inline' : ''}${
        isTauriRuntime() && !inline ? ' assistant-agent-connect-desktop-dialog' : ''
      }`}
      {...(!inline ? {
        role: 'dialog',
        'aria-modal': true,
        'aria-labelledby': titleId,
      } : {})}
    >
      <div className={`assistant-agent-connect-heading${inline ? ' assistant-agent-connect-inline-heading' : ''}`}>
        <div className="assistant-agent-connect-mark"><Bot className="h-5 w-5" /></div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="assistant-agent-connect-close"
            aria-label={ui.close}
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {!inline && <h2 id={titleId}>{ui.agentConnectDialogTitle}</h2>}
        <p>
          {isTauriRuntime() ? ui.agentConnectDesktopDescription : (
            <>
              <strong className="assistant-agent-connect-browser-warning">
                {ui.agentConnectBrowserMcpWarning}
              </strong>{' '}
              {ui.agentConnectDialogDescription}
            </>
          )}
        </p>
      </div>
      {!inline && (
        <div className="assistant-agent-connect-overview">
          <img
            className="assistant-agent-connect-overview-image"
            src="/assistant/agent-connect-overview.png"
            alt={ui.agentConnectOverviewAlt}
          />
          <div className="assistant-agent-connect-overview-copy">
            <span
              className="assistant-agent-connect-overview-label"
              data-tooltip={ui.agentConnectAssistantDescription}
              aria-label={`${ui.agentConnectAssistantTitle}：${ui.agentConnectAssistantDescription}`}
              tabIndex={0}
            >
              {ui.agentConnectAssistantTitle}
            </span>
            <span
              className="assistant-agent-connect-overview-label"
              data-tooltip={ui.agentConnectMcpDescription}
              aria-label={`${ui.agentConnectMcpTitle}：${ui.agentConnectMcpDescription}`}
              tabIndex={0}
            >
              {ui.agentConnectMcpTitle}
            </span>
          </div>
        </div>
      )}
      {!inline && <div className="assistant-agent-connect-divider" aria-hidden="true" />}
      <div className={`assistant-agent-connect-actions${inline ? ' assistant-agent-connect-inline-actions' : ''}`}>
        {!isTauriRuntime() && !import.meta.env.DEV && (
          <div className="assistant-agent-connect-step">
            <span className="assistant-agent-connect-step-label">{ui.agentConnectStepOne}</span>
            <a
              className="assistant-agent-connect-action assistant-agent-connect-download"
              href={FULL_BUILD_DOWNLOAD_URL}
              target="_blank"
              rel="noreferrer"
            >
              <Download className="h-4 w-4" />
              {ui.agentConnectDownloadButton}
            </a>
          </div>
        )}
        <div className="assistant-agent-connect-step">
          <span className="assistant-agent-connect-step-label">
            {canObserveConnection ? ui.agentConnectStepOne : ui.agentConnectStepTwo}
          </span>
          <button
            type="button"
            className="assistant-agent-connect-action assistant-agent-connect-action--primary"
            onClick={async () => {
              try {
                if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
                const endpoint = isTauriRuntime()
                  ? 'http://127.0.0.1:38941/mcp'
                  : import.meta.env.DEV
                    ? `${window.location.origin}/mcp`
                    : 'http://127.0.0.1:38941/mcp';
                await navigator.clipboard.writeText(
                  ui.agentConnectCopyPrompt.replace('http://127.0.0.1:38941/mcp', endpoint),
                );
                setStatus(ui.agentConnectCopied);
              } catch {
                setStatus(ui.agentConnectCopyFailed);
              }
            }}
          >
            <Copy className="h-4 w-4" />
            {ui.agentConnectCopyButton}
          </button>
        </div>
        {canObserveConnection && (
          <div className="assistant-agent-connect-step">
            <span className="assistant-agent-connect-step-label">{ui.agentConnectStepTwo}</span>
            <div
              className={`assistant-agent-connect-connection${isConnected ? ' is-connected' : ''}`}
              role="status"
              aria-live="polite"
            >
              <span className="assistant-agent-connect-connection-indicator" aria-hidden="true">
                {isConnected && <Check className="h-4 w-4" />}
              </span>
              {isConnected && onShowConnectionIndicatorChange ? (
                <label className="assistant-agent-connect-toggle">
                  <input
                    type="checkbox"
                    checked={showConnectionIndicator}
                    onChange={(event) => onShowConnectionIndicatorChange(event.target.checked)}
                  />
                  <span>{ui.agentConnectShowIndicator}</span>
                </label>
              ) : (
                <span>{isConnected ? ui.agentConnectConnected : ui.agentConnectWaiting}</span>
              )}
            </div>
          </div>
        )}
      </div>
      {status && (
        <div className="assistant-agent-connect-status" role="status">
          <span className="assistant-agent-connect-status-dot" />
          {status}
        </div>
      )}
    </section>
  );

  return content;
}

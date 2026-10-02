import { Bot, Copy, Download, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';

import { FULL_BUILD_DOWNLOAD_URL } from '../lib/appAssets';
import { getTauriInvoke, isTauriRuntime } from '../lib/tauriRuntime';
import type { Language } from '../lib/i18n';
import { assistantPanelCopy } from './i18n/assistant';

export function AgentConnectionContent({
  language,
  inline = false,
  onClose,
}: {
  language: Language;
  inline?: boolean;
  onClose?: () => void;
}) {
  const ui = assistantPanelCopy(language);
  const [status, setStatus] = useState('');
  const [checking, setChecking] = useState(false);

  return (
    <section
      className={`assistant-agent-connect-dialog${inline ? ' assistant-agent-connect-inline' : ''}`}
      {...(!inline ? {
        role: 'dialog',
        'aria-modal': true,
        'aria-labelledby': 'assistant-agent-connect-title',
      } : {})}
    >
      <div className="assistant-agent-connect-heading">
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
        <h2 id="assistant-agent-connect-title">{ui.agentConnectDialogTitle}</h2>
        <p>{isTauriRuntime() ? ui.agentConnectDesktopDescription : ui.agentConnectDialogDescription}</p>
      </div>
      <div className="assistant-agent-connect-actions">
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
            {isTauriRuntime() || import.meta.env.DEV ? ui.agentConnectStepOne : ui.agentConnectStepTwo}
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
        {(isTauriRuntime() || import.meta.env.DEV) && (
          <div className="assistant-agent-connect-step">
            <span className="assistant-agent-connect-step-label">{ui.agentConnectStepTwo}</span>
            <button
              type="button"
              className="assistant-agent-connect-action"
              disabled={checking}
              onClick={async () => {
                setChecking(true);
                try {
                  if (!isTauriRuntime() && !import.meta.env.DEV) {
                    setStatus(ui.agentConnectBrowserOnly);
                    return;
                  }
                  if (isTauriRuntime()) {
                    const invoke = await getTauriInvoke();
                    if (!invoke) throw new Error('Desktop bridge unavailable');
                    const result = await invoke('get_galwriter_mcp_status') as {
                      serverAvailable: boolean;
                      projectAvailable: boolean;
                      projectTitle: string | null;
                      nodeCount: number;
                    };
                    if (!result.serverAvailable) throw new Error('Desktop MCP server is unavailable');
                    const toolNames = [
                      'get_connection_status', 'get_current_project', 'list_project_cards', 'list_project_assets',
                      'update_story_node', 'update_project_node', 'set_story_text', 'set_story_presentation',
                      'create_story_node', 'create_character_node', 'create_scene_node', 'connect_story_nodes',
                      'disconnect_story_nodes', 'delete_story_node', 'move_story_node', 'set_story_media',
                      'preview_story_changes', 'apply_story_changes', 'save_current_project', 'export_current_project',
                    ];
                    setStatus(
                      result.projectAvailable
                        ? `${ui.agentConnectServerReady} · ${toolNames.join(', ')} · ${result.projectTitle || ui.agentConnectUntitled} · ${result.nodeCount} ${ui.agentConnectCards}`
                        : `${ui.agentConnectServerReady} · ${toolNames.join(', ')} · ${ui.agentConnectProjectMissing}`,
                    );
                    return;
                  }
                  const response = await fetch('/__galwriter/mcp/status', { cache: 'no-store' });
                  if (!response.ok) throw new Error('MCP server is unavailable');
                  const serverStatus = await response.json() as {
                    serverAvailable: boolean;
                    projectAvailable: boolean;
                    projectTitle: string | null;
                    nodeCount: number;
                  };
                  if (!serverStatus.serverAvailable) throw new Error('MCP server is unavailable');
                  const callMcp = async (id: number, method: string, params?: unknown) => {
                    const mcpResponse = await fetch('/mcp', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json, text/event-stream',
                      },
                      body: JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) }),
                    });
                    if (!mcpResponse.ok) throw new Error('MCP protocol request failed');
                    return await mcpResponse.json() as {
                      result?: {
                        tools?: Array<{ name: string }>;
                        content?: Array<{ type: string; text?: string }>;
                        isError?: boolean;
                      };
                    };
                  };
                  await callMcp(1, 'initialize', {
                    protocolVersion: '2025-11-25',
                    capabilities: {},
                    clientInfo: { name: 'galwriter-connection-check', version: '1.0.0' },
                  });
                  const initialized = await fetch('/mcp', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Accept: 'application/json, text/event-stream',
                    },
                    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
                  });
                  if (!initialized.ok) throw new Error('MCP initialization failed');
                  const toolsResult = await callMcp(2, 'tools/list');
                  const toolNames = (toolsResult.result?.tools || []).map((tool) => tool.name);
                  if (!toolNames.length) throw new Error('MCP tool discovery failed');
                  if (serverStatus.projectAvailable) {
                    const projectResult = await callMcp(3, 'tools/call', {
                      name: 'get_current_project',
                      arguments: {},
                    });
                    if (projectResult.result?.isError || !projectResult.result?.content?.length) {
                      throw new Error('Current project read failed');
                    }
                  }
                  setStatus(
                    serverStatus.projectAvailable
                      ? `${ui.agentConnectServerReady} · ${toolNames.join(', ')} · ${serverStatus.projectTitle || ui.agentConnectUntitled} · ${serverStatus.nodeCount} ${ui.agentConnectCards} · ${ui.agentConnectReadVerified}`
                      : `${ui.agentConnectServerReady} · ${toolNames.join(', ')} · ${ui.agentConnectProjectMissing}`,
                  );
                } catch {
                  setStatus(ui.agentConnectServerMissing);
                } finally {
                  setChecking(false);
                }
              }}
            >
              <RefreshCw className={`h-4 w-4${checking ? ' animate-spin' : ''}`} />
              {ui.agentConnectTestButton}
            </button>
          </div>
        )}
      </div>
      {isTauriRuntime() && <p className="assistant-agent-connect-browser-note">{ui.agentConnectDesktopNote}</p>}
      {status && (
        <div className="assistant-agent-connect-status" role="status">
          <span className="assistant-agent-connect-status-dot" />
          {status}
        </div>
      )}
    </section>
  );
}

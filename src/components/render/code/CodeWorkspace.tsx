import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  FileCode2,
  Info,
  Plus,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { Language } from '../../../lib/i18n';
import { buildCodeProjectPreview } from './codeExport/exportProject';
import { repairRenpyCodeNames } from './codeExport/model';
import type { CodeExportTarget, TargetCapability } from './codeExport/targets/targetTypes';
import type { CodeDiagnostic, RenpyExportSettings } from './codeExport/types';
import { addVariable, CharacterInspector, NodeInspector, VariableInspector } from './CodeInspector';
import { CodePreview } from './CodePreview';
import { CodeRibbon, type CodeWorkspaceTab } from './CodeRibbon';
import { type CodeTextKey, getCodeText } from './i18n';

type CodeWorkspaceProps = {
  nodes: import('@xyflow/react').Node[];
  edges: import('@xyflow/react').Edge[];
  language: Language;
  projectName: string;
  target: CodeExportTarget;
  settings: RenpyExportSettings;
  onSettingsChange: (settings: RenpyExportSettings) => void;
};

export function CodeWorkspace({
  nodes,
  edges,
  language,
  projectName,
  target,
  settings,
  onSettingsChange,
}: CodeWorkspaceProps) {
  const [tab, setTab] = useState<CodeWorkspaceTab>('project');
  const [selectedFile, setSelectedFile] = useState('game/script.rpy');
  const [selectedCharacterId, setSelectedCharacterId] = useState(
    settings.characters[0]?.sourceNodeId || '',
  );
  const [selectedVariableId, setSelectedVariableId] = useState(
    settings.variables[0]?.id || 'gw_score',
  );
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [copiedFilePath, setCopiedFilePath] = useState('');
  const preview = useMemo(
    () => buildCodeProjectPreview(nodes, edges, projectName, settings, target),
    [nodes, edges, projectName, settings, target],
  );
  const errors = preview.diagnostics.filter((item) => item.level === 'error');
  const warnings = preview.diagnostics.filter((item) => item.level === 'warning');
  const selected = preview.files.find((file) => file.path === selectedFile) || preview.files[0];
  const runtimeNodes = nodes.filter(
    (node) =>
      (node.type === 'storyNode' || node.type === 'numberConditionNode') &&
      node.data?.hidden !== true,
  );
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);

  useEffect(() => {
    if (JSON.stringify(settings) !== JSON.stringify(preview.settings))
      onSettingsChange(preview.settings);
  }, [onSettingsChange, preview.settings, settings]);

  useEffect(() => {
    if (!preview.files.some((file) => file.path === selectedFile))
      setSelectedFile(preview.files[0]?.path || '');
  }, [preview.files, selectedFile]);

  const setSettings = (next: RenpyExportSettings) => onSettingsChange(next);
  const copySelectedFile = async () => {
    if (!selected) return;
    await navigator.clipboard.writeText(selected.content);
    setCopiedFilePath(selected.path);
    window.setTimeout(
      () => setCopiedFilePath((current) => (current === selected.path ? '' : current)),
      1_600,
    );
  };
  const fileTree = (
    <aside className="w-64 shrink-0 overflow-y-auto border-r border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-3">
      <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-[var(--vr-text-muted)]">
        {getCodeText(language, 'Project tree')}
      </div>
      {preview.files.map((file) => (
        <button
          key={file.path}
          type="button"
          onClick={() => {
            setSelectedFile(file.path);
            setTab('project');
          }}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${selected?.path === file.path && tab === 'project' ? 'bg-[var(--vr-accent-soft)] text-[var(--vr-accent-strong)]' : 'text-[var(--vr-text-muted)] hover:bg-white/5'}`}
        >
          <FileCode2 className="h-3.5 w-3.5" />
          <span className="truncate">{file.path}</span>
          {file.generated === false && (
            <span className="ml-auto text-[9px] text-amber-400">custom</span>
          )}
        </button>
      ))}
    </aside>
  );

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--vr-bg)] text-[var(--vr-text)]">
      <CodeRibbon
        language={language}
        tab={tab}
        splitMode={settings.splitMode}
        onTab={setTab}
        onSplitMode={(splitMode) => setSettings({ ...settings, splitMode })}
        onRepairCodes={() => setSettings(repairRenpyCodeNames(settings))}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {fileTree}
        <section className="min-w-0 flex-1 overflow-auto">
          {tab === 'project' && (
            <div className="min-h-full min-w-full bg-[#10151f] p-4">
              <div className="mb-3 flex items-center justify-between text-[11px] text-slate-400">
                <span>{selected?.path}</span>
                <button
                  type="button"
                  onClick={copySelectedFile}
                  disabled={!selected}
                  className="flex h-7 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-[10px] font-bold text-slate-300 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
                >
                  {copiedFilePath === selected?.path ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {getCodeText(
                    language,
                    copiedFilePath === selected?.path ? 'Copied' : 'Copy code',
                  )}
                </button>
              </div>
              <CodePreview
                content={selected?.content || ''}
                path={selected?.path || ''}
                target={target}
                language={language}
              />
            </div>
          )}
          {tab === 'flow' && (
            <div className="space-y-2 p-5">
              {Object.entries(preview.manifest.nodes).map(([nodeId, mapping]) => (
                <div
                  key={nodeId}
                  className="rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-3"
                >
                  <div className="font-mono text-xs text-[var(--vr-accent-strong)]">
                    {mapping.label}
                  </div>
                  <div className="mt-1 text-sm font-bold">
                    {String(nodes.find((node) => node.id === nodeId)?.data?.title || nodeId)}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-[var(--vr-text-muted)]">
                    {nodeId} → {mapping.file}
                  </div>
                </div>
              ))}
            </div>
          )}
          {tab === 'characters' && (
            <ListView title={getCodeText(language, 'Characters and dialogue')}>
              {settings.characters.map((character) => (
                <button
                  key={character.sourceNodeId}
                  type="button"
                  onClick={() => setSelectedCharacterId(character.sourceNodeId)}
                  className={`w-full rounded-lg border p-3 text-left ${selectedCharacterId === character.sourceNodeId ? 'border-[var(--vr-accent)] bg-[var(--vr-accent-soft)]' : 'border-[var(--vr-border)]'}`}
                >
                  <div className="text-sm font-bold">{character.displayName}</div>
                  <div className="mt-1 font-mono text-[11px] text-[var(--vr-text-muted)]">
                    define {character.codeName} = Character(…)
                  </div>
                  <div className="mt-1 text-[10px] text-[var(--vr-text-muted)]">
                    {Object.keys(character.expressions).length}{' '}
                    {getCodeText(language, 'expressions')}
                  </div>
                </button>
              ))}
            </ListView>
          )}
          {tab === 'variables' && (
            <ListView
              title={getCodeText(language, 'Variable model')}
              action={
                <button
                  type="button"
                  onClick={() => setSettings(addVariable(settings))}
                  className="flex items-center gap-1 text-xs text-[var(--vr-accent-strong)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {getCodeText(language, 'Add variable')}
                </button>
              }
            >
              {settings.variables.map((variable) => (
                <button
                  key={variable.id}
                  type="button"
                  onClick={() => setSelectedVariableId(variable.id)}
                  className={`w-full rounded-lg border p-3 text-left ${selectedVariableId === variable.id ? 'border-[var(--vr-accent)] bg-[var(--vr-accent-soft)]' : 'border-[var(--vr-border)]'}`}
                >
                  <div className="flex items-center justify-between">
                    <b className="text-sm">{variable.displayName}</b>
                    <span className="rounded bg-black/10 px-1.5 py-0.5 font-mono text-[10px]">
                      {variable.type}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-[var(--vr-text-muted)]">
                    default {variable.codeName} = {String(variable.initialValue)}
                  </div>
                </button>
              ))}
            </ListView>
          )}
          {tab === 'assets' && (
            <div className="p-5">
              <h3 className="mb-4 text-sm font-black">
                {getCodeText(language, 'Asset inspection')}
              </h3>
              <div className="overflow-hidden rounded-lg border border-[var(--vr-border)]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--vr-surface-strong)] text-[10px] text-[var(--vr-text-muted)]">
                    <tr>
                      <th className="p-2">{getCodeText(language, 'Source node')}</th>
                      <th className="p-2">{getCodeText(language, 'Type')}</th>
                      <th className="p-2">{getCodeText(language, 'Export path')}</th>
                      <th className="p-2">{getCodeText(language, 'Compatibility')}</th>
                      <th className="p-2">{getCodeText(language, 'Referenced')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.assets.map((asset) => (
                      <tr key={asset.id} className="border-t border-[var(--vr-border)]">
                        <td className="p-2 font-mono text-[10px]">
                          {asset.sourceNodeIds.join(', ')}
                        </td>
                        <td className="p-2">
                          {getCodeText(
                            language,
                            asset.kind === 'image'
                              ? 'Image'
                              : asset.kind === 'audio'
                                ? 'Audio'
                                : 'Video',
                          )}
                        </td>
                        <td className="p-2 font-mono text-[10px]">
                          {preview.manifest.assets
                            .find((item) => item.sourcePath === asset.path)
                            ?.targetPaths.join(', ') || asset.path}
                        </td>
                        <td
                          className={`p-2 ${asset.compatibility === 'compatible' ? 'text-emerald-400' : asset.compatibility === 'unreadable' ? 'text-red-400' : 'text-amber-400'}`}
                          title={asset.note}
                        >
                          {getCodeText(
                            language,
                            asset.compatibility === 'compatible'
                              ? 'Compatible'
                              : asset.compatibility === 'risk'
                                ? 'Compatibility risk'
                                : asset.compatibility === 'unreadable'
                                  ? 'Unreadable'
                                  : 'Unknown compatibility',
                          )}
                        </td>
                        <td className="p-2">
                          {getCodeText(language, asset.referenced ? 'Yes' : 'No')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.assets.length === 0 && (
                  <div className="p-5 text-center text-[var(--vr-text-muted)]">
                    {getCodeText(language, 'No assets')}
                  </div>
                )}
              </div>
            </div>
          )}
          {tab === 'diagnostics' && (
            <Diagnostics diagnostics={preview.diagnostics} language={language} target={target} />
          )}
        </section>
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-[var(--vr-border)] bg-[var(--vr-surface-soft)]">
          <CapabilityPanel
            capabilities={preview.capabilities}
            language={language}
            target={target}
          />
          {tab === 'characters' ? (
            (() => {
              const character =
                settings.characters.find((item) => item.sourceNodeId === selectedCharacterId) ||
                settings.characters[0];
              return character ? (
                <CharacterInspector
                  character={character}
                  language={language}
                  onChange={(value) =>
                    setSettings({
                      ...settings,
                      characters: settings.characters.map((item) =>
                        item.sourceNodeId === value.sourceNodeId ? value : item,
                      ),
                    })
                  }
                />
              ) : (
                <Empty text={getCodeText(language, 'No character nodes in project')} />
              );
            })()
          ) : tab === 'variables' ? (
            (() => {
              const variable =
                settings.variables.find((item) => item.id === selectedVariableId) ||
                settings.variables[0];
              return variable ? (
                <VariableInspector
                  variable={variable}
                  language={language}
                  onChange={(value) =>
                    setSettings({
                      ...settings,
                      variables: settings.variables.map((item) =>
                        item.id === value.id ? value : item,
                      ),
                    })
                  }
                  onDelete={() =>
                    setSettings({
                      ...settings,
                      variables: settings.variables.filter((item) => item.id !== variable.id),
                    })
                  }
                />
              ) : null;
            })()
          ) : (
            <div className="p-3">
              <h3 className="mb-3 text-xs font-black">
                {getCodeText(language, 'Story and condition inspector')}
              </h3>
              <select
                className="h-8 w-full rounded-md border border-[var(--vr-border)] bg-[var(--vr-bg)] px-2 text-xs"
                value={selectedNodeId}
                onChange={(event) => setSelectedNodeId(event.target.value)}
              >
                <option value="">
                  {getCodeText(language, 'Select a story or condition node')}
                </option>
                {runtimeNodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {String(
                      node.data?.title ||
                        (node.type === 'numberConditionNode'
                          ? getCodeText(language, 'Number condition')
                          : node.id),
                    )}
                  </option>
                ))}
              </select>
              {selectedNode && (
                <NodeInspector
                  nodeId={selectedNode.id}
                  settings={settings}
                  language={language}
                  isCondition={selectedNode.type === 'numberConditionNode'}
                  legacyCondition={
                    selectedNode.type === 'numberConditionNode'
                      ? {
                          threshold:
                            typeof selectedNode.data.threshold === 'number'
                              ? selectedNode.data.threshold
                              : 0,
                          ranges: Array.isArray(selectedNode.data.ranges)
                            ? (selectedNode.data.ranges as Array<{
                                id: string;
                                min: number;
                                max: number;
                              }>)
                            : [],
                        }
                      : undefined
                  }
                  onChange={setSettings}
                />
              )}
              <div className="mt-4 space-y-2">
                <Summary
                  icon={CheckCircle2}
                  label={getCodeText(language, 'Runtime nodes')}
                  value={String(runtimeNodes.length)}
                />
                <Summary
                  icon={AlertTriangle}
                  label={getCodeText(language, 'Errors')}
                  value={String(errors.length)}
                  danger={errors.length > 0}
                />
                <Summary
                  icon={AlertTriangle}
                  label={getCodeText(language, 'Warnings')}
                  value={String(warnings.length)}
                />
              </div>
            </div>
          )}
        </aside>
      </div>
      <div className="flex shrink-0 items-center justify-between border-t border-[var(--vr-border)] bg-[var(--vr-surface-strong)] px-4 py-2 text-[11px] text-[var(--vr-text-muted)]">
        <span>{getCodeText(language, 'Phase three: shared IR and multi-engine export')}</span>
        <span className={errors.length ? 'text-red-400' : 'text-emerald-400'}>
          {errors.length
            ? getCodeText(language, 'Fix blocking errors')
            : getCodeText(language, 'Ready to export')}
        </span>
      </div>
    </main>
  );
}

function ListView({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-black">{title}</h3>
        {action}
      </div>
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">{children}</div>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="p-4 text-xs text-[var(--vr-text-muted)]">{text}</div>;
}
const capabilityLabelKeys: Partial<Record<string, CodeTextKey>> = {
  flow: 'Core story flow',
  characters: 'Characters and portraits',
  media: 'Audio and video',
  animation: 'Complex inline animation',
  background: 'Backgrounds',
  ir: 'GalWriter semantic IR',
  presentation: 'Target-specific presentation',
};
const capabilityDetailKeys: Partial<Record<string, CodeTextKey>> = {
  'renpy:flow': 'RenPy flow detail',
  'renpy:characters': 'RenPy characters detail',
  'renpy:media': 'RenPy media detail',
  'renpy:animation': 'RenPy animation detail',
  'tyrano:flow': 'Tyrano flow detail',
  'tyrano:characters': 'Tyrano characters detail',
  'tyrano:media': 'Tyrano media detail',
  'tyrano:animation': 'Tyrano animation detail',
  'dialogic:flow': 'Dialogic flow detail',
  'dialogic:characters': 'Dialogic characters detail',
  'dialogic:background': 'Dialogic background detail',
  'dialogic:media': 'Dialogic media detail',
  'dialogic:animation': 'Dialogic animation detail',
};
function CapabilityPanel({
  capabilities,
  language,
  target,
}: {
  capabilities: TargetCapability[];
  language: Language;
  target: CodeExportTarget;
}) {
  return (
    <div className="border-b border-[var(--vr-border)] p-3">
      <h3 className="mb-2 text-xs font-black">{getCodeText(language, 'Capability support')}</h3>
      <div className="space-y-1.5">
        {capabilities.map((item) => (
          <div key={item.id} className="rounded-md border border-[var(--vr-border)] p-2">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <b>
                {capabilityLabelKeys[item.id]
                  ? getCodeText(language, capabilityLabelKeys[item.id])
                  : item.label}
              </b>
              <span
                className={
                  item.level === 'full'
                    ? 'text-emerald-400'
                    : item.level === 'degraded'
                      ? 'text-amber-400'
                      : 'text-red-400'
                }
              >
                {getCodeText(
                  language,
                  item.level === 'full'
                    ? 'Full support'
                    : item.level === 'degraded'
                      ? 'Degraded support'
                      : 'Unsupported',
                )}
              </span>
            </div>
            <p className="mt-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">
              {capabilityDetailKeys[`${target}:${item.id}`]
                ? getCodeText(language, capabilityDetailKeys[`${target}:${item.id}`])
                : item.detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
function Summary({
  icon: Icon,
  label,
  value,
  danger,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-[var(--vr-border)] px-2.5 py-2 text-xs">
      <span className="flex items-center gap-1.5 text-[var(--vr-text-muted)]">
        <Icon
          className={`h-3.5 w-3.5 ${danger ? 'text-red-400' : 'text-[var(--vr-accent-strong)]'}`}
        />
        {label}
      </span>
      <b>{value}</b>
    </div>
  );
}
function Diagnostics({
  diagnostics,
  language,
  target,
}: {
  diagnostics: CodeDiagnostic[];
  language: Language;
  target: CodeExportTarget;
}) {
  const localizedMessage = (item: CodeDiagnostic) => {
    const supportPrefix = `${target}-support-`;
    if (!item.id.startsWith(supportPrefix)) return item.message;
    const capabilityId = item.id.slice(supportPrefix.length);
    const labelKey = capabilityLabelKeys[capabilityId];
    const detailKey = capabilityDetailKeys[`${target}:${capabilityId}`];
    if (!labelKey || !detailKey) return item.message;
    return `${getCodeText(language, labelKey)}：${getCodeText(language, detailKey)}`;
  };
  return (
    <div className="h-full overflow-auto p-5">
      <h3 className="mb-4 text-sm font-black">{getCodeText(language, 'Export diagnostics')}</h3>
      {diagnostics.length === 0 ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          {getCodeText(language, 'No blocking issues.')}
        </div>
      ) : (
        diagnostics.map((item) => {
          const Icon =
            item.level === 'error' ? AlertCircle : item.level === 'warning' ? AlertTriangle : Info;
          const levelKey =
            item.level === 'error' ? 'Error' : item.level === 'warning' ? 'Warning' : 'Info';
          return (
            <div
              key={item.id}
              className={`code-diagnostic-card code-diagnostic-card--${item.level}`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <b className="code-diagnostic-level">{getCodeText(language, levelKey)}</b>
                  {item.nodeId && (
                    <span className="font-mono text-[10px] text-[var(--vr-text-muted)]">
                      {item.nodeId}
                    </span>
                  )}
                </div>
                <p className="m-0 break-words text-[13px] font-medium leading-5 text-[var(--vr-text)]">
                  {localizedMessage(item)}
                </p>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

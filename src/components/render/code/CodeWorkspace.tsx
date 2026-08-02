import { AlertTriangle, CheckCircle2, FileCode2, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import type { Language } from '../../../lib/i18n';
import { buildCodeProjectPreview } from './codeExport/exportProject';
import { repairRenpyCodeNames } from './codeExport/model';
import type { CodeExportTarget, TargetCapability } from './codeExport/targets/targetTypes';
import type { CodeDiagnostic, RenpyExportSettings } from './codeExport/types';
import { addVariable, CharacterInspector, NodeInspector, VariableInspector } from './CodeInspector';
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
  onExport: () => void;
  exporting: boolean;
};

const tr = (language: Language, _zh: string, _ja: string, en: CodeTextKey) =>
  getCodeText(language, en);

export function CodeWorkspace({
  nodes,
  edges,
  language,
  projectName,
  target,
  settings,
  onSettingsChange,
  onExport,
  exporting,
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
  const fileTree = (
    <aside className="w-64 shrink-0 overflow-y-auto border-r border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-3">
      <div className="mb-2 text-[10px] font-black uppercase tracking-wider text-[var(--vr-text-muted)]">
        {tr(language, '工程树', 'プロジェクトツリー', 'Project tree')}
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
        exporting={exporting}
        disabled={errors.length > 0}
        onTab={setTab}
        onSplitMode={(splitMode) => setSettings({ ...settings, splitMode })}
        onRepairCodes={() => setSettings(repairRenpyCodeNames(settings))}
        onExport={onExport}
      />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {fileTree}
        <section className="min-w-0 flex-1 overflow-auto">
          {tab === 'project' && (
            <div className="h-full bg-[#10151f] p-4">
              <div className="mb-3 flex items-center justify-between text-[11px] text-slate-400">
                <span>{selected?.path}</span>
                <span>
                  {selected?.generated === false
                    ? tr(
                        language,
                        '用户文件（重新生成时保留）',
                        'ユーザーファイル（再生成時に保持）',
                        'User file (preserved on regeneration)',
                      )
                    : tr(
                        language,
                        '自动生成（只读）',
                        '自動生成（読み取り専用）',
                        'Generated (read-only)',
                      )}
                </span>
              </div>
              <pre className="m-0 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-slate-100">
                {selected?.content}
              </pre>
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
            <ListView
              title={tr(language, '角色与对白', 'キャラクターと台詞', 'Characters and dialogue')}
            >
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
                    {tr(language, '个表情', '表情', 'expressions')}
                  </div>
                </button>
              ))}
            </ListView>
          )}
          {tab === 'variables' && (
            <ListView
              title={tr(language, '变量模型', '変数モデル', 'Variable model')}
              action={
                <button
                  type="button"
                  onClick={() => setSettings(addVariable(settings))}
                  className="flex items-center gap-1 text-xs text-[var(--vr-accent-strong)]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {tr(language, '添加变量', '変数を追加', 'Add variable')}
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
                {tr(language, '素材检查', '素材チェック', 'Asset inspection')}
              </h3>
              <div className="overflow-hidden rounded-lg border border-[var(--vr-border)]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--vr-surface-strong)] text-[10px] text-[var(--vr-text-muted)]">
                    <tr>
                      <th className="p-2">
                        {tr(language, '来源节点', 'ソースノード', 'Source node')}
                      </th>
                      <th className="p-2">{tr(language, '类型', '種類', 'Type')}</th>
                      <th className="p-2">{tr(language, '导出路径', '出力パス', 'Export path')}</th>
                      <th className="p-2">{tr(language, '兼容状态', '互換性', 'Compatibility')}</th>
                      <th className="p-2">{tr(language, '引用', '参照', 'Referenced')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.assets.map((asset) => (
                      <tr key={asset.id} className="border-t border-[var(--vr-border)]">
                        <td className="p-2 font-mono text-[10px]">
                          {asset.sourceNodeIds.join(', ')}
                        </td>
                        <td className="p-2">{asset.kind}</td>
                        <td className="p-2 font-mono text-[10px]">
                          {preview.manifest.assets
                            .find((item) => item.sourcePath === asset.path)
                            ?.targetPaths.join(', ') || asset.path}
                        </td>
                        <td
                          className={`p-2 ${asset.compatibility === 'compatible' ? 'text-emerald-400' : asset.compatibility === 'unreadable' ? 'text-red-400' : 'text-amber-400'}`}
                          title={asset.note}
                        >
                          {asset.compatibility}
                        </td>
                        <td className="p-2">{asset.referenced ? '✓' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.assets.length === 0 && (
                  <div className="p-5 text-center text-[var(--vr-text-muted)]">
                    {tr(language, '没有素材', '素材はありません', 'No assets')}
                  </div>
                )}
              </div>
            </div>
          )}
          {tab === 'diagnostics' && (
            <Diagnostics diagnostics={preview.diagnostics} language={language} />
          )}
        </section>
        <aside className="w-80 shrink-0 overflow-y-auto border-l border-[var(--vr-border)] bg-[var(--vr-surface-soft)]">
          <CapabilityPanel capabilities={preview.capabilities} language={language} />
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
                <Empty
                  text={tr(
                    language,
                    '项目中没有角色节点',
                    'キャラクターノードがありません',
                    'No character nodes in project',
                  )}
                />
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
                {tr(
                  language,
                  '剧情与条件检查器',
                  'ストーリーと条件',
                  'Story and condition inspector',
                )}
              </h3>
              <select
                className="h-8 w-full rounded-md border border-[var(--vr-border)] bg-[var(--vr-bg)] px-2 text-xs"
                value={selectedNodeId}
                onChange={(event) => setSelectedNodeId(event.target.value)}
              >
                <option value="">
                  {tr(
                    language,
                    '选择剧情或条件节点',
                    'ノードを選択',
                    'Select a story or condition node',
                  )}
                </option>
                {runtimeNodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {String(
                      node.data?.title ||
                        (node.type === 'numberConditionNode'
                          ? tr(language, '数值条件', '数値条件', 'Number condition')
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
                  label={tr(language, '运行节点', '実行ノード', 'Runtime nodes')}
                  value={String(runtimeNodes.length)}
                />
                <Summary
                  icon={AlertTriangle}
                  label={tr(language, '错误', 'エラー', 'Errors')}
                  value={String(errors.length)}
                  danger={errors.length > 0}
                />
                <Summary
                  icon={AlertTriangle}
                  label={tr(language, '警告', '警告', 'Warnings')}
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
            ? tr(language, '请先修复阻塞错误', 'エラーを修正してください', 'Fix blocking errors')
            : tr(language, '可以导出工程', '出力できます', 'Ready to export')}
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
function CapabilityPanel({
  capabilities,
  language,
}: {
  capabilities: TargetCapability[];
  language: Language;
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
            <p className="mt-1 text-[10px] leading-4 text-[var(--vr-text-muted)]">{item.detail}</p>
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
}: {
  diagnostics: CodeDiagnostic[];
  language: Language;
}) {
  return (
    <div className="h-full overflow-auto p-5">
      <h3 className="mb-4 text-sm font-black">
        {tr(language, '导出诊断', 'エクスポート診断', 'Export diagnostics')}
      </h3>
      {diagnostics.length === 0 ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          {tr(language, '没有阻塞问题。', '問題はありません。', 'No blocking issues.')}
        </div>
      ) : (
        diagnostics.map((item) => (
          <div
            key={item.id}
            className={`mb-2 rounded-lg border p-3 text-sm ${item.level === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}
          >
            <b className="mr-2 text-[10px] uppercase">{item.level}</b>
            {item.message}
            {item.nodeId && (
              <span className="ml-2 font-mono text-xs opacity-70">{item.nodeId}</span>
            )}
          </div>
        ))
      )}
    </div>
  );
}

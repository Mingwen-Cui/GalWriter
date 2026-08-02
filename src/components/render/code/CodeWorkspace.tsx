import { AlertTriangle, Braces, CheckCircle2, FileCode2, FolderTree, PackageOpen, Play, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { Language } from '../../../lib/i18n';
import { buildRenpyProjectPreview, type CodeDiagnostic } from './codeExport/renpyExport';

type CodeWorkspaceProps = {
  nodes: import('@xyflow/react').Node[];
  edges: import('@xyflow/react').Edge[];
  language: Language;
  projectName: string;
  onExport: () => void;
  exporting: boolean;
};

const copy = (language: Language, zh: string, en: string) => language === 'zh' ? zh : en;

export function CodeWorkspace({ nodes, edges, language, projectName, onExport, exporting }: CodeWorkspaceProps) {
  const [tab, setTab] = useState<'project' | 'flow' | 'diagnostics'>('project');
  const [selectedFile, setSelectedFile] = useState('game/script.rpy');
  const preview = useMemo(() => buildRenpyProjectPreview(nodes, edges), [nodes, edges]);
  const selected = preview.files.find((file) => file.path === selectedFile) || preview.files[0];
  const errors = preview.diagnostics.filter((item) => item.level === 'error');
  const warnings = preview.diagnostics.filter((item) => item.level === 'warning');
  const labels = copy(language, '代码工程', 'Native project');

  return <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--vr-bg)] text-[var(--vr-text)]">
    <div className="flex shrink-0 items-center justify-between border-b border-[var(--vr-border)] bg-[var(--vr-surface-strong)] px-4 py-2">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--vr-accent-soft)] text-[var(--vr-accent-strong)]"><Braces className="h-4 w-4" /></div>
        <div><div className="text-xs font-black">{labels}</div><div className="text-[10px] text-[var(--vr-text-muted)]">Ren'Py · {projectName || 'galwriter-renpy'}</div></div>
      </div>
      <button type="button" onClick={onExport} disabled={exporting || errors.length > 0} className="flex h-8 items-center gap-1.5 rounded-md bg-[var(--vr-accent)] px-3 text-xs font-black text-white disabled:opacity-45"><PackageOpen className="h-3.5 w-3.5" />{exporting ? copy(language, '正在导出…', 'Exporting…') : copy(language, '导出 Ren’Py 工程', 'Export Ren’Py')}</button>
    </div>
    <div className="flex shrink-0 gap-1 border-b border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-4 pt-2">
      {([
        ['project', FolderTree, copy(language, '工程', 'Project')],
        ['flow', Play, copy(language, '流程', 'Flow')],
        ['diagnostics', Wrench, copy(language, '调试', 'Diagnostics')],
      ] as const).map(([value, Icon, label]) => <button key={value} type="button" onClick={() => setTab(value)} className={`flex items-center gap-1.5 rounded-t-md px-3 py-2 text-xs font-bold ${tab === value ? 'bg-[var(--vr-bg)] text-[var(--vr-accent-strong)]' : 'text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}
    </div>
    <div className="min-h-0 flex-1 overflow-hidden">
      {tab === 'project' && <div className="flex h-full min-h-0">
        <aside className="w-60 shrink-0 overflow-y-auto border-r border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-3"><div className="mb-2 text-[10px] font-black uppercase tracking-wider text-[var(--vr-text-muted)]">{copy(language, '工程文件', 'Project files')}</div>{preview.files.map((file) => <button key={file.path} type="button" onClick={() => setSelectedFile(file.path)} className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${selected?.path === file.path ? 'bg-[var(--vr-accent-soft)] text-[var(--vr-accent-strong)]' : 'text-[var(--vr-text-muted)] hover:bg-white/5'}`}><FileCode2 className="h-3.5 w-3.5" />{file.path}</button>)}</aside>
        <section className="min-w-0 flex-1 overflow-auto bg-[#10151f] p-4"><div className="mb-3 flex items-center justify-between text-[11px] text-slate-400"><span>{selected?.path}</span><span>{copy(language, '自动生成（只读）', 'Generated (read-only)')}</span></div><pre className="m-0 whitespace-pre-wrap break-words font-mono text-xs leading-6 text-slate-100">{selected?.content}</pre></section>
        <aside className="w-72 shrink-0 overflow-y-auto border-l border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-3"><div className="mb-3 text-xs font-black">{copy(language, '工程预检', 'Project check')}</div><Summary icon={CheckCircle2} label={copy(language, '可运行节点', 'Runtime nodes')} value={String(nodes.filter((node) => node.type === 'storyNode' && node.data?.hidden !== true).length)} /><Summary icon={AlertTriangle} label={copy(language, '错误', 'Errors')} value={String(errors.length)} danger={errors.length > 0} /><Summary icon={AlertTriangle} label={copy(language, '警告', 'Warnings')} value={String(warnings.length)} /><div className="mt-4 rounded-lg border border-[var(--vr-border)] p-3 text-[11px] leading-5 text-[var(--vr-text-muted)]">{copy(language, '生成代码会保留在 custom.rpy 之外；重新导出只覆盖 GalWriter 管理的文件。', 'Hand-written code belongs in custom.rpy; regeneration only replaces GalWriter-managed files.')}</div></aside>
      </div>}
      {tab === 'flow' && <FlowView nodes={nodes} edges={edges} preview={preview} language={language} />}
      {tab === 'diagnostics' && <Diagnostics diagnostics={preview.diagnostics} language={language} />}
    </div>
    <div className="flex shrink-0 items-center justify-between border-t border-[var(--vr-border)] bg-[var(--vr-surface-strong)] px-4 py-2 text-[11px] text-[var(--vr-text-muted)]"><span>{copy(language, 'Ren’Py 第一阶段：剧情、分支、数值条件、背景与音频', 'Ren’Py phase one: story, branches, conditions, backgrounds and audio')}</span><span className={errors.length ? 'text-red-400' : 'text-emerald-400'}>{errors.length ? copy(language, '请先修复阻塞错误', 'Fix blocking errors before export') : copy(language, '可导出工程', 'Ready to export')}</span></div>
  </main>;
}

function Summary({ icon: Icon, label, value, danger }: { icon: typeof CheckCircle2; label: string; value: string; danger?: boolean }) { return <div className="mb-2 flex items-center justify-between rounded-md border border-[var(--vr-border)] px-2.5 py-2 text-xs"><span className="flex items-center gap-1.5 text-[var(--vr-text-muted)]"><Icon className={`h-3.5 w-3.5 ${danger ? 'text-red-400' : 'text-[var(--vr-accent-strong)]'}`} />{label}</span><b>{value}</b></div>; }

function Diagnostics({ diagnostics, language }: { diagnostics: CodeDiagnostic[]; language: Language }) { return <div className="h-full overflow-auto p-5"><h3 className="mb-4 text-sm font-black">{copy(language, '编译诊断', 'Export diagnostics')}</h3>{diagnostics.length === 0 ? <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">{copy(language, '没有阻塞问题，工程可以导出。', 'No blocking issues. The project can be exported.')}</div> : diagnostics.map((item) => <div key={item.id} className={`mb-2 rounded-lg border p-3 text-sm ${item.level === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-amber-500/30 bg-amber-500/10 text-amber-100'}`}><b className="mr-2 uppercase text-[10px]">{item.level}</b>{item.message}{item.nodeId ? <span className="ml-2 font-mono text-xs opacity-70">{item.nodeId}</span> : null}</div>)}</div>; }

function FlowView({ nodes, edges, preview, language }: { nodes: import('@xyflow/react').Node[]; edges: import('@xyflow/react').Edge[]; preview: ReturnType<typeof buildRenpyProjectPreview>; language: Language }) { const labels = new Map<string, string>(); try { const manifest = JSON.parse(preview.files.find((file) => file.path.endsWith('manifest.json'))?.content || '{}'); Object.entries(manifest.labels || {}).forEach(([id, label]) => labels.set(id, String(label))); } catch { /* preview is always valid JSON */ } return <div className="h-full overflow-auto p-5"><h3 className="mb-4 text-sm font-black">{copy(language, '剧情图 → Ren’Py 标签', 'Story graph → Ren’Py labels')}</h3><div className="space-y-2">{nodes.filter((node) => node.type === 'storyNode' || node.type === 'numberConditionNode').map((node) => { const outgoing = edges.filter((edge) => edge.source === node.id); return <div key={node.id} className="rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-3"><div className="font-mono text-xs text-[var(--vr-accent-strong)]">{labels.get(node.id) || 'not exported'}</div><div className="mt-1 text-sm font-bold">{String(node.data?.title || (node.type === 'numberConditionNode' ? copy(language, '数值条件', 'Number condition') : copy(language, '未命名节点', 'Untitled node')))}</div><div className="mt-2 text-xs text-[var(--vr-text-muted)]">{outgoing.length === 0 ? copy(language, '结束剧情', 'End of story') : outgoing.length === 1 ? `jump ${labels.get(outgoing[0].target) || outgoing[0].target}` : `${copy(language, '选项', 'menu')}: ${outgoing.map((edge) => String(edge.data?.label || labels.get(edge.target) || edge.target)).join(' · ')}`}</div></div>; })}</div></div>; }

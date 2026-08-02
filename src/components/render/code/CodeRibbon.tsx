import {
  Boxes,
  Bug,
  FolderTree,
  GitBranch,
  PackageOpen,
  Settings2,
  Users,
  Variable,
} from 'lucide-react';

import type { Language } from '../../../lib/i18n';
import type { CodeExportTarget } from './codeExport/targets/targetTypes';
import type { RenpySplitMode } from './codeExport/types';
import { type CodeTextKey, getCodeText } from './i18n';

export type CodeWorkspaceTab =
  | 'project'
  | 'flow'
  | 'characters'
  | 'variables'
  | 'assets'
  | 'diagnostics';

const tr = (language: Language, _zh: string, _ja: string, en: CodeTextKey) =>
  getCodeText(language, en);

export function CodeRibbon({
  language,
  tab,
  target,
  splitMode,
  exporting,
  disabled,
  onTab,
  onTarget,
  onSplitMode,
  onRepairCodes,
  onExport,
}: {
  language: Language;
  tab: CodeWorkspaceTab;
  target: CodeExportTarget;
  splitMode: RenpySplitMode;
  exporting: boolean;
  disabled: boolean;
  onTab: (tab: CodeWorkspaceTab) => void;
  onTarget: (target: CodeExportTarget) => void;
  onSplitMode: (mode: RenpySplitMode) => void;
  onRepairCodes: () => void;
  onExport: () => void;
}) {
  const tabs = [
    ['project', FolderTree, tr(language, '工程', 'プロジェクト', 'Project')],
    ['flow', GitBranch, getCodeText(language, 'Flow mapping')],
    ['characters', Users, tr(language, '角色', 'キャラクター', 'Characters')],
    ['variables', Variable, tr(language, '变量', '変数', 'Variables')],
    ['assets', Boxes, tr(language, '素材', '素材', 'Assets')],
    ['diagnostics', Bug, tr(language, '诊断', '診断', 'Diagnostics')],
  ] as const;
  return (
    <div className="flex shrink-0 items-end justify-between gap-3 border-b border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-4 pt-2">
      <div className="flex gap-1">
        {tabs.map(([value, Icon, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onTab(value)}
            className={`flex items-center gap-1.5 rounded-t-md px-3 py-2 text-xs font-bold ${tab === value ? 'bg-[var(--vr-bg)] text-[var(--vr-accent-strong)]' : 'text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
      <div className="mb-2 flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11px] text-[var(--vr-text-muted)]">
          {getCodeText(language, 'Target engine')}
          <select
            value={target}
            onChange={(event) => onTarget(event.target.value as CodeExportTarget)}
            className="h-8 rounded-md border border-[var(--vr-border)] bg-[var(--vr-bg)] px-2 text-xs text-[var(--vr-text)]"
          >
            <option value="renpy">Ren’Py</option>
            <option value="tyrano">TyranoScript</option>
            <option value="dialogic">Godot Dialogic 2</option>
            <option value="ir-json">GalWriter IR JSON</option>
          </select>
        </label>
        <button
          type="button"
          onClick={onRepairCodes}
          className="flex h-8 items-center gap-1.5 rounded-md border border-[var(--vr-border)] px-2 text-[11px] text-[var(--vr-text-muted)]"
        >
          <Settings2 className="h-3.5 w-3.5" />
          {getCodeText(language, 'Auto-fix code names')}
        </button>
        <label className="flex items-center gap-1.5 text-[11px] text-[var(--vr-text-muted)]">
          <Settings2 className="h-3.5 w-3.5" />
          {tr(language, '章节拆分', '章の分割', 'Scene split')}
          <select
            value={splitMode}
            onChange={(event) => onSplitMode(event.target.value as RenpySplitMode)}
            className="h-8 rounded-md border border-[var(--vr-border)] bg-[var(--vr-bg)] px-2 text-xs text-[var(--vr-text)]"
          >
            <option value="single">{tr(language, '单文件', '単一ファイル', 'Single file')}</option>
            <option value="group">{tr(language, '按群组', 'グループ別', 'By group')}</option>
            <option value="background">
              {tr(language, '按背景区域', '背景エリア別', 'By background')}
            </option>
          </select>
        </label>
        <button
          type="button"
          onClick={onExport}
          disabled={exporting || disabled}
          className="flex h-8 items-center gap-1.5 rounded-md bg-[var(--vr-accent)] px-3 text-xs font-black text-white disabled:opacity-45"
        >
          <PackageOpen className="h-3.5 w-3.5" />
          {exporting
            ? tr(language, '正在导出…', 'エクスポート中…', 'Exporting…')
            : getCodeText(language, 'Export project')}
        </button>
      </div>
    </div>
  );
}

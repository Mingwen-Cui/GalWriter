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
import type { RenpySplitMode } from './codeExport/types';
import { type CodeTextKey, getCodeText } from './i18n';

export type CodeWorkspaceTab =
  | 'project'
  | 'flow'
  | 'characters'
  | 'variables'
  | 'assets'
  | 'diagnostics';

const workspaceTabs = [
  ['project', FolderTree, 'Project'],
  ['flow', GitBranch, 'Flow mapping'],
  ['characters', Users, 'Characters'],
  ['variables', Variable, 'Variables'],
  ['assets', Boxes, 'Assets'],
  ['diagnostics', Bug, 'Diagnostics'],
] as const satisfies ReadonlyArray<readonly [CodeWorkspaceTab, typeof FolderTree, CodeTextKey]>;

export function CodeRibbon({
  language,
  tab,
  splitMode,
  exporting,
  disabled,
  onTab,
  onSplitMode,
  onRepairCodes,
  onExport,
}: {
  language: Language;
  tab: CodeWorkspaceTab;
  splitMode: RenpySplitMode;
  exporting: boolean;
  disabled: boolean;
  onTab: (tab: CodeWorkspaceTab) => void;
  onSplitMode: (mode: RenpySplitMode) => void;
  onRepairCodes: () => void;
  onExport: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-4 py-2">
      <div className="flex gap-1">
        {workspaceTabs.map(([value, Icon, labelKey]) => (
          <button
            key={value}
            type="button"
            onClick={() => onTab(value)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold ${
              tab === value
                ? 'bg-[var(--vr-bg)] text-[var(--vr-accent-strong)]'
                : 'text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {getCodeText(language, labelKey)}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
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
          {getCodeText(language, 'Scene split')}
          <select
            value={splitMode}
            onChange={(event) => onSplitMode(event.target.value as RenpySplitMode)}
            className="h-8 rounded-md border border-[var(--vr-border)] bg-[var(--vr-bg)] px-2 text-xs text-[var(--vr-text)]"
          >
            <option value="single">{getCodeText(language, 'Single file')}</option>
            <option value="group">{getCodeText(language, 'By group')}</option>
            <option value="background">{getCodeText(language, 'By background')}</option>
          </select>
        </label>
        <button
          type="button"
          onClick={onExport}
          disabled={exporting || disabled}
          className="flex h-8 items-center gap-1.5 rounded-md bg-[var(--vr-accent)] px-3 text-xs font-black text-white disabled:opacity-45"
        >
          <PackageOpen className="h-3.5 w-3.5" />
          {getCodeText(language, exporting ? 'Exporting' : 'Export project')}
        </button>
      </div>
    </div>
  );
}

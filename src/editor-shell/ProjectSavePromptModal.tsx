import { AlertTriangle } from 'lucide-react';

import type { Language } from '../lib/i18n';

interface ProjectSavePromptModalProps {
  visible: boolean;
  language: Language;
  projectName: string;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export function ProjectSavePromptModal({
  visible,
  language,
  projectName,
  onSave,
  onDiscard,
  onCancel,
}: ProjectSavePromptModalProps) {
  if (!visible) return null;

  const isZh = language === 'zh';

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_32px_80px_rgba(15,23,42,0.28)] dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 dark:bg-amber-500/15 dark:text-amber-300">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              {isZh ? '保存当前项目？' : 'Save current project?'}
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
              {isZh
                ? `项目「${projectName}」有未保存的修改。`
                : `Project "${projectName}" has unsaved changes.`}
            </p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {isZh
            ? '保存后会覆盖本地已保存进度；不保存则丢弃这次修改；取消则留在当前项目。'
            : 'Save will overwrite the local saved version. Don’t Save will discard these edits. Cancel keeps you here.'}
        </p>

        <div className="mt-7 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
          >
            {isZh ? '取消' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="flex-1 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
          >
            {isZh ? '不保存' : "Don't Save"}
          </button>
          <button
            type="button"
            onClick={onSave}
            className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            {isZh ? '保存' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

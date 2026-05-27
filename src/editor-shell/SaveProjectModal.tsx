import { Save } from 'lucide-react';

interface SaveProjectModalProps {
  visible: boolean;
  saveFileName: string;
  onChangeFileName: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  t: {
    exportProject: string;
    saveProjectDesc: string;
    projectName: string;
    cancel: string;
    confirmSave: string;
  };
}

export function SaveProjectModal({
  visible,
  saveFileName,
  onChangeFileName,
  onClose,
  onConfirm,
  t,
}: SaveProjectModalProps) {
  if (!visible) return null;

  return (
    <div className="animate-in fade-in fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md duration-300">
      <div className="animate-in zoom-in-95 flex w-full max-w-sm flex-col items-center rounded-[32px] border border-slate-100 bg-white p-10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] duration-200 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <Save className="h-8 w-8" />
        </div>

        <h3 className="mb-2 text-2xl font-black text-slate-800 dark:text-slate-100">
          {t.exportProject}
        </h3>
        <p className="mb-8 text-center text-xs leading-relaxed text-slate-400 dark:text-slate-500">
          {t.saveProjectDesc}
        </p>

        <div className="w-full space-y-6">
          <div className="relative group">
            <input
              type="text"
              value={saveFileName}
              onChange={(event) => onChangeFileName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && onConfirm()}
              className="w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-6 py-5 pr-20 text-lg font-bold text-slate-700 transition-all focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:bg-slate-900"
              placeholder={t.projectName}
              autoFocus
            />
            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-base font-bold text-slate-300 group-focus-within:text-indigo-400">
              .json
            </span>
          </div>

          <div className="flex w-full gap-4">
            <button
              onClick={onClose}
              className="flex-1 rounded-2xl border-2 border-slate-100 py-4 font-bold text-slate-400 transition-all hover:bg-slate-50 hover:text-slate-600 active:scale-95"
            >
              {t.cancel}
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 rounded-2xl bg-indigo-600 py-4 font-black text-white shadow-xl shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95"
            >
              {t.confirmSave}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

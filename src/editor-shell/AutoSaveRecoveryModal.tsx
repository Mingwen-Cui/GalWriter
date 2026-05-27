import { FileArchive } from 'lucide-react';

interface AutoSaveRecoveryModalProps {
  visible: boolean;
  timestamp?: number;
  language: 'zh' | 'en';
  onDiscard: () => void;
  onRecover: () => void;
}

export function AutoSaveRecoveryModal({
  visible,
  timestamp,
  language,
  onDiscard,
  onRecover,
}: AutoSaveRecoveryModalProps) {
  if (!(visible && timestamp)) return null;

  return (
    <div className="animate-in fade-in fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md duration-300">
      <div className="flex w-full max-w-sm flex-col items-center rounded-[32px] border border-slate-100 bg-white p-10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-500 dark:bg-amber-500/20">
          <FileArchive className="h-8 w-8" />
        </div>
        <h3 className="mb-2 text-xl font-black text-slate-800 dark:text-slate-100">
          {language === 'zh' ? '发现未保存的进度' : 'Unsaved Progress Found'}
        </h3>
        <p className="mb-8 text-center text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          {language === 'zh'
            ? `系统检测到异常退出前有未保存的进度（${new Date(timestamp).toLocaleTimeString()}）。是否恢复？`
            : `Detected unsaved progress from ${new Date(timestamp).toLocaleTimeString()}. Do you want to recover it?`}
        </p>

        <div className="flex w-full gap-4">
          <button
            onClick={onDiscard}
            className="flex-1 rounded-xl border-2 border-slate-100 py-3 font-bold text-slate-400 transition-all hover:bg-slate-50"
          >
            {language === 'zh' ? '放弃进度' : 'Discard'}
          </button>
          <button
            onClick={onRecover}
            className="flex-1 rounded-xl bg-indigo-600 py-3 font-bold text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700"
          >
            {language === 'zh' ? '恢复进度' : 'Recover'}
          </button>
        </div>
      </div>
    </div>
  );
}

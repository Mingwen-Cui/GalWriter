import { Check, X } from 'lucide-react';

interface EditorToastProps {
  message: string;
  visible: boolean;
  tone?: 'success' | 'error';
}

export function EditorToast({ message, visible, tone = 'success' }: EditorToastProps) {
  const isError = tone === 'error';

  return (
    <div
      className={`fixed bottom-10 left-1/2 z-[3000] flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-white/10 bg-slate-800 px-6 py-3 text-sm font-bold text-white shadow-2xl transition-all duration-500 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-12 opacity-0'
      }`}
    >
      <div
        className={`flex h-6 w-6 items-center justify-center rounded-full shadow-lg ${
          isError ? 'bg-rose-500' : 'bg-emerald-500'
        }`}
      >
        {isError ? <X className="h-4 w-4 text-white" /> : <Check className="h-4 w-4 text-white" />}
      </div>
      {message}
    </div>
  );
}

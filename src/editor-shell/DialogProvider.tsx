import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { Language } from '../lib/i18n';
import { DialogModal } from './DialogModal';

type DialogTone = 'info' | 'warning' | 'danger';

interface DialogRequest {
  title: string;
  description: string;
  tone?: DialogTone;
  confirmLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  resolve: (value: boolean) => void;
}

interface DialogContextValue {
  alert: (options: {
    title: string;
    description: string;
    tone?: DialogTone;
    confirmLabel?: string;
  }) => Promise<void>;
  confirm: (options: {
    title: string;
    description: string;
    tone?: DialogTone;
    confirmLabel?: string;
    cancelLabel?: string;
  }) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextValue | null>(null);

interface DialogProviderProps {
  language: Language;
  children: React.ReactNode;
}

export function DialogProvider({ language, children }: DialogProviderProps) {
  const [currentDialog, setCurrentDialog] = useState<DialogRequest | null>(null);

  const closeDialog = useCallback((value: boolean) => {
    setCurrentDialog((current) => {
      if (!current) return current;
      current.resolve(value);
      return null;
    });
  }, []);

  const alert = useCallback<DialogContextValue['alert']>(
    ({ title, description, tone = 'info', confirmLabel }) =>
      new Promise<void>((resolve) => {
        setCurrentDialog({
          title,
          description,
          tone,
          confirmLabel,
          showCancel: false,
          resolve: () => resolve(),
        });
      }),
    [],
  );

  const confirm = useCallback<DialogContextValue['confirm']>(
    ({ title, description, tone = 'warning', confirmLabel, cancelLabel }) =>
      new Promise<boolean>((resolve) => {
        setCurrentDialog({
          title,
          description,
          tone,
          confirmLabel,
          cancelLabel,
          showCancel: true,
          resolve,
        });
      }),
    [],
  );

  const value = useMemo(
    () => ({
      alert,
      confirm,
    }),
    [alert, confirm],
  );

  return (
    <DialogContext.Provider value={value}>
      {children}
      <DialogModal
        visible={Boolean(currentDialog)}
        language={language}
        title={currentDialog?.title || ''}
        description={currentDialog?.description || ''}
        tone={currentDialog?.tone}
        confirmLabel={currentDialog?.confirmLabel}
        cancelLabel={currentDialog?.cancelLabel}
        showCancel={currentDialog?.showCancel}
        onConfirm={() => closeDialog(true)}
        onCancel={() => closeDialog(false)}
      />
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
}

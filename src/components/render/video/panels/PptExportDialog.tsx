import { ChevronDown, Download, FolderOpen, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { Language } from '../../../../lib/i18n';
import { getPptCopy } from '../../ppt/i18n';
import { PptLayoutChangeDialog } from '../../ppt/PptLayoutChangeDialog';
import { formatVideoText } from '../i18n';
import type { PptExportSettings } from '../shared/types';

type PptExportDialogProps = {
  language: Language;
  isDesktopApp: boolean;
  defaultProjectName: string;
  projectName: string;
  outputDir: string;
  outputDirError: string;
  settings: PptExportSettings;
  onClose: () => void;
  onConfirm: (projectName: string) => void;
  onProjectNameChange: (value: string) => void;
  onSettingsChange: (patch: Partial<PptExportSettings>) => void;
  onChooseOutputDir: () => void;
};

export function PptExportDialog({
  language,
  isDesktopApp,
  defaultProjectName,
  projectName,
  outputDir,
  outputDirError,
  settings,
  onClose,
  onConfirm,
  onProjectNameChange,
  onSettingsChange,
  onChooseOutputDir,
}: PptExportDialogProps) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [draftName, setDraftName] = useState(projectName || defaultProjectName);
  const [pendingLayout, setPendingLayout] = useState<PptExportSettings['layout']>();
  const copy = getPptCopy(language);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }, 50);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
      if (event.key === 'F12') {
        event.preventDefault();
        event.stopPropagation();
        onProjectNameChange(draftName.trim() || defaultProjectName);
        onConfirm(draftName.trim() || defaultProjectName);
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [defaultProjectName, draftName, onClose, onConfirm, onProjectNameChange]);

  const handleConfirm = () => {
    onProjectNameChange(draftName.trim() || defaultProjectName);
    onConfirm(draftName.trim() || defaultProjectName);
  };

  const applyLayout = (layoutContentMode: NonNullable<PptExportSettings['layoutContentMode']>) => {
    if (!pendingLayout) return;
    onSettingsChange({ layout: pendingLayout, layoutContentMode });
    setPendingLayout(undefined);
  };

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-[var(--vr-border)] bg-[var(--vr-surface-strong)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={formatVideoText(language, 'componentsrendervideopanelsPptExportDialogText78')}
      >
        <div className="flex items-center justify-between border-b border-[var(--vr-border)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--vr-accent-soft)]">
              <Download className="h-4 w-4 text-[var(--vr-accent-strong)]" />
            </div>
            <h3 className="text-sm font-black text-[var(--vr-text)]">
              {formatVideoText(language, 'componentsrendervideopanelsPptExportDialogText82')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--vr-text-muted)] transition-colors hover:bg-[var(--vr-surface-soft)] hover:text-[var(--vr-text)]"
            aria-label={formatVideoText(
              language,
              'componentsrendervideopanelsPptExportDialogText84',
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[min(65vh,620px)] space-y-4 overflow-y-auto px-5 py-5">
          <label className="block space-y-1.5">
            <span className="block text-[11px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
              {formatVideoText(language, 'componentsrendervideopanelsPptExportDialogText89')}
            </span>
            <input
              ref={nameInputRef}
              type="text"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder={defaultProjectName}
              className="h-10 w-full rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface)] px-3 text-sm font-bold text-[var(--vr-text)] outline-none transition-colors placeholder:text-[var(--vr-text-muted)] focus:border-[var(--vr-accent)] focus:ring-1 focus:ring-[var(--vr-accent)]/20"
            />
          </label>

          <div className="rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-3.5">
            <p className="mb-3 text-[11px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
              {formatVideoText(language, 'componentsrendervideopanelsPptExportDialogText94')}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label={formatVideoText(
                  language,
                  'componentsrendervideopanelsPptExportDialogText96',
                )}
                value={settings.layout}
                onChange={(value) => {
                  const nextLayout = value as PptExportSettings['layout'];
                  if (nextLayout !== settings.layout) setPendingLayout(nextLayout);
                }}
                options={[
                  ['LAYOUT_WIDE', '16:9'],
                  ['LAYOUT_STANDARD', '4:3'],
                ]}
              />
              <SelectField
                label={formatVideoText(
                  language,
                  'componentsrendervideopanelsPptExportDialogText97',
                )}
                value={settings.branchMode}
                onChange={(value) =>
                  onSettingsChange({ branchMode: value as PptExportSettings['branchMode'] })
                }
                options={[
                  [
                    'interactive',
                    formatVideoText(language, 'componentsrendervideopanelsPptExportDialogText97_2'),
                  ],
                  [
                    'linear',
                    formatVideoText(language, 'componentsrendervideopanelsPptExportDialogText97_3'),
                  ],
                  [
                    'all',
                    formatVideoText(language, 'componentsrendervideopanelsPptExportDialogText97_4'),
                  ],
                ]}
              />
            </div>
            <div className="mt-3 space-y-2">
              <Toggle
                label={formatVideoText(
                  language,
                  'componentsrendervideopanelsPptExportDialogText100',
                )}
                checked={settings.includeCover}
                onChange={(includeCover) => onSettingsChange({ includeCover })}
              />
              <Toggle
                label={formatVideoText(
                  language,
                  'componentsrendervideopanelsPptExportDialogText101',
                )}
                checked={settings.includeNotes}
                onChange={(includeNotes) => onSettingsChange({ includeNotes })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-[11px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
              {formatVideoText(language, 'componentsrendervideopanelsPptExportDialogText106')}
            </span>
            {isDesktopApp ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onChooseOutputDir}
                  className={`min-w-0 flex-1 rounded-xl border px-3 py-2 text-left text-xs font-bold ${outputDirError ? 'border-rose-400/70 text-rose-500' : 'border-[var(--vr-border)] bg-[var(--vr-surface)] text-[var(--vr-text-muted)] hover:border-[var(--vr-accent)]/60'}`}
                >
                  <span className="block truncate">
                    {outputDir ||
                      formatVideoText(
                        language,
                        'componentsrendervideopanelsPptExportDialogText110',
                      )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={onChooseOutputDir}
                  className="h-9 w-9 shrink-0 rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface)] text-[var(--vr-text-soft)] transition-colors hover:border-[var(--vr-accent)]/60"
                  aria-label={formatVideoText(
                    language,
                    'componentsrendervideopanelsPptExportDialogText112',
                  )}
                >
                  <FolderOpen className="mx-auto h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex h-10 items-center rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-3 text-xs font-bold text-[var(--vr-text-muted)] opacity-60">
                {formatVideoText(language, 'componentsrendervideopanelsPptExportDialogText115')}
              </div>
            )}
            {outputDirError ? (
              <p className="text-[11px] font-bold text-rose-500">{outputDirError}</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--vr-border)] px-5 py-4">
          <span className="text-[10px] text-[var(--vr-text-muted)] opacity-60">F12</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-4 text-xs font-black text-[var(--vr-text-muted)]"
            >
              {formatVideoText(language, 'componentsrendervideopanelsPptExportDialogText124')}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex h-9 items-center gap-2 rounded-xl bg-[var(--vr-accent)] px-4 text-xs font-black text-white shadow-sm transition-all hover:brightness-105 active:scale-[0.98]"
            >
              <Download className="h-3.5 w-3.5" />
              {formatVideoText(language, 'componentsrendervideopanelsPptExportDialogText125')}
            </button>
          </div>
        </div>
      </div>
      {pendingLayout ? (
        <PptLayoutChangeDialog
          copy={copy}
          onChoose={applyLayout}
          onCancel={() => setPendingLayout(undefined)}
        />
      ) : null}
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-1.5">
      <span className="block text-[11px] font-black text-[var(--vr-text-muted)]">{label}</span>
      <span className="relative block">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full appearance-none rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface)] pl-3 pr-8 text-sm font-bold text-[var(--vr-text)] outline-none"
        >
          <>
            {options.map(([optionValue, optionLabel]) => (
              <option key={optionValue} value={optionValue}>
                {optionLabel}
              </option>
            ))}
          </>
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--vr-text-muted)]" />
      </span>
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-xs font-bold text-[var(--vr-text)]">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-[var(--vr-border)] accent-[var(--vr-accent)]"
      />
    </label>
  );
}

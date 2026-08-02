import { formatVideoText } from '../i18n';
import { ChevronDown, Download, FolderOpen, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { Language } from '../../../../lib/i18n';
import { EXPORT_FORMAT_OPTIONS, FRAME_RATE_OPTIONS } from '../shared/constants';
import type { ExportFormat, RenderWorkspaceMode } from '../shared/types';

type ExportDialogProps = {
  workspaceMode: RenderWorkspaceMode;
  language: Language;
  isDesktopApp: boolean;
  defaultVideoFileName: string;
  defaultWebProjectName: string;
  videoOutputDir: string;
  webOutputDir: string;
  videoOutputDirError: string;
  webOutputDirError: string;
  webProjectName: string;
  frameRate: number;
  exportFormat: ExportFormat;
  speed: number;
  onClose: () => void;
  onConfirm: (params: {
    name: string;
    outputDir: string;
    frameRate: number;
    exportFormat: ExportFormat;
    speed: number;
    videoBitrate: number;
  }) => void;
  onChooseVideoOutputDir: () => void;
  onChooseWebOutputDir: () => void;
  setVideoOutputDir: (value: string) => void;
  setWebOutputDir: (value: string) => void;
  setVideoOutputDirError: (value: string) => void;
  setWebOutputDirError: (value: string) => void;
  setWebProjectName: (value: string) => void;
};

export function ExportDialog({
  workspaceMode,
  language,
  isDesktopApp,
  defaultVideoFileName,
  defaultWebProjectName,
  videoOutputDir,
  webOutputDir,
  videoOutputDirError,
  webOutputDirError,
  webProjectName,
  frameRate: initialFrameRate,
  exportFormat: initialExportFormat,
  speed: initialSpeed,
  onClose,
  onConfirm,
  onChooseVideoOutputDir,
  onChooseWebOutputDir,
  setVideoOutputDir,
  setWebOutputDir,
  setVideoOutputDirError,
  setWebOutputDirError,
  setWebProjectName,
}: ExportDialogProps) {
  const [videoFileName, setVideoFileName] = useState(defaultVideoFileName);
  const [selectedFrameRate, setSelectedFrameRate] = useState(initialFrameRate);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(initialExportFormat);
  const [selectedSpeed, setSelectedSpeed] = useState(initialSpeed);
  const [selectedVideoBitrate, setSelectedVideoBitrate] = useState(12_000_000);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const isVideo = workspaceMode === 'video';
  const currentOutputDir = isVideo ? videoOutputDir : webOutputDir;
  const currentOutputDirError = isVideo ? videoOutputDirError : webOutputDirError;
  const hasCustomOutputDir = currentOutputDir.trim().length > 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }, 50);
    return () => clearTimeout(timer);
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
        handleConfirm();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  });

  const handleConfirm = () => {
    const name = isVideo
      ? videoFileName.trim() || defaultVideoFileName
      : webProjectName.trim() || defaultWebProjectName || 'galwriter-web';
    onConfirm({
      name,
      outputDir: currentOutputDir,
      frameRate: selectedFrameRate,
      exportFormat: selectedFormat,
      speed: selectedSpeed,
      videoBitrate: selectedVideoBitrate,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-[var(--vr-border)] bg-[var(--vr-surface-strong)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={
          isVideo
            ? formatVideoText(language, 'componentsrendervideopanelsExportDialogText118')
            : formatVideoText(language, 'componentsrendervideopanelsExportDialogText119')
        }
      >
        <div className="flex items-center justify-between border-b border-[var(--vr-border)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--vr-accent-soft)]">
              <Download className="h-4 w-4 text-[var(--vr-accent-strong)]" />
            </div>
            <h3 className="text-sm font-black text-[var(--vr-text)]">
              {isVideo
                ? formatVideoText(language, 'componentsrendervideopanelsExportDialogText128')
                : formatVideoText(language, 'componentsrendervideopanelsExportDialogText129')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--vr-text-muted)] transition-colors hover:bg-[var(--vr-surface-soft)] hover:text-[var(--vr-text)]"
            aria-label={formatVideoText(language, 'componentsrendervideopanelsExportDialogText136')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="space-y-1.5">
            <label
              htmlFor="export-dialog-name"
              className="block text-[11px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]"
            >
              {isVideo
                ? formatVideoText(language, 'componentsrendervideopanelsExportDialogText149')
                : formatVideoText(language, 'componentsrendervideopanelsExportDialogText150')}
            </label>
            {isVideo ? (
              <input
                ref={nameInputRef}
                id="export-dialog-name"
                type="text"
                value={videoFileName}
                onChange={(event) => setVideoFileName(event.target.value)}
                placeholder={defaultVideoFileName}
                className="h-10 w-full rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface)] px-3 text-sm font-bold text-[var(--vr-text)] outline-none transition-colors placeholder:text-[var(--vr-text-muted)] focus:border-[var(--vr-accent)] focus:ring-1 focus:ring-[var(--vr-accent)]/20"
              />
            ) : (
              <input
                ref={nameInputRef}
                id="export-dialog-name"
                type="text"
                value={webProjectName}
                onChange={(event) => setWebProjectName(event.target.value)}
                placeholder={defaultWebProjectName || 'galwriter-web'}
                className="h-10 w-full rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface)] px-3 text-sm font-bold text-[var(--vr-text)] outline-none transition-colors placeholder:text-[var(--vr-text-muted)] focus:border-[var(--vr-accent)] focus:ring-1 focus:ring-[var(--vr-accent)]/20"
              />
            )}
          </div>

          {isVideo && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="export-dialog-format"
                  className="block text-[11px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]"
                >
                  {formatVideoText(language, 'componentsrendervideopanelsExportDialogText182')}
                </label>
                <div className="relative">
                  <select
                    id="export-dialog-format"
                    value={selectedFormat}
                    onChange={(event) => setSelectedFormat(event.target.value as ExportFormat)}
                    className="h-10 w-full appearance-none rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface)] pl-3 pr-8 text-sm font-bold text-[var(--vr-text)] outline-none transition-colors focus:border-[var(--vr-accent)] cursor-pointer"
                  >
                    {EXPORT_FORMAT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--vr-text-muted)]" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="export-dialog-framerate"
                  className="block text-[11px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]"
                >
                  {formatVideoText(language, 'componentsrendervideopanelsExportDialogText206')}
                </label>
                <div className="relative">
                  <select
                    id="export-dialog-framerate"
                    value={selectedFrameRate}
                    onChange={(event) => setSelectedFrameRate(Number(event.target.value))}
                    className="h-10 w-full appearance-none rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface)] pl-3 pr-8 text-sm font-bold text-[var(--vr-text)] outline-none transition-colors focus:border-[var(--vr-accent)] cursor-pointer"
                  >
                    {FRAME_RATE_OPTIONS.map((fps) => (
                      <option key={fps} value={fps}>
                        {fps} fps
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--vr-text-muted)]" />
                </div>
              </div>
            </div>
          )}

          {isVideo && (
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="block text-[11px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                  {formatVideoText(language, 'componentsrendervideopanelsExportDialogText230')}
                </span>
                <span className="relative block">
                  <select
                    value={selectedVideoBitrate}
                    onChange={(event) => setSelectedVideoBitrate(Number(event.target.value))}
                    className="h-10 w-full appearance-none rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface)] pl-3 pr-8 text-sm font-bold text-[var(--vr-text)] outline-none"
                  >
                    {[8, 12, 20, 35].map((mbps) => (
                      <option key={mbps} value={mbps * 1_000_000}>
                        {mbps} Mbps
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--vr-text-muted)]" />
                </span>
              </label>
              <label className="space-y-1.5">
                <span className="block text-[11px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]">
                  {formatVideoText(language, 'componentsrendervideopanelsExportDialogText239')}
                </span>
                <span className="relative block">
                  <select
                    value={selectedSpeed}
                    onChange={(event) => setSelectedSpeed(Number(event.target.value))}
                    className="h-10 w-full appearance-none rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface)] pl-3 pr-8 text-sm font-bold text-[var(--vr-text)] outline-none"
                  >
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                      <option key={rate} value={rate}>
                        {rate.toFixed(2)}x
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--vr-text-muted)]" />
                </span>
              </label>
            </div>
          )}

          {isDesktopApp && isVideo && (
            <div className="space-y-1.5">
              <label
                htmlFor="export-dialog-output-dir"
                className="block text-[11px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]"
              >
                {formatVideoText(language, 'componentsrendervideopanelsExportDialogText256')}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  id="export-dialog-output-dir"
                  onClick={isVideo ? onChooseVideoOutputDir : onChooseWebOutputDir}
                  className={`min-w-0 flex-1 rounded-xl border px-3 py-2 text-left text-xs font-bold outline-none transition-colors ${
                    currentOutputDirError
                      ? 'border-rose-400/70 bg-[var(--vr-surface)] text-rose-500'
                      : hasCustomOutputDir
                        ? 'border-[var(--vr-border)] bg-[var(--vr-surface)] text-blue-500 hover:border-[var(--vr-accent)]/60 dark:text-blue-400'
                        : 'border-[var(--vr-border)] bg-[var(--vr-surface)] text-[var(--vr-text-muted)] hover:border-[var(--vr-accent)]/60'
                  }`}
                  aria-label={formatVideoText(
                    language,
                    'componentsrendervideopanelsExportDialogText270',
                  )}
                >
                  <span className="block truncate">
                    {hasCustomOutputDir
                      ? currentOutputDir
                      : formatVideoText(language, 'componentsrendervideopanelsExportDialogText275')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={isVideo ? onChooseVideoOutputDir : onChooseWebOutputDir}
                  className="h-9 w-9 shrink-0 rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface)] text-[var(--vr-text-soft)] transition-colors hover:border-[var(--vr-accent)]/60 hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)]"
                  title={formatVideoText(
                    language,
                    'componentsrendervideopanelsExportDialogText282',
                  )}
                  aria-label={formatVideoText(
                    language,
                    'componentsrendervideopanelsExportDialogText283',
                  )}
                >
                  <FolderOpen className="mx-auto h-4 w-4" />
                </button>
              </div>
              {currentOutputDirError && (
                <p className="text-[11px] font-bold text-rose-500 dark:text-rose-400">
                  {currentOutputDirError}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[var(--vr-border)] px-5 py-4">
          <span className="text-[10px] text-[var(--vr-text-muted)] opacity-60">F12 ↵</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="export-dialog-cancel"
              onClick={onClose}
              className="h-9 rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-4 text-xs font-black text-[var(--vr-text-muted)] transition-colors hover:border-[var(--vr-border-strong)] hover:text-[var(--vr-text)]"
            >
              {formatVideoText(language, 'componentsrendervideopanelsExportDialogText308')}
            </button>
            <button
              type="button"
              id="export-dialog-confirm"
              onClick={handleConfirm}
              className="flex h-9 items-center gap-2 rounded-xl bg-[var(--vr-accent)] px-4 text-xs font-black text-white shadow-sm transition-all hover:brightness-105 active:scale-[0.98]"
            >
              <Download className="h-3.5 w-3.5" />
              {isVideo
                ? formatVideoText(language, 'componentsrendervideopanelsExportDialogText318')
                : formatVideoText(language, 'componentsrendervideopanelsExportDialogText319')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

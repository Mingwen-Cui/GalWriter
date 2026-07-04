import { ChevronDown, Download, FolderOpen, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { Language } from '../../../../lib/i18n';
import {
  EXPORT_FORMAT_OPTIONS,
  FRAME_RATE_OPTIONS,
} from '../shared/constants';
import { renderCopy } from '../shared/renderCopy';
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
  onClose: () => void;
  onConfirm: (params: { name: string; outputDir: string; frameRate: number; exportFormat: ExportFormat }) => void;
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
  const t = (zh: string, ja: string, en: string) => renderCopy(language, zh, ja, en);

  const [videoFileName, setVideoFileName] = useState(defaultVideoFileName);
  const [selectedFrameRate, setSelectedFrameRate] = useState(initialFrameRate);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(initialExportFormat);
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
      ? (videoFileName.trim() || defaultVideoFileName)
      : (webProjectName.trim() || defaultWebProjectName || 'galwriter-web');
    onConfirm({ name, outputDir: currentOutputDir, frameRate: selectedFrameRate, exportFormat: selectedFormat });
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
        aria-label={isVideo
          ? t('导出视频', '動画を書き出す', 'Export Video')
          : t('导出网页', 'Webを書き出す', 'Export Web')}
      >
        <div className="flex items-center justify-between border-b border-[var(--vr-border)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--vr-accent-soft)]">
              <Download className="h-4 w-4 text-[var(--vr-accent-strong)]" />
            </div>
            <h3 className="text-sm font-black text-[var(--vr-text)]">
              {isVideo
                ? t('导出视频', '動画を書き出す', 'Export Video')
                : t('导出网页', 'Webを書き出す', 'Export Web')}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--vr-text-muted)] transition-colors hover:bg-[var(--vr-surface-soft)] hover:text-[var(--vr-text)]"
            aria-label={t('关闭', '閉じる', 'Close')}
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
                ? t('文件名称', 'ファイル名', 'File Name')
                : t('项目名称', 'プロジェクト名', 'Project Name')}
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
                  {t('格式', 'フォーマット', 'Format')}
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
                  {t('帧率', 'フレームレート', 'Frame Rate')}
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

          {isDesktopApp && (
            <div className="space-y-1.5">
              <label
                htmlFor="export-dialog-output-dir"
                className="block text-[11px] font-black uppercase tracking-wide text-[var(--vr-text-muted)]"
              >
                {t('保存位置', '保存先', 'Save Location')}
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
                  aria-label={t('点击选择保存位置', '保存先をクリックして選択', 'Click to choose save location')}
                >
                  <span className="block truncate">
                    {hasCustomOutputDir
                      ? currentOutputDir
                      : t('默认保存到「下载」文件夹', 'デフォルト：ダウンロードフォルダ', 'Saves to Downloads by default')}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={isVideo ? onChooseVideoOutputDir : onChooseWebOutputDir}
                  className="h-9 w-9 shrink-0 rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface)] text-[var(--vr-text-soft)] transition-colors hover:border-[var(--vr-accent)]/60 hover:bg-[var(--vr-accent-soft)] hover:text-[var(--vr-accent-strong)]"
                  title={t('选择保存文件夹', 'フォルダを選択', 'Choose folder')}
                  aria-label={t('选择保存文件夹', 'フォルダを選択', 'Choose folder')}
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
          <span className="text-[10px] text-[var(--vr-text-muted)] opacity-60">
            F12 ↵
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="export-dialog-cancel"
              onClick={onClose}
              className="h-9 rounded-xl border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] px-4 text-xs font-black text-[var(--vr-text-muted)] transition-colors hover:border-[var(--vr-border-strong)] hover:text-[var(--vr-text)]"
            >
              {t('取消', 'キャンセル', 'Cancel')}
            </button>
            <button
              type="button"
              id="export-dialog-confirm"
              onClick={handleConfirm}
              className="flex h-9 items-center gap-2 rounded-xl bg-[var(--vr-accent)] px-4 text-xs font-black text-white shadow-sm transition-all hover:brightness-105 active:scale-[0.98]"
            >
              <Download className="h-3.5 w-3.5" />
              {isVideo
                ? t('开始渲染', 'レンダリング開始', 'Start Render')
                : t('导出网页', 'エクスポート', 'Export')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { Check, Monitor, Search, Trash2, Upload, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';

import type { Language } from '../../../../lib/i18n';
import { getVideoText } from '../i18n';
import {
  customFontFamilyValue,
  fontFamilyValue,
  readCustomFontFile,
  registerCustomRenderFonts,
} from './customFonts';
import type { RenderCustomFont, RenderFontFamilyOption } from './types';

type LocalFont = { family: string; fullName?: string };
const fontLicenseAcknowledgementKey = 'galwriter-font-license-acknowledged:v1';

const readFontLicenseAcknowledgement = () => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(fontLicenseAcknowledgementKey) === 'true';
  } catch {
    return false;
  }
};

type FontFamilyManagerProps = {
  language: Language;
  currentValue: string;
  options: RenderFontFamilyOption[];
  onSelect: (value: string) => void;
  onPresetsChange: (options: RenderFontFamilyOption[]) => void;
  onUploaded: (font: RenderCustomFont) => void;
};

export function CustomFontUploadButton({
  language,
  currentValue,
  options,
  onSelect,
  onPresetsChange,
  onUploaded,
}: FontFamilyManagerProps) {
  const [open, setOpen] = useState(false);
  const [commonOptions, setCommonOptions] = useState(options);
  const [localFonts, setLocalFonts] = useState<LocalFont[]>([]);
  const [localFontSearch, setLocalFontSearch] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [licenseAcknowledged, setLicenseAcknowledged] = useState(readFontLicenseAcknowledgement);
  const [licenseChecked, setLicenseChecked] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const labels = {
    manage: getVideoText(language, 'fontManagerTitle'),
    subtitle: getVideoText(language, 'fontManagerSubtitle'),
    common: getVideoText(language, 'fontManagerCommon'),
    local: getVideoText(language, 'fontManagerLocal'),
    searchLocal: getVideoText(language, 'fontManagerSearchLocal'),
    noMatch: getVideoText(language, 'fontManagerNoMatch'),
    detect: getVideoText(language, 'fontManagerDetect'),
    detecting: getVideoText(language, 'fontManagerDetecting'),
    localHint: getVideoText(language, 'fontManagerLocalHint'),
    browserUnsupported: getVideoText(language, 'fontManagerBrowserUnsupported'),
    permissionDenied: getVideoText(language, 'fontManagerPermissionDenied'),
    noLocal: getVideoText(language, 'fontManagerNoLocal'),
    add: getVideoText(language, 'fontManagerAdd'),
    remove: getVideoText(language, 'fontManagerRemove'),
    licenseTitle: getVideoText(language, 'fontManagerLicenseTitle'),
    licenseBody: getVideoText(language, 'fontManagerLicenseBody'),
    licenseCheck: getVideoText(language, 'fontManagerLicenseCheck'),
    licenseConfirm: getVideoText(language, 'fontManagerLicenseConfirm'),
    upload: getVideoText(language, 'fontManagerUpload'),
    close: getVideoText(language, 'fontManagerClose'),
    readError: getVideoText(language, 'fontManagerReadError'),
    invalidFormat: getVideoText(language, 'fontManagerInvalidFormat'),
  };

  useEffect(() => {
    if (!open) return;
    setCommonOptions(options);
    setError('');
    if (readFontLicenseAcknowledgement()) setLicenseAcknowledged(true);
  }, [open, options]);

  const updateCommonOptions = (next: RenderFontFamilyOption[]) => {
    setCommonOptions(next);
    onPresetsChange(next);
  };

  const addToCommon = (option: RenderFontFamilyOption) => {
    if (commonOptions.some((item) => item.value === option.value)) return;
    updateCommonOptions([...commonOptions, option]);
  };

  const removeFromCommon = (value: string) => {
    if (commonOptions.length <= 1) return;
    updateCommonOptions(commonOptions.filter((item) => item.value !== value));
  };

  const choose = (value: string) => {
    if (!licenseAcknowledged) return;
    onSelect(value);
    setOpen(false);
  };

  const acknowledgeLicense = () => {
    if (!licenseChecked) return;
    setLicenseAcknowledged(true);
    setLicenseChecked(false);
    try {
      window.localStorage.setItem(fontLicenseAcknowledgementKey, 'true');
    } catch {
      // Keep the acknowledgement for the current session when storage is unavailable.
    }
  };

  const detectLocalFonts = async () => {
    if (!licenseAcknowledged) return;
    const queryLocalFonts = (
      window as Window & {
        queryLocalFonts?: () => Promise<LocalFont[]>;
      }
    ).queryLocalFonts;
    if (!queryLocalFonts) {
      setError(labels.browserUnsupported);
      return;
    }
    setDetecting(true);
    setError('');
    try {
      const fonts = await queryLocalFonts();
      const unique = new Map<string, LocalFont>();
      fonts.forEach((font) => {
        const family = String(font.family || '').trim();
        if (family && !unique.has(family)) unique.set(family, { family, fullName: font.fullName });
      });
      setLocalFonts(Array.from(unique.values()).sort((a, b) => a.family.localeCompare(b.family)));
      if (!unique.size) setError(labels.noLocal);
    } catch {
      setError(labels.permissionDenied);
    } finally {
      setDetecting(false);
    }
  };

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const font = await readCustomFontFile(file);
      await registerCustomRenderFonts([font]);
      const option = { label: font.label, value: customFontFamilyValue(font) };
      onUploaded(font);
      addToCommon(option);
      choose(option.value);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error && uploadError.message === 'unsupported-format'
          ? labels.invalidFormat
          : labels.readError,
      );
    }
  };

  const filteredLocalFonts = localFonts.filter((font) => {
    const query = localFontSearch.trim().toLocaleLowerCase();
    if (!query) return true;
    return `${font.family} ${font.fullName || ''}`.toLocaleLowerCase().includes(query);
  });

  return (
    <>
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen(true)}
        className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--vr-border)] px-2 text-left text-xs font-normal text-[var(--vr-text-soft)] transition-colors hover:border-[var(--vr-accent)] hover:text-[var(--vr-accent)]"
        title={labels.manage}
      >
        <Monitor className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{labels.manage}</span>
      </button>
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[30000] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}
          >
            <section
              className="flex max-h-[min(760px,calc(100vh-32px))] w-[min(860px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
              role="dialog"
              aria-modal="true"
              aria-label={labels.manage}
            >
              <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-base font-bold">{labels.manage}</h2>
                  <p className="mt-1 text-xs text-slate-500">{labels.subtitle}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  aria-label={labels.close}
                >
                  <X className="h-4 w-4" />
                </button>
              </header>
              <div className="grid min-h-0 grid-cols-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <section className="min-w-0">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-bold">{labels.common}</h3>
                    <span className="text-xs text-slate-500">{commonOptions.length}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {commonOptions.map((option) => (
                      <div
                        key={option.value}
                        className={`flex items-center gap-2 rounded-xl border p-2 ${option.value === currentValue ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50'}`}
                      >
                        <button
                          type="button"
                          disabled={!licenseAcknowledged}
                          onClick={() => choose(option.value)}
                          className="min-w-0 flex-1 truncate px-2 py-1 text-left text-sm font-medium hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {option.label}
                        </button>
                        {option.value === currentValue ? (
                          <Check className="h-4 w-4 shrink-0 text-indigo-600" />
                        ) : null}
                        <button
                          type="button"
                          disabled={!licenseAcknowledged}
                          onClick={() => removeFromCommon(option.value)}
                          className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-40"
                          title={labels.remove}
                          aria-label={`${labels.remove}: ${option.label}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="min-w-0 space-y-5">
                  {!licenseAcknowledged ? (
                    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <h3 className="text-sm font-bold text-amber-950">{labels.licenseTitle}</h3>
                      <p className="mt-2 text-xs leading-5 text-amber-900">
                        {labels.licenseBody}
                      </p>
                      <label className="mt-3 flex items-start gap-2 text-xs text-amber-950">
                        <input
                          type="checkbox"
                          checked={licenseChecked}
                          onChange={(event) => setLicenseChecked(event.target.checked)}
                          className="mt-0.5 accent-amber-600"
                        />
                        <span>{labels.licenseCheck}</span>
                      </label>
                      <button
                        type="button"
                        disabled={!licenseChecked}
                        onClick={acknowledgeLicense}
                        className="mt-3 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {labels.licenseConfirm}
                      </button>
                    </section>
                  ) : null}

                  <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold">{labels.local}</h3>
                        <p className="mt-1 text-xs text-slate-500">{labels.localHint}</p>
                      </div>
                      <button
                        type="button"
                        onClick={detectLocalFonts}
                        disabled={detecting || !licenseAcknowledged}
                        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
                      >
                        <Search className="h-3.5 w-3.5" />
                        {detecting ? labels.detecting : labels.detect}
                      </button>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <label className="relative min-w-0 flex-1">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="search"
                          value={localFontSearch}
                          onChange={(event) => setLocalFontSearch(event.target.value)}
                          placeholder={labels.searchLocal}
                          disabled={!licenseAcknowledged}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs outline-none focus:border-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </label>
                      {licenseAcknowledged ? (
                        <button
                          type="button"
                          onClick={() => inputRef.current?.click()}
                          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-amber-600 px-3 text-xs font-bold text-white hover:bg-amber-700"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          {labels.upload}
                        </button>
                      ) : null}
                    </div>
                    <input
                      ref={inputRef}
                      type="file"
                      accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
                      className="hidden"
                      onChange={handleUpload}
                    />
                    {filteredLocalFonts.length ? (
                      <div className="mt-3 grid max-h-52 grid-cols-1 gap-2 overflow-y-auto">
                        {filteredLocalFonts.map((font) => {
                          const option = {
                            label: font.family,
                            value: fontFamilyValue(font.family),
                          };
                          const inCommon = commonOptions.some(
                            (item) => item.value === option.value,
                          );
                          return (
                            <div
                              key={font.family}
                              className="flex items-center gap-2 rounded-lg bg-white px-2 py-1.5"
                            >
                              <button
                                type="button"
                                disabled={!licenseAcknowledged}
                                onClick={() => choose(option.value)}
                                className="min-w-0 flex-1 truncate text-left text-xs font-medium hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
                                style={{ fontFamily: option.value }}
                              >
                                {font.fullName && font.fullName !== font.family
                                  ? font.fullName
                                  : font.family}
                              </button>
                              <button
                                type="button"
                                disabled={!licenseAcknowledged}
                                onClick={() =>
                                  inCommon ? removeFromCommon(option.value) : addToCommon(option)
                                }
                                className="rounded-md p-1 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-40"
                                title={inCommon ? labels.remove : labels.add}
                                aria-label={`${inCommon ? labels.remove : labels.add}: ${font.family}`}
                              >
                                <Check
                                  className={`h-3.5 w-3.5 ${inCommon ? 'opacity-100' : 'opacity-30'}`}
                                />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : localFonts.length ? (
                      <p className="mt-3 text-xs text-slate-500">{labels.noMatch}</p>
                    ) : null}
                  </section>
                  {error ? <p className="text-xs text-rose-600">{error}</p> : null}
                </div>
              </div>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}

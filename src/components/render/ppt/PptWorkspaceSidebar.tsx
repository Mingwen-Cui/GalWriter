import {
  Clock3,
  Download,
  ListOrdered,
  Save,
  Settings,
  Settings2,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import defaultMainInterfaceBackgroundUrl from '../../../assets/common/default-main-interface-background.jpg';

import { isRapidAssetEdition } from '../../../lib/appAssets';
import type { Language } from '../../../lib/i18n';
import type { HomepageCoverTemplate } from '../homepageCoverTemplates';
import { RapidEditionTemplateNotice } from '../RapidEditionTemplateNotice';
import type { LayerChange } from '../shared/inspectors/GeometryPopovers';
import { downloadTemplateArchive } from '../templateArchive';
import { RenderObjectInspector } from '../video/objectInspector/RenderObjectInspector';
import { registerCustomRenderFonts, renderFontOptions } from '../video/shared/customFonts';
import type {
  PptAnimationStart,
  PptExportSettings,
  PptManualElement,
  PptManualSlide,
  PptObjectAnimation,
  PptSlideBackgroundStyle,
  PptTextBoxLayout,
  PptTextOverrideTarget,
  RenderStyle,
  WebExportSettings,
} from '../video/shared/types';
import { AnimationTimeline } from './PptAnimationTimeline';
import { usePptCopy } from './pptCopyContext';
import { PptCoverTextInspector } from './PptCoverTextInspector';
import { PptDirectionControl } from './PptDirectionControl';
import { PptManualInspector } from './PptManualInspector';
import { PptNumberInput } from './PptNumberInput';
import { PptSlideBackgroundInspector } from './PptSlideBackgroundInspector';
import type { Selection, VideoTimelineTrack } from './PptWorkspace';
import { effectLabel, startLabel } from './PptWorkspace';
import type { PptWorkspaceSidebarTab } from './pptWorkspaceModel';

type SidebarTab = PptWorkspaceSidebarTab;

type SavedPptCoverTemplate = {
  id: string;
  name: string;
  savedAt: number;
  settings: PptExportSettings;
};

const pptCoverTemplateLibraryStorageKey = 'galwriter-ppt-cover-templates:v1';

const readPptCoverTemplateLibrary = (): SavedPptCoverTemplate[] => {
  if (typeof window === 'undefined') return [];
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(pptCoverTemplateLibraryStorageKey) || '[]',
    );
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
};

export function PptSidebar({
  language,
  renderStyle,
  updateRenderStyle,
  activeTab,
  setActiveTab,
  selected,
  animation: _animation,
  animations,
  videoTrack,
  playheadMs,
  onPlayheadChange,
  pptSettings,
  updatePptSettings,
  onSelectAnimation,
  onSelectVideo,
  onDelete,
  onDeleteAnimations,
  onMoveAnimations,
  onResizeAnimation,
  onPreview,
  previewing,
  loopPreview,
  onToggleLoopPreview,
  onPausePreview,
  onUpdate: _onUpdate,
  manualSlide,
  selectedManualElementId,
  coverTextBox,
  slides,
  backgroundSelected,
  coverSelected,
  homepageCoverTemplates,
  onApplyHomepageCoverPreset,
  currentSlideBackground,
  webSettings,
  onUpdateSlideBackground,
  onUpdateSlideBackgroundColor,
  onUpdateManualElement,
  onUpdateManualElements,
  selectedCanvasSelectionKeys,
  onAlignSelectedCanvasElements,
  onDeleteManualElement,
  onUpdateCoverText,
  onUpdateCoverTextBoxLayout,
}: {
  language: Language;
  renderStyle: RenderStyle;
  updateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
  activeTab: SidebarTab;
  setActiveTab: (tab: SidebarTab) => void;
  selected: Selection | null;
  animation?: PptObjectAnimation;
  animations: PptObjectAnimation[];
  videoTrack?: VideoTimelineTrack;
  playheadMs: number;
  onPlayheadChange: (milliseconds: number) => void;
  pptSettings: PptExportSettings;
  updatePptSettings: (patch: Partial<PptExportSettings>) => void;
  onSelectAnimation: (animation: PptObjectAnimation) => void;
  onSelectVideo: () => void;
  onDelete: (id: string) => void;
  onDeleteAnimations: (ids: string[]) => void;
  onMoveAnimations: (ids: string[], deltaMs: number) => void;
  onResizeAnimation: (id: string, edge: 'left' | 'right', deltaMs: number) => void;
  onPreview: () => void;
  previewing: boolean;
  loopPreview: boolean;
  onToggleLoopPreview: () => void;
  onPausePreview: () => void;
  onUpdate: (patch: Partial<PptObjectAnimation>) => void;
  manualSlide?: PptManualSlide;
  selectedManualElementId?: string;
  coverTextBox?: {
    target: Extract<PptTextOverrideTarget, 'cover-title' | 'cover-subtitle' | 'cover-description'>;
    label: string;
    text: string;
    layout: PptTextBoxLayout;
  };
  slides: Array<{ id: string; title: string }>;
  backgroundSelected: boolean;
  coverSelected: boolean;
  homepageCoverTemplates: HomepageCoverTemplate[];
  onApplyHomepageCoverPreset: (templateId: HomepageCoverTemplate['id']) => void;
  currentSlideBackground: PptSlideBackgroundStyle;
  webSettings: WebExportSettings;
  onUpdateSlideBackground: (patch: Partial<PptSlideBackgroundStyle>) => void;
  onUpdateSlideBackgroundColor: (color: string) => void;
  onUpdateManualElement: (elementId: string, patch: Partial<PptManualElement>) => void;
  onUpdateManualElements?: (changes: LayerChange[]) => void;
  selectedCanvasSelectionKeys: string[];
  onAlignSelectedCanvasElements: (axis: 'x' | 'y', value: 'start' | 'center' | 'end') => void;
  onDeleteManualElement: (elementId: string) => void;
  onUpdateCoverText: (
    target: Extract<PptTextOverrideTarget, 'cover-title' | 'cover-subtitle' | 'cover-description'>,
    text: string,
  ) => void;
  onUpdateCoverTextBoxLayout: (
    target: Extract<PptTextOverrideTarget, 'cover-title' | 'cover-subtitle' | 'cover-description'>,
    patch: Partial<PptTextBoxLayout>,
  ) => void;
}) {
  const copy = usePptCopy();
  useEffect(() => {
    void registerCustomRenderFonts(renderStyle.customFonts);
  }, [renderStyle.customFonts]);
  const pptFontOptions = renderFontOptions(renderStyle.fontFamilyPresets, renderStyle.customFonts);
  const addPptCustomFont = (font: import('../video/shared/types').RenderCustomFont) =>
    updateRenderStyle('customFonts', [
      ...(renderStyle.customFonts || []).filter((item) => item.id !== font.id),
      font,
    ]);
  const fontFamilyManager = {
    options: pptFontOptions,
    onPresetsChange: (options: import('../video/shared/types').RenderFontFamilyOption[]) =>
      updateRenderStyle('fontFamilyPresets', options),
    onUploaded: addPptCustomFont,
  };
  const [animationPage, setAnimationPage] = useState<'details' | 'timeline'>('timeline');
  const [isAnimationPageOpen, setIsAnimationPageOpen] = useState(false);
  const animationTriggerRef = useRef<HTMLButtonElement>(null);
  const animationPagePopoverRef = useRef<HTMLDivElement>(null);
  const [isCoverDesignOpen, setIsCoverDesignOpen] = useState(false);
  const coverDesignTriggerRef = useRef<HTMLButtonElement>(null);
  const coverDesignPopoverRef = useRef<HTMLDivElement>(null);
  const showParameterDescriptions = false;
  const [coverDesignMode, setCoverDesignMode] = useState<'background' | 'preset'>('background');
  const [savedPptCoverTemplates, setSavedPptCoverTemplates] = useState(readPptCoverTemplateLibrary);
  const [selectedPptCoverTemplateId, setSelectedPptCoverTemplateId] = useState<string | null>(null);
  const [isPptTemplateEditing, setIsPptTemplateEditing] = useState(false);
  const coverDesignCopy =
    language === 'zh'
      ? { background: '背景样式', preset: '模板' }
      : language === 'ja'
        ? { background: '背景スタイル', preset: 'テンプレート' }
        : { background: 'Background', preset: 'Templates' };
  const coverTemplateActionCopy =
    language === 'zh'
      ? { export: '导出模板', download: '下载模板', save: '保存模板', edit: '编辑模板' }
      : language === 'ja'
        ? {
            export: 'テンプレートを書き出す',
            download: 'テンプレートをダウンロード',
            save: 'テンプレートを保存',
            edit: 'テンプレートを編集',
          }
        : {
            export: 'Export template',
            download: 'Download template',
            save: 'Save template',
            edit: 'Edit templates',
          };
  const selectAnimation = (item: PptObjectAnimation) => {
    onSelectAnimation(item);
  };
  const downloadJson = (filename: string, content: unknown) => {
    if (typeof document === 'undefined') return;
    const blob = new Blob([JSON.stringify(content, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };
  const savePptCoverTemplate = () => {
    const entry: SavedPptCoverTemplate = {
      id: `ppt-cover-${Date.now()}`,
      name:
        language === 'zh'
          ? '我的封面模板'
          : language === 'ja'
            ? 'マイ表紙テンプレート'
            : 'My cover template',
      savedAt: Date.now(),
      settings: pptSettings,
    };
    const next = [entry, ...savedPptCoverTemplates].slice(0, 24);
    try {
      window.localStorage.setItem(pptCoverTemplateLibraryStorageKey, JSON.stringify(next));
    } catch {
      // Keep the newly saved template available for this session when storage is full.
    }
    setSavedPptCoverTemplates(next);
    setSelectedPptCoverTemplateId(entry.id);
  };
  const deletePptCoverTemplate = (templateId: string) => {
    const next = savedPptCoverTemplates.filter((template) => template.id !== templateId);
    try {
      window.localStorage.setItem(pptCoverTemplateLibraryStorageKey, JSON.stringify(next));
    } catch {
      // State is still updated so the editor immediately reflects the deletion.
    }
    setSavedPptCoverTemplates(next);
    if (selectedPptCoverTemplateId === templateId) setSelectedPptCoverTemplateId(null);
  };
  const tabs = [
    { id: 'style', label: copy.design, icon: Settings2 },
    { id: 'timeline', label: copy.animation, icon: ListOrdered },
  ] as const;
  const activeTabConfig = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  useEffect(() => {
    if (!isAnimationPageOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (
        !(target instanceof Node) ||
        (animationTriggerRef.current &&
          !animationTriggerRef.current.contains(target) &&
          !animationPagePopoverRef.current?.contains(target))
      ) {
        setIsAnimationPageOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [isAnimationPageOpen]);
  useEffect(() => {
    if (!isCoverDesignOpen) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (
        !(target instanceof Node) ||
        ((!coverDesignTriggerRef.current || !coverDesignTriggerRef.current.contains(target)) &&
          !coverDesignPopoverRef.current?.contains(target))
      ) {
        setIsCoverDesignOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [isCoverDesignOpen]);
  useEffect(() => {
    if (activeTab !== 'style' || !coverSelected) setIsCoverDesignOpen(false);
  }, [activeTab, coverSelected]);

  return (
    <aside className="flex w-[380px] shrink-0 flex-col border-l border-[var(--vr-border)] bg-[var(--vr-surface-strong)]">
      <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-[var(--vr-border)] px-4 text-xs font-black uppercase tracking-wide text-[var(--vr-text-soft)]">
        <div className="flex min-w-0 items-center gap-2">
          <activeTabConfig.icon className="h-4 w-4 shrink-0 text-[var(--vr-accent)]" />
          <span className="truncate">{activeTabConfig.label}</span>
        </div>
        <div className="flex h-8 shrink-0 rounded-lg bg-[var(--vr-surface-soft)] p-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              ref={
                tab.id === 'timeline'
                  ? animationTriggerRef
                  : tab.id === 'style'
                    ? coverDesignTriggerRef
                    : undefined
              }
              onClick={() => {
                setActiveTab(tab.id);
                setIsAnimationPageOpen((open) => (tab.id === 'timeline' ? !open : false));
                setIsCoverDesignOpen((open) =>
                  tab.id === 'style' && coverSelected
                    ? activeTab === 'style'
                      ? !open
                      : true
                    : false,
                );
              }}
              className={`flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-black transition-colors ${
                activeTab === tab.id
                  ? 'bg-[var(--vr-accent)] text-white shadow-sm'
                  : 'text-[var(--vr-text-muted)] hover:text-[var(--vr-text)]'
              }`}
              title={tab.label}
              aria-label={tab.label}
              aria-pressed={activeTab === tab.id}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {activeTab === 'timeline' ? (
          <>
            {isAnimationPageOpen && (
              <div ref={animationPagePopoverRef} className="relative -mt-1 h-10">
                <span
                  aria-hidden="true"
                  className="absolute right-6 top-[-7px] z-20 h-3.5 w-3.5 rotate-45 border-l border-t border-[var(--vr-border)] bg-white"
                />
                <div className="relative flex justify-end">
                  <div className="flex overflow-hidden rounded-xl border border-[var(--vr-border)] bg-white p-1 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setAnimationPage('timeline')}
                      className={`relative z-30 h-8 rounded-lg px-3 text-[11px] font-black transition-colors ${animationPage === 'timeline' ? 'bg-[var(--vr-accent)] text-white shadow-sm' : 'text-[var(--vr-text-soft)] hover:bg-white/5 hover:text-[var(--vr-text)]'}`}
                      aria-pressed={animationPage === 'timeline'}
                    >
                      时间轴
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnimationPage('details')}
                      className={`relative z-30 h-8 rounded-lg px-3 text-[11px] font-black transition-colors ${animationPage === 'details' ? 'bg-[var(--vr-accent)] text-white shadow-sm' : 'text-[var(--vr-text-soft)] hover:bg-white/5 hover:text-[var(--vr-text)]'}`}
                      aria-pressed={animationPage === 'details'}
                    >
                      动画详情
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-3">
              {selected &&
              !animations.some(
                (item) => item.target === selected.target && item.targetId === selected.targetId,
              ) ? (
                <p className="mb-3 text-xs text-[var(--vr-text-muted)]">
                  {selected.label} · {copy.noAnimation}
                </p>
              ) : null}
              {animationPage === 'timeline' ? (
                <AnimationTimeline
                  mode="overview"
                  emptyLabel={selected ? copy.noAnimation : undefined}
                  animations={animations}
                  videoTrack={videoTrack}
                  playheadMs={playheadMs}
                  onPlayheadChange={onPlayheadChange}
                  onSelect={selectAnimation}
                  onSelectVideo={onSelectVideo}
                  onDelete={onDelete}
                  onDeleteAnimations={onDeleteAnimations}
                  onMoveAnimations={onMoveAnimations}
                  onResizeAnimation={onResizeAnimation}
                  onPreview={onPreview}
                  previewing={previewing}
                  loopPreview={loopPreview}
                  onToggleLoopPreview={onToggleLoopPreview}
                  onPausePreview={onPausePreview}
                />
              ) : (
                <AnimationTimeline
                  mode="list"
                  emptyLabel={selected ? copy.noAnimation : undefined}
                  animations={animations}
                  videoTrack={videoTrack}
                  playheadMs={playheadMs}
                  onPlayheadChange={onPlayheadChange}
                  onSelect={selectAnimation}
                  onSelectVideo={onSelectVideo}
                  onDelete={onDelete}
                  onDeleteAnimations={onDeleteAnimations}
                  onMoveAnimations={onMoveAnimations}
                  onResizeAnimation={onResizeAnimation}
                  onPreview={onPreview}
                  previewing={previewing}
                  loopPreview={loopPreview}
                  onToggleLoopPreview={onToggleLoopPreview}
                  onPausePreview={onPausePreview}
                />
              )}
            </div>
          </>
        ) : null}
        {activeTab === 'style' ? (
          coverSelected ? (
            <>
              {isCoverDesignOpen && (
                <div ref={coverDesignPopoverRef} className="relative -mt-1 h-10">
                  <span
                    aria-hidden="true"
                    className="absolute right-[88px] top-[-7px] z-20 h-3.5 w-3.5 rotate-45 border-l border-t border-[var(--vr-border)] bg-white"
                  />
                  <div className="relative flex justify-end">
                    <div className="flex overflow-hidden rounded-xl border border-[var(--vr-border)] bg-white p-1 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setCoverDesignMode('background')}
                        aria-pressed={coverDesignMode === 'background'}
                        className={`relative z-30 h-8 rounded-lg px-3 text-[11px] font-black transition-colors ${coverDesignMode === 'background' ? 'bg-[var(--vr-accent)] text-white shadow-sm' : 'text-[var(--vr-text-soft)] hover:bg-white/5 hover:text-[var(--vr-text)]'}`}
                      >
                        {coverDesignCopy.background}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCoverDesignMode('preset')}
                        aria-pressed={coverDesignMode === 'preset'}
                        className={`relative z-30 h-8 rounded-lg px-3 text-[11px] font-black transition-colors ${coverDesignMode === 'preset' ? 'bg-[var(--vr-accent)] text-white shadow-sm' : 'text-[var(--vr-text-soft)] hover:bg-white/5 hover:text-[var(--vr-text)]'}`}
                      >
                        {coverDesignCopy.preset}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-2">
                {coverDesignMode === 'preset' ? (
                  <div className="grid gap-2">
                    <button
                      type="button"
                      onClick={() => onApplyHomepageCoverPreset('universal')}
                      className="group overflow-hidden rounded-xl border border-indigo-500/15 bg-[var(--vr-surface-soft)] text-left transition-colors hover:border-indigo-500/50"
                    >
                      <div className="relative aspect-video overflow-hidden bg-white">
                        <img src={defaultMainInterfaceBackgroundUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                        <span className="absolute left-[9%] top-[26%] h-[2px] w-[4%] bg-[#625bf6]" />
                        <span className="absolute left-[9%] top-[70%] h-px w-[24%] bg-[#dce1ee]" />
                        <span className="absolute left-[39%] top-[25%] aspect-square w-[1.5%] rounded-full border border-[#c3c7df]" />
                        <span className="absolute left-[9%] top-[33%] text-[clamp(10px,1vw,16px)] font-extrabold leading-tight text-[#252a49]">
                          {language === 'zh' ? <>故事，<br />从这里开始</> : language === 'ja' ? <>ここから、<br />物語が始まる。</> : <>Your story<br />starts here.</>}
                        </span>
                      </div>
                      <span className="block p-2">
                        <span className="block text-[11px] font-black text-[var(--vr-text)]">
                          {language === 'zh' ? '通用封面' : language === 'ja' ? '汎用カバー' : 'Universal cover'}
                        </span>
                        <span className="mt-0.5 block text-[10px] leading-4 text-[var(--vr-text-muted)]">
                          {language === 'zh' ? '浅色画廊、简单图形与可编辑标题' : language === 'ja' ? '明るいギャラリーと編集可能なタイトル' : 'A light gallery with editable typography'}
                        </span>
                      </span>
                    </button>
                    {isRapidAssetEdition() ? (
                      <RapidEditionTemplateNotice language={language} kind="preset" />
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {homepageCoverTemplates.map((template) => (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => onApplyHomepageCoverPreset(template.id)}
                            className="group overflow-hidden rounded-xl border border-indigo-500/15 bg-[var(--vr-surface-soft)] text-left transition-colors hover:border-indigo-500/50 hover:bg-white/5"
                          >
                            <img
                              src={template.previewUrl}
                              alt=""
                              className="aspect-video w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                            />
                            <span className="block p-2">
                              <span className="block truncate text-[11px] font-black text-[var(--vr-text)]">
                                {template.name}
                              </span>
                              <span className="mt-0.5 block line-clamp-2 text-[10px] font-bold leading-4 text-[var(--vr-text-muted)]">
                                {template.description}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void downloadTemplateArchive({
                            filename: 'galwriter-ppt-cover-export.zip',
                            template: {
                              version: 1,
                              kind: 'ppt-cover-template',
                              settings: pptSettings,
                              background: currentSlideBackground,
                            },
                          })
                        }
                        className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--vr-surface-soft)] px-2 text-[11px] font-black text-[var(--vr-text-soft)] transition-colors hover:bg-white/5 hover:text-[var(--vr-text)]"
                      >
                        <Upload className="h-4 w-4" />
                        {coverTemplateActionCopy.export}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const selected = savedPptCoverTemplates.find(
                            (template) => template.id === selectedPptCoverTemplateId,
                          );
                          downloadJson(
                            'galwriter-ppt-template.json',
                            selected || { version: 1, kind: 'ppt-template', settings: pptSettings },
                          );
                        }}
                        className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--vr-surface-soft)] px-2 text-[11px] font-black text-[var(--vr-text-soft)] transition-colors hover:bg-white/5 hover:text-[var(--vr-text)]"
                      >
                        <Download className="h-4 w-4" />
                        {coverTemplateActionCopy.download}
                      </button>
                      <button
                        type="button"
                        onClick={savePptCoverTemplate}
                        className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--vr-surface-soft)] px-2 text-[11px] font-black text-[var(--vr-text-soft)] transition-colors hover:bg-white/5 hover:text-[var(--vr-text)]"
                      >
                        <Save className="h-4 w-4" />
                        {coverTemplateActionCopy.save}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsPptTemplateEditing((editing) => !editing)}
                        className={`flex h-10 items-center justify-center gap-2 rounded-xl px-2 text-[11px] font-black transition-colors ${isPptTemplateEditing ? 'bg-[var(--vr-accent)] text-white shadow-sm' : 'bg-[var(--vr-surface-soft)] text-[var(--vr-text-soft)] hover:bg-white/5 hover:text-[var(--vr-text)]'}`}
                      >
                        <Settings className="h-4 w-4" />
                        {coverTemplateActionCopy.edit}
                      </button>
                    </div>
                    {isPptTemplateEditing && (
                      <div className="grid gap-2">
                        {savedPptCoverTemplates.map((template) => (
                          <div
                            key={template.id}
                            className={`flex items-center gap-2 rounded-xl border p-2 ${selectedPptCoverTemplateId === template.id ? 'border-indigo-500/45 bg-indigo-500/10' : 'border-indigo-500/15 bg-[var(--vr-surface-soft)]'}`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPptCoverTemplateId(template.id);
                                updatePptSettings(template.settings);
                              }}
                              className="min-w-0 flex-1 truncate text-left text-[11px] font-black text-[var(--vr-text)]"
                            >
                              {template.name}
                            </button>
                            <button
                              type="button"
                              onClick={() => deletePptCoverTemplate(template.id)}
                              className="grid h-7 w-7 place-items-center rounded-lg text-[var(--vr-text-muted)] transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                              title="删除模板"
                              aria-label="删除模板"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : manualSlide ? (
                  <PptManualInspector
                    copy={copy}
                    language={language}
                    slide={manualSlide}
                    selectedElementId={selectedManualElementId}
                    selectedElementIds={selectedCanvasSelectionKeys}
                    slides={slides}
                    showDescriptions={showParameterDescriptions}
                    onUpdateBackgroundColor={onUpdateSlideBackgroundColor}
                    onUpdateElement={onUpdateManualElement}
                    onUpdateElements={onUpdateManualElements}
                    onAlignSelected={onAlignSelectedCanvasElements}
                    onDeleteElement={onDeleteManualElement}
                    fontFamilyManager={fontFamilyManager}
                  />
                ) : backgroundSelected ? (
                  <PptSlideBackgroundInspector
                    language={language}
                    webSettings={webSettings}
                    pptSettings={pptSettings}
                    background={currentSlideBackground}
                    showDescriptions={showParameterDescriptions}
                    onUpdateBackground={onUpdateSlideBackground}
                    onUpdatePptSettings={updatePptSettings}
                  />
                ) : coverTextBox ? (
                  <PptCoverTextInspector
                    target={coverTextBox.target}
                    text={coverTextBox.text}
                    layout={coverTextBox.layout}
                    language={language}
                    showDescriptions={showParameterDescriptions}
                    onUpdateText={onUpdateCoverText}
                    onUpdateLayout={onUpdateCoverTextBoxLayout}
                    selectedElementIds={selectedCanvasSelectionKeys}
                    onAlignSelected={onAlignSelectedCanvasElements}
                    fontFamilyManager={fontFamilyManager}
                  />
                ) : (
                  <PptSlideBackgroundInspector
                    language={language}
                    webSettings={webSettings}
                    pptSettings={pptSettings}
                    background={currentSlideBackground}
                    showDescriptions={showParameterDescriptions}
                    onUpdateBackground={onUpdateSlideBackground}
                    onUpdatePptSettings={updatePptSettings}
                  />
                )}
              </div>
            </>
          ) : backgroundSelected ? (
            <PptSlideBackgroundInspector
              language={language}
              webSettings={webSettings}
              pptSettings={pptSettings}
              background={currentSlideBackground}
              showDescriptions={showParameterDescriptions}
              onUpdateBackground={onUpdateSlideBackground}
              onUpdatePptSettings={updatePptSettings}
            />
          ) : manualSlide ? (
            <PptManualInspector
              copy={copy}
              language={language}
              slide={manualSlide}
              selectedElementId={selectedManualElementId}
              selectedElementIds={selectedCanvasSelectionKeys}
              slides={slides}
              showDescriptions={showParameterDescriptions}
              onUpdateBackgroundColor={onUpdateSlideBackgroundColor}
              onUpdateElement={onUpdateManualElement}
              onUpdateElements={onUpdateManualElements}
              onAlignSelected={onAlignSelectedCanvasElements}
              onDeleteElement={onDeleteManualElement}
              fontFamilyManager={fontFamilyManager}
            />
          ) : coverTextBox ? (
            <PptCoverTextInspector
              target={coverTextBox.target}
              text={coverTextBox.text}
              layout={coverTextBox.layout}
              language={language}
              showDescriptions={showParameterDescriptions}
              onUpdateText={onUpdateCoverText}
              onUpdateLayout={onUpdateCoverTextBoxLayout}
              selectedElementIds={selectedCanvasSelectionKeys}
              onAlignSelected={onAlignSelectedCanvasElements}
              fontFamilyManager={fontFamilyManager}
            />
          ) : (
            <>
              <RenderObjectInspector
                language={language}
                renderStyle={renderStyle}
                updateRenderStyle={updateRenderStyle}
                surface="web"
                hideObjectSelector
                showDescriptions={showParameterDescriptions}
              />
            </>
          )
        ) : null}
      </div>
    </aside>
  );
}
function _ObjectProperties({
  selected,
  animation,
  onUpdate,
}: {
  selected: Selection | null;
  animation?: PptObjectAnimation;
  onUpdate: (patch: Partial<PptObjectAnimation>) => void;
}) {
  const copy = usePptCopy();
  if (!selected)
    return (
      <div className="rounded-lg border border-dashed border-[var(--vr-border)] px-4 py-8 text-center text-xs leading-5 text-[var(--vr-text-muted)]">
        {copy.selectedObjectHint}
      </div>
    );
  return (
    <>
      <div className="mb-5 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--vr-accent-soft)] text-[var(--vr-accent-strong)]">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-black text-[var(--vr-text)]">{selected.label}</h2>
          <p className="text-xs text-[var(--vr-text-muted)]">
            {animation
              ? effectLabel(copy, animation.effect, animation.action)
              : copy.noAnimationAdded}
          </p>
        </div>
      </div>
      {animation?.source === 'tag' ? (
        <div className="rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-3 text-xs leading-5 text-[var(--vr-text-muted)]">
          <strong className="block text-[var(--vr-text)]">由剧情标签驱动</strong>
          {startLabel(copy, animation.start)} ·{' '}
          {effectLabel(copy, animation.effect, animation.action)} ·{' '}
          {(animation.durationMs / 1000).toFixed(1)} {copy.seconds}
          <p className="mt-1">
            此处只展示该标签对应的 PPT 动画；编辑标签后，时间轴和导出会自动同步。
          </p>
        </div>
      ) : (
        <>
          <label className="mb-4 block text-xs font-bold text-[var(--vr-text-muted)]">
            {copy.start}
            <select
              value={animation?.start || 'onClick'}
              onChange={(event) => onUpdate({ start: event.target.value as PptAnimationStart })}
              className="render-field mt-1.5 w-full"
            >
              <option value="onClick">{copy.onClick}</option>
              <option value="withPrevious">{copy.withPrevious}</option>
              <option value="afterPrevious">{copy.afterPrevious}</option>
            </select>
          </label>
          <div className="mb-4 text-xs font-bold text-[var(--vr-text-muted)]">
            {copy.effectOptions}
            <div className="mt-1.5">
              <PptDirectionControl
                value={animation?.direction || 'left'}
                phase={animation?.phase}
                disabled={animation?.phase === 'emphasis'}
                onChange={(direction) => onUpdate({ direction })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-bold text-[var(--vr-text-muted)]">
              {copy.duration}
              <PptNumberInput
                label={copy.duration}
                min={0.1}
                max={10}
                value={(animation?.durationMs || 500) / 1000}
                onChange={(value) => onUpdate({ durationMs: Math.round(value * 1000) })}
                className="ppt-number-field--inspector mt-1.5"
              />
            </label>
            <label className="text-xs font-bold text-[var(--vr-text-muted)]">
              {copy.delay}
              <PptNumberInput
                label={copy.delay}
                min={0}
                max={10}
                value={(animation?.delayMs || 0) / 1000}
                onChange={(value) => onUpdate({ delayMs: Math.round(value * 1000) })}
                className="ppt-number-field--inspector mt-1.5"
              />
            </label>
          </div>
          <div className="mt-6 rounded-lg border border-[var(--vr-border)] bg-[var(--vr-surface-soft)] p-3 text-xs leading-5 text-[var(--vr-text-muted)]">
            <Clock3 className="mr-1 inline h-3.5 w-3.5" />
            {copy.animationPersistenceHint}
          </div>
        </>
      )}
    </>
  );
}
export function NotesPanel({
  height,
  onResizeStart,
  value,
  onChange,
}: {
  height: number;
  onResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void;
  value?: string;
  onChange: (value: string) => void;
}) {
  return (
    <section
      className="relative shrink-0 border-t border-[var(--vr-border)] bg-[var(--vr-surface-strong)]"
      style={{ height }}
    >
      <div
        role="separator"
        aria-orientation="horizontal"
        onPointerDown={onResizeStart}
        className="absolute inset-x-0 top-0 z-10 h-2 -translate-y-1/2 cursor-row-resize before:absolute before:inset-x-0 before:top-1/2 before:border-t before:border-[var(--vr-border)] hover:before:border-[var(--vr-accent)]"
      />
      <textarea
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder="单击此处添加备注"
        className="h-full w-full resize-none bg-transparent px-4 py-3 text-base leading-7 text-[var(--vr-text)] outline-none placeholder:text-[var(--vr-text-muted)]"
      />
    </section>
  );
}

import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Check,
  Copy,
  ExternalLink,
  HelpCircle,
  ImageIcon,
  Layers,
  Mail,
  MessageCircle,
  PlayCircle,
  Settings,
  ShieldAlert,
  X,
} from 'lucide-react';
import React, { useState } from 'react';

import { AISettingsPanel } from './AISettingsPanel';
import {
  type AIButtonsConfig,
  type AIPromptsConfig,
} from '../editor-state/editorConfig';
import type {
  ImageAIProfile,
  SavedAIProfile,
  TextAIProfile,
  VoiceAIProfile,
} from '../domain/project';
import { Language, translations } from '../lib/i18n';

interface SettingsModalProps {
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  bubbleStyle: 'glass' | 'flat';
  setBubbleStyle: (style: 'glass' | 'flat') => void;
  canvasBg: string;
  setCanvasBg: (bg: string) => void;
  presetColors: string[];
  setPresetColors: (colors: string[]) => void;
  toolbarLayout: 'vertical' | 'horizontal';
  setToolbarLayout: (layout: 'vertical' | 'horizontal') => void;
  selectionMenuLayout: 'horizontal' | 'vertical';
  setSelectionMenuLayout: (layout: 'horizontal' | 'vertical') => void;
  edgeStyle: 'step' | 'bezier';
  setEdgeStyle: (style: 'step' | 'bezier') => void;
  pasteAsPlainText: boolean;
  setPasteAsPlainText: (val: boolean) => void;
  showNodeActions: boolean;
  setShowNodeActions: (val: boolean) => void;
  showStats: boolean;
  setShowStats: (val: boolean) => void;
  saveAssistantConversations: boolean;
  setSaveAssistantConversations: (val: boolean) => void;
  showMiniMap: boolean;
  setShowMiniMap: (val: boolean) => void;
  miniMapPosition: 'left' | 'right';
  setMiniMapPosition: (position: 'left' | 'right') => void;
  showControls: boolean;
  setShowControls: (val: boolean) => void;
  savedAIProfiles: SavedAIProfile[];
  activeTextProfileId: string | null;
  activeImageProfileId: string | null;
  activeVoiceProfileId: string | null;
  onCreateAIProfile: (
    kind: 'text' | 'image' | 'voice',
    initialProfile?: Partial<TextAIProfile & ImageAIProfile & VoiceAIProfile>,
  ) => void | string | Promise<void | string>;
  onUpdateAIProfile: (
    profileId: string,
    updates: Partial<TextAIProfile> | Partial<ImageAIProfile> | Partial<VoiceAIProfile>,
  ) => void | Promise<void>;
  onSelectAIProfile: (
    kind: 'text' | 'image' | 'voice',
    profileId: string,
  ) => void | Promise<void>;
  onDeleteAIProfile: (profileId: string) => void | Promise<void>;
  generateLength: string;
  setGenerateLength: (len: string) => void;
  aiPrompts: AIPromptsConfig;
  setAiPrompts: (prompts: AIPromptsConfig) => void;
  aiButtonsConfig: AIButtonsConfig;
  setAiButtonsConfig: (config: AIButtonsConfig) => void;
  handleContactCopy: (text: string, type: 'qq' | 'email') => void;
  qqCopied: boolean;
  emailCopied: boolean;
  playTestDarkMode: boolean;
  setPlayTestDarkMode: (val: boolean) => void;
  playTestChoicesColumns: number;
  setPlayTestChoicesColumns: (val: number) => void;
  playTestVideoAutoPlay: boolean;
  setPlayTestVideoAutoPlay: (val: boolean) => void;
  playTestLayoutMode: 'classic' | 'immersive';
  setPlayTestLayoutMode: (val: 'classic' | 'immersive') => void;

  playTestInteractionMode: string;
  setPlayTestInteractionMode: (val: string) => void;
  playTestTypewriterSpeed: number;
  setPlayTestTypewriterSpeed: (val: number) => void;
  playTestChoiceDelay: number;
  setPlayTestChoiceDelay: (val: number) => void;

  playTestChoicesPosition: 'center' | 'aboveText' | 'belowText';
  setPlayTestChoicesPosition: (val: 'center' | 'aboveText' | 'belowText') => void;
  playTestBlurBackground: boolean;
  setPlayTestBlurBackground: (val: boolean) => void;
  playTestBlurText: boolean;
  setPlayTestBlurText: (val: boolean) => void;
  playTestSkipSingleChoicePopup: boolean;
  setPlayTestSkipSingleChoicePopup: (val: boolean) => void;
  playTestDimBackground: boolean;
  setPlayTestDimBackground: (val: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  showSettings,
  setShowSettings,
  language,
  setLanguage,
  theme,
  setTheme,
  bubbleStyle,
  setBubbleStyle,
  canvasBg,
  setCanvasBg,
  presetColors,
  setPresetColors,
  toolbarLayout,
  setToolbarLayout,
  selectionMenuLayout,
  setSelectionMenuLayout,
  edgeStyle,
  setEdgeStyle,
  pasteAsPlainText,
  setPasteAsPlainText,
  showNodeActions,
  setShowNodeActions,
  showStats,
  setShowStats,
  saveAssistantConversations,
  setSaveAssistantConversations,
  showMiniMap,
  setShowMiniMap,
  miniMapPosition,
  setMiniMapPosition,
  showControls,
  setShowControls,
  savedAIProfiles,
  activeTextProfileId,
  activeImageProfileId,
  activeVoiceProfileId,
  onCreateAIProfile,
  onUpdateAIProfile,
  onSelectAIProfile,
  onDeleteAIProfile,
  generateLength,
  setGenerateLength,
  aiPrompts,
  setAiPrompts,
  aiButtonsConfig,
  setAiButtonsConfig,
  handleContactCopy,
  qqCopied,
  emailCopied,
  playTestDarkMode,
  setPlayTestDarkMode,
  playTestChoicesColumns,
  setPlayTestChoicesColumns,
  playTestVideoAutoPlay,
  setPlayTestVideoAutoPlay,
  playTestLayoutMode,
  setPlayTestLayoutMode,

  playTestInteractionMode,
  setPlayTestInteractionMode,
  playTestTypewriterSpeed,
  setPlayTestTypewriterSpeed,
  playTestChoiceDelay,
  setPlayTestChoiceDelay,

  playTestChoicesPosition,
  setPlayTestChoicesPosition,
  playTestBlurBackground,
  setPlayTestBlurBackground,
  playTestBlurText,
  setPlayTestBlurText,
  playTestSkipSingleChoicePopup,
  setPlayTestSkipSingleChoicePopup,
  playTestDimBackground,
  setPlayTestDimBackground,
}) => {
  const [activeSettingsTab, setActiveSettingsTab] = useState<
    'appearance' | 'editor' | 'playtest' | 'ai' | 'about'
  >('appearance');
  const [aboutPage, setAboutPage] = useState<'contact' | 'help'>('contact');
  const forceQuitApp = async () => {
    try {
      const tauriCore = await import('@tauri-apps/api/core');
      const invoke =
        tauriCore.invoke ||
        (tauriCore as any).default?.invoke ||
        (window as any).__TAURI__?.core?.invoke;
      if (invoke) {
        await invoke('force_quit_app');
        return;
      }
    } catch (error) {
      console.error('Force quit failed:', error);
    }
    window.close();
  };
  const t = translations[language];

  if (!showSettings) return null;

  return (
    <div
      className={`fixed inset-0 bg-slate-900/40 dark:bg-black/60 z-[300] flex items-center justify-center backdrop-blur-[2px] p-4 animate-in fade-in duration-200 ${theme === 'dark' ? 'dark' : ''}`}
    >
      <div className="bg-[var(--panel-bg)] backdrop-blur-[0px] rounded-2xl shadow-2xl w-full max-w-3xl h-[600px] max-h-[85vh] flex overflow-hidden border border-[var(--header-border)] animate-in zoom-in-95 duration-300">
        {/* Sidebar Navigation */}
        <div className="w-52 bg-[var(--app-bg)]/30 border-r border-[var(--header-border)] flex flex-col p-5 shrink-0">
          <div className="flex items-center gap-3 px-2 py-4 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 ring-4 ring-white dark:ring-slate-800">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
              {t.settings}
            </h2>
          </div>

          <div className="flex-1 space-y-1.5">
            {[
              { id: 'appearance', label: t.theme, icon: <ImageIcon className="w-4 h-4" /> },
              {
                id: 'editor',
                label: language === 'zh' ? '编辑器' : 'Editor',
                icon: <Layers className="w-4 h-4" />,
              },
              {
                id: 'playtest',
                label: language === 'zh' ? '剧本测试' : 'Playtest',
                icon: <PlayCircle className="w-4 h-4" />,
              },
              { id: 'ai', label: t.aiSettings, icon: <BrainCircuit className="w-4 h-4" /> },
              {
                id: 'about',
                label: language === 'zh' ? '关于与反馈' : 'About & Feedback',
                icon: <MessageCircle className="w-4 h-4" />,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSettingsTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                  activeSettingsTab === tab.id
                    ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] scale-[1.02] border border-[var(--card-border)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--card-bg)]/50'
                }`}
              >
                <span
                  className={
                    activeSettingsTab === tab.id
                      ? 'text-[var(--accent)]'
                      : 'text-[var(--text-muted)]'
                  }
                >
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowSettings(false)}
            className="w-full py-3 bg-slate-900 dark:bg-white hover:bg-black dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-sm font-black shadow-xl dark:shadow-none transition-all active:scale-95"
          >
            {t.finish}
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col h-full bg-transparent overflow-y-auto p-10 pt-8 custom-scrollbar">
          {activeSettingsTab === 'appearance' && (
            <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
              <section>
                <header className="flex items-center gap-3 mb-6">
                  <div className="w-1.5 h-6 bg-indigo-500 dark:bg-sky-400 rounded-full" />
                  <h3 className="text-base font-black text-[var(--text-primary)]">
                    {t.theme} & {language === 'zh' ? '语言' : 'Language'}
                  </h3>
                </header>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">
                      {t.theme}
                    </label>
                    <div className="flex bg-[var(--app-bg)]/50 p-1.5 rounded-xl border border-[var(--header-border)]">
                      <button
                        onClick={() => {
                          setTheme('light');
                          if (canvasBg === presetColors[1]) setCanvasBg(presetColors[0]);
                        }}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${theme === 'light' ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                      >
                        {t.lightMode}
                      </button>
                      <button
                        onClick={() => {
                          setTheme('dark');
                          if (canvasBg === presetColors[0]) setCanvasBg(presetColors[1]);
                        }}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${theme === 'dark' ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                      >
                        {t.darkMode}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">
                      {language === 'zh' ? '系统语言' : 'Language'}
                    </label>
                    <div className="flex bg-[var(--app-bg)]/50 p-1.5 rounded-xl border border-[var(--header-border)]">
                      <button
                        onClick={() => setLanguage('zh')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${language === 'zh' ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                      >
                        {language === 'zh' ? '简体中文' : 'Chinese'}
                      </button>
                      <button
                        onClick={() => setLanguage('en')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${language === 'en' ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                      >
                        English
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <header className="flex items-center gap-3 mb-6">
                  <div className="w-1.5 h-6 bg-indigo-500 dark:bg-sky-400 rounded-full" />
                  <h3 className="text-base font-black text-[var(--text-primary)]">
                    {t.toolbarLayout}
                  </h3>
                </header>
                <div className="flex bg-[var(--app-bg)]/50 p-1.5 rounded-xl border border-[var(--header-border)]">
                  <button
                    onClick={() => setToolbarLayout('vertical')}
                    className={`flex-1 py-3 text-[10px] font-black rounded-lg transition-all uppercase tracking-wider ${toolbarLayout === 'vertical' ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                  >
                    {t.vertical}
                  </button>
                  <button
                    onClick={() => setToolbarLayout('horizontal')}
                    className={`flex-1 py-3 text-[10px] font-black rounded-lg transition-all uppercase tracking-wider ${toolbarLayout === 'horizontal' ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                  >
                    {t.horizontal}
                  </button>
                </div>
              </section>

              <section>
                <header className="flex items-center gap-3 mb-6">
                  <div className="w-1.5 h-6 bg-indigo-500 dark:bg-sky-400 rounded-full" />
                  <h3 className="text-base font-black text-[var(--text-primary)]">
                    {language === 'zh' ? '工具栏气泡质感' : 'Toolbar Bubble Style'}
                  </h3>
                </header>
                <div className="flex bg-[var(--app-bg)]/50 p-1.5 rounded-xl border border-[var(--header-border)]">
                  <button
                    onClick={() => setBubbleStyle('glass')}
                    className={`flex-1 py-3 text-[10px] font-black rounded-lg transition-all uppercase tracking-wider ${bubbleStyle === 'glass' ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                  >
                    {language === 'zh' ? '玻璃' : 'Glass'}
                  </button>
                  <button
                    onClick={() => setBubbleStyle('flat')}
                    className={`flex-1 py-3 text-[10px] font-black rounded-lg transition-all uppercase tracking-wider ${bubbleStyle === 'flat' ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                  >
                    {language === 'zh' ? '扁平' : 'Flat'}
                  </button>
                </div>
              </section>

              <section>
                <header className="flex items-center gap-3 mb-6">
                  <div className="w-1.5 h-6 bg-indigo-500 dark:bg-sky-400 rounded-full" />
                  <h3 className="text-base font-black text-[var(--text-primary)]">
                    {t.selectionMenuLayout}
                  </h3>
                </header>
                <div className="flex bg-[var(--app-bg)]/50 p-1.5 rounded-xl border border-[var(--header-border)]">
                  <button
                    onClick={() => setSelectionMenuLayout('horizontal')}
                    className={`flex-1 py-3 text-[10px] font-black rounded-lg transition-all uppercase tracking-wider ${selectionMenuLayout === 'horizontal' ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                  >
                    {t.menuHorizontal}
                  </button>
                  <button
                    onClick={() => setSelectionMenuLayout('vertical')}
                    className={`flex-1 py-3 text-[10px] font-black rounded-lg transition-all uppercase tracking-wider ${selectionMenuLayout === 'vertical' ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                  >
                    {t.menuVertical}
                  </button>
                </div>
              </section>

              <section className="space-y-5">
                <header className="flex items-center gap-3 mb-2">
                  <div className="w-1.5 h-6 bg-[var(--accent)] rounded-full" />
                  <h3 className="text-base font-black text-[var(--text-primary)]">{t.bgColors}</h3>
                </header>
                <p className="text-xs text-[var(--text-muted)] font-medium px-4">
                  {language === 'zh'
                    ? '点击颜色块可自定义颜色，这些颜色将显示在画布右侧的快速切换栏中。'
                    : 'Click color blocks to customize. These will appear in the quick switcher.'}
                </p>
                <div className="grid grid-cols-3 gap-5">
                  {presetColors.map((color, idx) => (
                    <div
                      key={idx}
                      className="group relative flex items-center gap-4 bg-[var(--app-bg)]/50 p-4 rounded-xl border border-[var(--card-border)] transition-all hover:bg-[var(--card-bg)] hover:shadow-xl dark:hover:shadow-none hover:border-indigo-100 dark:hover:border-indigo-500/30"
                    >
                      <div className="relative w-12 h-12 shrink-0">
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => {
                            const newColors = [...presetColors];
                            newColors[idx] = e.target.value;
                            setPresetColors(newColors);
                          }}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                        />
                        <div
                          className="w-full h-full rounded-lg border-4 border-white dark:border-slate-700 shadow-lg ring-1 ring-slate-100 dark:ring-slate-900 group-hover:scale-110 transition-transform duration-500"
                          style={{ backgroundColor: color }}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tighter mb-0.5">
                          Slot {idx + 1}
                        </div>
                        <div className="text-xs font-mono font-bold text-[var(--text-primary)] uppercase">
                          {color}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {activeSettingsTab === 'editor' && (
            <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
              <section>
                <header className="flex items-center gap-3 mb-6">
                  <div className="w-1.5 h-6 bg-indigo-500 dark:bg-sky-400 rounded-full" />
                  <h3 className="text-base font-black text-[var(--text-primary)]">{t.edgeStyle}</h3>
                </header>
                <div className="flex bg-[var(--app-bg)]/50 p-2 rounded-xl border border-[var(--header-border)] max-w-sm">
                  <button
                    onClick={() => setEdgeStyle('step')}
                    className={`flex-1 flex flex-col items-center gap-2 py-5 rounded-lg transition-all duration-500 ${edgeStyle === 'step' ? 'bg-[var(--card-bg)] shadow-xl text-[var(--accent)] border border-[var(--card-border)] scale-[1.05] z-10' : 'text-[var(--text-muted)] opacity-60 hover:opacity-100'}`}
                  >
                    <div className="w-14 h-10 border-2 border-current rounded-lg flex items-center justify-center mb-1">
                      <div className="relative w-8 h-5">
                        <div className="absolute top-0 left-0 w-2 h-2 rounded-full bg-current -translate-x-1 -translate-y-[3px]" />
                        <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-current translate-x-1 translate-y-[3px]" />
                        <div className="absolute top-0 left-0 w-[calc(50%+2px)] h-[2px] bg-current" />
                        <div className="absolute top-0 left-1/2 w-[2px] h-full bg-current" />
                        <div className="absolute bottom-0 left-1/2 w-1/2 h-[2px] bg-current" />
                      </div>
                    </div>
                    <span className="text-xs font-black tracking-widest uppercase">{t.step}</span>
                  </button>
                  <button
                    onClick={() => setEdgeStyle('bezier')}
                    className={`flex-1 flex flex-col items-center gap-2 py-5 rounded-lg transition-all duration-500 ${edgeStyle === 'bezier' ? 'bg-[var(--card-bg)] shadow-xl text-[var(--accent)] border border-[var(--card-border)] scale-[1.05] z-10' : 'text-[var(--text-muted)] opacity-60 hover:opacity-100'}`}
                  >
                    <div className="w-14 h-10 border-2 border-current rounded-lg flex items-center justify-center mb-1">
                      <div className="relative w-8 h-5">
                        <svg
                          className="absolute inset-0 w-full h-full overflow-visible"
                          viewBox="0 0 32 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M 0 1 C 16 1, 16 19, 32 19" />
                        </svg>
                        <div className="absolute top-0 left-0 w-2 h-2 rounded-full bg-current -translate-x-1 -translate-y-[3px]" />
                        <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-current translate-x-1 translate-y-[3px]" />
                      </div>
                    </div>
                    <span className="text-xs font-black tracking-widest uppercase">{t.bezier}</span>
                  </button>
                </div>
              </section>

              <section className="space-y-2">
                <header className="flex items-center gap-3 mb-6">
                  <div className="w-1.5 h-6 bg-indigo-500 dark:bg-sky-400 rounded-full" />
                  <h3 className="text-base font-black text-[var(--text-primary)]">
                    {language === 'zh' ? '交互与显示' : 'Interactions'}
                  </h3>
                </header>
                <div className="grid grid-cols-2 gap-x-12 gap-y-1">
                  {[
                    {
                      id: 'pastePlain',
                      label: t.pastePlain,
                      value: pasteAsPlainText,
                      setter: setPasteAsPlainText,
                    },
                    {
                      id: 'showActions',
                      label: t.showActions,
                      value: showNodeActions,
                      setter: setShowNodeActions,
                    },
                    { id: 'showStats', label: t.showStats, value: showStats, setter: setShowStats },
                    {
                      id: 'saveAssistantConversations',
                      label:
                        language === 'zh' ? '保存 AI 助手对话' : 'Save AI assistant chats',
                      value: saveAssistantConversations,
                      setter: setSaveAssistantConversations,
                    },
                    {
                      id: 'showMiniMap',
                      label: t.showMiniMap,
                      value: showMiniMap,
                      setter: setShowMiniMap,
                    },
                    {
                      id: 'showControls',
                      label: t.showControls,
                      value: showControls,
                      setter: setShowControls,
                    },
                  ].map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-4 border-b border-[var(--header-border)] last:border-0 group"
                    >
                      <span className="text-sm font-bold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                        {item.label}
                      </span>
                      <button
                        onClick={() => item.setter(!item.value)}
                        className={`w-12 h-6 rounded-full transition-all duration-500 relative ${item.value ? 'bg-[var(--accent)] shadow-lg' : 'bg-[var(--app-bg)] border border-[var(--header-border)]'}`}
                      >
                        <div
                          className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-500 shadow-sm ${item.value ? 'left-7' : 'left-1'}`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
                {showMiniMap && (
                  <div className="mt-5 max-w-sm rounded-xl border border-[var(--header-border)] bg-[var(--app-bg)]/50 p-1.5">
                    <div className="mb-1.5 px-2 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">
                      {t.miniMapPosition}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setMiniMapPosition('left')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black rounded-lg transition-all ${miniMapPosition === 'left' ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                      >
                        <ArrowLeft className="w-4 h-4" />
                        {t.miniMapLeft}
                      </button>
                      <button
                        onClick={() => setMiniMapPosition('right')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-black rounded-lg transition-all ${miniMapPosition === 'right' ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                      >
                        {t.miniMapRight}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}

          {activeSettingsTab === 'playtest' && (
            <div className="space-y-10 animate-in slide-in-from-right-4 duration-500 pb-8">
              <section>
                <header className="flex items-center gap-3 mb-6">
                  <div className="w-1.5 h-6 bg-indigo-500 dark:bg-sky-400 rounded-full" />
                  <h3 className="text-base font-black text-[var(--text-primary)]">
                    {language === 'zh' ? '剧情测试主题与排版' : 'Playtest Theme & Layout'}
                  </h3>
                </header>
                <div className="grid grid-cols-2 gap-6">
                  {/* Playtest Layout Mode */}
                  <div
                    className={`space-y-3 ${playTestLayoutMode !== 'classic' ? 'col-span-2' : ''}`}
                  >
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">
                      {t.playtestLayoutMode}
                    </label>
                    <div className="flex bg-[var(--app-bg)]/50 p-1.5 rounded-xl border border-[var(--header-border)]">
                      <button
                        onClick={() => setPlayTestLayoutMode('classic')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${playTestLayoutMode === 'classic' ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                      >
                        {t.layoutClassic}
                      </button>
                      <button
                        onClick={() => setPlayTestLayoutMode('immersive')}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${playTestLayoutMode === 'immersive' ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                      >
                        {t.layoutImmersive}
                      </button>
                    </div>
                  </div>

                  {/* Playtest Theme */}
                  {playTestLayoutMode === 'classic' && (
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">
                        {language === 'zh' ? '测试界面主题' : 'Playtest Theme'}
                      </label>
                      <div className="flex bg-[var(--app-bg)]/50 p-1.5 rounded-xl border border-[var(--header-border)]">
                        <button
                          onClick={() => setPlayTestDarkMode(false)}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${!playTestDarkMode ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                        >
                          {t.lightMode}
                        </button>
                        <button
                          onClick={() => setPlayTestDarkMode(true)}
                          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${playTestDarkMode ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                        >
                          {t.darkMode}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <div className="flex flex-col">
                {/* Playtest Choices Position */}
                <section>
                  <header className="flex items-center gap-3 mb-6">
                    <div className="w-1.5 h-6 bg-indigo-500 dark:bg-sky-400 rounded-full" />
                    <h3 className="text-base font-black text-[var(--text-primary)]">
                      {language === 'zh' ? '选项按钮位置' : 'Choice Position'}
                    </h3>
                  </header>
                  <div className="flex bg-[var(--app-bg)]/50 p-1.5 rounded-xl border border-[var(--header-border)]">
                    {[
                      { id: 'center', label: language === 'zh' ? '画面中间' : 'Center' },
                      { id: 'aboveText', label: language === 'zh' ? '文字上方' : 'Above Text' },
                      { id: 'belowText', label: language === 'zh' ? '文字下方' : 'Below Text' },
                    ].map((pos) => (
                      <button
                        key={pos.id}
                        onClick={() => setPlayTestChoicesPosition(pos.id as any)}
                        className={`flex-1 py-3 text-xs font-black rounded-lg transition-all uppercase tracking-wider ${playTestChoicesPosition === pos.id ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Playtest Choices Columns */}
                <div
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    playTestChoicesPosition !== 'center'
                      ? 'max-h-[200px] opacity-100 mt-10'
                      : 'max-h-0 opacity-0 mt-0'
                  }`}
                >
                  <section>
                    <header className="flex items-center gap-3 mb-6">
                      <div className="w-1.5 h-6 bg-indigo-500 dark:bg-sky-400 rounded-full" />
                      <h3 className="text-base font-black text-[var(--text-primary)]">
                        {t.choiceColumns}
                      </h3>
                    </header>
                    <div className="flex bg-[var(--app-bg)]/50 p-1.5 rounded-xl border border-[var(--header-border)]">
                      {[1, 2, 3].map((cols) => (
                        <button
                          key={cols}
                          onClick={() => setPlayTestChoicesColumns(cols)}
                          className={`flex-1 py-3 text-xs font-black rounded-lg transition-all uppercase tracking-wider ${playTestChoicesColumns === cols ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                        >
                          {t[`column${cols}` as keyof typeof t]}
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              </div>

              <div className="flex flex-col">
                {/* Playtest Blur Background */}
                <section>
                  <header className="flex items-center gap-3 mb-6">
                    <div className="w-1.5 h-6 bg-indigo-500 dark:bg-sky-400 rounded-full" />
                    <h3 className="text-base font-black text-[var(--text-primary)]">
                      {language === 'zh' ? '选项弹出背景虚化' : 'Blur Choice Background'}
                    </h3>
                  </header>
                  <div className="flex bg-[var(--app-bg)]/50 p-1.5 rounded-xl border border-[var(--header-border)]">
                    {[
                      {
                        id: 'true',
                        value: true,
                        label: language === 'zh' ? '开启背景虚化' : 'Enabled',
                      },
                      {
                        id: 'false',
                        value: false,
                        label: language === 'zh' ? '关闭背景虚化' : 'Disabled',
                      },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setPlayTestBlurBackground(opt.value)}
                        className={`flex-1 py-3 text-xs font-black rounded-lg transition-all uppercase tracking-wider ${playTestBlurBackground === opt.value ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Playtest Blur Text */}
                <div
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    playTestBlurBackground
                      ? 'max-h-[200px] opacity-100 mt-10'
                      : 'max-h-0 opacity-0 mt-0'
                  }`}
                >
                  <section>
                    <header className="flex items-center gap-3 mb-6">
                      <div className="w-1.5 h-6 bg-indigo-500 dark:bg-sky-400 rounded-full" />
                      <h3 className="text-base font-black text-[var(--text-primary)]">
                        {language === 'zh' ? '虚化时模糊剧情文字' : 'Blur Story Text Too'}
                      </h3>
                    </header>
                    <div className="flex bg-[var(--app-bg)]/50 p-1.5 rounded-xl border border-[var(--header-border)]">
                      {[
                        {
                          id: 'true',
                          value: true,
                          label: language === 'zh' ? '文字也虚化' : 'Blur Text',
                        },
                        {
                          id: 'false',
                          value: false,
                          label: language === 'zh' ? '文字保持清晰' : 'Keep Text Clear',
                        },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setPlayTestBlurText(opt.value)}
                          className={`flex-1 py-3 text-xs font-black rounded-lg transition-all uppercase tracking-wider ${playTestBlurText === opt.value ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </section>
                </div>
              </div>

              {/* Playtest Skip Single Choice Popup */}
              {playTestChoicesPosition === 'center' && (
                <section className="animate-in fade-in slide-in-from-top-1 duration-200">
                  <header className="flex items-center gap-3 mb-6">
                    <div className="w-1.5 h-6 bg-indigo-500 dark:bg-sky-400 rounded-full" />
                    <h3 className="text-base font-black text-[var(--text-primary)]">
                      {language === 'zh'
                        ? '单选项时隐藏居中弹窗'
                        : 'Hide Center Popup for Single Choice'}
                    </h3>
                  </header>
                  <div className="flex bg-[var(--app-bg)]/50 p-1.5 rounded-xl border border-[var(--header-border)]">
                    {[
                      {
                        id: 'true',
                        value: true,
                        label: language === 'zh' ? '隐藏 (点击文字继续)' : 'Hide (Click Text)',
                      },
                      {
                        id: 'false',
                        value: false,
                        label: language === 'zh' ? '显示弹窗选择' : 'Show Popup',
                      },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setPlayTestSkipSingleChoicePopup(opt.value)}
                        className={`flex-1 py-3 text-xs font-black rounded-lg transition-all uppercase tracking-wider ${playTestSkipSingleChoicePopup === opt.value ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Interaction Modes Settings */}
              <section className="space-y-6">
                <header className="flex items-center gap-3">
                  <div className="w-1.5 h-6 bg-indigo-500 dark:bg-sky-400 rounded-full" />
                  <h3 className="text-base font-black text-[var(--text-primary)]">
                    {language === 'zh' ? '剧情文本交互策略' : 'Story Text Interaction'}
                  </h3>
                </header>

                {/* Interaction Mode Selection */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">
                    {language === 'zh' ? '剧情显示模式' : 'Story Text Display Mode'}
                  </label>
                  <select
                    value={playTestInteractionMode}
                    onChange={(e) => setPlayTestInteractionMode(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--app-bg)] border-2 border-[var(--card-border)] rounded-xl text-sm font-bold text-[var(--text-primary)] outline-none focus:ring-4 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] cursor-pointer"
                  >
                    <option
                      value="immediate"
                      className={
                        theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'
                      }
                    >
                      {language === 'zh'
                        ? '立即显示 (直接显示文本与选项)'
                        : 'Immediate (Show all instantly)'}
                    </option>
                    <option
                      value="typewriter"
                      className={
                        theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'
                      }
                    >
                      {language === 'zh'
                        ? '打字机效果 (文本逐字打出后显示选项)'
                        : 'Typewriter (Reveal word-by-word)'}
                    </option>
                    <option
                      value="timed"
                      className={
                        theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'
                      }
                    >
                      {language === 'zh'
                        ? '延迟显示选项 (文本载入 N 秒后显示选项)'
                        : 'Timed Delay (Show choices after N seconds)'}
                    </option>
                    <option
                      value="clickToShow"
                      className={
                        theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'
                      }
                    >
                      {language === 'zh'
                        ? '点击显示选项 (点击文本区域后显示选项)'
                        : 'Click-to-Show (Tap text to unlock choices)'}
                    </option>
                  </select>
                </div>

                {/* Dynamic Configuration Sliders based on Mode */}
                {playTestInteractionMode === 'typewriter' && (
                  <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {language === 'zh' ? '打字速度 (每字延迟)' : 'Typewriting Speed'}
                      </label>
                      <span className="text-xs font-mono font-bold text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-full">
                        {playTestTypewriterSpeed} ms/字
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min={10}
                        max={100}
                        step={5}
                        value={playTestTypewriterSpeed}
                        onChange={(e) => setPlayTestTypewriterSpeed(parseInt(e.target.value))}
                        className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                      />
                      <span className="text-[10px] font-bold text-[var(--text-muted)]">100ms</span>
                    </div>
                  </div>
                )}

                {playTestInteractionMode === 'timed' && (
                  <div className="space-y-3 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {language === 'zh' ? '选择项延迟出现时间' : 'Choices Appending Delay'}
                      </label>
                      <span className="text-xs font-mono font-bold text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-full">
                        {playTestChoiceDelay} 秒
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min={0.5}
                        max={10}
                        step={0.5}
                        value={playTestChoiceDelay}
                        onChange={(e) => setPlayTestChoiceDelay(parseFloat(e.target.value))}
                        className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                      />
                      <span className="text-[10px] font-bold text-[var(--text-muted)]">10秒</span>
                    </div>
                  </div>
                )}
              </section>

              {/* Playtest Dim Background */}
              <section>
                <header className="flex items-center gap-3 mb-6">
                  <div className="w-1.5 h-6 bg-indigo-500 dark:bg-sky-400 rounded-full" />
                  <h3 className="text-base font-black text-[var(--text-primary)]">
                    {language === 'zh' ? '暗化背景遮罩' : 'Dim Background Overlay'}
                  </h3>
                </header>
                <p className="text-xs text-[var(--text-muted)] font-medium px-1 mb-4">
                  {language === 'zh'
                    ? '在沉浸模式下增加一层暗色遮罩，提升文字对比度与可读性。'
                    : 'Overlay a dark mask in immersive mode to improve text readability.'}
                </p>
                <div className="flex bg-[var(--app-bg)]/50 p-1.5 rounded-xl border border-[var(--header-border)]">
                  {[
                    {
                      id: 'true',
                      value: true,
                      label: language === 'zh' ? '启用遮罩' : 'Enabled',
                    },
                    {
                      id: 'false',
                      value: false,
                      label: language === 'zh' ? '关闭遮罩' : 'Disabled',
                    },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setPlayTestDimBackground(opt.value)}
                      className={`flex-1 py-3 text-xs font-black rounded-lg transition-all uppercase tracking-wider ${playTestDimBackground === opt.value ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* Playtest Video Autoplay */}
              <section className="space-y-2">
                <header className="flex items-center gap-3 mb-6">
                  <div className="w-1.5 h-6 bg-indigo-500 dark:bg-sky-400 rounded-full" />
                  <h3 className="text-base font-black text-[var(--text-primary)]">
                    {language === 'zh' ? '多媒体设置' : 'Multimedia Settings'}
                  </h3>
                </header>
                <div className="flex items-center justify-between py-4 border-b border-[var(--header-border)] last:border-0 group">
                  <span className="text-sm font-bold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                    {t.videoAutoPlay}
                  </span>
                  <button
                    onClick={() => setPlayTestVideoAutoPlay(!playTestVideoAutoPlay)}
                    className={`w-12 h-6 rounded-full transition-all duration-500 relative ${playTestVideoAutoPlay ? 'bg-[var(--accent)] shadow-lg' : 'bg-[var(--app-bg)] border border-[var(--header-border)]'}`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-500 shadow-sm ${playTestVideoAutoPlay ? 'left-7' : 'left-1'}`}
                    />
                  </button>
                </div>
              </section>
            </div>
          )}

          {activeSettingsTab === 'ai' && (
            <AISettingsPanel
              language={language}
              savedAIProfiles={savedAIProfiles}
              activeTextProfileId={activeTextProfileId}
              activeImageProfileId={activeImageProfileId}
              activeVoiceProfileId={activeVoiceProfileId}
              onCreateAIProfile={onCreateAIProfile}
              onUpdateAIProfile={onUpdateAIProfile}
              onSelectAIProfile={onSelectAIProfile}
              onDeleteAIProfile={onDeleteAIProfile}
              aiPrompts={aiPrompts}
              setAiPrompts={setAiPrompts}
              aiButtonsConfig={aiButtonsConfig}
              setAiButtonsConfig={setAiButtonsConfig}
            />
          )}

          {activeSettingsTab === 'about' && aboutPage === 'contact' && (
            <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
              <section>
                <header className="flex items-center gap-3 mb-6">
                  <div className="w-1.5 h-6 bg-[var(--accent)] rounded-full" />
                  <h3 className="text-base font-black text-[var(--text-primary)]">
                    {t.contactTitle}
                  </h3>
                </header>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed font-medium px-4">
                  {t.contactDesc}
                </p>
                <div className="grid grid-cols-2 gap-6">
                  {[
                    {
                      id: 'qq',
                      label: 'QQ 号(个人)',
                      value: '1836902091',
                      icon: <MessageCircle className="w-5 h-5" />,
                      color: 'blue',
                      copied: qqCopied,
                    },
                    {
                      id: 'email',
                      label: 'Email',
                      value: 'mingwenc@126.com',
                      icon: <Mail className="w-5 h-5" />,
                      color: 'amber',
                      copied: emailCopied,
                    },
                  ].map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleContactCopy(item.value, item.id as any)}
                      className="flex flex-col p-6 bg-[var(--card-bg)] border-2 border-[var(--card-border)] rounded-xl group transition-all hover:border-[var(--accent)] hover:shadow-2xl dark:hover:shadow-none cursor-pointer active:scale-95"
                    >
                      <div className="w-12 h-12 bg-[var(--app-bg)] rounded-lg flex items-center justify-center text-[var(--accent)] mb-4 group-hover:scale-110 transition-transform duration-500">
                        {item.icon}
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest">
                          {item.label}
                        </p>
                        <p className="text-base font-mono font-black text-[var(--text-primary)]">
                          {item.value}
                        </p>
                      </div>
                      <div
                        className={`mt-4 flex items-center gap-2 text-xs font-bold transition-all ${item.copied ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100'}`}
                      >
                        {item.copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        <span>{item.copied ? 'Copied!' : 'Click to Copy'}</span>
                      </div>
                    </div>
                  ))}
                  <a
                    href="https://mingwencui.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="col-span-2 flex items-center justify-center gap-2 px-6 py-4 bg-[var(--accent)] text-white rounded-xl text-sm font-black shadow-xl transition-all hover:shadow-2xl hover:-translate-y-0.5 active:scale-95"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>{language === 'zh' ? '访问作者的网站' : 'Visit Author Website'}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setAboutPage('help')}
                    className="col-span-2 flex items-center justify-center gap-2 px-6 py-4 bg-[var(--card-bg)] text-[var(--text-primary)] border-2 border-[var(--card-border)] rounded-xl text-sm font-black shadow-sm transition-all hover:border-[var(--accent)] hover:text-[var(--accent)] hover:-translate-y-0.5 active:scale-95"
                  >
                    <HelpCircle className="w-4 h-4" />
                    <span>{language === 'zh' ? '帮助和使用须知' : 'Help & Usage Notice'}</span>
                  </button>
                </div>
              </section>

              <section className="bg-white dark:bg-black rounded-2xl p-10 text-center relative overflow-hidden group border border-slate-100 dark:border-white/5 shadow-sm dark:shadow-none">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 dark:from-indigo-500/10 dark:to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                <BrainCircuit className="w-12 h-12 text-indigo-500 dark:text-sky-400 mx-auto mb-6 relative z-10" />
                <h4 className="text-xl font-black text-slate-900 dark:text-white mb-2 relative z-10">
                  交互式AI小说创作工具
                </h4>
                <p className="text-indigo-600/40 dark:text-sky-400/40 text-xs font-bold uppercase tracking-[0.4em] mb-6 relative z-10">
                  AIGC x Narrative Architecture
                </p>
                <div className="h-px bg-slate-200 dark:bg-white/10 w-24 mx-auto mb-6 relative z-10" />
                <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed max-w-[320px] mx-auto relative z-10 font-medium">
                  {language === 'zh'
                    ? '致力于构建下一代AI交互式小说创作工具，让每一颗想象力的种子都能开花结果。'
                    : 'Dedicated to building next-gen AI narrative infrastructure, making every seed of imagination bloom.'}
                </p>
              </section>

              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center gap-2">
                <p className="text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-[0.2em]">
                  Version v1.2.4-stable
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-[9px] font-bold text-slate-400/60 dark:text-slate-500 uppercase tracking-widest">
                    Stable Release
                  </p>
                </div>
              </div>

              <section className="pt-4 border-t border-rose-500/20">
                <button
                  type="button"
                  onClick={forceQuitApp}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-rose-600 text-white text-sm font-black shadow-lg transition-all hover:bg-rose-700 hover:shadow-xl active:scale-95"
                  title={language === 'zh' ? '强制退出应用' : 'Force quit app'}
                >
                  <X className="w-4 h-4" />
                  <span>
                    {language === 'zh' ? '强制关闭 GalWriter AI' : 'Force Close GalWriter AI'}
                  </span>
                </button>
                <p className="mt-3 text-center text-[10px] leading-relaxed font-bold text-rose-500/80">
                  {language === 'zh'
                    ? '当窗口关闭按钮只会最小化时，可以用这个按钮直接退出桌面应用。'
                    : 'Use this when the window close button only minimizes the desktop app.'}
                </p>
              </section>
            </div>
          )}

          {activeSettingsTab === 'about' && aboutPage === 'help' && (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
              <button
                type="button"
                onClick={() => setAboutPage('contact')}
                className="inline-flex items-center gap-2 text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{language === 'zh' ? '返回关注与反馈' : 'Back to About & Feedback'}</span>
              </button>

              <section>
                <header className="flex items-center gap-3 mb-6">
                  <div className="w-1.5 h-6 bg-[var(--accent)] rounded-full" />
                  <h3 className="text-base font-black text-[var(--text-primary)]">
                    {language === 'zh' ? '帮助和使用须知' : 'Help & Usage Notice'}
                  </h3>
                </header>

                <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6 space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-[var(--text-primary)] mb-2">
                        {language === 'zh'
                          ? '请合理、合法地使用 GalWriter AI'
                          : 'Use GalWriter AI Responsibly'}
                      </h4>
                      <p className="text-sm leading-relaxed text-[var(--text-secondary)] font-medium">
                        {language === 'zh'
                          ? '本工具用于辅助个人创作、学习和原型设计。请在遵守所在地法律法规、平台规则和基本创作伦理的前提下使用。'
                          : 'This tool is intended for personal creation, learning, and prototyping. Use it in accordance with applicable laws, platform rules, and basic creative ethics.'}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {[
                      language === 'zh'
                        ? '请不要将本软件本体、安装包或未经授权的改版拿去售卖、倒卖或包装成付费产品。'
                        : 'Do not sell, resell, or repackage this software, installer, or unauthorized modified versions as a paid product.',
                      language === 'zh'
                        ? '请不要使用本软件生成、传播违法违规内容，包括诈骗、暴力犯罪、色情剥削、仇恨骚扰、侵犯隐私等内容。'
                        : 'Do not use this software to generate or distribute illegal or harmful content, including fraud, violent crime, sexual exploitation, hate, harassment, or privacy violations.',
                      language === 'zh'
                        ? 'AI 生成内容可能存在错误、偏见或不适合公开发布的表达，发布前请自行审校并承担相应责任。'
                        : 'AI-generated content may contain mistakes, bias, or unsuitable wording. Review it before publishing and take responsibility for the final output.',
                      language === 'zh'
                        ? '请尊重他人的版权、肖像权、隐私权和商业权益，不要冒充他人或未经许可使用受保护素材。'
                        : 'Respect copyright, likeness rights, privacy, and commercial rights. Do not impersonate others or use protected material without permission.',
                    ].map((item, index) => (
                      <div
                        key={index}
                        className="flex gap-3 rounded-xl bg-[var(--app-bg)]/60 border border-[var(--card-border)] px-4 py-3"
                      >
                        <span className="w-5 h-5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                          {index + 1}
                        </span>
                        <p className="text-sm leading-relaxed text-[var(--text-secondary)] font-medium">
                          {item}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
                    <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300 font-bold">
                      {language === 'zh'
                        ? '免责声明：作者不对用户使用本软件产生的内容、收益、纠纷或法律后果承担责任。继续使用即表示你理解并愿意遵守以上须知。'
                        : 'Disclaimer: The author is not responsible for content, revenue, disputes, or legal consequences arising from user behavior. Continued use means you understand and agree to follow this notice.'}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  Settings,
  ImageIcon,
  Layers,
  BrainCircuit,
  MessageCircle,
  Check,
  Mail,
  Copy,
  X,
  PlayCircle,
  ExternalLink,
  HelpCircle,
  ArrowLeft,
  ArrowRight,
  ShieldAlert,
  ChevronDown
} from 'lucide-react';
import { Language, translations } from '../lib/i18n';
import { defaultAIPrompts, defaultAIButtonsConfig, AIButtonsConfig } from './StoryEditor';

const IMAGE_SIZE_PRESETS = [
  { value: '2K', zh: '官方 2K', en: 'Official 2K' },
  { value: '2048x2048', zh: '1:1 即梦 2K', en: '1:1 Seedream 2K' },
  { value: '2560x1440', zh: '16:9 即梦横屏', en: '16:9 Seedream landscape' },
  { value: '1440x2560', zh: '9:16 即梦竖屏', en: '9:16 Seedream portrait' },
  { value: '2304x1728', zh: '4:3 即梦横图', en: '4:3 Seedream landscape' },
  { value: '1728x2304', zh: '3:4 即梦竖图', en: '3:4 Seedream portrait' },
  { value: '512x512', zh: '1:1 小方图', en: '1:1 Small square' },
  { value: '768x768', zh: '1:1 中方图', en: '1:1 Medium square' },
  { value: '1024x1024', zh: '1:1 标准方图', en: '1:1 Standard square' },
  { value: '1024x1536', zh: '2:3 竖图', en: '2:3 Portrait' },
  { value: '1536x1024', zh: '3:2 横图', en: '3:2 Landscape' },
  { value: '720x1280', zh: '9:16 手机', en: '9:16 Mobile' },
  { value: '1080x1920', zh: '9:16 高清竖屏', en: '9:16 HD portrait' },
  { value: '1280x720', zh: '16:9 横屏', en: '16:9 Landscape' },
  { value: '1920x1080', zh: '16:9 高清横屏', en: '16:9 HD landscape' },
  { value: '1080x1350', zh: '4:5 社媒竖图', en: '4:5 Social portrait' },
  { value: '1350x1080', zh: '5:4 社媒横图', en: '5:4 Social landscape' },
  { value: '1024x1792', zh: '9:16 DALL-E', en: '9:16 DALL-E' },
  { value: '1792x1024', zh: '16:9 DALL-E', en: '16:9 DALL-E' },
];

const SEEDREAM_IMAGE_API_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const SEEDREAM_IMAGE_MODEL = 'doubao-seedream-4-5-251128';
const SEEDREAM_IMAGE_SIZE = '2K';

const parseImageApiTemplate = (text: string) => {
  const source = text.trim();
  if (!source) {
    return null;
  }

  const baseUrl = source.match(/(?:base_url|baseURL|baseUrl|api_url|apiUrl|endpoint)\s*[:=]\s*["']([^"']+)["']/i)?.[1];
  const curlUrl = source.match(/curl(?:\s+-X\s+POST|\s+--location)?\s+["']?([^\s"'\\]+)["']?/i)?.[1];
  const endpointUrl = source.match(/https?:\/\/[^\s"'\\]+\/images\/generations/i)?.[0];
  const plainUrl = source.match(/^https?:\/\/\S+$/i)?.[0];
  const apiKey = source.match(/Authorization:\s*Bearer\s+([^"'\s\\]+)/i)?.[1]
    || source.match(/(?:api[_-]?key|apiKey|ARK_API_KEY|OPENAI_API_KEY)\s*[:=]\s*["']([^"']+)["']/i)?.[1]
    || source.match(/["']Bearer\s+([^"']+)["']/i)?.[1]
    || source.match(/^(?:sk|ark)-[A-Za-z0-9_\-.]+$/)?.[0];
  const model = source.match(/["']model["']\s*:\s*["']([^"']+)["']/i)?.[1]
    || source.match(/model\s*=\s*["']([^"']+)["']/i)?.[1]
    || source.match(/^(?:doubao|seedream|gpt-image)[A-Za-z0-9_\-.]*$/i)?.[0];
  const size = source.match(/["']size["']\s*:\s*["']([^"']+)["']/i)?.[1]
    || source.match(/size\s*=\s*["']([^"']+)["']/i)?.[1]
    || source.match(/^(?:\d{3,5}\s*[xX*]\s*\d{3,5}|2K)$/)?.[0];

  const parsed = {
    apiUrl: baseUrl || endpointUrl || curlUrl || plainUrl,
    apiKey,
    model,
    size,
  };

  return Object.values(parsed).some(Boolean) ? parsed : null;
};

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
  showMiniMap: boolean;
  setShowMiniMap: (val: boolean) => void;
  miniMapPosition: 'left' | 'right';
  setMiniMapPosition: (position: 'left' | 'right') => void;
  showControls: boolean;
  setShowControls: (val: boolean) => void;
  aiProvider: 'gemini' | 'deepseek' | 'openai';
  setAiProvider: (provider: 'gemini' | 'deepseek' | 'openai') => void;
  customApiKey: string;
  setCustomApiKey: (key: string) => void;
  deepseekApiKey: string;
  setDeepseekApiKey: (key: string) => void;
  openaiApiKey: string;
  setOpenaiApiKey: (key: string) => void;
  imageApiKey: string;
  setImageApiKey: (key: string) => void;
  imageApiUrl: string;
  setImageApiUrl: (url: string) => void;
  imageModel: string;
  setImageModel: (model: string) => void;
  imageSize: string;
  setImageSize: (size: string) => void;
  ttsApiKey: string;
  setTtsApiKey: (key: string) => void;
  ttsProvider: 'system' | 'youdao';
  setTtsProvider: (provider: 'system' | 'youdao') => void;
  ttsApiUrl: string;
  setTtsApiUrl: (url: string) => void;
  ttsModel: string;
  setTtsModel: (model: string) => void;
  ttsVoice: string;
  setTtsVoice: (voice: string) => void;
  generateLength: string;
  setGenerateLength: (len: string) => void;
  thinkingMode: boolean;
  setThinkingMode: (val: boolean) => void;
  aiPrompts: Record<string, string>;
  setAiPrompts: (prompts: any) => void;
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
  showMiniMap,
  setShowMiniMap,
  miniMapPosition,
  setMiniMapPosition,
  showControls,
  setShowControls,
  aiProvider,
  setAiProvider,
  customApiKey,
  setCustomApiKey,
  deepseekApiKey,
  setDeepseekApiKey,
  openaiApiKey,
  setOpenaiApiKey,
  imageApiKey,
  setImageApiKey,
  imageApiUrl,
  setImageApiUrl,
  imageModel,
  setImageModel,
  imageSize,
  setImageSize,
  ttsApiKey,
  setTtsApiKey,
  ttsProvider,
  setTtsProvider,
  ttsApiUrl,
  setTtsApiUrl,
  ttsModel,
  setTtsModel,
  ttsVoice,
  setTtsVoice,
  generateLength,
  setGenerateLength,
  thinkingMode,
  setThinkingMode,
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
  setPlayTestDimBackground
}) => {
  const [activeSettingsTab, setActiveSettingsTab] = useState<'appearance' | 'editor' | 'playtest' | 'ai' | 'about'>('appearance');
  const [showCustomAiPrompts, setShowCustomAiPrompts] = useState(false);
  const [aboutPage, setAboutPage] = useState<'contact' | 'help'>('contact');
  const [imageTemplateImportStatus, setImageTemplateImportStatus] = useState<'idle' | 'success' | 'empty' | 'blocked'>('idle');
  const [manualImageTemplate, setManualImageTemplate] = useState('');
  const [openAiPanels, setOpenAiPanels] = useState({ text: true, image: true, voice: true });
  const toggleAiPanel = (panel: 'text' | 'image' | 'voice') => {
    setOpenAiPanels(current => ({ ...current, [panel]: !current[panel] }));
  };
  const forceQuitApp = async () => {
    try {
      const tauriCore = await import('@tauri-apps/api/core');
      const invoke = tauriCore.invoke || (tauriCore as any).default?.invoke || (window as any).__TAURI__?.core?.invoke;
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

  const applyImageTemplate = (template: string) => {
    const parsed = parseImageApiTemplate(template);
    if (!parsed) return false;

    if (parsed.apiUrl) setImageApiUrl(parsed.apiUrl);
    if (parsed.apiKey) setImageApiKey(parsed.apiKey);
    if (parsed.model) setImageModel(parsed.model);
    if (parsed.size) setImageSize(parsed.size);
    return true;
  };

  const importImageTemplateFromClipboard = async () => {
    if (!navigator.clipboard?.readText) {
      setImageTemplateImportStatus('blocked');
      return;
    }

    try {
      const template = await navigator.clipboard.readText();
      const imported = applyImageTemplate(template);
      setImageTemplateImportStatus(imported ? 'success' : 'empty');
    } catch {
      setImageTemplateImportStatus('blocked');
    }
  };

  const importManualImageTemplate = (template: string) => {
    const imported = applyImageTemplate(template);
    setImageTemplateImportStatus(imported ? 'success' : 'empty');
    return imported;
  };

  if (!showSettings) return null;

  return (
    <div className={`fixed inset-0 bg-slate-900/40 dark:bg-black/60 z-[300] flex items-center justify-center backdrop-blur-[2px] p-4 animate-in fade-in duration-200 ${theme === 'dark' ? 'dark' : ''}`}>
      <div className="bg-[var(--panel-bg)] backdrop-blur-[0px] rounded-2xl shadow-2xl w-full max-w-3xl h-[600px] max-h-[85vh] flex overflow-hidden border border-[var(--header-border)] animate-in zoom-in-95 duration-300">

        {/* Sidebar Navigation */}
        <div className="w-52 bg-[var(--app-bg)]/30 border-r border-[var(--header-border)] flex flex-col p-5 shrink-0">
          <div className="flex items-center gap-3 px-2 py-4 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 ring-4 ring-white dark:ring-slate-800">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">{t.settings}</h2>
          </div>

          <div className="flex-1 space-y-1.5">
            {[
              { id: 'appearance', label: t.theme, icon: <ImageIcon className="w-4 h-4" /> },
              { id: 'editor', label: language === 'zh' ? '编辑器' : 'Editor', icon: <Layers className="w-4 h-4" /> },
              { id: 'playtest', label: language === 'zh' ? '剧本测试' : 'Playtest', icon: <PlayCircle className="w-4 h-4" /> },
              { id: 'ai', label: t.aiSettings, icon: <BrainCircuit className="w-4 h-4" /> },
              { id: 'about', label: language === 'zh' ? '关于与反馈' : 'About & Feedback', icon: <MessageCircle className="w-4 h-4" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSettingsTab(tab.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${activeSettingsTab === tab.id
                  ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] scale-[1.02] border border-[var(--card-border)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--card-bg)]/50'
                  }`}
              >
                <span className={activeSettingsTab === tab.id ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}>{tab.icon}</span>
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
                  <h3 className="text-base font-black text-[var(--text-primary)]">{t.theme} & {language === 'zh' ? '语言' : 'Language'}</h3>
                </header>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">{t.theme}</label>
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
                    <label className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider px-1">{language === 'zh' ? '系统语言' : 'Language'}</label>
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
                  <h3 className="text-base font-black text-[var(--text-primary)]">{t.toolbarLayout}</h3>
                </header>
                <div className="flex bg-[var(--app-bg)]/50 p-1.5 rounded-xl border border-[var(--header-border)]">
                  <button onClick={() => setToolbarLayout('vertical')} className={`flex-1 py-3 text-[10px] font-black rounded-lg transition-all uppercase tracking-wider ${toolbarLayout === 'vertical' ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>{t.vertical}</button>
                  <button onClick={() => setToolbarLayout('horizontal')} className={`flex-1 py-3 text-[10px] font-black rounded-lg transition-all uppercase tracking-wider ${toolbarLayout === 'horizontal' ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>{t.horizontal}</button>
                </div>
              </section>

              <section>
                <header className="flex items-center gap-3 mb-6">
                  <div className="w-1.5 h-6 bg-indigo-500 dark:bg-sky-400 rounded-full" />
                  <h3 className="text-base font-black text-[var(--text-primary)]">{language === 'zh' ? '工具栏气泡质感' : 'Toolbar Bubble Style'}</h3>
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
                  <h3 className="text-base font-black text-[var(--text-primary)]">{t.selectionMenuLayout}</h3>
                </header>
                <div className="flex bg-[var(--app-bg)]/50 p-1.5 rounded-xl border border-[var(--header-border)]">
                  <button onClick={() => setSelectionMenuLayout('horizontal')} className={`flex-1 py-3 text-[10px] font-black rounded-lg transition-all uppercase tracking-wider ${selectionMenuLayout === 'horizontal' ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>{t.menuHorizontal}</button>
                  <button onClick={() => setSelectionMenuLayout('vertical')} className={`flex-1 py-3 text-[10px] font-black rounded-lg transition-all uppercase tracking-wider ${selectionMenuLayout === 'vertical' ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>{t.menuVertical}</button>
                </div>
              </section>

              <section className="space-y-5">
                <header className="flex items-center gap-3 mb-2">
                  <div className="w-1.5 h-6 bg-[var(--accent)] rounded-full" />
                  <h3 className="text-base font-black text-[var(--text-primary)]">{t.bgColors}</h3>
                </header>
                <p className="text-xs text-[var(--text-muted)] font-medium px-4">{language === 'zh' ? '点击颜色块可自定义颜色，这些颜色将显示在画布右侧的快速切换栏中。' : 'Click color blocks to customize. These will appear in the quick switcher.'}</p>
                <div className="grid grid-cols-3 gap-5">
                  {presetColors.map((color, idx) => (
                    <div key={idx} className="group relative flex items-center gap-4 bg-[var(--app-bg)]/50 p-4 rounded-xl border border-[var(--card-border)] transition-all hover:bg-[var(--card-bg)] hover:shadow-xl dark:hover:shadow-none hover:border-indigo-100 dark:hover:border-indigo-500/30">
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
                        <div className="w-full h-full rounded-lg border-4 border-white dark:border-slate-700 shadow-lg ring-1 ring-slate-100 dark:ring-slate-900 group-hover:scale-110 transition-transform duration-500" style={{ backgroundColor: color }} />
                      </div>
                      <div className="flex-1">
                        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tighter mb-0.5">Slot {idx + 1}</div>
                        <div className="text-xs font-mono font-bold text-[var(--text-primary)] uppercase">{color}</div>
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
                  <button onClick={() => setEdgeStyle('step')} className={`flex-1 flex flex-col items-center gap-2 py-5 rounded-lg transition-all duration-500 ${edgeStyle === 'step' ? 'bg-[var(--card-bg)] shadow-xl text-[var(--accent)] border border-[var(--card-border)] scale-[1.05] z-10' : 'text-[var(--text-muted)] opacity-60 hover:opacity-100'}`}>
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
                  <button onClick={() => setEdgeStyle('bezier')} className={`flex-1 flex flex-col items-center gap-2 py-5 rounded-lg transition-all duration-500 ${edgeStyle === 'bezier' ? 'bg-[var(--card-bg)] shadow-xl text-[var(--accent)] border border-[var(--card-border)] scale-[1.05] z-10' : 'text-[var(--text-muted)] opacity-60 hover:opacity-100'}`}>
                    <div className="w-14 h-10 border-2 border-current rounded-lg flex items-center justify-center mb-1">
                      <div className="relative w-8 h-5">
                        <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 32 20" fill="none" stroke="currentColor" strokeWidth="2">
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
                  <h3 className="text-base font-black text-[var(--text-primary)]">{language === 'zh' ? '交互与显示' : 'Interactions'}</h3>
                </header>
                <div className="grid grid-cols-2 gap-x-12 gap-y-1">
                  {[
                    { id: 'pastePlain', label: t.pastePlain, value: pasteAsPlainText, setter: setPasteAsPlainText },
                    { id: 'showActions', label: t.showActions, value: showNodeActions, setter: setShowNodeActions },
                    { id: 'showStats', label: t.showStats, value: showStats, setter: setShowStats },
                    { id: 'showMiniMap', label: t.showMiniMap, value: showMiniMap, setter: setShowMiniMap },
                    { id: 'showControls', label: t.showControls, value: showControls, setter: setShowControls },
                  ].map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-4 border-b border-[var(--header-border)] last:border-0 group">
                      <span className="text-sm font-bold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">{item.label}</span>
                      <button
                        onClick={() => item.setter(!item.value)}
                        className={`w-12 h-6 rounded-full transition-all duration-500 relative ${item.value ? 'bg-[var(--accent)] shadow-lg' : 'bg-[var(--app-bg)] border border-[var(--header-border)]'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-500 shadow-sm ${item.value ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                  ))}
                </div>
                {showMiniMap && (
                  <div className="mt-5 max-w-sm rounded-xl border border-[var(--header-border)] bg-[var(--app-bg)]/50 p-1.5">
                    <div className="mb-1.5 px-2 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">{t.miniMapPosition}</div>
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
                  <div className={`space-y-3 ${playTestLayoutMode !== 'classic' ? 'col-span-2' : ''}`}>
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
                      { id: 'belowText', label: language === 'zh' ? '文字下方' : 'Below Text' }
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
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${playTestChoicesPosition !== 'center' ? 'max-h-[200px] opacity-100 mt-10' : 'max-h-0 opacity-0 mt-0'
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
                        id: 'true', value: true, label: language === 'zh' ? '开启背景虚化' : 'Enabled'
                      },
                      { id: 'false', value: false, label: language === 'zh' ? '关闭背景虚化' : 'Disabled' }
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
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${playTestBlurBackground ? 'max-h-[200px] opacity-100 mt-10' : 'max-h-0 opacity-0 mt-0'
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
                          id: 'true', value: true, label: language === 'zh' ? '文字也虚化' : 'Blur Text'
                        },
                        { id: 'false', value: false, label: language === 'zh' ? '文字保持清晰' : 'Keep Text Clear' }
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
                      {language === 'zh' ? '单选项时隐藏居中弹窗' : 'Hide Center Popup for Single Choice'}
                    </h3>
                  </header>
                  <div className="flex bg-[var(--app-bg)]/50 p-1.5 rounded-xl border border-[var(--header-border)]">
                    {[
                      { id: 'true', value: true, label: language === 'zh' ? '隐藏 (点击文字继续)' : 'Hide (Click Text)' },
                      { id: 'false', value: false, label: language === 'zh' ? '显示弹窗选择' : 'Show Popup' }
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
                    <option value="immediate" className={theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'}>{language === 'zh' ? '立即显示 (直接显示文本与选项)' : 'Immediate (Show all instantly)'}</option>
                    <option value="typewriter" className={theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'}>{language === 'zh' ? '打字机效果 (文本逐字打出后显示选项)' : 'Typewriter (Reveal word-by-word)'}</option>
                    <option value="timed" className={theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'}>{language === 'zh' ? '延迟显示选项 (文本载入 N 秒后显示选项)' : 'Timed Delay (Show choices after N seconds)'}</option>
                    <option value="clickToShow" className={theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'}>{language === 'zh' ? '点击显示选项 (点击文本区域后显示选项)' : 'Click-to-Show (Tap text to unlock choices)'}</option>
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
                  {language === 'zh' ? '在沉浸模式下增加一层暗色遮罩，提升文字对比度与可读性。' : 'Overlay a dark mask in immersive mode to improve text readability.'}
                </p>
                <div className="flex bg-[var(--app-bg)]/50 p-1.5 rounded-xl border border-[var(--header-border)]">
                  {[
                    {
                      id: 'true', value: true, label: language === 'zh' ? '启用遮罩' : 'Enabled'
                    },
                    { id: 'false', value: false, label: language === 'zh' ? '关闭遮罩' : 'Disabled' }
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
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-500 shadow-sm ${playTestVideoAutoPlay ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
              </section>
            </div>
          )}

          {activeSettingsTab === 'ai' && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
              <section className="rounded-xl border border-[var(--header-border)] bg-[var(--app-bg)]/20 overflow-hidden">
                <header className="flex items-center justify-between gap-4 p-5 border-b border-[var(--header-border)]">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-[var(--accent)] rounded-full" />
                    <h3 className="text-base font-black text-[var(--text-primary)]">
                      {language === 'zh' ? '文本 AI' : 'Text AI'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleAiPanel('text')}
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all"
                    title={openAiPanels.text ? (language === 'zh' ? '折叠' : 'Collapse') : (language === 'zh' ? '展开' : 'Expand')}
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${openAiPanels.text ? 'rotate-180' : ''}`} />
                  </button>
                </header>

                {openAiPanels.text && (
                  <div className="p-6 space-y-6">
                    <div className="flex bg-[var(--app-bg)]/50 p-1.5 rounded-xl border border-[var(--header-border)] shadow-inner">
                      <button onClick={() => setAiProvider('deepseek')} className={`flex-1 px-4 py-2 text-xs font-black rounded-lg transition-all duration-500 ${aiProvider === 'deepseek' ? 'bg-[var(--card-bg)] shadow-xl text-[var(--accent)] border border-[var(--card-border)] scale-105' : 'text-[var(--text-muted)] opacity-60'}`}>DeepSeek</button>
                      <button onClick={() => setAiProvider('gemini')} className={`flex-1 px-4 py-2 text-xs font-black rounded-lg transition-all duration-500 ${aiProvider === 'gemini' ? 'bg-[var(--card-bg)] shadow-xl text-[var(--accent)] border border-[var(--card-border)] scale-105' : 'text-[var(--text-muted)] opacity-60'}`}>Gemini</button>
                      <button onClick={() => setAiProvider('openai')} className={`flex-1 px-4 py-2 text-xs font-black rounded-lg transition-all duration-500 ${aiProvider === 'openai' ? 'bg-[var(--card-bg)] shadow-xl text-[var(--accent)] border border-[var(--card-border)] scale-105' : 'text-[var(--text-muted)] opacity-60'}`}>OpenAI</button>
                    </div>

                    <div className="bg-[var(--app-bg)]/30 p-8 rounded-xl border border-[var(--header-border)] shadow-inner space-y-6">
                      {aiProvider === 'gemini' ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between ml-1">
                            <label className="text-sm font-black text-[var(--text-primary)]">{t.geminiKey}</label>
                            <span className="text-[10px] font-black text-[var(--accent)] uppercase tracking-widest">Google AI Studio</span>
                          </div>
                          <div className="relative">
                            <input
                              type="password"
                              placeholder="AI Studio API Key"
                              value={customApiKey}
                              onChange={e => setCustomApiKey(e.target.value)}
                              className="w-full px-6 py-4 bg-[var(--card-bg)] border-2 border-[var(--card-border)] rounded-xl outline-none focus:ring-4 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all text-sm font-mono shadow-sm text-[var(--text-primary)]"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                              <Check className={`w-5 h-5 transition-all ${customApiKey ? 'text-emerald-500' : 'text-[var(--text-muted)]'}`} />
                            </div>
                          </div>
                          <p className="text-[10px] leading-relaxed text-[var(--text-muted)] font-bold px-2"></p>
                          <a
                            href="https://ai.google.dev/gemini-api/docs"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-fit px-2 text-[10px] font-bold leading-relaxed text-[var(--accent)] hover:underline"
                          >
                            {language === 'zh' ? 'Gemini API 官方文档' : 'Gemini API Docs'}
                          </a>
                        </div>
                      ) : aiProvider === 'openai' ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between ml-1">
                            <label className="text-sm font-black text-[var(--text-primary)]">{t.openaiKey}</label>
                            <span className="text-[10px] font-black text-[var(--accent)] uppercase tracking-widest">OpenAI Platform</span>
                          </div>
                          <div className="relative">
                            <input
                              type="password"
                              placeholder="OpenAI API Key (sk-...)"
                              value={openaiApiKey}
                              onChange={e => setOpenaiApiKey(e.target.value)}
                              className="w-full px-6 py-4 bg-[var(--card-bg)] border-2 border-[var(--card-border)] rounded-xl outline-none focus:ring-4 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all text-sm font-mono shadow-sm text-[var(--text-primary)]"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                              <Check className={`w-5 h-5 transition-all ${openaiApiKey ? 'text-emerald-500' : 'text-[var(--text-muted)]'}`} />
                            </div>
                          </div>
                          <p className="text-[10px] leading-relaxed text-[var(--text-muted)] font-bold px-2">{language === 'zh' ? '支持 gpt-4o 等系列模型。' : 'Supports gpt-4o models.'}</p>
                          <a
                            href="https://platform.openai.com/docs"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-fit px-2 text-[10px] font-bold leading-relaxed text-[var(--accent)] hover:underline"
                          >
                            {language === 'zh' ? 'OpenAI API 官方文档' : 'OpenAI API Docs'}
                          </a>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between ml-1">
                            <label className="text-sm font-black text-[var(--text-primary)]">{t.deepseekKey}</label>
                            <span className="text-[10px] font-black text-[var(--accent)] uppercase tracking-widest">DeepSeek Platform</span>
                          </div>
                          <div className="relative">
                            <input
                              type="password"
                              placeholder="DeepSeek Platform API Key"
                              value={deepseekApiKey}
                              onChange={e => setDeepseekApiKey(e.target.value)}
                              className="w-full px-6 py-4 bg-[var(--card-bg)] border-2 border-[var(--card-border)] rounded-xl outline-none focus:ring-4 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all text-sm font-mono shadow-sm text-[var(--text-primary)]"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                              <Check className={`w-5 h-5 transition-all ${deepseekApiKey ? 'text-emerald-500' : 'text-[var(--text-muted)]'}`} />
                            </div>
                          </div>
                          <a
                            href="https://api-docs.deepseek.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-fit px-2 text-[10px] font-bold leading-relaxed text-[var(--accent)] hover:underline"
                          >
                            {language === 'zh' ? 'DeepSeek API 官方文档' : 'DeepSeek API Docs'}
                          </a>
                        </div>
                      )}
                    </div>
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center justify-between px-2">
                        <div className="space-y-1">
                          <h4 className="text-sm font-black text-[var(--text-primary)]">{t.genLength}</h4>
                          <p className="text-xs text-[var(--text-muted)] font-medium">{language === 'zh' ? '控制 AI 续写内容的字数深度' : 'Control AI output depth'}</p>
                        </div>
                        <select
                          value={generateLength}
                          onChange={(e) => setGenerateLength(e.target.value)}
                          className="px-6 py-3 bg-[var(--app-bg)] border-2 border-[var(--card-border)] rounded-xl text-sm font-black text-[var(--text-primary)] outline-none focus:ring-4 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all cursor-pointer"
                        >
                          {['1句话', '2-3句话', '100字', '200字', '500字', '1000字'].map(len => (
                            <option key={len} value={len} className={theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'}>{language === 'zh' ? len : len.replace('句话', ' sentences').replace('字', ' words')}</option>
                          ))}
                        </select>
                      </div>

                      <div className={`p-6 rounded-xl border-2 transition-all duration-700 ${aiProvider === 'deepseek' || aiProvider === 'gemini' || aiProvider === 'openai' ? 'bg-[var(--card-bg)] border-[var(--accent)]/30 shadow-xl' : 'bg-[var(--app-bg)] border-[var(--card-border)] opacity-40 grayscale pointer-events-none'}`}>
                        <div className="flex items-center justify-between">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-black text-[var(--text-primary)]">{t.thinkingMode}</h4>
                              <span className="px-2 py-0.5 bg-[var(--accent)] text-[10px] font-black text-white rounded-full uppercase tracking-tighter shadow-sm">Exclusive</span>
                            </div>
                            <p className="text-xs text-[var(--text-muted)] font-medium max-w-[280px] leading-relaxed">{t.thinkingModeDesc}</p>
                          </div>
                          <button
                            onClick={() => setThinkingMode(!thinkingMode)}
                            className={`w-14 h-7 rounded-full transition-all duration-500 relative ${thinkingMode ? 'bg-[var(--accent)] shadow-lg' : 'bg-[var(--app-bg)] border border-[var(--header-border)] shadow-inner'}`}
                          >
                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-500 shadow-md ${thinkingMode ? 'left-8' : 'left-1'}`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-[var(--header-border)] bg-[var(--app-bg)]/20 overflow-hidden">
                <header className="flex items-center justify-between gap-4 p-5 border-b border-[var(--header-border)]">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-[var(--accent)] rounded-full" />
                    <h3 className="text-base font-black text-[var(--text-primary)]">
                      {language === 'zh' ? '图片 AI' : 'Image AI'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleAiPanel('image')}
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all"
                    title={openAiPanels.image ? (language === 'zh' ? '折叠' : 'Collapse') : (language === 'zh' ? '展开' : 'Expand')}
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${openAiPanels.image ? 'rotate-180' : ''}`} />
                  </button>
                </header>
                {openAiPanels.image && (
                  <div className="p-6">
                    <div className="bg-[var(--app-bg)]/30 p-6 rounded-xl border border-[var(--header-border)] shadow-inner space-y-4">
                      <button
                        type="button"
                        onClick={importImageTemplateFromClipboard}
                        className="relative z-10 w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--accent)] text-white rounded-xl text-xs font-black shadow-md transition-all hover:shadow-lg active:scale-95"
                      >
                        <ImageIcon className="w-4 h-4" />
                        <span>{language === 'zh' ? '剪贴板导入填入' : 'Clipboard import and filling in'}</span>
                      </button>
                      {imageTemplateImportStatus !== 'idle' && (
                        <p className={`text-[10px] leading-relaxed font-bold px-1 ${imageTemplateImportStatus === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {imageTemplateImportStatus === 'success'
                            ? (language === 'zh' ? '已从剪贴板填入可识别的接口信息。' : 'Imported recognized API fields from clipboard.')
                            : imageTemplateImportStatus === 'blocked'
                              ? (language === 'zh' ? '无法直接读取剪贴板，请粘贴到下方文本框导入。' : 'Clipboard access was blocked. Paste into the box below to import.')
                              : (language === 'zh' ? '剪贴板里没有识别到 API 地址、密钥、模型或尺寸。' : 'No API URL, key, model, or size was recognized in clipboard.')
                          }
                        </p>
                      )}
                      {(imageTemplateImportStatus === 'blocked' || imageTemplateImportStatus === 'empty') && (
                        <div className="space-y-2">
                          <textarea
                            value={manualImageTemplate}
                            onChange={e => {
                              const value = e.target.value;
                              setManualImageTemplate(value);
                              if (value.trim()) importManualImageTemplate(value);
                            }}
                            onPaste={e => {
                              const pasted = e.clipboardData.getData('text');
                              if (pasted.trim()) {
                                setManualImageTemplate(pasted);
                                importManualImageTemplate(pasted);
                              }
                            }}
                            placeholder={language === 'zh' ? '在这里 Ctrl+V 粘贴官方模板、curl、JSON 或 API Key' : 'Ctrl+V official template, curl, JSON, or API key here'}
                            className="w-full min-h-24 px-4 py-3 bg-[var(--card-bg)] border-2 border-[var(--card-border)] rounded-xl outline-none focus:ring-4 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all text-xs font-mono shadow-sm text-[var(--text-primary)] resize-y"
                          />
                          <button
                            type="button"
                            onClick={() => importManualImageTemplate(manualImageTemplate)}
                            className="px-4 py-2 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg text-xs font-black text-[var(--text-primary)] hover:text-[var(--accent)] transition-all active:scale-95"
                          >
                            {language === 'zh' ? '导入粘贴内容' : 'Import Pasted Text'}
                          </button>
                        </div>
                      )}
                      <div className="space-y-2">
                        <label className="text-xs font-black text-[var(--text-primary)]">
                          {language === 'zh' ? 'API 地址 / Base URL' : 'API Endpoint / Base URL'}
                        </label>
                        <input
                          type="text"
                          value={imageApiUrl}
                          onChange={e => {
                            const value = e.target.value;
                            if (!applyImageTemplate(value)) setImageApiUrl(value);
                          }}
                          placeholder={SEEDREAM_IMAGE_API_URL}
                          className="w-full px-4 py-3 bg-[var(--card-bg)] border-2 border-[var(--card-border)] rounded-xl outline-none focus:ring-4 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all text-xs font-mono shadow-sm text-[var(--text-primary)]"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-[var(--text-primary)]">
                          {language === 'zh' ? 'API 密钥' : 'API Key'}
                        </label>
                        <div className="relative">
                          <input
                            type="password"
                            value={imageApiKey}
                            onChange={e => setImageApiKey(e.target.value)}
                            placeholder="Image API Key"
                            className="w-full px-4 py-3 pr-11 bg-[var(--card-bg)] border-2 border-[var(--card-border)] rounded-xl outline-none focus:ring-4 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all text-sm font-mono shadow-sm text-[var(--text-primary)]"
                          />
                          <Check className={`w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 transition-all ${imageApiKey ? 'text-emerald-500' : 'text-[var(--text-muted)]'}`} />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-[var(--text-primary)]">
                            {language === 'zh' ? '模型' : 'Model'}
                          </label>
                          <input
                            type="text"
                            value={imageModel}
                            onChange={e => setImageModel(e.target.value)}
                            placeholder={SEEDREAM_IMAGE_MODEL}
                            className="w-full px-4 py-3 bg-[var(--card-bg)] border-2 border-[var(--card-border)] rounded-xl outline-none focus:ring-4 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all text-sm font-mono shadow-sm text-[var(--text-primary)]"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-[var(--text-primary)]">
                            {language === 'zh' ? '自定义尺寸' : 'Custom Size'}
                          </label>
                          <input
                            type="text"
                            value={imageSize}
                            onChange={e => setImageSize(e.target.value)}
                            placeholder={SEEDREAM_IMAGE_SIZE}
                            className="w-full px-4 py-3 bg-[var(--card-bg)] border-2 border-[var(--card-border)] rounded-xl outline-none focus:ring-4 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all text-sm font-mono font-bold shadow-sm text-[var(--text-primary)]"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-xs font-black text-[var(--text-primary)]">
                            {language === 'zh' ? '主流尺寸预设' : 'Popular Size Presets'}
                          </label>
                          <span className="text-[10px] font-bold text-[var(--text-muted)]">
                            {language === 'zh' ? '点击快速填入' : 'Click to fill'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {IMAGE_SIZE_PRESETS.map(size => (
                            <button
                              key={size.value}
                              type="button"
                              onClick={() => setImageSize(size.value)}
                              className={`px-3 py-2 rounded-lg border text-left transition-all active:scale-95 ${imageSize === size.value
                                ? 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-md'
                                : 'bg-[var(--card-bg)] text-[var(--text-secondary)] border-[var(--card-border)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                                }`}
                              title={size.value}
                            >
                              <div className="text-xs font-black">{size.value}</div>
                              <div className={`text-[9px] font-bold mt-0.5 ${imageSize === size.value ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>
                                {language === 'zh' ? size.zh : size.en}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                      <p className="text-[10px] leading-relaxed text-[var(--text-muted)] font-bold px-1">
                        {language === 'zh' ? '普通文字卡片会使用这里的配置生成图片。即梦/火山方舟会自动把 OpenAI 默认地址、gpt-image-1 和过小尺寸转换成可测试的 Seedream 请求。' : 'Text cards use this configuration to generate images. Seedream / Volcengine requests automatically convert the OpenAI default endpoint, gpt-image-1, and undersized images into a testable Seedream request.'}
                      </p>
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-[var(--header-border)] bg-[var(--app-bg)]/20 overflow-hidden">
                <header className="flex items-center justify-between gap-4 p-5 border-b border-[var(--header-border)]">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-sky-500 rounded-full" />
                    <h3 className="text-base font-black text-[var(--text-primary)]">
                      {language === 'zh' ? '语音 AI' : 'Voice AI'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleAiPanel('voice')}
                    className="w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all"
                    title={openAiPanels.voice ? (language === 'zh' ? '折叠' : 'Collapse') : (language === 'zh' ? '展开' : 'Expand')}
                  >
                    <ChevronDown className={`w-4 h-4 transition-transform ${openAiPanels.voice ? 'rotate-180' : ''}`} />
                  </button>
                </header>
                {openAiPanels.voice && (
                  <div className="p-6">
                    <div className="bg-[var(--app-bg)]/30 p-6 rounded-xl border border-[var(--header-border)] shadow-inner space-y-4">
                      <div className="grid grid-cols-2 gap-2 p-1 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl">
                        <button
                          type="button"
                          onClick={() => setTtsProvider('system')}
                          className={`px-4 py-3 rounded-lg text-xs font-black transition-all ${ttsProvider === 'system' ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                        >
                          {language === 'zh' ? '系统自带语音' : 'System Voice'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setTtsProvider('youdao')}
                          className={`px-4 py-3 rounded-lg text-xs font-black transition-all ${ttsProvider === 'youdao' ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                        >
                          {language === 'zh' ? '有道云 API' : 'Youdao API'}
                        </button>
                      </div>
                      {ttsProvider === 'youdao' && (
                        <>
                          <input type="hidden" value={ttsApiUrl} onChange={e => setTtsApiUrl(e.target.value)} />
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-xs font-black text-[var(--text-primary)]">
                                {language === 'zh' ? '应用 ID' : 'Application ID'}
                              </label>
                              <input
                                type="text"
                                value={ttsModel}
                                onChange={e => setTtsModel(e.target.value)}
                                placeholder="65a6f7935fd78c5b"
                                className="w-full px-4 py-3 bg-[var(--card-bg)] border-2 border-[var(--card-border)] rounded-xl outline-none focus:ring-4 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all text-sm font-mono shadow-sm text-[var(--text-primary)]"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-black text-[var(--text-primary)]">
                                {language === 'zh' ? '应用密钥' : 'Application Secret'}
                              </label>
                              <div className="relative">
                                <input
                                  type="password"
                                  value={ttsApiKey}
                                  onChange={e => setTtsApiKey(e.target.value)}
                                  placeholder={language === 'zh' ? '控制台里的应用密钥' : 'Application secret'}
                                  className="w-full px-4 py-3 pr-11 bg-[var(--card-bg)] border-2 border-[var(--card-border)] rounded-xl outline-none focus:ring-4 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all text-sm font-mono shadow-sm text-[var(--text-primary)]"
                                />
                                <Check className={`w-5 h-5 absolute right-4 top-1/2 -translate-y-1/2 transition-all ${ttsApiKey ? 'text-emerald-500' : 'text-[var(--text-muted)]'}`} />
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-black text-[var(--text-primary)]">
                              {language === 'zh' ? '发音人' : 'Voice Name'}
                            </label>
                            <input
                              type="text"
                              value={ttsVoice}
                              onChange={e => setTtsVoice(e.target.value)}
                              placeholder="youxiaoqin"
                              className="w-full px-4 py-3 bg-[var(--card-bg)] border-2 border-[var(--card-border)] rounded-xl outline-none focus:ring-4 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all text-sm font-mono shadow-sm text-[var(--text-primary)]"
                            />
                          </div>
                        </>
                      )}
                      {ttsProvider === 'system' && (
                        <div className="px-4 py-3 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-xl">
                          <p className="text-xs leading-relaxed text-[var(--text-muted)] font-bold">
                            {language === 'zh' ? '使用 Windows 系统内置语音生成 WAV 音频，不需要联网，也不会增加模型体积。' : 'Uses the built-in Windows voice to generate WAV audio without network access or bundled models.'}
                          </p>
                        </div>
                      )}
                      <p className="text-[10px] leading-relaxed text-[var(--text-muted)] font-bold px-1">
                        {language === 'zh' ? '框选剧情卡片后，使用框选菜单里的“生成朗读音频”会把每张卡片的标题和正文合成为音频，并自动关联到 audioUrl。' : 'After selecting story cards, use Generate narration audio in the selection menu to synthesize each card title and body into audio and attach it to audioUrl.'}
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {/* AI 续写弹窗按钮可见性配置 */}
              <section className="space-y-4 pt-4 border-t border-[var(--header-border)]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-indigo-500 dark:bg-sky-400 rounded-full" />
                    <h3 className="text-base font-black text-[var(--text-primary)]">
                      {language === 'zh' ? 'AI 续写弹窗按钮' : 'AI Action Buttons'}
                    </h3>
                  </div>
                  <button
                    onClick={() => setAiButtonsConfig(defaultAIButtonsConfig)}
                    className="text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors px-2 py-1 rounded-lg hover:bg-[var(--app-bg)]/50"
                  >
                    {language === 'zh' ? '全部恢复' : 'Reset All'}
                  </button>
                </div>
                <p className="text-xs text-[var(--text-muted)] font-medium">
                  {language === 'zh' ? '控制 AI 续写选择弹窗中显示哪些功能按钮。' : 'Control which action buttons appear in the AI writing modal.'}
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {([
                    { key: 'continue' as const, emoji: '✍️', label: language === 'zh' ? '根据前文续写' : 'Continue from context' },
                    { key: 'creative' as const, emoji: '💡', label: language === 'zh' ? '提供不同创意' : 'Creative alternatives' },
                    { key: 'rewrite' as const, emoji: '🔄', label: language === 'zh' ? '改写当前内容' : 'Rewrite current content' },
                    { key: 'interpolate' as const, emoji: '🧩', label: language === 'zh' ? '补充中间内容' : 'Fill in the gap' },
                    { key: 'scene_only' as const, emoji: '🏞', label: language === 'zh' ? '仅增加场景描写' : 'Scene description only' },
                    { key: 'dialogue_only' as const, emoji: '💬', label: language === 'zh' ? '仅增加对话' : 'Dialogue only' },
                  ] as const).map((item) => (
                    <div
                      key={item.key}
                      onClick={() => setAiButtonsConfig({ ...aiButtonsConfig, [item.key]: !aiButtonsConfig[item.key] })}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all ${aiButtonsConfig[item.key]
                        ? 'border-[var(--accent)]/40 bg-[var(--accent)]/5 hover:bg-[var(--accent)]/10'
                        : 'border-[var(--header-border)] bg-[var(--app-bg)]/30 opacity-50 hover:opacity-70'
                        }`}
                    >
                      <span className="text-lg">{item.emoji}</span>
                      <span className={`flex-1 text-sm font-semibold ${aiButtonsConfig[item.key] ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
                        }`}>
                        {item.label}
                      </span>
                      {/* NOTE: 自定义 toggle 开关 */}
                      <div className={`w-10 h-5 rounded-full transition-all duration-300 relative flex-shrink-0 ${aiButtonsConfig[item.key] ? 'bg-[var(--accent)]' : 'bg-[var(--app-bg)] border border-[var(--header-border)]'
                        }`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${aiButtonsConfig[item.key] ? 'left-5' : 'left-0.5'
                          }`} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="space-y-6 pt-4 border-t border-[var(--header-border)]">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-indigo-500 dark:bg-sky-400 rounded-full" />
                    <h3 className="text-base font-black text-[var(--text-primary)]">
                      {language === 'zh' ? '自定义 AI 提示词' : 'Custom AI Prompts'}
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowCustomAiPrompts(!showCustomAiPrompts)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl border-0 border-[var(--header-border)] bg-[var(--app-bg)]/30 transition-all active:scale-95"
                  >
                    <div className={`w-11 h-6 rounded-full transition-all duration-300 relative ${showCustomAiPrompts ? 'bg-[var(--accent)] shadow-lg' : 'bg-[var(--app-bg)] border border-[var(--header-border)]'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${showCustomAiPrompts ? 'left-6' : 'left-1'}`} />
                    </div>
                  </button>
                </div>
                {showCustomAiPrompts && (
                  <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                    <p className="text-xs text-[var(--text-muted)] font-medium mb-4">
                      {language === 'zh' ? '可在此处修改 AI 对话时使用的模板变量，修改会自动保存在工程中。' : 'Modify the prompt templates used for AI interactions. Changes are saved with the project.'}
                    </p>
                    {Object.entries(aiPrompts || {}).map(([key, value]) => {
                      const labelMap: Record<string, string> = {
                        basePrompt: language === 'zh' ? '基础前置提示 (所有续写功能共享)' : 'Base System Prompt',
                        continue: language === 'zh' ? '自然续写' : 'Continue Naturally',
                        creative: language === 'zh' ? '不同创意方向' : 'Creative Directions',
                        rewrite: language === 'zh' ? '文笔改写润色' : 'Rewrite & Polish',
                        interpolate: language === 'zh' ? '承上启下补充' : 'Interpolate Segment',
                        sceneOnly: language === 'zh' ? '仅环境描写' : 'Scene Description Only',
                        dialogueOnly: language === 'zh' ? '仅人物对话' : 'Dialogue Only',
                        analyzeStructure: language === 'zh' ? '分析结构' : 'Analyze Structure',
                        analyzeSuggestions: language === 'zh' ? '后续剧情建议' : 'Plot Suggestions',
                        analyzeDirection: language === 'zh' ? '写作方向指导' : 'Direction Guidance',
                        analyzeSolution: language === 'zh' ? '解法与修改方案' : 'Fix Solutions',
                        analyzeSummary: language === 'zh' ? '整体汇总报告' : 'General Summary'
                      };
                      // NOTE: 判断当前提示词是否已被用户修改（与默认值不同）
                      const defaultValue = defaultAIPrompts[key as keyof typeof defaultAIPrompts] ?? '';
                      const isModified = value !== defaultValue;
                      return (
                        <div key={key} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-[var(--text-primary)]">
                              {labelMap[key] || key}
                            </label>
                            {isModified && (
                              <button
                                onClick={() => setAiPrompts({ ...aiPrompts, [key]: defaultValue })}
                                title={language === 'zh' ? '恢复默认' : 'Restore Default'}
                                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-full hover:bg-amber-100 dark:hover:bg-amber-500/20 transition-all"
                              >
                                ↺ {language === 'zh' ? '恢复初始' : 'Restore'}
                              </button>
                            )}
                          </div>
                          <textarea
                            value={value}
                            onChange={(e) => setAiPrompts({ ...aiPrompts, [key]: e.target.value })}
                            className="w-full h-24 px-4 py-3 bg-[var(--app-bg)] border border-[var(--card-border)] rounded-xl text-xs text-[var(--text-secondary)] font-medium outline-none focus:ring-2 focus:ring-[var(--accent)]/50 focus:border-[var(--accent)] transition-all resize-y custom-scrollbar"
                            spellCheck="false"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

            </div>
          )}

          {activeSettingsTab === 'about' && aboutPage === 'contact' && (
            <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
              <section>
                <header className="flex items-center gap-3 mb-6">
                  <div className="w-1.5 h-6 bg-[var(--accent)] rounded-full" />
                  <h3 className="text-base font-black text-[var(--text-primary)]">{t.contactTitle}</h3>
                </header>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed font-medium px-4">{t.contactDesc}</p>
                <div className="grid grid-cols-2 gap-6">
                  {[
                    {
                      id: 'qq', label: 'QQ 号(个人)', value: '1836902091', icon: <MessageCircle className="w-5 h-5" />, color: 'blue', copied: qqCopied
                    },
                    { id: 'email', label: 'Email', value: 'mingwenc@126.com', icon: <Mail className="w-5 h-5" />, color: 'amber', copied: emailCopied },
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
                        <p className="text-[10px] text-[var(--text-muted)] font-black uppercase tracking-widest">{item.label}</p>
                        <p className="text-base font-mono font-black text-[var(--text-primary)]">{item.value}</p>
                      </div>
                      <div className={`mt-4 flex items-center gap-2 text-xs font-bold transition-all ${item.copied ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500 opacity-0 group-hover:opacity-100'}`}>
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
                <h4 className="text-xl font-black text-slate-900 dark:text-white mb-2 relative z-10">交互式AI小说创作工具</h4>
                <p className="text-indigo-600/40 dark:text-sky-400/40 text-xs font-bold uppercase tracking-[0.4em] mb-6 relative z-10">AIGC x Narrative Architecture</p>
                <div className="h-px bg-slate-200 dark:bg-white/10 w-24 mx-auto mb-6 relative z-10" />
                <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed max-w-[320px] mx-auto relative z-10 font-medium">
                  {language === 'zh' ? '致力于构建下一代AI交互式小说创作工具，让每一颗想象力的种子都能开花结果。' : 'Dedicated to building next-gen AI narrative infrastructure, making every seed of imagination bloom.'}
                </p>
              </section>

              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center gap-2">
                <p className="text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-[0.2em]">Version v1.2.4-stable</p>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                  <p className="text-[9px] font-bold text-slate-400/60 dark:text-slate-500 uppercase tracking-widest">Stable Release</p>
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
                  <span>{language === 'zh' ? '强制关闭 GalWriter AI' : 'Force Close GalWriter AI'}</span>
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
                        {language === 'zh' ? '请合理、合法地使用 GalWriter AI' : 'Use GalWriter AI Responsibly'}
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
                      <div key={index} className="flex gap-3 rounded-xl bg-[var(--app-bg)]/60 border border-[var(--card-border)] px-4 py-3">
                        <span className="w-5 h-5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                          {index + 1}
                        </span>
                        <p className="text-sm leading-relaxed text-[var(--text-secondary)] font-medium">{item}</p>
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

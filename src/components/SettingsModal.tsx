import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bold,
  BrainCircuit,
  Check,
  Copy,
  Diamond,
  Download,
  ExternalLink,
  EyeOff,
  GitFork,
  HelpCircle,
  Hexagon,
  ImageIcon,
  Italic,
  Layers,
  Mail,
  Maximize,
  MessageCircle,
  Mic,
  Minus,
  Palette,
  Play,
  PlayCircle,
  Plus,
  RectangleHorizontal,
  ShieldAlert,
  Square,
  StepForward,
  Trash2,
  Triangle,
  Underline,
  Volume2,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { createPortal } from 'react-dom';

import type {
  BackgroundRemovalAIProfile,
  ImageAIProfile,
  PlotStructureGenerateDirection,
  SavedAIProfile,
  SceneImageMode,
  StoryTitlePlacement,
  TextAIProfile,
  TtsNarrationMode,
  VoiceAIProfile,
} from '../domain/project';
import {
  type AIButtonsConfig,
  type AIGenerationBalance,
  type AIPromptsConfig,
} from '../editor-state/editorConfig';
import type { LocalProjectSummary } from '../lib/db';
import { Language } from '../lib/i18n';
import { getTauriInvoke, isTauriRuntime } from '../lib/tauriRuntime';
import { AISettingsPanel } from './AISettingsPanel';
import { DraggableNumberInput } from './DraggableNumberInput';
import { settingsModalCopy } from './i18n/settings-modal';
import { PlaytestSettingsWorkbench } from './PlaytestSettingsWorkbench';
import type { SharedCanvasSettings } from './render/canvas/canvasSettings';
import {
  applyPlaytestRuntimeSettingsPatch,
  createPlaytestRuntimeSettings,
  type PlaytestRuntimeSettings,
} from './render/canvas/playtestCanvasModel';
import type { RenderStyle } from './render/video/shared/types';

type AIProfileKind = 'text' | 'image' | 'background-removal' | 'voice';
type AIProfileSeed =
  | Partial<TextAIProfile>
  | Partial<ImageAIProfile>
  | Partial<BackgroundRemovalAIProfile>
  | Partial<VoiceAIProfile>;
type AIProfileUpdates =
  | Partial<TextAIProfile>
  | Partial<ImageAIProfile>
  | Partial<BackgroundRemovalAIProfile>
  | Partial<VoiceAIProfile>;

function FloatingHint({
  label,
  description,
  className = '',
}: {
  label: React.ReactNode;
  description: string;
  className?: string;
}) {
  const anchorRef = React.useRef<HTMLSpanElement | null>(null);
  const [position, setPosition] = React.useState<{
    left: number;
    top: number;
    placement: 'above' | 'below';
  } | null>(null);

  const showHint = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = 256;
    const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.left));
    const shouldPlaceAbove = rect.bottom + 112 > window.innerHeight && rect.top > 112;
    setPosition({
      left,
      top: shouldPlaceAbove ? rect.top - 8 : rect.bottom + 8,
      placement: shouldPlaceAbove ? 'above' : 'below',
    });
  };

  return (
    <span
      ref={anchorRef}
      className={`relative inline-flex min-w-0 cursor-help ${className}`}
      aria-label={description}
      onMouseEnter={showHint}
      onMouseLeave={() => setPosition(null)}
      onFocus={showHint}
      onBlur={() => setPosition(null)}
      tabIndex={0}
    >
      {label}
      {position
        ? createPortal(
            <span
              className="pointer-events-none fixed z-[2000] w-64 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] p-3 text-xs font-medium leading-relaxed text-[var(--text-secondary)] shadow-xl"
              style={{
                left: position.left,
                top: position.top,
                transform: position.placement === 'above' ? 'translateY(-100%)' : undefined,
              }}
            >
              {description}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

interface SettingsModalProps {
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  missingTextApiKey: boolean;
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  closeButtonBehavior: 'minimize' | 'quit';
  setCloseButtonBehavior: (behavior: 'minimize' | 'quit') => void;
  bubbleStyle: 'glass' | 'flat';
  setBubbleStyle: (style: 'glass' | 'flat') => void;
  opaqueAssistantMessagesInGlass: boolean;
  setOpaqueAssistantMessagesInGlass: (value: boolean) => void;
  opaqueFooterInGlass: boolean;
  setOpaqueFooterInGlass: (value: boolean) => void;
  accentColor: string;
  setAccentColor: (color: string) => void;
  effectiveAccentColor: string;
  canvasBg: string;
  setCanvasBg: (bg: string) => void;
  presetColors: string[];
  setPresetColors: (colors: string[]) => void;
  showPresetColors: boolean;
  setShowPresetColors: (show: boolean) => void;
  storyTitlePlacement: StoryTitlePlacement;
  setStoryTitlePlacement: (placement: StoryTitlePlacement) => void;
  toolbarLayout: 'vertical' | 'horizontal';
  setToolbarLayout: (layout: 'vertical' | 'horizontal') => void;
  cardToolbarScale: number;
  setCardToolbarScale: (scale: number) => void;
  edgeStyle: 'step' | 'bezier';
  setEdgeStyle: (style: 'step' | 'bezier') => void;
  edgeColor: string;
  setEdgeColor: (color: string) => void;
  arrowSize: number;
  setArrowSize: (size: number) => void;
  arrowCornerRadius: number;
  setArrowCornerRadius: (radius: number) => void;
  arrowTipAngle: number;
  setArrowTipAngle: (angle: number) => void;
  nodeHorizontalSpacing: number;
  setNodeHorizontalSpacing: (spacing: number) => void;
  nodeVerticalSpacing: number;
  setNodeVerticalSpacing: (spacing: number) => void;
  pasteAsPlainText: boolean;
  setPasteAsPlainText: (val: boolean) => void;
  showNodeActions: boolean;
  setShowNodeActions: (val: boolean) => void;
  showStats: boolean;
  setShowStats: (val: boolean) => void;
  showLastSavedTime: boolean;
  setShowLastSavedTime: (val: boolean) => void;
  showHeaderActionLabels: boolean;
  setShowHeaderActionLabels: (val: boolean) => void;
  showSideToolbarLabels: boolean;
  setShowSideToolbarLabels: (val: boolean) => void;
  saveAssistantConversations: boolean;
  setSaveAssistantConversations: (val: boolean) => void;
  allowAssistantImageGeneration: boolean;
  setAllowAssistantImageGeneration: (val: boolean) => void;
  skipAssistantAgentAnimation: boolean;
  setSkipAssistantAgentAnimation: (val: boolean) => void;
  assistantMemorySkillEnabled: boolean;
  setAssistantMemorySkillEnabled: (val: boolean) => void;
  assistantMemoryNotes: string[];
  onDownloadAssistantMemory: () => void;
  showMiniMap: boolean;
  setShowMiniMap: (val: boolean) => void;
  miniMapPosition: 'left' | 'right';
  setMiniMapPosition: (position: 'left' | 'right') => void;
  showControls: boolean;
  setShowControls: (val: boolean) => void;
  showHoverButtonAnimations: boolean;
  setShowHoverButtonAnimations: (val: boolean) => void;
  ttsNarrationMode: TtsNarrationMode;
  setTtsNarrationMode: (mode: TtsNarrationMode) => void;
  savedAIProfiles: SavedAIProfile[];
  activeTextProfileId: string | null;
  activeImageProfileId: string | null;
  activeBackgroundRemovalProfileId: string | null;
  activeVoiceProfileId: string | null;
  settingsAttentionTarget?: AIProfileKind | null;
  onAcknowledgeSettingsAttention?: () => void;
  projectSummaries: LocalProjectSummary[];
  currentProjectId: string | null;
  onCreateAIProfile: (
    kind: AIProfileKind,
    initialProfile?: AIProfileSeed,
  ) => void | string | Promise<void | string>;
  onUpdateAIProfile: (profileId: string, updates: AIProfileUpdates) => void | Promise<void>;
  onSelectAIProfile: (kind: AIProfileKind, profileId: string) => void | Promise<void>;
  onDeleteAIProfile: (profileId: string) => void | Promise<void>;
  generateLength: string;
  setGenerateLength: (len: string) => void;
  hideStoryImageButtonWithTags: boolean;
  setHideStoryImageButtonWithTags: (hidden: boolean) => void;
  sceneImageMode: SceneImageMode;
  setSceneImageMode: (mode: SceneImageMode) => void;
  plotStructureGenerateDirection: PlotStructureGenerateDirection;
  setPlotStructureGenerateDirection: (direction: PlotStructureGenerateDirection) => void;
  aiGenerationBalance: AIGenerationBalance;
  setAiGenerationBalance: (balance: AIGenerationBalance) => void;
  customAiPromptsEnabled: boolean;
  setCustomAiPromptsEnabled: (enabled: boolean) => void;
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
  playTestAutoAdvance: boolean;
  setPlayTestAutoAdvance: (val: boolean) => void;
  playTestAutoAdvanceDelay: number;
  setPlayTestAutoAdvanceDelay: (val: number) => void;
  playTestHideCharacterTags: boolean;
  setPlayTestHideCharacterTags: (val: boolean) => void;
  playTestHideSceneTags: boolean;
  setPlayTestHideSceneTags: (val: boolean) => void;
  playtestCanvasSettings: SharedCanvasSettings;
  onPlaytestCanvasSettingsChange: (patch: Partial<SharedCanvasSettings>) => void;
  windowedPlaytestRaised: boolean;
  onToggleWindowedPlaytest: () => void;
  renderStyle: RenderStyle;
  updateRenderStyle: <K extends keyof RenderStyle>(key: K, value: RenderStyle[K]) => void;
  onApplySettingsToOtherProjects?: (targetProjectIds: string[]) => void | Promise<void>;
}

const localeByLanguage: Record<Language, string> = {
  zh: 'zh-CN',
  en: 'en-US',
  ja: 'ja-JP',
};

const formatProjectUpdatedAt = (timestamp: number, language: Language) =>
  new Date(timestamp).toLocaleString(localeByLanguage[language], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const buildArrowPath = (size: number, angle: number) => {
  const center = size / 2;
  const halfAngle = (angle * Math.PI) / 360;
  const lengthByHeight = (size * 0.46) / Math.tan(halfAngle);
  const arrowLength = Math.max(2, Math.min(size * 0.86, lengthByHeight));
  const halfBase = Math.min(size * 0.46, arrowLength * Math.tan(halfAngle));
  const baseX = size - arrowLength;
  return `M ${baseX} ${center - halfBase} L ${size} ${center} L ${baseX} ${center + halfBase} Z`;
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  showSettings,
  setShowSettings,
  missingTextApiKey,
  language,
  setLanguage,
  theme,
  setTheme,
  closeButtonBehavior,
  setCloseButtonBehavior,
  bubbleStyle,
  setBubbleStyle,
  opaqueAssistantMessagesInGlass,
  setOpaqueAssistantMessagesInGlass,
  opaqueFooterInGlass,
  setOpaqueFooterInGlass,
  accentColor,
  setAccentColor,
  effectiveAccentColor,
  canvasBg,
  setCanvasBg,
  presetColors,
  setPresetColors,
  showPresetColors,
  setShowPresetColors,
  storyTitlePlacement,
  setStoryTitlePlacement,
  toolbarLayout,
  setToolbarLayout,
  cardToolbarScale,
  setCardToolbarScale,
  edgeStyle,
  setEdgeStyle,
  edgeColor,
  setEdgeColor,
  arrowSize,
  setArrowSize,
  arrowCornerRadius,
  setArrowCornerRadius,
  arrowTipAngle,
  setArrowTipAngle,
  nodeHorizontalSpacing,
  setNodeHorizontalSpacing,
  nodeVerticalSpacing,
  setNodeVerticalSpacing,
  pasteAsPlainText,
  setPasteAsPlainText,
  showNodeActions,
  setShowNodeActions,
  showStats,
  setShowStats,
  showLastSavedTime,
  setShowLastSavedTime,
  showHeaderActionLabels,
  setShowHeaderActionLabels,
  showSideToolbarLabels,
  setShowSideToolbarLabels,
  saveAssistantConversations,
  setSaveAssistantConversations,
  allowAssistantImageGeneration,
  setAllowAssistantImageGeneration,
  skipAssistantAgentAnimation,
  setSkipAssistantAgentAnimation,
  assistantMemorySkillEnabled,
  setAssistantMemorySkillEnabled,
  assistantMemoryNotes,
  onDownloadAssistantMemory,
  showMiniMap,
  setShowMiniMap,
  miniMapPosition,
  setMiniMapPosition,
  showControls,
  setShowControls,
  showHoverButtonAnimations,
  setShowHoverButtonAnimations,
  ttsNarrationMode,
  setTtsNarrationMode,
  savedAIProfiles,
  activeTextProfileId,
  activeImageProfileId,
  activeBackgroundRemovalProfileId,
  activeVoiceProfileId,
  settingsAttentionTarget,
  onAcknowledgeSettingsAttention,
  projectSummaries,
  currentProjectId,
  onCreateAIProfile,
  onUpdateAIProfile,
  onSelectAIProfile,
  onDeleteAIProfile,
  generateLength: _generateLength,
  setGenerateLength: _setGenerateLength,
  hideStoryImageButtonWithTags,
  setHideStoryImageButtonWithTags,
  sceneImageMode,
  setSceneImageMode,
  plotStructureGenerateDirection,
  setPlotStructureGenerateDirection,
  aiGenerationBalance,
  setAiGenerationBalance,
  customAiPromptsEnabled,
  setCustomAiPromptsEnabled,
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
  playTestAutoAdvance,
  setPlayTestAutoAdvance,
  playTestAutoAdvanceDelay,
  setPlayTestAutoAdvanceDelay,
  playTestHideCharacterTags,
  setPlayTestHideCharacterTags,
  playTestHideSceneTags,
  setPlayTestHideSceneTags,
  playtestCanvasSettings,
  onPlaytestCanvasSettingsChange,
  windowedPlaytestRaised,
  onToggleWindowedPlaytest,
  renderStyle,
  updateRenderStyle,
  onApplySettingsToOtherProjects,
}) => {
  const [activeSettingsTab, setActiveSettingsTab] = useState<
    'appearance' | 'editor' | 'playtest' | 'ai' | 'about'
  >('appearance');
  const [aboutPage, setAboutPage] = useState<'contact' | 'help'>('contact');
  const [isApplyingSettings, setIsApplyingSettings] = useState(false);
  const [showApplySettingsConfirm, setShowApplySettingsConfirm] = useState(false);
  const [selectedApplyProjectIds, setSelectedApplyProjectIds] = useState<string[]>([]);
  const [editingAccentHex, setEditingAccentHex] = useState(false);
  const [accentHexDraft, setAccentHexDraft] = useState('');
  const [editingEdgeHex, setEditingEdgeHex] = useState(false);
  const [edgeHexDraft, setEdgeHexDraft] = useState('');
  React.useEffect(() => {
    if (showSettings && settingsAttentionTarget) {
      setActiveSettingsTab('ai');
    }
  }, [showSettings, settingsAttentionTarget]);
  const forceQuitApp = async () => {
    try {
      const invoke = await getTauriInvoke();
      await invoke('force_quit_app');
      return;
    } catch (error) {
      console.error('Force quit failed:', error);
    }
    window.close();
  };
  const s = settingsModalCopy(language);
  const isDesktopApp = isTauriRuntime();
  const plotDirectionOptions = [
    { id: 'up' as const, label: s.directionUp, icon: ArrowUp },
    { id: 'down' as const, label: s.directionDown, icon: ArrowDown },
    { id: 'left' as const, label: s.directionLeft, icon: ArrowLeft },
    { id: 'right' as const, label: s.directionRight, icon: ArrowRight },
  ];
  const selectedPlotDirection =
    plotDirectionOptions.find((item) => item.id === plotStructureGenerateDirection) ??
    plotDirectionOptions[1];
  // StoryNode renders this toolbar at `zoom * 0.6 * cardToolbarScale`.
  // The preview stage enlarges both the 300px card and toolbar by 1.2x so the
  // relationship stays true to the canvas while remaining readable here.
  const toolbarPreviewDisplayScale = 1.2;
  const previewToolbarScale = cardToolbarScale * 0.6 * toolbarPreviewDisplayScale;
  const cardToolbarScalePercent = ((cardToolbarScale - 0.5) / 2.5) * 100;
  const applyProjectCountLabel = s.applyProjectCount(selectedApplyProjectIds.length);
  const compactSegmentButtonClass = (active: boolean) =>
    `web-segment-button min-w-0 flex-1 truncate rounded-md px-2 py-2.5 text-xs font-bold transition-all ${
      active
        ? 'bg-[var(--card-bg)] text-[var(--accent)] shadow-sm ring-1 ring-[var(--card-border)]'
        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
    }`;
  const compactTextButtonClass = (active: boolean) =>
    `min-w-0 flex-1 truncate rounded-md px-2 py-2.5 text-xs font-bold transition-all ${
      active
        ? 'bg-[var(--card-bg)] text-[var(--accent)] shadow-sm ring-1 ring-[var(--card-border)]'
        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
    }`;
  const optionCardButtonClass = (active: boolean) =>
    `rounded-lg px-3 py-3 text-left transition-all ${
      active
        ? 'bg-[var(--card-bg)] text-[var(--accent)] shadow-sm ring-1 ring-[var(--card-border)]'
        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
    }`;
  const settingsRowClass = 'flex min-w-0 items-center gap-4';
  const settingsRowTitleClass =
    'w-36 shrink-0 whitespace-nowrap text-sm font-black text-[var(--text-primary)]';
  const renderAssistantHintButton = (
    key: 'agentAnimation' | 'memorySkill',
    label: string,
    description: string,
  ) => (
    <FloatingHint
      key={key}
      label={<h3 className="text-sm font-black text-[var(--text-primary)]">{label}</h3>}
      description={description}
    />
  );
  const renderSettingHint = (label: React.ReactNode, description: string, className = '') => (
    <FloatingHint label={label} description={description} className={className} />
  );
  const accentColorDescription = s.accentColorDescription;
  const isHexColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value.trim());
  const normalizeHexDraft = (value: string) => {
    const trimmed = value.trim();
    return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  };
  const segmentedControlClass =
    'flex min-w-0 flex-1 bg-[var(--app-bg)]/50 p-1 rounded-lg border border-[var(--header-border)]';
  const playtestRuntimeSettings = createPlaytestRuntimeSettings({
    choicesColumns: playTestChoicesColumns,
    interactionMode: playTestInteractionMode,
    typewriterSpeed: playTestTypewriterSpeed,
    choiceDelay: playTestChoiceDelay,
    blurBackground: playTestBlurBackground,
    blurText: playTestBlurText,
    autoAdvanceDelay: playTestAutoAdvanceDelay,
  });
  const updatePlaytestRuntimeSettings = (patch: Partial<PlaytestRuntimeSettings>) => {
    applyPlaytestRuntimeSettingsPatch(patch, {
      setChoicesColumns: setPlayTestChoicesColumns,
      setInteractionMode: setPlayTestInteractionMode,
      setTypewriterSpeed: setPlayTestTypewriterSpeed,
      setChoiceDelay: setPlayTestChoiceDelay,
      setBlurBackground: setPlayTestBlurBackground,
      setBlurText: setPlayTestBlurText,
      setAutoAdvanceDelay: setPlayTestAutoAdvanceDelay,
    });
  };
  const applyTargetProjects = projectSummaries.filter((project) => project.id !== currentProjectId);
  const allApplyTargetsSelected =
    applyTargetProjects.length > 0 &&
    applyTargetProjects.every((project) => selectedApplyProjectIds.includes(project.id));
  const openApplySettingsSelector = () => {
    setSelectedApplyProjectIds(applyTargetProjects.map((project) => project.id));
    setShowApplySettingsConfirm(true);
  };
  const toggleApplyProject = (projectId: string) => {
    setSelectedApplyProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((selectedId) => selectedId !== projectId)
        : [...current, projectId],
    );
  };
  const toggleAllApplyProjects = () => {
    setSelectedApplyProjectIds(
      allApplyTargetsSelected ? [] : applyTargetProjects.map((project) => project.id),
    );
  };
  const handleApplySettingsToOtherProjects = async () => {
    if (!onApplySettingsToOtherProjects || isApplyingSettings) return;

    setShowApplySettingsConfirm(false);
    setIsApplyingSettings(true);
    try {
      await onApplySettingsToOtherProjects(selectedApplyProjectIds);
    } finally {
      setIsApplyingSettings(false);
    }
  };

  if (!showSettings) return null;

  return (
    <>
      <div
        className={`settings-modal-overlay fixed inset-0 bg-slate-900/40 dark:bg-black/60 z-[300] flex items-center justify-center backdrop-blur-[2px] p-4 animate-in fade-in duration-200 ${theme === 'dark' ? 'dark' : ''}`}
      >
        <div className="settings-modal-shell bg-[var(--panel-bg)] backdrop-blur-[0px] rounded-2xl shadow-2xl w-full max-w-4xl h-[720px] max-h-[90vh] flex flex-col overflow-hidden border border-[var(--header-border)] animate-in zoom-in-95 duration-300">
          <div className="settings-modal-header h-12 shrink-0 px-4 border-b border-[var(--header-border)] bg-[var(--app-bg)]/30 flex items-center gap-3">
            <h2 className="flex-1 text-base font-black text-slate-800 dark:text-slate-100 tracking-tight">
              {s.settings}
            </h2>
            <button
              type="button"
              onClick={openApplySettingsSelector}
              disabled={!onApplySettingsToOtherProjects || isApplyingSettings}
              className="inline-flex h-8 items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 text-xs font-black text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)] hover:border-[var(--accent)]/30 disabled:cursor-not-allowed disabled:opacity-60"
              title={s.applyCurrentSettingsTitle}
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>{isApplyingSettings ? s.applying : s.applyToOtherProjects}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] hover:border-[var(--accent)]/30"
              title={s.closeSettings}
              aria-label={s.closeSettings}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* Sidebar Navigation */}
            <div className="settings-modal-sidebar w-52 bg-[var(--app-bg)]/30 border-r border-[var(--header-border)] flex flex-col p-5 shrink-0">
              <div className="settings-modal-tabs flex-1 space-y-1.5">
                {[
                  { id: 'appearance', label: s.theme, icon: <ImageIcon className="w-4 h-4" /> },
                  {
                    id: 'editor',
                    label: s.editorTab,
                    icon: <Layers className="w-4 h-4" />,
                  },
                  {
                    id: 'playtest',
                    label: s.playtestTab,
                    icon: <PlayCircle className="w-4 h-4" />,
                  },
                  { id: 'ai', label: s.aiSettings, icon: <BrainCircuit className="w-4 h-4" /> },
                  {
                    id: 'about',
                    label: s.aboutTab,
                    icon: <MessageCircle className="w-4 h-4" />,
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSettingsTab(tab.id as any)}
                    className={`settings-modal-tab relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                      activeSettingsTab === tab.id
                        ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] scale-[1.02] border border-[var(--card-border)]'
                        : tab.id === 'ai' && settingsAttentionTarget
                          ? 'text-rose-600 bg-rose-500/10 ring-2 ring-rose-400/30'
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
                    {tab.id === 'ai' && (missingTextApiKey || settingsAttentionTarget) && (
                      <span className="absolute right-3.5 top-3 h-2 w-2 rounded-full bg-rose-500 shadow-sm" />
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowSettings(false)}
                className="w-full py-3 bg-slate-900 dark:bg-white hover:bg-black dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-sm font-black shadow-xl dark:shadow-none transition-all active:scale-95"
              >
                {s.finish}
              </button>
            </div>

            {/* Main Content Area */}
            <div
              className={`settings-modal-content min-w-0 flex-1 flex flex-col h-full bg-transparent overflow-x-hidden overflow-y-auto custom-scrollbar ${activeSettingsTab === 'playtest' ? 'p-5' : 'p-8 pt-7'}`}
            >
              {activeSettingsTab === 'appearance' && (
                <div className="min-w-0 space-y-5 animate-in slide-in-from-right-4 duration-500">
                  <section>
                    <header className="hidden">
                      <h3 className="text-base font-black text-[var(--text-primary)]">
                        {s.themeLanguage}
                      </h3>
                    </header>
                    <div className="grid grid-cols-1 gap-3">
                      <div className={settingsRowClass}>
                        <h3 className={settingsRowTitleClass}>{s.theme}</h3>
                        <div className={segmentedControlClass}>
                          <button
                            onClick={() => {
                              setTheme('system');
                            }}
                            className={`${!isDesktopApp ? 'hidden' : ''} ${compactTextButtonClass(theme === 'system')}`}
                          >
                            {s.systemTheme}
                          </button>
                          <button
                            onClick={() => {
                              setTheme('light');
                              if (canvasBg === presetColors[1]) setCanvasBg(presetColors[0]);
                            }}
                            className={compactTextButtonClass(
                              theme === 'light' || (!isDesktopApp && theme === 'system'),
                            )}
                          >
                            {s.lightMode}
                          </button>
                          <button
                            onClick={() => {
                              setTheme('dark');
                              if (canvasBg === presetColors[0]) setCanvasBg(presetColors[1]);
                            }}
                            className={compactTextButtonClass(theme === 'dark')}
                          >
                            {s.darkMode}
                          </button>
                        </div>
                      </div>
                      <div className={settingsRowClass}>
                        <h3 className={settingsRowTitleClass}>
                          {renderSettingHint(<span>{s.accentColor}</span>, accentColorDescription)}
                        </h3>
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <label className="relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border-4 border-white shadow-lg ring-1 ring-[var(--card-border)] dark:border-slate-700">
                            <input
                              type="color"
                              value={effectiveAccentColor}
                              onChange={(event) => setAccentColor(event.target.value)}
                              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            />
                            <span
                              className="block h-full w-full"
                              style={{ backgroundColor: effectiveAccentColor }}
                            />
                          </label>
                          <div className="min-w-0 flex-1">
                            {editingAccentHex ? (
                              <input
                                value={accentHexDraft}
                                onChange={(event) => setAccentHexDraft(event.target.value)}
                                onBlur={() => {
                                  const nextColor = normalizeHexDraft(accentHexDraft);
                                  if (isHexColor(nextColor)) setAccentColor(nextColor);
                                  setEditingAccentHex(false);
                                }}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    const nextColor = normalizeHexDraft(accentHexDraft);
                                    if (isHexColor(nextColor)) setAccentColor(nextColor);
                                    setEditingAccentHex(false);
                                  }
                                  if (event.key === 'Escape') {
                                    setEditingAccentHex(false);
                                  }
                                }}
                                autoFocus
                                className="h-7 w-28 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-2 text-xs font-mono font-bold uppercase text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                              />
                            ) : (
                              <button
                                type="button"
                                onDoubleClick={() => {
                                  setAccentHexDraft(accentColor || effectiveAccentColor);
                                  setEditingAccentHex(true);
                                }}
                                className="text-left text-xs font-mono font-bold uppercase text-[var(--text-primary)]"
                                title={s.doubleClickToEditColor}
                              >
                                {accentColor || effectiveAccentColor}
                              </button>
                            )}
                          </div>
                          <div className="ml-auto flex shrink-0 items-center gap-3 border-l border-[var(--header-border)] pl-4">
                            <div className="flex items-center gap-2.5">
                              <span className="whitespace-nowrap text-xs font-bold text-[var(--text-secondary)]">
                                {s.showHeaderActionLabels}
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowHeaderActionLabels(!showHeaderActionLabels)}
                                className={`relative h-5 w-10 rounded-full transition-all duration-300 ${showHeaderActionLabels ? 'bg-[var(--accent)] shadow-md' : 'border border-[var(--header-border)] bg-[var(--app-bg)]'}`}
                                aria-pressed={showHeaderActionLabels}
                                aria-label={s.showHeaderActionLabels}
                              >
                                <span
                                  className={`absolute top-1 h-3 w-3 rounded-full bg-white shadow-sm transition-all duration-300 ${showHeaderActionLabels ? 'left-6' : 'left-1'}`}
                                />
                              </button>
                            </div>
                            <div className="flex items-center gap-2.5 border-l border-[var(--header-border)] pl-3">
                              <span className="whitespace-nowrap text-xs font-bold text-[var(--text-secondary)]">
                                {s.showSideToolbarLabels}
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowSideToolbarLabels(!showSideToolbarLabels)}
                                className={`relative h-5 w-10 rounded-full transition-all duration-300 ${showSideToolbarLabels ? 'bg-[var(--accent)] shadow-md' : 'border border-[var(--header-border)] bg-[var(--app-bg)]'}`}
                                aria-pressed={showSideToolbarLabels}
                                aria-label={s.showSideToolbarLabels}
                              >
                                <span
                                  className={`absolute top-1 h-3 w-3 rounded-full bg-white shadow-sm transition-all duration-300 ${showSideToolbarLabels ? 'left-6' : 'left-1'}`}
                                />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className={` pt-3 ${settingsRowClass}`}>
                        <h3 className={settingsRowTitleClass}>{s.language}</h3>
                        <div className={segmentedControlClass}>
                          <button
                            onClick={() => setLanguage('zh')}
                            className={compactTextButtonClass(language === 'zh')}
                          >
                            {s.chinese}
                          </button>
                          <button
                            onClick={() => setLanguage('en')}
                            className={compactTextButtonClass(language === 'en')}
                          >
                            {s.english}
                          </button>
                          <button
                            onClick={() => setLanguage('ja')}
                            className={compactTextButtonClass(language === 'ja')}
                          >
                            {s.japanese}
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className={settingsRowClass}>
                    <h3 className={settingsRowTitleClass}>{s.rightToolbar}</h3>
                    <div className={segmentedControlClass}>
                      <button
                        onClick={() => setToolbarLayout('vertical')}
                        className={compactSegmentButtonClass(toolbarLayout === 'vertical')}
                      >
                        {s.vertical}
                      </button>
                      <button
                        onClick={() => setToolbarLayout('horizontal')}
                        className={compactSegmentButtonClass(toolbarLayout === 'horizontal')}
                      >
                        {s.horizontal}
                      </button>
                    </div>
                  </section>

                  <section className={settingsRowClass}>
                    <h3 className={settingsRowTitleClass}>{s.toolbarBubbleStyle}</h3>
                    <div className={segmentedControlClass}>
                      <button
                        onClick={() => setBubbleStyle('glass')}
                        className={compactSegmentButtonClass(bubbleStyle === 'glass')}
                      >
                        {s.glass}
                      </button>
                      <button
                        onClick={() => setBubbleStyle('flat')}
                        className={compactSegmentButtonClass(bubbleStyle === 'flat')}
                      >
                        {s.flat}
                      </button>
                    </div>
                  </section>

                  {bubbleStyle === 'glass' && (
                    <section className="space-y-2">
                      <div className="grid grid-cols-2 gap-x-8 gap-y-0">
                        {[
                          {
                            id: 'opaqueAssistantMessagesInGlass',
                            label: s.opaqueAssistantMessagesInGlass,
                            value: opaqueAssistantMessagesInGlass,
                            setter: setOpaqueAssistantMessagesInGlass,
                          },
                          {
                            id: 'opaqueFooterInGlass',
                            label: s.opaqueFooterInGlass,
                            value: opaqueFooterInGlass,
                            setter: setOpaqueFooterInGlass,
                          },
                        ].map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between py-2.5 border-b border-[var(--header-border)] last:border-0 group"
                          >
                            <span className="text-sm font-bold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                              {item.label}
                            </span>
                            <button
                              type="button"
                              onClick={() => item.setter(!item.value)}
                              className={`w-10 h-5 rounded-full transition-all duration-300 relative ${item.value ? 'bg-[var(--accent)] shadow-md' : 'bg-[var(--app-bg)] border border-[var(--header-border)]'}`}
                              aria-pressed={item.value}
                              aria-label={item.label}
                            >
                              <div
                                className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm ${item.value ? 'left-6' : 'left-1'}`}
                              />
                            </button>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  <section className="grid grid-cols-2 gap-x-8 gap-y-0">
                    {[
                      {
                        id: 'showStats',
                        label: s.showStats,
                        value: showStats,
                        setter: setShowStats,
                      },
                      {
                        id: 'showLastSavedTime',
                        label: s.showLastSavedTime,
                        value: showLastSavedTime,
                        setter: setShowLastSavedTime,
                      },
                      {
                        id: 'saveAssistantConversations',
                        label: s.saveAssistantConversations,
                        value: saveAssistantConversations,
                        setter: setSaveAssistantConversations,
                      },
                      {
                        id: 'showMiniMap',
                        label: s.showMiniMap,
                        value: showMiniMap,
                        setter: setShowMiniMap,
                      },
                    ].map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between py-2.5 border-b border-[var(--header-border)] last:border-0 group"
                      >
                        <span className="text-sm font-bold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                          {item.label}
                        </span>
                        <button
                          onClick={() => item.setter(!item.value)}
                          className={`w-10 h-5 rounded-full transition-all duration-300 relative ${item.value ? 'bg-[var(--accent)] shadow-md' : 'bg-[var(--app-bg)] border border-[var(--header-border)]'}`}
                        >
                          <div
                            className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm ${item.value ? 'left-6' : 'left-1'}`}
                          />
                        </button>
                      </div>
                    ))}
                  </section>

                  {showMiniMap && (
                    <section className={settingsRowClass}>
                      <h3 className={settingsRowTitleClass}>{s.miniMapPosition}</h3>
                      <div className={segmentedControlClass}>
                        <button
                          onClick={() => setMiniMapPosition('left')}
                          className={compactSegmentButtonClass(miniMapPosition === 'left')}
                        >
                          <span className="flex items-center justify-center gap-1.5">
                            <ArrowLeft className="w-3.5 h-3.5" />
                            {s.miniMapLeft}
                          </span>
                        </button>
                        <button
                          onClick={() => setMiniMapPosition('right')}
                          className={compactSegmentButtonClass(miniMapPosition === 'right')}
                        >
                          <span className="flex items-center justify-center gap-1.5">
                            {s.miniMapRight}
                            <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                        </button>
                      </div>
                    </section>
                  )}

                  <section className={settingsRowClass}>
                    <h3 className={settingsRowTitleClass}>{s.showControls}</h3>
                    <div className={segmentedControlClass}>
                      <button
                        onClick={() => setShowControls(true)}
                        className={compactSegmentButtonClass(showControls)}
                      >
                        {s.show}
                      </button>
                      <button
                        onClick={() => setShowControls(false)}
                        className={compactSegmentButtonClass(!showControls)}
                      >
                        {s.hide}
                      </button>
                    </div>
                  </section>

                  <div className="border-t border-[var(--header-border)]" />

                  <section className="space-y-5">
                    <header className="flex items-center justify-between gap-3 mb-2">
                      <h3 className="text-base font-black text-[var(--text-primary)]">
                        {renderSettingHint(<span>{s.bgColors}</span>, s.bgColorsDesc)}
                      </h3>
                      <button
                        type="button"
                        onClick={() => setShowPresetColors(!showPresetColors)}
                        className={`w-10 h-5 overflow-hidden rounded-full transition-all duration-300 relative text-[0px] ${showPresetColors ? 'bg-[var(--accent)] shadow-md' : 'bg-[var(--app-bg)] border border-[var(--header-border)]'}`}
                      >
                        <div
                          className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm ${showPresetColors ? 'left-6' : 'left-1'}`}
                        />
                        {showPresetColors ? s.shownInToolbar : s.hiddenInToolbar}
                      </button>
                    </header>
                    {!isDesktopApp && (
                      <p className="text-xs text-[var(--text-muted)] font-medium px-4">
                        {s.bgColorsDesc}
                      </p>
                    )}
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

                  <div className="border-t border-[var(--header-border)]" />

                  <section className={settingsRowClass}>
                    <div className="min-w-0 flex-1">
                      <h3 className={settingsRowTitleClass}>
                        {renderSettingHint(
                          <span>{s.hoverButtonAnimations}</span>,
                          s.hoverButtonAnimationsDesc,
                        )}
                      </h3>
                      {!isDesktopApp && (
                        <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
                          {s.hoverButtonAnimationsDesc}
                        </p>
                      )}
                    </div>
                    <div className={segmentedControlClass}>
                      <button
                        onClick={() => setShowHoverButtonAnimations(true)}
                        className={compactSegmentButtonClass(showHoverButtonAnimations)}
                      >
                        {s.on}
                      </button>
                      <button
                        onClick={() => setShowHoverButtonAnimations(false)}
                        className={compactSegmentButtonClass(!showHoverButtonAnimations)}
                      >
                        {s.off}
                      </button>
                    </div>
                  </section>
                </div>
              )}

              {activeSettingsTab === 'editor' && (
                <div className="space-y-5 animate-in slide-in-from-right-4 duration-500">
                  <section className={settingsRowClass}>
                    <h3 className={settingsRowTitleClass}>{s.edgeStyle}</h3>
                    <div className={segmentedControlClass}>
                      <button
                        onClick={() => setEdgeStyle('step')}
                        className={`flex-1 flex flex-col items-center gap-1.5 rounded-md py-3 transition-all duration-300 ${edgeStyle === 'step' ? 'bg-[var(--card-bg)] text-[var(--accent)] shadow-sm ring-1 ring-[var(--card-border)]' : 'text-[var(--text-muted)] opacity-70 hover:opacity-100'}`}
                      >
                        <div className="w-11 h-8 border-2 border-current rounded-md flex items-center justify-center">
                          <div className="relative w-8 h-5">
                            <div className="absolute top-0 left-0 w-2 h-2 rounded-full bg-current -translate-x-1 -translate-y-[3px]" />
                            <div className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-current translate-x-1 translate-y-[3px]" />
                            <div className="absolute top-0 left-0 w-[calc(50%+2px)] h-[2px] bg-current" />
                            <div className="absolute top-0 left-1/2 w-[2px] h-full bg-current" />
                            <div className="absolute bottom-0 left-1/2 w-1/2 h-[2px] bg-current" />
                          </div>
                        </div>
                        <span className="text-xs font-black tracking-widest uppercase">
                          {s.step}
                        </span>
                      </button>
                      <button
                        onClick={() => setEdgeStyle('bezier')}
                        className={`flex-1 flex flex-col items-center gap-1.5 rounded-md py-3 transition-all duration-300 ${edgeStyle === 'bezier' ? 'bg-[var(--card-bg)] text-[var(--accent)] shadow-sm ring-1 ring-[var(--card-border)]' : 'text-[var(--text-muted)] opacity-70 hover:opacity-100'}`}
                      >
                        <div className="w-11 h-8 border-2 border-current rounded-md flex items-center justify-center">
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
                        <span className="text-xs font-black tracking-widest uppercase">
                          {s.bezier}
                        </span>
                      </button>
                    </div>
                  </section>

                  <section className={settingsRowClass}>
                    <h3 className={settingsRowTitleClass}>{s.arrowStyle}</h3>
                    <div className="flex min-w-0 flex-1 items-center gap-5 rounded-xl border border-[var(--card-border)] bg-[var(--app-bg)]/35 p-4">
                      <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-5 gap-y-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-9 w-16 shrink-0 items-center">
                            <label className="relative h-9 w-9 cursor-pointer overflow-hidden rounded-lg border-4 border-white shadow-lg ring-1 ring-[var(--card-border)] dark:border-slate-700">
                              <input
                                type="color"
                                value={edgeColor}
                                onChange={(event) => setEdgeColor(event.target.value)}
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                aria-label={s.arrowLineColor}
                              />
                              <span
                                className="block h-full w-full"
                                style={{ backgroundColor: edgeColor }}
                              />
                            </label>
                          </span>
                          {editingEdgeHex ? (
                            <input
                              value={edgeHexDraft}
                              onChange={(event) => setEdgeHexDraft(event.target.value)}
                              onBlur={() => {
                                const nextColor = normalizeHexDraft(edgeHexDraft);
                                if (isHexColor(nextColor)) setEdgeColor(nextColor);
                                setEditingEdgeHex(false);
                              }}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  const nextColor = normalizeHexDraft(edgeHexDraft);
                                  if (isHexColor(nextColor)) setEdgeColor(nextColor);
                                  setEditingEdgeHex(false);
                                }
                                if (event.key === 'Escape') {
                                  setEditingEdgeHex(false);
                                }
                              }}
                              autoFocus
                              className="h-8 min-w-0 flex-1 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)] px-2 text-[11px] font-mono font-bold uppercase text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                            />
                          ) : (
                            <button
                              type="button"
                              onDoubleClick={() => {
                                setEdgeHexDraft(edgeColor);
                                setEditingEdgeHex(true);
                              }}
                              className="min-w-0 flex-1 truncate text-left text-[11px] font-mono font-bold uppercase text-[var(--text-primary)]"
                              title={s.doubleClickToEditColor}
                            >
                              {edgeColor}
                            </button>
                          )}
                        </div>
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="w-16 shrink-0 text-xs font-bold text-[var(--text-secondary)]">
                            {s.size}
                          </span>
                          <div className="min-w-0 flex-1">
                            <DraggableNumberInput
                              value={arrowSize}
                              onChange={setArrowSize}
                              min={12}
                              max={36}
                              step={1}
                              unit="PX"
                            />
                          </div>
                        </div>
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="w-16 shrink-0 text-xs font-bold text-[var(--text-secondary)]">
                            {s.radius}
                          </span>
                          <div className="min-w-0 flex-1">
                            <DraggableNumberInput
                              value={arrowCornerRadius}
                              onChange={setArrowCornerRadius}
                              min={0}
                              max={12}
                              step={1}
                              unit="PX"
                            />
                          </div>
                        </div>
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="w-16 shrink-0 text-xs font-bold text-[var(--text-secondary)]">
                            {s.angle}
                          </span>
                          <div className="min-w-0 flex-1">
                            <DraggableNumberInput
                              value={arrowTipAngle}
                              onChange={setArrowTipAngle}
                              min={20}
                              max={160}
                              step={1}
                              unit="DEG"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)]/70">
                        <svg
                          className="h-12 w-24 overflow-visible"
                          viewBox="0 0 96 48"
                          fill="none"
                          aria-hidden="true"
                        >
                          <defs>
                            <marker
                              id="settings-arrow-preview"
                              markerWidth={arrowSize}
                              markerHeight={arrowSize}
                              refX={arrowSize}
                              refY={arrowSize / 2}
                              orient="auto"
                              markerUnits="userSpaceOnUse"
                            >
                              <path
                                d={buildArrowPath(arrowSize, arrowTipAngle)}
                                fill={edgeColor}
                                stroke={edgeColor}
                                strokeLinejoin="round"
                                strokeLinecap="round"
                                strokeWidth={arrowCornerRadius}
                              />
                            </marker>
                          </defs>
                          <path
                            d="M 10 24 C 32 24, 48 24, 68 24"
                            stroke={edgeColor}
                            strokeWidth="3"
                            strokeLinecap="round"
                            markerEnd="url(#settings-arrow-preview)"
                          />
                        </svg>
                      </div>
                    </div>
                  </section>

                  <section className={settingsRowClass}>
                    <h3 className={settingsRowTitleClass}>卡片间距</h3>
                    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-[var(--card-border)] bg-[var(--app-bg)]/35 p-4">
                      <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-3">
                        <button
                          type="button"
                          onClick={() => setShowNodeActions(!showNodeActions)}
                          className={`col-span-2 flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${showNodeActions ? 'border-[var(--accent)]/35 bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--card-border)] text-[var(--text-muted)]'}`}
                        >
                          <span>显示卡片上下左右的 + 按钮</span>
                          <span
                            className={`relative h-6 w-11 shrink-0 overflow-hidden rounded-full transition-colors ${
                              showNodeActions
                                ? 'bg-[var(--accent)] shadow-md'
                                : 'bg-[var(--card-border)]'
                            }`}
                          >
                            <span
                              className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-[left] ${showNodeActions ? 'left-6' : 'left-1'}`}
                            />
                          </span>
                        </button>
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={`w-12 shrink-0 text-xs font-bold ${showNodeActions ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}`}
                          >
                            横向
                          </span>
                          <div className="min-w-0 flex-1">
                            <DraggableNumberInput
                              value={nodeHorizontalSpacing}
                              onChange={setNodeHorizontalSpacing}
                              min={40}
                              max={360}
                              step={5}
                              unit="PX"
                              disabled={!showNodeActions}
                            />
                          </div>
                        </div>
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={`w-12 shrink-0 text-xs font-bold ${showNodeActions ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}`}
                          >
                            纵向
                          </span>
                          <div className="min-w-0 flex-1">
                            <DraggableNumberInput
                              value={nodeVerticalSpacing}
                              onChange={setNodeVerticalSpacing}
                              min={40}
                              max={360}
                              step={5}
                              unit="PX"
                              disabled={!showNodeActions}
                            />
                          </div>
                        </div>
                      </div>
                      <div
                        className={`relative h-24 w-32 shrink-0 overflow-hidden rounded-lg border bg-[var(--app-bg)]/40 transition-opacity ${showNodeActions ? 'border-[var(--card-border)]' : 'border-[var(--card-border)] opacity-35 grayscale'}`}
                      >
                        <svg
                          className="absolute inset-0 h-full w-full overflow-visible"
                          viewBox="0 0 128 96"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path d="M 25 29 L 25 64" stroke="var(--accent)" strokeWidth="1.5" />
                          <path
                            d="M 38 76 C 55 76, 62 76, 82 76"
                            stroke="var(--accent)"
                            strokeWidth="1.5"
                          />
                        </svg>
                        <span className="absolute left-2 top-2 h-5 w-8 rounded border border-[var(--accent)]/55 bg-[var(--card-bg)]" />
                        <span className="absolute bottom-2 left-2 h-5 w-8 rounded border border-[var(--accent)]/55 bg-[var(--card-bg)]" />
                        <span className="absolute bottom-2 right-2 h-5 w-8 rounded border border-[var(--accent)]/55 bg-[var(--card-bg)]" />
                        <span className="absolute left-8 top-[39px] rounded bg-[var(--app-bg)] px-0.5 text-[8px] font-bold text-[var(--text-muted)]">
                          {nodeVerticalSpacing}px
                        </span>
                        <span className="absolute left-[49px] bottom-8 rounded bg-[var(--app-bg)] px-0.5 text-[8px] font-bold text-[var(--text-muted)]">
                          {nodeHorizontalSpacing}px
                        </span>
                      </div>
                    </div>
                  </section>

                  <section className={settingsRowClass}>
                    <h3 className={settingsRowTitleClass}>{s.storyTitlePosition}</h3>
                    <div className="grid flex-1 grid-cols-3 gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--app-bg)]/50 p-1.5">
                      {[
                        {
                          id: 'inside',
                          label: s.titleInside,
                        },
                        {
                          id: 'outside-left',
                          label: s.titleOutsideLeft,
                        },
                        {
                          id: 'outside-right',
                          label: s.titleOutsideRight,
                        },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setStoryTitlePlacement(item.id as StoryTitlePlacement)}
                          className={`flex min-w-0 flex-col items-center gap-2 rounded-lg px-2 py-2.5 transition-all ${
                            storyTitlePlacement === item.id
                              ? 'bg-[var(--card-bg)] text-[var(--accent)] shadow-sm ring-1 ring-[var(--card-border)]'
                              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          <svg
                            viewBox="0 0 88 64"
                            className="h-12 w-full max-w-24 overflow-visible"
                            fill="none"
                            aria-hidden="true"
                          >
                            <rect
                              x="13"
                              y="17"
                              width="62"
                              height="42"
                              rx="6"
                              fill="currentColor"
                              fillOpacity="0.08"
                              stroke="currentColor"
                              strokeWidth="2"
                            />
                            <path
                              d="M24 38H64M24 45H56M24 52H48"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              opacity="0.45"
                            />
                            {item.id === 'inside' && (
                              <path
                                d="M24 27H52"
                                stroke="currentColor"
                                strokeWidth="4"
                                strokeLinecap="round"
                              />
                            )}
                            {item.id === 'outside-left' && (
                              <>
                                <path
                                  d="M13 8H41"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  strokeLinecap="round"
                                />
                                <path
                                  d="M13 12V17"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  opacity="0.55"
                                />
                              </>
                            )}
                            {item.id === 'outside-right' && (
                              <>
                                <path
                                  d="M47 8H75"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                  strokeLinecap="round"
                                />
                                <path
                                  d="M75 12V17"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  opacity="0.55"
                                />
                              </>
                            )}
                          </svg>
                          <span className="text-center text-[11px] font-black leading-4">
                            {item.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="min-w-0 space-y-4">
                    <div className={settingsRowClass}>
                      <h3 className={settingsRowTitleClass}>
                        {renderSettingHint(
                          <span>{s.cardToolbarScale}</span>,
                          s.cardToolbarScaleDesc,
                        )}
                      </h3>

                      <div className="min-w-0 flex-1 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-5 py-4 shadow-sm">
                        <div className="mb-4 flex items-center justify-between text-[10px] font-black tracking-wide text-[var(--text-muted)]">
                          <span>0.50×</span>
                          <span className="rounded-lg bg-[var(--accent)]/10 px-2.5 py-1 font-mono text-xs text-[var(--accent)]">
                            {cardToolbarScale.toFixed(2)}×
                          </span>
                          <span>3.00×</span>
                        </div>
                        <div className="relative h-5">
                          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-[var(--card-border)]/70">
                            <span
                              className="block h-full rounded-full bg-[var(--accent)] transition-[width] duration-150"
                              style={{ width: `${cardToolbarScalePercent}%` }}
                            />
                          </div>
                          {[0, 20, 40, 60, 80, 100].map((tick) => (
                            <span
                              key={tick}
                              className="pointer-events-none absolute top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--card-bg)]/90"
                              style={{ left: `${tick}%` }}
                            />
                          ))}
                          <span
                            className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-[var(--card-bg)] bg-[var(--accent)] shadow-md transition-[left] duration-150"
                            style={{ left: `${cardToolbarScalePercent}%` }}
                          />
                          <input
                            type="range"
                            min={0.5}
                            max={3}
                            step={0.05}
                            value={cardToolbarScale}
                            onChange={(event) =>
                              setCardToolbarScale(parseFloat(event.target.value))
                            }
                            aria-label={s.cardToolbarScale}
                            className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="relative h-[360px] w-full overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--app-bg)]/30 shadow-sm">
                      <span className="absolute left-3 top-3 rounded-md border border-[var(--card-border)] bg-[var(--card-bg)]/90 px-2 py-1 text-[10px] font-black text-[var(--text-muted)] shadow-sm">
                        {s.actualPreview}
                      </span>

                      <div className="absolute left-1/2 top-32 z-10 w-[360px] max-w-[calc(100%-48px)] -translate-x-1/2">
                        <div className="relative aspect-[5/3] rounded-2xl border-2 border-blue-500 bg-[var(--card-bg)] px-5 py-4 shadow-lg">
                          <span className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full border-2 border-blue-500 bg-[var(--card-bg)]" />
                          <span className="absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full border-2 border-blue-500 bg-[var(--card-bg)]" />
                          <span className="absolute -bottom-1.5 -left-1.5 h-3 w-3 rounded-full border-2 border-blue-500 bg-[var(--card-bg)]" />
                          <span className="absolute -bottom-1.5 -right-1.5 h-3 w-3 rounded-full border-2 border-blue-500 bg-[var(--card-bg)]" />
                          <span className="absolute -left-3 -top-6 flex items-center gap-1 rounded-md bg-emerald-500 px-2 py-1 text-[10px] font-black text-white shadow">
                            <Play className="h-3 w-3 fill-current" />
                            {s.previewStoryTitle}
                          </span>
                          <div className="text-center text-xs font-black text-[var(--text-primary)]">
                            {s.previewStoryTitle}
                          </div>
                          <p className="mt-5 text-sm font-medium text-[var(--text-primary)]">
                            {s.previewStoryBody}
                          </p>
                        </div>
                      </div>

                      <div className="contents">
                        <div className="absolute left-1/2 top-6 z-30 w-max -translate-x-1/2">
                          <div
                            className="flex w-[572px] origin-bottom flex-col gap-1.5 rounded-xl border border-[var(--toolbar-border)] bg-[var(--toolbar-bg)] p-2 text-[var(--text-secondary)] shadow-2xl backdrop-blur-md transition-transform duration-200"
                            style={{ transform: `scale(${previewToolbarScale})` }}
                          >
                            <div className="flex items-center justify-between gap-0 px-1">
                              {['#ffffff', '#fe8a25', '#e64881', '#fd5c5c', '#1ec8cf'].map(
                                (color) => (
                                  <button
                                    key={color}
                                    type="button"
                                    tabIndex={-1}
                                    className="h-5 w-5 shrink-0 rounded-full border border-[var(--toolbar-border)]"
                                    style={{ backgroundColor: color }}
                                  />
                                ),
                              )}
                              <button
                                type="button"
                                tabIndex={-1}
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
                                style={{
                                  background:
                                    'linear-gradient(45deg, rgb(240, 147, 251), rgb(245, 87, 108))',
                                }}
                              >
                                <Palette className="h-3 w-3" />
                              </button>
                              <span className="mx-0.5 h-4 w-px shrink-0 bg-[var(--toolbar-border)]/50" />
                              {[Square, RectangleHorizontal, Diamond, Triangle, Hexagon].map(
                                (Icon, index) => (
                                  <button
                                    type="button"
                                    tabIndex={-1}
                                    key={index}
                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${index === 1 ? 'text-blue-400' : 'text-[var(--text-primary)]/80'}`}
                                  >
                                    <Icon className="h-4 w-4 fill-current" />
                                  </button>
                                ),
                              )}
                              <span className="mx-0.5 h-4 w-px shrink-0 bg-[var(--toolbar-border)]/50" />
                              {[Bold, Italic, Underline].map((Icon, index) => (
                                <button
                                  type="button"
                                  tabIndex={-1}
                                  key={index}
                                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                                >
                                  <Icon className="h-4 w-4" />
                                </button>
                              ))}
                              <span className="mx-0.5 h-4 w-px shrink-0 bg-[var(--toolbar-border)]/50" />
                              <button
                                type="button"
                                tabIndex={-1}
                                className="flex h-7 w-7 items-center justify-center text-rose-500"
                              >
                                <Mic className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                tabIndex={-1}
                                className="flex h-7 w-7 items-center justify-center text-sky-600"
                              >
                                <Volume2 className="h-4 w-4" />
                              </button>
                            </div>
                            <div className="h-px w-full bg-[var(--toolbar-border)]/30" />
                            <div className="flex items-center gap-1.5 px-1">
                              <span className="rounded-md bg-emerald-500/20 px-2 py-1 text-xs font-bold text-emerald-500">
                                {s.previewStoryTitle}
                              </span>
                              <span className="mx-0.5 h-4 w-px shrink-0 bg-[var(--toolbar-border)]/50" />
                              <span className="shrink-0 text-[10px] font-black uppercase text-[var(--text-muted)]">
                                {s.valueLabel}
                              </span>
                              <button
                                type="button"
                                tabIndex={-1}
                                className="rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)] p-1.5"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="h-1.5 min-w-[110px] flex-1 rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)]" />
                              <button
                                type="button"
                                tabIndex={-1}
                                className="rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)] p-1.5"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                              <span className="w-14 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-2 py-1.5 text-center text-sm font-bold shadow-sm">
                                0
                              </span>
                              <span className="mx-0.5 h-4 w-px shrink-0 bg-[var(--toolbar-border)]/50" />
                              {[GitFork, StepForward, EyeOff, Maximize, Trash2].map(
                                (Icon, index) => (
                                  <button
                                    type="button"
                                    tabIndex={-1}
                                    key={index}
                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${index === 3 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15' : index === 4 ? 'text-red-400' : ''}`}
                                  >
                                    <Icon className="h-3.5 w-3.5" />
                                  </button>
                                ),
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className={settingsRowClass}>
                    <h3 className={settingsRowTitleClass}>
                      {renderSettingHint(
                        <span>{s.plotStructureDirection}</span>,
                        s.plotStructureDirectionDesc,
                      )}
                    </h3>

                    <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-sm">
                      <div className="relative h-[300px] overflow-hidden bg-[var(--app-bg)]/30">
                        <div className="absolute left-1/2 top-1/2 h-[500px] w-[640px] origin-center -translate-x-1/2 -translate-y-1/2 scale-50">
                          <div
                            className={`absolute z-10 h-[150px] rounded-3xl border-4 border-blue-500 bg-[var(--card-bg)] shadow-xl ${
                              plotStructureGenerateDirection === 'down'
                                ? 'left-1/2 top-10 w-[300px] -translate-x-1/2'
                                : plotStructureGenerateDirection === 'up'
                                  ? 'bottom-10 left-1/2 w-[300px] -translate-x-1/2'
                                  : plotStructureGenerateDirection === 'left'
                                    ? 'right-20 top-1/2 w-[160px] -translate-y-1/2'
                                    : 'left-20 top-1/2 w-[160px] -translate-y-1/2'
                            }`}
                          >
                            <span className="absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full border-[3px] border-blue-500 bg-[var(--card-bg)]" />
                            <span className="absolute -right-2.5 -top-2.5 h-5 w-5 rounded-full border-[3px] border-blue-500 bg-[var(--card-bg)]" />
                            <span className="absolute -bottom-2.5 -left-2.5 h-5 w-5 rounded-full border-[3px] border-blue-500 bg-[var(--card-bg)]" />
                            <span className="absolute -bottom-2.5 -right-2.5 h-5 w-5 rounded-full border-[3px] border-blue-500 bg-[var(--card-bg)]" />
                          </div>

                          <div
                            className={`absolute z-20 flex items-center justify-center text-indigo-500 ${
                              plotStructureGenerateDirection === 'down'
                                ? 'left-1/2 top-[210px] h-20 -translate-x-1/2'
                                : plotStructureGenerateDirection === 'up'
                                  ? 'bottom-[210px] left-1/2 h-20 -translate-x-1/2'
                                  : plotStructureGenerateDirection === 'left'
                                    ? 'left-[280px] top-1/2 w-20 -translate-y-1/2'
                                    : 'left-[280px] top-1/2 w-20 -translate-y-1/2'
                            }`}
                          >
                            {React.createElement(selectedPlotDirection.icon, {
                              className: `${
                                plotStructureGenerateDirection === 'up' ||
                                plotStructureGenerateDirection === 'down'
                                  ? 'h-20 w-10'
                                  : 'h-10 w-20'
                              } shrink-0`,
                              strokeWidth: 3.25,
                            })}
                          </div>

                          <div
                            className={`absolute z-0 h-[150px] rounded-3xl border-4 border-[var(--card-border)] bg-[var(--card-bg)] shadow-lg ${
                              plotStructureGenerateDirection === 'down'
                                ? 'bottom-10 left-1/2 w-[300px] -translate-x-1/2'
                                : plotStructureGenerateDirection === 'up'
                                  ? 'left-1/2 top-10 w-[300px] -translate-x-1/2'
                                  : plotStructureGenerateDirection === 'left'
                                    ? 'left-20 top-1/2 w-[160px] -translate-y-1/2'
                                    : 'right-20 top-1/2 w-[160px] -translate-y-1/2'
                            }`}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-4 border-t border-[var(--card-border)] bg-[var(--card-bg)] p-2">
                        {plotDirectionOptions.map((item) => {
                          const selected = plotStructureGenerateDirection === item.id;
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => setPlotStructureGenerateDirection(item.id)}
                              className={`flex min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-xs font-black ${
                                selected
                                  ? 'bg-[var(--accent)] text-white shadow-sm'
                                  : 'text-[var(--text-muted)] hover:bg-[var(--app-bg)] hover:text-[var(--text-primary)]'
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </section>

                  <section className={settingsRowClass}>
                    <h3 className={settingsRowTitleClass}>{s.textToAudioContent}</h3>
                    <div className={segmentedControlClass}>
                      {[
                        {
                          id: 'body',
                          label: s.narrationBody,
                        },
                        {
                          id: 'title',
                          label: s.narrationTitle,
                        },
                        {
                          id: 'all',
                          label: s.narrationTitleAndBody,
                        },
                      ].map((item) => (
                        <button
                          key={item.id}
                          onClick={() => setTtsNarrationMode(item.id as TtsNarrationMode)}
                          className={compactSegmentButtonClass(ttsNarrationMode === item.id)}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </section>

                  <div className="border-t border-[var(--header-border)]" />

                  <section className="space-y-3">
                    <div className={settingsRowClass}>
                      <div className={settingsRowTitleClass}>
                        {renderSettingHint(s.characterAssets, s.characterAssetsDescription)}
                      </div>
                      <div className="grid flex-1 grid-cols-3 gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--app-bg)]/50 p-1.5">
                        {[
                          {
                            title: s.characterPortraitAsset,
                            description: s.characterPortraitAssetDescription,
                          },
                          {
                            title: s.characterThreeViewAsset,
                            description: s.characterThreeViewAssetDescription,
                          },
                          {
                            title: s.characterTagSpriteAsset,
                            description: s.characterTagSpriteAssetDescription,
                          },
                        ].map((option) => (
                          <div
                            key={option.title}
                            className="min-w-0 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2.5"
                          >
                            {renderSettingHint(
                              <span className="text-sm font-black">{option.title}</span>,
                              option.description,
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHideStoryImageButtonWithTags(!hideStoryImageButtonWithTags)}
                      className={`flex w-full items-center justify-between gap-4 rounded-lg px-3 py-3 text-left transition-all ${
                        hideStoryImageButtonWithTags
                          ? 'text-[var(--text-primary)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {renderSettingHint(
                        <div className="text-sm font-black">{s.hideStoryImageWithTags}</div>,
                        s.hideStoryImageWithTagsDescription,
                      )}
                      <span
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                          hideStoryImageButtonWithTags
                            ? 'bg-[var(--accent)] shadow-md'
                            : 'border border-[var(--header-border)] bg-[var(--app-bg)]'
                        }`}
                      >
                        <span
                          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                            hideStoryImageButtonWithTags ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </span>
                    </button>
                  </section>

                  <section className={settingsRowClass}>
                    <div className={settingsRowTitleClass}>
                      {renderSettingHint(s.sceneImageRatio, s.sceneImageRatioDescription)}
                    </div>
                    <div className="grid flex-1 grid-cols-2 gap-2 rounded-xl border border-[var(--card-border)] bg-[var(--app-bg)]/50 p-1.5">
                      {[
                        {
                          value: 'storyboard-16:9' as const,
                          title: s.sceneStoryboard,
                          description: s.sceneStoryboardDescription,
                        },
                        {
                          value: 'follow-api' as const,
                          title: s.sceneFollowApi,
                          description: s.sceneFollowApiDescription,
                        },
                      ].map((option) => {
                        const selected = sceneImageMode === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setSceneImageMode(option.value)}
                            className={optionCardButtonClass(selected)}
                          >
                            {renderSettingHint(
                              <span className="text-sm font-black">{option.title}</span>,
                              option.description,
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <div className="border-t border-[var(--header-border)]" />

                  <section className="space-y-2">
                    <header className="flex items-center gap-3 mb-6">
                      <h3 className="text-base font-black text-[var(--text-primary)]">
                        {s.interactions}
                      </h3>
                    </header>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-0">
                      {[
                        {
                          id: 'pastePlain',
                          label: s.pastePlain,
                          value: pasteAsPlainText,
                          setter: setPasteAsPlainText,
                        },
                        {
                          id: 'showActions',
                          label: s.showActions,
                          value: showNodeActions,
                          setter: setShowNodeActions,
                        },
                        {
                          id: 'showLastSavedTime',
                          label: s.showLastSavedTime,
                          value: showLastSavedTime,
                          setter: setShowLastSavedTime,
                        },
                        {
                          id: 'saveAssistantConversations',
                          label: s.saveAssistantConversations,
                          value: saveAssistantConversations,
                          setter: setSaveAssistantConversations,
                        },
                        {
                          id: 'showMiniMap',
                          label: s.showMiniMap,
                          value: showMiniMap,
                          setter: setShowMiniMap,
                        },
                      ]
                        .filter((item) => item.id === 'pastePlain' || item.id === 'showActions')
                        .map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between py-2.5 border-b border-[var(--header-border)] last:border-0 group"
                          >
                            <span className="text-sm font-bold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                              {item.label}
                            </span>
                            <button
                              onClick={() => item.setter(!item.value)}
                              className={`w-10 h-5 rounded-full transition-all duration-300 relative ${item.value ? 'bg-[var(--accent)] shadow-md' : 'bg-[var(--app-bg)] border border-[var(--header-border)]'}`}
                            >
                              <div
                                className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm ${item.value ? 'left-6' : 'left-1'}`}
                              />
                            </button>
                          </div>
                        ))}
                    </div>
                  </section>
                </div>
              )}

              {activeSettingsTab === 'playtest' && (
                <div className="animate-in slide-in-from-right-4 duration-500 pb-6">
                  <PlaytestSettingsWorkbench
                    language={language}
                    canvasSettings={playtestCanvasSettings}
                    onCanvasSettingsChange={onPlaytestCanvasSettingsChange}
                    runtimeSettings={playtestRuntimeSettings}
                    onRuntimeSettingsChange={updatePlaytestRuntimeSettings}
                    renderStyle={renderStyle}
                    updateRenderStyle={updateRenderStyle}
                    windowedPlaytestRaised={windowedPlaytestRaised}
                    onToggleWindowedPlaytest={onToggleWindowedPlaytest}
                  />
                  {false && (
                    <>
                      <section className="space-y-5">
                        <header className="flex items-center gap-3 mb-2">
                          <h3 className="text-base font-black text-[var(--text-primary)]">
                            {s.playtestThemeLayout}
                          </h3>
                        </header>

                        {/* Playtest Layout Mode */}
                        <div className={settingsRowClass}>
                          <h3 className={settingsRowTitleClass}>{s.playtestLayoutMode}</h3>
                          <div className={segmentedControlClass}>
                            <button
                              onClick={() => setPlayTestLayoutMode('classic')}
                              className={compactSegmentButtonClass(
                                playTestLayoutMode === 'classic',
                              )}
                            >
                              {s.layoutClassic}
                            </button>
                            <button
                              onClick={() => setPlayTestLayoutMode('immersive')}
                              className={compactSegmentButtonClass(
                                playTestLayoutMode === 'immersive',
                              )}
                            >
                              {s.layoutImmersive}
                            </button>
                          </div>
                        </div>

                        {/* Playtest Theme */}
                        {playTestLayoutMode === 'classic' && (
                          <div className={settingsRowClass}>
                            <h3 className={settingsRowTitleClass}>{s.playtestTheme}</h3>
                            <div className={segmentedControlClass}>
                              <button
                                onClick={() => setPlayTestDarkMode(false)}
                                className={compactSegmentButtonClass(!playTestDarkMode)}
                              >
                                {s.lightMode}
                              </button>
                              <button
                                onClick={() => setPlayTestDarkMode(true)}
                                className={compactSegmentButtonClass(playTestDarkMode)}
                              >
                                {s.darkMode}
                              </button>
                            </div>
                          </div>
                        )}
                      </section>

                      {/* Playtest Choices Position */}
                      <section className={settingsRowClass}>
                        <h3 className={settingsRowTitleClass}>{s.choicePosition}</h3>
                        <div className={segmentedControlClass}>
                          {[
                            { id: 'center', label: s.choiceCenter },
                            { id: 'aboveText', label: s.choiceAboveText },
                            { id: 'belowText', label: s.choiceBelowText },
                          ].map((pos) => (
                            <button
                              key={pos.id}
                              onClick={() => setPlayTestChoicesPosition(pos.id as any)}
                              className={compactSegmentButtonClass(
                                playTestChoicesPosition === pos.id,
                              )}
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
                            ? 'max-h-[200px] opacity-100'
                            : 'max-h-0 opacity-0 pointer-events-none'
                        }`}
                      >
                        <section className={settingsRowClass}>
                          <h3 className={settingsRowTitleClass}>{s.choiceColumns}</h3>
                          <div className={segmentedControlClass}>
                            {[1, 2, 3].map((cols) => (
                              <button
                                key={cols}
                                onClick={() => setPlayTestChoicesColumns(cols)}
                                className={compactSegmentButtonClass(
                                  playTestChoicesColumns === cols,
                                )}
                              >
                                {s[`column${cols}` as keyof typeof s] as string}
                              </button>
                            ))}
                          </div>
                        </section>
                      </div>

                      {/* Playtest Blur Options */}
                      <section className="space-y-3">
                        <div className={settingsRowClass}>
                          <h3 className={settingsRowTitleClass}>{s.blurChoiceBackground}</h3>
                          <div className={segmentedControlClass}>
                            {[
                              {
                                id: 'true',
                                value: true,
                                label: s.enableBackgroundBlur,
                              },
                              {
                                id: 'false',
                                value: false,
                                label: s.disableBackgroundBlur,
                              },
                            ].map((opt) => (
                              <button
                                key={opt.id}
                                onClick={() => setPlayTestBlurBackground(opt.value)}
                                className={compactSegmentButtonClass(
                                  playTestBlurBackground === opt.value,
                                )}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div
                          className={`transition-all duration-300 ease-in-out overflow-hidden ${
                            playTestBlurBackground
                              ? 'max-h-[200px] opacity-100'
                              : 'max-h-0 opacity-0 pointer-events-none'
                          }`}
                        >
                          <div className={settingsRowClass}>
                            <h3 className={settingsRowTitleClass}>{s.blurStoryTextToo}</h3>
                            <div className={segmentedControlClass}>
                              {[
                                {
                                  id: 'true',
                                  value: true,
                                  label: s.blurText,
                                },
                                {
                                  id: 'false',
                                  value: false,
                                  label: s.keepTextClear,
                                },
                              ].map((opt) => (
                                <button
                                  key={opt.id}
                                  onClick={() => setPlayTestBlurText(opt.value)}
                                  className={compactSegmentButtonClass(
                                    playTestBlurText === opt.value,
                                  )}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* Playtest Skip Single Choice Popup */}
                      {playTestChoicesPosition === 'center' && (
                        <section
                          className={`animate-in fade-in slide-in-from-top-1 duration-200 ${settingsRowClass}`}
                        >
                          <h3 className={settingsRowTitleClass}>{s.hideCenterPopupSingleChoice}</h3>
                          <div className={segmentedControlClass}>
                            {[
                              {
                                id: 'true',
                                value: true,
                                label: s.hideClickText,
                              },
                              {
                                id: 'false',
                                value: false,
                                label: s.showPopup,
                              },
                            ].map((opt) => (
                              <button
                                key={opt.id}
                                onClick={() => setPlayTestSkipSingleChoicePopup(opt.value)}
                                className={compactSegmentButtonClass(
                                  playTestSkipSingleChoicePopup === opt.value,
                                )}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </section>
                      )}

                      <div className="border-t border-[var(--header-border)]" />

                      {/* Interaction Modes Settings */}
                      <section className="space-y-5">
                        <header className="flex items-center gap-3 mb-2">
                          <h3 className="text-base font-black text-[var(--text-primary)]">
                            {s.storyTextInteraction}
                          </h3>
                        </header>

                        {/* Interaction Mode Selection */}
                        <div className={settingsRowClass}>
                          <h3 className={settingsRowTitleClass}>{s.storyTextDisplayMode}</h3>
                          <select
                            value={playTestInteractionMode}
                            onChange={(e) => setPlayTestInteractionMode(e.target.value)}
                            className="flex-1 px-4 py-2.5 bg-[var(--app-bg)] border-2 border-[var(--card-border)] rounded-xl text-xs font-bold text-[var(--text-primary)] outline-none focus:ring-4 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] cursor-pointer"
                          >
                            <option
                              value="immediate"
                              className={
                                theme === 'dark'
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-white text-slate-800'
                              }
                            >
                              {s.immediateMode}
                            </option>
                            <option
                              value="typewriter"
                              className={
                                theme === 'dark'
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-white text-slate-800'
                              }
                            >
                              {s.typewriterMode}
                            </option>
                            <option
                              value="timed"
                              className={
                                theme === 'dark'
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-white text-slate-800'
                              }
                            >
                              {s.timedMode}
                            </option>
                            <option
                              value="clickToShow"
                              className={
                                theme === 'dark'
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-white text-slate-800'
                              }
                            >
                              {s.clickToShowMode}
                            </option>
                          </select>
                        </div>

                        {/* Dynamic Configuration Sliders based on Mode */}
                        {playTestInteractionMode === 'typewriter' && (
                          <div
                            className={`animate-in slide-in-from-top-2 duration-300 ${settingsRowClass}`}
                          >
                            <h3 className={settingsRowTitleClass}>{s.typewriterSpeed}</h3>
                            <div className="flex-1 flex items-center gap-4 bg-[var(--app-bg)]/50 p-2.5 rounded-lg border border-[var(--header-border)]">
                              <input
                                type="range"
                                min={10}
                                max={100}
                                step={5}
                                value={playTestTypewriterSpeed}
                                onChange={(e) =>
                                  setPlayTestTypewriterSpeed(parseInt(e.target.value))
                                }
                                className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                              />
                              <span className="text-xs font-mono font-bold text-[var(--accent)] shrink-0">
                                {playTestTypewriterSpeed} {s.charUnit}
                              </span>
                            </div>
                          </div>
                        )}

                        {playTestInteractionMode === 'timed' && (
                          <div
                            className={`animate-in slide-in-from-top-2 duration-300 ${settingsRowClass}`}
                          >
                            <h3 className={settingsRowTitleClass}>{s.choicesDelay}</h3>
                            <div className="flex-1 flex items-center gap-4 bg-[var(--app-bg)]/50 p-2.5 rounded-lg border border-[var(--header-border)]">
                              <input
                                type="range"
                                min={0.5}
                                max={10}
                                step={0.5}
                                value={playTestChoiceDelay}
                                onChange={(e) => setPlayTestChoiceDelay(parseFloat(e.target.value))}
                                className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                              />
                              <span className="text-xs font-mono font-bold text-[var(--accent)] shrink-0">
                                {playTestChoiceDelay} {s.secondUnit}
                              </span>
                            </div>
                          </div>
                        )}
                      </section>

                      <div className="border-t border-[var(--header-border)]" />

                      {/* Auto Advance Settings */}
                      <section className="space-y-5">
                        <header className="flex items-center gap-3 mb-2">
                          <h3 className="text-base font-black text-[var(--text-primary)]">
                            {s.autoAdvance}
                          </h3>
                        </header>

                        <div className={settingsRowClass}>
                          <h3 className={settingsRowTitleClass}>{s.continueAfterAnimation}</h3>
                          <div className="flex-1 flex items-center justify-between">
                            <span className="text-xs text-[var(--text-muted)] font-medium">
                              {s.autoAdvanceDesc}
                            </span>
                            <button
                              onClick={() => setPlayTestAutoAdvance(!playTestAutoAdvance)}
                              className={`w-10 h-5 rounded-full transition-all duration-300 relative shrink-0 ${playTestAutoAdvance ? 'bg-[var(--accent)] shadow-md' : 'bg-[var(--app-bg)] border border-[var(--header-border)]'}`}
                            >
                              <div
                                className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm ${playTestAutoAdvance ? 'left-6' : 'left-1'}`}
                              />
                            </button>
                          </div>
                        </div>

                        {playTestAutoAdvance && (
                          <div
                            className={`animate-in slide-in-from-top-2 duration-300 ${settingsRowClass}`}
                          >
                            <h3 className={settingsRowTitleClass}>{s.waitTime}</h3>
                            <div className="flex-1 flex items-center gap-4 bg-[var(--app-bg)]/50 p-2.5 rounded-lg border border-[var(--header-border)]">
                              <input
                                type="range"
                                min={1}
                                max={10}
                                step={1}
                                value={playTestAutoAdvanceDelay}
                                onChange={(e) =>
                                  setPlayTestAutoAdvanceDelay(parseInt(e.target.value, 10))
                                }
                                className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
                              />
                              <span className="text-xs font-mono font-bold text-[var(--accent)] shrink-0">
                                {playTestAutoAdvanceDelay} {s.secondUnit}
                              </span>
                            </div>
                          </div>
                        )}
                      </section>

                      {/* Playtest Video Autoplay */}
                      <section className={settingsRowClass}>
                        <h3 className={settingsRowTitleClass}>{s.multimediaSettings}</h3>
                        <div className="flex-1 flex items-center justify-between">
                          <span className="text-xs text-[var(--text-muted)] font-medium">
                            {s.videoAutoPlay}
                          </span>
                          <button
                            onClick={() => setPlayTestVideoAutoPlay(!playTestVideoAutoPlay)}
                            className={`w-10 h-5 rounded-full transition-all duration-300 relative shrink-0 ${playTestVideoAutoPlay ? 'bg-[var(--accent)] shadow-md' : 'bg-[var(--app-bg)] border border-[var(--header-border)]'}`}
                          >
                            <div
                              className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm ${playTestVideoAutoPlay ? 'left-6' : 'left-1'}`}
                            />
                          </button>
                        </div>
                      </section>

                      <section className="space-y-3">
                        <h3 className={settingsRowTitleClass}>{s.tagDisplay}</h3>
                        <div className={settingsRowClass}>
                          <h3 className={settingsRowTitleClass}>{s.hideCharacterTags}</h3>
                          <button
                            type="button"
                            onClick={() => setPlayTestHideCharacterTags(!playTestHideCharacterTags)}
                            className={`w-10 h-5 rounded-full transition-all duration-300 relative shrink-0 ${playTestHideCharacterTags ? 'bg-[var(--accent)] shadow-md' : 'bg-[var(--app-bg)] border border-[var(--header-border)]'}`}
                          >
                            <div
                              className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm ${playTestHideCharacterTags ? 'left-6' : 'left-1'}`}
                            />
                          </button>
                        </div>
                        <div className={settingsRowClass}>
                          <h3 className={settingsRowTitleClass}>{s.hideSceneTags}</h3>
                          <button
                            type="button"
                            onClick={() => setPlayTestHideSceneTags(!playTestHideSceneTags)}
                            className={`w-10 h-5 rounded-full transition-all duration-300 relative shrink-0 ${playTestHideSceneTags ? 'bg-[var(--accent)] shadow-md' : 'bg-[var(--app-bg)] border border-[var(--header-border)]'}`}
                          >
                            <div
                              className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm ${playTestHideSceneTags ? 'left-6' : 'left-1'}`}
                            />
                          </button>
                        </div>
                      </section>
                    </>
                  )}
                </div>
              )}

              {activeSettingsTab === 'ai' && (
                <div className="space-y-6">
                  <AISettingsPanel
                    language={language}
                    savedAIProfiles={savedAIProfiles}
                    activeTextProfileId={activeTextProfileId}
                    activeImageProfileId={activeImageProfileId}
                    activeBackgroundRemovalProfileId={activeBackgroundRemovalProfileId}
                    activeVoiceProfileId={activeVoiceProfileId}
                    missingTextApiKey={missingTextApiKey}
                    settingsAttentionTarget={settingsAttentionTarget}
                    onAcknowledgeSettingsAttention={onAcknowledgeSettingsAttention}
                    onCreateAIProfile={onCreateAIProfile}
                    onUpdateAIProfile={onUpdateAIProfile}
                    onSelectAIProfile={onSelectAIProfile}
                    onDeleteAIProfile={onDeleteAIProfile}
                    customAiPromptsEnabled={customAiPromptsEnabled}
                    setCustomAiPromptsEnabled={setCustomAiPromptsEnabled}
                    aiPrompts={aiPrompts}
                    setAiPrompts={setAiPrompts}
                    aiButtonsConfig={aiButtonsConfig}
                    setAiButtonsConfig={setAiButtonsConfig}
                    aiGenerationBalance={aiGenerationBalance}
                    setAiGenerationBalance={setAiGenerationBalance}
                    allowAssistantImageGeneration={allowAssistantImageGeneration}
                    setAllowAssistantImageGeneration={setAllowAssistantImageGeneration}
                    assistantOptionsSlot={
                      <div className="grid gap-4">
                        <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              {renderAssistantHintButton(
                                'agentAnimation',
                                s.skipAssistantAgentAnimation,
                                s.skipAssistantAgentAnimationDesc,
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setSkipAssistantAgentAnimation(!skipAssistantAgentAnimation)
                              }
                              className={`relative h-5 w-10 shrink-0 rounded-full transition-all duration-300 ${skipAssistantAgentAnimation ? 'bg-[var(--accent)] shadow-md' : 'border border-[var(--header-border)] bg-[var(--app-bg)]'}`}
                            >
                              <div
                                className={`absolute top-1 h-3 w-3 rounded-full bg-white shadow-sm transition-all duration-300 ${skipAssistantAgentAnimation ? 'left-6' : 'left-1'}`}
                              />
                            </button>
                          </div>
                        </section>

                        <section className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              {renderAssistantHintButton(
                                'memorySkill',
                                s.assistantMemorySkill,
                                s.assistantMemorySkillDesc,
                              )}
                              <p className="mt-2 text-[11px] font-bold text-[var(--text-secondary)]">
                                {s.assistantMemoryCount}: {assistantMemoryNotes.length}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setAssistantMemorySkillEnabled(!assistantMemorySkillEnabled)
                              }
                              className={`relative h-5 w-10 shrink-0 rounded-full transition-all duration-300 ${assistantMemorySkillEnabled ? 'bg-[var(--accent)] shadow-md' : 'border border-[var(--header-border)] bg-[var(--app-bg)]'}`}
                            >
                              <div
                                className={`absolute top-1 h-3 w-3 rounded-full bg-white shadow-sm transition-all duration-300 ${assistantMemorySkillEnabled ? 'left-6' : 'left-1'}`}
                              />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={onDownloadAssistantMemory}
                            disabled={assistantMemoryNotes.length === 0}
                            className="mt-4 inline-flex h-8 items-center gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)] px-3 text-xs font-bold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Download className="h-3.5 w-3.5" />
                            {s.downloadAssistantMemory}
                          </button>
                        </section>
                      </div>
                    }
                  />
                </div>
              )}

              {activeSettingsTab === 'about' && aboutPage === 'contact' && (
                <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
                  <section>
                    <header className="flex items-center gap-3 mb-6">
                      <h3 className="text-base font-black text-[var(--text-primary)]">
                        {s.contactTitle}
                      </h3>
                    </header>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-3 leading-relaxed font-medium px-4">
                      {s.contactDesc}
                    </p>
                    <p className="text-sm font-bold leading-relaxed px-4 py-3 mb-5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300">
                      {s.freeNotice}
                    </p>
                    <div className="grid grid-cols-2 gap-6">
                      {[
                        {
                          id: 'qq',
                          label: s.qqPersonal,
                          value: '721397187',
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
                            {item.copied ? (
                              <Check className="w-4 h-4" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                            <span>{item.copied ? s.copied : s.clickToCopy}</span>
                          </div>
                        </div>
                      ))}
                      <a
                        href="https://mingwencui.com/AIwriter/?lang=zh"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="col-span-1 flex min-h-14 items-center justify-center gap-2 px-4 py-4 bg-[var(--accent)] text-white rounded-xl text-sm font-black shadow-xl transition-all hover:shadow-2xl hover:-translate-y-0.5 active:scale-95"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>{s.visitAuthorWebsite}</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => setAboutPage('help')}
                        className="col-span-1 flex min-h-14 items-center justify-center gap-2 px-4 py-4 bg-[var(--card-bg)] text-[var(--text-primary)] border-2 border-[var(--card-border)] rounded-xl text-sm font-black shadow-sm transition-all hover:border-[var(--accent)] hover:text-[var(--accent)] hover:-translate-y-0.5 active:scale-95"
                      >
                        <HelpCircle className="w-4 h-4" />
                        <span>{s.helpUsageNotice}</span>
                      </button>
                    </div>
                  </section>

                  <section className="bg-white dark:bg-black rounded-2xl p-10 text-center relative overflow-hidden group border border-slate-100 dark:border-white/5 shadow-sm dark:shadow-none">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 dark:from-indigo-500/10 dark:to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                    <img
                      src="./glass.png"
                      alt=""
                      className="mx-auto mb-6 h-14 w-14 relative z-10 object-contain"
                    />
                    <h4 className="text-xl font-black text-slate-900 dark:text-white mb-2 relative z-10">
                      {s.aboutProductTitle}
                    </h4>
                    <p className="text-indigo-600/40 dark:text-sky-400/40 text-xs font-bold uppercase tracking-[0.4em] mb-6 relative z-10">
                      旮旯作家 · GalWriter
                    </p>
                    <div className="h-px bg-slate-200 dark:bg-white/10 w-24 mx-auto mb-6 relative z-10" />
                    <p className="text-slate-500 dark:text-slate-400 text-xs leading-relaxed max-w-[320px] mx-auto relative z-10 font-medium">
                      {s.aboutProductDesc}
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

                  {isDesktopApp && (
                    <>
                      <section className="pt-4 border-t border-slate-100 dark:border-slate-800">
                        <header className="flex items-center gap-3 mb-5">
                          <h3 className="text-base font-black text-[var(--text-primary)]">
                            {s.desktopCloseButton}
                          </h3>
                        </header>
                        <div className="flex flex-1 bg-[var(--app-bg)]/50 p-1 rounded-lg border border-[var(--header-border)]">
                          <button
                            type="button"
                            onClick={() => setCloseButtonBehavior('minimize')}
                            className={`flex-1 py-3 text-xs font-black rounded-lg transition-all ${closeButtonBehavior === 'minimize' ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                          >
                            {s.minimizeToTray}
                          </button>
                          <button
                            type="button"
                            onClick={() => setCloseButtonBehavior('quit')}
                            className={`flex-1 py-3 text-xs font-black rounded-lg transition-all ${closeButtonBehavior === 'quit' ? 'bg-[var(--card-bg)] shadow-md text-[var(--accent)] border border-[var(--card-border)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}
                          >
                            {s.quitApp}
                          </button>
                        </div>
                        <p className="mt-3 text-xs leading-relaxed text-[var(--text-muted)] font-medium">
                          {s.desktopCloseDesc}
                        </p>
                      </section>

                      <section className="pt-4 border-t border-rose-500/20">
                        <button
                          type="button"
                          onClick={forceQuitApp}
                          className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-rose-600 text-white text-sm font-black shadow-lg transition-all hover:bg-rose-700 hover:shadow-xl active:scale-95"
                          title={s.forceQuitTitle}
                        >
                          <X className="w-4 h-4" />
                          <span>{s.forceCloseApp}</span>
                        </button>
                        <p className="mt-3 text-center text-[10px] leading-relaxed font-bold text-rose-500/80">
                          {s.forceCloseDesc}
                        </p>
                      </section>
                    </>
                  )}
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
                    <span>{s.backToAbout}</span>
                  </button>

                  <section>
                    <header className="flex items-center gap-3 mb-6">
                      <div className="w-1.5 h-6 bg-[var(--accent)] rounded-full" />
                      <h3 className="text-base font-black text-[var(--text-primary)]">
                        {s.helpUsageNotice}
                      </h3>
                    </header>

                    <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-2xl p-6 space-y-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                          <ShieldAlert className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="text-lg font-black text-[var(--text-primary)] mb-2">
                            {s.responsibleUseTitle}
                          </h4>
                          <p className="text-sm leading-relaxed text-[var(--text-secondary)] font-medium">
                            {s.responsibleUseDesc}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3">
                        {[
                          s.responsibleUseRule1,
                          s.responsibleUseRule2,
                          s.responsibleUseRule3,
                          s.responsibleUseRule4,
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
                          {s.responsibleDisclaimer}
                        </p>
                      </div>
                    </div>
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {showApplySettingsConfirm && (
        <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div className="flex max-h-[86vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--card-border)] bg-[var(--panel-bg)] shadow-[0_32px_80px_rgba(15,23,42,0.28)]">
            <div className="border-b border-[var(--header-border)] px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-[var(--text-primary)]">
                    {s.chooseTargetProjects}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                    {s.chooseTargetProjectsDesc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleAllApplyProjects}
                  disabled={applyTargetProjects.length === 0}
                  className="shrink-0 rounded-lg border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2 text-xs font-black text-[var(--text-secondary)] transition-colors hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {allApplyTargetsSelected ? s.clearAll : s.selectAll}
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 custom-scrollbar">
              {applyTargetProjects.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--card-border)] bg-[var(--app-bg)]/40 px-5 py-10 text-center text-sm font-bold text-[var(--text-muted)]">
                  {s.noOtherProjects}
                </div>
              ) : (
                <div className="grid gap-3">
                  {applyTargetProjects.map((project) => {
                    const selected = selectedApplyProjectIds.includes(project.id);
                    return (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => toggleApplyProject(project.id)}
                        className={`flex items-center gap-4 rounded-xl border px-4 py-3 text-left transition-all ${
                          selected
                            ? 'border-[var(--accent)] bg-[var(--accent)]/5 ring-1 ring-[var(--accent)]/15'
                            : 'border-[var(--card-border)] bg-[var(--card-bg)] hover:border-[var(--accent)]/35'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleApplyProject(project.id)}
                          onClick={(event) => event.stopPropagation()}
                          className="h-4 w-4 shrink-0 accent-[var(--accent)]"
                        />
                        <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-[var(--card-border)] bg-[var(--app-bg)]">
                          {project.thumbnailDataUrl ? (
                            <img
                              src={project.thumbnailDataUrl}
                              alt=""
                              className="h-full w-full object-cover"
                              draggable={false}
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-black text-[var(--text-primary)]">
                            {project.projectName || s.untitledProject}
                          </div>
                          <div className="mt-1 text-xs font-medium text-[var(--text-muted)]">
                            {s.updated} {formatProjectUpdatedAt(project.updatedAt, language)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-3 border-t border-[var(--header-border)] px-6 py-4">
              <button
                type="button"
                onClick={() => setShowApplySettingsConfirm(false)}
                className="flex-1 rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-4 py-3 text-sm font-bold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                {s.cancel}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleApplySettingsToOtherProjects();
                }}
                disabled={selectedApplyProjectIds.length === 0 || isApplyingSettings}
                className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
              >
                {applyProjectCountLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

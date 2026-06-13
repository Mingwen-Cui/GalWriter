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
  ShieldAlert,
  X,
} from 'lucide-react';
import React, { useState } from 'react';

import { AISettingsPanel } from './AISettingsPanel';
import { type AIButtonsConfig, type AIPromptsConfig } from '../editor-state/editorConfig';
import type {
  CharacterImageMode,
  ImageAIProfile,
  SavedAIProfile,
  SceneImageMode,
  StoryTitlePlacement,
  TextAIProfile,
  TtsNarrationMode,
  VoiceAIProfile,
} from '../domain/project';
import { Language, translations } from '../lib/i18n';
import { getTauriInvoke, isTauriRuntime } from '../lib/tauriRuntime';
import type { LocalProjectSummary } from '../lib/db';

type AIProfileKind = 'text' | 'image' | 'voice';
type AIProfileSeed = Partial<TextAIProfile> | Partial<ImageAIProfile> | Partial<VoiceAIProfile>;
type AIProfileUpdates = Partial<TextAIProfile> | Partial<ImageAIProfile> | Partial<VoiceAIProfile>;

interface SettingsModalProps {
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  missingTextApiKey: boolean;
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  closeButtonBehavior: 'minimize' | 'quit';
  setCloseButtonBehavior: (behavior: 'minimize' | 'quit') => void;
  bubbleStyle: 'glass' | 'flat';
  setBubbleStyle: (style: 'glass' | 'flat') => void;
  opaqueAssistantMessagesInGlass: boolean;
  setOpaqueAssistantMessagesInGlass: (value: boolean) => void;
  opaqueFooterInGlass: boolean;
  setOpaqueFooterInGlass: (value: boolean) => void;
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
  showLastSavedTime: boolean;
  setShowLastSavedTime: (val: boolean) => void;
  saveAssistantConversations: boolean;
  setSaveAssistantConversations: (val: boolean) => void;
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
  activeVoiceProfileId: string | null;
  settingsAttentionTarget?: 'text' | 'image' | 'voice' | null;
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
  characterImageMode: CharacterImageMode;
  setCharacterImageMode: (mode: CharacterImageMode) => void;
  sceneImageMode: SceneImageMode;
  setSceneImageMode: (mode: SceneImageMode) => void;
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
  onApplySettingsToOtherProjects?: (targetProjectIds: string[]) => void | Promise<void>;
}

const settingsText = {
  zh: {
    editorTab: '编辑器',
    playtestTab: '剧本测试',
    aboutTab: '关于与反馈',
    language: '系统语言',
    chinese: '简体中文',
    japanese: '日本語',
    closeSettings: '关闭设置',
    themeLanguage: '主题与语言',
    rightToolbar: '右侧工具',
    selectionMenu: '框选菜单',
    show: '显示',
    hide: '隐藏',
    on: '开启',
    off: '关闭',
    shownInToolbar: '工具栏显示',
    hiddenInToolbar: '工具栏隐藏',
    applyCurrentSettingsTitle: '应用当前设置到其他项目',
    applying: '应用中...',
    applyToOtherProjects: '应用到其他项目',
    chooseTargetProjects: '选择要应用设置的项目',
    chooseTargetProjectsDesc: '勾选要复制当前设置的项目文件。项目标题会保留。',
    clearAll: '取消全选',
    selectAll: '全选',
    noOtherProjects: '暂无其他本地项目可应用。',
    untitledProject: '未命名项目',
    updated: '最近编辑',
    copied: '已复制！',
    clickToCopy: '点击复制',
    toolbarBubbleStyle: '工具栏气泡质感',
    hoverButtonAnimations: '悬浮按钮动画',
    hoverButtonAnimationsDesc: '开启后，鼠标悬浮在部分工具按钮上会播放 Lottie 引导动画。',
    glassReadability: '玻璃可读性',
    opaqueAssistantMessagesInGlass: 'AI 助手对话不透明',
    opaqueFooterInGlass: '底部状态栏不透明',
    glass: '玻璃',
    flat: '扁平',
    bgColorsDesc: '点击颜色块可自定义颜色，这些颜色会显示在画布右侧的快速切换栏中。',
    storyTitlePosition: '普通卡片标题位置',
    titleInside: '卡片内部',
    titleOutsideLeft: '卡片外部左上角',
    titleOutsideRight: '卡片外部右上角',
    interactions: '交互与显示',
    showLastSavedTime: '显示上次保存时间',
    saveAssistantConversations: '保存 AI 助手对话',
    playtestThemeLayout: '剧情测试主题与排版',
    playtestTheme: '测试界面主题',
    choicePosition: '选项按钮位置',
    choiceCenter: '画面中间',
    choiceAboveText: '文字上方',
    choiceBelowText: '文字下方',
    blurChoiceBackground: '选项弹出背景虚化',
    enableBackgroundBlur: '开启背景虚化',
    disableBackgroundBlur: '关闭背景虚化',
    blurStoryTextToo: '虚化时模糊剧情文字',
    blurText: '文字也虚化',
    keepTextClear: '文字保持清晰',
    hideCenterPopupSingleChoice: '单选项时隐藏居中弹窗',
    hideClickText: '隐藏（点击文字继续）',
    showPopup: '显示弹窗选择',
    storyTextInteraction: '剧情文本交互策略',
    storyTextDisplayMode: '剧情显示模式',
    immediateMode: '立即显示（直接显示文本与选项）',
    typewriterMode: '打字机效果（文本逐字打出后显示选项）',
    timedMode: '延迟显示选项（文本载入 N 秒后显示选项）',
    clickToShowMode: '点击显示选项（点击文本区域后显示选项）',
    typewriterSpeed: '打字速度（每字延迟）',
    charUnit: 'ms/字',
    choicesDelay: '选择项延迟出现时间',
    secondUnit: '秒',
    autoAdvance: '自动翻页',
    continueAfterAnimation: '动画结束后自动继续',
    autoAdvanceDesc: '仅在没有多个选项时生效，多选项会暂停等待选择。',
    waitTime: '等待秒数',
    enableOverlay: '启用遮罩',
    disableOverlay: '关闭遮罩',
    multimediaSettings: '多媒体设置',
    qqPersonal: 'QQ群',
    visitAuthorWebsite: '访问作者的网站',
    helpUsageNotice: '帮助和使用须知',
    aboutProductTitle: '交互式 AI 小说创作工具',
    aboutProductDesc: '致力于构建下一代 AI 交互式小说创作工具，让每一颗想象力的种子都能开花结果。',
    desktopCloseButton: '桌面端关闭按钮',
    minimizeToTray: '最小化到后台',
    quitApp: '直接关闭应用',
    desktopCloseDesc: '此选项只影响 Tauri 打包后的桌面应用，浏览器预览不会改变窗口行为。',
    forceQuitTitle: '强制退出应用',
    forceCloseApp: '强制关闭 GalWriter AI',
    forceCloseDesc: '当窗口关闭按钮只会最小化时，可以用这个按钮直接退出桌面应用。',
    backToAbout: '返回关于与反馈',
    responsibleUseTitle: '请合理、合法地使用 GalWriter AI',
    responsibleUseDesc:
      '本工具用于辅助个人创作、学习和原型设计。请在遵守所在地法律法规、平台规则和基本创作伦理的前提下使用。',
    responsibleUseRule1:
      '请不要将本软件本体、安装包或未经授权的改版拿去售卖、倒卖或包装成付费产品。',
    responsibleUseRule2:
      '请不要使用本软件生成、传播违法违规内容，包括诈骗、暴力犯罪、色情剥削、仇恨骚扰、侵犯隐私等内容。',
    responsibleUseRule3:
      'AI 生成内容可能存在错误、偏见或不适合公开发布的表达，发布前请自行审校并承担相应责任。',
    responsibleUseRule4:
      '请尊重他人的版权、肖像权、隐私权和商业权益，不要冒充他人或未经许可使用受保护素材。',
    responsibleDisclaimer:
      '免责声明：作者不对用户使用本软件产生的内容、收益、纠纷或法律后果承担责任。继续使用即表示你理解并愿意遵守以上须知。',
  },
  en: {
    editorTab: 'Editor',
    playtestTab: 'Playtest',
    aboutTab: 'About & Feedback',
    language: 'Language',
    chinese: 'Chinese',
    japanese: 'Japanese',
    closeSettings: 'Close settings',
    themeLanguage: 'Theme & Language',
    rightToolbar: 'Right Toolbar',
    selectionMenu: 'Selection Menu',
    show: 'Show',
    hide: 'Hide',
    on: 'On',
    off: 'Off',
    shownInToolbar: 'Shown in toolbar',
    hiddenInToolbar: 'Hidden in toolbar',
    applyCurrentSettingsTitle: 'Apply current settings to other projects',
    applying: 'Applying...',
    applyToOtherProjects: 'Apply to other projects',
    chooseTargetProjects: 'Choose target projects',
    chooseTargetProjectsDesc:
      'Select the project files that should receive the current settings. Project titles will be preserved.',
    clearAll: 'Clear all',
    selectAll: 'Select all',
    noOtherProjects: 'No other local projects available.',
    untitledProject: 'Untitled project',
    updated: 'Updated',
    copied: 'Copied!',
    clickToCopy: 'Click to Copy',
    toolbarBubbleStyle: 'Toolbar Bubble Style',
    hoverButtonAnimations: 'Hover Button Animations',
    hoverButtonAnimationsDesc: 'Play Lottie guides when hovering over supported toolbar buttons.',
    glassReadability: 'Glass Readability',
    opaqueAssistantMessagesInGlass: 'Opaque AI assistant messages',
    opaqueFooterInGlass: 'Opaque bottom footer',
    glass: 'Glass',
    flat: 'Flat',
    bgColorsDesc: 'Click color blocks to customize. These will appear in the quick switcher.',
    storyTitlePosition: 'Story Card Title Position',
    titleInside: 'Inside',
    titleOutsideLeft: 'Outside Top Left',
    titleOutsideRight: 'Outside Top Right',
    interactions: 'Interactions',
    showLastSavedTime: 'Show last saved time',
    saveAssistantConversations: 'Save AI assistant chats',
    playtestThemeLayout: 'Playtest Theme & Layout',
    playtestTheme: 'Playtest Theme',
    choicePosition: 'Choice Position',
    choiceCenter: 'Center',
    choiceAboveText: 'Above Text',
    choiceBelowText: 'Below Text',
    blurChoiceBackground: 'Blur Choice Background',
    enableBackgroundBlur: 'Enabled',
    disableBackgroundBlur: 'Disabled',
    blurStoryTextToo: 'Blur Story Text Too',
    blurText: 'Blur Text',
    keepTextClear: 'Keep Text Clear',
    hideCenterPopupSingleChoice: 'Hide Center Popup for Single Choice',
    hideClickText: 'Hide (Click Text)',
    showPopup: 'Show Popup',
    storyTextInteraction: 'Story Text Interaction',
    storyTextDisplayMode: 'Story Text Display Mode',
    immediateMode: 'Immediate (Show all instantly)',
    typewriterMode: 'Typewriter (Reveal word-by-word)',
    timedMode: 'Timed Delay (Show choices after N seconds)',
    clickToShowMode: 'Click-to-Show (Tap text to unlock choices)',
    typewriterSpeed: 'Typewriting Speed',
    charUnit: 'ms/char',
    choicesDelay: 'Choices Appending Delay',
    secondUnit: 's',
    autoAdvance: 'Auto Advance',
    continueAfterAnimation: 'Continue after animation',
    autoAdvanceDesc: 'Only runs when there is not more than one choice.',
    waitTime: 'Wait Time',
    enableOverlay: 'Enabled',
    disableOverlay: 'Disabled',
    multimediaSettings: 'Multimedia Settings',
    qqPersonal: 'QQ Group',
    visitAuthorWebsite: 'Visit Author Website',
    helpUsageNotice: 'Help & Usage Notice',
    aboutProductTitle: 'Interactive AI Fiction Creation Tool',
    aboutProductDesc:
      'Dedicated to building next-gen AI narrative infrastructure, making every seed of imagination bloom.',
    desktopCloseButton: 'Desktop Close Button',
    minimizeToTray: 'Minimize',
    quitApp: 'Quit',
    desktopCloseDesc:
      'This only affects the packaged Tauri app; browser preview behavior is unchanged.',
    forceQuitTitle: 'Force quit app',
    forceCloseApp: 'Force Close GalWriter AI',
    forceCloseDesc: 'Use this when the window close button only minimizes the app.',
    backToAbout: 'Back to About & Feedback',
    responsibleUseTitle: 'Use GalWriter AI Responsibly',
    responsibleUseDesc:
      'This tool is intended for personal creation, learning, and prototyping. Use it in accordance with applicable laws, platform rules, and basic creative ethics.',
    responsibleUseRule1:
      'Do not sell, resell, or repackage this software, installer, or unauthorized modified versions as a paid product.',
    responsibleUseRule2:
      'Do not use this software to generate or distribute illegal or harmful content, including fraud, violent crime, sexual exploitation, hate, harassment, or privacy violations.',
    responsibleUseRule3:
      'AI-generated content may contain mistakes, bias, or unsuitable wording. Review it before publishing and take responsibility for the final output.',
    responsibleUseRule4:
      'Respect copyright, likeness rights, privacy, and commercial rights. Do not impersonate others or use protected material without permission.',
    responsibleDisclaimer:
      'Disclaimer: The author is not responsible for content, revenue, disputes, or legal consequences arising from user behavior. Continued use means you understand and agree to follow this notice.',
  },
  ja: {
    editorTab: 'エディタ',
    playtestTab: 'テストプレイ',
    aboutTab: 'バージョン情報',
    language: 'システム言語',
    chinese: '中国語（簡体字）',
    japanese: '日本語',
    closeSettings: '設定を閉じる',
    themeLanguage: 'テーマと言語',
    rightToolbar: '右側ツールバー',
    selectionMenu: '選択メニュー',
    show: '表示',
    hide: '非表示',
    on: 'オン',
    off: 'オフ',
    shownInToolbar: 'ツールバーに表示',
    hiddenInToolbar: 'ツールバーで非表示',
    applyCurrentSettingsTitle: '現在の設定を他のプロジェクトに適用',
    applying: '適用中...',
    applyToOtherProjects: '他のプロジェクトに適用',
    chooseTargetProjects: '設定を適用するプロジェクトを選択',
    chooseTargetProjectsDesc:
      '現在の設定をコピーするプロジェクトファイルを選択してください。プロジェクト名は保持されます。',
    clearAll: '全解除',
    selectAll: 'すべて選択',
    noOtherProjects: '適用できる他のローカルプロジェクトはありません。',
    untitledProject: '無題のプロジェクト',
    updated: '最近の編集',
    copied: 'コピーしました！',
    clickToCopy: 'クリックしてコピー',
    toolbarBubbleStyle: 'ツールバーのバブルスタイル',
    hoverButtonAnimations: 'ホバーボタンのアニメーション',
    hoverButtonAnimationsDesc:
      '対応するツールボタンにマウスを合わせると、Lottie ガイドを再生します。',
    glassReadability: 'ガラス表示の可読性',
    opaqueAssistantMessagesInGlass: 'AIアシスタント会話を不透明にする',
    opaqueFooterInGlass: '下部フッターを不透明にする',
    glass: 'ガラス',
    flat: 'フラット',
    bgColorsDesc:
      '色をクリックするとカスタマイズできます。これらの色はキャンバス右側のクイック切り替えバーに表示されます。',
    storyTitlePosition: '通常カードのタイトル位置',
    titleInside: 'カード内部',
    titleOutsideLeft: 'カードの左上（外部）',
    titleOutsideRight: 'カードの右上（外部）',
    interactions: 'インタラクションと表示',
    showLastSavedTime: '最终保存時間の表示',
    saveAssistantConversations: 'AIアシスタントの会話を保存する',
    playtestThemeLayout: 'テストプレイのテーマとレイアウト',
    playtestTheme: 'テストUIのテーマ',
    choicePosition: '選択肢ボタンの位置',
    choiceCenter: '画面中央',
    choiceAboveText: 'テキストの上',
    choiceBelowText: 'テキストの下',
    blurChoiceBackground: '選択肢表示時の背景ぼかし',
    enableBackgroundBlur: '背景ぼかしを有効にする',
    disableBackgroundBlur: '背景ぼかしを無効にする',
    blurStoryTextToo: '背景ぼかし時にストーリーテキストもぼかす',
    blurText: 'テキストもぼかす',
    keepTextClear: 'テキストをクリアに保つ',
    hideCenterPopupSingleChoice: '単一選択肢の場合は中央ポップアップを非表示',
    hideClickText: '非表示（クリックして進む）',
    showPopup: 'ポップアップ選択を表示',
    storyTextInteraction: 'ストーリーテキストの表示設定',
    storyTextDisplayMode: '表示モード',
    immediateMode: '即時表示（テキストと選択肢を同時に表示）',
    typewriterMode: 'タイプライター風表示（文字を徐々に表示し、終わったら選択肢を表示）',
    timedMode: '遅延表示（テキストロードのN秒後に選択肢を表示）',
    clickToShowMode: 'クリックで表示（テキスト領域をクリック後に選択肢を表示）',
    typewriterSpeed: 'タイピング速度（文字ごとのディレイ）',
    charUnit: 'ms/文字',
    choicesDelay: '選択肢の表示ディレイ',
    secondUnit: '秒',
    autoAdvance: '自動ページ送り',
    continueAfterAnimation: 'アニメーション終了後に自動で進む',
    autoAdvanceDesc: '複数の選択肢がない場合のみ有効です。複数の選択肢がある場合は選択を待ちます。',
    waitTime: '待機時間',
    enableOverlay: 'オーバーレイを表示',
    disableOverlay: 'オーバーレイを非表示',
    multimediaSettings: 'マルチメディア設定',
    qqPersonal: 'QQグループ',
    visitAuthorWebsite: '開発者のウェブサイトを訪問',
    helpUsageNotice: 'ヘルプと利用規約',
    aboutProductTitle: 'インタラクティブAI小説執筆ツール',
    aboutProductDesc:
      '次世代のAIインタラクティブ小説創作インフラの構築を目指し、想像力のすべての種が花を咲かせるよう支援します。',
    desktopCloseButton: 'デスクトップ閉じるボタンの挙動',
    minimizeToTray: 'タスクトレイに最小化',
    quitApp: 'アプリを終了',
    desktopCloseDesc:
      'この設定はTauriデスクトップアプリにのみ適用されます。ブラウザでのプレビュー動作には影響しません。',
    forceQuitTitle: 'アプリを強制終了',
    forceCloseApp: 'GalWriter AIを強制終了',
    forceCloseDesc:
      'ウィンドウの閉じるボタンが最小化として動作する場合に、このボタンで直接アプリを終了できます。',
    backToAbout: 'バージョン情報に戻る',
    responsibleUseTitle: 'GalWriter AIの適切な利用について',
    responsibleUseDesc:
      '本ツールは個人の創作活動、学習、およびプロトタイピングの支援を目的としています。現地の法律、プラットフォーム利用規約、および基本的な創作倫理を遵守してご利用ください。',
    responsibleUseRule1:
      '本ソフトウェア本体、インストーラー、または無断で改変した版を販売、転売、有料製品として再包装しないでください。',
    responsibleUseRule2:
      '詐欺、暴力犯罪、性的搾取、ヘイト、嫌がらせ、プライバシー侵害など、違法または有害な内容の生成や配布に使用しないでください。',
    responsibleUseRule3:
      'AI 生成コンテンツには誤り、偏り、公開に適さない表現が含まれる場合があります。公開前に確認し、最終的な内容にはご自身で責任を持ってください。',
    responsibleUseRule4:
      '著作権、肖像権、プライバシー、商業上の権利を尊重してください。他者になりすましたり、許可なく保護された素材を使用したりしないでください。',
    responsibleDisclaimer:
      '免責事項：作者は、ユーザーの利用によって生じたコンテンツ、収益、紛争、法的結果について責任を負いません。利用を続けることで、この注意事項を理解し遵守することに同意したものとみなされます。',
  },
} satisfies Record<Language, Record<string, string>>;

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
  showLastSavedTime,
  setShowLastSavedTime,
  saveAssistantConversations,
  setSaveAssistantConversations,
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
  activeVoiceProfileId,
  settingsAttentionTarget,
  onAcknowledgeSettingsAttention,
  projectSummaries,
  currentProjectId,
  onCreateAIProfile,
  onUpdateAIProfile,
  onSelectAIProfile,
  onDeleteAIProfile,
  generateLength,
  setGenerateLength,
  characterImageMode,
  setCharacterImageMode,
  sceneImageMode,
  setSceneImageMode,
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
  onApplySettingsToOtherProjects,
}) => {
  const [activeSettingsTab, setActiveSettingsTab] = useState<
    'appearance' | 'editor' | 'playtest' | 'ai' | 'about'
  >('appearance');
  const [aboutPage, setAboutPage] = useState<'contact' | 'help'>('contact');
  const [isApplyingSettings, setIsApplyingSettings] = useState(false);
  const [showApplySettingsConfirm, setShowApplySettingsConfirm] = useState(false);
  const [selectedApplyProjectIds, setSelectedApplyProjectIds] = useState<string[]>([]);
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
  const t = translations[language];
  const s = settingsText[language];
  const isDesktopApp = isTauriRuntime();
  const applyProjectCountLabel =
    language === 'zh'
      ? `应用到 ${selectedApplyProjectIds.length} 个项目`
      : language === 'ja'
        ? `${selectedApplyProjectIds.length} 件のプロジェクトに適用`
        : `Apply to ${selectedApplyProjectIds.length} project${selectedApplyProjectIds.length === 1 ? '' : 's'}`;
  const compactSegmentButtonClass = (active: boolean) =>
    `flex-1 rounded-md py-2.5 text-xs font-bold transition-all ${
      active
        ? 'bg-[var(--card-bg)] text-[var(--accent)] shadow-sm ring-1 ring-[var(--card-border)]'
        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
    }`;
  const compactTextButtonClass = (active: boolean) =>
    `flex-1 rounded-md py-2.5 text-xs font-bold transition-all ${
      active
        ? 'bg-[var(--card-bg)] text-[var(--accent)] shadow-sm ring-1 ring-[var(--card-border)]'
        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
    }`;
  const settingsRowClass = 'flex items-center gap-4';
  const settingsRowTitleClass =
    'w-36 shrink-0 whitespace-nowrap text-sm font-black text-[var(--text-primary)]';
  const segmentedControlClass =
    'flex flex-1 bg-[var(--app-bg)]/50 p-1 rounded-lg border border-[var(--header-border)]';
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
        className={`fixed inset-0 bg-slate-900/40 dark:bg-black/60 z-[300] flex items-center justify-center backdrop-blur-[2px] p-4 animate-in fade-in duration-200 ${theme === 'dark' ? 'dark' : ''}`}
      >
        <div className="bg-[var(--panel-bg)] backdrop-blur-[0px] rounded-2xl shadow-2xl w-full max-w-4xl h-[720px] max-h-[90vh] flex flex-col overflow-hidden border border-[var(--header-border)] animate-in zoom-in-95 duration-300">
          <div className="h-12 shrink-0 px-4 border-b border-[var(--header-border)] bg-[var(--app-bg)]/30 flex items-center gap-3">
            <h2 className="flex-1 text-base font-black text-slate-800 dark:text-slate-100 tracking-tight">
              {t.settings}
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
            <div className="w-52 bg-[var(--app-bg)]/30 border-r border-[var(--header-border)] flex flex-col p-5 shrink-0">
              <div className="flex-1 space-y-1.5">
                {[
                  { id: 'appearance', label: t.theme, icon: <ImageIcon className="w-4 h-4" /> },
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
                  { id: 'ai', label: t.aiSettings, icon: <BrainCircuit className="w-4 h-4" /> },
                  {
                    id: 'about',
                    label: s.aboutTab,
                    icon: <MessageCircle className="w-4 h-4" />,
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSettingsTab(tab.id as any)}
                    className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
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
                {t.finish}
              </button>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full bg-transparent overflow-y-auto p-8 pt-7 custom-scrollbar">
              {activeSettingsTab === 'appearance' && (
                <div className="space-y-5 animate-in slide-in-from-right-4 duration-500">
                  <section>
                    <header className="hidden">
                      <h3 className="text-base font-black text-[var(--text-primary)]">
                        {s.themeLanguage}
                      </h3>
                    </header>
                    <div className="grid grid-cols-1 gap-3">
                      <div className={settingsRowClass}>
                        <h3 className={settingsRowTitleClass}>{t.theme}</h3>
                        <div className={segmentedControlClass}>
                          <button
                            onClick={() => {
                              setTheme('light');
                              if (canvasBg === presetColors[1]) setCanvasBg(presetColors[0]);
                            }}
                            className={compactTextButtonClass(theme === 'light')}
                          >
                            {t.lightMode}
                          </button>
                          <button
                            onClick={() => {
                              setTheme('dark');
                              if (canvasBg === presetColors[0]) setCanvasBg(presetColors[1]);
                            }}
                            className={compactTextButtonClass(theme === 'dark')}
                          >
                            {t.darkMode}
                          </button>
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
                            English
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
                        {t.vertical}
                      </button>
                      <button
                        onClick={() => setToolbarLayout('horizontal')}
                        className={compactSegmentButtonClass(toolbarLayout === 'horizontal')}
                      >
                        {t.horizontal}
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
                      <header className="flex items-center gap-3">
                        <h3 className="text-base font-black text-[var(--text-primary)]">
                          {s.glassReadability}
                        </h3>
                      </header>
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

                  <section className={settingsRowClass}>
                    <h3 className={settingsRowTitleClass}>{s.selectionMenu}</h3>
                    <div className={segmentedControlClass}>
                      <button
                        onClick={() => setSelectionMenuLayout('horizontal')}
                        className={compactSegmentButtonClass(selectionMenuLayout === 'horizontal')}
                      >
                        {t.menuHorizontal}
                      </button>
                      <button
                        onClick={() => setSelectionMenuLayout('vertical')}
                        className={compactSegmentButtonClass(selectionMenuLayout === 'vertical')}
                      >
                        {t.menuVertical}
                      </button>
                    </div>
                  </section>

                  <section className="grid grid-cols-2 gap-x-8 gap-y-0">
                    {[
                      {
                        id: 'showStats',
                        label: t.showStats,
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
                        label: t.showMiniMap,
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
                      <h3 className={settingsRowTitleClass}>{t.miniMapPosition}</h3>
                      <div className={segmentedControlClass}>
                        <button
                          onClick={() => setMiniMapPosition('left')}
                          className={compactSegmentButtonClass(miniMapPosition === 'left')}
                        >
                          <span className="flex items-center justify-center gap-1.5">
                            <ArrowLeft className="w-3.5 h-3.5" />
                            {t.miniMapLeft}
                          </span>
                        </button>
                        <button
                          onClick={() => setMiniMapPosition('right')}
                          className={compactSegmentButtonClass(miniMapPosition === 'right')}
                        >
                          <span className="flex items-center justify-center gap-1.5">
                            {t.miniMapRight}
                            <ArrowRight className="w-3.5 h-3.5" />
                          </span>
                        </button>
                      </div>
                    </section>
                  )}

                  <section className={settingsRowClass}>
                    <h3 className={settingsRowTitleClass}>{t.showControls}</h3>
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
                        {t.bgColors}
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
                    <p className="text-xs text-[var(--text-muted)] font-medium px-4">
                      {s.bgColorsDesc}
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

                  <div className="border-t border-[var(--header-border)]" />

                  <section className={settingsRowClass}>
                    <div className="min-w-0 flex-1">
                      <h3 className={settingsRowTitleClass}>{s.hoverButtonAnimations}</h3>
                      <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
                        {s.hoverButtonAnimationsDesc}
                      </p>
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
                    <h3 className={settingsRowTitleClass}>{t.edgeStyle}</h3>
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
                          {t.step}
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
                          {t.bezier}
                        </span>
                      </button>
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
                              : 'text-[var(--text-muted)] hover:bg-[var(--card-bg)]/60 hover:text-[var(--text-primary)]'
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

                  <section className={settingsRowClass}>
                    <h3 className={settingsRowTitleClass}>
                      {language === 'zh'
                        ? '文字转音频内容'
                        : language === 'ja'
                          ? '音声化する内容'
                          : 'Text-to-audio content'}
                    </h3>
                    <div className={segmentedControlClass}>
                      {[
                        {
                          id: 'body',
                          label: language === 'zh' ? '正文' : language === 'ja' ? '本文' : 'Body',
                        },
                        {
                          id: 'title',
                          label:
                            language === 'zh' ? '标题' : language === 'ja' ? 'タイトル' : 'Title',
                        },
                        {
                          id: 'all',
                          label:
                            language === 'zh'
                              ? '标题+正文'
                              : language === 'ja'
                                ? 'タイトル+本文'
                                : 'Title + Body',
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

                  <section className="space-y-4">
                    <div>
                      <h3 className="text-base font-black text-[var(--text-primary)]">
                        {language === 'zh'
                          ? '人物图片类型'
                          : language === 'ja'
                            ? 'キャラクター画像タイプ'
                            : 'Character Image Type'}
                      </h3>
                      <p className="mt-1 text-xs font-medium leading-5 text-[var(--text-muted)]">
                        {language === 'zh'
                          ? '人物卡片的一键生图会根据这里选择的形式生成图片。'
                          : language === 'ja'
                            ? 'キャラクターカードの画像生成形式を選択します。'
                            : 'Choose the format used by character card image generation.'}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {[
                        {
                          value: 'three-view' as const,
                          title:
                            language === 'zh'
                              ? '三视图'
                              : language === 'ja'
                                ? '三面図'
                                : 'Three-view',
                          description:
                            language === 'zh'
                              ? '在一张图中生成正面、侧面和背面设定图。'
                              : language === 'ja'
                                ? '正面・側面・背面を1枚に生成します。'
                                : 'Front, side, and back views in one image.',
                        },
                        {
                          value: 'transparent-sprite' as const,
                          title:
                            language === 'zh'
                              ? '透明背景立绘'
                              : language === 'ja'
                                ? '透過背景立ち絵'
                                : 'Transparent Sprite',
                          description:
                            language === 'zh'
                              ? '生成单人全身立绘，并要求透明背景。'
                              : language === 'ja'
                                ? '透過背景の全身立ち絵を生成します。'
                                : 'A single full-body character on a transparent background.',
                        },
                      ].map((option) => {
                        const selected = characterImageMode === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setCharacterImageMode(option.value)}
                            className={`rounded-xl border p-4 text-left transition-all ${
                              selected
                                ? 'border-[var(--accent)] bg-[var(--accent)]/5 shadow-sm'
                                : 'border-[var(--header-border)] bg-[var(--app-bg)]/30 hover:border-[var(--accent)]/50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-black text-[var(--text-primary)]">
                                {option.title}
                              </span>
                              <span
                                className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                                  selected
                                    ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                                    : 'border-[var(--header-border)] text-transparent'
                                }`}
                              >
                                <Check className="h-3 w-3" />
                              </span>
                            </div>
                            <p className="mt-2 text-xs font-medium leading-5 text-[var(--text-muted)]">
                              {option.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div>
                      <h3 className="text-base font-black text-[var(--text-primary)]">
                        {language === 'zh'
                          ? '场景图片比例'
                          : language === 'ja'
                            ? 'シーン画像比率'
                            : 'Scene Image Ratio'}
                      </h3>
                      <p className="mt-1 text-xs font-medium leading-5 text-[var(--text-muted)]">
                        {language === 'zh'
                          ? '只影响场景卡片的一键生图，优先级高于图片 API 配置中的尺寸。'
                          : language === 'ja'
                            ? 'シーンカードの画像生成にのみ適用され、画像 API のサイズ設定より優先されます。'
                            : 'Only affects scene card generation and overrides the image API size.'}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {[
                        {
                          value: 'storyboard-16:9' as const,
                          title:
                            language === 'zh'
                              ? '16:9 分镜图'
                              : language === 'ja'
                                ? '16:9 絵コンテ'
                                : '16:9 Storyboard',
                          description:
                            language === 'zh'
                              ? '强制请求并输出横向 16:9 场景图。'
                              : language === 'ja'
                                ? '横長 16:9 のシーン画像を強制します。'
                                : 'Force a landscape 16:9 scene image.',
                        },
                        {
                          value: 'follow-api' as const,
                          title:
                            language === 'zh'
                              ? '跟随图片 API'
                              : language === 'ja'
                                ? '画像 API に従う'
                                : 'Follow Image API',
                          description:
                            language === 'zh'
                              ? '使用图片 AI 配置中填写的普通图片尺寸。'
                              : language === 'ja'
                                ? '画像 AI 設定の通常サイズを使用します。'
                                : 'Use the size configured in the image AI profile.',
                        },
                      ].map((option) => {
                        const selected = sceneImageMode === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setSceneImageMode(option.value)}
                            className={`rounded-xl border p-4 text-left transition-all ${
                              selected
                                ? 'border-[var(--accent)] bg-[var(--accent)]/5 shadow-sm'
                                : 'border-[var(--header-border)] bg-[var(--app-bg)]/30 hover:border-[var(--accent)]/50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-black text-[var(--text-primary)]">
                                {option.title}
                              </span>
                              <span
                                className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                                  selected
                                    ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                                    : 'border-[var(--header-border)] text-transparent'
                                }`}
                              >
                                <Check className="h-3 w-3" />
                              </span>
                            </div>
                            <p className="mt-2 text-xs font-medium leading-5 text-[var(--text-muted)]">
                              {option.description}
                            </p>
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
                          label: t.showMiniMap,
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
                <div className="space-y-5 animate-in slide-in-from-right-4 duration-500 pb-8">
                  <section className="space-y-5">
                    <header className="flex items-center gap-3 mb-2">
                      <h3 className="text-base font-black text-[var(--text-primary)]">
                        {s.playtestThemeLayout}
                      </h3>
                    </header>

                    {/* Playtest Layout Mode */}
                    <div className={settingsRowClass}>
                      <h3 className={settingsRowTitleClass}>{t.playtestLayoutMode}</h3>
                      <div className={segmentedControlClass}>
                        <button
                          onClick={() => setPlayTestLayoutMode('classic')}
                          className={compactSegmentButtonClass(playTestLayoutMode === 'classic')}
                        >
                          {t.layoutClassic}
                        </button>
                        <button
                          onClick={() => setPlayTestLayoutMode('immersive')}
                          className={compactSegmentButtonClass(playTestLayoutMode === 'immersive')}
                        >
                          {t.layoutImmersive}
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
                            {t.lightMode}
                          </button>
                          <button
                            onClick={() => setPlayTestDarkMode(true)}
                            className={compactSegmentButtonClass(playTestDarkMode)}
                          >
                            {t.darkMode}
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
                          className={compactSegmentButtonClass(playTestChoicesPosition === pos.id)}
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
                      <h3 className={settingsRowTitleClass}>{t.choiceColumns}</h3>
                      <div className={segmentedControlClass}>
                        {[1, 2, 3].map((cols) => (
                          <button
                            key={cols}
                            onClick={() => setPlayTestChoicesColumns(cols)}
                            className={compactSegmentButtonClass(playTestChoicesColumns === cols)}
                          >
                            {t[`column${cols}` as keyof typeof t]}
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
                              className={compactSegmentButtonClass(playTestBlurText === opt.value)}
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
                            theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'
                          }
                        >
                          {s.immediateMode}
                        </option>
                        <option
                          value="typewriter"
                          className={
                            theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'
                          }
                        >
                          {s.typewriterMode}
                        </option>
                        <option
                          value="timed"
                          className={
                            theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'
                          }
                        >
                          {s.timedMode}
                        </option>
                        <option
                          value="clickToShow"
                          className={
                            theme === 'dark' ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'
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
                            onChange={(e) => setPlayTestTypewriterSpeed(parseInt(e.target.value))}
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
                        {t.videoAutoPlay}
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
                    <h3 className={settingsRowTitleClass}>
                      {language === 'zh'
                        ? '标签显示'
                        : language === 'ja'
                          ? 'タグ表示'
                          : 'Tag Display'}
                    </h3>
                    <div className={settingsRowClass}>
                      <h3 className={settingsRowTitleClass}>
                        {language === 'zh'
                          ? '隐藏人物标签'
                          : language === 'ja'
                            ? 'キャラクタータグを非表示'
                            : 'Hide character tags'}
                      </h3>
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
                      <h3 className={settingsRowTitleClass}>
                        {language === 'zh'
                          ? '隐藏场景标签'
                          : language === 'ja'
                            ? 'シーンタグを非表示'
                            : 'Hide scene tags'}
                      </h3>
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
                </div>
              )}

              {activeSettingsTab === 'ai' && (
                <AISettingsPanel
                  language={language}
                  savedAIProfiles={savedAIProfiles}
                  activeTextProfileId={activeTextProfileId}
                  activeImageProfileId={activeImageProfileId}
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
                />
              )}

              {activeSettingsTab === 'about' && aboutPage === 'contact' && (
                <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
                  <section>
                    <header className="flex items-center gap-3 mb-6">
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
                        href="https://mingwencui.com"
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
                    <BrainCircuit className="w-12 h-12 text-indigo-500 dark:text-sky-400 mx-auto mb-6 relative z-10" />
                    <h4 className="text-xl font-black text-slate-900 dark:text-white mb-2 relative z-10">
                      {s.aboutProductTitle}
                    </h4>
                    <p className="text-indigo-600/40 dark:text-sky-400/40 text-xs font-bold uppercase tracking-[0.4em] mb-6 relative z-10">
                      AIGC x Narrative Architecture
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
                {t.cancel}
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

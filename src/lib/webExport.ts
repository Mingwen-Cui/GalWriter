import type { Edge as FlowEdge, Node as FlowNode } from '@xyflow/react';
import JSZip from 'jszip';

type WebExportOptions = {
  projectName?: string;
  language: 'zh' | 'ja' | 'en';
  style?: WebExportStyle;
  settings?: WebExportSettings;
};

type WebExportStyle = {
  titleFontSize: number;
  bodyFontSize: number;
  titleColor: string;
  bodyColor: string;
  panelColor: string;
  titleAnimation: 'none' | 'fade' | 'slideUp' | 'typewriter';
  bodyAnimation: 'none' | 'fade' | 'slideUp' | 'typewriter';
  choiceColor: string;
  choiceTextColor: string;
};

type WebExportSettings = {
  layoutMode: 'classic' | 'immersive';
  choicesPosition: 'center' | 'aboveText' | 'belowText';
  blurBackground: boolean;
  skipSingleChoicePopup: boolean;
  interactionMode: 'immediate' | 'typewriter';
  typewriterSpeed: number;
  autoAdvance: boolean;
  videoAutoPlay: boolean;
  dialoguePanelHeight: number;
};

type WebExportNode = {
  id: string;
  type?: string;
  data: {
    title?: string;
    text?: string;
    color?: string;
    imageUrl?: string;
    videoUrl?: string;
    audioUrl?: string;
    objectFit?: string;
    showTextOverlay?: boolean;
    isRoot?: boolean;
  };
};

type WebExportEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  label?: string;
};

const IMAGE_EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
};

const safeFilePart = (value: string) =>
  value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'galwriter';

const getDataUrlMime = (url: string) => url.match(/^data:([^;,]+)/i)?.[1]?.toLowerCase() || '';

const getImageExtension = (url: string, fallback = 'png') => {
  const dataMime = getDataUrlMime(url);
  if (dataMime && IMAGE_EXTENSION_BY_MIME[dataMime]) return IMAGE_EXTENSION_BY_MIME[dataMime];
  const cleanUrl = url.split('?')[0].split('#')[0];
  const ext = cleanUrl.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
  return ext || fallback;
};

const isPackableImage = (url: unknown): url is string => {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:image/')) return true;
  if (trimmed.startsWith('blob:')) return true;
  return /^https?:\/\//i.test(trimmed) || /^\.?\//.test(trimmed);
};

const addImageAsset = async (
  zip: JSZip,
  url: string | undefined,
  hint: string,
  assetMap: Map<string, string>,
) => {
  if (!isPackableImage(url)) return url;
  if (assetMap.has(url)) return assetMap.get(url);

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const extension = getImageExtension(url, IMAGE_EXTENSION_BY_MIME[blob.type] || 'png');
    const fileName = `images/${safeFilePart(hint)}-${assetMap.size + 1}.${extension}`;
    zip.file(fileName, blob);
    const relativePath = `./${fileName}`;
    assetMap.set(url, relativePath);
    return relativePath;
  } catch (error) {
    console.warn('Could not pack web export image:', error);
    return url;
  }
};

const nodeTitle = (node: FlowNode) =>
  String(
    node.data?.title ||
      node.data?.characterName ||
      node.data?.sceneName ||
      node.data?.label ||
      'Untitled',
  );

const nodeText = (node: FlowNode) =>
  String(node.data?.text || node.data?.description || node.data?.content || '');

const makeContentScript = (payload: {
  title: string;
  language: string;
  style: WebExportStyle;
  settings: WebExportSettings;
  nodes: WebExportNode[];
  edges: WebExportEdge[];
}) => `window.GALWRITER_CONTENT = ${JSON.stringify(payload, null, 2)};\n`;

const makeIndexHtml = (title: string, language: string) => `<!doctype html>
<html lang="${language === 'zh' ? 'zh-CN' : language === 'ja' ? 'ja' : 'en'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <script src="./content.js"></script>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: #10131a;
      color: #f8fafc;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    button { font: inherit; }
    .app {
      width: 100vw;
      height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr;
      overflow: hidden;
      background:
        linear-gradient(180deg, rgba(15, 23, 42, 0.20), rgba(15, 23, 42, 0.84)),
        #10131a;
    }
    .app.immersive header {
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      z-index: 5;
      border-bottom: 0;
      background: linear-gradient(180deg, rgba(0,0,0,0.72), rgba(0,0,0,0.34), transparent);
      box-shadow: 0 16px 40px rgba(0,0,0,0.28);
    }
    .app.controls-hidden header {
      opacity: 0;
      pointer-events: none;
    }
    header {
      min-height: 56px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 18px;
      border-bottom: 1px solid rgba(255,255,255,0.12);
      background: rgba(10, 13, 20, 0.52);
      backdrop-filter: blur(16px);
      transition: opacity 180ms ease;
    }
    h1 { display: none; margin: 0; font-size: 15px; letter-spacing: 0; }
    .toolbar { display: flex; align-items: center; gap: 8px; }
    .settings-wrap { position: relative; }
    .tool {
      border: 1px solid rgba(255,255,255,0.16);
      background: rgba(255,255,255,0.08);
      color: #f8fafc;
      border-radius: 8px;
      padding: 8px 11px;
      cursor: pointer;
    }
    .tool:disabled { opacity: 0.4; cursor: not-allowed; }
    .settings-menu {
      position: absolute;
      right: 0;
      top: calc(100% + 10px);
      z-index: 20;
      width: min(560px, calc(100vw - 24px));
      max-height: min(72vh, 560px);
      overflow: auto;
      padding: 14px;
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 16px;
      background: rgba(8, 11, 18, 0.94);
      box-shadow: 0 24px 80px rgba(0,0,0,0.42);
      backdrop-filter: blur(18px);
    }
    .settings-menu[hidden] { display: none; }
    .settings-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .settings-card {
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px;
      background: rgba(255,255,255,0.04);
      padding: 12px;
    }
    .settings-card.wide { grid-column: 1 / -1; }
    .settings-label {
      margin: 0 0 8px;
      color: rgba(248,250,252,0.52);
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0;
      text-transform: uppercase;
    }
    .settings-buttons {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .settings-buttons.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .settings-option {
      min-height: 34px;
      border: 0;
      border-radius: 8px;
      background: rgba(255,255,255,0.10);
      color: rgba(248,250,252,0.78);
      padding: 8px;
      font-size: 12px;
      font-weight: 900;
      cursor: pointer;
    }
    .settings-option.active {
      background: #0ea5e9;
      color: #ffffff;
    }
    .settings-range-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      color: rgba(248,250,252,0.80);
      font-size: 12px;
      font-weight: 900;
    }
    .settings-range { width: 100%; accent-color: #38bdf8; }
    main {
      position: relative;
      min-height: 0;
      display: grid;
      place-items: center;
      padding: 24px;
      overflow: hidden;
    }
    .app.immersive main {
      padding: 0;
    }
    .backdrop {
      position: absolute;
      inset: 0;
      background-position: center;
      background-size: cover;
      opacity: 0.72;
      transform: scale(1.02);
      transition: background-image 180ms ease, opacity 180ms ease;
    }
    .backdrop.blurred {
      filter: blur(14px);
      transform: scale(1.08);
    }
    .backdrop::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(8,11,18,0.25), rgba(8,11,18,0.72));
    }
    .stage {
      position: relative;
      z-index: 1;
      width: min(1100px, 100%);
      height: min(720px, calc(100vh - 112px));
      max-height: calc(100vh - 112px);
      display: grid;
      grid-template-rows: minmax(0, 1fr) auto;
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(12, 16, 24, 0.76);
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 24px 80px rgba(0,0,0,0.42);
      backdrop-filter: blur(18px);
    }
    .app.immersive .stage {
      width: 100%;
      height: 100vh;
      max-height: 100vh;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      backdrop-filter: none;
    }
    .media {
      position: relative;
      min-height: 0;
      display: grid;
      place-items: center;
      background: rgba(0,0,0,0.24);
      overflow: hidden;
    }
    .media img, .media video {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    .app.immersive .media img,
    .app.immersive .media video {
      object-fit: cover;
    }
    .media.empty { color: rgba(248,250,252,0.42); font-weight: 700; }
    .dialogue {
      border-top: 1px solid rgba(255,255,255,0.14);
      height: var(--dialogue-height, 34vh);
      max-height: var(--dialogue-height, 34vh);
      padding: clamp(14px, 2.5vw, 20px);
      background: color-mix(in srgb, var(--panel-color, rgba(7, 10, 16, 0.82)), transparent 18%);
      overflow: hidden;
    }
    .app.immersive .dialogue {
      align-self: end;
      margin: 0 auto clamp(14px, 3vh, 24px);
      width: min(960px, calc(100% - 112px));
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px;
      background: color-mix(in srgb, var(--panel-color, rgba(7, 10, 16, 0.82)), transparent 36%);
      box-shadow: 0 24px 80px rgba(0,0,0,0.30);
      backdrop-filter: blur(18px);
    }
    .title {
      margin: 0 0 8px;
      color: var(--title-color, #f8fafc);
      font-size: var(--title-size, 18px);
      font-weight: 900;
      line-height: 1.18;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .text {
      height: 100%;
      max-height: 100%;
      color: var(--body-color, #e5e7eb);
      line-height: 1.55;
      font-size: var(--body-size, 16px);
      overflow: hidden;
      overflow-wrap: anywhere;
    }
    .zen-toggle {
      position: absolute;
      left: 24px;
      bottom: 24px;
      z-index: 18;
      width: 44px;
      height: 44px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(0,0,0,0.44);
      color: #f8fafc;
      box-shadow: 0 18px 48px rgba(0,0,0,0.28);
      backdrop-filter: blur(14px);
      cursor: pointer;
    }
    .zen-toggle:hover { background: rgba(0,0,0,0.62); }
    .text :first-child { margin-top: 0; }
    .text :last-child { margin-bottom: 0; }
    .choices {
      display: grid;
      gap: 10px;
      margin-top: 18px;
    }
    .choices.above { margin-bottom: 14px; margin-top: 0; }
    .choices.center {
      position: absolute;
      left: 50%;
      top: 50%;
      z-index: 6;
      width: min(520px, calc(100% - 32px));
      max-height: min(62vh, 420px);
      transform: translate(-50%, -50%);
      margin: 0;
    }
    .choice {
      width: 100%;
      border: 1px solid color-mix(in srgb, var(--choice-color, #0ea5e9), white 25%);
      background: color-mix(in srgb, var(--choice-color, #0ea5e9), transparent 20%);
      color: var(--choice-text-color, #ffffff);
      border-radius: 8px;
      padding: 12px 14px;
      text-align: left;
      line-height: 1.35;
      cursor: pointer;
      transition: background 140ms ease, border-color 140ms ease;
    }
    .choice:hover {
      background: color-mix(in srgb, var(--choice-color, #0ea5e9), transparent 68%);
      border-color: color-mix(in srgb, var(--choice-color, #0ea5e9), white 52%);
    }
    .anim-fade { animation: fadeIn 360ms ease both; }
    .anim-slideUp { animation: slideUp 360ms ease both; }
    .anim-typewriter { animation: fadeIn 180ms ease both; }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .end {
      min-height: 100%;
      display: grid;
      place-items: center;
      padding: 48px 20px;
      text-align: center;
      color: #e2e8f0;
      font-size: 24px;
      font-weight: 900;
    }
    @media (max-width: 720px) {
      main { padding: 0; }
      header { align-items: flex-start; flex-direction: column; }
      .toolbar { width: 100%; }
      .tool { flex: 1; }
      .stage {
        height: calc(100vh - 138px);
        max-height: calc(100vh - 138px);
      }
      .app.immersive .stage {
        height: 100vh;
        max-height: 100vh;
      }
      .dialogue { padding: 16px; }
      .app.immersive .dialogue {
        width: calc(100% - 80px);
        margin-right: 12px;
      }
      .settings-grid { grid-template-columns: 1fr; }
      .settings-menu { right: -88px; }
    }
  </style>
</head>
<body>
  <div class="app">
    <header>
      <h1 id="projectTitle"></h1>
      <div class="toolbar">
        <button class="tool" id="backButton" type="button"></button>
        <button class="tool" id="resetButton" type="button"></button>
        <div class="settings-wrap">
          <button class="tool" id="settingsButton" type="button" aria-haspopup="true" aria-expanded="false">&#9881;</button>
          <div class="settings-menu" id="settingsMenu" hidden></div>
        </div>
      </div>
    </header>
    <main>
      <div class="backdrop" id="backdrop"></div>
      <section class="stage" id="stage"></section>
      <button class="zen-toggle" id="zenButton" type="button" aria-label="Toggle controls">◉</button>
    </main>
  </div>
  <script>
    const content = window.GALWRITER_CONTENT || { nodes: [], edges: [], title: "GalWriter" };
    const style = content.style || {};
    const settings = content.settings || {};
    settings.layoutMode = settings.layoutMode || "immersive";
    settings.choicesPosition = settings.choicesPosition || "center";
    settings.interactionMode = settings.interactionMode || "typewriter";
    settings.typewriterSpeed = Math.max(0, Number(settings.typewriterSpeed) || 65);
    settings.autoAdvance = Boolean(settings.autoAdvance);
    settings.videoAutoPlay = Boolean(settings.videoAutoPlay);
    settings.blurBackground = Boolean(settings.blurBackground);
    settings.skipSingleChoicePopup = settings.skipSingleChoicePopup !== false;
    settings.dialoguePanelHeight = Math.max(18, Math.min(55, Number(settings.dialoguePanelHeight) || 34));
    document.documentElement.style.setProperty("--title-size", Math.max(12, Number(style.titleFontSize) || 18) + "px");
    document.documentElement.style.setProperty("--body-size", Math.max(12, Number(style.bodyFontSize) || 16) + "px");
    document.documentElement.style.setProperty("--title-color", style.titleColor || "#f8fafc");
    document.documentElement.style.setProperty("--body-color", style.bodyColor || "#e5e7eb");
    document.documentElement.style.setProperty("--panel-color", style.panelColor || "rgba(7, 10, 16, 0.82)");
    document.documentElement.style.setProperty("--choice-color", style.choiceColor || "#0ea5e9");
    document.documentElement.style.setProperty("--choice-text-color", style.choiceTextColor || "#ffffff");
    document.documentElement.style.setProperty("--dialogue-height", settings.dialoguePanelHeight + "vh");
    const labels = content.language === "zh"
      ? { back: "\\u8fd4\\u56de", reset: "\\u91cd\\u7f6e", continue: "\\u7ee7\\u7eed", option: "\\u9009\\u9879", end: "\\u5267\\u672c\\u7ed3\\u675f", noStory: "\\u6ca1\\u6709\\u53ef\\u9884\\u89c8\\u7684\\u5267\\u672c" }
      : content.language === "ja"
        ? { back: "\\u623b\\u308b", reset: "\\u30ea\\u30bb\\u30c3\\u30c8", continue: "\\u7d9a\\u3051\\u308b", option: "\\u9078\\u629e\\u80a2", end: "\\u7d42\\u4e86", noStory: "\\u30d7\\u30ec\\u30d3\\u30e5\\u30fc\\u3067\\u304d\\u308b\\u811a\\u672c\\u304c\\u3042\\u308a\\u307e\\u305b\\u3093" }
        : { back: "Back", reset: "Reset", continue: "Continue", option: "Option", end: "The End", noStory: "No story to preview" };
    const menuText = content.language === "zh"
      ? {
          layout: "\\u754c\\u9762\\u6392\\u7248",
          classic: "\\u7ecf\\u5178",
          immersive: "\\u6c89\\u6d78",
          choices: "\\u9009\\u9879\\u4f4d\\u7f6e",
          center: "\\u4e2d\\u95f4",
          above: "\\u4e0a\\u65b9",
          below: "\\u4e0b\\u65b9",
          interaction: "\\u4ea4\\u4e92",
          typewriter: "\\u6253\\u5b57\\u673a",
          immediate: "\\u7acb\\u5373\\u663e\\u793a",
          auto: "\\u81ea\\u52a8\\u7ffb\\u9875",
          autoOn: "\\u81ea\\u52a8",
          manual: "\\u624b\\u52a8",
          display: "\\u663e\\u793a\\u6548\\u679c",
          blur: "\\u80cc\\u666f\\u865a\\u5316",
          skipSingle: "\\u9690\\u85cf\\u5355\\u9009",
          media: "\\u5a92\\u4f53",
          autoplay: "\\u89c6\\u9891\\u81ea\\u52a8\\u64ad\\u653e",
          height: "\\u6807\\u9898\\u6b63\\u6587\\u80cc\\u666f\\u9ad8\\u5ea6"
        }
      : {
          layout: "Layout",
          classic: "Classic",
          immersive: "Immersive",
          choices: "Choice Position",
          center: "Center",
          above: "Above",
          below: "Below",
          interaction: "Interaction",
          typewriter: "Typewriter",
          immediate: "Immediate",
          auto: "Auto Advance",
          autoOn: "On",
          manual: "Manual",
          display: "Display",
          blur: "Backdrop Blur",
          skipSingle: "Skip Single",
          media: "Media",
          autoplay: "Video Autoplay",
          height: "Title and Body Background Height"
        };
    const nodeById = new Map(content.nodes.map((node) => [node.id, node]));
    const root = content.nodes.find((node) => node.data && node.data.isRoot) || content.nodes[0] || null;
    let currentId = root ? root.id : null;
    let history = [];

    const titleEl = document.getElementById("projectTitle");
    const stageEl = document.getElementById("stage");
    const backdropEl = document.getElementById("backdrop");
    const backButton = document.getElementById("backButton");
    const resetButton = document.getElementById("resetButton");
    const settingsButton = document.getElementById("settingsButton");
    const settingsMenu = document.getElementById("settingsMenu");
    const zenButton = document.getElementById("zenButton");
    titleEl.textContent = content.title || "GalWriter";
    backButton.textContent = labels.back;
    resetButton.textContent = labels.reset;
    document.querySelector(".app").classList.toggle("immersive", settings.layoutMode === "immersive");
    backdropEl.classList.toggle("blurred", settings.blurBackground);
    let typewriterTimers = [];
    let autoAdvanceTimer = null;
    let controlsHidden = false;

    function nodeTitle(node) {
      return (node && node.data && node.data.title) || labels.option;
    }

    function activeClass(condition) {
      return condition ? " active" : "";
    }

    function settingButton(label, action, value, active) {
      return '<button class="settings-option' + activeClass(active) + '" type="button" data-action="' + action + '" data-value="' + value + '">' + label + '</button>';
    }

    function renderSettingsMenu() {
      settingsMenu.innerHTML =
        '<div class="settings-grid">' +
          '<div class="settings-card">' +
            '<div class="settings-label">' + menuText.layout + '</div>' +
            '<div class="settings-buttons">' +
              settingButton(menuText.classic, "layoutMode", "classic", settings.layoutMode === "classic") +
              settingButton(menuText.immersive, "layoutMode", "immersive", settings.layoutMode === "immersive") +
            '</div>' +
          '</div>' +
          '<div class="settings-card">' +
            '<div class="settings-label">' + menuText.choices + '</div>' +
            '<div class="settings-buttons three">' +
              settingButton(menuText.center, "choicesPosition", "center", settings.choicesPosition === "center") +
              settingButton(menuText.above, "choicesPosition", "aboveText", settings.choicesPosition === "aboveText") +
              settingButton(menuText.below, "choicesPosition", "belowText", settings.choicesPosition === "belowText") +
            '</div>' +
          '</div>' +
          '<div class="settings-card">' +
            '<div class="settings-label">' + menuText.interaction + '</div>' +
            '<div class="settings-buttons">' +
              settingButton(menuText.typewriter, "interactionMode", "typewriter", settings.interactionMode === "typewriter") +
              settingButton(menuText.immediate, "interactionMode", "immediate", settings.interactionMode === "immediate") +
            '</div>' +
          '</div>' +
          '<div class="settings-card">' +
            '<div class="settings-label">' + menuText.auto + '</div>' +
            '<div class="settings-buttons">' +
              settingButton(menuText.autoOn, "autoAdvance", "true", settings.autoAdvance) +
              settingButton(menuText.manual, "autoAdvance", "false", !settings.autoAdvance) +
            '</div>' +
          '</div>' +
          '<div class="settings-card">' +
            '<div class="settings-label">' + menuText.display + '</div>' +
            '<div class="settings-buttons">' +
              settingButton(menuText.blur, "blurBackground", String(!settings.blurBackground), settings.blurBackground) +
              settingButton(menuText.skipSingle, "skipSingleChoicePopup", String(!settings.skipSingleChoicePopup), settings.skipSingleChoicePopup) +
            '</div>' +
          '</div>' +
          '<div class="settings-card">' +
            '<div class="settings-label">' + menuText.media + '</div>' +
            settingButton(menuText.autoplay, "videoAutoPlay", String(!settings.videoAutoPlay), settings.videoAutoPlay) +
          '</div>' +
          '<label class="settings-card wide">' +
            '<div class="settings-range-row"><span>' + menuText.height + '</span><span id="heightValue">' + settings.dialoguePanelHeight + '%</span></div>' +
            '<input class="settings-range" id="dialogueHeightInput" type="range" min="18" max="55" step="1" value="' + settings.dialoguePanelHeight + '" />' +
          '</label>' +
        '</div>';
    }

    function applyRuntimeSettings() {
      document.querySelector(".app").classList.toggle("immersive", settings.layoutMode === "immersive");
      backdropEl.classList.toggle("blurred", settings.blurBackground);
      document.documentElement.style.setProperty("--dialogue-height", settings.dialoguePanelHeight + "vh");
      renderSettingsMenu();
      render();
    }

    function outEdges(id) {
      return content.edges.filter((edge) => edge.source === id);
    }

    function goTo(id) {
      if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
      if (currentId) history.push(currentId);
      currentId = id;
      render();
    }

    function animationClass(animation) {
      return animation && animation !== "none" ? " anim-" + animation : "";
    }

    function applyTypewriter(element, html, enabled, revealChoices) {
      if (!element) return;
      if (!enabled) {
        element.innerHTML = html || "";
        if (revealChoices) showChoicesAndMaybeAdvance();
        return;
      }
      const temp = document.createElement("div");
      temp.innerHTML = html || "";
      const source = temp.textContent || "";
      let index = 0;
      element.textContent = "";
      const timer = setInterval(() => {
        index += 1;
        element.textContent = source.slice(0, index);
        if (index >= source.length) {
          clearInterval(timer);
          typewriterTimers = typewriterTimers.filter((item) => item !== timer);
          if (revealChoices) showChoicesAndMaybeAdvance();
        }
      }, settings.typewriterSpeed);
      typewriterTimers.push(timer);
    }

    function choicesHtml(node, edges, className) {
      if (!edges.length) {
        return '<div class="choices ' + className + '"><button class="choice anim-fade" data-target="THE_END">' + labels.end + '</button></div>';
      }
      const buttons = edges.map((edge, index) => {
        const target = nodeById.get(edge.target);
        const label = nodeTitle(target) || edge.label || (edges.length === 1 ? labels.continue : labels.option + " " + (index + 1));
        return '<button class="choice anim-fade" data-target="' + escapeAttr(edge.target) + '">' + escapeHtml(label) + '</button>';
      }).join("");
      return '<div class="choices ' + className + '">' + buttons + '</div>';
    }

    function renderChoices(node, edges, position) {
      if (settings.skipSingleChoicePopup && position === "center" && edges.length <= 1) return "";
      return choicesHtml(node, edges, position);
    }

    function bindChoices() {
      stageEl.querySelectorAll("[data-target]").forEach((button) => {
        button.addEventListener("click", () => goTo(button.getAttribute("data-target")));
      });
    }

    function showChoicesAndMaybeAdvance() {
      stageEl.querySelectorAll(".choices").forEach((element) => {
        element.hidden = false;
      });
      bindChoices();
      if (settings.autoAdvance && outEdges(currentId).length <= 1) {
        autoAdvanceTimer = setTimeout(() => {
          const next = outEdges(currentId)[0]?.target || "THE_END";
          goTo(next);
        }, 900);
      }
    }

    function continueFromText() {
      const edges = outEdges(currentId);
      if (edges.length <= 1) {
        goTo(edges[0]?.target || "THE_END");
      }
    }

    function render() {
      if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
      typewriterTimers.forEach((timer) => clearInterval(timer));
      typewriterTimers = [];
      backButton.disabled = history.length === 0;
      if (!currentId) {
        backdropEl.style.backgroundImage = "";
        stageEl.innerHTML = '<div class="end">' + labels.noStory + '</div>';
        return;
      }
      if (currentId === "THE_END") {
        stageEl.innerHTML = '<div class="end">' + labels.end + '</div>';
        return;
      }
      const node = nodeById.get(currentId);
      if (!node) {
        currentId = "THE_END";
        render();
        return;
      }
      const data = node.data || {};
      const edges = outEdges(currentId);
      const choicePosition = settings.choicesPosition || "belowText";
      const image = data.imageUrl || "";
      const video = data.videoUrl || "";
      const media = image
        ? '<img src="' + escapeAttr(image) + '" alt="" />'
        : video
          ? '<video src="' + escapeAttr(video) + '" controls playsinline ' + (settings.videoAutoPlay ? 'autoplay muted ' : '') + '></video>'
          : labels.noStory;
      backdropEl.style.backgroundImage = image ? 'url("' + image.replace(/"/g, '\\"') + '")' : "";
      stageEl.innerHTML =
        '<div class="media ' + (!image && !video ? 'empty' : '') + '">' + media + '</div>' +
        '<div class="dialogue">' +
          (choicePosition === "aboveText" ? renderChoices(node, edges, "above") : "") +
          '<div class="text' + animationClass(style.bodyAnimation) + '" id="nodeText">' + (data.text || "") + '</div>' +
          (data.audioUrl ? '<audio src="' + escapeAttr(data.audioUrl) + '" controls preload="metadata"></audio>' : '') +
          (choicePosition === "belowText" ? renderChoices(node, edges, "below") : "") +
        '</div>' +
        (choicePosition === "center" ? renderChoices(node, edges, "center") : "");
      stageEl.querySelector(".text")?.addEventListener("click", continueFromText);
      stageEl.querySelector(".media")?.addEventListener("click", continueFromText);
      const hideChoicesDuringTypewriter = settings.autoAdvance && settings.interactionMode === "typewriter";
      stageEl.querySelectorAll(".choices").forEach((element) => {
        element.hidden = hideChoicesDuringTypewriter;
      });
      if (!hideChoicesDuringTypewriter) bindChoices();
      applyTypewriter(document.getElementById("nodeText"), data.text || "", settings.interactionMode === "typewriter" || style.bodyAnimation === "typewriter", true);
      if (settings.interactionMode !== "typewriter" && style.bodyAnimation !== "typewriter") showChoicesAndMaybeAdvance();
    }

    function escapeHtml(value) {
      return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    }
    function escapeAttr(value) { return escapeHtml(value); }

    backButton.addEventListener("click", () => {
      const previous = history.pop();
      if (previous) {
        currentId = previous;
        render();
      }
    });
    resetButton.addEventListener("click", () => {
      history = [];
      currentId = root ? root.id : null;
      render();
    });
    zenButton.addEventListener("click", () => {
      controlsHidden = !controlsHidden;
      document.querySelector(".app").classList.toggle("controls-hidden", controlsHidden);
      zenButton.textContent = controlsHidden ? "◎" : "◉";
    });
    settingsButton.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = settingsMenu.hidden;
      settingsMenu.hidden = !willOpen;
      settingsButton.setAttribute("aria-expanded", String(willOpen));
      if (willOpen) renderSettingsMenu();
    });
    settingsMenu.addEventListener("click", (event) => {
      event.stopPropagation();
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const button = target.closest("[data-action]");
      if (!(button instanceof HTMLElement)) return;
      const action = button.getAttribute("data-action");
      const value = button.getAttribute("data-value");
      if (!action || value == null) return;
      if (action === "autoAdvance" || action === "blurBackground" || action === "skipSingleChoicePopup" || action === "videoAutoPlay") {
        settings[action] = value === "true";
      } else {
        settings[action] = value;
      }
      applyRuntimeSettings();
    });
    settingsMenu.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.id !== "dialogueHeightInput") return;
      settings.dialoguePanelHeight = Math.max(18, Math.min(55, Number(target.value) || 34));
      document.documentElement.style.setProperty("--dialogue-height", settings.dialoguePanelHeight + "vh");
      const label = document.getElementById("heightValue");
      if (label) label.textContent = settings.dialoguePanelHeight + "%";
    });
    settingsMenu.addEventListener("change", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.id !== "dialogueHeightInput") return;
      renderSettingsMenu();
      render();
    });
    document.addEventListener("click", (event) => {
      if (settingsMenu.hidden) return;
      const target = event.target;
      if (target instanceof Node && settingsMenu.parentElement?.contains(target)) return;
      settingsMenu.hidden = true;
      settingsButton.setAttribute("aria-expanded", "false");
    });
    renderSettingsMenu();
    render();
  </script>
</body>
</html>`;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[char] || char;
  });
}

export async function exportInteractiveWebZip(
  nodes: FlowNode[],
  edges: FlowEdge[],
  options: WebExportOptions,
) {
  const zip = new JSZip();
  const assetMap = new Map<string, string>();
  const title = options.projectName?.trim() || 'galwriter-web';
  const style: WebExportStyle = {
    titleFontSize: options.style?.titleFontSize || 34,
    bodyFontSize: options.style?.bodyFontSize || 22,
    titleColor: options.style?.titleColor || '#f8fafc',
    bodyColor: options.style?.bodyColor || '#e5e7eb',
    panelColor: options.style?.panelColor || 'rgba(7, 10, 16, 0.82)',
    titleAnimation: options.style?.titleAnimation || 'fade',
    bodyAnimation: options.style?.bodyAnimation || 'typewriter',
    choiceColor: options.style?.choiceColor || '#0ea5e9',
    choiceTextColor: options.style?.choiceTextColor || '#ffffff',
  };
  const settings: WebExportSettings = {
    layoutMode: options.settings?.layoutMode || 'immersive',
    choicesPosition: options.settings?.choicesPosition || 'center',
    blurBackground: options.settings?.blurBackground ?? true,
    skipSingleChoicePopup: options.settings?.skipSingleChoicePopup ?? true,
    interactionMode: options.settings?.interactionMode || 'typewriter',
    typewriterSpeed: options.settings?.typewriterSpeed ?? 65,
    autoAdvance: options.settings?.autoAdvance ?? false,
    videoAutoPlay: options.settings?.videoAutoPlay ?? false,
    dialoguePanelHeight: options.settings?.dialoguePanelHeight ?? 34,
  };

  const webNodes: WebExportNode[] = [];
  for (const node of nodes) {
    const titleText = nodeTitle(node);
    const imageUrl = await addImageAsset(
      zip,
      typeof node.data?.imageUrl === 'string' ? node.data.imageUrl : undefined,
      `${titleText}-image`,
      assetMap,
    );
    webNodes.push({
      id: node.id,
      type: node.type,
      data: {
        title: titleText,
        text: nodeText(node),
        color: typeof node.data?.color === 'string' ? node.data.color : undefined,
        imageUrl,
        videoUrl: typeof node.data?.videoUrl === 'string' ? node.data.videoUrl : undefined,
        audioUrl: typeof node.data?.audioUrl === 'string' ? node.data.audioUrl : undefined,
        objectFit: typeof node.data?.objectFit === 'string' ? node.data.objectFit : undefined,
        showTextOverlay:
          typeof node.data?.showTextOverlay === 'boolean' ? node.data.showTextOverlay : undefined,
        isRoot: Boolean(node.data?.isRoot),
      },
    });
  }

  const webEdges: WebExportEdge[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    label: typeof edge.data?.label === 'string' ? edge.data.label : undefined,
  }));

  zip.file('index.html', makeIndexHtml(title, options.language));
  zip.file(
    'content.js',
    makeContentScript({
      title,
      language: options.language,
      style,
      settings,
      nodes: webNodes,
      edges: webEdges,
    }),
  );
  zip.folder('images');

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFilePart(title)}-web.zip`;
  link.click();
  URL.revokeObjectURL(url);
}

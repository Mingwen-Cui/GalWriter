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
      min-height: 100vh;
      background: #10131a;
      color: #f8fafc;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    button { font: inherit; }
    .app {
      min-height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr;
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
    }
    header {
      min-height: 56px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 18px;
      border-bottom: 1px solid rgba(255,255,255,0.12);
      background: rgba(10, 13, 20, 0.72);
      backdrop-filter: blur(16px);
    }
    h1 { margin: 0; font-size: 15px; letter-spacing: 0; }
    .toolbar { display: flex; align-items: center; gap: 8px; }
    .tool {
      border: 1px solid rgba(255,255,255,0.16);
      background: rgba(255,255,255,0.08);
      color: #f8fafc;
      border-radius: 8px;
      padding: 8px 11px;
      cursor: pointer;
    }
    .tool:disabled { opacity: 0.4; cursor: not-allowed; }
    main {
      position: relative;
      min-height: 0;
      display: grid;
      place-items: center;
      padding: 24px;
      overflow: hidden;
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
      min-height: min(720px, calc(100vh - 112px));
      display: grid;
      grid-template-rows: minmax(220px, 1fr) auto;
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(12, 16, 24, 0.76);
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 24px 80px rgba(0,0,0,0.42);
      backdrop-filter: blur(18px);
    }
    .app.immersive .stage {
      width: 100%;
      min-height: 100vh;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      backdrop-filter: none;
    }
    .media {
      position: relative;
      min-height: 260px;
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
    .media.empty { color: rgba(248,250,252,0.42); font-weight: 700; }
    .dialogue {
      border-top: 1px solid rgba(255,255,255,0.14);
      padding: 20px;
      background: var(--panel-color, rgba(7, 10, 16, 0.82));
    }
    .app.immersive .dialogue {
      align-self: end;
      margin: 0 auto 24px;
      width: min(1000px, calc(100% - 32px));
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 8px;
      backdrop-filter: blur(18px);
    }
    .title {
      margin: 0 0 10px;
      color: var(--title-color, #f8fafc);
      font-size: var(--title-size, 18px);
      font-weight: 900;
    }
    .text {
      min-height: 76px;
      color: var(--body-color, #e5e7eb);
      line-height: 1.72;
      font-size: var(--body-size, 16px);
    }
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
      transform: translate(-50%, -50%);
      margin: 0;
      padding: 16px;
      border: 1px solid rgba(255,255,255,0.16);
      border-radius: 8px;
      background: rgba(8, 11, 18, 0.78);
      backdrop-filter: blur(18px);
    }
    .choice {
      width: 100%;
      border: 1px solid color-mix(in srgb, var(--choice-color, #0ea5e9), white 25%);
      background: color-mix(in srgb, var(--choice-color, #0ea5e9), transparent 82%);
      color: #f8fafc;
      border-radius: 8px;
      padding: 12px 14px;
      text-align: left;
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
      main { padding: 12px; }
      header { align-items: flex-start; flex-direction: column; }
      .toolbar { width: 100%; }
      .tool { flex: 1; }
      .stage { min-height: calc(100vh - 138px); }
      .dialogue { padding: 16px; }
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
      </div>
    </header>
    <main>
      <div class="backdrop" id="backdrop"></div>
      <section class="stage" id="stage"></section>
    </main>
  </div>
  <script>
    const content = window.GALWRITER_CONTENT || { nodes: [], edges: [], title: "GalWriter" };
    const style = content.style || {};
    const settings = content.settings || {};
    settings.layoutMode = settings.layoutMode || "classic";
    settings.choicesPosition = settings.choicesPosition || "belowText";
    settings.interactionMode = settings.interactionMode || "typewriter";
    settings.typewriterSpeed = Math.max(0, Number(settings.typewriterSpeed) || 65);
    settings.autoAdvance = Boolean(settings.autoAdvance);
    settings.videoAutoPlay = Boolean(settings.videoAutoPlay);
    settings.blurBackground = Boolean(settings.blurBackground);
    settings.skipSingleChoicePopup = Boolean(settings.skipSingleChoicePopup);
    document.documentElement.style.setProperty("--title-size", Math.max(12, Number(style.titleFontSize) || 18) + "px");
    document.documentElement.style.setProperty("--body-size", Math.max(12, Number(style.bodyFontSize) || 16) + "px");
    document.documentElement.style.setProperty("--title-color", style.titleColor || "#f8fafc");
    document.documentElement.style.setProperty("--body-color", style.bodyColor || "#e5e7eb");
    document.documentElement.style.setProperty("--panel-color", style.panelColor || "rgba(7, 10, 16, 0.82)");
    document.documentElement.style.setProperty("--choice-color", style.choiceColor || "#0ea5e9");
    const labels = content.language === "zh"
      ? { back: "\\u8fd4\\u56de", reset: "\\u91cd\\u7f6e", continue: "\\u7ee7\\u7eed", option: "\\u9009\\u9879", end: "\\u5267\\u672c\\u7ed3\\u675f", noStory: "\\u6ca1\\u6709\\u53ef\\u9884\\u89c8\\u7684\\u5267\\u672c" }
      : content.language === "ja"
        ? { back: "\\u623b\\u308b", reset: "\\u30ea\\u30bb\\u30c3\\u30c8", continue: "\\u7d9a\\u3051\\u308b", option: "\\u9078\\u629e\\u80a2", end: "\\u7d42\\u4e86", noStory: "\\u30d7\\u30ec\\u30d3\\u30e5\\u30fc\\u3067\\u304d\\u308b\\u811a\\u672c\\u304c\\u3042\\u308a\\u307e\\u305b\\u3093" }
        : { back: "Back", reset: "Reset", continue: "Continue", option: "Option", end: "The End", noStory: "No story to preview" };
    const nodeById = new Map(content.nodes.map((node) => [node.id, node]));
    const root = content.nodes.find((node) => node.data && node.data.isRoot) || content.nodes[0] || null;
    let currentId = root ? root.id : null;
    let history = [];

    const titleEl = document.getElementById("projectTitle");
    const stageEl = document.getElementById("stage");
    const backdropEl = document.getElementById("backdrop");
    const backButton = document.getElementById("backButton");
    const resetButton = document.getElementById("resetButton");
    titleEl.textContent = content.title || "GalWriter";
    backButton.textContent = labels.back;
    resetButton.textContent = labels.reset;
    document.querySelector(".app").classList.toggle("immersive", settings.layoutMode === "immersive");
    backdropEl.classList.toggle("blurred", settings.blurBackground);
    let typewriterTimers = [];
    let autoAdvanceTimer = null;

    function nodeTitle(node) {
      return (node && node.data && node.data.title) || labels.option;
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
      if (settings.skipSingleChoicePopup && settings.choicesPosition === "center" && edges.length <= 1) {
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
          '<h2 class="title' + animationClass(style.titleAnimation) + '" id="nodeTitle">' + escapeHtml(nodeTitle(node)) + '</h2>' +
          (choicePosition === "aboveText" ? renderChoices(node, edges, "above") : "") +
          '<div class="text' + animationClass(style.bodyAnimation) + '" id="nodeText">' + (data.text || "") + '</div>' +
          (data.audioUrl ? '<audio src="' + escapeAttr(data.audioUrl) + '" controls preload="metadata"></audio>' : '') +
          (choicePosition === "belowText" ? renderChoices(node, edges, "below") : "") +
        '</div>' +
        (choicePosition === "center" ? renderChoices(node, edges, "center") : "");
      stageEl.querySelector(".text")?.addEventListener("click", continueFromText);
      stageEl.querySelectorAll(".choices").forEach((element) => {
        element.hidden = settings.interactionMode === "typewriter";
      });
      applyTypewriter(document.getElementById("nodeTitle"), escapeHtml(nodeTitle(node)), style.titleAnimation === "typewriter", false);
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
    bodyFontSize: options.style?.bodyFontSize || 26,
    titleColor: options.style?.titleColor || '#f8fafc',
    bodyColor: options.style?.bodyColor || '#e5e7eb',
    panelColor: options.style?.panelColor || 'rgba(7, 10, 16, 0.82)',
    titleAnimation: options.style?.titleAnimation || 'fade',
    bodyAnimation: options.style?.bodyAnimation || 'typewriter',
    choiceColor: options.style?.choiceColor || '#0ea5e9',
  };
  const settings: WebExportSettings = {
    layoutMode: options.settings?.layoutMode || 'classic',
    choicesPosition: options.settings?.choicesPosition || 'belowText',
    blurBackground: options.settings?.blurBackground ?? true,
    skipSingleChoicePopup: options.settings?.skipSingleChoicePopup ?? false,
    interactionMode: options.settings?.interactionMode || 'typewriter',
    typewriterSpeed: options.settings?.typewriterSpeed ?? 65,
    autoAdvance: options.settings?.autoAdvance ?? false,
    videoAutoPlay: options.settings?.videoAutoPlay ?? false,
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

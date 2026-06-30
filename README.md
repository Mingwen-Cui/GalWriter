<div align="center">

# GalWriter AI

### 面向视觉小说、Galgame 与分支互动叙事的 AI 创作工作台

[![Version](https://img.shields.io/github/v/release/Mingwen-Cui/GalWriter?color=blue&label=version)](https://github.com/Mingwen-Cui/GalWriter/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Web%20%7C%20Android-lightgrey.svg)](https://github.com/Mingwen-Cui/GalWriter/releases)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-orange.svg)](https://tauri.app/)
[![Frontend](https://img.shields.io/badge/frontend-React%2019%20%2B%20TypeScript-61dafb.svg)](https://react.dev/)

<img src="./public/icon.png" alt="GalWriter AI" width="96" />

中文 | [English](README.en.md) | [日本語](README.ja.md)

[下载 Releases](https://github.com/Mingwen-Cui/GalWriter/releases) · [Android 打包说明](ANDROID_BUILD_GUIDE.md) · [开发](#开发) · [架构概览](#架构概览) · [FAQ](#faq)

</div>

## 项目定位

GalWriter AI 是一个把“剧情结构、角色设定、场景设定、AI 生成、媒体素材、测试预演、导出交付”放到同一张画布里的故事编辑器。它不是单纯的文本编辑器，也不是通用白板，而是围绕视觉小说与互动叙事生产流程组织的本地优先工作台。

当前仓库已经覆盖编辑器、项目库、AI Profile 管理、助手与 Agent、媒体工作流、Playtest、Web 导出、视频导出，以及 Windows / Android 的 Tauri 原生桥接能力。

## 当前能力

- **可视化故事画布**：支持剧情段落、角色设定、场景设定、AI 生成、背景素材、分组整理、数值条件判断、批量替换、剧情结构规划、文本便签与内容摘要。
- **本地项目库**：内置项目首页、最近项目、重命名、删除、批量导入导出、默认保存目录。
- **AI Profile 中心**：分别管理文本、图片、去背景、语音 4 类配置，可保存多套 Provider / Model / API URL / API Key。
- **AI 助手与 Agent**：支持流式对话、卡片生成、文档上下文、记忆笔记、未来目标、起手式、修订工作流。
- **多媒体工作流**：支持角色图、场景图、透明背景处理、TTS、素材抽取、区域背景音乐、全景场景。
- **剧本测试与展示**：支持 Playtest、沉浸布局、打字机、自动推进、Presentation 入场动画、Zen 编辑模式。
- **多种导出**：支持项目 ZIP 备份与导入、交互式网页 ZIP、视频渲染工作台。
- **本地优先与自动保存**：项目、应用设置、AI Profiles、Autosave 默认都保存在本地；API Key 默认不会随项目导出。

## 平台说明

| 平台 | 当前定位 | 说明 |
| --- | --- | --- |
| Windows | 主力创作与正式导出 | 对话框、本地导出路径、系统 TTS、视频与 Web 导出保存流程更完整 |
| Web | 快速体验与轻量创作 | 使用浏览器本地存储，适合快速试用、轻量编辑、短内容预览与导出 |
| Android | 移动端预览与测试 | 更偏向移动端查看、试跑与轻量交互 |

## 快速开始

1. 打开 GalWriter AI，创建新项目或导入已有项目 ZIP。
2. 在画布中添加剧情、角色、场景、条件或背景分组节点，并用连线组织分支。
3. 进入 `设置 > AI`，配置文本、图片、去背景、语音 Profile。
4. 如需助手上下文，可向 Assistant 上传 `PDF / DOCX / XLSX / PPTX / TXT / MD / CSV / JSON / XML / HTML / RTF`。
5. 使用 Playtest 检查交互节奏，再按需导出项目 ZIP、交互式网页 ZIP 或视频。

## AI 与文档支持

| 类别 | 当前适配方向 |
| --- | --- |
| 文本 AI | DeepSeek、Gemini、OpenAI、Claude、Kimi、Qwen、Copilot、GLM、Ollama、自定义兼容接口、托管代理 |
| 图片 AI | 豆包、Gemini、OpenAI、Qwen、GLM、本地 Stable Diffusion WebUI、自定义接口 |
| 去背景 AI | 自定义接口、阿里云视觉智能、火山 veImageX |
| 语音 AI | 系统语音、有道、OpenAI、豆包、Gemini、自定义接口、托管代理 |

说明：

- 实际可用性取决于你提供的 API Key、模型名与接口兼容性。
- `src/editor-services/aiClient.ts` 已抽成统一入口，主要提供 `generateText()`、`analyze()`、`generateSetting()`。
- Assistant 的文档摄取能力来自 `src/lib/documentReader.ts`，会把可读文本提取后送入当前对话上下文。

## 本地数据与隐私

- Web 版默认把 `autosave`、`localProjects`、`appSettings`、`apiSettings`、`aiProfiles` 存在 IndexedDB。
- Windows / Android 版在本地应用数据之外，还会记录用户选择的项目导出路径和默认保存目录。
- API Key 默认只保存在当前设备本地，不会自动写入项目 ZIP。
- 只有用户在导出时明确勾选，当前启用的 API Profiles 和密钥才会进入导出文件。
- Assistant 对话是否随项目保存，取决于项目设置中的 `saveAssistantConversations`。

## 开发

### 环境要求

- Node.js 18+
- npm
- Rust 1.77+
- Tauri 2 运行与打包依赖
- Android 打包时需要 Android Studio / SDK / NDK

### 常用命令

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run build
npm run preview
```

### 打包

```bash
npm run tauri build
```

Android 打包流程请参考 [ANDROID_BUILD_GUIDE.md](ANDROID_BUILD_GUIDE.md)。

## 架构概览

- `src/domain/`：项目领域模型，包含 `StoryProject`、`ProjectSettings`、节点数据与展示类型。
- `src/editor-shell/`：编辑器壳层，只负责 Header、Toolbar、Modal、AssistantPanel 等顶层装配。
- `src/editor-state/`：共享配置与状态 Hook，例如 `usePlaytestSettings`、`useSharedRenderStyle`。
- `src/editor-features/`：按职责拆开的功能模块，包括 AI、Assistant、Canvas、Project I/O、Selection、Media、Node Actions。
- `src/editor-services/`：统一服务接口，如 `aiClient`、`projectSerializer`、`autosaveService`、`localPersistenceService`、`ttsService`。
- `src/components/`：节点组件、`StoryEditor`、Playtest、Settings、Render UI 等具体界面实现。
- `src/lib/`：IndexedDB、文档读取、导出辅助、Presentation、Plot、Tauri 运行时适配。
- `src-tauri/`：Windows / Android 原生命令层，覆盖文件保存、渲染工作目录、系统 TTS、代理调用与窗口行为。

## 项目结构

```text
.
├── build-scripts/              # 打包辅助脚本
├── docs/                       # 项目文档
├── examples/                   # 示例资源
├── public/                     # Web 静态资源
├── release/                    # 本地打包输出
├── scripts/                    # 其他脚本
├── src/
│   ├── agent/                  # 助手/Agent 运行时与规划
│   ├── animation/              # 动画资源
│   ├── components/             # StoryEditor、节点组件、Playtest、Render UI
│   ├── domain/                 # 领域模型与强类型定义
│   ├── editor-features/        # 画布、AI、媒体、项目 I/O、框选等功能模块
│   ├── editor-services/        # AI、序列化、自动保存、本地持久化、TTS
│   ├── editor-shell/           # 顶层壳层与模态框装配
│   ├── editor-state/           # 编辑器状态与默认配置
│   └── lib/                    # DB、文档解析、导出、运行时适配工具
├── src-tauri/                  # Tauri 原生工程
├── ANDROID_BUILD_GUIDE.md      # Android 打包说明
├── eslint.config.js
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## FAQ

### 项目保存在哪里？

Web 版主要保存在浏览器 IndexedDB。Windows 和 Android 版主要保存在本地应用数据中；项目 ZIP、网页 ZIP、视频文件则保存在用户选择的位置。

### API Key 会随项目一起导出吗？

默认不会。只有在导出项目时显式勾选包含 API Profiles / API Key，才会把当前启用配置写入 ZIP。

### Assistant 现在能读取哪些文件？

当前代码支持 `PDF`、`DOCX`、`XLSX`、`PPTX`、`TXT`、`MD`、`CSV`、`TSV`、`JSON`、`XML`、`HTML`、`RTF` 等可提取文本的文档。

### Web 和 Android 能做正式导出吗？

Web 版适合轻量预览和短内容导出；Windows 版更适合正式项目与较长渲染。Android 版当前更偏向移动端预览与测试，而不是完整桌面导出工作流。

## License

Created by Mingwen Cui, Tommy Ren.

当前仓库尚未包含正式 License 文件；在公开再分发或商业使用前，请先补充许可证。

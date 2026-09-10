<div align="center">

# 旮旯作家 · GalWriter

### 从旮旯的灵感，写到辽阔的世界。

[![Version](https://img.shields.io/github/v/release/Mingwen-Cui/GalWriter?color=blue&label=version)](https://github.com/Mingwen-Cui/GalWriter/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Web%20%7C%20Android-lightgrey.svg)](https://github.com/Mingwen-Cui/GalWriter/releases)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-orange.svg)](https://tauri.app/)
[![Frontend](https://img.shields.io/badge/frontend-React%2019%20%2B%20TypeScript-61dafb.svg)](https://react.dev/)

<img src="./public/icon.png" alt="旮旯作家 · GalWriter" width="96" />

中文 | [English](README.en.md) | [日本語](README.ja.md)

[下载 Releases](https://github.com/Mingwen-Cui/GalWriter/releases) · [快速开始](#快速开始) · [导出与交付](#导出与交付) · [开发](#开发) · [构建与发布指南](docs/build/BUILD_GUIDE.md)

</div>

## 项目定位

旮旯作家 · GalWriter 是面向视觉小说、分支故事与互动演示的本地优先创作工作台。你可以在节点画布上组织剧情、人物、场景与数值条件，用 AI 辅助创作和制作素材，在 Playtest 中试跑分支，再把同一项目导出为交互网页、视频、PowerPoint 或游戏引擎项目。

当前源码版本为 **1.3.0**，基于 React 19、TypeScript、React Flow、Vite 6 和 Tauri 2，提供中文、英文、日文界面。下文描述当前仓库的实现范围；下载版本以 Releases 中的实际资产为准。

## 核心能力

- **故事画布**：剧情、角色、场景、AI 生成、背景、分组、数值条件、批量替换、剧情结构、便签和摘要节点；支持分支连线、角色与场景标签、富文本及 Zen 编辑。
- **项目与素材库**：本地项目首页、最近项目、自动保存与恢复、项目 ZIP 导入导出；角色与场景设定可跨项目复用，预设素材支持按需下载，音乐库支持导入、试听和区域 BGM。
- **AI 创作**：按文本、图片、去背景、语音分别管理多套 Profile；支持续写、改写、插入剧情、结构分析、角色和场景生成，以及自定义提示词。
- **Assistant / Agent**：流式对话、画布卡片与文档上下文、记忆笔记、任务对话、规划与修订；Agent 执行卡片生成、填充、连线和排列。创意游玩可按角色、题材、玩家选项或自由输入续写剧情，并保留章节摘要与分支。
- **媒体与演出**：角色立绘与多形态素材、场景图和全景预览、图片去背景、语音合成、录音、环境音、区域音乐，以及角色入场和文内动作。
- **Playtest**：经典或沉浸布局、打字机效果、自动推进、选项与数值条件分支；用于检查剧情路径、角色场景切换和音画节奏。
- **导出工作台**：Web、视频、PPT、代码四种模式，配备预览、外观编辑和各自的导出设置；可继承公共外观或保存模式独立外观。

## 快速开始

1. 从 [Releases](https://github.com/Mingwen-Cui/GalWriter/releases) 获取应用，或按下文启动本地 Web 开发版。
2. 创建项目或导入项目 ZIP，在画布放置剧情卡，并用连线组织选项和分支。
3. 添加角色、场景与数值条件；也可以从设定库选择预设或已保存的素材。
4. 如需 AI 功能，在 `设置 > AI` 中新建并启用对应 Profile，填写服务商、接口地址、模型和凭据。手工编辑、项目管理与基础预演无需 AI Key。
5. 在 Assistant 中讨论剧情、引用卡片或添加文档；也可开启创意游玩，让选择生成后续剧情。
6. 使用 Playtest 检查故事，再从顶部导出入口进入 Web、视频、PPT 或代码工作区。另行保存项目 ZIP，便于备份和继续编辑。

## 导出与交付

| 输出            | 当前范围                                                                       | 使用说明                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 项目 ZIP        | 剧情图、设置和可打包媒体；支持批量项目导入导出，可选附带设定库                 | 用于备份、迁移和继续编辑；API Profiles 默认不包含                                                                                         |
| 交互式 Web ZIP  | 分支剧情、可选开始菜单、设置与存档页面、封面和界面设计                         | 解压后通过 HTTP(S) 静态服务发布；作品导出与应用自身的 Web 构建包用途不同                                                                  |
| 视频            | MP4 / MOV / MKV、时间线编辑、音轨、PNG 封面、互动片段 ZIP                      | 通过浏览器 / WebView 编码，效果与速度取决于设备、内存和编解码支持；互动片段 ZIP 内为分段 MP4、分支结构 PNG 和可选封面，需另接互动播放平台 |
| PowerPoint      | `.pptx`；自动剧情页与手动幻灯片、16:9 / 4:3、分支跳转、图片及视频              | 复杂装饰合成为图片；视频填充使用首帧，剧情 / 场景背景视频可嵌入；放映效果需在目标播放器中检查                                             |
| 游戏代码 / 数据 | Ren'Py、TyranoScript、Godot、IR JSON；代码预览、变量与角色映射、诊断及界面设计 | 各目标能力不同；生成内容需在对应引擎中检查，IR JSON 是中间数据而非可运行游戏                                                              |

Ren'Py、TyranoScript 和 IR JSON 导出当前在界面中标注为开发中。Godot 目标生成原生 Godot 4.5+ 工程，保留 `dialogic` 作为旧存档兼容标识，无需 Dialogic 插件。TyranoScript 输出用于接入宿主工程。代码导出提供素材映射与诊断报告，阻断错误需修正后才能生成 ZIP。游戏界面设计器主要覆盖画布、对话框、文字和选项；复杂装饰会转为 PNG，不能保证各引擎完整复现网页效果。

导出模块与外观数据的开发说明见 [EXPORT_INSPECTORS.md](docs/EXPORT_INSPECTORS.md)。

## AI 与文档支持

下表列出代码中的服务商选项和适配路径，实际可用性取决于凭据、模型、接口兼容性及运行平台。

| 类别   | 配置选项                                                                       |
| ------ | ------------------------------------------------------------------------------ |
| 文本   | DeepSeek、Gemini、OpenAI、Claude、Kimi、Qwen、Copilot、GLM、Ollama、自定义接口 |
| 图片   | 豆包、Gemini、OpenAI、Qwen、GLM、本地 Stable Diffusion WebUI、自定义接口       |
| 去背景 | Windows 本机 rembg、自定义接口 / 托管代理、阿里云视觉智能、火山 veImageX       |
| 语音   | 系统语音、有道、OpenAI、豆包、Gemini、自定义接口                               |

Web 部署还可接入文本、图片和语音托管代理。托管代理依赖单独部署的服务端，仓库不包含可直接使用的 `api/proxy.php`；静态构建本身不会提供这些服务。浏览器直连接口还受 CORS 限制，部分云端去背景签名请求需要原生桥接。

Assistant 可提取 `PDF`、`DOCX`、`XLSX`、`PPTX`、`TXT`、`MD`、`CSV`、`TSV`、`JSON`、`XML`、`HTML`、`RTF` 等文档中的文本。当前每份文档最多保留约 24,000 字符，PDF 最多读取前 80 页，纯文本类文件上限为 2 MiB；扫描 PDF 没有内置 OCR。文档用于对话上下文，原始排版不会完整保留。

## 平台与资源版本

| 平台    | 适用场景                     | 运行差异                                                                                           |
| ------- | ---------------------------- | -------------------------------------------------------------------------------------------------- |
| Windows | 完整编辑、多媒体制作和导出   | 提供系统文件对话框、输出目录、系统 TTS、部分 API 原生代理及可选本地 rembg；部分媒体转换需要 FFmpeg |
| Web     | 浏览器体验、编辑、预演与导出 | 数据保存在当前站点的浏览器存储中；API 受 CORS / 服务端代理配置影响，媒体导出依赖浏览器能力         |
| Android | 移动端查看、编辑与试跑       | 使用 Tauri Android 工程；文件保存与媒体能力受移动 WebView 和系统限制，不包含 Windows 专用命令能力  |

应用提供两种资源构建版本，功能代码共用：

- **Full（完整版）**：默认构建，包含 `public/` 中的预设、封面、网页模板和助手资源。
- **Lite（轻量版）**：省略 `assistant/`、`presets/`、`cover-templates/`、`web-homepage/` 四类大资源，运行时从在线地址加载。预设可按需下载并缓存，首次获取仍需要网络。

Lite 的预设、封面和网页资源地址可由构建环境变量 `VITE_ASSET_BASE_URL` 指定；默认使用带版本号的资源路径。助手资源走独立在线地址，详细逻辑见 [appAssets.ts](src/lib/appAssets.ts)。Full 也不包含云端 AI 服务或 rembg 运行器。

### Windows 本地去背景

本地 rembg 不需要 API Key，但需按 AI 设置页中的路径和链接，另行安装 `rembg-sidecar.exe` 与模型文件。默认 `u2netp` 的位置为：

```text
%APPDATA%\com.galwriter.ai\rembg\rembg-sidecar.exe
%APPDATA%\com.galwriter.ai\rembg-models\u2netp.onnx
```

运行器与模型不随 Windows 安装包附带。其他模型首次使用可能需要下载，准备完成后可在本机处理图片。开发者构建运行器的说明见 [rembg-sidecar README](src-tauri/rembg-sidecar/README.md)。

## 保存与隐私

- 各平台的项目、自动保存、设定库、音乐库、应用设置和 AI Profiles 均通过 IndexedDB 持久化；Tauri 使用应用 WebView 的本地存储，部分界面模板与偏好使用 localStorage。
- Windows 等原生运行环境另外提供文件保存能力；项目 ZIP、作品网页、视频和 PPTX 按相应平台的保存或下载流程输出。自动保存不等于已经生成可迁移的项目文件。
- API 凭据默认保存在当前设备的本地配置中。项目 ZIP 默认不带密钥；显式勾选包含 API Profiles 时，会导出当前启用的用户配置及其凭据，不含内置托管代理配置。
- 是否随项目保存 Assistant 对话由 `saveAssistantConversations` 设置控制。设定库也可在导出项目时选择附带。
- 调用远程 AI 时，相应提示词、文档摘录或媒体会发送给所选服务或代理。在线资源下载同样需要联网。
- 清除浏览器站点数据或应用数据会影响本地项目；请用项目 ZIP 保留独立备份。

## 开发

### 环境要求

- Node.js **22.x（至少 22.13）或 24+**，以及 npm。当前锁文件中的 `pdfjs-dist` 和 ESLint 依赖已有更高要求，旧版 README 的 Node 18+ 已不适用。
- 仅运行 Web 前端不需要 Rust。构建原生应用需要 Rust stable、Tauri 2 对应平台依赖；`Cargo.toml` 声明的 Rust 下限是 1.77.2，锁定依赖可能要求更新工具链。
- Windows 原生构建需要 MSVC C++ 构建工具、Windows SDK 和 WebView2。
- Android 构建需要 JDK、Android SDK / NDK 与相应 Rust targets；发布流程使用 JDK 21，安装包发布另需配置签名。

### 本地运行与检查

```bash
npm ci
npm run dev
```

浏览器访问 `http://localhost:3000`。启动 Tauri 桌面开发版时使用以下命令，它会自动启动前端：

```bash
npm run tauri -- dev
```

```bash
npm run typecheck
npm run lint:eslint
npm run format:check
npm run lint
npm run build
npm run preview
```

`lint` 依次运行类型检查、ESLint 和格式检查。`build` 默认构建 Full 前端到 `dist/`，不会单独运行类型检查；`preview` 预览已有构建。

### 按平台构建

| 目标              | Full                               | Lite                               |
| ----------------- | ---------------------------------- | ---------------------------------- |
| Web               | `npm run build:full`               | `npm run build:lite`               |
| Windows           | `npm run tauri:build:windows:full` | `npm run tauri:build:windows:lite` |
| Android APK + AAB | `npm run tauri:build:android:full` | `npm run tauri:build:android:lite` |

首次构建 Android，可先运行 `npm run tauri:android:init`。Web 输出位于 `dist/`，Windows 安装包位于 `src-tauri/target/release/bundle/`，Android 输出位于 `src-tauri/gen/android/app/build/outputs/`。

在已准备 Windows 构建环境的机器上，可一次构建并收集各平台产物：

```bash
npm run tauri:build:all-platforms
```

该命令依次构建 Full Web、默认 Windows、尝试 Android，最后整理至 `release/`。缺少 SDK / NDK 或 Android 初始化失败时会跳过 Android；真正的 Android 构建失败仍会中止流程。签名配置需要另行完成。

默认产物名称如下，仅在对应构建产物存在时生成 Android 文件：

```text
GalWriter-AI-v<version>-windows-x64-setup.exe
GalWriter-AI-v<version>-windows-x64-portable.zip
GalWriter-AI-v<version>-windows-x64.msi
GalWriter-AI-v<version>-web.zip
GalWriter-AI-v<version>-android-signed.apk
GalWriter-AI-v<version>-android.aab
```

`tauri:prepare:release:full` / `tauri:prepare:release:lite` 用于收集已构建的文件，并在平台标识后添加 `-full` / `-lite`，例如 `windows-x64-lite-setup.exe`、`web-lite.zip`。这些命令不重新构建，也不校验资源版本或 APK 签名；请构建对应版本后立即收集。收集脚本要求 Windows 安装包、可执行文件和 `dist/` 已存在；仅收集 Android 可用 `tauri:prepare:android:full` / `tauri:prepare:android:lite`。

`npm run tauri:prepare:online-assets` 将预设、封面和网页模板整理到 `release/GalWriter-AI-v<version>-online-assets/`，附文件哈希清单和上传说明；助手资源不在该资源包中。

Android 环境、签名和发布细节见[构建与发布指南](docs/build/BUILD_GUIDE.md)。实际命令以 [package.json](package.json) 和 [build-scripts/](build-scripts/) 为准。

## 架构与项目结构

```text
.
├── build-scripts/              # Full/Lite 构建、发布收集、导出验证脚本
├── docs/                       # 构建指南、导出架构、发布记录与规划
├── public/                     # 图标、预设、音乐、封面与网页模板
├── src/
│   ├── App.tsx                 # React Flow 与对话框 Provider
│   ├── domain/                 # 项目、节点、设定库与配置类型
│   ├── editor-shell/           # 顶部工具栏、Assistant、对话框装配
│   ├── editor-state/           # 编辑器状态、Playtest 与公共外观
│   ├── editor-features/        # AI、Assistant、画布、媒体、项目 I/O、设定库
│   ├── editor-services/        # AI 入口、序列化、自动保存、持久化、TTS
│   ├── components/
│   │   ├── story-editor/      # 编辑器主体与项目 / Profile 协调
│   │   └── render/            # Playtest、Web、视频、PPT、代码与共享样式
│   ├── agent/                 # Agent 类型、规划、运行时与动画
│   └── lib/                   # DB、文档解析、媒体、资源缓存与原生适配
├── src-tauri/                  # 原生命令、Tauri 配置与可选 rembg 运行器源码
├── tests/                      # 现有导出设置回归测试
├── package.json
└── vite.config.ts
```

项目数据由 `domain` 定义，编辑器通过功能 Hook 和服务层协调；`projectSerializer` 负责项目快照及 ZIP 媒体打包，`db` 负责本地持久化。导出工作区共享预览与外观工具，再分别转换为各目标产物。`src/components/StoryEditor.tsx` 是兼容转发入口，编辑器主体位于 `src/components/story-editor/StoryEditor.tsx`。

## 作者与许可证

Created by Mingwen Cui, Tommy Ren.

当前仓库没有项目级 `LICENSE` 文件。

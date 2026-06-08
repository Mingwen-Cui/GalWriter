<div align="center">

# GalWriter AI

### 面向视觉小说、Galgame 和互动叙事的 AI 剧本创作工作台

[![Version](https://img.shields.io/github/v/release/Mingwen-Cui/GalWriter?color=blue&label=version)](https://github.com/Mingwen-Cui/GalWriter/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Web-lightgrey.svg)](https://github.com/Mingwen-Cui/GalWriter/releases)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-orange.svg)](https://tauri.app/)
[![React](https://img.shields.io/badge/frontend-React%20%2B%20TypeScript-61dafb.svg)](https://react.dev/)

<img src="./public/icon.png" alt="GalWriter AI" width="96" />

中文 | [English](README.en.md) | [日本語](README.ja.md)

[下载桌面版](https://github.com/Mingwen-Cui/GalWriter/releases) · [本地开发](#本地开发) · [常见问题](#常见问题)

</div>

## 为什么做 GalWriter AI？

视觉小说和多分支叙事通常会同时涉及剧情结构、角色设定、场景资料、图片素材、语音、测试和导出。传统文档很难直观看到分支走向，普通白板又缺少 AI 写作和项目管理能力。

**GalWriter AI** 把这些流程集中到一个可视化编辑器中：你可以在画布上组织剧情节点、连接分支、管理角色与场景，使用自己的 AI 接口续写和生成素材，并把项目保存在本机，方便下次继续编辑。

## 核心能力

- **可视化剧情画布**：用节点和连线组织剧情、分支、角色、场景、条件判断和背景区域。
- **项目本地持久化**：最近项目、项目进度和编辑状态保存在本机，支持继续上次创作。
- **AI 接口配置中心**：文本、图片、语音 AI 配置独立保存，可创建多套 Provider / Model / API Key / API URL。
- **API Key 不进入项目导出**：密钥只存在当前设备本地，不会混入项目 ZIP 或分享文件。
- **AI 写作助手**：支持续写、润色、插入剧情、场景描写、对话补写、剧情分析和参考文档对话。
- **多媒体工作流**：支持图片生成、语音生成、素材导入、实时预览和视频导出。
- **Web Demo 与桌面 App**：Web 端适合快速体验；桌面端提供更完整的本地导出能力。

## 界面预览

当前仓库暂未放置完整截图素材。建议后续在 `assets/screenshots/` 中补充：

| 编辑器画布  | AI 接口设置 |  视频导出   |
| :---------: | :---------: | :---------: |
| Coming soon | Coming soon | Coming soon |

## 下载与安装

### 桌面版

从 [Releases](https://github.com/Mingwen-Cui/GalWriter/releases) 下载最新版安装包。

桌面版适合正式创作，推荐给需要本地项目管理、视频导出和完整文件能力的用户。

| 安装包 | 推荐对象 | 视频导出 |
| ------ | -------- | -------- |
| `GalWriter-Setup.exe` | 推荐大多数用户下载。安装包更大，但开箱即用。 | 内置精简 FFmpeg，可直接导出 WebM、MP4、MOV、MKV。 |
| `GalWriter-Setup-Lite.exe` | 推荐在意下载体积、且电脑已安装 FFmpeg 的用户。 | 不内置 FFmpeg；WebM 可用，MP4 / MOV / MKV 需要系统已有 FFmpeg。 |
| `GalWriter-AI-v1.2.5-windows-x64.exe` | 不想安装、只想双击运行的用户。 | 单文件便携 Lite 版；非 WebM 视频导出需要系统已有 FFmpeg。 |
| `GalWriter-AI-v1.2.5-windows-x64-portable-full.zip` | 不想安装、但需要内置 FFmpeg 的用户。 | 解压后双击 exe；请保留同目录下的 `ffmpeg.exe`。 |

Release 构建只会随 Full 版携带 `ffmpeg.exe`，不会打包 `ffprobe.exe`、文档、presets 等无关文件。

### Web 版

Web 版适合演示和快速试用。由于浏览器限制，Web 端视频导出只直接支持 **WebM**。如果需要 **MP4 / MOV / MKV** 等常见格式，请使用桌面版；推荐下载内置 FFmpeg 的 Full 版。

## 快速开始

1. 打开 GalWriter AI。
2. 创建新项目，或导入已有项目。
3. 在画布上添加剧情、角色、场景、背景或条件节点。
4. 用连线组织剧情路径和分支结构。
5. 如需 AI，进入 **设置 > AI 接口配置**，创建文本、图片或语音 AI 配置。
6. 保存项目。下次打开时可从最近项目继续编辑。
7. 需要交付或备份时，导出项目 ZIP；需要视频时进入视频导出工作台。

## AI 接口与本地数据

GalWriter AI 不绑定单一 AI 服务商。你可以按需配置常见文本、图片和语音模型。

| 类型    | 用途                           | 示例 Provider                                                         |
| ------- | ------------------------------ | --------------------------------------------------------------------- |
| 文本 AI | 续写、润色、助手对话、剧情分析 | DeepSeek、Claude、Gemini、Kimi、通义千问、GLM、OpenAI、自定义兼容接口 |
| 图片 AI | 角色图、场景图、背景图生成     | 豆包、Gemini、OpenAI、本地 Stable Diffusion WebUI、自定义接口         |
| 语音 AI | 文本朗读、配音、语音合成       | 系统语音、有道、OpenAI、豆包、自定义接口                              |

数据原则：

- 项目内容保存在本机项目库中。
- AI 配置保存在当前设备本地。
- API Key 不会随项目导出。
- 一个项目中的 AI 对话只保存在该项目中。

## 视频导出策略

| 环境          | 直接导出格式        | 说明                                                             |
| ------------- | ------------------- | ---------------------------------------------------------------- |
| Web Demo      | WebM                | 浏览器原生录制更稳定，适合快速预览和轻量导出。                   |
| 桌面 App Full | WebM、MP4、MOV、MKV | 内置精简 FFmpeg，推荐大多数用户下载。                            |
| 桌面 App Lite | WebM、MP4、MOV、MKV | 不内置 FFmpeg；WebM 不受影响，MP4 / MOV / MKV 需要系统 FFmpeg。 |

如果用户在 Web 端选择 MP4、MOV 或 MKV，应用会显示内置提示窗口，并引导下载桌面版。如果 Lite 版或本机运行环境检测不到 FFmpeg，应用也会用内置窗口提示用户下载 Full 版或改用 WebM。

## 本地开发

### 环境要求

- Node.js 18+
- npm
- Rust 1.77+
- Tauri 2 所需系统依赖

### 安装依赖

```bash
npm install
```

### 启动 Web 开发服务

```bash
npm run dev
```

默认访问 `http://localhost:3000`。

### 启动桌面开发模式

```bash
npm run tauri dev
```

### 类型检查与构建

```bash
npm run typecheck
npm run build
```

### 打包桌面 App

```bash
npm run tauri:check:ffmpeg
npm run tauri:build:full
npm run tauri:build:lite
npm run tauri:build:portable
npm run tauri:build:portable:full
```

Full 构建会检查 `src-tauri/binaries/ffmpeg.exe` 是否存在，并把安装包复制为 `release/GalWriter-Setup.exe`。Lite 构建不会携带 FFmpeg，并输出 `release/GalWriter-Setup-Lite.exe`。便携 Lite 构建会输出 `release/GalWriter-AI-v1.2.5-windows-x64.exe`；便携 Full 构建会输出带 `ffmpeg.exe` 的 zip。

## 技术栈

- **前端**：React、TypeScript、Vite、Tailwind CSS、React Flow
- **桌面端**：Tauri 2、Rust
- **本地存储**：IndexedDB / 本机应用数据
- **项目导出**：ZIP、Web 导出、视频导出
- **视频处理**：浏览器 MediaRecorder、桌面端 FFmpeg 检测与 Full/Lite 打包

## 项目结构

```text
├── src/                         # React + TypeScript 前端
│   ├── components/              # 编辑器、节点、设置、渲染 UI
│   ├── editor-features/         # 编辑器功能模块
│   ├── editor-services/         # 本地持久化、序列化、媒体服务
│   ├── editor-shell/            # 顶层弹窗与编辑器壳层
│   └── lib/                     # 工具函数、本地数据库、运行时适配
├── src-tauri/                   # Tauri + Rust 桌面端
│   ├── binaries/                # 桌面端内置 FFmpeg
│   └── src/                     # Tauri commands 与本地文件处理
├── build-scripts/               # FFmpeg 检查与 Full/Lite 安装包整理脚本
├── public/                      # 公共静态资源
└── dist/                        # Web 构建输出
```

## 常见问题

<details>
<summary><strong>项目会保存在哪里？</strong></summary>

Web 端项目保存在浏览器本地存储中。桌面端项目保存在应用本地数据中。项目 ZIP 导出可用于备份和迁移。

</details>

<details>
<summary><strong>API Key 会被导出吗？</strong></summary>

不会。AI 接口配置只保存在当前设备本地，项目导出不会包含 API Key。

</details>

<details>
<summary><strong>为什么 Web 端不能直接导出 MP4 或 MOV？</strong></summary>

浏览器原生视频录制对 MP4/MOV 支持不稳定。GalWriter AI 的 Web 端只承诺 WebM；桌面端 Full 版使用内置 FFmpeg 导出 MP4、MOV、MKV 和 WebM，Lite 版需要系统已有 FFmpeg 才能导出这些常见格式。

</details>

<details>
<summary><strong>我需要自己安装 FFmpeg 吗？</strong></summary>

如果下载 `GalWriter-Setup.exe` Full 版，不需要，用户点击导出即可使用。如果下载 `GalWriter-Setup-Lite.exe`，MP4 / MOV / MKV 导出需要电脑上已有 FFmpeg；否则应用会提示下载 Full 版或改导 WebM。

</details>

<details>
<summary><strong>可以配置多个 AI Provider 吗？</strong></summary>

可以。文本、图片、语音 AI 都支持保存多套配置，并在设置面板中切换当前使用的配置。

</details>

## 贡献

欢迎提交 Issue 和 Pull Request。建议在提交较大功能前先开 Issue 讨论设计方向。

提交前请至少运行：

```bash
npm run typecheck
npm run build
```

如果改动涉及 Tauri / Rust：

```bash
cd src-tauri
cargo check
```

## License

Created by Mingwen Cui, Tommy Ren.

Please add a repository license file before public redistribution or commercial use.

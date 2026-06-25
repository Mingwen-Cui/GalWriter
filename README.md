<div align="center">

# GalWriter AI

### 面向视觉小说、Galgame 和互动叙事的 AI 剧本创作工作台

[![Version](https://img.shields.io/github/v/release/Mingwen-Cui/GalWriter?color=blue&label=version)](https://github.com/Mingwen-Cui/GalWriter/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Web%20%7C%20Android-lightgrey.svg)](https://github.com/Mingwen-Cui/GalWriter/releases)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-orange.svg)](https://tauri.app/)
[![React](https://img.shields.io/badge/frontend-React%20%2B%20TypeScript-61dafb.svg)](https://react.dev/)

<img src="./public/icon.png" alt="GalWriter AI" width="96" />

中文 | [English](README.en.md) | [日本語](README.ja.md)

[官网](https://mingwencui.com/AIwriter/?lang=zh) · [下载应用](https://github.com/Mingwen-Cui/GalWriter/releases) · [本地开发](#本地开发) · [常见问题](#常见问题)

</div>

## 为什么做 GalWriter AI？

视觉小说和多分支叙事通常会同时涉及剧情结构、角色设定、场景资料、图片素材、语音、测试和导出。传统文档很难直观看到分支走向，普通白板又缺少 AI 写作和项目管理能力。

**GalWriter AI** 把这些流程集中到一个可视化编辑器中：你可以在画布上组织剧情节点、连接分支、管理角色与场景，使用自己的 AI 接口续写和生成素材，并把项目保存在本机，方便下次继续编辑。

## 核心能力

- **可视化剧情画布**：用节点和连线组织剧情、分支、角色、场景、条件判断和背景区域。
- **项目本地持久化**：最近项目、项目进度和编辑状态保存在本机，支持继续上次创作。
- **AI 接口配置中心**：文本、图片、语音 AI 配置独立保存，可创建多套 Provider / Model / API Key / API URL。
- **API Key 默认不导出**：密钥默认只保存在当前设备本地；只有在用户导出时主动勾选，才会写入项目导出文件。
- **AI 写作助手**：支持续写、润色、插入剧情、场景描写、对话补写、剧情分析和参考文档对话。
- **多媒体工作流**：支持图片生成、语音生成、素材导入和实时预览；视频导出与网页导出以 Windows / Web 版能力为准。
- **多端版本**：提供 Windows 版、Web 版和 Android 版；Windows 与 Android 均通过 Tauri 打包。

## 下载与安装

### 版本概览

GalWriter AI 提供 Windows 版、Web 版和 Android 版。Windows 与 Android 都使用 Tauri 打包，适合需要本地应用体验的用户；Web 版适合打开即试和在线演示。

| 版本 | 获取方式 | 适合场景 |
| --- | --- | --- |
| Windows 版 | 从 [Releases](https://github.com/Mingwen-Cui/GalWriter/releases) 下载安装包或便携版 | 长期创作、正式项目、本地文件管理 |
| Web 版 | 访问官方 Web 版 | 快速体验、在线演示、轻量编辑 |
| Android 版 | 从发布页获取 APK，或按 Android 打包流程自行构建 | 移动端剧本测试和预览 |

<details>
<summary><strong>Windows 版安装步骤</strong></summary>

1. 打开 [Releases](https://github.com/Mingwen-Cui/GalWriter/releases)。
2. 下载 `GalWriter-Setup-Lite.exe` 安装包，或下载 `GalWriter-AI-v1.2.5-windows-x64.exe` 便携版。
3. 使用安装包时，双击运行并按提示完成安装；使用便携版时，双击 exe 即可启动。
4. 首次打开后创建新项目，或导入已有项目 ZIP。

</details>

<details>
<summary><strong>Android 版安装步骤</strong></summary>

1. 从发布页下载 Android APK，或按 [ANDROID_BUILD_GUIDE.md](ANDROID_BUILD_GUIDE.md) 自行打包。
2. 如果是手动安装 APK，请在 Android 系统中允许来自当前来源的应用安装。
3. 打开 APK 完成安装。
4. 启动 GalWriter AI，用于移动端剧本测试和预览。

</details>

当前版本的视频导出以应用内导出流程为准，不再要求用户额外准备旧版外部转码组件。

### 三个版本的区别

| 对比项 | Windows 版 | Web 版 | Android 版 |
| --- | --- | --- | --- |
| 主要用途 | 正式创作、长期项目、本地交付 | 快速体验、在线演示、轻量编辑 | 移动端剧本测试和预览 |
| 打包方式 | Tauri Windows 应用 | Web 前端构建 | Tauri Android 应用 |
| 数据位置 | 本机应用数据和用户选择的导出文件 | 浏览器本地存储 | Android 应用数据和用户选择的导出文件 |
| 文件能力 | 支持更完整的本地文件读写、项目导入导出和素材管理 | 受浏览器权限限制，文件访问需要用户手动选择 | 受 Android 文件权限影响，以剧本测试所需能力为主 |
| AI 配置 | 保存在当前设备本地 | 保存在当前浏览器环境中 | 保存在当前 Android 设备本地 |
| 视频导出 / 网页导出 | 适合正式导出、较长内容和本地保存 | 适合预览或轻量导出 | 不提供视频导出和网页导出体验 |

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
- API Key 默认不会随项目导出；只有在导出时主动勾选包含密钥，才会写入导出文件。
- 一个项目中的 AI 对话只保存在该项目中。

## 视频导出策略

GalWriter AI 的视频导出按“项目内预览稳定、最终文件可交付”的原则设计。

- Web 版和 Windows 版共用前端渲染逻辑，尽量保证预览效果与导出结果一致。
- Web 版适合短内容预览和轻量导出，输出能力会受到浏览器编码支持、内存和标签页生命周期影响。
- Windows 版适合在本地应用环境中保存导出结果，更适合较长内容和正式交付。
- Android 版用于移动端剧本测试，不提供视频导出和网页导出功能体验。
- 当前导出流程不要求用户安装或随包携带旧版外部转码组件；导出能力以应用内编码与保存流程为准。
- 项目 ZIP 导出和视频导出是两条独立流程：ZIP 用于备份和迁移项目，视频文件用于预览、发布或交付。

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

### 打包 Windows / Android App

<details>
<summary><strong>Windows 版打包</strong></summary>

```bash
npm run tauri:build:lite
npm run tauri:build:portable:lite
```

安装包构建会输出 `release/GalWriter-Setup-Lite.exe`。便携构建会输出 `release/GalWriter-AI-v1.2.5-windows-x64.exe`。

</details>

<details>
<summary><strong>Android 版打包</strong></summary>

Android 打包需要 Android Studio、Android SDK、NDK、Rust 和 Tauri Android 环境。完整步骤见 [ANDROID_BUILD_GUIDE.md](ANDROID_BUILD_GUIDE.md)。

```bash
npm run tauri android init
npm run tauri android build -- --debug
npm run tauri android build
```

Debug APK 适合本机测试，Release 包适合正式分发或后续签名上架。

</details>

## 技术栈

- **前端**：React、TypeScript、Vite、Tailwind CSS、React Flow
- **本地应用**：Tauri 2、Rust、Windows、Android
- **本地存储**：IndexedDB / 本机应用数据
- **项目导出**：ZIP、Web 导出、视频导出
- **视频处理**：浏览器录制能力、Mediabunny 编码和本地应用保存流程

## 项目结构

```text
├── src/                         # 主应用前端源码
│   ├── components/              # 编辑器组件、节点组件、渲染与视频工作台 UI
│   ├── editor-shell/            # 应用壳层、顶层弹窗、编辑器主工作区
│   ├── editor-features/         # 画布、节点、批处理等编辑器功能模块
│   ├── editor-services/         # 项目序列化、本地持久化、AI 与媒体服务
│   ├── editor-state/            # 共享状态、默认配置和跨组件设置
│   ├── domain/                  # 项目数据结构、节点类型和业务类型定义
│   ├── lib/                     # 通用工具、本地数据库、文件读取和运行时适配
│   ├── agent/                   # 应用内助手相关逻辑
│   ├── animation/               # 动画与动效层
│   ├── mobile/                  # 移动端适配入口
│   └── pages/                   # 页面级入口与路由相关组件
├── src-tauri/                   # Tauri 本地应用工程，覆盖 Windows 与 Android
│   ├── src/                     # Rust 命令、窗口能力、移动端入口和本地文件操作
│   ├── capabilities/            # Tauri 权限能力配置
│   ├── icons/                   # 桌面应用图标资源
│   ├── gen/                     # Tauri 生成目录，包含 Android 工程
│   └── tauri.lite.conf.json     # 当前桌面构建配置
├── build-scripts/               # Release 安装包和便携包整理脚本
├── public/                      # Web 静态资源
├── docs/                        # 项目文档与发布说明
├── release/                     # 本地打包输出目录
├── dist/                        # Web 构建输出目录
├── package.json                 # npm 脚本、依赖和版本信息
├── ANDROID_BUILD_GUIDE.md       # Android 打包详细步骤
└── vite.config.ts               # Vite 与构建配置
```

## 常见问题

<details>
<summary><strong>项目会保存在哪里？</strong></summary>

Web 端项目保存在浏览器本地存储中。Windows 和 Android 版项目保存在对应设备的应用本地数据中。项目 ZIP 导出可用于备份和迁移。

</details>

<details>
<summary><strong>API Key 会被导出吗？</strong></summary>

默认不会。AI 接口配置和 API Key 默认只保存在当前设备本地；如果用户在导出项目时主动勾选包含 API Key，才会随导出文件一起保存。

</details>

<details>
<summary><strong>可以配置多个 AI Provider 吗？</strong></summary>

可以。文本、图片、语音 AI 都支持保存多套配置，并在设置面板中切换当前使用的配置。

</details>

## License

Created by Mingwen Cui, Tommy Ren.

Please add a repository license file before public redistribution or commercial use.

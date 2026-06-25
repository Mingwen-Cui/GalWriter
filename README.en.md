<div align="center">

# GalWriter AI

### An AI-powered writing workspace for visual novels, galgames, and branching interactive stories

[![Version](https://img.shields.io/github/v/release/Mingwen-Cui/GalWriter?color=blue&label=version)](https://github.com/Mingwen-Cui/GalWriter/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Web%20%7C%20Android-lightgrey.svg)](https://github.com/Mingwen-Cui/GalWriter/releases)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-orange.svg)](https://tauri.app/)
[![React](https://img.shields.io/badge/frontend-React%20%2B%20TypeScript-61dafb.svg)](https://react.dev/)

<img src="./public/icon.png" alt="GalWriter AI" width="96" />

[中文](README.md) | English | [日本語](README.ja.md)

[Official Website](https://mingwencui.com/AIwriter/?lang=en) · [Download App](https://github.com/Mingwen-Cui/GalWriter/releases) · [Development](#development) · [FAQ](#faq)

</div>

## Why GalWriter AI?

Visual novels and branching stories are rarely just text. They involve plot structure, character lore, scene notes, images, voice, testing, exports, and many small production decisions. Plain documents make branching hard to understand, while generic whiteboards usually lack AI writing tools and project persistence.

**GalWriter AI** brings those workflows into one visual editor. You can organize story nodes on a canvas, connect branches, manage characters and scenes, use your own AI providers for writing and media generation, and keep projects locally so you can continue editing later.

## Highlights

- **Visual story canvas**: build story flow with nodes, edges, branches, characters, scenes, conditions, and background regions.
- **Local project persistence**: recent projects, saved progress, and editor state are stored locally for continued editing.
- **AI configuration center**: create multiple text, image, and voice AI profiles with Provider, Model, API Key, and API URL.
- **API keys stay out of exports**: secrets remain on the current device and are never bundled into project ZIP files.
- **AI writing assistant**: continue, polish, insert, describe scenes, complete dialogue, analyze story context, and chat with reference documents.
- **Media workflow**: generate images, create voiceover, import assets, preview scenes, and export videos.
- **Multi-platform versions**: Windows, Web, and Android are available; Windows and Android are packaged with Tauri.

## Download & Installation

### Version Overview

GalWriter AI provides Windows, Web, and Android versions. Windows and Android are packaged with Tauri and are intended for users who want a native app experience. The web version is best for quick trials and online demos.

| Version | How to get it | Best for |
| --- | --- | --- |
| Windows | Download the installer or portable build from [Releases](https://github.com/Mingwen-Cui/GalWriter/releases) | Long-term writing, real projects, local file management |
| Web | Use a hosted web build or run your own web build | Quick trials, online demos, light editing |
| Android | Download the APK from the release page, or build it yourself with the Android packaging flow | Mobile preview, light editing, reviewing projects on the go |

<details>
<summary><strong>Windows Installation</strong></summary>

1. Open [Releases](https://github.com/Mingwen-Cui/GalWriter/releases).
2. Download `GalWriter-Setup-Lite.exe`, or download the portable `GalWriter-AI-v1.2.5-windows-x64.exe`.
3. For the installer, run it and follow the prompts. For the portable build, double-click the exe to start.
4. Create a new project, or import an existing project ZIP.

</details>

<details>
<summary><strong>Android Installation</strong></summary>

1. Download the Android APK from the release page, or build it yourself by following [ANDROID_BUILD_GUIDE.md](ANDROID_BUILD_GUIDE.md).
2. If installing an APK manually, allow app installation from the current source in Android settings.
3. Open the APK and complete installation.
4. Launch GalWriter AI, then create a project or import a project ZIP.

</details>

Current video export uses the in-app export workflow and no longer requires users to prepare legacy external transcoding components.

### Version Differences

| Area | Windows | Web | Android |
| --- | --- | --- | --- |
| Primary use | Serious writing, long-term projects, local delivery | Quick trials, online demos, light editing | Mobile preview, editing on the go, light project maintenance |
| Packaging | Tauri Windows app | Web frontend build | Tauri Android app |
| Data location | Native app data and user-selected export files | Browser-local storage | Android app data and user-selected export files |
| File access | Fuller local file access, project import/export, and asset management | Limited by browser permissions; files must be selected by the user | Affected by Android file permissions; best for import/export and light asset management |
| AI settings | Stored locally on the current device | Stored in the current browser environment | Stored locally on the current Android device |
| Video export | Better for final export, longer content, and local saving | Better for previews or lightweight export | Better for mobile preview and lightweight export |

## Quick Start

1. Open GalWriter AI.
2. Create a new project or import an existing one.
3. Add story, character, scene, background, or condition nodes to the canvas.
4. Connect nodes to build story routes and branches.
5. If you need AI features, open **Settings > AI API Configuration** and create text, image, or voice AI profiles.
6. Save the project. Next time, reopen it from Recent Projects.
7. Export a project ZIP for backup or handoff, or use the video export workspace when you need a rendered video.

## AI Providers & Local Data

GalWriter AI is provider-agnostic. You can connect text, image, and voice models depending on your workflow.

| Type     | Used for                                                | Example Providers                                                         |
| -------- | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| Text AI  | continuation, polishing, assistant chat, story analysis | DeepSeek, Claude, Gemini, Kimi, Qwen, GLM, OpenAI, custom compatible APIs |
| Image AI | character, scene, and background generation             | Doubao, Gemini, OpenAI, local Stable Diffusion WebUI, custom APIs         |
| Voice AI | narration, dubbing, text-to-speech                      | system voice, Youdao, OpenAI, Doubao, custom APIs                         |

Data principles:

- Project content is saved in the local project library.
- AI profiles are saved only on the current device.
- API keys are not included in project exports.
- AI conversations belong to the current project only.

## Video Export Strategy

GalWriter AI designs video export around stable in-project previews and deliverable final files.

- The web, Windows, and Android versions share the same frontend rendering logic, so previews and exported results stay as consistent as possible.
- The web version is best for short previews and lightweight export. Its output capability depends on browser encoding support, memory, and tab lifecycle.
- The Windows and Android versions save through the native app environment. Windows is better for longer content and final delivery.
- The current export flow does not require users to install or bundle legacy external transcoding components; export capability is based on the in-app encoding and save workflow.
- Project ZIP export and video export are separate workflows: ZIP files are for backup and migration, while rendered videos are for preview, publishing, or delivery.

## Development

### Requirements

- Node.js 18+
- npm
- Rust 1.77+
- Tauri 2 system prerequisites

### Install dependencies

```bash
npm install
```

### Run the web dev server

```bash
npm run dev
```

The default local URL is `http://localhost:3000`.

### Run the Windows app in development

```bash
npm run tauri dev
```

### Type check and build

```bash
npm run typecheck
npm run build
```

### Package Windows / Android Apps

<details>
<summary><strong>Windows Packaging</strong></summary>

```bash
npm run tauri:build:lite
npm run tauri:build:portable:lite
```

The installer build outputs `release/GalWriter-Setup-Lite.exe`. The portable build outputs `release/GalWriter-AI-v1.2.5-windows-x64.exe`.

</details>

<details>
<summary><strong>Android Packaging</strong></summary>

Android packaging requires Android Studio, Android SDK, NDK, Rust, and the Tauri Android environment. See [ANDROID_BUILD_GUIDE.md](ANDROID_BUILD_GUIDE.md) for the full workflow.

```bash
npm run tauri android init
npm run tauri android build -- --debug
npm run tauri android build
```

Debug APKs are for local testing. Release builds are for distribution or later signing and store submission.

</details>

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, React Flow
- **Native apps**: Tauri 2, Rust, Windows, Android
- **Local storage**: IndexedDB / native app data
- **Exports**: ZIP, web export, video export
- **Video**: browser recording capability, Mediabunny encoding, and native app save workflow

## Project Structure

```text
├── src/                         # Main frontend source
│   ├── components/              # Editor components, node components, render and video workspace UI
│   ├── editor-shell/            # App shell, top-level modals, main editor workspace
│   ├── editor-features/         # Canvas, nodes, batch actions, and editor feature modules
│   ├── editor-services/         # Project serialization, local persistence, AI and media services
│   ├── editor-state/            # Shared state, default config, cross-component settings
│   ├── domain/                  # Project data structures, node types, domain types
│   ├── lib/                     # Utilities, local database, file reading, runtime adapters
│   ├── agent/                   # In-app assistant logic
│   ├── animation/               # Animation and motion layer
│   ├── mobile/                  # Mobile adaptation entry points
│   └── pages/                   # Page-level entry points and routing components
├── src-tauri/                   # Tauri native app project for Windows and Android
│   ├── src/                     # Rust commands, window capabilities, mobile entry point, local file operations
│   ├── capabilities/            # Tauri permission capability config
│   ├── icons/                   # Native app icon assets
│   ├── gen/                     # Tauri generated directory, including the Android project
│   └── tauri.lite.conf.json     # Current Windows build config
├── build-scripts/               # Release installer and portable package helper scripts
├── public/                      # Web static assets and hosted API example
│   └── api/                     # Web hosted proxy files
├── docs/                        # Project docs and release notes
├── landingpage/                 # Standalone website / landing page assets
├── release/                     # Local package output directory
├── dist/                        # Web build output directory
├── package.json                 # npm scripts, dependencies, and version metadata
├── ANDROID_BUILD_GUIDE.md       # Detailed Android packaging steps
└── vite.config.ts               # Vite and build config
```

## FAQ

<details>
<summary><strong>Where are projects stored?</strong></summary>

On the web, projects are stored in browser-local storage. In the Windows and Android apps, projects are stored in the app data of the current device. Project ZIP exports can be used for backup and migration.

</details>

<details>
<summary><strong>Are API keys included in project exports?</strong></summary>

No. AI profiles are stored only on the current device, and API keys are not included in project exports.

</details>

<details>
<summary><strong>Why does the web version not export MP4 or MOV directly?</strong></summary>

Video encoding and container support vary across browsers. GalWriter AI prioritizes the stable export path available in the current runtime; if a format is unavailable in the current environment, use the Windows app or choose one of the formats offered by the app.

</details>

<details>
<summary><strong>Do I need to install extra video tools?</strong></summary>

This README no longer treats external video tools as a prerequisite for export. In most cases, use the in-app video export workflow directly.

</details>

<details>
<summary><strong>Can I configure multiple AI providers?</strong></summary>

Yes. Text, image, and voice AI each support multiple saved profiles. You can switch the active profile from the settings panel.

</details>

## Contributing

Issues and pull requests are welcome. For larger features, please open an issue first to discuss direction and scope.

Before submitting changes, run:

```bash
npm run typecheck
npm run build
```

If your change touches Tauri or Rust:

```bash
cd src-tauri
cargo check
```

## License

Created by Mingwen Cui, Tommy Ren.

Please add a repository license file before public redistribution or commercial use.

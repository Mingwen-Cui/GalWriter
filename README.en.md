<div align="center">

# GalWriter AI

### A local-first AI writing workspace for visual novels, galgames, and branching interactive stories

[![Version](https://img.shields.io/github/v/release/Mingwen-Cui/GalWriter?color=blue&label=version)](https://github.com/Mingwen-Cui/GalWriter/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Web%20%7C%20Android-lightgrey.svg)](https://github.com/Mingwen-Cui/GalWriter/releases)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-orange.svg)](https://tauri.app/)
[![Frontend](https://img.shields.io/badge/frontend-React%2019%20%2B%20TypeScript-61dafb.svg)](https://react.dev/)

<img src="./public/icon.png" alt="GalWriter AI" width="96" />

[中文](README.md) | English | [日本語](README.ja.md)

[Download Releases](https://github.com/Mingwen-Cui/GalWriter/releases) · [Android Build Guide](ANDROID_BUILD_GUIDE.md) · [Development](#development) · [Architecture](#architecture-overview) · [FAQ](#faq)

</div>

## Project Positioning

GalWriter AI is a story workspace that puts plot structure, character setup, scene setup, AI generation, media assets, playtesting, and export delivery onto the same canvas. It is not just a text editor and not just a generic whiteboard. It is organized around the actual production flow of visual novels and interactive storytelling.

The current repository already covers the editor, local project library, AI profile management, assistant and agent workflows, media tooling, playtest, web export, video export, and native Windows / Android integrations through Tauri.

## What It Does Now

- **Visual story canvas**: supports `storyNode`, `characterNode`, `sceneNode`, `aiNode`, `backgroundNode`, `groupNode`, `numberConditionNode`, `batchReplaceNode`, `plotStructureNode`, `textNode`, and `summaryNode`.
- **Local project library**: built-in project home, recent projects, rename, delete, batch import/export, and default save directory handling.
- **AI profile center**: manages text, image, background-removal, and voice profiles separately, with multiple Provider / Model / API URL / API Key presets.
- **Assistant and agent workflows**: supports streaming chat, card generation, document context, memory notes, future-target planning, starter flows, and revision flows.
- **Media workflow**: character art, scene art, transparent background processing, TTS, media extraction, region background music, and panorama scenes.
- **Playtest and presentation**: immersive layout, typewriter playback, auto-advance, presentation entry motions, and Zen editing.
- **Multiple export paths**: project ZIP backup/import, interactive web ZIP export, and a video rendering workspace.
- **Local-first persistence and autosave**: projects, app settings, AI profiles, and autosave stay local by default; API keys are excluded from project export unless explicitly included.

## Platform Notes

| Platform | Current role | Notes |
| --- | --- | --- |
| Windows | Main authoring and final export target | Tauri save dialogs, native export paths, system TTS, and the most complete video/web export flow |
| Web | Fast trial and lightweight editing | Uses browser-local storage and is good for quick testing, light editing, and shorter previews/exports |
| Android | Mobile preview and testing | Packaged with Tauri Android and oriented more toward mobile viewing and script testing |

## Quick Start

1. Open GalWriter AI and create a new project or import an existing project ZIP.
2. Add story, character, scene, condition, or background/group nodes and connect them into routes.
3. Open `Settings > AI` and configure text, image, background-removal, and voice profiles.
4. If you need extra context, upload `PDF / DOCX / XLSX / PPTX / TXT / MD / CSV / JSON / XML / HTML / RTF` files to the Assistant.
5. Use Playtest to validate pacing, then export a project ZIP, interactive web ZIP, or video when needed.

## AI and Document Support

| Category | Current integration direction |
| --- | --- |
| Text AI | DeepSeek, Gemini, OpenAI, Claude, Kimi, Qwen, Copilot, GLM, Ollama, custom-compatible APIs, hosted proxy |
| Image AI | Doubao, Gemini, OpenAI, Qwen, GLM, local Stable Diffusion WebUI, custom APIs |
| Background removal | Custom APIs, Aliyun Vision, Volcengine veImageX |
| Voice AI | system voice, Youdao, OpenAI, Doubao, Gemini, custom APIs, hosted proxy |

Notes:

- Actual availability depends on your keys, model names, and endpoint compatibility.
- `src/editor-services/aiClient.ts` is the unified entry point and currently exposes `generateText()`, `analyze()`, and `generateSetting()`.
- Assistant document ingestion is implemented in `src/lib/documentReader.ts`, which extracts readable text and feeds it into the current conversation context.

## Local Data and Privacy

- On the web build, `autosave`, `localProjects`, `appSettings`, `apiSettings`, and `aiProfiles` are stored in IndexedDB.
- On Windows and Android, the app also stores local app data plus user-selected export paths and default save locations.
- API keys stay on the current device by default and are not written into project ZIPs automatically.
- Active API profiles and keys are included only when the user explicitly chooses that option during export.
- Whether assistant conversations are saved with the project depends on `saveAssistantConversations`.

## Development

### Requirements

- Node.js 18+
- npm
- Rust 1.77+
- Tauri 2 runtime/build prerequisites
- Android Studio / SDK / NDK for Android packaging

### Common Commands

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run build
npm run preview
```

### Desktop Development

```bash
npm run tauri -- dev
```

### Packaging

```bash
npm run tauri:build:all-platforms
```

Artifacts are written to `release/`:

- `GalWriter-AI-v<version>-windows-x64-setup.exe`
- `GalWriter-AI-v<version>-windows-x64-portable.zip`
- `GalWriter-AI-v<version>-windows-x64.msi`
- `GalWriter-AI-v<version>-web.zip`
- `GalWriter-AI-v<version>-android-signed.apk`
- `GalWriter-AI-v<version>-android.aab`

If the Android project has not been initialized locally yet, run:

```bash
npm run tauri:android:init
```

Notes:

- `Web + Windows` build directly.
- `Android` requires a local Android SDK / NDK install, an initialized `src-tauri/gen/android`, and signing configuration.
- If Android prerequisites are missing, `tauri:build:all-platforms` still produces the web and Windows assets and skips Android.

For Android signing and environment setup, see [ANDROID_BUILD_GUIDE.md](ANDROID_BUILD_GUIDE.md).

## Architecture Overview

- `src/domain/`: explicit project domain types such as `StoryProject`, `ProjectSettings`, node data, and presentation models.
- `src/editor-shell/`: top-level shell components for the header, toolbars, modals, and assistant panel composition.
- `src/editor-state/`: shared configuration and state hooks such as `usePlaytestSettings` and `useSharedRenderStyle`.
- `src/editor-features/`: responsibility-based feature modules for AI, assistant, canvas, project I/O, selection, media, and node actions.
- `src/editor-services/`: service interfaces such as `aiClient`, `projectSerializer`, `autosaveService`, `localPersistenceService`, and `ttsService`.
- `src/components/`: node components, `StoryEditor`, playtest UI, settings UI, and render UI.
- `src/lib/`: IndexedDB, document parsing, export helpers, presentation helpers, plot utilities, and runtime adapters.
- `src-tauri/`: native Windows / Android commands for file saving, render work directories, system TTS, proxy requests, and window behavior.

## Project Structure

```text
.
├── build-scripts/              # Packaging helper scripts
├── docs/                       # Project documentation
├── examples/                   # Example assets
├── public/                     # Web static assets
├── release/                    # Local packaging output
├── scripts/                    # Misc scripts
├── src/
│   ├── agent/                  # Assistant / agent runtime and planning
│   ├── animation/              # Animation assets
│   ├── components/             # StoryEditor, node components, Playtest, render UI
│   ├── domain/                 # Domain model and strong types
│   ├── editor-features/        # Canvas, AI, media, project I/O, selection, node actions
│   ├── editor-services/        # AI, serialization, autosave, local persistence, TTS
│   ├── editor-shell/           # Top-level shell and modal composition
│   ├── editor-state/           # Shared editor state and defaults
│   └── lib/                    # DB, document parsing, export, runtime adapters
├── src-tauri/                  # Tauri native project
├── ANDROID_BUILD_GUIDE.md      # Android packaging guide
├── eslint.config.js
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## FAQ

### Where are projects stored?

On the web build, projects are primarily stored in IndexedDB. On Windows and Android, projects live in local app data, while project ZIPs, web ZIPs, and rendered videos are saved to user-selected locations.

### Are API keys exported with the project?

Not by default. They are included only when the user explicitly chooses to export active API profiles and keys.

### Which files can the Assistant read today?

The current code supports `PDF`, `DOCX`, `XLSX`, `PPTX`, `TXT`, `MD`, `CSV`, `TSV`, `JSON`, `XML`, `HTML`, and `RTF` documents as long as readable text can be extracted.

### Can Web and Android be used for final export?

The web build is good for lightweight previews and shorter exports. Windows is the better target for longer renders and final delivery. Android is currently oriented more toward mobile preview/testing than full desktop-class export workflows.

## License

Created by Mingwen Cui, Tommy Ren.

The repository does not currently include a formal license file. Add one before public redistribution or commercial use.

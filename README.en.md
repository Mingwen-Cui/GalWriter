<div align="center">

# GalWriter AI

### An AI-powered writing workspace for visual novels, galgames, and branching interactive stories

[![Version](https://img.shields.io/github/v/release/Mingwen-Cui/GalWriter?color=blue&label=version)](https://github.com/Mingwen-Cui/GalWriter/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Web-lightgrey.svg)](https://github.com/Mingwen-Cui/GalWriter/releases)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-orange.svg)](https://tauri.app/)
[![React](https://img.shields.io/badge/frontend-React%20%2B%20TypeScript-61dafb.svg)](https://react.dev/)

<img src="./public/icon.png" alt="GalWriter AI" width="96" />

[中文](README.md) | English | [日本語](README.ja.md)

[Download Desktop App](https://github.com/Mingwen-Cui/GalWriter/releases) · [Development](#development) · [FAQ](#faq)

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
- **Web demo and desktop app**: the web version is great for trying the editor; the desktop app provides the full local export workflow.

## Screenshots

The repository does not currently include full screenshot assets. Recommended future path: `assets/screenshots/`.

| Editor Canvas | AI Settings | Video Export |
| :-----------: | :---------: | :----------: |
|  Coming soon  | Coming soon | Coming soon  |

## Download & Installation

### Desktop App

Download the latest build from [Releases](https://github.com/Mingwen-Cui/GalWriter/releases).

The desktop app is recommended for serious writing, local project management, full file access, and video export.

| Installer | Recommended for | Video export |
| --------- | --------------- | ------------ |
| `GalWriter-Setup.exe` | Recommended for most users. Larger download, but works out of the box. | Bundles a slim FFmpeg build and directly exports WebM, MP4, MOV, and MKV. |
| `GalWriter-Setup-Lite.exe` | For users who care about download size and already have FFmpeg installed. | Does not bundle FFmpeg. WebM works; MP4 / MOV / MKV require system FFmpeg. |
| `GalWriter-AI-v1.2.5-windows-x64.exe` | For users who want a no-install, double-click executable. | Single-file portable Lite build; non-WebM export requires system FFmpeg. |
| `GalWriter-AI-v1.2.5-windows-x64-portable-full.zip` | For users who want no installation but still need bundled FFmpeg. | Extract the zip and keep `ffmpeg.exe` next to the app executable. |

Release builds only bundle `ffmpeg.exe` in the Full installer. They do not include `ffprobe.exe`, documentation, presets, or other unrelated FFmpeg files.

### Web Version

The web version is intended for demos and quick trials. Due to browser limitations, direct video export on the web only supports **WebM**. For **MP4 / MOV / MKV** and other common formats, use the desktop app; the Full installer is recommended because it bundles FFmpeg.

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

| Environment      | Direct export formats | Notes                                                                          |
| ---------------- | --------------------- | ------------------------------------------------------------------------------ |
| Web Demo         | WebM                  | Uses browser-native recording for the most reliable web workflow.              |
| Desktop App Full | WebM, MP4, MOV, MKV   | Bundles a slim FFmpeg build and is recommended for most users.                 |
| Desktop App Lite | WebM, MP4, MOV, MKV   | Does not bundle FFmpeg. WebM works; MP4 / MOV / MKV require system FFmpeg.     |

When a web user selects MP4, MOV, or MKV, GalWriter AI shows an in-app prompt and points them to the desktop release page. If the Lite app or local runtime cannot find FFmpeg, the app also shows an in-app prompt to download the Full app or switch to WebM.

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

### Run the desktop app in development

```bash
npm run tauri dev
```

### Type check and build

```bash
npm run typecheck
npm run build
```

### Package the desktop app

```bash
npm run tauri:check:ffmpeg
npm run tauri:build:full
npm run tauri:build:lite
npm run tauri:build:portable
npm run tauri:build:portable:full
```

The Full build checks for `src-tauri/binaries/ffmpeg.exe` and copies the installer to `release/GalWriter-Setup.exe`. The Lite build excludes FFmpeg and outputs `release/GalWriter-Setup-Lite.exe`. The portable Lite build outputs `release/GalWriter-AI-v1.2.5-windows-x64.exe`; the portable Full build outputs a zip that includes `ffmpeg.exe`.

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, React Flow
- **Desktop**: Tauri 2, Rust
- **Local storage**: IndexedDB / native app data
- **Exports**: ZIP, web export, video export
- **Video**: browser MediaRecorder, desktop FFmpeg detection, and Full/Lite packaging

## Project Structure

```text
├── src/                         # React + TypeScript frontend
│   ├── components/              # editor, nodes, settings, render UI
│   ├── editor-features/         # editor feature modules
│   ├── editor-services/         # persistence, serialization, media services
│   ├── editor-shell/            # top-level modals and editor shell
│   └── lib/                     # utilities, local DB, runtime adapters
├── src-tauri/                   # Tauri + Rust desktop layer
│   ├── binaries/                # bundled FFmpeg for desktop export
│   └── src/                     # Tauri commands and local file handling
├── build-scripts/               # FFmpeg checks and Full/Lite installer helpers
├── public/                      # public static assets
└── dist/                        # web build output
```

## FAQ

<details>
<summary><strong>Where are projects stored?</strong></summary>

On the web, projects are stored in browser-local storage. In the desktop app, projects are stored in local app data. Project ZIP exports can be used for backup and migration.

</details>

<details>
<summary><strong>Are API keys included in project exports?</strong></summary>

No. AI profiles are stored only on the current device, and API keys are not included in project exports.

</details>

<details>
<summary><strong>Why does the web version not export MP4 or MOV directly?</strong></summary>

Browser-native video recording does not provide reliable MP4/MOV support across platforms. GalWriter AI only promises WebM on the web. The Full desktop app uses bundled FFmpeg to export MP4, MOV, MKV, and WebM; the Lite app needs system FFmpeg for those common formats.

</details>

<details>
<summary><strong>Do I need to install FFmpeg?</strong></summary>

If you download `GalWriter-Setup.exe` Full, no. Users can export directly. If you download `GalWriter-Setup-Lite.exe`, MP4 / MOV / MKV export requires FFmpeg to already be installed on the computer; otherwise the app will suggest downloading the Full build or exporting WebM.

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

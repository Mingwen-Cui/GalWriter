<div align="center">

# GalWriter

### Build stories. Share worlds.

[![Version](https://img.shields.io/github/v/release/Mingwen-Cui/GalWriter?color=blue&label=version)](https://github.com/Mingwen-Cui/GalWriter/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Web%20%7C%20Android-lightgrey.svg)](https://github.com/Mingwen-Cui/GalWriter/releases)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-orange.svg)](https://tauri.app/)
[![Frontend](https://img.shields.io/badge/frontend-React%2019%20%2B%20TypeScript-61dafb.svg)](https://react.dev/)

<img src="./public/icon.png" alt="GalWriter" width="96" />

[中文](README.md) | English | [日本語](README.ja.md)

[Download Releases](https://github.com/Mingwen-Cui/GalWriter/releases) · [Quick Start](#quick-start) · [Export and Delivery](#export-and-delivery) · [Development](#development) · [Build and Release Guide](docs/build/BUILD_GUIDE.en.md)

</div>

## About the Project

GalWriter is a local-first authoring workspace for visual novels, branching stories, and interactive presentations. Organize plots, characters, scenes, and numeric conditions on a node canvas, use AI to help write and create assets, test branches in Playtest, and export the same project as an interactive website, video, PowerPoint presentation, or game engine project.

The current source version is **1.3.0**, built with React 19, TypeScript, React Flow, Vite 6, and Tauri 2, with Chinese, English, and Japanese interfaces. This README describes the implementation in the current repository; downloadable builds depend on the assets available in Releases.

## Core Features

- **Story canvas**: story, character, scene, AI generation, background, group, numeric condition, batch replacement, plot structure, note, and summary nodes; branching connections, character and scene tags, rich text, and Zen editing.
- **Projects and asset libraries**: a local project home, recent projects, autosave and recovery, and project ZIP import/export; reusable character and scene settings, preset assets available for download on demand, and a music library with import, preview, and regional BGM.
- **AI authoring**: multiple profiles managed separately for text, images, background removal, and voice; continuation, rewriting, story insertion, structure analysis, character and scene generation, and custom prompts.
- **Assistant / Agent**: streaming chat, canvas card and document context, memory notes, task conversations, planning, and revision; the Agent can generate, fill, connect, and arrange cards. Creative Play continues stories based on characters, genres, player choices, or free-form input while retaining chapter summaries and branches.
- **Media and staging**: character artwork with multiple forms, scene images and panorama previews, background removal, speech synthesis, recording, ambient sound, regional music, character entrances, and inline actions.
- **Playtest**: classic or immersive layouts, typewriter effects, auto-advance, choices, and branches based on numeric conditions; check story paths, character and scene changes, and audiovisual pacing.
- **Export workspace**: Web, video, PPT, and code modes, each with previews, appearance editing, and its own export settings; inherit a shared appearance or save a separate appearance for each mode.

## Quick Start

1. Download the app from [Releases](https://github.com/Mingwen-Cui/GalWriter/releases), or follow the instructions below to start a local Web development build.
2. Create a project or import a project ZIP, place story cards on the canvas, and connect them to organize choices and branches.
3. Add characters, scenes, and numeric conditions. You can also select presets or saved assets from the setting library.
4. To use AI features, create and enable the relevant profile in `Settings > AI`, then enter the provider, API URL, model, and credentials. Manual editing, project management, and basic playtesting do not require an AI key.
5. Discuss the story in Assistant, reference cards, or add documents. You can also start Creative Play to generate subsequent story passages through your choices.
6. Check the story in Playtest, then open the Web, video, PPT, or code workspace from the export entry in the top toolbar. Save a separate project ZIP for backup and further editing.

## Export and Delivery

| Output              | Current scope                                                                                                             | Usage notes                                                                                                                                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project ZIP         | Story graph, settings, and packable media; batch project import/export with an optional setting library                   | For backup, migration, and further editing; API profiles are excluded by default                                                                                                                                                                                     |
| Interactive Web ZIP | Branching story, optional start menu, settings and save pages, cover, and interface design                                | Extract and publish through an HTTP(S) static server; an exported story serves a different purpose from the app's own Web build                                                                                                                                      |
| Video               | MP4 / MOV / MKV, timeline editing, audio tracks, PNG covers, and interactive clip ZIPs                                    | Encoded through the browser / WebView; results and speed depend on the device, memory, and codec support. An interactive clip ZIP contains segmented MP4 files, a branch structure PNG, and an optional cover, and requires a separate interactive playback platform |
| PowerPoint          | `.pptx`; automatic story pages and manual slides, 16:9 / 4:3, branching links, images, and videos                         | Complex decorations are composited into images; video fills use the first frame, while story / scene background videos can be embedded. Check presentation playback in the target player                                                                             |
| Game code / data    | Ren'Py, TyranoScript, Godot, and IR JSON; code preview, variable and character mapping, diagnostics, and interface design | Capabilities differ by target; check generated content in the corresponding engine. IR JSON is intermediate data rather than a runnable game                                                                                                                         |

Ren'Py, TyranoScript, and IR JSON exports are currently marked as under construction in the interface. The Godot target generates a native Godot 4.5+ project. It retains `dialogic` as an identifier for compatibility with older saved data and does not require the Dialogic plugin. TyranoScript output is intended for integration into a host project. Code export provides asset mapping and diagnostic reports; blocking errors must be resolved before a ZIP can be generated. The game interface designer mainly covers the canvas, dialog box, text, and choices. Complex decorations are converted to PNG, and identical rendering of Web effects across engines is not guaranteed.

For developer documentation on export modules and appearance data, see [EXPORT_INSPECTORS.md](docs/EXPORT_INSPECTORS.md).

## AI and Document Support

The table below lists provider options and integration paths implemented in the code. Actual availability depends on credentials, models, API compatibility, and the runtime platform.

| Category           | Configuration options                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| Text               | DeepSeek, Gemini, OpenAI, Claude, Kimi, Qwen, Copilot, GLM, Ollama, custom API                             |
| Images             | Doubao, Gemini, OpenAI, Qwen, GLM, local Stable Diffusion WebUI, custom API                                |
| Background removal | Local rembg on Windows, custom API / managed proxy, Alibaba Cloud Visual Intelligence, Volcengine veImageX |
| Voice              | System speech, Youdao, OpenAI, Doubao, Gemini, custom API                                                  |

Web deployments can also connect to managed proxies for text, images, and voice. These proxies require a separately deployed server; the repository does not include a ready-to-use `api/proxy.php`, and a static build does not provide these services. Direct browser API requests are also subject to CORS, and some signed cloud background-removal requests require a native bridge.

Assistant can extract text from documents including `PDF`, `DOCX`, `XLSX`, `PPTX`, `TXT`, `MD`, `CSV`, `TSV`, `JSON`, `XML`, `HTML`, and `RTF`. It currently retains up to approximately 24,000 characters per document, reads at most the first 80 pages of a PDF, and limits plain-text files to 2 MiB. Scanned PDFs have no built-in OCR support. Documents provide conversation context; their original layout is not fully preserved.

## Platforms and Asset Editions

| Platform | Intended use                                        | Runtime differences                                                                                                                                            |
| -------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows  | Full editing, media production, and export          | System file dialogs, output directories, system TTS, native proxies for some APIs, and optional local rembg; some media conversions require FFmpeg             |
| Web      | Browser-based use, editing, playtesting, and export | Data is saved in browser storage for the current site; APIs depend on CORS / server proxy configuration, and media export depends on browser capabilities      |
| Android  | Mobile viewing, editing, and playtesting            | Uses a Tauri Android project; file saving and media capabilities are limited by the mobile WebView and operating system. Windows-only commands are unavailable |

The app offers two asset editions that share the same feature code:

- **Full**: the default build, including presets, covers, Web templates, and Assistant assets from `public/`.
- **Lite**: omits the four large asset groups `assistant/`, `presets/`, `cover-templates/`, and `web-homepage/`, and loads them from online sources at runtime. Presets can be downloaded and cached on demand; the initial download still requires a network connection.

Lite's preset, cover, and Web asset URL can be set with the build environment variable `VITE_ASSET_BASE_URL`; the default uses a versioned asset path. Assistant assets use a separate online URL. See [appAssets.ts](src/lib/appAssets.ts) for details. Full does not include cloud AI services or the rembg runtime either.

### Local Background Removal on Windows

Local rembg does not require an API key, but you must separately install `rembg-sidecar.exe` and the model files using the paths and links shown in AI settings. The default `u2netp` setup uses these locations:

```text
%APPDATA%\com.galwriter.ai\rembg\rembg-sidecar.exe
%APPDATA%\com.galwriter.ai\rembg-models\u2netp.onnx
```

The runtime and models are not bundled with the Windows installer. Other models may need to be downloaded on first use; once prepared, image processing can run locally. Developers can find runtime build instructions in the [rembg-sidecar README](src-tauri/rembg-sidecar/README.md).

## Saving and Privacy

- Projects, autosaves, setting libraries, music libraries, app settings, and AI profiles are persisted through IndexedDB on all platforms. Tauri uses the app WebView's local storage; some interface templates and preferences use localStorage.
- Native runtimes such as Windows also provide file saving. Project ZIPs, exported story websites, videos, and PPTX files use the relevant platform's save or download workflow. Autosave does not mean that a portable project file has been created.
- API credentials are stored in local configuration on the current device by default. Project ZIPs exclude keys by default; explicitly choosing to include API profiles exports the currently enabled user profiles and their credentials, excluding built-in managed proxy profiles.
- The `saveAssistantConversations` setting controls whether Assistant conversations are saved with a project. The setting library can also be included when exporting a project.
- Remote AI calls send the relevant prompts, document excerpts, or media to the selected service or proxy. Online asset downloads also require a network connection.
- Clearing browser site data or app data affects local projects. Keep independent backups as project ZIPs.

## Development

### Requirements

- Node.js **22.x (at least 22.13) or 24+**, and npm. The current lockfile includes `pdfjs-dist` and ESLint dependencies with higher requirements; the Node 18+ requirement in older READMEs no longer applies.
- Running only the Web frontend does not require Rust. Native builds require Rust stable and the platform dependencies for Tauri 2. `Cargo.toml` declares a Rust minimum of 1.77.2, but locked dependencies may require a newer toolchain.
- Native Windows builds require MSVC C++ Build Tools, the Windows SDK, and WebView2.
- Android builds require a JDK, Android SDK / NDK, and the corresponding Rust targets. The release workflow uses JDK 21; publishing packages also requires signing configuration.

### Local Development and Checks

```bash
npm ci
npm run dev
```

Open `http://localhost:3000` in your browser. To start the Tauri desktop development app, use the following command, which starts the frontend automatically:

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

`lint` runs type checking, ESLint, and formatting checks in order. `build` defaults to building the Full frontend into `dist/` and does not run a separate type check; `preview` serves an existing build.

### Platform Builds

| Target            | Full                               | Lite                               |
| ----------------- | ---------------------------------- | ---------------------------------- |
| Web               | `npm run build:full`               | `npm run build:lite`               |
| Windows           | `npm run tauri:build:windows:full` | `npm run tauri:build:windows:lite` |
| Android APK + AAB | `npm run tauri:build:android:full` | `npm run tauri:build:android:lite` |

Before the first Android build, you can run `npm run tauri:android:init`. Web output goes to `dist/`, Windows installers to `src-tauri/target/release/bundle/`, and Android output to `src-tauri/gen/android/app/build/outputs/`.

On a machine with the Windows build environment prepared, you can build and collect artifacts for all platforms with one command:

```bash
npm run tauri:build:all-platforms
```

This command builds Full Web, builds the default Windows edition, attempts Android, and then collects artifacts into `release/`. Android is skipped if the SDK / NDK is missing or Android initialization fails; an actual Android build failure still stops the workflow. Signing must be configured separately.

Default artifact names are listed below. Android files are generated only when the corresponding build artifacts exist:

```text
GalWriter-AI-v<version>-windows-x64-setup.exe
GalWriter-AI-v<version>-windows-x64-portable.zip
GalWriter-AI-v<version>-windows-x64.msi
GalWriter-AI-v<version>-web.zip
GalWriter-AI-v<version>-android-signed.apk
GalWriter-AI-v<version>-android.aab
```

`tauri:prepare:release:full` / `tauri:prepare:release:lite` collect existing build files and add `-full` / `-lite` after the platform identifier, for example `windows-x64-lite-setup.exe` and `web-lite.zip`. These commands neither rebuild nor verify the asset edition or APK signature; collect files immediately after building the corresponding edition. The collection script requires existing Windows installers, an executable, and `dist/`. To collect only Android artifacts, use `tauri:prepare:android:full` / `tauri:prepare:android:lite`.

`npm run tauri:prepare:online-assets` collects presets, covers, and Web templates into `release/GalWriter-AI-v<version>-online-assets/`, with a file hash manifest and upload instructions. Assistant assets are not included in this asset pack.

See the [Build and Release Guide](docs/build/BUILD_GUIDE.en.md) for Android setup, signing, and release details. [package.json](package.json) and [build-scripts/](build-scripts/) are the source of truth for commands.

## Architecture and Project Structure

```text
.
├── build-scripts/              # Full/Lite builds, release collection, export validation scripts
├── docs/                       # Build guides, export architecture, release notes, and plans
├── public/                     # Icons, presets, music, covers, and Web templates
├── src/
│   ├── App.tsx                 # React Flow and dialog providers
│   ├── domain/                 # Project, node, setting library, and configuration types
│   ├── editor-shell/           # Top toolbar, Assistant, and dialog composition
│   ├── editor-state/           # Editor state, Playtest, and shared appearance
│   ├── editor-features/        # AI, Assistant, canvas, media, project I/O, setting library
│   ├── editor-services/        # AI entry points, serialization, autosave, persistence, TTS
│   ├── components/
│   │   ├── story-editor/      # Main editor and project / profile coordination
│   │   └── render/            # Playtest, Web, video, PPT, code, and shared styles
│   ├── agent/                 # Agent types, planning, runtime, and animation
│   └── lib/                   # DB, document parsing, media, asset caching, and native adapters
├── src-tauri/                  # Native commands, Tauri configuration, optional rembg runtime source
├── tests/                      # Existing export settings regression tests
├── package.json
└── vite.config.ts
```

Project data is defined in `domain`, and the editor coordinates work through feature hooks and a service layer. `projectSerializer` handles project snapshots and ZIP media packaging, while `db` handles local persistence. Export workspaces share preview and appearance tools before converting content into their respective output formats. `src/components/StoryEditor.tsx` is a compatibility re-export; the main editor lives in `src/components/story-editor/StoryEditor.tsx`.

## Authors and License

Created by Mingwen Cui, Tommy Ren.

The repository currently has no project-level `LICENSE` file.

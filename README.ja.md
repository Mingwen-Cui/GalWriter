<div align="center">

# GalWriter AI

### ビジュアルノベル、ギャルゲー、分岐型インタラクティブストーリー向けのローカルファースト AI 制作ワークスペース

[![Version](https://img.shields.io/github/v/release/Mingwen-Cui/GalWriter?color=blue&label=version)](https://github.com/Mingwen-Cui/GalWriter/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Web%20%7C%20Android-lightgrey.svg)](https://github.com/Mingwen-Cui/GalWriter/releases)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-orange.svg)](https://tauri.app/)
[![Frontend](https://img.shields.io/badge/frontend-React%2019%20%2B%20TypeScript-61dafb.svg)](https://react.dev/)

<img src="./public/icon.png" alt="GalWriter AI" width="96" />

[中文](README.md) | [English](README.en.md) | 日本語

[Releases を開く](https://github.com/Mingwen-Cui/GalWriter/releases) · [Android ビルドガイド](ANDROID_BUILD_GUIDE.md) · [開発](#開発) · [アーキテクチャ概要](#アーキテクチャ概要) · [FAQ](#faq)

</div>

## プロジェクトの位置づけ

GalWriter AI は、プロット構造、キャラクター設定、シーン設定、AI 生成、メディア素材、プレイテスト、書き出しまでを 1 枚のキャンバスにまとめるストーリー制作ワークスペースです。単なるテキストエディタでも、汎用ホワイトボードでもなく、ビジュアルノベルとインタラクティブ叙事の制作フローそのものに合わせて組み立てられています。

現在のリポジトリには、エディタ本体、ローカルプロジェクトライブラリ、AI Profile 管理、Assistant / Agent、メディア機能、Playtest、Web 書き出し、動画書き出し、そして Windows / Android 向けの Tauri ネイティブ連携が含まれています。

## 現在できること

- **ビジュアルストーリーキャンバス**：`storyNode`、`characterNode`、`sceneNode`、`aiNode`、`backgroundNode`、`groupNode`、`numberConditionNode`、`batchReplaceNode`、`plotStructureNode`、`textNode`、`summaryNode` をサポートします。
- **ローカルプロジェクトライブラリ**：プロジェクトホーム、最近使った項目、名前変更、削除、一括入出力、デフォルト保存先を備えています。
- **AI Profile センター**：テキスト、画像、背景除去、音声の 4 種類を分けて管理し、複数の Provider / Model / API URL / API Key を保存できます。
- **Assistant / Agent ワークフロー**：ストリーミング対話、カード生成、文書コンテキスト、記憶メモ、未来目標、起手式、修正フローに対応します。
- **メディア制作フロー**：キャラクター画像、シーン画像、透明背景化、TTS、素材抽出、リージョン BGM、パノラマシーンを扱えます。
- **Playtest と Presentation**：没入型レイアウト、タイプライター表示、自動進行、入場モーション、Zen 編集モードに対応します。
- **複数の書き出し経路**：プロジェクト ZIP、インタラクティブ Web ZIP、動画レンダリングワークスペースを提供します。
- **ローカルファースト保存**：プロジェクト、設定、AI Profiles、Autosave は基本的にローカル保存され、API Key は明示しない限り書き出しに含まれません。

## プラットフォームについて

| プラットフォーム | 現在の役割 | 説明 |
| --- | --- | --- |
| Windows | 主力の制作・正式書き出し | Tauri の保存ダイアログ、ローカル出力先、システム TTS、動画 / Web 書き出しフローが最も充実 |
| Web | 体験・軽量編集 | ブラウザのローカル保存を使い、試用、軽い編集、短いプレビューや書き出しに向いています |
| Android | モバイル確認・テスト | Tauri Android でパッケージされ、モバイルでの閲覧やシナリオ試走寄りです |

## クイックスタート

1. GalWriter AI を開き、新規プロジェクトを作成するか既存の ZIP を読み込みます。
2. ストーリー、キャラクター、シーン、条件、背景 / グループノードを配置して分岐を接続します。
3. `設定 > AI` からテキスト、画像、背景除去、音声 Profile を設定します。
4. 追加コンテキストが必要なら、Assistant に `PDF / DOCX / XLSX / PPTX / TXT / MD / CSV / JSON / XML / HTML / RTF` をアップロードします。
5. Playtest でテンポを確認し、必要に応じてプロジェクト ZIP、Web ZIP、動画を書き出します。

## AI と文書サポート

| 種別 | 現在の統合方向 |
| --- | --- |
| テキスト AI | DeepSeek、Gemini、OpenAI、Claude、Kimi、Qwen、Copilot、GLM、Ollama、互換 API、托管プロキシ |
| 画像 AI | 豆包、Gemini、OpenAI、Qwen、GLM、ローカル Stable Diffusion WebUI、カスタム API |
| 背景除去 | カスタム API、阿里云 Vision、火山 veImageX |
| 音声 AI | システム音声、有道、OpenAI、豆包、Gemini、カスタム API、托管プロキシ |

補足:

- 実際の可用性は、設定したキー、モデル名、エンドポイント互換性に依存します。
- `src/editor-services/aiClient.ts` は統一入口で、現在 `generateText()`、`analyze()`、`generateSetting()` を提供しています。
- Assistant の文書取り込みは `src/lib/documentReader.ts` で実装され、抽出した可読テキストを現在の会話コンテキストに流し込みます。

## ローカルデータとプライバシー

- Web 版では `autosave`、`localProjects`、`appSettings`、`apiSettings`、`aiProfiles` を IndexedDB に保存します。
- Windows / Android 版では、ローカルアプリデータに加えて、ユーザーが選んだ出力先やデフォルト保存先も保持します。
- API Key はデフォルトで現在の端末内にのみ保存され、プロジェクト ZIP へ自動では書き込まれません。
- アクティブな API Profile とキーが書き出しに含まれるのは、ユーザーが明示的に選んだ場合だけです。
- Assistant の会話をプロジェクト保存に含めるかどうかは `saveAssistantConversations` に従います。

## 開発

### 必要環境

- Node.js 18+
- npm
- Rust 1.77+
- Tauri 2 の実行 / ビルド依存
- Android パッケージング時は Android Studio / SDK / NDK

### よく使うコマンド

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run build
npm run preview
```

### デスクトップ開発

```bash
npm run tauri -- dev
```

### パッケージング

```bash
npm run tauri:build:lite
npm run tauri:build:portable:lite
```

Android のパッケージングは [ANDROID_BUILD_GUIDE.md](ANDROID_BUILD_GUIDE.md) を参照してください。

## アーキテクチャ概要

- `src/domain/`：`StoryProject`、`ProjectSettings`、ノードデータ、Presentation 型などの明示的なドメインモデル。
- `src/editor-shell/`：Header、Toolbar、Modal、AssistantPanel などトップレベル UI の組み立て。
- `src/editor-state/`：`usePlaytestSettings`、`useSharedRenderStyle` など共有状態と設定 Hook。
- `src/editor-features/`：AI、Assistant、Canvas、Project I/O、Selection、Media、Node Actions を責務別に分離した機能層。
- `src/editor-services/`：`aiClient`、`projectSerializer`、`autosaveService`、`localPersistenceService`、`ttsService` などのサービス層。
- `src/components/`：ノードコンポーネント、`StoryEditor`、Playtest UI、Settings UI、Render UI。
- `src/lib/`：IndexedDB、文書解析、export 補助、presentation 補助、plot ユーティリティ、ランタイム適配。
- `src-tauri/`：ファイル保存、レンダー作業ディレクトリ、システム TTS、プロキシ呼び出し、ウィンドウ挙動などのネイティブコマンド層。

## プロジェクト構成

```text
.
├── build-scripts/              # パッケージング補助スクリプト
├── docs/                       # プロジェクト文書
├── examples/                   # サンプル素材
├── public/                     # Web 静的アセット
├── release/                    # ローカルビルド出力
├── scripts/                    # 補助スクリプト
├── src/
│   ├── agent/                  # Assistant / Agent のランタイムと計画ロジック
│   ├── animation/              # アニメーション資産
│   ├── components/             # StoryEditor、各ノード、Playtest、Render UI
│   ├── domain/                 # ドメインモデルと強い型定義
│   ├── editor-features/        # Canvas、AI、Media、Project I/O、Selection、Node Actions
│   ├── editor-services/        # AI、シリアライズ、Autosave、ローカル永続化、TTS
│   ├── editor-shell/           # トップレベルシェルと Modal 構成
│   ├── editor-state/           # 共有状態とデフォルト設定
│   └── lib/                    # DB、文書解析、export、ランタイム適配
├── src-tauri/                  # Tauri ネイティブプロジェクト
├── ANDROID_BUILD_GUIDE.md      # Android ビルドガイド
├── eslint.config.js
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## FAQ

### プロジェクトはどこに保存されますか？

Web 版では主に IndexedDB、Windows / Android 版ではローカルアプリデータに保存されます。プロジェクト ZIP、Web ZIP、動画ファイルはユーザーが選んだ場所へ出力されます。

### API Key はプロジェクトと一緒に書き出されますか？

デフォルトでは書き出されません。アクティブな API Profile とキーを含めるのは、ユーザーが明示的に選んだ場合だけです。

### Assistant は現在どんなファイルを読めますか？

現在のコードでは `PDF`、`DOCX`、`XLSX`、`PPTX`、`TXT`、`MD`、`CSV`、`TSV`、`JSON`、`XML`、`HTML`、`RTF` など、可読テキストを抽出できる文書を扱えます。

### Web や Android でも正式な書き出しはできますか？

Web 版は軽量なプレビューや短い書き出しに向いています。長いレンダリングや正式納品には Windows 版のほうが適しています。Android 版は現在、完全なデスクトップ級書き出しよりもモバイル確認とテスト寄りです。

## License

Created by Mingwen Cui, Tommy Ren.

現在のリポジトリには正式な License ファイルがありません。公開再配布や商用利用の前に、ライセンスを追加してください。

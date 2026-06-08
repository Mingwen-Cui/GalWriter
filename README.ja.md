<div align="center">

# GalWriter AI

### ビジュアルノベル、ギャルゲー、分岐型インタラクティブストーリー向けの AI シナリオ制作ワークスペース

[![Version](https://img.shields.io/github/v/release/Mingwen-Cui/GalWriter?color=blue&label=version)](https://github.com/Mingwen-Cui/GalWriter/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Web-lightgrey.svg)](https://github.com/Mingwen-Cui/GalWriter/releases)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-orange.svg)](https://tauri.app/)
[![React](https://img.shields.io/badge/frontend-React%20%2B%20TypeScript-61dafb.svg)](https://react.dev/)

<img src="./public/icon.png" alt="GalWriter AI" width="96" />

[中文](README.md) | [English](README.en.md) | 日本語

[デスクトップ版をダウンロード](https://github.com/Mingwen-Cui/GalWriter/releases) · [開発](#開発) · [FAQ](#faq)

</div>

## なぜ GalWriter AI なのか

ビジュアルノベルや分岐型ストーリーの制作は、単なる文章作成ではありません。プロット構造、キャラクター設定、シーン資料、画像、音声、テスト、エクスポートなど、多くの要素が同時に関わります。通常のドキュメントでは分岐構造を把握しにくく、汎用ホワイトボードには AI 執筆支援やプロジェクト管理が不足しがちです。

**GalWriter AI** は、これらの作業を 1 つのビジュアルエディタにまとめます。キャンバス上でシナリオノードを整理し、分岐を接続し、キャラクターやシーンを管理し、自分の AI Provider を使って文章や素材を生成できます。プロジェクトはローカルに保存され、次回そのまま編集を続けられます。

## 主な機能

- **ビジュアルシナリオキャンバス**：ノード、接続、分岐、キャラクター、シーン、条件、背景領域を使って物語を構成できます。
- **ローカルプロジェクト保存**：最近使ったプロジェクト、保存済み進行状況、編集状態をローカルに保持します。
- **AI 接続設定センター**：Text / Image / Voice AI の複数設定を作成し、Provider、Model、API Key、API URL を管理できます。
- **API Key はエクスポートに含まれません**：秘密情報は現在の端末にのみ保存され、プロジェクト ZIP には入りません。
- **AI 執筆アシスタント**：続き生成、推敲、挿入、情景描写、会話補完、シナリオ分析、参考資料付きチャットに対応します。
- **メディア制作フロー**：画像生成、音声生成、素材インポート、プレビュー、動画書き出しを扱えます。
- **Web デモとデスクトップアプリ**：Web 版は試用に便利で、デスクトップ版は完全なローカル書き出し機能を提供します。

## スクリーンショット

現在、このリポジトリには完全なスクリーンショット素材は含まれていません。今後は `assets/screenshots/` に追加することを推奨します。

| エディタキャンバス |   AI 設定   | 動画書き出し |
| :----------------: | :---------: | :----------: |
|    Coming soon     | Coming soon | Coming soon  |

## ダウンロードとインストール

### デスクトップ版

最新版は [Releases](https://github.com/Mingwen-Cui/GalWriter/releases) からダウンロードできます。

本格的な制作、ローカルプロジェクト管理、ファイル操作、動画書き出しにはデスクトップ版を推奨します。

| インストーラー | 推奨ユーザー | 動画書き出し |
| -------------- | ------------ | ------------ |
| `GalWriter-Setup.exe` | ほとんどのユーザーに推奨。容量は大きめですが、そのまま使えます。 | 軽量 FFmpeg を同梱し、WebM、MP4、MOV、MKV を直接書き出せます。 |
| `GalWriter-Setup-Lite.exe` | ダウンロードサイズを重視し、すでに FFmpeg をインストールしているユーザー向け。 | FFmpeg は同梱されません。WebM は利用でき、MP4 / MOV / MKV にはシステム FFmpeg が必要です。 |
| `GalWriter-AI-v1.2.5-windows-x64.exe` | インストールせず、ダブルクリックで起動したいユーザー向け。 | 単体 exe のポータブル Lite 版です。WebM 以外の書き出しにはシステム FFmpeg が必要です。 |
| `GalWriter-AI-v1.2.5-windows-x64-portable-full.zip` | インストールせず、内蔵 FFmpeg も必要なユーザー向け。 | zip を解凍し、`ffmpeg.exe` をアプリ exe と同じフォルダに置いたまま使用します。 |

Release ビルドでは Full 版にのみ `ffmpeg.exe` を同梱します。`ffprobe.exe`、ドキュメント、presets などの不要な FFmpeg 関連ファイルは含めません。

### Web 版

Web 版はデモや簡単な試用向けです。ブラウザの制限により、Web で直接書き出せる動画形式は **WebM** のみです。**MP4 / MOV / MKV** などの一般的な形式が必要な場合はデスクトップ版を利用してください。FFmpeg を同梱した Full 版を推奨します。

## クイックスタート

1. GalWriter AI を開きます。
2. 新規プロジェクトを作成するか、既存プロジェクトを読み込みます。
3. キャンバスにシナリオ、キャラクター、シーン、背景、条件ノードを追加します。
4. ノードを接続してルートや分岐を作ります。
5. AI 機能を使う場合は、**設定 > AI API 設定** で Text / Image / Voice AI の設定を作成します。
6. プロジェクトを保存します。次回は最近使ったプロジェクトから再開できます。
7. バックアップや受け渡しにはプロジェクト ZIP を書き出し、動画が必要な場合は動画書き出しワークスペースを使います。

## AI Provider とローカルデータ

GalWriter AI は特定の AI サービスに固定されていません。制作フローに合わせて Text、Image、Voice モデルを接続できます。

| 種類     | 用途                                           | Provider 例                                                         |
| -------- | ---------------------------------------------- | ------------------------------------------------------------------- |
| Text AI  | 続き生成、推敲、アシスタント会話、シナリオ分析 | DeepSeek、Claude、Gemini、Kimi、Qwen、GLM、OpenAI、互換 API         |
| Image AI | キャラクター、シーン、背景画像生成             | 豆包、Gemini、OpenAI、ローカル Stable Diffusion WebUI、カスタム API |
| Voice AI | ナレーション、吹き替え、音声合成               | システム音声、有道、OpenAI、豆包、カスタム API                      |

データ方針:

- プロジェクト内容はローカルプロジェクトライブラリに保存されます。
- AI 設定は現在の端末にのみ保存されます。
- API Key はプロジェクトエクスポートに含まれません。
- AI 会話は現在のプロジェクト内にのみ保存されます。

## 動画書き出し方針

| 環境                       | 直接書き出し形式    | 説明                                                                                         |
| -------------------------- | ------------------- | -------------------------------------------------------------------------------------------- |
| Web デモ                   | WebM                | ブラウザネイティブ録画を使う、安定した Web 向けワークフローです。                            |
| デスクトップアプリ Full    | WebM、MP4、MOV、MKV | 軽量 FFmpeg を同梱します。ほとんどのユーザーに推奨します。                                   |
| デスクトップアプリ Lite    | WebM、MP4、MOV、MKV | FFmpeg は同梱されません。WebM は利用でき、MP4 / MOV / MKV にはシステム FFmpeg が必要です。 |

Web 版で MP4、MOV、MKV を選択した場合、アプリ内の案内ウィンドウを表示し、デスクトップ版のリリースページへ誘導します。Lite 版またはローカル実行環境で FFmpeg が見つからない場合も、Full 版のダウンロードまたは WebM への切り替えをアプリ内ウィンドウで案内します。

## 開発

### 必要環境

- Node.js 18+
- npm
- Rust 1.77+
- Tauri 2 のシステム依存関係

### 依存関係のインストール

```bash
npm install
```

### Web 開発サーバーを起動

```bash
npm run dev
```

デフォルトの URL は `http://localhost:3000` です。

### デスクトップアプリを開発モードで起動

```bash
npm run tauri dev
```

### 型チェックとビルド

```bash
npm run typecheck
npm run build
```

### デスクトップアプリをパッケージ

```bash
npm run tauri:check:ffmpeg
npm run tauri:build:full
npm run tauri:build:lite
npm run tauri:build:portable
npm run tauri:build:portable:full
```

Full ビルドは `src-tauri/binaries/ffmpeg.exe` の存在を確認し、インストーラーを `release/GalWriter-Setup.exe` にコピーします。Lite ビルドは FFmpeg を含めず、`release/GalWriter-Setup-Lite.exe` を出力します。ポータブル Lite ビルドは `release/GalWriter-AI-v1.2.5-windows-x64.exe`、ポータブル Full ビルドは `ffmpeg.exe` を含む zip を出力します。

## 技術スタック

- **Frontend**：React、TypeScript、Vite、Tailwind CSS、React Flow
- **Desktop**：Tauri 2、Rust
- **Local storage**：IndexedDB / ネイティブアプリデータ
- **Export**：ZIP、Web 書き出し、動画書き出し
- **Video**：ブラウザ MediaRecorder、デスクトップ版 FFmpeg 検出、Full/Lite パッケージング

## プロジェクト構成

```text
├── src/                         # React + TypeScript フロントエンド
│   ├── components/              # エディタ、ノード、設定、レンダー UI
│   ├── editor-features/         # エディタ機能モジュール
│   ├── editor-services/         # 永続化、シリアライズ、メディアサービス
│   ├── editor-shell/            # トップレベルのモーダルとエディタシェル
│   └── lib/                     # ユーティリティ、ローカル DB、ランタイムアダプタ
├── src-tauri/                   # Tauri + Rust デスクトップ層
│   ├── binaries/                # デスクトップ書き出し用の内蔵 FFmpeg
│   └── src/                     # Tauri commands とローカルファイル処理
├── build-scripts/               # FFmpeg チェックと Full/Lite インストーラー補助
├── public/                      # 公開静的アセット
└── dist/                        # Web ビルド出力
```

## FAQ

<details>
<summary><strong>プロジェクトはどこに保存されますか？</strong></summary>

Web 版ではブラウザのローカルストレージに保存されます。デスクトップ版ではアプリのローカルデータに保存されます。プロジェクト ZIP はバックアップや移行に利用できます。

</details>

<details>
<summary><strong>API Key はプロジェクトエクスポートに含まれますか？</strong></summary>

いいえ。AI 設定は現在の端末にのみ保存され、API Key はプロジェクトエクスポートに含まれません。

</details>

<details>
<summary><strong>なぜ Web 版は MP4 や MOV を直接書き出せないのですか？</strong></summary>

ブラウザネイティブ録画では、MP4/MOV の対応がプラットフォームごとに安定していません。GalWriter AI の Web 版は WebM のみを保証します。デスクトップ版 Full は内蔵 FFmpeg により MP4、MOV、MKV、WebM を書き出せます。Lite 版でこれらの一般的な形式を書き出すには、システム FFmpeg が必要です。

</details>

<details>
<summary><strong>FFmpeg を自分でインストールする必要がありますか？</strong></summary>

`GalWriter-Setup.exe` Full 版をダウンロードした場合は不要です。そのまま動画を書き出せます。`GalWriter-Setup-Lite.exe` を使う場合、MP4 / MOV / MKV の書き出しにはコンピューターに FFmpeg がインストールされている必要があります。見つからない場合、アプリは Full 版のダウンロードまたは WebM 書き出しを案内します。

</details>

<details>
<summary><strong>複数の AI Provider を設定できますか？</strong></summary>

できます。Text、Image、Voice AI それぞれで複数の設定を保存でき、設定パネルから有効な設定を切り替えられます。

</details>

## コントリビューション

Issue と Pull Request を歓迎します。大きな機能を追加する場合は、先に Issue で方向性とスコープを相談してください。

変更を送る前に、少なくとも次を実行してください。

```bash
npm run typecheck
npm run build
```

Tauri / Rust に関わる変更の場合:

```bash
cd src-tauri
cargo check
```

## License

Created by Mingwen Cui, Tommy Ren.

公開配布または商用利用の前に、リポジトリにライセンスファイルを追加してください。

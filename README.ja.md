<div align="center">

# GalWriter AI

### ビジュアルノベル、ギャルゲー、分岐型インタラクティブストーリー向けの AI シナリオ制作ワークスペース

[![Version](https://img.shields.io/github/v/release/Mingwen-Cui/GalWriter?color=blue&label=version)](https://github.com/Mingwen-Cui/GalWriter/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Web%20%7C%20Android-lightgrey.svg)](https://github.com/Mingwen-Cui/GalWriter/releases)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-orange.svg)](https://tauri.app/)
[![React](https://img.shields.io/badge/frontend-React%20%2B%20TypeScript-61dafb.svg)](https://react.dev/)

<img src="./public/icon.png" alt="GalWriter AI" width="96" />

[中文](README.md) | [English](README.en.md) | 日本語

[公式サイト](https://mingwencui.com/AIwriter/?lang=jp) · [アプリをダウンロード](https://github.com/Mingwen-Cui/GalWriter/releases) · [開発](#開発) · [FAQ](#faq)

</div>

## なぜ GalWriter AI なのか

ビジュアルノベルや分岐型ストーリーの制作は、単なる文章作成ではありません。プロット構造、キャラクター設定、シーン資料、画像、音声、テスト、エクスポートなど、多くの要素が同時に関わります。通常のドキュメントでは分岐構造を把握しにくく、汎用ホワイトボードには AI 執筆支援やプロジェクト管理が不足しがちです。

**GalWriter AI** は、これらの作業を 1 つのビジュアルエディタにまとめます。キャンバス上でシナリオノードを整理し、分岐を接続し、キャラクターやシーンを管理し、自分の AI Provider を使って文章や素材を生成できます。プロジェクトはローカルに保存され、次回そのまま編集を続けられます。

## 主な機能

- **ビジュアルシナリオキャンバス**：ノード、接続、分岐、キャラクター、シーン、条件、背景領域を使って物語を構成できます。
- **ローカルプロジェクト保存**：最近使ったプロジェクト、保存済み進行状況、編集状態をローカルに保持します。
- **AI 接続設定センター**：Text / Image / Voice AI の複数設定を作成し、Provider、Model、API Key、API URL を管理できます。
- **API Key はデフォルトではエクスポートされません**：秘密情報は通常、現在の端末にのみ保存されます。ユーザーが書き出し時に明示的に含める設定を選んだ場合のみ、エクスポートファイルに保存されます。
- **AI 執筆アシスタント**：続き生成、推敲、挿入、情景描写、会話補完、シナリオ分析、参考資料付きチャットに対応します。
- **メディア制作フロー**：画像生成、音声生成、素材インポート、プレビューに対応します。動画書き出しと Web 書き出しは Windows / Web 版の機能に依存します。
- **複数プラットフォーム対応**：Windows 版、Web 版、Android 版を提供します。Windows と Android は Tauri でパッケージングされています。

## ダウンロードとインストール

### バージョン概要

GalWriter AI は Windows 版、Web 版、Android 版を提供します。Windows と Android は Tauri でパッケージングされ、ネイティブアプリ体験が必要なユーザーに向いています。Web 版はすぐに試す場合やオンラインデモに適しています。

| バージョン | 入手方法 | 向いている用途 |
| --- | --- | --- |
| Windows 版 | [Releases](https://github.com/Mingwen-Cui/GalWriter/releases) からインストーラーまたはポータブル版をダウンロード | 長期制作、正式プロジェクト、ローカルファイル管理 |
| Web 版 | 公式 Web 版を利用 | クイック試用、オンラインデモ、軽量編集 |
| Android 版 | リリースページから APK を入手、または Android パッケージング手順で自分でビルド | モバイルでのシナリオテストとプレビュー |

<details>
<summary><strong>Windows 版のインストール手順</strong></summary>

1. [Releases](https://github.com/Mingwen-Cui/GalWriter/releases) を開きます。
2. `GalWriter-Setup-Lite.exe` インストーラー、またはポータブル版の `GalWriter-AI-v1.2.5-windows-x64.exe` をダウンロードします。
3. インストーラーを使う場合は、実行して案内に従います。ポータブル版の場合は exe をダブルクリックして起動します。
4. 新規プロジェクトを作成するか、既存プロジェクト ZIP をインポートします。

</details>

<details>
<summary><strong>Android 版のインストール手順</strong></summary>

1. リリースページから Android APK をダウンロードするか、[ANDROID_BUILD_GUIDE.md](ANDROID_BUILD_GUIDE.md) に従って自分でビルドします。
2. APK を手動インストールする場合は、Android 設定で現在の入手元からのアプリインストールを許可します。
3. APK を開いてインストールを完了します。
4. GalWriter AI を起動し、モバイルでのシナリオテストとプレビューに利用します。

</details>

現在の動画書き出しはアプリ内の書き出しフローを基準としており、旧来の外部トランスコード部品をユーザーが別途用意する必要はありません。

### バージョンごとの違い

| 項目 | Windows 版 | Web 版 | Android 版 |
| --- | --- | --- | --- |
| 主な用途 | 本格制作、長期プロジェクト、ローカル納品 | クイック試用、オンラインデモ、軽量編集 | モバイルでのシナリオテストとプレビュー |
| パッケージング | Tauri Windows アプリ | Web フロントエンドビルド | Tauri Android アプリ |
| データ保存先 | ネイティブアプリデータとユーザーが選んだ書き出しファイル | ブラウザのローカルストレージ | Android アプリデータとユーザーが選んだ書き出しファイル |
| ファイル機能 | ローカルファイル操作、プロジェクト入出力、素材管理をより広く扱える | ブラウザ権限に制限され、ファイルはユーザー選択が必要 | Android のファイル権限に影響され、シナリオテストに必要な範囲が中心 |
| AI 設定 | 現在の端末に保存 | 現在のブラウザ環境に保存 | 現在の Android 端末に保存 |
| 動画 / Web 書き出し | 正式な書き出し、長い内容、ローカル保存に向く | プレビューや軽量な書き出しに向く | Android 版では動画書き出しと Web 書き出しを体験できません |

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
- API Key はデフォルトではプロジェクトエクスポートに含まれません。書き出し時にユーザーが明示的に含める設定を選んだ場合のみ、エクスポートファイルに保存されます。
- AI 会話は現在のプロジェクト内にのみ保存されます。

## 動画書き出し方針

GalWriter AI の動画書き出しは、「プロジェクト内プレビューの安定性」と「納品できる最終ファイル」を両立する方針で設計しています。

- Web 版と Windows 版は同じフロントエンド描画ロジックを共有し、プレビューと書き出し結果ができるだけ一致するようにします。
- Web 版は短い内容のプレビューと軽量な書き出しに向いています。出力能力はブラウザのエンコード対応、メモリ、タブのライフサイクルに影響されます。
- Windows 版はネイティブアプリ環境で保存でき、長い内容と正式な納品に向いています。
- Android 版はモバイルでのシナリオテスト用で、動画書き出しと Web 書き出しの機能体験は提供しません。
- 現在の書き出しフローでは、旧来の外部トランスコード部品をユーザーがインストールしたり同梱したりする必要はありません。書き出し能力はアプリ内のエンコードと保存フローを基準にします。
- プロジェクト ZIP 書き出しと動画書き出しは別のワークフローです。ZIP はバックアップや移行用、レンダリング済み動画はプレビュー、公開、納品用です。

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

### Windows / Android アプリをパッケージ

<details>
<summary><strong>Windows 版パッケージング</strong></summary>

```bash
npm run tauri:build:lite
npm run tauri:build:portable:lite
```

インストーラービルドは `release/GalWriter-Setup-Lite.exe` を出力します。ポータブルビルドは `release/GalWriter-AI-v1.2.5-windows-x64.exe` を出力します。

</details>

<details>
<summary><strong>Android 版パッケージング</strong></summary>

Android パッケージングには Android Studio、Android SDK、NDK、Rust、Tauri Android 環境が必要です。詳しい手順は [ANDROID_BUILD_GUIDE.md](ANDROID_BUILD_GUIDE.md) を参照してください。

```bash
npm run tauri android init
npm run tauri android build -- --debug
npm run tauri android build
```

Debug APK はローカルテスト向けです。Release ビルドは配布、または署名後のストア提出向けです。

</details>

## 技術スタック

- **Frontend**：React、TypeScript、Vite、Tailwind CSS、React Flow
- **Native apps**：Tauri 2、Rust、Windows、Android
- **Local storage**：IndexedDB / ネイティブアプリデータ
- **Export**：ZIP、Web 書き出し、動画書き出し
- **Video**：ブラウザ録画機能、Mediabunny エンコード、ネイティブアプリ保存フロー

## プロジェクト構成

```text
├── src/                         # メインアプリのフロントエンドソース
│   ├── components/              # エディタ、ノード、レンダー、動画ワークスペース UI
│   ├── editor-shell/            # アプリシェル、トップレベルモーダル、メイン編集ワークスペース
│   ├── editor-features/         # キャンバス、ノード、一括操作などの編集機能モジュール
│   ├── editor-services/         # プロジェクトシリアライズ、ローカル永続化、AI とメディアサービス
│   ├── editor-state/            # 共有状態、デフォルト設定、コンポーネント横断設定
│   ├── domain/                  # プロジェクトデータ構造、ノード型、ドメイン型定義
│   ├── lib/                     # ユーティリティ、ローカル DB、ファイル読み込み、ランタイムアダプタ
│   ├── agent/                   # アプリ内アシスタント関連ロジック
│   ├── animation/               # アニメーションとモーション層
│   ├── mobile/                  # モバイル適配エントリ
│   └── pages/                   # ページ単位の入口とルーティング関連コンポーネント
├── src-tauri/                   # Windows と Android 向けの Tauri ネイティブアプリ工程
│   ├── src/                     # Rust コマンド、ウィンドウ機能、モバイル入口、ローカルファイル操作
│   ├── capabilities/            # Tauri 権限 capability 設定
│   ├── icons/                   # デスクトップアプリのアイコン素材
│   ├── gen/                     # Tauri 生成ディレクトリ。Android 工程を含みます
│   └── tauri.lite.conf.json     # 現在の Windows ビルド設定
├── build-scripts/               # Release インストーラーとポータブルパッケージ整理スクリプト
├── public/                      # Web 静的リソース
├── docs/                        # プロジェクト文書とリリースノート
├── release/                     # ローカルパッケージ出力ディレクトリ
├── dist/                        # Web ビルド出力ディレクトリ
├── package.json                 # npm スクリプト、依存関係、バージョン情報
├── ANDROID_BUILD_GUIDE.md       # Android パッケージングの詳細手順
└── vite.config.ts               # Vite とビルド設定
```

## FAQ

<details>
<summary><strong>プロジェクトはどこに保存されますか？</strong></summary>

Web 版ではブラウザのローカルストレージに保存されます。Windows 版と Android 版では、現在の端末のアプリデータに保存されます。プロジェクト ZIP はバックアップや移行に利用できます。

</details>

<details>
<summary><strong>API Key はプロジェクトエクスポートに含まれますか？</strong></summary>

デフォルトでは含まれません。AI 設定と API Key は通常、現在の端末に保存されます。プロジェクトを書き出すときに、ユーザーが API Key を含める設定を明示的に選んだ場合のみ、エクスポートファイルに含まれます。

</details>

<details>
<summary><strong>複数の AI Provider を設定できますか？</strong></summary>

できます。Text、Image、Voice AI それぞれで複数の設定を保存でき、設定パネルから有効な設定を切り替えられます。

</details>

## License

Created by Mingwen Cui, Tommy Ren.

公開配布または商用利用の前に、リポジトリにライセンスファイルを追加してください。

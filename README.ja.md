<div align="center">

# GalWriter

### ひとつのひらめきから、ひとつの世界へ。

[![Version](https://img.shields.io/github/v/release/Mingwen-Cui/GalWriter?color=blue&label=version)](https://github.com/Mingwen-Cui/GalWriter/releases)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Web%20%7C%20Android-lightgrey.svg)](https://github.com/Mingwen-Cui/GalWriter/releases)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-orange.svg)](https://tauri.app/)
[![Frontend](https://img.shields.io/badge/frontend-React%2019%20%2B%20TypeScript-61dafb.svg)](https://react.dev/)

<img src="./public/icon.png" alt="GalWriter" width="96" />

[中文](README.md) | [English](README.en.md) | 日本語

[Releases からダウンロード](https://github.com/Mingwen-Cui/GalWriter/releases) · [クイックスタート](#クイックスタート) · [書き出しと配布](#書き出しと配布) · [開発](#開発) · [ビルド・リリースガイド](docs/build/BUILD_GUIDE.ja.md)

</div>

## プロジェクトについて

GalWriter は、ビジュアルノベル、分岐ストーリー、インタラクティブなプレゼンテーションのための、ローカル保存を基本とする制作ワークスペースです。ノードキャンバスでストーリー、キャラクター、シーン、数値条件を組み立て、AI による執筆・素材制作支援を利用し、Playtest で分岐を確認できます。同じプロジェクトから、インタラクティブな Web 作品、動画、PowerPoint、ゲームエンジン向けプロジェクトを書き出せます。

現在のソースコードのバージョンは **1.3.0** です。React 19、TypeScript、React Flow、Vite 6、Tauri 2 を使用し、中国語・英語・日本語の UI を提供します。以下は現在のリポジトリの実装範囲を説明しています。ダウンロードできるバージョンは、Releases に掲載された実際のファイルを確認してください。

## 主な機能

- **ストーリーキャンバス**：ストーリー、キャラクター、シーン、AI 生成、背景、グループ、数値条件、一括置換、プロット構成、メモ、要約の各ノードを用意。分岐の接続、キャラクター・シーンタグ、リッチテキスト、Zen 編集に対応します。
- **プロジェクトと素材ライブラリ**：ローカルプロジェクトのホーム、最近使ったプロジェクト、自動保存と復元、プロジェクト ZIP の読み込み・書き出しに対応。キャラクター・シーン設定はプロジェクト間で再利用でき、プリセット素材は必要に応じてダウンロードできます。音楽ライブラリでは読み込み、試聴、エリア別 BGM を扱えます。
- **AI 創作支援**：テキスト、画像、背景除去、音声ごとに複数の Profile を管理。続きの執筆、リライト、ストーリー挿入、構成分析、キャラクター・シーン生成、カスタムプロンプトに対応します。
- **Assistant / Agent**：ストリーミング対話、キャンバス上のカードと文書を使ったコンテキスト、記憶メモ、タスク別の対話、計画、修正を支援します。Agent はカードの生成、入力、接続、配置を実行します。創作プレイでは、キャラクター、ジャンル、プレイヤーの選択肢や自由入力に応じてストーリーを続け、章の要約と分岐を残せます。
- **メディアと演出**：キャラクターの立ち絵と各種素材、シーン画像、パノラマプレビュー、画像の背景除去、音声合成、録音、環境音、エリア別音楽、キャラクターの登場演出、テキスト内のアクションを扱えます。
- **Playtest**：クラシック／没入型レイアウト、タイプライター表示、自動進行、選択肢・数値条件による分岐に対応。ストーリーの経路、キャラクターやシーンの切り替え、音と映像のテンポを確認できます。
- **書き出しワークスペース**：Web、動画、PPT、コードの 4 モードに、プレビュー、外観編集、個別の書き出し設定を用意。共通の外観を継承するか、モードごとの外観を保存できます。

## クイックスタート

1. [Releases](https://github.com/Mingwen-Cui/GalWriter/releases) からアプリを入手するか、後述の手順でローカルの Web 開発版を起動します。
2. プロジェクトを新規作成するか、プロジェクト ZIP を読み込みます。キャンバスにストーリーカードを置き、線でつないで選択肢と分岐を組み立てます。
3. キャラクター、シーン、数値条件を追加します。設定ライブラリからプリセットや保存済みの素材を選ぶこともできます。
4. AI 機能を使う場合は、`設定 > AI` で対応する Profile を作成して有効にし、プロバイダー、API URL、モデル、認証情報を入力します。手動編集、プロジェクト管理、基本的なプレビューには AI Key は不要です。
5. Assistant でストーリーについて相談し、カードを参照したり文書を追加したりします。創作プレイを開始して、選択に応じた続きを生成することもできます。
6. Playtest でストーリーを確認し、画面上部の書き出しメニューから Web、動画、PPT、コードのワークスペースへ進みます。バックアップや編集の再開に備えて、プロジェクト ZIP も別途保存してください。

## 書き出しと配布

| 出力                     | 現在の対応範囲                                                                                                               | 利用方法                                                                                                                                                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| プロジェクト ZIP         | ストーリーグラフ、設定、同梱可能なメディア。複数プロジェクトの一括読み込み・書き出しに対応し、設定ライブラリも任意で同梱可能 | バックアップ、移行、編集の再開に使用。API Profiles はデフォルトでは含まれません                                                                                                                                                                   |
| インタラクティブ Web ZIP | 分岐ストーリー、任意のスタートメニュー、設定・セーブ画面、カバー、UI デザイン                                                | 解凍後、HTTP(S) の静的ファイル配信サービスで公開します。作品の書き出しと、アプリ自体の Web ビルドパッケージは用途が異なります                                                                                                                     |
| 動画                     | MP4 / MOV / MKV、タイムライン編集、音声トラック、PNG カバー、分岐動画セグメントの ZIP                                        | ブラウザー／WebView でエンコードするため、結果と速度は端末、メモリ、コーデック対応に依存します。分岐動画セグメントの ZIP には、分割された MP4、分岐構成の PNG、任意のカバーが入り、インタラクティブ再生には別のプラットフォームとの連携が必要です |
| PowerPoint               | `.pptx`。ストーリーからの自動ページ生成、手動スライド、16:9 / 4:3、分岐ジャンプ、画像・動画                                  | 複雑な装飾は画像に合成されます。動画を使った塗りつぶしには先頭フレームを使用し、ストーリー／シーンの背景動画は埋め込み可能です。実際の表示は使用するプレイヤーで確認してください                                                                  |
| ゲームコード／データ     | Ren'Py、TyranoScript、Godot、IR JSON。コードプレビュー、変数・キャラクターのマッピング、診断、UI デザイン                    | 対応範囲は出力先ごとに異なります。生成内容は対象エンジンで確認してください。IR JSON は中間データであり、そのまま実行できるゲームではありません                                                                                                    |

Ren'Py、TyranoScript、IR JSON の書き出しは、現在 UI 上で開発中と表示されます。Godot 向けには、プラグインを必要としない Godot 4.5+ のネイティブプロジェクトを生成します。`dialogic` は旧保存データとの互換性のための識別子として残っていますが、Dialogic プラグインは不要です。TyranoScript の出力は、組み込み先のプロジェクトで使用します。コード書き出しには素材のマッピングと診断レポートが含まれ、書き出しを妨げるエラーを修正してから ZIP を生成できます。ゲーム UI デザイナーは主にキャンバス、ダイアログボックス、テキスト、選択肢を対象とします。複雑な装飾は PNG に変換されるため、各エンジンで Web の表現を完全に再現できるとは限りません。

書き出しモジュールと外観データの開発者向け説明は [EXPORT_INSPECTORS.md](docs/EXPORT_INSPECTORS.md) を参照してください。

## AI と文書の対応範囲

下表は、コードに実装されているプロバイダーの選択肢と接続方法です。実際に利用できるかどうかは、認証情報、モデル、API の互換性、実行プラットフォームによって異なります。

| 種類     | 設定できるサービス                                                                                               |
| -------- | ---------------------------------------------------------------------------------------------------------------- |
| テキスト | DeepSeek、Gemini、OpenAI、Claude、Kimi、Qwen、Copilot、GLM、Ollama、カスタム API                                 |
| 画像     | Doubao（豆包）、Gemini、OpenAI、Qwen、GLM、ローカル Stable Diffusion WebUI、カスタム API                         |
| 背景除去 | Windows ローカルの rembg、カスタム API／ホスト型プロキシ、Alibaba Cloud Visual Intelligence、Volcengine veImageX |
| 音声     | システム音声、Youdao、OpenAI、Doubao、Gemini、カスタム API                                                       |

Web デプロイでは、テキスト、画像、音声のホスト型プロキシも接続できます。これらには別途デプロイしたサーバーが必要です。リポジトリにはそのまま利用できる `api/proxy.php` は含まれておらず、静的ビルドだけではこれらのサービスを提供できません。ブラウザーから API に直接接続する場合は CORS の制約を受け、一部のクラウド背景除去 API の署名付きリクエストにはネイティブ連携が必要です。

Assistant は、`PDF`、`DOCX`、`XLSX`、`PPTX`、`TXT`、`MD`、`CSV`、`TSV`、`JSON`、`XML`、`HTML`、`RTF` などからテキストを抽出できます。現在は文書 1 件につき約 24,000 文字まで保持し、PDF は先頭 80 ページまで読み込みます。プレーンテキスト系ファイルの上限は 2 MiB です。スキャン PDF 用の OCR は内蔵していません。文書は対話のコンテキストとして使用し、元のレイアウトは完全には保持されません。

## プラットフォームとリソース構成

| プラットフォーム | 主な用途                                       | 実行環境の違い                                                                                                                                                             |
| ---------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows          | 全機能での編集、メディア制作、書き出し         | システムのファイルダイアログ、出力先フォルダー、システム TTS、一部 API のネイティブプロキシ、任意で導入するローカル rembg を提供。一部のメディア変換には FFmpeg が必要です |
| Web              | ブラウザーでの利用、編集、プレビュー、書き出し | データは現在のサイトのブラウザーストレージに保存されます。API は CORS／サーバープロキシの設定に、メディアの書き出しはブラウザーの機能に依存します                          |
| Android          | モバイルでの閲覧、編集、プレイテスト           | Tauri Android プロジェクトを使用します。ファイル保存とメディア機能はモバイル WebView とシステムの制約を受け、Windows 専用コマンドの機能は含まれません                      |

アプリには、機能コードを共有する 2 種類のリソース構成があります。

- **Full（完全版）**：デフォルトのビルドです。`public/` 内のプリセット、カバー、Web テンプレート、アシスタント用リソースを含みます。
- **Lite（軽量版）**：容量の大きい `assistant/`、`presets/`、`cover-templates/`、`web-homepage/` の 4 種類のリソースを省き、実行時にオンラインの配信先から読み込みます。プリセットは必要に応じてダウンロードしてキャッシュできますが、初回取得にはネットワーク接続が必要です。

Lite のプリセット、カバー、Web リソースの配信先は、ビルド時の環境変数 `VITE_ASSET_BASE_URL` で指定できます。デフォルトではバージョン番号付きのリソースパスを使用します。アシスタント用リソースは独立したオンライン URL から取得します。詳しい処理は [appAssets.ts](src/lib/appAssets.ts) を参照してください。Full にもクラウド AI サービスや rembg の実行プログラムは含まれません。

### Windows でのローカル背景除去

ローカル rembg に API Key は不要ですが、AI 設定画面に表示されるパスとリンクに従い、`rembg-sidecar.exe` とモデルファイルを別途インストールする必要があります。デフォルトの `u2netp` で使用するパスは次のとおりです。

```text
%APPDATA%\com.galwriter.ai\rembg\rembg-sidecar.exe
%APPDATA%\com.galwriter.ai\rembg-models\u2netp.onnx
```

実行プログラムとモデルは Windows インストーラーに同梱されません。他のモデルも初回使用時にダウンロードが必要な場合があります。準備が完了すれば、画像をローカルで処理できます。実行プログラムのビルド方法は、開発者向けの [rembg-sidecar README](src-tauri/rembg-sidecar/README.md) を参照してください。

## 保存とプライバシー

- 各プラットフォームのプロジェクト、自動保存、設定ライブラリ、音楽ライブラリ、アプリ設定、AI Profiles は IndexedDB で永続化します。Tauri ではアプリの WebView のローカルストレージを使用し、一部の UI テンプレートと設定は localStorage を使用します。
- Windows などのネイティブ実行環境では、ファイル保存機能も提供します。プロジェクト ZIP、作品の Web パッケージ、動画、PPTX は、各プラットフォームの保存またはダウンロード手順で出力されます。自動保存だけでは、他の環境へ移せるプロジェクトファイルは生成されません。
- API の認証情報は、デフォルトでは現在の端末のローカル設定に保存されます。プロジェクト ZIP にキーはデフォルトでは含まれません。API Profiles を含めるオプションを明示的に選択した場合は、現在有効なユーザー設定と、その認証情報が書き出されます。組み込みのホスト型プロキシ設定は含まれません。
- Assistant の対話をプロジェクトと一緒に保存するかどうかは、`saveAssistantConversations` 設定で制御します。設定ライブラリも、プロジェクトの書き出し時に同梱するか選択できます。
- リモート AI を呼び出すと、対象のプロンプト、文書の抜粋、メディアが選択したサービスまたはプロキシに送信されます。オンラインリソースのダウンロードにもネットワーク接続が必要です。
- ブラウザーのサイトデータやアプリデータを消去すると、ローカルプロジェクトに影響します。プロジェクト ZIP で独立したバックアップを保存してください。

## 開発

### 必要な環境

- Node.js **22.x（22.13 以上）または 24+** と npm。現在のロックファイルに含まれる `pdfjs-dist` と ESLint の依存関係では、より新しいバージョンが必要です。旧 README の Node 18+ という要件は現在適用されません。
- Web フロントエンドのみを実行する場合、Rust は不要です。ネイティブアプリのビルドには Rust stable と、Tauri 2 の対象プラットフォーム用依存関係が必要です。`Cargo.toml` の Rust 下限は 1.77.2 ですが、ロックされた依存関係によっては、より新しいツールチェーンが必要になります。
- Windows ネイティブビルドには、MSVC C++ ビルドツール、Windows SDK、WebView2 が必要です。
- Android ビルドには、JDK、Android SDK / NDK、対応する Rust targets が必要です。リリース処理は JDK 21 を使用し、パッケージのリリースには署名設定も必要です。

### ローカルでの実行とチェック

```bash
npm ci
npm run dev
```

ブラウザーで `http://localhost:3000` を開きます。Tauri デスクトップ開発版には、フロントエンドも自動起動する次のコマンドを使用します。

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

`lint` は型チェック、ESLint、フォーマットチェックを順に実行します。`build` はデフォルトで Full のフロントエンドを `dist/` にビルドしますが、型チェックは別途実行されません。`preview` は既存のビルドをプレビューします。

### プラットフォーム別のビルド

| 対象              | Full                               | Lite                               |
| ----------------- | ---------------------------------- | ---------------------------------- |
| Web               | `npm run build:full`               | `npm run build:lite`               |
| Windows           | `npm run tauri:build:windows:full` | `npm run tauri:build:windows:lite` |
| Android APK + AAB | `npm run tauri:build:android:full` | `npm run tauri:build:android:lite` |

Android を初めてビルドする場合は、先に `npm run tauri:android:init` を実行できます。Web の出力先は `dist/`、Windows インストーラーは `src-tauri/target/release/bundle/`、Android の出力先は `src-tauri/gen/android/app/build/outputs/` です。

Windows のビルド環境が整ったマシンでは、各プラットフォームの成果物をまとめてビルド・収集できます。

```bash
npm run tauri:build:all-platforms
```

このコマンドは Full Web、デフォルトの Windows を順にビルドし、Android のビルドを試みた後、成果物を `release/` にまとめます。SDK / NDK がない場合や Android の初期化に失敗した場合は Android をスキップしますが、Android の実際のビルドで失敗すると処理を中止します。署名設定は別途行う必要があります。

デフォルトの成果物名は次のとおりです。Android のファイルは、対応するビルド成果物が存在する場合にのみ生成されます。

```text
GalWriter-AI-v<version>-windows-x64-setup.exe
GalWriter-AI-v<version>-windows-x64-portable.zip
GalWriter-AI-v<version>-windows-x64.msi
GalWriter-AI-v<version>-web.zip
GalWriter-AI-v<version>-android-signed.apk
GalWriter-AI-v<version>-android.aab
```

`tauri:prepare:release:full` / `tauri:prepare:release:lite` はビルド済みファイルを収集し、プラットフォーム識別子の後に `-full` / `-lite` を付けます。例：`windows-x64-lite-setup.exe`、`web-lite.zip`。これらのコマンドは再ビルドせず、リソース構成や APK 署名も検証しません。対応する構成をビルドした直後に収集してください。収集スクリプトは、Windows インストーラー、実行ファイル、`dist/` が存在することを前提とします。Android のみを収集する場合は、`tauri:prepare:android:full` / `tauri:prepare:android:lite` を使用できます。

`npm run tauri:prepare:online-assets` はプリセット、カバー、Web テンプレートを `release/GalWriter-AI-v<version>-online-assets/` にまとめ、ファイルのハッシュ一覧とアップロード手順を添えます。アシスタント用リソースは、このパッケージには含まれません。

Android の環境、署名、リリースの詳細は[ビルド・リリースガイド](docs/build/BUILD_GUIDE.ja.md)を参照してください。実際のコマンドは [package.json](package.json) と [build-scripts/](build-scripts/) を確認してください。

## アーキテクチャとプロジェクト構成

```text
.
├── build-scripts/              # Full/Lite ビルド、リリース収集、書き出し検証スクリプト
├── docs/                       # ビルドガイド、書き出し設計、リリース記録、計画
├── public/                     # アイコン、プリセット、音楽、カバー、Web テンプレート
├── src/
│   ├── App.tsx                 # React Flow とダイアログの Provider
│   ├── domain/                 # プロジェクト、ノード、設定ライブラリ、構成の型
│   ├── editor-shell/           # 上部ツールバー、Assistant、ダイアログの組み立て
│   ├── editor-state/           # エディター状態、Playtest、共通の外観
│   ├── editor-features/        # AI、Assistant、キャンバス、メディア、プロジェクト I/O、設定ライブラリ
│   ├── editor-services/        # AI 窓口、シリアライズ、自動保存、永続化、TTS
│   ├── components/
│   │   ├── story-editor/      # エディター本体とプロジェクト／Profile の調整
│   │   └── render/            # Playtest、Web、動画、PPT、コード、共通スタイル
│   ├── agent/                 # Agent の型、計画、ランタイム、アニメーション
│   └── lib/                   # DB、文書解析、メディア、リソースキャッシュ、ネイティブ連携
├── src-tauri/                  # ネイティブコマンド、Tauri 設定、任意の rembg 実行プログラムのソース
├── tests/                      # 既存の書き出し設定の回帰テスト
├── package.json
└── vite.config.ts
```

プロジェクトデータは `domain` で定義し、エディターは機能別の Hook とサービス層を通じて処理を調整します。`projectSerializer` はプロジェクトのスナップショットと ZIP へのメディア格納を、`db` はローカルの永続化を担当します。書き出しワークスペースはプレビューと外観のツールを共有し、そこから各出力形式へ変換します。`src/components/StoryEditor.tsx` は互換性維持のための転送用エントリーで、エディター本体は `src/components/story-editor/StoryEditor.tsx` にあります。

## 作者とライセンス

Created by Mingwen Cui, Tommy Ren.

現在、リポジトリにはプロジェクト全体に適用する `LICENSE` ファイルはありません。

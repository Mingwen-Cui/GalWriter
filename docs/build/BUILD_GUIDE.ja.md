# GalWriter AI ビルド・リリースガイド

[中文](BUILD_GUIDE.md) | [English](BUILD_GUIDE.en.md) | **日本語**

このガイドでは、現在このリポジトリが対応しているプラットフォーム向けに、`release/` ディレクトリへ配布用ファイルを生成する方法を説明します。

- Windows x64 インストーラー、MSI、ポータブル ZIP
- Web 静的ビルド ZIP
- Android 署名済み APK および AAB

リリーススクリプトは **64 ビット Windows** で実行することを前提としています。現在、macOS または Linux パッケージは生成しません。

## クイックビルド

後述する Windows と Android の初期設定を済ませたら、リポジトリのルートで次を実行します。

```powershell
npm ci
npm run tauri:build:all-platforms
```

`npm run tauri:build:release` は同じビルドのエイリアスです。

バージョン `1.2.7` の場合、完全なビルドが成功すると次のファイルが生成されます。

```text
release/
  GalWriter-AI-v1.2.7-windows-x64-setup.exe
  GalWriter-AI-v1.2.7-windows-x64.msi
  GalWriter-AI-v1.2.7-windows-x64-portable.zip
  GalWriter-AI-v1.2.7-web.zip
  GalWriter-AI-v1.2.7-android-signed.apk
  GalWriter-AI-v1.2.7-android.aab
```

ファイル名のバージョンは `package.json` から取得されます。

> 全プラットフォーム用コマンドは Web と Windows を先にビルドします。Android SDK または NDK が見つからない場合は、警告を表示して Android をスキップします。完了後は必ず最終ファイル一覧を確認してください。

## 1. ビルドツールをインストールする

### すべてのビルドに必要なもの

次をインストールしてください。

- Node.js 20 以降
- MSVC ツールチェーンを使用する Rust stable
- Microsoft Visual Studio 2022 Build Tools の **Desktop development with C++**
- WebView2（現在の Windows には通常インストール済みです）

主要ツールを確認します。

```powershell
node --version
npm --version
rustc --version
cargo --version
```

プロジェクト用の Tauri CLI は `npm ci` でインストールされます。`cargo-tauri` のグローバルインストールは不要です。

### Android に追加で必要なもの

Android Studio をインストールし、同梱 JDK を使用します（JDK 21 を別途インストールしても構いません）。続いて Android Studio の SDK Manager で次をインストールします。

- Android SDK Platform
- Android SDK Build-Tools
- Android SDK Platform-Tools
- Android SDK Command-line Tools (latest)
- Android NDK

現在生成されている Android プロジェクトは Android API 36 を使用します。プラットフォーム不足のエラーが出た場合は、エラーに示された API レベルを SDK Manager からインストールしてください。

リポジトリは通常の英数字だけを含む短いパスに配置することを推奨します。

```text
C:\Projects\GalWriter
```

これにより、Gradle や NDK でよく起きるパスの問題を避けられます。

## 2. 依存関係とソースを確認する

リポジトリのルートで実行します。

```powershell
npm ci
npm run typecheck
npm run build
```

`npm ci` は `package-lock.json` に記録されたバージョンをそのままインストールします。依存関係を意図的に変更するときだけ `npm install` を使用してください。

## 3. リリースバージョンを設定する

新しいバージョンを公開する前に、次の 2 ファイルを同じバージョンへ更新します。

- `package.json`
- `src-tauri/tauri.conf.json`

例：

```json
"version": "1.2.8"
```

2 つの値は一致させてください。アセット準備スクリプトは `package.json` の値でファイル名を作り、Tauri は `src-tauri/tauri.conf.json` の値でアプリをパッケージします。

## 4. チェックアウトごとに Android を設定する

Web と Windows だけが必要な場合は、このセクションを省略できます。

### 4.1 Android 環境変数を設定する

PowerShell で実行します。

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:NDK_HOME = Get-ChildItem "$env:ANDROID_HOME\ndk" -Directory |
  Sort-Object Name -Descending |
  Select-Object -First 1 -ExpandProperty FullName
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"
```

検出されたパスを確認します。

```powershell
$env:ANDROID_HOME
$env:NDK_HOME
adb version
```

ユーザー環境変数として保存しない限り、これらは現在の PowerShell セッションだけで有効です。

### 4.2 Android プロジェクトを初期化する

```powershell
npm run tauri:android:init
```

次のディレクトリが作成されます。

```text
src-tauri\gen\android
```

`src-tauri/gen/` 全体は Git の対象外です。そのため、新しいクローンやクリーンな CI チェックアウトでは毎回 Android を初期化する必要があります。

### 4.3 リリース用 keystore を作成する

同じ Android アプリに対して keystore を作るのは、アプリの存続期間を通じて一度だけです。

```powershell
New-Item -ItemType Directory -Force ".android-signing" | Out-Null

keytool -genkeypair -v `
  -keystore ".android-signing\galwriter-release.keystore" `
  -alias "galwriter-release" `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000
```

keystore とパスワードは安全な場所にバックアップしてください。`com.galwriter.ai` の Android 更新には、今後も同じ署名鍵が必要です。`.android-signing/` と生成された Android プロジェクトは Git に含まれません。

既存の keystore がある場合は、新しく作らず次の場所へ復元します。

```text
.android-signing\galwriter-release.keystore
```

### 4.4 `key.properties` を作成する

`src-tauri\gen\android\key.properties` を作成します。

```powershell
@"
storeFile=../../../.android-signing/galwriter-release.keystore
storePassword=YOUR_KEYSTORE_PASSWORD
keyAlias=galwriter-release
keyPassword=YOUR_KEY_PASSWORD
"@ | Set-Content -Encoding UTF8 "src-tauri\gen\android\key.properties"
```

2 つのパスワード用プレースホルダーを置き換えてください。このファイルはコミットしないでください。

### 4.5 生成された Gradle プロジェクトに署名鍵を設定する

Android プロジェクトは生成物であり Git の対象外です。新しく `android init` を実行した後は、毎回この設定を確認してください。

次を開きます。

```text
src-tauri\gen\android\app\build.gradle.kts
```

既存の import の近くへ追加します。

```kotlin
import java.io.FileInputStream
```

`tauriProperties` の宣言後に追加します。

```kotlin
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}
```

`android { ... }` 内の `defaultConfig { ... }` より後へ追加します。

```kotlin
signingConfigs {
    if (keystorePropertiesFile.exists()) {
        create("release") {
            keyAlias = keystoreProperties["keyAlias"] as String
            keyPassword = keystoreProperties["keyPassword"] as String
            storeFile = rootProject.file(keystoreProperties["storeFile"] as String)
            storePassword = keystoreProperties["storePassword"] as String
        }
    }
}
```

既存の `getByName("release") { ... }` ブロック内へ追加します。

```kotlin
if (keystorePropertiesFile.exists()) {
    signingConfig = signingConfigs.getByName("release")
}
```

## 5. すべてのリリースファイルをビルドする

x64 Windows の PowerShell で、リポジトリのルートから実行します。

```powershell
npm run tauri:build:all-platforms
```

このコマンドは次の処理を行います。

1. Web アプリを `dist/` へビルドします。
2. Windows Tauri 実行ファイル、NSIS インストーラー、MSI をビルドします。
3. SDK と NDK が利用できる場合、Android APK と AAB をビルドします。
4. 配布用ファイルを `release/` へコピーし、名前を整えて ZIP 化します。

最終アセットを確認します。

```powershell
Get-ChildItem release -File |
  Sort-Object Name |
  Select-Object Name, Length, LastWriteTime
```

`release/` は Git の対象外で、古いバージョンのファイルが残る場合があります。公開するのは、ファイル名に現在のバージョンが含まれるものだけにしてください。

## 6. 1 つのターゲットだけをビルドする

個別のビルドコマンドは中間生成物を作ります。最終的な `release/` ファイルは `npm run tauri:prepare:release` で組み立てますが、現在このスクリプトは Windows と Web の両方のビルド済み出力を必要とします。

### Web のみ

```powershell
npm run tauri:build:web
```

出力先は `dist\` です。`release\GalWriter-AI-v<version>-web.zip` を作るには Windows ビルドも完了させ、次を実行します。

```powershell
npm run tauri:build:windows
npm run tauri:prepare:release
```

### Windows のみ

```powershell
npm run tauri:build:windows
```

主な中間生成物は次にあります。

```text
src-tauri\target\release\app.exe
src-tauri\target\release\bundle\nsis\
src-tauri\target\release\bundle\msi\
```

`dist/` が存在することを確認し、`release/` のファイルを組み立てます。

```powershell
npm run tauri:prepare:release
```

### Android のみ

Android 環境と署名の設定後に実行します。

```powershell
npm run tauri:build:android
```

APK と AAB の中間生成物は次にあります。

```text
src-tauri\gen\android\app\build\outputs\
```

検索するには次を実行します。

```powershell
Get-ChildItem "src-tauri\gen\android\app\build\outputs" -Recurse -File |
  Where-Object Extension -In ".apk", ".aab" |
  Select-Object FullName, Length, LastWriteTime
```

`npm run tauri:prepare:release` は最新の release APK と AAB を `release/` へコピーしますが、Web と Windows の中間生成物も必要です。クリーンな Android 単独ビルドでは、Android の `outputs` ディレクトリにあるファイルを直接使用してください。

## 7. 生成物を検証する

### Windows パッケージをテストする

- `-setup.exe` をインストールしてアプリを起動します。
- `.msi` を配布する場合は、それも実際にテストします。
- `-portable.zip` を空のディレクトリへ展開し、`GalWriter-AI.exe` を実行します。

Windows コード署名の手順を別途追加しない限り、このリポジトリの Windows パッケージに Authenticode 署名はありません。Android の署名は Windows ファイルには適用されません。

### Web ZIP をテストする

ZIP を展開して HTTP サーバーから開きます。`file://` をデプロイ確認に使わないでください。

```powershell
Expand-Archive "release\GalWriter-AI-v1.2.7-web.zip" "release\web-test" -Force
npx serve "release\web-test"
```

### Android APK を検証してインストールする

`apksigner` を探し、証明書を検証します。

```powershell
$apksigner = Get-ChildItem "$env:ANDROID_HOME\build-tools" -Recurse -Filter apksigner.bat |
  Sort-Object FullName -Descending |
  Select-Object -First 1 -ExpandProperty FullName

& $apksigner verify --verbose --print-certs `
  "release\GalWriter-AI-v1.2.7-android-signed.apk"
```

接続した端末へインストールします。

```powershell
adb devices
adb install -r "release\GalWriter-AI-v1.2.7-android-signed.apk"
```

`1.2.7` は現在のバージョンへ置き換えてください。`INSTALL_FAILED_UPDATE_INCOMPATIBLE` が表示された場合、端末上のアプリは別の鍵で署名されています。ローカルのアプリデータが失われても問題ない場合に限り、先にアンインストールします。

```powershell
adb uninstall com.galwriter.ai
```

## 8. GitHub Actions で公開する

`.github/workflows/release.yml` は、`app-v*` に一致するタグが push されたときに実行されます。使用前に、リポジトリへ次の Secrets を設定してください。

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_PASSWORD`
- `ANDROID_KEY_ALIAS`

PowerShell で keystore を `ANDROID_KEYSTORE_BASE64` 用にエンコードします。

```powershell
[Convert]::ToBase64String(
  [IO.File]::ReadAllBytes(".android-signing\galwriter-release.keystore")
) | Set-Clipboard
```

タグが `package.json` および `src-tauri/tauri.conf.json` のバージョンと一致することを確認してから push します。

```powershell
git tag app-v1.2.8
git push origin app-v1.2.8
```

ワークフローはファイルをビルドし、GitHub Release へ添付します。GitHub が自動生成する「Source code」アーカイブはアプリのバイナリではありません。

> Android の Gradle 署名設定は Git 対象外の生成プロジェクト内にあります。クリーンな GitHub Actions runner では、Android 初期化後にセクション 4.5 の署名設定を適用する必要があります。生成された Gradle ファイルが設定を読み込まない場合、keystore と `key.properties` を復元するだけでは不十分です。

## トラブルシューティング

### Android がスキップされた

Android 環境が見つからない場合、全プラットフォームビルドは次を表示します。

```text
Skipping Android build: ANDROID_HOME / ANDROID_SDK_ROOT is missing or invalid.
Skipping Android build: Android NDK was not found.
```

同じ PowerShell セッションで `ANDROID_HOME`、`ANDROID_SDK_ROOT`、`NDK_HOME` を設定し、再度ビルドしてください。

### `keytool` が見つからない

Android Studio 同梱の JDK を使用するか、JDK 21 をインストールして、その `bin` ディレクトリを `Path` に追加してください。

### Android release が署名されていない

次の 3 点を確認します。

1. `.android-signing\galwriter-release.keystore` が存在する。
2. `src-tauri\gen\android\key.properties` の内容が正しい。
3. `src-tauri\gen\android\app\build.gradle.kts` にセクション 4.5 の署名設定がある。

### Windows bundle ディレクトリがない

Visual Studio C++ ビルドツールをインストールし、再実行します。

```powershell
npm run tauri:build:windows
```

NSIS と MSI の bundle ディレクトリが両方存在するまで `tauri:prepare:release` を実行しないでください。

### `release/` に古いファイルが残っている

アセット準備スクリプトは現在のバージョンのファイルを置き換えますが、すべての旧バージョンを削除するわけではありません。ディレクトリを確認し、不要な古いローカル生成物を手動で削除してください。

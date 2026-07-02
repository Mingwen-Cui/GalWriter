# GalWriter AI build and release guide

[中文](BUILD_GUIDE.md) | **English** | [日本語](BUILD_GUIDE.ja.md)

This guide explains how to produce the distributable files in `release/` for the platforms currently supported by this repository:

- Windows x64 installer, MSI, and portable ZIP
- Web static-build ZIP
- Android signed APK and AAB

The release scripts are designed to run on **64-bit Windows**. They do not currently build macOS or Linux packages.

## Quick build

After completing the one-time Windows and Android setup below, run these commands from the repository root:

```powershell
npm ci
npm run tauri:build:all-platforms
```

`npm run tauri:build:release` is an alias for the same build.

For version `1.2.7`, a successful complete build creates:

```text
release/
  GalWriter-AI-v1.2.7-windows-x64-setup.exe
  GalWriter-AI-v1.2.7-windows-x64.msi
  GalWriter-AI-v1.2.7-windows-x64-portable.zip
  GalWriter-AI-v1.2.7-web.zip
  GalWriter-AI-v1.2.7-android-signed.apk
  GalWriter-AI-v1.2.7-android.aab
```

The version in the filenames comes from `package.json`.

> The all-platform command builds Web and Windows first. If the Android SDK or NDK cannot be found, it prints a warning and skips Android, so always inspect the final file list.

## 1. Install the build tools

### Required for every build

Install:

- Node.js 20 or newer
- Rust stable with the MSVC toolchain
- Microsoft Visual Studio 2022 Build Tools with **Desktop development with C++**
- WebView2 (normally already installed on current Windows systems)

Confirm the main tools are available:

```powershell
node --version
npm --version
rustc --version
cargo --version
```

The Tauri CLI is installed locally by `npm ci`; a global `cargo-tauri` installation is not required.

### Also required for Android

Install Android Studio and use its bundled JDK (or install JDK 21 separately). Then use Android Studio's SDK Manager to install:

- Android SDK Platform
- Android SDK Build-Tools
- Android SDK Platform-Tools
- Android SDK Command-line Tools (latest)
- Android NDK

The generated Android project currently uses Android API 36. If the build reports a missing platform, install the API level named in the error using Android Studio's SDK Manager.

Keep the repository in a short path containing only ordinary Latin characters, for example:

```text
C:\Projects\GalWriter
```

This avoids common Gradle and NDK path problems.

## 2. Install dependencies and check the source

From the repository root:

```powershell
npm ci
npm run typecheck
npm run build
```

`npm ci` installs the exact dependency versions recorded in `package-lock.json`. Use `npm install` only when intentionally changing dependencies.

## 3. Set the release version

Before publishing a new version, set the same version in both files:

- `package.json`
- `src-tauri/tauri.conf.json`

For example:

```json
"version": "1.2.8"
```

The two values must match. The asset preparation script names files using the version in `package.json`, while Tauri packages the application using `src-tauri/tauri.conf.json`.

## 4. Configure Android once per checkout

Skip this section if you only need Web and Windows files.

### 4.1 Set Android environment variables

In PowerShell:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:NDK_HOME = Get-ChildItem "$env:ANDROID_HOME\ndk" -Directory |
  Sort-Object Name -Descending |
  Select-Object -First 1 -ExpandProperty FullName
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"
```

Confirm the detected paths:

```powershell
$env:ANDROID_HOME
$env:NDK_HOME
adb version
```

These variables apply only to the current PowerShell session unless you save them as user environment variables.

### 4.2 Initialize the generated Android project

Run:

```powershell
npm run tauri:android:init
```

This creates:

```text
src-tauri\gen\android
```

The entire `src-tauri/gen/` directory is gitignored. Therefore, every fresh clone or clean CI checkout must initialize Android again.

### 4.3 Create the release keystore

Create a keystore only once for the lifetime of the Android application:

```powershell
New-Item -ItemType Directory -Force ".android-signing" | Out-Null

keytool -genkeypair -v `
  -keystore ".android-signing\galwriter-release.keystore" `
  -alias "galwriter-release" `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000
```

Back up the keystore and its passwords securely. Android updates for `com.galwriter.ai` must use the same signing key. Both `.android-signing/` and the generated Android project are excluded from Git.

If a keystore already exists, restore it here instead of generating a new one:

```text
.android-signing\galwriter-release.keystore
```

### 4.4 Create `key.properties`

Create `src-tauri\gen\android\key.properties`:

```powershell
@"
storeFile=../../../.android-signing/galwriter-release.keystore
storePassword=YOUR_KEYSTORE_PASSWORD
keyAlias=galwriter-release
keyPassword=YOUR_KEY_PASSWORD
"@ | Set-Content -Encoding UTF8 "src-tauri\gen\android\key.properties"
```

Replace both password placeholders. Do not commit this file.

### 4.5 Make the generated Gradle project use the key

Because the Android project is generated and gitignored, verify this setup after every fresh `android init`.

Open:

```text
src-tauri\gen\android\app\build.gradle.kts
```

Add this import beside the existing imports:

```kotlin
import java.io.FileInputStream
```

After the `tauriProperties` declaration, add:

```kotlin
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}
```

Inside `android { ... }`, after `defaultConfig { ... }`, add:

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

Inside the existing `getByName("release") { ... }` block, add:

```kotlin
if (keystorePropertiesFile.exists()) {
    signingConfig = signingConfigs.getByName("release")
}
```

## 5. Build all release files

Run from an x64 Windows PowerShell prompt in the repository root:

```powershell
npm run tauri:build:all-platforms
```

The command performs these steps:

1. Builds the Web application into `dist/`.
2. Builds the Windows Tauri executable, NSIS installer, and MSI.
3. Builds Android APK and AAB files when the SDK and NDK are available.
4. Copies, renames, and zips the distributable files into `release/`.

List the final artifacts:

```powershell
Get-ChildItem release -File |
  Sort-Object Name |
  Select-Object Name, Length, LastWriteTime
```

The `release/` directory is gitignored and may still contain files from older versions. Publish only files whose names contain the current version.

## 6. Build only one target

The individual build commands create intermediate output. The final `release/` filenames are assembled by `npm run tauri:prepare:release`, which currently expects a completed Windows build and Web build.

### Web only

```powershell
npm run tauri:build:web
```

Output:

```text
dist\
```

To create `release\GalWriter-AI-v<version>-web.zip`, also complete a Windows build and then run the preparation command:

```powershell
npm run tauri:build:windows
npm run tauri:prepare:release
```

### Windows only

```powershell
npm run tauri:build:windows
```

Important intermediate outputs are under:

```text
src-tauri\target\release\app.exe
src-tauri\target\release\bundle\nsis\
src-tauri\target\release\bundle\msi\
```

To assemble the named Windows files in `release/`, ensure `dist/` exists and run:

```powershell
npm run tauri:prepare:release
```

### Android only

After completing the Android setup and signing steps:

```powershell
npm run tauri:build:android
```

Intermediate APK and AAB files are written below:

```text
src-tauri\gen\android\app\build\outputs\
```

Find them with:

```powershell
Get-ChildItem "src-tauri\gen\android\app\build\outputs" -Recurse -File |
  Where-Object Extension -In ".apk", ".aab" |
  Select-Object FullName, Length, LastWriteTime
```

`npm run tauri:prepare:release` copies the newest release APK and AAB into `release/`, but it also expects the Web and Windows intermediate outputs. For a clean Android-only build, use the files under the Android `outputs` directory directly.

## 7. Verify the artifacts

### Test the Windows packages

- Install the `-setup.exe` package and launch the application.
- Test the `.msi` if it will be distributed.
- Extract the `-portable.zip` into an empty directory and run `GalWriter-AI.exe`.

Windows packages in this repository are not Authenticode-signed unless a separate Windows code-signing step is added. Android signing does not sign the Windows files.

### Test the Web ZIP

Extract the ZIP and serve it through an HTTP server; do not use `file://` as the deployment test.

For example:

```powershell
Expand-Archive "release\GalWriter-AI-v1.2.7-web.zip" "release\web-test" -Force
npx serve "release\web-test"
```

### Verify and install the Android APK

Locate `apksigner` and verify the certificate:

```powershell
$apksigner = Get-ChildItem "$env:ANDROID_HOME\build-tools" -Recurse -Filter apksigner.bat |
  Sort-Object FullName -Descending |
  Select-Object -First 1 -ExpandProperty FullName

& $apksigner verify --verbose --print-certs `
  "release\GalWriter-AI-v1.2.7-android-signed.apk"
```

Then install it on a connected device:

```powershell
adb devices
adb install -r "release\GalWriter-AI-v1.2.7-android-signed.apk"
```

Replace `1.2.7` with the current version. If installation reports `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, the installed application uses a different signing key. Uninstall it first only if losing its local application data is acceptable:

```powershell
adb uninstall com.galwriter.ai
```

## 8. Publish through GitHub Actions

The workflow in `.github/workflows/release.yml` runs when a tag matching `app-v*` is pushed. Before using it, configure these repository secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_PASSWORD`
- `ANDROID_KEY_ALIAS`

Encode the keystore for `ANDROID_KEYSTORE_BASE64` in PowerShell:

```powershell
[Convert]::ToBase64String(
  [IO.File]::ReadAllBytes(".android-signing\galwriter-release.keystore")
) | Set-Clipboard
```

Make sure the tag matches the versions in `package.json` and `src-tauri/tauri.conf.json`, then push it:

```powershell
git tag app-v1.2.8
git push origin app-v1.2.8
```

The workflow builds the files and attaches them to a GitHub Release. The automatically generated “Source code” archives are not application binaries.

> The Android Gradle signing configuration lives in the gitignored generated project. A clean GitHub Actions runner must apply the signing configuration described in section 4.5 after Android initialization; restoring only the keystore and `key.properties` is not sufficient if the generated Gradle file does not already load them.

## Troubleshooting

### Android was skipped

The all-platform build prints one of these warnings when it cannot find Android:

```text
Skipping Android build: ANDROID_HOME / ANDROID_SDK_ROOT is missing or invalid.
Skipping Android build: Android NDK was not found.
```

Set `ANDROID_HOME`, `ANDROID_SDK_ROOT`, and `NDK_HOME` in the same PowerShell session, then rerun the command.

### `keytool` is not found

Use the JDK bundled with Android Studio or install JDK 21, then add its `bin` directory to `Path`.

### Android release is unsigned

Check all three items:

1. `.android-signing\galwriter-release.keystore` exists.
2. `src-tauri\gen\android\key.properties` contains the correct values.
3. `src-tauri\gen\android\app\build.gradle.kts` contains the signing configuration from section 4.5.

### Windows bundle directories are missing

Install the Visual Studio C++ build tools, then rerun:

```powershell
npm run tauri:build:windows
```

Do not run `tauri:prepare:release` until both the NSIS and MSI bundle directories exist.

### Old files remain in `release/`

The preparation script replaces artifacts for the current version but does not remove every older version. List the directory and delete obsolete local artifacts manually when appropriate.

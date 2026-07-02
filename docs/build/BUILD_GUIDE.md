# GalWriter AI 构建与发布指南

**中文** | [English](BUILD_GUIDE.en.md) | [日本語](BUILD_GUIDE.ja.md)

本文说明如何为当前仓库支持的平台生成 `release/` 目录中的正式分发文件：

- Windows x64 安装程序、MSI 和便携版 ZIP
- Web 静态构建 ZIP
- Android 已签名 APK 和 AAB

发布脚本应在 **64 位 Windows** 上运行。目前不会生成 macOS 或 Linux 安装包。

## 快速构建

完成下文的一次性 Windows 和 Android 配置后，在仓库根目录执行：

```powershell
npm ci
npm run tauri:build:all-platforms
```

`npm run tauri:build:release` 是同一构建命令的别名。

以 `1.2.7` 为例，完整构建成功后会生成：

```text
release/
  GalWriter-AI-v1.2.7-windows-x64-setup.exe
  GalWriter-AI-v1.2.7-windows-x64.msi
  GalWriter-AI-v1.2.7-windows-x64-portable.zip
  GalWriter-AI-v1.2.7-web.zip
  GalWriter-AI-v1.2.7-android-signed.apk
  GalWriter-AI-v1.2.7-android.aab
```

文件名中的版本号来自 `package.json`。

> 全平台命令会先构建 Web 和 Windows。如果找不到 Android SDK 或 NDK，脚本会显示警告并跳过 Android。因此构建结束后一定要检查最终文件列表。

## 1. 安装构建工具

### 所有构建都需要

请安装：

- Node.js 20 或更高版本
- Rust stable（MSVC 工具链）
- Microsoft Visual Studio 2022 Build Tools，并勾选 **Desktop development with C++**
- WebView2（当前 Windows 系统通常已经安装）

确认主要工具可用：

```powershell
node --version
npm --version
rustc --version
cargo --version
```

`npm ci` 会安装项目本地的 Tauri CLI，无需全局安装 `cargo-tauri`。

### Android 还需要

安装 Android Studio，并使用其内置 JDK（也可以单独安装 JDK 21）。然后在 Android Studio 的 SDK Manager 中安装：

- Android SDK Platform
- Android SDK Build-Tools
- Android SDK Platform-Tools
- Android SDK Command-line Tools (latest)
- Android NDK

当前生成的 Android 工程使用 Android API 36。如果构建提示缺少某个平台，请在 SDK Manager 中安装错误信息所指定的 API 级别。

建议把仓库放在只含普通英文字符的短路径中，例如：

```text
C:\Projects\GalWriter
```

这样可以避免常见的 Gradle 和 NDK 路径问题。

## 2. 安装依赖并检查源码

在仓库根目录执行：

```powershell
npm ci
npm run typecheck
npm run build
```

`npm ci` 会严格使用 `package-lock.json` 中记录的依赖版本。只有在有意修改依赖时才使用 `npm install`。

## 3. 设置发布版本号

发布新版本前，把以下两个文件中的版本号设置为相同值：

- `package.json`
- `src-tauri/tauri.conf.json`

例如：

```json
"version": "1.2.8"
```

两个值必须一致。发布资产脚本使用 `package.json` 中的版本号命名文件，Tauri 则使用 `src-tauri/tauri.conf.json` 中的版本号打包应用。

## 4. 每个检出目录配置一次 Android

如果只需要 Web 和 Windows 文件，可以跳过本节。

### 4.1 设置 Android 环境变量

在 PowerShell 中执行：

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:NDK_HOME = Get-ChildItem "$env:ANDROID_HOME\ndk" -Directory |
  Sort-Object Name -Descending |
  Select-Object -First 1 -ExpandProperty FullName
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"
```

检查检测到的路径：

```powershell
$env:ANDROID_HOME
$env:NDK_HOME
adb version
```

除非把它们保存为用户环境变量，否则这些变量只在当前 PowerShell 会话中有效。

### 4.2 初始化 Android 工程

执行：

```powershell
npm run tauri:android:init
```

该命令会创建：

```text
src-tauri\gen\android
```

整个 `src-tauri/gen/` 目录都被 Git 忽略。因此每次全新克隆或干净的 CI 检出都必须重新初始化 Android。

### 4.3 创建正式签名 keystore

同一个 Android 应用在整个生命周期中只应创建一次 keystore：

```powershell
New-Item -ItemType Directory -Force ".android-signing" | Out-Null

keytool -genkeypair -v `
  -keystore ".android-signing\galwriter-release.keystore" `
  -alias "galwriter-release" `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000
```

请安全备份 keystore 和密码。`com.galwriter.ai` 的后续 Android 更新必须使用同一签名密钥。`.android-signing/` 和生成的 Android 工程均不会提交到 Git。

如果已有 keystore，请恢复到以下位置，不要重新生成：

```text
.android-signing\galwriter-release.keystore
```

### 4.4 创建 `key.properties`

创建 `src-tauri\gen\android\key.properties`：

```powershell
@"
storeFile=../../../.android-signing/galwriter-release.keystore
storePassword=YOUR_KEYSTORE_PASSWORD
keyAlias=galwriter-release
keyPassword=YOUR_KEY_PASSWORD
"@ | Set-Content -Encoding UTF8 "src-tauri\gen\android\key.properties"
```

替换两个密码占位符。不要提交此文件。

### 4.5 让生成的 Gradle 工程使用签名密钥

Android 工程是生成并被 Git 忽略的，所以每次全新执行 `android init` 后都要确认此配置。

打开：

```text
src-tauri\gen\android\app\build.gradle.kts
```

在已有 import 旁加入：

```kotlin
import java.io.FileInputStream
```

在 `tauriProperties` 声明后加入：

```kotlin
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}
```

在 `android { ... }` 内、`defaultConfig { ... }` 后加入：

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

在已有的 `getByName("release") { ... }` 区块内加入：

```kotlin
if (keystorePropertiesFile.exists()) {
    signingConfig = signingConfigs.getByName("release")
}
```

## 5. 构建全部发布文件

在 x64 Windows PowerShell 中，从仓库根目录执行：

```powershell
npm run tauri:build:all-platforms
```

该命令会依次：

1. 把 Web 应用构建到 `dist/`。
2. 构建 Windows Tauri 可执行文件、NSIS 安装程序和 MSI。
3. 在 SDK 和 NDK 可用时构建 Android APK 和 AAB。
4. 把可分发文件复制、重命名并压缩到 `release/`。

查看最终资产：

```powershell
Get-ChildItem release -File |
  Sort-Object Name |
  Select-Object Name, Length, LastWriteTime
```

`release/` 被 Git 忽略，而且可能保留旧版本文件。发布时只选择文件名包含当前版本号的文件。

## 6. 只构建一个目标

单独的构建命令只生成中间产物。最终的 `release/` 文件由 `npm run tauri:prepare:release` 组装，而该脚本目前要求 Windows 和 Web 构建都已完成。

### 仅构建 Web

```powershell
npm run tauri:build:web
```

输出目录为 `dist\`。如需生成 `release\GalWriter-AI-v<version>-web.zip`，还要完成 Windows 构建并执行：

```powershell
npm run tauri:build:windows
npm run tauri:prepare:release
```

### 仅构建 Windows

```powershell
npm run tauri:build:windows
```

主要中间产物位于：

```text
src-tauri\target\release\app.exe
src-tauri\target\release\bundle\nsis\
src-tauri\target\release\bundle\msi\
```

确认 `dist/` 存在后，执行以下命令组装 `release/` 文件：

```powershell
npm run tauri:prepare:release
```

### 仅构建 Android

完成 Android 环境和签名配置后执行：

```powershell
npm run tauri:build:android
```

APK 和 AAB 中间产物位于：

```text
src-tauri\gen\android\app\build\outputs\
```

查找这些文件：

```powershell
Get-ChildItem "src-tauri\gen\android\app\build\outputs" -Recurse -File |
  Where-Object Extension -In ".apk", ".aab" |
  Select-Object FullName, Length, LastWriteTime
```

`npm run tauri:prepare:release` 会把最新的 release APK 和 AAB 复制到 `release/`，但它也要求 Web 和 Windows 中间产物存在。执行干净的 Android 单平台构建时，请直接使用 Android `outputs` 目录下的文件。

## 7. 验证构建产物

### 测试 Windows 包

- 安装 `-setup.exe` 并启动应用。
- 如果准备分发 `.msi`，也要实际测试。
- 把 `-portable.zip` 解压到空目录，然后运行 `GalWriter-AI.exe`。

除非另行增加 Windows 代码签名步骤，否则本仓库生成的 Windows 包没有 Authenticode 签名。Android 签名不会签署 Windows 文件。

### 测试 Web ZIP

解压 ZIP 并通过 HTTP 服务器访问，不要把 `file://` 当作部署测试：

```powershell
Expand-Archive "release\GalWriter-AI-v1.2.7-web.zip" "release\web-test" -Force
npx serve "release\web-test"
```

### 验证并安装 Android APK

查找 `apksigner` 并验证证书：

```powershell
$apksigner = Get-ChildItem "$env:ANDROID_HOME\build-tools" -Recurse -Filter apksigner.bat |
  Sort-Object FullName -Descending |
  Select-Object -First 1 -ExpandProperty FullName

& $apksigner verify --verbose --print-certs `
  "release\GalWriter-AI-v1.2.7-android-signed.apk"
```

在已连接的设备上安装：

```powershell
adb devices
adb install -r "release\GalWriter-AI-v1.2.7-android-signed.apk"
```

请把 `1.2.7` 换成当前版本。如果出现 `INSTALL_FAILED_UPDATE_INCOMPATIBLE`，说明设备上已有应用使用了不同签名。只有在可以接受丢失本地应用数据时，才先卸载：

```powershell
adb uninstall com.galwriter.ai
```

## 8. 通过 GitHub Actions 发布

推送符合 `app-v*` 格式的标签时，`.github/workflows/release.yml` 会运行。使用前请配置以下仓库 Secrets：

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_PASSWORD`
- `ANDROID_KEY_ALIAS`

在 PowerShell 中为 `ANDROID_KEYSTORE_BASE64` 编码 keystore：

```powershell
[Convert]::ToBase64String(
  [IO.File]::ReadAllBytes(".android-signing\galwriter-release.keystore")
) | Set-Clipboard
```

确认标签与两个配置文件中的版本一致，然后推送：

```powershell
git tag app-v1.2.8
git push origin app-v1.2.8
```

工作流会构建文件并附加到 GitHub Release。GitHub 自动生成的 “Source code” 压缩包不是应用程序安装包。

> Android Gradle 签名配置位于被 Git 忽略的生成工程中。干净的 GitHub Actions runner 在初始化 Android 后，必须应用第 4.5 节的签名配置。若生成的 Gradle 文件不会读取这些配置，仅恢复 keystore 和 `key.properties` 并不足够。

## 常见问题

### Android 被跳过

找不到 Android 环境时，全平台构建会输出：

```text
Skipping Android build: ANDROID_HOME / ANDROID_SDK_ROOT is missing or invalid.
Skipping Android build: Android NDK was not found.
```

请在同一个 PowerShell 会话中设置 `ANDROID_HOME`、`ANDROID_SDK_ROOT` 和 `NDK_HOME`，然后重新构建。

### 找不到 `keytool`

使用 Android Studio 内置的 JDK，或安装 JDK 21 并把其 `bin` 目录加入 `Path`。

### Android release 没有签名

检查：

1. `.android-signing\galwriter-release.keystore` 存在。
2. `src-tauri\gen\android\key.properties` 内容正确。
3. `src-tauri\gen\android\app\build.gradle.kts` 包含第 4.5 节的签名配置。

### 找不到 Windows bundle 目录

安装 Visual Studio C++ 构建工具，然后重新执行：

```powershell
npm run tauri:build:windows
```

在 NSIS 和 MSI bundle 目录都存在之前，不要运行 `tauri:prepare:release`。

### `release/` 中仍有旧文件

资产准备脚本会替换当前版本的文件，但不会删除所有旧版本。请检查目录，并在确认无用后手动删除过期的本地产物。

# GalWriter AI Android 打包教程

这份教程用于在 Windows 上把 GalWriter AI 打包成 Android App。重点是：项目路径建议使用纯英文路径，避免 Android NDK / Gradle 在处理非 ASCII 路径时失败。

## 1. 准备英文路径项目

建议把项目放在纯英文路径，例如：

```powershell
cd "C:\Projects\galwriter-ai"
```

如果需要从另一个工作目录同步一份到英文路径，可以参考：

```powershell
robocopy "C:\path\to\source\galwriter-ai" "C:\Projects\galwriter-ai" /MIR /XD node_modules dist src-tauri\target src-tauri\gen
```

说明：

- `/MIR` 会让目标目录和源目录保持一致，目标目录里源目录没有的文件会被删除。
- `/XD` 排除了依赖和构建产物，避免复制过慢，也避免旧构建缓存污染 Android 打包。
- 打包前一定确认你当前所在路径不包含中文字符。

## 2. 安装基础环境

需要安装：

- Node.js 20 或更高版本
- Rust stable
- Android Studio
- Android SDK Platform
- Android SDK Build-Tools
- Android SDK Platform-Tools
- Android NDK
- Android SDK Command-line Tools

Android Studio 里打开：

```text
Settings -> Languages & Frameworks -> Android SDK
```

在 `SDK Platforms` 里安装一个较新的 Android API，例如 Android 15 / API 35。

在 `SDK Tools` 里勾选：

- Android SDK Build-Tools
- Android SDK Platform-Tools
- Android SDK Command-line Tools
- NDK
- CMake

## 3. 设置环境变量

PowerShell 临时设置，当前窗口有效：

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = "$env:LOCALAPPDATA\Android\Sdk"
$env:NDK_HOME = Get-ChildItem "$env:ANDROID_HOME\ndk" -Directory | Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty FullName
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"
```

检查：

```powershell
adb version
sdkmanager --version
rustc --version
npm --version
```

如果 `sdkmanager` 找不到，检查这个目录是否存在：

```powershell
"$env:LOCALAPPDATA\Android\Sdk\cmdline-tools\latest\bin"
```

## 4. 安装项目依赖

进入项目目录后执行：

```powershell
cd "C:\Projects\galwriter-ai"
npm install
```

先确认网页前端能正常构建：

```powershell
npm run build
```

## 5. 初始化 Tauri Android 工程

如果 `src-tauri\gen\android` 已经存在，通常可以跳过初始化。

如果是新复制的项目，或想重新生成 Android 工程，执行：

```powershell
npm run tauri android init
```

初始化过程中如果询问包名，使用当前配置里的包名：

```text
com.galwriter.ai
```

如果初始化失败，优先检查：

- 当前路径是否完全英文
- `ANDROID_HOME` 是否正确
- NDK 是否安装
- Rust 是否安装

## 6. 打包 Debug APK

Debug 包适合自己测试安装：

```powershell
npm run tauri android build -- --debug
```

打包完成后，用下面命令查找 APK：

```powershell
Get-ChildItem "src-tauri\gen\android\app\build\outputs" -Recurse -Filter *.apk | Select-Object FullName,Length,LastWriteTime
```

连接手机并安装：

```powershell
adb devices
adb install -r "这里替换成上一步找到的 apk 完整路径"
```

## 7. 打包 Release 包

Release 包用于正式分发：

```powershell
npm run tauri android build
```

打包完成后查找 APK/AAB：

```powershell
Get-ChildItem "src-tauri\gen\android\app\build\outputs" -Recurse -Include *.apk,*.aab | Select-Object FullName,Length,LastWriteTime
```

如果要上架 Google Play，通常需要 AAB，并且需要配置正式签名。签名配置一般在 Android Gradle 工程里处理，路径在：

```text
src-tauri\gen\android
```

## 8. 清理后重打

如果 Gradle 缓存或 Android 工程状态异常，可以清理后再打：

```powershell
Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "src-tauri\gen\android\app\build" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "src-tauri\gen\android\build" -ErrorAction SilentlyContinue
npm run build
npm run tauri android build -- --debug
```

如果问题仍然存在，再考虑删除整个 Android 生成目录并重新初始化：

```powershell
Remove-Item -Recurse -Force "src-tauri\gen\android"
npm run tauri android init
npm run tauri android build -- --debug
```

## 9. 常见问题

### NDK 因中文路径失败

现象通常是 Gradle、NDK、CMake 报路径解析错误。解决方法是把项目复制到纯英文路径，例如：

```text
C:\Projects\galwriter-ai
```

### sdkmanager 找不到

确认 Android SDK Command-line Tools 已安装，并且 `cmdline-tools\latest\bin` 已加入 `Path`。

### 找不到 adb

确认 `platform-tools` 已加入 `Path`：

```powershell
$env:Path = "$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:Path"
```

### Release 签名失败

Debug 包不需要正式签名。Release 包如果要发布，需要配置 keystore。可以先用 Debug APK 验证 App 是否能运行，再处理正式签名。

### 复制项目后依赖异常

重新安装依赖：

```powershell
Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
Remove-Item -Force "package-lock.json" -ErrorAction SilentlyContinue
npm install
```

注意：删除 `package-lock.json` 会重新解析依赖版本。只有在依赖状态明显损坏时才建议这样做。

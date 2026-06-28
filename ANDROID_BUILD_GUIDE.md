# GalWriter AI Android Release APK 签名打包教程

这份文档教你在 Windows 上把 GalWriter AI 用 Tauri 打包成“自带正式签名”的 Android release APK。照着做完以后，得到的 APK 可以直接发给别人安装，不再是 debug 包，也不需要别人额外签名。

当前项目的 Android 包名是：

```text
com.galwriter.ai
```

> 重要：正式签名用的 keystore 一定要长期保存。以后同一个 Android 应用升级时，必须继续使用同一个 keystore。丢失 keystore 后，旧用户通常无法直接升级安装新版 APK。

## 1. 先把项目放到英文路径

Android NDK / Gradle 对中文路径、空格路径比较敏感。建议先把项目复制到纯英文路径，例如：

```powershell
cd "C:\Projects\galwriter-ai"
```

如果你现在的项目在桌面或 OneDrive 中文路径里，可以同步一份到英文目录：

```powershell
robocopy "C:\Users\cui_m\OneDrive\Desktop\APP develop\galwriter-ai" "C:\Projects\galwriter-ai" /MIR /XD node_modules dist src-tauri\target src-tauri\gen
```

说明：

- `/MIR` 会让目标目录和源目录保持一致，目标目录里源目录没有的文件会被删除。
- `/XD` 排除了依赖和构建产物，避免复制太慢，也避免旧缓存影响 Android 打包。
- 后面的命令默认都在 `C:\Projects\galwriter-ai` 里执行。

## 2. 准备基础环境

需要安装：

- Node.js 20 或更高版本
- Rust stable
- Android Studio
- Android SDK Platform
- Android SDK Build-Tools
- Android SDK Platform-Tools
- Android SDK Command-line Tools
- Android NDK
- CMake

在 Android Studio 里打开：

```text
Settings -> Languages & Frameworks -> Android SDK
```

在 `SDK Platforms` 里安装较新的 Android API，例如 Android 15 / API 35 或更新版本。

在 `SDK Tools` 里勾选：

- Android SDK Build-Tools
- Android SDK Platform-Tools
- Android SDK Command-line Tools
- NDK
- CMake

## 3. 打开 PowerShell 并设置环境变量

打开一个新的 PowerShell 窗口，执行：

```powershell
cd "C:\Projects\galwriter-ai"

$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = "$env:LOCALAPPDATA\Android\Sdk"
$env:NDK_HOME = Get-ChildItem "$env:ANDROID_HOME\ndk" -Directory | Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty FullName
$env:Path = "$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"
```

检查命令是否都能运行：

```powershell
adb version
sdkmanager --version
rustc --version
npm --version
```

如果 `sdkmanager` 找不到，先确认这个目录存在：

```powershell
"$env:LOCALAPPDATA\Android\Sdk\cmdline-tools\latest\bin"
```

## 4. 安装项目依赖并测试前端构建

```powershell
npm install
npm run build
```

如果 `npm run build` 失败，先解决前端构建错误。Android release 打包会自动跑前端构建，所以这里必须先通过。

## 5. 初始化 Tauri Android 工程

如果 `src-tauri\gen\android` 已经存在，可以先跳过这一步。

如果是第一次打 Android 包，执行：

```powershell
npm run tauri android init
```

初始化过程中如果询问包名，填写：

```text
com.galwriter.ai
```

初始化完成后，应该能看到这个目录：

```text
src-tauri\gen\android
```

## 6. 先打一遍 Debug APK 验证环境

正式签名前，建议先打 debug 包确认 Android 环境没有问题：

```powershell
npm run tauri android build -- --debug --apk
```

查找生成的 APK：

```powershell
Get-ChildItem "src-tauri\gen\android\app\build\outputs" -Recurse -Filter *.apk | Select-Object FullName,Length,LastWriteTime
```

连接手机后安装测试：

```powershell
adb devices
adb install -r "这里替换成上一步找到的 debug apk 完整路径"
```

debug 包能正常安装和打开后，再继续做正式签名。

## 7. 生成正式签名 keystore

在项目根目录创建一个本地签名目录：

```powershell
New-Item -ItemType Directory -Force ".android-signing"
```

生成 keystore：

```powershell
keytool -genkeypair -v `
  -keystore ".android-signing\galwriter-release.keystore" `
  -alias "galwriter-release" `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000
```

命令会让你输入几项信息：

- `keystore password`：签名文件密码，请自己记好。
- `key password`：可以和 keystore password 相同。
- 姓名、组织、城市、省份、国家代码：按实际情况填写即可。
- 最后确认时输入 `yes` 或者 是。

生成后确认文件存在：

```powershell
Get-Item ".android-signing\galwriter-release.keystore"
```

建议立刻备份这个文件，例如放到你的私人加密网盘、移动硬盘或密码管理器附件里。不要把 `.keystore` 文件上传到 GitHub。

## 8. 写入本地签名配置

在 Android 工程目录创建一个只保存在本机的签名配置文件：

```powershell
@"
storeFile=../../../.android-signing/galwriter-release.keystore
storePassword=这里改成你的keystore密码
keyAlias=galwriter-release
keyPassword=这里改成你的key密码
"@ | Set-Content -Encoding UTF8 "src-tauri\gen\android\key.properties"
```

注意：

- `key.properties` 已经在 `src-tauri\gen\android\.gitignore` 里，不应该提交。
- 如果你的 key password 和 keystore password 一样，两处就填同一个密码。
- 密码里如果有反斜杠、引号、中文或特殊符号，Gradle 读取时可能更容易出问题。首次建议用长一点的英文、数字、符号组合。

## 9. 配置 Gradle 使用 release 签名

打开这个文件：

```text
src-tauri\gen\android\app\build.gradle.kts
```

在文件顶部现有的 `import java.util.Properties` 下面加上：

```kotlin
import java.io.FileInputStream
```

然后在 `val tauriProperties = ...` 这段下面，加入：

```kotlin
val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}
```

接着在 `android { ... }` 里面，放在 `defaultConfig { ... }` 后面、`buildTypes { ... }` 前面，加入：

```kotlin
signingConfigs {
    create("release") {
        keyAlias = keystoreProperties["keyAlias"] as String
        keyPassword = keystoreProperties["keyPassword"] as String
        storeFile = rootProject.file(keystoreProperties["storeFile"] as String)
        storePassword = keystoreProperties["storePassword"] as String
    }
}
```

最后找到 `buildTypes` 里的 `getByName("release") { ... }`，在里面加一行：

```kotlin
signingConfig = signingConfigs.getByName("release")
```

改完后，release 区块大致会像这样：

```kotlin
getByName("release") {
    signingConfig = signingConfigs.getByName("release")
    isMinifyEnabled = true
    proguardFiles(
        *fileTree(".") { include("**/*.pro") }
            .plus(getDefaultProguardFile("proguard-android-optimize.txt"))
            .toList().toTypedArray()
    )
}
```

## 10. 打包自带签名的 release APK

执行：

```powershell
npm run tauri android build -- --apk
```

如果还想同时生成 AAB，可以执行：

```powershell
npm run tauri android build -- --apk --aab
```

打包完成后查找 release APK：

```powershell
Get-ChildItem "src-tauri\gen\android\app\build\outputs\apk" -Recurse -Filter "*release*.apk" | Select-Object FullName,Length,LastWriteTime
```

常见输出位置类似：

```text
src-tauri\gen\android\app\build\outputs\apk\universal\release\app-universal-release.apk
```

如果你使用了 `--split-per-abi`，会生成多个架构包，例如 arm64、armeabi-v7a、x86_64。普通分发给手机用户时，优先使用 arm64 或 universal APK。

## 11. 验证 APK 是否已经签名

先找到 `apksigner`：

```powershell
$apksigner = Get-ChildItem "$env:ANDROID_HOME\build-tools" -Recurse -Filter apksigner.bat | Sort-Object FullName -Descending | Select-Object -First 1 -ExpandProperty FullName
$apksigner
```

把 APK 路径填进去验证：

```powershell
& $apksigner verify --verbose --print-certs "这里替换成 release apk 完整路径"
```

如果看到类似下面的信息，说明 APK 已经带正式签名：

```text
Verified using v1 scheme (JAR signing): true
Verified using v2 scheme (APK Signature Scheme v2): true
Signer #1 certificate DN: ...
```

再安装到手机测试：

```powershell
adb install -r "这里替换成 release apk 完整路径"
```

如果手机上已经装过 debug 版，release 版可能无法覆盖安装，因为 debug 包和 release 包签名不同。可以先卸载 debug 版：

```powershell
adb uninstall com.galwriter.ai.debug
adb install -r "这里替换成 release apk 完整路径"
```

如果之前装过同包名但不同签名的 release 包，也需要先卸载：

```powershell
adb uninstall com.galwriter.ai
adb install -r "这里替换成 release apk 完整路径"
```

## 12. 推荐把 APK 复制到 release 目录

项目根目录可以建一个本地发布目录：

```powershell
New-Item -ItemType Directory -Force "release"
```

复制并重命名 APK：

```powershell
Copy-Item "这里替换成 release apk 完整路径" "release\GalWriter-AI-v1.2.5-android-release-signed.apk" -Force
```

最终你要发布给用户的就是：

```text
release\GalWriter-AI-v1.2.5-android-release-signed.apk
```

## 13. 以后更新版本时怎么做

每次发新版前，先更新版本号：

- `package.json` 里的 `version`
- `src-tauri\tauri.conf.json` 里的 `version`

然后重新打包：

```powershell
npm run tauri android build -- --apk
```

必须继续使用同一个：

```text
.android-signing\galwriter-release.keystore
```

只要包名还是 `com.galwriter.ai`，并且签名还是同一个 keystore，用户就可以覆盖安装升级。

## 14. 常见问题

### NDK 或 Gradle 因中文路径失败

现象通常是 Gradle、NDK、CMake 报路径解析错误。解决方法是把项目复制到纯英文路径：

```text
C:\Projects\galwriter-ai
```

### 找不到 keytool

`keytool` 来自 JDK。安装 Android Studio 后通常会自带 JDK。如果 PowerShell 找不到 `keytool`，可以在 Android Studio 的 JDK 目录里找，或安装 Temurin / Oracle JDK。

### Release 打包提示 key.properties 找不到

确认文件在这里：

```text
src-tauri\gen\android\key.properties
```

并确认 `build.gradle.kts` 里读取的是：

```kotlin
rootProject.file("key.properties")
```

### Release 打包提示 keystore 路径不存在

确认 `key.properties` 里的路径是：

```text
storeFile=../../../.android-signing/galwriter-release.keystore
```

这个路径是从 `src-tauri\gen\android` 这个 Android Gradle 根工程位置回到项目根目录的相对路径。文档上面的 Gradle 片段使用的是 `rootProject.file(...)`，所以这里按 Android 根工程计算。

### 安装时报 INSTALL_FAILED_UPDATE_INCOMPATIBLE

手机上已经安装过同包名但不同签名的 APK。先卸载旧版本再安装：

```powershell
adb uninstall com.galwriter.ai
adb install -r "这里替换成 release apk 完整路径"
```

### debug 版和 release 版能同时安装吗

可以。当前配置里 debug 包会自动加后缀：

```text
com.galwriter.ai.debug
```

正式 release 包是：

```text
com.galwriter.ai
```

### 忘记 keystore 密码怎么办

如果找不回密码，基本无法继续用同一个签名发升级包。能做的只有找回备份，或换一个新包名重新发布新应用。所以第一次生成 keystore 后，一定要备份 keystore 文件和密码。

### 想上架 Google Play 应该用 APK 还是 AAB

给用户手动安装用 APK。上架 Google Play 通常用 AAB：

```powershell
npm run tauri android build -- --aab
```

但 Google Play 的签名、上传密钥和 Play App Signing 还有额外流程，和“手动分发签名 APK”不是同一件事。

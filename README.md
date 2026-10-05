<div align="center">

<img src="public/icon.png" alt="GalWriter logo" width="84" />

# 旮旯作家 · GalWriter

### 从旮旯的灵感，写到辽阔的世界。

React 19 · TypeScript · Vite 6 · Tauri 2 · React Flow · MCP SDK

[English](README.en.md) · [日本語](README.ja.md) · [完整说明](README.full.md) · [快速使用手册](docs/USER_GUIDE.md)

</div>

GalWriter 是一款用于创作视觉小说、分支故事与互动演示的 AI 工作台：在故事画布上组织剧情、人物和场景，预演分支，再导出 Web、视频、PPT 或游戏项目。

## 下载 v1.5.0

**推荐极简版 Lite**：下载更快，预设图片、音乐和模板按需联网获取。需要离线使用全部内置资源时，选择完整包 Full。

| 平台 | 极简版 Lite（推荐） | 完整版 Full |
| --- | --- | --- |
| Windows x64 | [安装包](https://github.com/Mingwen-Cui/GalWriter/releases/download/app-v1.5.0/GalWriter-AI-v1.5.0-windows-x64-lite-setup.exe) | [安装包](https://github.com/Mingwen-Cui/GalWriter/releases/download/app-v1.5.0/GalWriter-AI-v1.5.0-windows-x64-full-setup.exe) |
| Android | [APK](https://github.com/Mingwen-Cui/GalWriter/releases/download/app-v1.5.0/GalWriter-AI-v1.5.0-android-lite-signed.apk) | [APK](https://github.com/Mingwen-Cui/GalWriter/releases/download/app-v1.5.0/GalWriter-AI-v1.5.0-android-full-signed.apk) |

Windows MSI 及其他版本文件见 [全部 Release 附件](https://github.com/Mingwen-Cui/GalWriter/releases/tag/app-v1.5.0)。Android 两种版本使用相同应用标识，不能并行安装。

## 自行打包

在仓库根目录执行。Android 还需先安装 Android SDK/NDK 并配置签名；详细步骤见[构建指南](docs/build/BUILD_GUIDE.md)。

| 目标 | 完整版 Full | 极简版 Lite | 产物 |
| --- | --- | --- | --- |
| Windows x64 | `npm run tauri:build:windows:full`<br>`npm run tauri:prepare:release:full` | `npm run tauri:build:windows:lite`<br>`npm run tauri:prepare:release:lite` | 本次发布：安装包、MSI（不含 ZIP） |
| Android | `npm run tauri:build:android:full`<br>`npm run tauri:prepare:android:full` | `npm run tauri:build:android:lite`<br>`npm run tauri:prepare:android:lite` | 本次发布：APK（不含 AAB） |

## 项目数据

在项目首页选择导出/导入 ZIP，可备份、迁移或继续编辑项目。

| ZIP 内容 | 默认状态 |
| --- | --- |
| 故事、项目设置与可打包素材 | 导出 |
| 设定库中的人物、场景卡片 | 默认不导出；可勾选附带 |
| API Profiles 与密钥 | 默认不导出；仅在明确勾选后包含 |

## MCP

Windows 桌面版支持 MCP，可让 Codex 读取、创建和编辑当前项目。将以下内容加入 `~/.codex/config.toml`：

```toml
[mcp_servers.galwriter]
url = "http://127.0.0.1:38941/mcp"
```

也可运行 `codex mcp add galwriter --url http://127.0.0.1:38941/mcp`。先启动 GalWriter，再重启 Codex；网站版无法连接访客电脑上的本机服务。

## 更多信息

- [完整功能、AI 配置与项目数据说明](README.full.md)
- [AI 服务与 API Key 配置](README.full.md#ai-与-api-key-配置)
- [精简使用手册](docs/USER_GUIDE.md)
- [问题反馈](https://github.com/Mingwen-Cui/GalWriter/issues)
- [构建与发布指南](docs/build/BUILD_GUIDE.md)

## 作者与许可证

作者：Mingwen Cui。当前仓库未附开源许可证；版权所有，未经许可不得重新分发。详见 [NOTICE](NOTICE)。

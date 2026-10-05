# GalWriter 快速使用手册

GalWriter 用于制作视觉小说、分支故事和互动演示：在画布组织剧情、人物与场景，预演流程，再导出作品。

## 5 分钟开始

1. 从 [GitHub Releases](https://github.com/Mingwen-Cui/GalWriter/releases) 下载 Windows 版。**推荐 Lite 极简包**：体积更小，预设图片、音乐和模板按需联网获取；需要离线资源时选 Full 完整包。
2. 新建项目，在画布添加剧情卡，并用连线表示选项和后续分支。
3. 添加角色、场景和数值条件；AI 功能需在「设置 → AI」配置对应服务与 API Key。
4. 用 Playtest 试跑选项、分支和演出；确认后在顶部打开 Web、视频、PPT 或代码导出工作区。
5. 定期导出项目 ZIP 备份，之后可导入继续编辑。

## 连接 Codex（MCP）

MCP 仅由 Windows 桌面版提供。启动 GalWriter，把以下配置写入 `~/.codex/config.toml`，然后重启 Codex：

```toml
[mcp_servers.galwriter]
url = "http://127.0.0.1:38941/mcp"
```

也可执行 `codex mcp add galwriter --url http://127.0.0.1:38941/mcp`。使用期间 GalWriter 必须保持运行；浏览器版不能连接访问者电脑上的本机服务。

## 数据与隐私

项目和 AI Profile 保存在本机。API Key 默认不会包含在项目 ZIP 中；导出时只有明确选择包含配置，密钥才会进入导出文件。首次使用 Lite 或读取在线预设资源时需要联网。

## 常用链接

- [下载与版本说明](https://github.com/Mingwen-Cui/GalWriter/releases)
- [构建与发布指南](build/BUILD_GUIDE.md)
- [问题反馈](https://github.com/Mingwen-Cui/GalWriter/issues)

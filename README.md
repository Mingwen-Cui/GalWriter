# GalWriter AI

<p align="center">
  <img src="./public/icon.png" alt="GalWriter AI" width="96" />
</p>

<p align="center">
  专为视觉小说与交互式剧本设计的 AI 节点式创作编辑器。
</p>

GalWriter AI 是一款面向视觉小说、Galgame、互动叙事和多分支剧本创作的专业编辑器。它把自由画布、节点连线、AI 共创、实时测试与工程化导出放在同一个工作流里，帮助创作者更清晰地组织剧情结构、更高效地迭代文本，并把作品交付到游戏引擎或前端项目中。

## 核心能力

- **节点式逻辑引擎**：在无限画布中自由连接剧情、角色、背景、条件判断和文本导出节点，让复杂分支结构一目了然。
- **AI 深度共创节点**：支持上下文感知生成，可用于前文续写、脑洞发散、场景补写、对话补写、润色重写和剧情插值。
- **动态包裹与收纳**：通过分组/包裹节点整理大型剧情分支，支持折叠与展开，降低复杂项目的视觉负担。
- **沉浸式实时测试**：无需完整打包，即可从玩家视角预览互动流程，检查选择、分支、节奏和演出效果。
- **高阶批量工具**：提供全局查找替换、文本聚合与批量处理能力，减少后期校对和统一修改成本。
- **工程级一键导出**：可导出 JSON 剧本与相关素材，便于接入游戏引擎、网页项目或其他生产管线。
- **高自由度定制**：支持连线样式、小地图、标题显隐、工具栏布局、纯文本粘贴、AI 输出长度、token 统计等工作流设置。

## AI 工作流

GalWriter AI 支持 Gemini、DeepSeek 以及兼容 OpenAI 风格的模型配置。你可以在编辑器设置中配置自己的 API Key，并根据创作阶段选择不同模式：

- **全局智库分析**：从多个相连节点中提取剧情脉络与上下文。
- **深度思考模式**：展示模型推理过程，让 AI 构思更透明。
- **前文顺延续写**：延续当前剧情走向，保持人设、语气和叙事节奏。
- **脑洞创意发散**：生成多个后续发展方向，帮助突破卡文。
- **场景/对话提纯**：针对环境描写或角色台词进行局部强化。
- **极致润色重写**：保留核心信息，提升文字表现力。

## 技术栈

- React 19
- TypeScript
- Vite
- React Flow (`@xyflow/react`)
- Tauri 2
- Tailwind CSS
- IndexedDB
- JSZip
- Gemini / DeepSeek / OpenAI-compatible AI integrations

## 本地运行

### 环境要求

- Node.js
- npm
- Rust 与 Tauri 依赖环境（仅桌面端开发/打包需要）

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env.example` 并创建本地环境文件：

```bash
cp .env.example .env.local
```

然后填入需要的密钥：

```env
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
APP_URL="http://localhost:3000"
```

部分 AI Provider 的密钥也可以在应用内设置页中配置。

### 启动 Web 开发环境

```bash
npm run dev
```

默认地址：

```text
http://localhost:3000
```

### 启动 Tauri 桌面端

```bash
npm run tauri dev
```

### 构建 Web 版本

```bash
npm run build
```

### 打包桌面应用

```bash
npm run tauri build
```

打包产物通常位于：

```text
src-tauri/target/release/bundle
```

Windows 桌面版如果未进行数字签名，下载或运行时可能触发 Windows Defender/SmartScreen 提示。这是独立开发者应用的常见现象，正式分发时建议配置代码签名。

## 发布到 GitHub Release

项目已配置 GitHub Actions 自动打包 Windows 桌面安装包。发布新版时：

```bash
git tag app-v1.2.5
git push origin app-v1.2.5
```

GitHub 会自动执行 `.github/workflows/release.yml`，构建 Tauri 桌面程序，并把 `app.exe` 重命名后发布到 Releases 的 Assets 中。用户进入 GitHub Releases 页面后，下载 `GalWriter-AI-vX.X.X-windows-x64.exe` 并双击运行即可。

GitHub Release 页面会自动附带 `Source code (zip)` 和 `Source code (tar.gz)`，那是 GitHub 的默认源码快照，不是给普通用户安装的软件。

版本号建议同步更新：

- `src-tauri/tauri.conf.json` 中的 `version`
- `package.json` 中的 `version`

## 项目结构

```text
.
|-- public/              # 静态资源与下载文件
|-- src/                 # React 前端源码
|   |-- components/      # 节点、编辑器、弹窗与交互组件
|   `-- lib/             # AI、导出、数据库、国际化等工具
|-- src-tauri/           # Tauri 桌面端工程
|-- php-backend/         # 可选 AI 代理后端
|-- vite.config.ts       # Vite 与开发代理配置
`-- package.json
```

## 常用脚本

```bash
npm run dev          # 启动 Vite 开发服务器
npm run build        # 构建前端产物
npm run preview      # 预览构建产物
npm run lint         # TypeScript 类型检查
npm run tauri dev    # 启动 Tauri 开发模式
npm run tauri build  # 打包桌面应用
```

## 作者

Created by Mingwen Cui.

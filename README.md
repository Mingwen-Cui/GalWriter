<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/9ffc78a2-3532-4610-88ab-74e16e228549

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


如何开始使用？
由于 Tauri 需要 Rust 环境来编译原生代码，请确保你的电脑上安装了 Rust（如果还没安装，请访问 rust-lang.org 安装）。

开发模式运行:

powershell
npm run tauri dev
这将同时启动 Vite 开发服务器和 Tauri 窗口。

正式打包发布:

powershell
npm run tauri build
打包后的安装包将位于 src-tauri/target/release/bundle 目录下。

文件的打包位置 \galwriter-ai\src-tauri\target\release
本地端下载
请将你打包好的 Windows 安装包命名为 GalWriter-AI-Setup.exe，并放入以下路径： public/downloads/GalWriter-AI-Setup.exe

这样用户点击按钮时就可以直接触发下载了。

工作摘要：


ui的设计规范: 对于节点卡片来说。一个点，再加上一个圆圈是非常重要的信息输入流。如果这个条件已经被满足的时候，其他的节点将会从点加上圆变成点。这意味着其他的节点用处已经不大了。

请参考以下风格设计一组 React Flow 深色节点 UI。

整体风格：
- 节点是深色卡片风格
- 背景使用 var(--card-bg)
- 外层使用 rounded-xl、shadow-lg、border-2
- 默认边框使用 var(--card-border)
- 选中 selected 时，边框和阴影变成当前节点主题色
- Header 使用 var(--header-bg)，底部有 border-b
- Header 左侧是图标和标题，右侧是功能按钮
- 节点内容区域使用 p-4、gap-4，整体紧凑但清晰
- 节点支持最小化，最小化后隐藏内容，只保留标题栏和连接点

连接点 Handle 的通用设计：
- 所有连接点都是 12px × 12px 的圆点
- 使用 w-3 h-3 rounded-full
- 使用 border-2 border-[var(--card-bg)]，让点像嵌在卡片边缘
- 使用 shadow-sm 增加轻微浮起感
- 使用 !z-50 保证连接点在最上层
- 连接点略微凸出卡片边缘：
  - 顶部点使用 -top-1.5
  - 左侧点使用 -left-1.5
  - 右侧点使用 -right-1.5
- 使用 transition-all 或 transition-[background-color,ring,transform] 做状态变化动画

输入点设计：
- 输入点一般放在顶部中央和左侧
- 如果是数值/判断类节点，输入点使用 amber 黄色
- 如果是文本/汇总类节点，输入点使用 indigo 靛蓝色
- 如果当前没有输入连接，则给输入点加 ring 光环提示用户需要连接
- hover 时可以变深或放大，增强可交互感

数值判断节点设计：
- 节点宽度约 250px
- 主题色使用 amber
- Header 左侧放 Calculator 图标和“数值判断”
- Header 右侧放反转、最小化、删除按钮
- 内容包括：
  1. 前置节点累计值
  2. 判断阈值输入框
  3. 大于阈值判断结果
  4. 小于等于阈值判断结果
  5. 动态范围输出区域
- 右侧输出点包括：
  - out-greater：代表累计值 > 阈值
  - out-less-equal：代表累计值 ≤ 阈值
  - out-range：代表动态范围 R1、R2、R3
- 输出点旁边放小标签：
  - > 
  - ≤
  - R1 / R2 / R3
- 标签使用 text-[9px] font-bold pointer-events-none

数值判断节点颜色规则：
- 输入点：amber 黄色
- 大于条件成立：emerald 绿色
- 小于等于条件命中：blue 蓝色
- 未命中的大于分支：red 红色
- 范围命中：amber 黄色
- 范围未命中：text-muted 灰色
- 命中的输出点加 ring-2 ring-offset-2，增强状态提示

文本导出节点设计：
- 节点宽度约 350px
- 主题色使用 indigo
- Header 左侧放 FileText 图标和“文本导出”
- Header 右侧放“转化”“复制”“最小化”“删除”按钮
- 内容区上方是设置选项：
  - 数字编号
  - 使用箭头连接
  - 包含标题
  - 追溯至开头
- 下方是文本展示区：
  - 没有内容时显示提示语
  - 有内容时标题用 h3 样式
  - 正文用 text-secondary，允许选中文本
- 文本导出节点只需要输入点，不需要输出点
- 输入点使用 indigo 色
- 没有连接时显示 indigo 光环

最小化规则：
- 节点最小化时，所有连接点移动到标题栏附近，比如 top: 20px
- 展开时，连接点恢复到对应内容位置
- 每次最小化、展开、反转输出、动态范围数量变化后，都需要调用 updateNodeInternals(id)，让 React Flow 重新计算连线位置

整体设计目标：
- 连接点不只是装饰，而是流程逻辑的视觉接口
- 不同颜色表示不同节点类型和状态
- 光环表示当前可连接、未连接或已激活
- 小标签帮助用户理解每个输出点代表的分支
- 节点既要有工具感，也要保持清晰、紧凑、易拖拽
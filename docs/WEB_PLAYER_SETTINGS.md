# 网页设置页：独立页面元素

设置页使用 `WebExportSettings.settingsPageElements`，与主界面、存档页共用 `WebMenuElement` 元素模型和编辑操作。设置项没有固定大面板或固定分组。

## 作者操作

- 在编辑模式点击元素，使用相同的选中框拖动、缩放、旋转；右侧通用 section 编辑位置、文字、填充、描边、阴影、圆角和功能。
- 「设置页元素」列出所有真实元素，可选择、隐藏、删除。
- 「添加按钮与功能」创建真实页面元素，同一功能可以添加多份；顶部原有添加文字、图片和自定义按钮入口继续可用。
- 「恢复已删除元素」保留并恢复原元素属性；也可从功能库重新添加。
- 允许删除全部元素，空页面不会自动重新填入默认按钮。
- 测试模式操作开关、滑块、步进输入、分段选择；导出使用相同的功能绑定。

## 数据与维护入口

- `settingsPageElements`：元素 id、位置、尺寸、旋转、可见性、文字与外观，以及 `role` 功能。
- `WebMenuElement.settingsControlForm`：单个元素的控件形式，在「功能」section 中选择。它随复制、模板与导出保存。
- `settingsPageElementsInitialized`：标记已经编辑过的元素数组，保证显式空数组也有效。
- `settingsPageRemovedElements`：编辑器的删除恢复列表，不参与运行时页面。
- `webMenuPageElements.ts`：统一解析旧设置页，迁移旧固定行的初始位置，保留自定义布局。
- `WebPreviewMenuPages.tsx`：沿用通用元素外壳、选中框和拖动逻辑，给功能元素嵌入真实控件。
- `StartMenuElementInspector.tsx`：通用属性与功能形式编辑。
- `PlayerSettingsControlsInspector.tsx`：真实元素列表、添加与恢复，不再存储另一套元素尺寸。
- `playerSettingsPanel.ts` / `WebPlayerSettingsPanel.tsx`：单个功能控件的语义化 HTML 和交互适配；组件与共享文件必须使用不同基础文件名，避免 Windows 模块解析冲突。
- `webExportHtml.ts`：依照每个实际元素创建导出内容，保留位置、旋转、文字和外观，逐个绑定控件并同步播放器状态。

旧的 `playerSettingsPanel.controls` 仅用于导入旧配置时迁移可见性和形式；编辑后以真实元素为准。`mountPlayerSettings` 会被序列化进入导出 HTML，必须保持函数自包含。

本次按用户要求未运行测试、构建或浏览器验收。

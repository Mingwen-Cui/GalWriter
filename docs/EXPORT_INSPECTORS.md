# 导出属性与游戏界面设计

## 界面入口

- 网页、视频、PPT 使用共用属性分组、数值输入和填充编辑器。
- 顶部“公共外观 / 仅此模式”控制外观是否继承项目公共样式。改为独立时复制当前外观；恢复公共外观时移除该模式覆盖。
- 视频画布尺寸独立保存；网页画布和 PPT 比例仍由各自的数据模型负责。
- 代码工作区的“界面设计”提供画布、对话框、文字和选项的预览与属性编辑。不同游戏目标分别保存参数。

## 修改入口地图

路径均相对于 `src/components/render/`。

| 要修改的内容                 | 首选入口                                                                 |
| ---------------------------- | ------------------------------------------------------------------------ |
| 属性分组、数值输入、分段按钮 | `shared/inspectors/InspectorControls.tsx`                                |
| 属性面板视觉样式             | `shared/inspectors/inspector.css`                                        |
| 色号、透明度与颜色解析       | `shared/paint/colorValue.ts`、`InlinePaintControls.tsx`                  |
| 纯色与渐变弹窗               | `shared/paint/ColorPopovers.tsx`                                         |
| 背景类型、图片、视频         | `shared/paint/BackgroundFillInspector.tsx`、`VideoBackgroundPopover.tsx` |
| 渐变色标数据                 | `shared/paint/gradient.ts`                                               |
| 画布尺寸、比例、旧数据迁移   | `canvas/canvasDimensions.ts`、`canvasSettings.ts`                        |
| 对象样式与旧标量字段同步     | `shared/inspectors/styleState.ts`                                        |
| 各模式外观继承               | `shared/inspectors/useWorkspaceAppearance.ts`                            |
| 工作区持久化与视频参数绑定   | `video/VideoRenderModal/VideoRenderModal.tsx`                            |
| 网页历史记录与设置           | `video/export/useWebExportSettings.ts`                                   |
| 网页背景字段适配             | `web/StartMenuBackgroundInspector.tsx`                                   |
| PPT 背景字段适配             | `ppt/PptSlideBackgroundInspector.tsx`                                    |
| 游戏参数、默认值、引擎能力   | `code/design/gameInterface.ts`                                           |
| 游戏界面设计工作区           | `code/design/GameInterfaceDesigner.tsx`                                  |
| 游戏设计到导出文件的转换     | `code/design/exportGameInterface.ts`                                     |

旧的 `webStyleInspectorControls.tsx`、`webGradientStops.ts` 和视频颜色模块中的兼容入口只负责转发。不要在兼容文件中另建实现。

## 数据所有权

1. 填充控件仅接收 `value / onChange`，不保存项目数据副本。临时弹窗状态和未提交输入草稿可以保存在控件内。
2. 网页和 PPT 的适配层只映射字段，不能复制完整填充 UI，也不能构造伪造的另一工作区设置对象。
3. 对象样式更新通过 `applyStylePatch` 一次性同步兼容字段，避免一次用户操作写入多次历史记录。
4. 新存档包含 `schemaVersion: 2`、`videoCanvasSettings` 和 `appearanceOverrides`。旧视频分辨率经迁移后成为视频画布，避免被网页尺寸覆盖。
5. 网页撤销恢复实际显示的画布及绑定外观；同步的多字段写入合并成一次历史记录。
6. HEX 编辑显示六位颜色值，透明度单独编辑；仍接受带 alpha 的四位或八位 HEX。渐变色标保留各自 alpha。

## 游戏目标范围

| 目标                         | 当前设计参数的输出                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| Godot（兼容标识 `dialogic`） | 项目分辨率、原生运行时对话框布局、颜色、字体、选项及文本速度；设计参数写入故事数据 |
| Ren’Py                       | 项目分辨率、对话与选项 screen、颜色、字体和文本速度；当前不提供圆角控制            |
| TyranoScript                 | 对话框位置、尺寸、背景颜色与透明度、文本颜色、字号和速度；其余依赖宿主工程配置     |
| IR JSON                      | 保留设计参数供后续转换使用，不代表可运行的引擎工程                                 |

代码预览和 ZIP 导出共用设计转换入口。新增参数时必须同时维护参数归一化、能力表、设计预览和目标输出。Godot 适配器目前对生成的运行时模板进行定点替换；修改模板时须同步适配器，后续可逐步改为生成器直接接收设计参数。

## 提高 AI 修改效率

- 提问时明确“目标模式 + 控件 + 预期行为 + 是否共享外观”，先按上表定位，不全仓库盲改。
- 调整填充、间距、字号等共用行为，只修改共用模块；目标模式的差异放在适配层或能力表。
- 新增字段按“类型与默认值 → 归一化/迁移 → 受控组件 → 预览与导出”顺序完成，避免多处独立保存同一属性。
- 不让 AI 重写整个导出工作区。限定模块和状态所有者，保留兼容转发直到调用方迁移结束。
- 需求涉及引擎时注明具体目标；不要把网页预览效果自动当作引擎支持能力。

可复用任务描述：

> 修改【模式/控件】的【行为】。共享行为从 EXPORT_INSPECTORS.md 指定模块修改，模式差异只改适配层。数据由【所有者】保存，预览和导出均读取该值。保留旧存档兼容，不复制颜色或渐变控件。当前不运行测试，由我自行验收。

## 验收边界

用户已要求停止测试，最终收尾后未再运行测试、构建或浏览器验收。此前局部自动检查不等于完整视频、网页、PPT 或游戏运行效果已验证；Godot、Ren’Py、TyranoScript 仍需在对应引擎中由用户验收。此前全量类型检查还有 7 项原有错误，位于 StoryNode 和 useMediaActions，不能视为全量类型检查通过。

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

| 目标                         | 当前设计参数的输出                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| Godot（兼容标识 `dialogic`） | 项目分辨率、原生运行时对话框布局、颜色、字体、选项及文本速度；设计参数写入故事数据   |
| Ren’Py                       | 项目分辨率、对话与选项 screen、颜色、字体和文本速度；圆角及复杂效果通过 PNG 皮肤输出 |
| TyranoScript                 | 对话框位置、尺寸、背景颜色与透明度、文本颜色、字号和速度；其余依赖宿主工程配置       |
| IR JSON                      | 保留设计参数供后续转换使用，不代表可运行的引擎工程                                   |

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

## 2026-09 界面与多层效果扩展

- 移除了导出工作区的“显示/隐藏参数说明”入口及读取旧偏好的逻辑。启用状态采用开关；折叠仍使用箭头。
- 音乐区统一为文件、试听、音量、淡入/淡出、循环，以及设置/存档页面是否沿用音乐。
- `shared/inspectors/AppearanceStackInspector.tsx` 是填充、描边、阴影列表的唯一编辑入口。每层支持启用、排序、删除；色彩和媒体弹窗复用原有编辑器。
- `shared/paint/appearance.ts` 定义 `SurfaceAppearance`。数组第一项位于最前；空数组表示无效果；仅字段不存在时读取旧单层配置。
- `SurfaceLayers.tsx` 负责网页、PPT 和代码设计器中的 DOM 装饰层；`appearanceCanvas.ts` 负责画布与静态皮肤合成；`appearanceRuntime.ts` 是独立网页导出运行时。
- `GeometryPopovers.tsx` 负责 Z 轴元素列表和四角编辑。Z 值越大越靠前；列表操作只写被移动元素，避免连续更新覆盖前一项。父容器仍决定子元素的层叠范围。
- 多层图片保留适应方式、缩放、偏移及旋转。原有独立图片元素仍由原来的图片素材编辑器负责替换。
- `experienceThemes.ts` 统一现有四套封面的配套配色、对话框、设置和存档页面样式。应用网页模板时补充同系列菜单页；PPT 补充对话外观；代码工作区新增同系列模板卡片。
- `code/design/packageGameInterface.ts` 把游戏界面装饰合成为 PNG 随项目打包。游戏逻辑、文字和操作控件仍使用引擎自身的实现。

图片清单、24 条提示词与绝对保存路径见 [UI_TEMPLATE_ART_PROMPTS.md](UI_TEMPLATE_ART_PROMPTS.md)。`public/web-homepage/page1/ui` 至 `page4/ui` 已准备目录说明和清单；它们不是已经生成的图片。用户生成后通过图片填充导入，避免自动覆盖正在编辑的主界面。

### 当前导出差异

- 网页使用 HTML 视频层播放视频；视频画布中的对话框填充按当前时间取帧。
- PPT 的复杂装饰会合成为 PNG；原生游戏皮肤也使用合成 PNG。两者的视频填充采用首帧。原生皮肤在控件边界外的阴影会被纹理边界裁切。
- 游戏模板沿用各引擎的页面/控件结构；TyranoScript 使用生成的对话框、选项和背景皮肤，主菜单与其他控件仍依赖宿主工程。当前设计器主要编辑画布、对话框、文字和选项，不是完整引擎场景编辑器。
- DOM 文字多层描边受浏览器文字描边属性限制；图形和面板使用独立装饰层。图层菜单遵循父子层叠关系，不能把一个子元素移动到其他父容器中。
- 按用户要求，本轮未运行测试、类型检查、构建或浏览器验收。以上是代码实现范围，不代表已通过完整运行验证。

引擎适配参考：[Godot StyleBoxTexture](https://docs.godotengine.org/en/stable/classes/class_styleboxtexture.html)、[Ren’Py screen/style properties](https://www.renpy.org/doc/html/style_properties.html)。

# 多结局 AI 写作软件启动动画

这套交付包含两个标准 Bodymovin/Lottie JSON 和一套可直接接入 React 的响应式启动层。真实软件界面应提前渲染在启动层下方；最终揭幕使用真实位移，不使用透明度交叉溶解。

## 文件

- `logo-animation.json`：1000×1000、60fps、87 帧（1450ms）。蓝点、淡扩散环、主干和分支 Trim Paths 生长、节点 overshoot、完整 Logo、二维正交推进。
- `wipe-animation.json`：1000×1000、60fps、93 帧（1550ms）。五圆下落、红色延迟、圆→胶囊→色幕、全覆盖停留、向上离场、顶部细线消失。
- `StartupSplash.jsx`：播放控制、ResizeObserver、DPR 变化、减少动画、sessionStorage、错误放行和销毁逻辑。
- `StartupSplash.css`：按容器实际尺寸绘制的自适应五色幕布。
- `AppExample.jsx`：最小接入示例。

## 安装与接入

```bash
npm install lottie-react@2.4.1 lottie-web@5.13.0
```

```jsx
import StartupSplash from './startup-splash/StartupSplash';

export default function App() {
  return (
    <>
      <RealApplication />
      <StartupSplash
        oncePerSession
        storageKey="branchwriter.startupSplash.played"
        onComplete={() => console.log('ready')}
      />
    </>
  );
}
```

默认一次浏览器会话只播放一次。开发时需要反复预览可传 `forcePlay`，或删除对应的 `sessionStorage` 键。`oncePerSession={false}` 会在每次组件挂载时播放。

## 为什么运行时幕布使用 CSS 几何

Logo 必须等比例缩放，幕布必须非等比例铺满任意窗口；这两者无法在一个固定比例的 Lottie 画布里同时严格满足。组件因此让 Logo Lottie 使用 `xMidYMid meet`，并让 `wipe-animation.json` 作为标准化可预览动画和 1550ms 播放时钟。实际可见幕布只使用 15 个轻量 DOM 容器，由同一时序驱动，颜色和形态与 JSON 对应。

这样能保证：

- 圆始终为正圆，Logo 线宽不会横向变形。
- 16:9、16:10、21:9、窄窗口和实时 resize 都不留白。
- resize 只更新几何数据，不会重播 Lottie。
- 超宽屏只把多出的宽度分配给最左青色和最右粉色幕布。

## 动画时间轴

| 全局时间 | Logo JSON | Wipe JSON / React 幕布 | 说明 |
| --- | --- | --- | --- |
| 0–250ms | 0–15f | — | 蓝点 0→110→96→100%，淡蓝环消失 |
| 250–650ms | 15–39f | — | 蓝色中心主干通过 Trim Paths 生长 |
| 650–1150ms | 39–69f | — | 上层弧形分支、五条结局分支和节点依次生成 |
| 1150–1450ms | 69–87f | — | 等比例二维推进；上层结构离开并淡出，只保留五个结局圆 |
| 1450–1850ms | 结束 | 0–24f | 五圆向下排列；红色延迟 100ms且起点略低 |
| 1850–2250ms | — | 24–48f | 圆→竖向胶囊→全高五色幕布 |
| 2250–2380ms | — | 48–56f | 色幕完全覆盖后短暂停留 |
| 2380–2880ms | — | 56–86f | 五幕从下向上离场；红色延迟 50ms |
| 2880–3000ms | — | 86–93f | 顶部 2px 彩色细线消失并卸载启动层 |

## 图层命名和结构

`logo-animation.json`：

- `CTRL__ORTHO_CAMERA`：只做等比 Scale + Position，不使用 3D Camera。
- `BG__WHITE`：独立白色背景，保证 JSON 单独预览时也从纯白画面开始。
- `FX__SOFT_BLUE_RING`：低透明度描边扩散环。
- `NODE__ROOT_BLUE`：顶部蓝色主圆。
- `BRANCH__*`：所有路径生长层；每层由 Path、Stroke、Trim Paths 组成。
- `NODE__UPPER_*`：两枚上层辅助节点，在推进阶段淡出。
- `NODE__ENDING_01_*` 至 `NODE__ENDING_05_*`：五个主要结局节点；红色层名包含 `DELAYED`。

`wipe-animation.json`：

- `CURTAIN__CYAN_22 / GREEN_18 / RED_18_DELAYED / ORANGE_18 / PINK_24`：连续圆角矩形尺寸变化和向上位移。
- `EDGE__*`：结束时的 2px 彩色顶部细线。
- Marker：`nodes-drop`、`circle-to-capsule-to-curtain`、`covered-hold`、`wipe-up`、`edge-line-out`。

## 响应式计算

`buildMetrics()` 在每次容器或 DPR 变化时计算：

- `logoSize`：`min(82vw, 90vh)`，限制在 220–920px，并始终做等比缩放。
- 五圆起始位置：由 Logo 末帧的归一化坐标换算为容器像素。
- 中间三块：稳定为安全宽度的 18%。
- 普通宽度：得到 22% / 18% / 18% / 18% / 24%。
- 超宽屏：多出的宽度仅按 22:24 分给左右两块，避免中心结构漂移。

## 减少动画与错误回退

当 `prefers-reduced-motion: reduce` 生效时，只显示一个单色蓝 Logo：150ms 淡入、约 150ms 停留、150ms 淡出，总时长 450ms。Lottie 数据或渲染失败、900ms 内未完成 DOM 初始化时，启动层立即卸载，真实界面不会被白屏遮住。

## 修改颜色、时长和延迟

### React 自适应幕布颜色

修改 `StartupSplash.jsx` 顶部的 `COLORS`。顺序固定为青、绿、红、橙、粉。若同时需要修改独立 Lottie 文件，搜索 JSON 中的 0–1 RGBA 数组：

- `#21BFD0` → `[0.1294,0.749,0.8157,1]`
- `#63D081` → `[0.3882,0.8157,0.5059,1]`
- `#EF3E43` → `[0.9373,0.2431,0.2627,1]`
- `#FF8A24` → `[1,0.5412,0.1412,1]`
- `#E83E82` → `[0.9098,0.2431,0.5098,1]`
- `#2338E8` → `[0.1373,0.2196,0.9098,1]`

### 时间

JSON 为 60fps，因此 `帧 = 毫秒 × 0.06`。调整总时长时，要同步修改：

1. JSON 的 `op`、相关属性关键帧 `t` 和 Marker 的 `tm/dr`。
2. JSX 的 `HANDOFF_AT`、`REVEAL_AT`、`NORMAL_DURATION`。
3. CSS 的 drop、morph、wipe 和 edge 动画时长/延迟。

红色下落延迟在 JSX 的 `--drop-delay: 100ms`；红色离场延迟由 `--wipe-delay: 980ms` 相对其他颜色的 `930ms` 形成。幕布宽度算法位于 `buildMetrics()`。

## 兼容性与性能

- JSON schema/export target：Bodymovin/Lottie 5.12.x。
- 支持并建议：`lottie-react 2.4.1`，其依赖 `lottie-web ^5.10.2`；本交付锁定验证目标为 `lottie-web 5.13.0`。
- React：18 或 19。
- SVG renderer；无图片、视频、字体、表达式、3D、模糊、粒子或外部资源。
- 两个 JSON 合计远低于 300KB，完成后显式销毁播放器并卸载 DOM。

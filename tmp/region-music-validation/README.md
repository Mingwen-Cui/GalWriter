# 区域背景音乐测试记录

2026-10-06，使用独立测试故事和合成音源，未修改用户当前项目。

## 已修复

- 同一区域连续卡片保持同一首音乐；快速 A → B → A 不再被旧淡出回调切到 B。
- 在目标区域继续换卡不会反复延长上一首音乐的淡出时间。
- 非循环音乐自然结束后，不会因为换卡重新播放。
- 单视频的区域 BGM 自动显示在音频轨中，连续和重叠卡片合并，避免配音造成音乐每卡重启或重复叠加。
- 时间轴预览保留音乐音量、循环和淡入淡出；短音乐的淡入淡出不会产生无效音量曲线。
- PPTX 嵌入区域 BGM，修复音频引用及对象编号冲突。导出窗口显示多音轨、交互分支和淡入淡出限制。
- MCP 指定剧情路径导出时保留相应的音乐背景卡片，避免区域 BGM 丢失。

## 验证结果

- 27 项自动回归测试全部通过。
- 18 项浏览器检查全部通过，详情见 `results.json`。
- 实际生成 `region-music.mp4`：解码 AAC 音频，确认第二张卡片处音乐不重启，第 4 秒离开区域后音频静音。
- 实际生成并运行 `region-music-web.zip`：使用真实 HTMLAudioElement，确认相邻卡片音乐连续，区域外停止。
- 实际生成 `region-music.pptx`：检查嵌入媒体、循环、音量、自动播放和跨两页范围。修正后的文件在本机 PowerPoint 中正常打开并完成三页放映，无文件修复提示。
- 本机 PowerPoint 的音乐跨页连续性、停止边界和两首 BGM 同时播放效果尚未做声音录制验证；导出时已有兼容性提示。正常打开和完成放映仅确认文件结构可用。
- TypeScript 检查仍被既有的 `src/components/render/ppt/pptCoverDesign.ts:35` 阻挡：`circle` 不符合形状类型。当前音乐改动没有新增类型错误。

## 播放规则与限制

- 网页和剧情播放在离开区域时开始按设置淡出；淡出大于 0 时，音乐在区域外仍会短暂延续。不循环且音源较短时，音乐会在卡片结束前自然结束。
- 视频可以预先确定区域结束时间，淡出在区域片段结束前完成；设置淡出为 0 时，音频在区域边界截断。
- PPT 线性模式跨连续区域页面播放；交互模式每页重新播放，在离开该页时停止，避免分支跳转后音乐串区。PPT 导出暂不保留 BGM 淡入淡出，也不导出卡片独立音频和场景环境音。
- 本次修改在源码中，未重新打包桌面安装程序。

## 复测

```powershell
node --import tsx --test tests/region-music.test.ts tests/ppt-export-order.test.ts tests/ppt-transitions.test.ts tests/ppt-text-build.test.ts tests/web-export-flow.test.ts tests/web-export-scope.test.ts
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 3011 --strictPort
node tests/run-region-music-runtime.mjs
```

浏览器测试需要 Playwright 和 Edge；可使用本机安装的 Playwright，或通过 `CODEX_NODE_MODULES` 指向包含 Playwright 的运行时目录。

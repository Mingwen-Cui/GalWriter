# 预设音乐目录

请把要内置的预设背景音乐放在这个目录：

`public/presets/music/`

建议使用 `.mp3`（网页试玩、导出与桌面端兼容性最好）。文件名请使用英文小写、数字和连字符，例如：

```text
rainy-platform.mp3
garden-afternoon.mp3
city-night.mp3
```

音乐文件放好后，音乐库会通过预设清单显示名称、情绪标签与试听信息；音频本身不需要再复制到其他目录。

在 `manifest.json` 的 `tracks` 中为每首音乐增加一项即可，例如：

```json
{
  "id": "rainy-platform",
  "name": "雨夜车站",
  "file": "rainy-platform.mp3",
  "tags": ["雨夜", "悬疑"],
  "loop": true,
  "volume": 0.5
}
```

# 樱花校园：AI 图片提示词

复制提示词后，只在最后的“用户内容”一行补充故事主题、人物、场景等具体内容。

```text
Create a polished 16:9 visual-novel game cover layout in a warm Japanese anime illustration style. Build it as separable compositing layers, not a flattened poster. Reserve the left 42% of the canvas as a quiet, high-contrast title and menu safe area. Keep the main subject on the right half, avoid covering the lower-left menu safe area, use soft spring daylight, pale pink blossoms, gentle depth of field, and elegant light particles. No text, no letters, no logo, no watermark, no UI buttons, no signage with readable words. Deliver a clean cinematic background with room for editable typography and controls. User content: [describe your story here]
```

建议分别生成并放入：

- `layers/01-background.png`：校园、窗景、远处樱花与光线；不要人物与文字。
- `layers/02-character.png`：右侧人物的透明 PNG；人物不进入左侧安全区。
- `layers/03-decoration.png`：花瓣、信封、柔光等透明 PNG。
- `preview/preview.png`：由图层合成后的无文字缩略图。

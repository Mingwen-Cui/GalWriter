# 雨夜列车：AI 图片提示词

```text
Create a polished 16:9 visual-novel game cover layout in a cinematic dark-blue anime illustration style. Build it as separable compositing layers, not a flattened poster. Reserve the right 38% of the canvas as a quiet, high-contrast title and vertical menu safe area. Place the main character on the left third with a rainy train platform and receding train in the middle distance. Use wet reflective pavement, controlled cyan rim light, subtle red signal accents, and atmospheric rain. No text, no numbers, no clock, no logo, no watermark, no UI buttons, no readable signage. Keep the safe area free for editable typography and controls. User content: [describe your story here]
```

建议分别生成并放入：

- `layers/01-background.png`：雨夜站台、列车、城市灯光；不含人物、文字与可读标识。
- `layers/02-character.png`：左侧人物透明 PNG。
- `layers/03-decoration.png`：雨丝、界面线条、光点等透明 PNG。
- `preview/preview.png`：由图层合成后的无文字缩略图。

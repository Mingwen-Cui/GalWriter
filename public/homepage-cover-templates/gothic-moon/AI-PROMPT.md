# 哥特月夜：AI 图片提示词

```text
Create a polished 16:9 visual-novel game cover layout in a refined dark gothic anime illustration style. Build it as separable compositing layers, not a flattened poster. Reserve the center-right 40% as a clean title and vertical menu safe area framed by elegant but non-text decorative borders. Place the main subject on the left third, with a moonlit cathedral or palace interior behind them. Use deep navy, black, wine-red accents, silver moonlight, roses, candlelight, velvet curtains, and ornate metallic framing. No text, no letters, no logo, no watermark, no UI buttons, no readable symbols. Preserve clean room for editable typography and controls. User content: [describe your story here]
```

建议分别生成并放入：

- `layers/01-background.png`：月夜建筑、窗景、帷幕、烛光；不要人物与文字。
- `layers/02-character.png`：左侧人物透明 PNG。
- `layers/03-decoration.png`：玫瑰、银色边框、星点等透明 PNG。
- `preview/preview.png`：由图层合成后的无文字缩略图。

# 深海科幻：AI 图片提示词

```text
Create a polished 16:9 visual-novel game cover layout in a luminous underwater science-fiction anime illustration style. Build it as separable compositing layers, not a flattened poster. Reserve the lower 24% as a clean horizontal menu safe area and the left 28% as a high-contrast vertical title safe area. Place the main subject on the right third inside a futuristic underwater observation room, with deep-sea city lights, jellyfish, distant machinery, and blue-violet luminous water outside the window. Use layered glass reflections and restrained holographic decoration without readable information. No text, no letters, no logo, no watermark, no UI buttons, no readable interface. Preserve empty space for editable typography and controls. User content: [describe your story here]
```

建议分别生成并放入：

- `layers/01-background.png`：深海城市、舷窗、远景与环境光；不要人物与文字。
- `layers/02-character.png`：右侧人物透明 PNG。
- `layers/03-decoration.png`：水母、玻璃反光、非文字 HUD 装饰等透明 PNG。
- `preview/preview.png`：由图层合成后的无文字缩略图。

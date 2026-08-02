# Settings visualization design QA

- Source visual truth: `C:\Users\cui_m\AppData\Local\Temp\codex-clipboard-67180da2-3573-45d9-8430-09f16c4b1ef8.png` for the real card/toolbar proportions, `C:\Users\cui_m\AppData\Local\Temp\codex-clipboard-9385a011-1642-4d9e-bb04-a90985a5861b.png` for the copy-free direction preview, `C:\Users\cui_m\AppData\Local\Temp\codex-clipboard-de40ea5e-dc7d-4479-91ce-82058569bd59.png` with the instruction to remove direction-switch animation and reduce the cards further, and the user-supplied real toolbar DOM in `C:\Users\cui_m\.codex\attachments\24fc164b-ab04-4c0b-a34b-a8cda21eeb68\pasted-text.txt`
- Implementation screenshots: `settings-toolbar-scale-preview.png` and `settings-direction-preview.png`
- Combined comparison: `settings-design-comparison.png`
- Browser viewport: 1280 x 720 CSS px, device scale factor 1
- Source pixels: 855 x 1118 for the proportion target, 973 x 649 for the copy-removal state, and 984 x 652 for the smaller/no-animation direction state
- Implementation pixels: 1280 x 720
- State: Chinese, dark theme, Editor settings, toolbar scale 1.00x; direction verified in up, down, left, and right states
- Density normalization: geometry was compared by ratios because the source captures use different viewport/DPI crops. The implementation card is 360 x 216 CSS px and the toolbar is 411.84 px wide at 1.00x, preserving the source toolbar/card width ratio of approximately 1.14.

## Findings

No actionable P0, P1, or P2 issues remain.

- Fonts and typography: Existing application fonts, weights, and token-driven hierarchy are preserved. Small toolbar labels remain readable at the preview scale.
- Spacing and layout rhythm: Toolbar scale and generation direction are separate settings. The scale control and preview canvas are separate sibling surfaces; the preview now spans the full settings width. The toolbar preview uses the real StoryNode formula (`0.6 * cardToolbarScale`) and enlarges both the card and toolbar by the same 1.2 display factor. The direction preview remains an independent fixed 0.50x canvas internally. Its visible vertical cards are now 220 x 110 CSS px and horizontal cards are 120 x 110 CSS px, leaving more whitespace around the relationship.
- Colors and visual tokens: The implementation uses the existing toolbar, card, border, text, accent, success, and danger tokens. The dark implementation versus light reference is an intentional theme-state difference.
- Image and asset fidelity: There are no raster assets in this UI. Icons use the project's existing Lucide icon system, and the colored controls match the supplied real toolbar DOM.
- Copy and content: The two repeated explanatory paragraphs were removed. The toolbar-scale preview retains realistic story content. The direction preview contains no title, body, badge, or scale label; only the two cards and connector arrow remain. Direction-button labels remain because they are the actual controls.

## Focused comparison evidence

`settings-design-comparison.png` places the latest oversized-card reference and the rendered smaller left-direction implementation in one image. It confirms that both cards are reduced, the connector remains centered, and the four direction controls remain available. `settings-toolbar-scale-preview.png` provides the focused evidence for the corrected 1.14 toolbar/card width relationship.

## Interaction and runtime checks

- Direction buttons were exercised in the browser for up, down, left, and right. Every state updates immediately, and the selected card, connector, and destination card all report computed `transition-duration: 0s`.
- Measured rendered card sizes are 220 x 110 CSS px in vertical states and 120 x 110 CSS px in horizontal states. The horizontal connector is 70 CSS px wide and the vertical connector is 60 CSS px high.
- The direction canvas remains fixed at 0.50x internally and independent of the toolbar scale control; the user-facing `0.50x` badge was removed.
- The native range control and live toolbar are present; automated pointer/keyboard changes to the range were not reliably synthesized by the in-app browser, so range movement remains a residual manual test gap. The underlying React change handler is retained from the existing implementation.
- Browser console checked after the final render: no errors.
- TypeScript check: passed with `tsc --noEmit`.

## Comparison history

1. P2: toolbar scale and generation direction were combined into one preview, which mixed two unrelated values. Fixed by splitting them into two independent bordered settings and making the direction preview a fixed 0.50x canvas.
2. P2: the horizontal connector was hidden under adjacent cards. Fixed by reducing the horizontal card width, increasing the gap, and raising the connector layer. Post-fix evidence is in `settings-direction-preview.png`.
3. P2: the slider and live canvas shared one bordered surface, limiting the canvas width. Fixed by separating them into sibling surfaces, expanding the canvas across the settings width, and replacing the plain native track with a token-colored progress track, tick marks, and a synchronized thumb.
4. P1: the toolbar preview used a 610px base toolbar against a 76%-wide, 144px-tall card, producing a visibly flatter card and the wrong toolbar/card ratio. Fixed by using the measured StoryNode toolbar base width (572px), the real `0.6 * cardToolbarScale` factor, and a proportionally enlarged 360 x 216 card. Post-fix toolbar/card width ratio is 1.14 at 1.00x, matching the visual target.
5. P2: the direction preview added scale, title, body, and start-badge copy even though the user wanted a pure spatial preview. Removed all preview text and badges. Post-fix evidence in `settings-direction-preview.png` shows only cards and the arrow.
6. P2: direction changes still animated between layouts and the cards remained visually heavy. Removed transition classes from both cards, the connector, and the four selector buttons. Reduced the virtual cards from 520 x 260 / 300 x 260 to 440 x 220 / 240 x 220 before the fixed 0.50x preview scale, then rebalanced connector lengths and card offsets. Post-fix browser measurements confirm `0s` transitions in all four states.

## Follow-up polish

- P3: Manually drag the native range once in the packaged desktop app to confirm the exact feel at the 0.50x and 3.00x extremes.

final result: passed

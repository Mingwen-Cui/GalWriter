# Code workspace readability design QA

- Diagnostic source: `C:\Users\cui_m\AppData\Local\Temp\codex-clipboard-4bbf7a64-bef2-4110-a45d-d119ee4d223c.png`
- Long-file background source: `C:\Users\cui_m\AppData\Local\Temp\codex-clipboard-81bed7c4-661b-40ac-87f8-b104395fb402.png`
- Revised diagnostics: `C:\Users\cui_m\AppData\Local\Temp\galwriter-diagnostics-readable.png`
- Revised long-file code preview: `C:\Users\cui_m\AppData\Local\Temp\galwriter-code-highlight-long-file.png`
- Viewport: 1280 × 720
- State: Godot Dialogic 2 diagnostics and scrolled `galwriter_project.ir.json`; application dark theme

## Full-view comparison evidence

The original diagnostic cards used pale yellow text on a pale yellow surface, making all three messages difficult to read. The revised view preserves the workspace layout while using theme foreground text for message content, semantic blue/amber/red accents for status, and compact localized level badges. The original long JSON screenshot also exposed a light workspace background below the first viewport; the revised scrolled capture remains dark for the complete file.

## Focused comparison evidence

- Diagnostic text is now 13px/20px medium-weight theme text, with a separate icon and level badge.
- Info, warning, and error states use distinct borders, subtle tinted surfaces, and high-contrast body text.
- Generated code has persistent line numbers and separate colors for comments, keywords, labels, strings, numbers, variables, operators, and engine tags.
- Ren’Py, TyranoScript, Dialogic, JSON, and Markdown receive target/path-aware tokenization without `innerHTML`.

## Required fidelity surfaces

- Fonts and typography: UI copy uses the existing product font; code uses the existing monospace stack with 12px text and 24px line height.
- Spacing and layout rhythm: diagnostic cards keep the original width and vertical rhythm while introducing a consistent icon/content grid.
- Colors and visual tokens: body copy uses `--vr-text`; semantic colors are mixed with theme surfaces so light and dark themes retain contrast.
- Image quality and asset fidelity: no new raster assets were needed; diagnostic icons come from the product's existing Lucide dependency.
- Copy and content: support diagnostics are localized through the code-workspace i18n keys instead of displaying backend English.

## Interaction and runtime checks

- Ren’Py, TyranoScript, and Dialogic previews all render colored syntax tokens.
- A long JSON file was scrolled beyond the initial viewport; the editor background remained `#10151f`.
- Dialogic diagnostics display localized, readable info and warning states.
- The generated-file status was replaced by a localized copy button; clicking it changes the state to `已复制`.
- Code mode shows undo and redo immediately to the left of the top export button.
- Selecting code opens a localized edit menu; copy is active while cut and paste clearly remain disabled for generated read-only files.
- No `dangerouslySetInnerHTML` or raw HTML token rendering is used.
- Browser console errors: none during the visual pass.

## Comparison history

1. P1: pale yellow diagnostic text had insufficient contrast on the light theme.
2. Fix: moved semantic color to borders/icons/badges and restored theme foreground color for message text.
3. P1: the dark code background ended after one viewport because the wrapper used fixed `h-full` while content overflowed.
4. Fix: changed the editor wrapper to content-growing `min-h-full min-w-full` and verified it after scrolling.
5. P2: code preview was monochrome.
6. Fix: introduced safe target-aware tokenization, line numbers, and a consistent editor palette.

## Findings

No actionable P0, P1, or P2 findings remain.

Final result: passed

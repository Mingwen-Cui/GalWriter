# Code engine bookmark UI design QA

- Reference: `C:\Users\cui_m\AppData\Local\Temp\codex-clipboard-5a66426b-5df8-44ad-a7b7-45db9a8a4802.png`
- Additional context: `C:\Users\cui_m\AppData\Local\Temp\codex-clipboard-044ad926-22e1-40b3-8227-e24a61aff5c1.png`
- Implementation screenshot: `C:\Users\cui_m\AppData\Local\Temp\galwriter-code-engine-bookmarks.png`
- Viewport: 1280 × 720
- State: code workspace, Ren’Py selected; dark application theme

## Comparison

The engine switcher uses the reference's raised bookmark silhouette: the selected tab is taller, has rounded upper corners, an accent outline, and joins the content edge. Inactive targets sit lower with muted labels. The control is placed in the first `RenderHeader` row immediately after the fullscreen button, as requested. The separate code-project title row and the standalone GalWriter IR JSON tab are absent.

## Interaction checks

- Exactly three ARIA tabs are present.
- Ren’Py is selected initially.
- Clicking TyranoScript updates `aria-selected` and changes the project tree to `.ks` output.
- Clicking Ren’Py restores the Ren’Py file tree.
- Chinese engine-switcher label and all three engine names come from code-workspace i18n resources.

## Iteration history

1. Replaced the native four-option select with raised tabs.
2. Removed the redundant code-project title bar.
3. Moved the three engine bookmarks from the code ribbon to the first `RenderHeader` row, directly after fullscreen.
4. Restored corrupted English, Chinese, and Japanese code-workspace locale entries as valid UTF-8.

Final result: passed

# Code engine bookmark UI design QA

- Source visual truth: `C:\Users\cui_m\AppData\Local\Temp\codex-clipboard-095d4305-acc8-4438-8944-538121258d62.png`
- Supporting bookmark reference: `C:\Users\cui_m\AppData\Local\Temp\codex-clipboard-5a66426b-5df8-44ad-a7b7-45db9a8a4802.png`
- Implementation screenshot: `C:\Users\cui_m\AppData\Local\Temp\galwriter-code-tabs-ppt-curve.png`
- Viewport: 1280 × 720
- State: code workspace, Ren’Py selected, application dark theme

## Full-view comparison evidence

The engine selector occupies the first `RenderHeader` row immediately after fullscreen, with the primary export action remaining at the far right. The redundant second-row export button is absent. Workspace navigation and settings remain on the second row, matching the requested hierarchy.

## Focused comparison evidence

The implementation now reuses the same `render-context-tabs` and `render-context-tab` structure as the PPT three-button control. The selected engine uses the shared taller tab, rounded upper corners, open lower edge, and curved side transitions. Inactive engines sit lower with muted labels. The reference is light theme while the captured project state is dark theme; geometry and interaction are shared, while colors intentionally follow existing application tokens.

## Required fidelity surfaces

- Fonts and typography: existing workspace font, 11px bold tab labels, consistent weight and line height.
- Spacing and layout rhythm: shared PPT tab height, side curves, zero-gap grouping, and first-row alignment are preserved.
- Colors and visual tokens: no hard-coded light-theme colors; tabs use `--vr-*` and shared render-context tokens.
- Image quality and asset fidelity: no raster assets are required for this native application control; existing Lucide product icons remain unchanged.
- Copy and content: exactly Ren’Py, TyranoScript, and Godot Dialogic 2; all labels and capability descriptions come from code-workspace i18n resources.

## Interaction and runtime checks

- Exactly three ARIA tabs are present.
- Clicking TyranoScript changes `aria-selected` and updates the generated project/capability content.
- Exactly one top-level `导出` button is present.
- No `导出工程` button remains.
- Browser console errors: none.

## Comparison history

1. P2: the first implementation hand-built a rounded rectangle and did not share the PPT curved-tab structure.
2. Fix: replaced the custom Tailwind silhouette with the shared `render-context-tabs` / `render-context-tab` implementation and added only a code-workspace token modifier.
3. Post-fix evidence: the selected tab now has the same curved side joins and open workspace seam as PPT; duplicate export count is zero.

## Findings

No actionable P0, P1, or P2 findings remain.

Final result: passed

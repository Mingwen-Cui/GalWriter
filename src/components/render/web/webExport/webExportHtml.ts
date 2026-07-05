export const makeIndexHtml = (
  title: string,
  language: string,
  faviconPath: string,
) => `<!doctype html>
<html lang="${language === 'zh' ? 'zh-CN' : language === 'ja' ? 'ja' : 'en'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <link rel="icon" href="${escapeHtml(faviconPath)}" />
  <script src="./content.js"></script>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: #10131a;
      color: #f8fafc;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    button { font: inherit; }
    .app {
      width: 100vw;
      height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr;
      overflow: hidden;
      background:
        linear-gradient(180deg, rgba(15, 23, 42, 0.20), rgba(15, 23, 42, 0.84)),
        #10131a;
    }
    .app.immersive header {
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      z-index: 5;
      // border-bottom: 0;
      // background: linear-gradient(180deg, rgba(0,0,0,0.72), rgba(0,0,0,0.34), transparent);
      // box-shadow: 0 16px 40px rgba(0,0,0,0.28);
    }
    .app.controls-hidden header {
      opacity: 0;
      pointer-events: none;
    }
    header {
      min-height: 56px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 18px;
      // border-bottom: 1px solid rgba(255,255,255,0.12);
      // background: rgba(10, 13, 20, 0.52);
      // backdrop-filter: blur(16px);
      transition: opacity 180ms ease;
    }
    h1 {
      min-width: 0;
      margin: 0;
      overflow: hidden;
      color: #f8fafc;
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 0;
      text-overflow: ellipsis;
      text-shadow: 0 2px 12px rgba(0,0,0,0.72);
      white-space: nowrap;
    }
    .toolbar { margin-left: auto; display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
    .tool {
      border: 1px solid rgba(255,255,255,0.16);
      background: rgba(255,255,255,0.08);
      color: #f8fafc;
      border-radius: 8px;
      padding: 8px 11px;
      cursor: pointer;
      min-height: 38px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      text-decoration: none;
    }
    .tool img { width: 18px; height: 18px; display: block; }
    .tool:disabled { opacity: 0.4; cursor: not-allowed; }
    .playlist-wrap { position: relative; }
    .playlist-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: none;
      place-items: center;
      padding: 24px 16px;
      background: rgba(0,0,0,0.42);
      backdrop-filter: blur(4px);
    }
    .playlist-backdrop.open { display: grid; }
    .playlist-panel {
      width: min(512px, calc(100vw - 32px));
      height: min(416px, calc(100vh - 64px));
      display: flex;
      flex-direction: column;
      padding: 16px;
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 16px;
      background: rgba(8, 12, 20, 0.94);
      box-shadow: 0 24px 70px rgba(0,0,0,0.5);
      backdrop-filter: blur(18px);
    }
    .playlist-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 10px;
    }
    .playlist-title { font-size: 14px; font-weight: 900; }
    .playlist-hint { margin-top: 3px; color: rgba(255,255,255,0.46); font-size: 11px; }
    .playlist-close {
      width: 30px;
      height: 30px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: rgba(255,255,255,0.64);
      cursor: pointer;
    }
    .playlist-close:hover { background: rgba(255,255,255,0.1); color: #fff; }
    .playlist-items { min-height: 0; flex: 1; overflow-y: auto; display: grid; align-content: start; gap: 8px; }
    .playlist-empty {
      height: 100%;
      display: grid;
      place-items: center;
      padding: 24px;
      border: 1px dashed rgba(255,255,255,0.16);
      border-radius: 12px;
      color: rgba(255,255,255,0.42);
      font-size: 12px;
      text-align: center;
    }
    .playlist-item {
      min-height: 56px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      background: rgba(255,255,255,0.05);
    }
    .playlist-item.active { border-color: rgba(56,189,248,0.5); background: rgba(14,165,233,0.15); }
    .playlist-name {
      min-width: 0;
      flex: 1;
      overflow: hidden;
      text-align: center;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
    }
    .playlist-play {
      width: 36px;
      height: 36px;
      flex: 0 0 auto;
      border: 0;
      border-radius: 999px;
      background: #0ea5e9;
      color: #fff;
      cursor: pointer;
      font-size: 15px;
    }
    .playlist-play:hover { background: #38bdf8; }
    main {
      position: relative;
      min-height: 0;
      display: grid;
      place-items: center;
      padding: 0;
      overflow: hidden;
    }
    .app.immersive main {
      padding: 0;
    }
    .backdrop {
      position: absolute;
      inset: 0;
      background-position: center;
      background-size: cover;
      opacity: 0.72;
      transition: background-image 180ms ease, opacity 180ms ease;
    }
    .backdrop::after {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(8,11,18,0.25), rgba(8,11,18,0.72));
    }
    .app.immersive .backdrop { display: none; }
    .stage {
      position: relative;
      isolation: isolate;
      z-index: 1;
      width: 100%;
      height: 100%;
      max-height: none;
      display: grid;
      grid-template-rows: minmax(0, 1fr) auto;
      border: 0;
      background: transparent;
      border-radius: 0;
      overflow: hidden;
      box-shadow: none;
      backdrop-filter: blur(18px);
    }
    .app.immersive .stage {
      display: block;
      width: 100%;
      height: 100vh;
      max-height: 100vh;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      backdrop-filter: none;
    }
    .app.immersive .media {
      position: absolute;
      inset: 0;
      z-index: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      border: 0;
      border-radius: 0;
      background: transparent;
    }
    .media {
      position: relative;
      min-height: 0;
      z-index: 0;
      width: fit-content;
      height: fit-content;
      max-width: calc(100% - clamp(28px, 5vw, 48px));
      max-height: calc(100% - clamp(28px, 5vw, 48px));
      place-self: center;
      display: inline-grid;
      place-items: center;
      margin: 0;
      background: rgba(0,0,0,0.24);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px;
      overflow: hidden;
    }
    .presentation-scale {
      position: relative;
      display: inline-grid;
      place-items: center;
      transform-origin: center;
    }
    .app.immersive .presentation-scale {
      width: 100%;
      height: 100%;
    }
    .scene-image {
      position: relative;
      z-index: 1;
      display: block;
      width: auto;
      height: auto;
      max-width: min(100%, calc(100vw - clamp(28px, 5vw, 48px)));
      max-height: calc(100vh - 220px);
      object-fit: contain;
    }
    .presentation-scale > video {
      position: relative;
      z-index: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }
    .app.immersive .scene-image,
    .app.immersive .presentation-scale > video {
      width: 100%;
      height: 100%;
      max-width: none;
      max-height: none;
      object-fit: contain;
    }
    .media.empty { color: rgba(248,250,252,0.42); font-weight: 700; }
    .characters-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 2;
      overflow: hidden;
    }
    .character-img {
      position: absolute;
      max-height: 92%;
      max-width: 72%;
      width: auto;
      object-fit: contain;
      object-position: bottom;
      transform-origin: center center;
    }
    .nameplate-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 8;
      overflow: visible;
    }
    .nameplate-layer.inside {
      position: relative;
      inset: auto;
      min-height: var(--nameplate-row-height, 42px);
      margin-bottom: var(--nameplate-text-gap, 8px);
    }
    .nameplate {
      position: absolute;
      top: var(--nameplate-top, 0);
      max-width: min(44%, 220px);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: var(--nameplate-padding-y, 8px) var(--nameplate-padding-x, 18px);
      border-radius: var(--nameplate-radius, 14px);
      background: var(--nameplate-background, rgba(79, 70, 229, 0.86));
      color: var(--nameplate-color, #fff);
      font-family: var(--nameplate-font-family, var(--title-font-family, sans-serif));
      font-size: var(--nameplate-font-size, 18px);
      font-weight: 800;
      line-height: 1;
      box-shadow: 0 10px 24px rgba(0,0,0,0.24);
      text-shadow: 0 1px 8px rgba(0,0,0,0.32);
      transform: translate(calc(-50% + var(--nameplate-offset-x, 0px)), var(--nameplate-translate-y, -100%));
    }
    .nameplate-layer.inside .nameplate {
      background: transparent;
      box-shadow: none;
      text-shadow: 0 1px 10px rgba(0,0,0,0.42);
      transform: translate(calc(-50% + var(--nameplate-offset-x, 0px)), var(--nameplate-offset-y, 0px));
    }
    .dialogue {
      position: relative;
      z-index: 3;
      justify-self: center;
      width: min(var(--dialog-width, 86%), 100%);
      display: block;
      border-top: 1px solid var(--dialog-border-color, rgba(255,255,255,0.14));
      height: auto;
      max-height: min(var(--dialog-height, 34vh), 420px);
      padding: clamp(14px, 2.5vw, 20px) var(--dialog-padding-x, 9%);
      background: var(--dialog-background, rgba(7, 10, 16, 0.82));
      border-radius: var(--dialog-radius, 12px);
      box-shadow: var(--dialog-shadow, 0 -14px 36px rgba(0,0,0,0.18));
      backdrop-filter: var(--dialog-backdrop-filter, none);
      overflow: auto;
    }
    .app.immersive .dialogue {
      position: absolute;
      left: var(--dialog-left, 50%);
      bottom: var(--dialog-bottom, clamp(14px, 3vh, 24px));
      z-index: 4;
      margin: 0;
      width: min(var(--dialog-width, 86%), calc(100% - 24px));
      max-height: min(var(--dialog-height, 34%), calc(100% - 96px));
      padding: clamp(14px, 2.5vw, 20px) var(--dialog-padding-x, 9%);
      transform: translateX(-50%);
      border: 1px solid var(--dialog-border-color, rgba(255,255,255,0.12));
      border-radius: var(--dialog-radius, 12px);
      background: var(--dialog-background, rgba(7, 10, 16, 0.82));
      box-shadow: var(--dialog-shadow, 0 24px 80px rgba(0,0,0,0.30));
      backdrop-filter: var(--dialog-backdrop-filter, blur(18px));
    }
    .title {
      margin: 0 0 8px;
      color: var(--title-color, #f8fafc);
      font-size: var(--title-size, 18px);
      font-family: var(--title-font-family, inherit);
      font-weight: 900;
      line-height: var(--title-line-height, 1.18);
      letter-spacing: var(--title-letter-spacing, 0px);
      text-align: var(--title-align, left);
      -webkit-text-stroke: var(--title-stroke, 0 transparent);
      overflow-wrap: anywhere;
    }
    .text {
      color: var(--body-color, #e5e7eb);
      font-family: var(--body-font-family, inherit);
      line-height: var(--body-line-height, 1.55);
      font-size: var(--body-size, 16px);
      letter-spacing: var(--body-letter-spacing, 0px);
      text-align: var(--body-align, left);
      -webkit-text-stroke: var(--body-stroke, 0 transparent);
      overflow-wrap: anywhere;
    }
    .text.typewriter-reserved { position: relative; }
    .typewriter-placeholder {
      display: block;
      visibility: hidden;
      white-space: pre-wrap;
    }
    .typewriter-visible {
      position: absolute;
      inset: 0;
      display: block;
      white-space: pre-wrap;
    }
    .zen-toggle {
      position: absolute;
      right: 24px;
      bottom: var(--zen-toggle-bottom, 24px);
      z-index: 18;
      width: 44px;
      height: 44px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(0,0,0,0.44);
      color: #f8fafc;
      box-shadow: 0 18px 48px rgba(0,0,0,0.28);
      backdrop-filter: blur(14px);
      cursor: pointer;
      transition: background 140ms ease, border-color 140ms ease;
    }
    .zen-toggle:hover { background: rgba(0,0,0,0.62); }
    .zen-toggle img { width: 20px; height: 20px; display: block; margin: auto; }
    .text :first-child { margin-top: 0; }
    .text :last-child { margin-bottom: 0; }
    .choices {
      display: grid;
      position: relative;
      z-index: 4;
      gap: 10px;
      margin-top: 18px;
    }
    .choices.above { margin-bottom: 14px; margin-top: 0; }
    .choices.center {
      position: absolute;
      left: 50%;
      top: 50%;
      z-index: 8;
      width: min(520px, calc(100% - 32px));
      max-height: min(62vh, 420px);
      transform: translate(-50%, -50%);
      margin: 0;
    }
    .choice {
      width: 100%;
      border: 1px solid color-mix(in srgb, var(--choice-color, #0ea5e9), white 25%);
      background: color-mix(in srgb, var(--choice-color, #0ea5e9), transparent 20%);
      color: var(--choice-text-color, #ffffff);
      border-radius: 8px;
      padding: 12px 14px;
      text-align: left;
      line-height: 1.35;
      cursor: pointer;
      transition: background 140ms ease, border-color 140ms ease;
    }
    .choice:hover {
      background: color-mix(in srgb, var(--choice-color, #0ea5e9), transparent 68%);
      border-color: color-mix(in srgb, var(--choice-color, #0ea5e9), white 52%);
    }
    .anim-fade { animation: fadeIn 360ms ease both; }
    .anim-slideUp { animation: slideUp 360ms ease both; }
    .anim-typewriter { animation: fadeIn 180ms ease both; }
    .inline-shake-x { animation: inlineShakeX var(--inline-action-step-duration, 400ms) ease var(--inline-action-count, 1) both; }
    .inline-shake-y { animation: inlineShakeY var(--inline-action-step-duration, 400ms) ease var(--inline-action-count, 1) both; }
    .inline-pulse { animation: inlinePulse var(--inline-action-step-duration, 400ms) ease var(--inline-action-count, 1) both; }
    .inline-rotate { animation: inlineRotate var(--inline-action-duration, 400ms) ease both; }
    .inline-opacity { animation: inlineOpacity var(--inline-action-duration, 400ms) ease both; }
    .inline-brightness { animation: inlineBrightness var(--inline-action-duration, 400ms) ease both; }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes inlineShakeX {
      0%, 100% { translate: 0 0; }
      20% { translate: calc(var(--inline-action-strength, 14px) * -1) 0; }
      40% { translate: var(--inline-action-strength, 14px) 0; }
      60% { translate: calc(var(--inline-action-strength, 14px) * -0.7) 0; }
      80% { translate: calc(var(--inline-action-strength, 14px) * 0.7) 0; }
    }
    @keyframes inlineShakeY {
      0%, 100% { translate: 0 0; }
      20% { translate: 0 calc(var(--inline-action-strength, 14px) * -1); }
      40% { translate: 0 var(--inline-action-strength, 14px); }
      60% { translate: 0 calc(var(--inline-action-strength, 14px) * -0.7); }
      80% { translate: 0 calc(var(--inline-action-strength, 14px) * 0.7); }
    }
    @keyframes inlinePulse {
      0%, 100% { scale: 1; }
      50% { scale: var(--inline-action-scale, 1.08); }
    }
    @keyframes inlineRotate {
      0% { rotate: 0deg; }
      45% { rotate: var(--inline-action-rotation, 12deg); }
      72% { rotate: calc(var(--inline-action-rotation, 12deg) * -0.65); }
      100% { rotate: var(--inline-action-rotation, 12deg); }
    }
    @keyframes inlineOpacity {
      0% { opacity: 1; }
      100% { opacity: var(--inline-action-opacity, 0.45); }
    }
    @keyframes inlineBrightness {
      0% { filter: brightness(1); }
      100% { filter: brightness(var(--inline-action-brightness, 0.7)); }
    }
    .end {
      min-height: 100%;
      display: grid;
      place-items: center;
      padding: 48px 20px;
      text-align: center;
      color: #e2e8f0;
      font-size: 24px;
      font-weight: 900;
    }
    .start-screen {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: none;
      place-items: center;
      padding: clamp(20px, 6vw, 64px);
      background:
        linear-gradient(180deg, rgba(4, 8, 14, 0.42), rgba(4, 8, 14, 0.92)),
        radial-gradient(circle at 50% 22%, rgba(14, 165, 233, 0.22), transparent 42%),
        #070b12;
      color: #f8fafc;
    }
    .start-screen.template-minimal {
      background:
        linear-gradient(180deg, rgba(2,6,23,0.24), rgba(2,6,23,0.94)),
        #020617;
    }
    .start-screen.template-glass {
      background:
        linear-gradient(135deg, rgba(15, 23, 42, 0.64), rgba(8, 145, 178, 0.28)),
        radial-gradient(circle at 18% 22%, rgba(255,255,255,0.18), transparent 34%),
        #07111f;
    }
    .start-screen.open { display: grid; }
    .start-screen.has-custom-elements {
      padding: 0;
      place-items: stretch;
    }
    .start-panel {
      width: min(440px, 100%);
      display: grid;
      gap: 20px;
      text-align: center;
    }
    .start-screen.buttons-bottom-left,
    .start-screen.buttons-bottom-right {
      align-items: end;
    }
    .start-screen.buttons-bottom-left {
      justify-items: start;
    }
    .start-screen.buttons-bottom-right {
      justify-items: end;
    }
    .start-screen.buttons-bottom-left .start-panel,
    .start-screen.buttons-bottom-right .start-panel {
      max-width: min(380px, 100%);
      text-align: left;
    }
    .start-screen.buttons-bottom-left .start-logo,
    .start-screen.buttons-bottom-right .start-logo,
    .start-screen.buttons-bottom-left .start-title,
    .start-screen.buttons-bottom-right .start-title,
    .start-screen.buttons-bottom-left .start-subtitle,
    .start-screen.buttons-bottom-right .start-subtitle {
      justify-self: start;
      text-align: left;
    }
    .start-logo {
      width: 68px;
      height: 68px;
      justify-self: center;
      border-radius: 18px;
      box-shadow: 0 20px 54px rgba(0,0,0,0.32);
    }
    .start-title {
      margin: 0;
      color: #fff;
      font-size: clamp(28px, 6vw, 54px);
      font-weight: 950;
      line-height: 1.06;
      text-shadow: 0 12px 36px rgba(0,0,0,0.55);
    }
    .start-subtitle {
      min-height: 18px;
      margin: -8px 0 0;
      color: rgba(248,250,252,0.68);
      font-size: 13px;
      font-weight: 800;
    }
    .start-actions {
      display: grid;
      gap: 10px;
    }
    .start-actions.horizontal {
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    }
    .start-action {
      width: 100%;
      min-height: 48px;
      border: 1px solid rgba(255,255,255,0.16);
      border-radius: 8px;
      background: rgba(255,255,255,0.10);
      color: #f8fafc;
      cursor: pointer;
      font-weight: 900;
      letter-spacing: 0;
      backdrop-filter: blur(16px);
      transition: transform 140ms ease, background 140ms ease, border-color 140ms ease;
    }
    .start-screen.button-size-compact .start-action {
      min-height: 40px;
      padding: 0 14px;
      font-size: 13px;
    }
    .start-screen.button-size-normal .start-action {
      min-height: 48px;
      padding: 0 18px;
      font-size: 14px;
    }
    .start-screen.button-size-large .start-action {
      min-height: 56px;
      padding: 0 22px;
      font-size: 16px;
    }
    .start-action:hover:not(:disabled) {
      transform: translateY(-1px);
      border-color: rgba(255,255,255,0.32);
      background: rgba(255,255,255,0.16);
    }
    .start-action.primary {
      border-color: color-mix(in srgb, var(--choice-color, #0ea5e9), white 20%);
      background: color-mix(in srgb, var(--choice-color, #0ea5e9), transparent 8%);
      color: var(--choice-text-color, #ffffff);
    }
    .start-action:disabled {
      opacity: 0.42;
      cursor: not-allowed;
    }
    .start-screen.template-minimal .start-logo {
      display: none;
    }
    .start-screen.template-minimal .start-action {
      border-color: rgba(255,255,255,0.12);
      background: transparent;
      backdrop-filter: none;
    }
    .start-screen.template-minimal .start-action.primary {
      background: rgba(255,255,255,0.10);
    }
    .start-screen.template-glass .start-panel {
      padding: clamp(18px, 4vw, 34px);
      border: 1px solid rgba(255,255,255,0.16);
      border-radius: 18px;
      background: rgba(255,255,255,0.08);
      box-shadow: 0 24px 80px rgba(0,0,0,0.36);
      backdrop-filter: blur(24px);
    }
    .start-screen.template-glass .start-action {
      background: rgba(255,255,255,0.13);
    }
    .start-layer {
      position: absolute;
      inset: 0;
      overflow: hidden;
    }
    .start-element {
      position: absolute;
      transform-origin: center;
    }
    .start-element-text {
      display: flex;
      width: 100%;
      height: 100%;
      align-items: center;
      color: #fff;
      font-weight: 900;
      text-shadow: 0 12px 36px rgba(0,0,0,0.55);
      overflow-wrap: anywhere;
    }
    .start-element-text.subtitle {
      color: rgba(248,250,252,0.68);
      text-shadow: none;
    }
    .start-element-button {
      width: 100%;
      height: 100%;
      border: 1px solid rgba(255,255,255,0.16);
      border-radius: 8px;
      background: rgba(255,255,255,0.10);
      color: #f8fafc;
      cursor: pointer;
      font-weight: 900;
      backdrop-filter: blur(16px);
    }
    .start-element-button.primary {
      border-color: color-mix(in srgb, var(--choice-color, #0ea5e9), white 20%);
      background: color-mix(in srgb, var(--choice-color, #0ea5e9), transparent 8%);
      color: var(--choice-text-color, #fff);
    }
    .start-element-button:disabled {
      opacity: 0.42;
      cursor: not-allowed;
    }
    .start-element-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      border-radius: 8px;
      display: block;
    }
    .settings-backdrop {
      position: fixed;
      inset: 0;
      z-index: 10001;
      display: none;
      place-items: center;
      padding: 24px 16px;
      background: rgba(0,0,0,0.48);
      backdrop-filter: blur(8px);
    }
    .settings-backdrop.open { display: grid; }
    .settings-panel {
      width: min(420px, calc(100vw - 32px));
      display: grid;
      gap: 14px;
      padding: 18px;
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 14px;
      background: rgba(8, 12, 20, 0.96);
      color: #f8fafc;
      box-shadow: 0 24px 70px rgba(0,0,0,0.52);
    }
    .settings-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .settings-title {
      font-size: 15px;
      font-weight: 950;
    }
    .settings-close {
      width: 32px;
      height: 32px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: rgba(255,255,255,0.68);
      cursor: pointer;
      font-size: 18px;
    }
    .settings-close:hover { background: rgba(255,255,255,0.1); color: #fff; }
    .settings-row {
      display: grid;
      gap: 8px;
      padding: 12px;
      border: 1px solid rgba(255,255,255,0.10);
      border-radius: 10px;
      background: rgba(255,255,255,0.05);
      text-align: left;
    }
    .settings-label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-size: 12px;
      font-weight: 900;
      color: rgba(248,250,252,0.8);
    }
    .settings-value {
      color: rgba(248,250,252,0.54);
      font-size: 11px;
    }
    .settings-row input[type="range"] { width: 100%; accent-color: var(--choice-color, #0ea5e9); }
    .settings-toggle {
      width: 44px;
      height: 24px;
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 999px;
      background: rgba(255,255,255,0.12);
      padding: 2px;
      cursor: pointer;
    }
    .settings-toggle::before {
      content: "";
      display: block;
      width: 18px;
      height: 18px;
      border-radius: 999px;
      background: #f8fafc;
      transition: transform 140ms ease;
    }
    .settings-toggle.on { background: var(--choice-color, #0ea5e9); }
    .settings-toggle.on::before { transform: translateX(20px); }
    @media (max-width: 720px) {
      main { padding: 0; }
      header { align-items: center; }
      h1 { max-width: 34vw; font-size: 13px; }
      .toolbar { width: auto; min-width: 0; justify-content: flex-end; }
      .tool { flex: 0 0 auto; }
      .stage {
        height: 100%;
        max-height: none;
      }
      .media {
        max-width: calc(100% - 24px);
        max-height: calc(100% - 24px);
      }
      .scene-image {
        max-width: calc(100vw - 24px);
        max-height: calc(100vh - 210px);
      }
      .app.immersive .stage {
        height: 100vh;
        max-height: 100vh;
      }
      .dialogue { padding: 16px; }
      .app:not(.immersive) .dialogue { padding-left: 56px; padding-right: 56px; }
      .app.immersive .dialogue {
        width: min(var(--dialog-width, 86%), calc(100% - 24px));
        left: var(--dialog-left, 50%);
        right: auto;
        transform: translateX(-50%);
      }
    }
  </style>
</head>
<body>
  <div class="app">
    <header>
      <h1 id="projectTitle"></h1>
      <div class="toolbar">
        <button class="tool" id="backButton" type="button"></button>
        <button class="tool" id="resetButton" type="button"></button>
        <button class="tool" id="mainMenuButton" type="button"></button>
        <button class="tool" id="autoButton" type="button"></button>
        <div class="playlist-wrap">
          <button class="tool" id="playlistButton" type="button" aria-expanded="false"></button>
          <div class="playlist-backdrop" id="playlistBackdrop">
          <div class="playlist-panel" id="playlistPanel" role="dialog" aria-modal="true">
            <div class="playlist-head">
              <div>
                <div class="playlist-title" id="playlistTitle"></div>
                <div class="playlist-hint" id="playlistHint"></div>
              </div>
              <button class="playlist-close" id="playlistClose" type="button" aria-label="Close">&#10005;</button>
            </div>
            <div class="playlist-items" id="playlistItems"></div>
          </div>
          </div>
        </div>
        <a class="tool" id="makeButton" href="https://mingwencui.com/AIwriter/?lang=zh" target="_blank" rel="noopener noreferrer"></a>
      </div>
    </header>
    <main>
      <div class="backdrop" id="backdrop"></div>
      <section class="stage" id="stage"></section>
      <button class="zen-toggle" id="zenButton" type="button" aria-label="Toggle controls"><img src="./icons/eye.svg" alt="" /></button>
      <audio id="playlistAudio" preload="auto" hidden></audio>
    </main>
  </div>
  <div class="start-screen" id="startScreen" role="dialog" aria-modal="true">
    <div class="start-panel">
      <img class="start-logo" src="${escapeHtml(faviconPath)}" alt="" />
      <div>
        <h2 class="start-title" id="startTitle"></h2>
        <p class="start-subtitle" id="startSubtitle"></p>
      </div>
      <div class="start-actions">
        <button class="start-action primary" id="saveSlotButton" type="button"></button>
        <button class="start-action" id="newGameButton" type="button"></button>
        <button class="start-action" id="settingsButton" type="button"></button>
      </div>
    </div>
    <div class="start-layer" id="startLayer"></div>
    <audio id="startMenuAudio" preload="auto" loop hidden></audio>
  </div>
  <div class="settings-backdrop" id="settingsBackdrop">
    <div class="settings-panel" role="dialog" aria-modal="true">
      <div class="settings-head">
        <div class="settings-title" id="settingsTitle"></div>
        <button class="settings-close" id="settingsClose" type="button" aria-label="Close">&#10005;</button>
      </div>
      <div class="settings-row">
        <div class="settings-label">
          <span id="settingAutoLabel"></span>
          <button class="settings-toggle" id="settingAutoButton" type="button"></button>
        </div>
      </div>
      <label class="settings-row">
        <div class="settings-label">
          <span id="settingSpeedLabel"></span>
          <span class="settings-value" id="settingSpeedValue"></span>
        </div>
        <input id="settingSpeedInput" type="range" min="10" max="200" step="5" />
      </label>
      <div class="settings-row">
        <div class="settings-label">
          <span id="settingControlsLabel"></span>
          <button class="settings-toggle" id="settingControlsButton" type="button"></button>
        </div>
      </div>
    </div>
  </div>
  <script>
    const content = window.GALWRITER_CONTENT || { nodes: [], edges: [], title: "GalWriter" };
    const style = content.style || {};
    const settings = content.settings || {};
    settings.layoutMode = settings.layoutMode || "immersive";
    settings.choicesPosition = settings.choicesPosition || "center";
    settings.showStartMenu = settings.showStartMenu !== false;
    settings.startMenuTemplate = ["cinematic", "minimal", "glass"].includes(settings.startMenuTemplate) ? settings.startMenuTemplate : "cinematic";
    settings.startMenuBackgroundType = ["solid", "gradient", "image"].includes(settings.startMenuBackgroundType) ? settings.startMenuBackgroundType : (settings.startMenuBackgroundImageUrl ? "image" : "gradient");
    settings.startMenuBackgroundColor = String(settings.startMenuBackgroundColor || "#070b12");
    settings.startMenuBackgroundGradientStart = String(settings.startMenuBackgroundGradientStart || "#0f172a");
    settings.startMenuBackgroundGradientEnd = String(settings.startMenuBackgroundGradientEnd || "#0891b2");
    settings.startMenuBackgroundGradientAngle = Number.isFinite(Number(settings.startMenuBackgroundGradientAngle)) ? Number(settings.startMenuBackgroundGradientAngle) : 135;
    settings.startMenuBackgroundImageUrl = String(settings.startMenuBackgroundImageUrl || "");
    settings.startMenuBackgroundMusicUrl = String(settings.startMenuBackgroundMusicUrl || "");
    settings.startMenuButtonPosition = ["center", "bottomLeft", "bottomRight"].includes(settings.startMenuButtonPosition) ? settings.startMenuButtonPosition : "center";
    settings.startMenuButtonLayout = settings.startMenuButtonLayout === "horizontal" ? "horizontal" : "vertical";
    settings.startMenuButtonSize = ["compact", "normal", "large"].includes(settings.startMenuButtonSize) ? settings.startMenuButtonSize : "normal";
    settings.startMenuElements = Array.isArray(settings.startMenuElements) ? settings.startMenuElements : [];
    settings.startMenuPlacementBoundsLocked = Boolean(settings.startMenuPlacementBoundsLocked);
    settings.startMenuPlacementMinX = clamp(settings.startMenuPlacementMinX, 0, 94, 0);
    settings.startMenuPlacementMinY = clamp(settings.startMenuPlacementMinY, 0, 96, 0);
    settings.startMenuPlacementMaxX = clamp(settings.startMenuPlacementMaxX, settings.startMenuPlacementMinX + 6, 100, 100);
    settings.startMenuPlacementMaxY = clamp(settings.startMenuPlacementMaxY, settings.startMenuPlacementMinY + 4, 100, 100);
    settings.startMenuShowSave = settings.startMenuShowSave !== false;
    settings.startMenuShowNewGame = settings.startMenuShowNewGame !== false;
    settings.startMenuShowSettings = settings.startMenuShowSettings !== false;
    settings.interactionMode = settings.interactionMode || "typewriter";
    settings.typewriterSpeed = Math.max(0, Number(settings.typewriterSpeed) || 65);
    settings.autoAdvance = Boolean(settings.autoAdvance);
    settings.videoAutoPlay = Boolean(settings.videoAutoPlay);
    settings.blurBackground = Boolean(settings.blurBackground);
    settings.skipSingleChoicePopup = settings.skipSingleChoicePopup !== false;
    function colorInputValue(value, fallback) {
      const raw = String(value || "").trim();
      if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
      const rgba = raw.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/i);
      if (!rgba) return fallback || "#111827";
      return "#" + [rgba[1], rgba[2], rgba[3]].map((channel) => Number(channel).toString(16).padStart(2, "0")).join("");
    }
    function withAlpha(color, alpha) {
      const normalized = colorInputValue(color, "#111827");
      const red = parseInt(normalized.slice(1, 3), 16);
      const green = parseInt(normalized.slice(3, 5), 16);
      const blue = parseInt(normalized.slice(5, 7), 16);
      return "rgba(" + red + ", " + green + ", " + blue + ", " + Math.max(0, Math.min(1, Number(alpha))) + ")";
    }
    function px(value, fallback) {
      const number = Number(value);
      return (Number.isFinite(number) ? number : fallback) + "px";
    }
    function percent(value, fallback) {
      const number = Number(value);
      return (Number.isFinite(number) ? number : fallback) + "%";
    }
    function clamp(value, min, max, fallback) {
      const number = Number(value);
      if (!Number.isFinite(number)) return fallback;
      return Math.min(max, Math.max(min, number));
    }
    function styleColor(color, alpha, fallback) {
      const numericAlpha = Number(alpha);
      return withAlpha(color || fallback, Number.isFinite(numericAlpha) ? numericAlpha / 100 : 1);
    }
    function dialogueBackground() {
      if (style.dialogBackgroundType === "image" && style.dialogImageUrl) {
        return 'url("' + String(style.dialogImageUrl).replace(/"/g, '\\\\"') + '") center / cover';
      }
      if (style.dialogBackgroundType === "gradient") {
        const stops = Array.isArray(style.dialogGradientStops) && style.dialogGradientStops.length >= 2
          ? style.dialogGradientStops.slice().sort((a, b) => Number(a.position) - Number(b.position))
          : [
              { color: colorInputValue(style.dialogGradientStartColor, "#111827"), alpha: 0, position: 0 },
              { color: colorInputValue(style.dialogGradientColor, "#111827"), alpha: 86, position: 100 },
            ];
        const cssStops = stops.map((stop) => withAlpha(stop.color, Number(stop.alpha) / 100) + " " + clamp(stop.position, 0, 100, 0) + "%").join(", ");
        return "linear-gradient(" + clamp(style.dialogGradientAngle, 0, 360, 90) + "deg, " + cssStops + ")";
      }
      return withAlpha(style.panelColor || "#111827", (Number(style.panelColorAlpha ?? 82) || 82) / 100);
    }
    function nameplateBackground() {
      if (style.nameplateBackgroundType === "image" && style.nameplateImageUrl) {
        return 'url("' + String(style.nameplateImageUrl).replace(/"/g, '\\\\"') + '") center / cover';
      }
      if (style.nameplateBackgroundType === "gradient") {
        const stops = Array.isArray(style.nameplateGradientStops) && style.nameplateGradientStops.length >= 2
          ? style.nameplateGradientStops.slice().sort((a, b) => Number(a.position) - Number(b.position))
          : [
              { color: "#6366f1", alpha: 92, position: 0 },
              { color: "#ec4899", alpha: 82, position: 100 },
            ];
        const cssStops = stops.map((stop) => withAlpha(stop.color, Number(stop.alpha) / 100) + " " + clamp(stop.position, 0, 100, 0) + "%").join(", ");
        return "linear-gradient(" + clamp(style.nameplateGradientAngle, 0, 360, 90) + "deg, " + cssStops + ")";
      }
      return withAlpha(style.nameplateColor || "#4f46e5", (Number(style.nameplateColorAlpha ?? 86) || 86) / 100);
    }
    document.documentElement.style.setProperty("--title-size", Math.max(12, Number(style.titleFontSize) || 18) + "px");
    document.documentElement.style.setProperty("--body-size", Math.max(12, Number(style.bodyFontSize) || 18) + "px");
    document.documentElement.style.setProperty("--title-color", styleColor(style.titleColor, style.titleColorAlpha ?? 100, "#f8fafc"));
    document.documentElement.style.setProperty("--body-color", styleColor(style.bodyColor, style.bodyColorAlpha ?? 100, "#e5e7eb"));
    document.documentElement.style.setProperty("--title-font-family", style.titleFontFamily || "inherit");
    document.documentElement.style.setProperty("--body-font-family", style.bodyFontFamily || "inherit");
    document.documentElement.style.setProperty("--title-line-height", String(Number(style.titleLineHeight) || 1.18));
    document.documentElement.style.setProperty("--body-line-height", String(Number(style.bodyLineHeight) || 1.55));
    document.documentElement.style.setProperty("--title-letter-spacing", px(style.titleLetterSpacing, 0));
    document.documentElement.style.setProperty("--body-letter-spacing", px(style.bodyLetterSpacing, 0));
    document.documentElement.style.setProperty("--title-align", style.titleAlign || "left");
    document.documentElement.style.setProperty("--body-align", style.bodyAlign || "left");
    document.documentElement.style.setProperty("--title-stroke", (Number(style.titleStrokeWidth) || 0) + "px " + colorInputValue(style.titleStrokeColor, "#000000"));
    document.documentElement.style.setProperty("--body-stroke", (Number(style.bodyStrokeWidth) || 0) + "px " + colorInputValue(style.bodyStrokeColor, "#000000"));
    document.documentElement.style.setProperty("--dialog-border-color", style.dialogVisible === false ? "transparent" : "rgba(255,255,255,0.14)");
    document.documentElement.style.setProperty("--dialog-shadow", style.dialogVisible === false ? "none" : "0 24px 80px rgba(0,0,0,0.30)");
    document.documentElement.style.setProperty("--dialog-backdrop-filter", style.dialogVisible === false ? "none" : "blur(18px)");
    document.documentElement.style.setProperty("--dialog-width", percent(clamp(style.dialogWidth, 35, 100, 86), 86));
    document.documentElement.style.setProperty("--dialog-height", percent(clamp(style.dialogHeight, 16, 75, 34), 34));
    document.documentElement.style.setProperty("--dialog-radius", px(style.dialogRadius, 24));
    document.documentElement.style.setProperty("--dialog-padding-x", percent(clamp(style.dialogTextPaddingX, 2, 24, 9), 9));
    document.documentElement.style.setProperty("--dialog-left", percent(50 + clamp(style.dialogOffsetX, -100, 100, 0) * 0.5, 50));
    document.documentElement.style.setProperty("--dialog-bottom", "calc(4% - " + (clamp(style.dialogOffsetY, -100, 100, 0) * 0.28) + "%)");
    document.documentElement.style.setProperty("--dialog-background", style.dialogVisible === false ? "transparent" : dialogueBackground());
    const nameplateFontSize = Math.max(10, Number(style.nameplateFontSize) || 18);
    const nameplateScale = clamp(style.nameplateScale, 55, 180, 100) / 100;
    document.documentElement.style.setProperty("--nameplate-font-size", nameplateFontSize + "px");
    document.documentElement.style.setProperty("--nameplate-font-family", style.nameplateFontFamily || style.titleFontFamily || "inherit");
    document.documentElement.style.setProperty("--nameplate-padding-x", Math.round(nameplateFontSize * 1.15 * nameplateScale) + "px");
    document.documentElement.style.setProperty("--nameplate-padding-y", Math.round(nameplateFontSize * 0.42 * nameplateScale) + "px");
    document.documentElement.style.setProperty("--nameplate-row-height", Math.ceil(nameplateFontSize + Math.round(nameplateFontSize * 0.42 * nameplateScale) * 2 + Math.max(8, nameplateFontSize * 0.45)) + "px");
    document.documentElement.style.setProperty("--nameplate-text-gap", px(style.nameplateTextGap, 8));
    document.documentElement.style.setProperty("--nameplate-radius", px(style.nameplateRadius, 14));
    document.documentElement.style.setProperty("--nameplate-color", styleColor(style.nameplateTextColor, style.nameplateTextColorAlpha ?? 100, "#ffffff"));
    document.documentElement.style.setProperty("--nameplate-background", nameplateBackground());
    document.documentElement.style.setProperty("--nameplate-offset-x", px(style.nameplateOffsetX, 0));
    document.documentElement.style.setProperty("--nameplate-offset-y", px(style.nameplateOffsetY, 0));
    document.documentElement.style.setProperty("--nameplate-top", style.nameplateInside ? "8px" : "0");
    document.documentElement.style.setProperty("--nameplate-translate-y", style.nameplateInside ? px(style.nameplateOffsetY, 0) : "calc(-100% - 8px + " + px(style.nameplateOffsetY, 0) + ")");
    document.documentElement.style.setProperty("--choice-color", style.choiceColor || "#0ea5e9");
    document.documentElement.style.setProperty("--choice-text-color", style.choiceTextColor || "#ffffff");
    const labels = content.language === "zh"
      ? { back: "\\u8fd4\\u56de", reset: "\\u91cd\\u5f00", mainMenu: "\\u4e3b\\u754c\\u9762", autoOn: "\\u81ea\\u52a8\\u64ad\\u653e", autoOff: "\\u624b\\u52a8\\u64ad\\u653e", make: "\\u5236\\u4f5c\\u540c\\u6b3e", continue: "\\u7ee7\\u7eed", option: "\\u9009\\u9879", end: "\\u5267\\u672c\\u7ed3\\u675f", noStory: "\\u6ca1\\u6709\\u53ef\\u9884\\u89c8\\u7684\\u5267\\u672c", playlist: "\\u58f0\\u97f3\\u56de\\u653e", playlistHint: "\\u6700\\u8fd1\\u542c\\u8fc7\\u7684\\u5f55\\u97f3\\u6392\\u5728\\u6700\\u4e0a\\u65b9", playlistEmpty: "\\u542c\\u8fc7\\u7684\\u5f55\\u97f3\\u4f1a\\u663e\\u793a\\u5728\\u8fd9\\u91cc", untitledAudio: "\\u672a\\u547d\\u540d\\u5f55\\u97f3", saveSlot: "\\u5b58\\u6863", noSave: "\\u6ca1\\u6709\\u5b58\\u6863", newGame: "\\u65b0\\u6e38\\u620f", settings: "\\u8bbe\\u7f6e", savedAt: "\\u4e0a\\u6b21\\u8fdb\\u5ea6", saved: "\\u5df2\\u5b58\\u6863", autoPlay: "\\u81ea\\u52a8\\u64ad\\u653e", textSpeed: "\\u6253\\u5b57\\u901f\\u5ea6", controls: "\\u663e\\u793a\\u63a7\\u4ef6" }
      : content.language === "ja"
        ? { back: "\\u623b\\u308b", reset: "\\u3084\\u308a\\u76f4\\u3059", mainMenu: "\\u30e1\\u30a4\\u30f3", autoOn: "\\u81ea\\u52d5\\u518d\\u751f", autoOff: "\\u624b\\u52d5\\u518d\\u751f", make: "\\u540c\\u3058\\u3082\\u306e\\u3092\\u4f5c\\u308b", continue: "\\u7d9a\\u3051\\u308b", option: "\\u9078\\u629e\\u80a2", end: "\\u7d42\\u4e86", noStory: "\\u30d7\\u30ec\\u30d3\\u30e5\\u30fc\\u3067\\u304d\\u308b\\u811a\\u672c\\u304c\\u3042\\u308a\\u307e\\u305b\\u3093", playlist: "\\u97f3\\u58f0\\u518d\\u751f", playlistHint: "\\u6700\\u8fd1\\u8074\\u3044\\u305f\\u9332\\u97f3\\u3092\\u4e0a\\u306b\\u8868\\u793a", playlistEmpty: "\\u518d\\u751f\\u3057\\u305f\\u9332\\u97f3\\u304c\\u3053\\u3053\\u306b\\u8868\\u793a\\u3055\\u308c\\u307e\\u3059", untitledAudio: "\\u540d\\u79f0\\u672a\\u8a2d\\u5b9a\\u306e\\u9332\\u97f3", saveSlot: "\\u30bb\\u30fc\\u30d6", noSave: "\\u30bb\\u30fc\\u30d6\\u306a\\u3057", newGame: "\\u65b0\\u898f\\u30b2\\u30fc\\u30e0", settings: "\\u8a2d\\u5b9a", savedAt: "\\u524d\\u56de\\u306e\\u9032\\u6357", saved: "\\u30bb\\u30fc\\u30d6\\u6e08\\u307f", autoPlay: "\\u81ea\\u52d5\\u518d\\u751f", textSpeed: "\\u30c6\\u30ad\\u30b9\\u30c8\\u901f\\u5ea6", controls: "\\u64cd\\u4f5c\\u8868\\u793a" }
        : { back: "Back", reset: "Restart", mainMenu: "Menu", autoOn: "Auto Play", autoOff: "Manual", make: "Make One", continue: "Continue", option: "Option", end: "The End", noStory: "No story to preview", playlist: "Audio replay", playlistHint: "Most recently heard first", playlistEmpty: "Audio you have heard will appear here", untitledAudio: "Untitled audio", saveSlot: "Save", noSave: "No save", newGame: "New Game", settings: "Settings", savedAt: "Last progress", saved: "Saved", autoPlay: "Auto play", textSpeed: "Text speed", controls: "Show controls" };
    const nodeById = new Map(content.nodes.map((node) => [node.id, node]));
    const root = content.nodes.find((node) => node.data && node.data.isRoot) || content.nodes[0] || null;
    let currentId = root ? root.id : null;
    let history = [];

    const titleEl = document.getElementById("projectTitle");
    const stageEl = document.getElementById("stage");
    const backdropEl = document.getElementById("backdrop");
    const backButton = document.getElementById("backButton");
    const resetButton = document.getElementById("resetButton");
    const mainMenuButton = document.getElementById("mainMenuButton");
    const autoButton = document.getElementById("autoButton");
    const playlistButton = document.getElementById("playlistButton");
    const playlistBackdrop = document.getElementById("playlistBackdrop");
    const playlistPanel = document.getElementById("playlistPanel");
    const playlistClose = document.getElementById("playlistClose");
    const playlistTitle = document.getElementById("playlistTitle");
    const playlistHint = document.getElementById("playlistHint");
    const playlistItems = document.getElementById("playlistItems");
    const playlistAudio = document.getElementById("playlistAudio");
    const makeButton = document.getElementById("makeButton");
    const zenButton = document.getElementById("zenButton");
    const startScreen = document.getElementById("startScreen");
    const startTitle = document.getElementById("startTitle");
    const startSubtitle = document.getElementById("startSubtitle");
    const startActions = document.querySelector(".start-actions");
    const startPanel = document.querySelector(".start-panel");
    const startLayer = document.getElementById("startLayer");
    const startMenuAudio = document.getElementById("startMenuAudio");
    const saveSlotButton = document.getElementById("saveSlotButton");
    const newGameButton = document.getElementById("newGameButton");
    const settingsButton = document.getElementById("settingsButton");
    const settingsBackdrop = document.getElementById("settingsBackdrop");
    const settingsTitle = document.getElementById("settingsTitle");
    const settingsClose = document.getElementById("settingsClose");
    const settingAutoLabel = document.getElementById("settingAutoLabel");
    const settingAutoButton = document.getElementById("settingAutoButton");
    const settingSpeedLabel = document.getElementById("settingSpeedLabel");
    const settingSpeedValue = document.getElementById("settingSpeedValue");
    const settingSpeedInput = document.getElementById("settingSpeedInput");
    const settingControlsLabel = document.getElementById("settingControlsLabel");
    const settingControlsButton = document.getElementById("settingControlsButton");
    titleEl.textContent = content.title || "GalWriter";
    startTitle.textContent = content.title || "GalWriter";
    if (settings.startMenuBackgroundMusicUrl) {
      startMenuAudio.src = settings.startMenuBackgroundMusicUrl;
      startMenuAudio.volume = 0.7;
    }
    startScreen.classList.add("template-" + settings.startMenuTemplate);
    startScreen.classList.add("buttons-" + settings.startMenuButtonPosition.replace(/[A-Z]/g, (char) => "-" + char.toLowerCase()));
    startScreen.classList.add("button-size-" + settings.startMenuButtonSize);
    startScreen.classList.toggle("has-custom-elements", settings.startMenuElements.length > 0);
    if (settings.startMenuBackgroundType === "image" && settings.startMenuBackgroundImageUrl) {
      startScreen.style.backgroundImage = 'linear-gradient(180deg,rgba(4,8,14,0.28),rgba(4,8,14,0.72)),url("' + settings.startMenuBackgroundImageUrl.replace(/"/g, '\\"') + '")';
      startScreen.style.backgroundPosition = "center";
      startScreen.style.backgroundSize = "cover";
    } else if (settings.startMenuBackgroundType === "gradient") {
      startScreen.style.background = "linear-gradient(" + settings.startMenuBackgroundGradientAngle + "deg, " + settings.startMenuBackgroundGradientStart + ", " + settings.startMenuBackgroundGradientEnd + ")";
    } else if (settings.startMenuBackgroundType === "solid") {
      startScreen.style.background = settings.startMenuBackgroundColor;
    }
    startActions.classList.toggle("horizontal", settings.startMenuButtonLayout === "horizontal");
    settingsTitle.textContent = labels.settings;
    settingAutoLabel.textContent = labels.autoPlay;
    settingSpeedLabel.textContent = labels.textSpeed;
    settingControlsLabel.textContent = labels.controls;
    backButton.innerHTML = '<img src="./icons/arrow-left.svg" alt="" /><span>' + labels.back + '</span>';
    resetButton.innerHTML = '<img src="./icons/reset.svg" alt="" /><span>' + labels.reset + '</span>';
    mainMenuButton.innerHTML = '<span aria-hidden="true">&#8962;</span><span>' + labels.mainMenu + '</span>';
    mainMenuButton.hidden = !settings.showStartMenu;
    playlistButton.innerHTML = '<span aria-hidden="true">&#9835;</span><span>' + labels.playlist + '</span>';
    playlistTitle.textContent = labels.playlist;
    playlistHint.textContent = labels.playlistHint;
    makeButton.innerHTML = '<img src="./icons/wand.svg" alt="" /><span>' + labels.make + '</span>';
    updateAutoButton();
    document.querySelector(".app").classList.toggle("immersive", settings.layoutMode === "immersive");
    let typewriterTimers = [];
    let autoAdvanceTimer = null;
    let playbackSession = 0;
    let autoAdvanceHoldId = null;
    let lastJumpedNode = null;
    let controlsHidden = false;
    let playedAudios = [];
    let currentAudioEnded = true;
    let currentVideoEnded = true;
    let gameStarted = !settings.showStartMenu;
    let regionAudio = null;
    let regionAudioKey = "";
    let regionFadeFrame = 0;
    let regionUnlockCleanup = null;
    let zenPositionFrame = 0;
    let zenPositionObserver = null;
    const saveKey = "galwriter-web-save:" + encodeURIComponent(String(content.title || "GalWriter"));

    function readSave() {
      try {
        const raw = window.localStorage.getItem(saveKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.currentId !== "string") return null;
        if (parsed.currentId !== "THE_END" && !nodeById.has(parsed.currentId)) return null;
        return parsed;
      } catch (error) {
        console.warn("Could not read GalWriter web save:", error);
        return null;
      }
    }

    function writeSave() {
      if (!gameStarted) return;
      if (!currentId) return;
      try {
        const payload = {
          version: 1,
          title: content.title || "GalWriter",
          currentId,
          history: Array.isArray(history) ? history.filter((id) => nodeById.has(id)) : [],
          settings: {
            autoAdvance: Boolean(settings.autoAdvance),
            typewriterSpeed: Number(settings.typewriterSpeed) || 65,
          },
          controlsHidden: Boolean(controlsHidden),
          playedAudios,
          savedAt: Date.now(),
        };
        window.localStorage.setItem(saveKey, JSON.stringify(payload));
        updateStartMenu();
      } catch (error) {
        console.warn("Could not write GalWriter web save:", error);
      }
    }

    function applySave(save) {
      if (!save) return false;
      currentId = save.currentId === "THE_END" ? "THE_END" : save.currentId;
      history = Array.isArray(save.history) ? save.history.filter((id) => nodeById.has(id)) : [];
      if (save.settings) {
        if (typeof save.settings.autoAdvance === "boolean") settings.autoAdvance = save.settings.autoAdvance;
        if (Number.isFinite(Number(save.settings.typewriterSpeed))) {
          settings.typewriterSpeed = Math.max(0, Number(save.settings.typewriterSpeed));
        }
      }
      controlsHidden = Boolean(save.controlsHidden);
      playedAudios = Array.isArray(save.playedAudios) ? save.playedAudios : [];
      document.querySelector(".app").classList.toggle("controls-hidden", controlsHidden);
      zenButton.innerHTML = '<img src="./icons/' + (controlsHidden ? 'eye-off.svg' : 'eye.svg') + '" alt="" />';
      updateAutoButton();
      updateSettingsPanel();
      return true;
    }

    function saveLabel(save) {
      if (!save || !save.savedAt) return labels.noSave;
      const date = new Date(save.savedAt);
      if (Number.isNaN(date.getTime())) return labels.savedAt;
      return labels.savedAt + " " + date.toLocaleString();
    }

    function renderCustomStartMenu(save) {
      const hasCustomElements = settings.startMenuElements.length > 0;
      startPanel.hidden = hasCustomElements;
      startLayer.hidden = !hasCustomElements;
      if (!hasCustomElements) return;
      startLayer.innerHTML = "";
      const actionByRole = {
        save: {
          label: labels.saveSlot,
          disabled: !save,
          primary: true,
          onClick: () => {
            const loaded = readSave();
            if (loaded && applySave(loaded)) startGameFromCurrent();
          },
        },
        new: {
          label: labels.newGame,
          disabled: false,
          primary: !settings.startMenuShowSave,
          onClick: startNewGame,
        },
        settings: {
          label: labels.settings,
          disabled: false,
          primary: false,
          onClick: () => settingsBackdrop.classList.add("open"),
        },
      };
      settings.startMenuElements.forEach((element) => {
        if (!element || element.visible === false) return;
        const wrapper = document.createElement("div");
        wrapper.className = "start-element";
        wrapper.style.left = Number(element.x || 0) + "%";
        wrapper.style.top = Number(element.y || 0) + "%";
        wrapper.style.width = Math.max(1, Number(element.width || 10)) + "%";
        wrapper.style.height = Math.max(1, Number(element.height || 6)) + "%";
        wrapper.style.transform = "rotate(" + Number(element.rotation || 0) + "deg) scale(" + (Number(element.scale) || 1) + ")";
        if (element.kind === "image") {
          if (!element.imageUrl) return;
          const image = document.createElement("img");
          image.className = "start-element-image";
          image.src = element.imageUrl;
          image.alt = "";
          image.style.borderRadius = px(element.borderRadius, 12);
          wrapper.appendChild(image);
        } else if (element.kind === "button") {
          const action = actionByRole[element.role] || null;
          const button = document.createElement("button");
          button.type = "button";
          button.className = "start-element-button" + ((element.primary || action?.primary) ? " primary" : "");
          button.textContent = element.text || action?.label || "";
          button.disabled = Boolean(element.disabled || action?.disabled);
          if (element.backgroundType === "image" && element.backgroundImageUrl) {
            button.style.background = "center / cover url(\\"" + String(element.backgroundImageUrl).replace(/"/g, "\\\\\\"") + "\\")";
          } else if (element.backgroundType === "gradient") {
            button.style.background = "linear-gradient(" + (Number(element.backgroundGradientAngle) || 135) + "deg, " + (element.backgroundGradientStart || style.choiceColor || "#0ea5e9") + ", " + (element.backgroundGradientEnd || "#0f172a") + ")";
          } else if (element.backgroundColor) {
            button.style.background = element.backgroundColor;
          }
          if (element.textColor) button.style.color = element.textColor;
          if (element.borderColor) button.style.borderColor = element.borderColor;
          if (Number.isFinite(Number(element.fontSize))) button.style.fontSize = Number(element.fontSize) + "px";
          button.style.borderRadius = px(element.borderRadius, 12);
          if (action?.onClick) button.addEventListener("click", action.onClick);
          wrapper.appendChild(button);
        } else {
          const text = document.createElement("div");
          text.className = "start-element-text" + (element.role === "subtitle" ? " subtitle" : "");
          text.textContent = element.role === "subtitle" && !element.text ? (save ? saveLabel(save) : labels.noSave) : (element.text || "");
          if (Number.isFinite(Number(element.fontSize))) text.style.fontSize = Number(element.fontSize) + "px";
          if (element.textColor) text.style.color = element.textColor;
          text.style.borderRadius = px(element.borderRadius, 0);
          wrapper.appendChild(text);
        }
        startLayer.appendChild(wrapper);
      });
    }

    function updateStartMenu() {
      const save = readSave();
      const showSave = Boolean(settings.startMenuShowSave);
      const showNewGame = Boolean(settings.startMenuShowNewGame) || (!settings.startMenuShowSave && !settings.startMenuShowSettings);
      const showSettings = Boolean(settings.startMenuShowSettings);
      startSubtitle.textContent = save ? saveLabel(save) : labels.noSave;
      saveSlotButton.textContent = labels.saveSlot;
      saveSlotButton.disabled = !save;
      saveSlotButton.hidden = !showSave;
      newGameButton.textContent = labels.newGame;
      newGameButton.hidden = !showNewGame;
      settingsButton.textContent = labels.settings;
      settingsButton.hidden = !showSettings;
      renderCustomStartMenu(save);
    }

    function showStartMenu() {
      updateStartMenu();
      startScreen.classList.add("open");
      if (settings.startMenuBackgroundMusicUrl) startMenuAudio.play().catch(() => {});
    }

    function hideStartMenu() {
      startScreen.classList.remove("open");
      startMenuAudio.pause();
    }

    function returnToMainMenu() {
      if (!settings.showStartMenu) return;
      writeSave();
      restartPlaybackSession();
      const nodeAudio = document.getElementById("nodeAudio");
      const nodeVideo = document.getElementById("nodeVideo");
      if (nodeAudio) nodeAudio.pause();
      if (nodeVideo) nodeVideo.pause();
      playlistBackdrop.classList.remove("open");
      playlistButton.setAttribute("aria-expanded", "false");
      syncRegionMusic(null);
      showStartMenu();
    }

    function startGameFromCurrent() {
      gameStarted = true;
      hideStartMenu();
      renderPlaylist();
      render();
    }

    function startNewGame() {
      restartPlaybackSession();
      history = [];
      currentId = root ? root.id : null;
      autoAdvanceHoldId = currentId;
      window.localStorage.removeItem(saveKey);
      startGameFromCurrent();
      writeSave();
    }

    function continueSavedGame() {
      const save = readSave();
      if (!save || !applySave(save)) return;
      startGameFromCurrent();
    }

    function updateSettingsPanel() {
      settingAutoButton.classList.toggle("on", Boolean(settings.autoAdvance));
      settingAutoButton.setAttribute("aria-pressed", String(Boolean(settings.autoAdvance)));
      settingSpeedInput.value = String(Math.max(10, Math.min(200, Number(settings.typewriterSpeed) || 65)));
      settingSpeedValue.textContent = settingSpeedInput.value + "ms";
      settingControlsButton.classList.toggle("on", !controlsHidden);
      settingControlsButton.setAttribute("aria-pressed", String(!controlsHidden));
    }

    function openSettingsPanel() {
      updateSettingsPanel();
      settingsBackdrop.classList.add("open");
    }

    function closeSettingsPanel() {
      settingsBackdrop.classList.remove("open");
    }

    function hasZenBottomRightSpace() {
      if (settings.layoutMode !== "immersive") return true;
      const dialogOffsetX = clamp(style.dialogOffsetX, -100, 100, 0);
      const dialogCenter = 50 + dialogOffsetX * 0.5;
      const dialogWidth = clamp(style.dialogWidth, 0, 100, 86);
      return Math.max(0, 100 - (dialogCenter + dialogWidth / 2)) >= 12;
    }

    function updateZenButtonPosition() {
      if (zenPositionFrame) cancelAnimationFrame(zenPositionFrame);
      zenPositionFrame = requestAnimationFrame(() => {
        if (!zenButton) return;
        if (hasZenBottomRightSpace()) {
          zenButton.style.setProperty("--zen-toggle-bottom", "24px");
          return;
        }
        const main = stageEl.closest("main");
        const dialogue = stageEl.querySelector(".dialogue");
        if (!main || !dialogue) {
          zenButton.style.setProperty("--zen-toggle-bottom", "24px");
          return;
        }
        const mainRect = main.getBoundingClientRect();
        const dialogueRect = dialogue.getBoundingClientRect();
        const nextBottom = Math.max(24, Math.ceil(mainRect.bottom - dialogueRect.top + 20));
        zenButton.style.setProperty("--zen-toggle-bottom", nextBottom + "px");
      });
    }

    function clearPlaybackTimers() {
      if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
      typewriterTimers.forEach((timer) => clearInterval(timer));
      autoAdvanceTimer = null;
      typewriterTimers = [];
    }

    function restartPlaybackSession() {
      playbackSession += 1;
      clearPlaybackTimers();
      isTransitioning = false;
      lastJumpedNode = null;
    }

    function currentHistoryTotal() {
      return history.reduce((total, nodeId) => {
        const historyNode = nodeById.get(nodeId);
        const value = historyNode && historyNode.data ? historyNode.data.nodeValue : undefined;
        return total + (typeof value === "number" && Number.isFinite(value) ? value : 0);
      }, 0);
    }

    function numberConditionTarget(node) {
      const data = node.data || {};
      const sum = currentHistoryTotal();
      const ranges = Array.isArray(data.ranges) ? data.ranges : [];
      const matchedRange = ranges.find((range) =>
        range && range.min <= range.max && sum >= range.min && sum <= range.max
      );
      const sourceHandle = matchedRange
        ? "out-range-" + matchedRange.id
        : sum >= (Number(data.threshold) || 0)
          ? "out-greater"
          : "out-less-equal";
      const edge = outEdges(node.id).find((item) => item.sourceHandle === sourceHandle);
      return edge ? edge.target : "THE_END";
    }

    function watchZenButtonPosition() {
      if (zenPositionObserver) zenPositionObserver.disconnect();
      zenPositionObserver = null;
      const main = stageEl.closest("main");
      const dialogue = stageEl.querySelector(".dialogue");
      updateZenButtonPosition();
      if (!main || !dialogue || typeof ResizeObserver === "undefined") return;
      zenPositionObserver = new ResizeObserver(updateZenButtonPosition);
      zenPositionObserver.observe(main);
      zenPositionObserver.observe(dialogue);
    }

    function fadeRegionAudio(audio, from, to, seconds, done) {
      cancelAnimationFrame(regionFadeFrame);
      const duration = Math.max(0, Number(seconds) || 0) * 1000;
      if (!duration) {
        audio.volume = to;
        if (done) done();
        return;
      }
      const started = performance.now();
      const tick = (now) => {
        const progress = Math.min(1, (now - started) / duration);
        audio.volume = from + (to - from) * progress;
        if (progress < 1) regionFadeFrame = requestAnimationFrame(tick);
        else if (done) done();
      };
      regionFadeFrame = requestAnimationFrame(tick);
    }

    function clearRegionAudioUnlock() {
      if (regionUnlockCleanup) regionUnlockCleanup();
      regionUnlockCleanup = null;
    }

    function playRegionAudio(audio) {
      audio.play().then(clearRegionAudioUnlock).catch(() => {
        if (regionAudio !== audio) return;
        clearRegionAudioUnlock();
        const retry = () => {
          if (regionAudio !== audio) {
            clearRegionAudioUnlock();
            return;
          }
          audio.play().then(clearRegionAudioUnlock).catch(() => {});
        };
        const options = { capture: true, passive: true };
        window.addEventListener("pointerdown", retry, options);
        window.addEventListener("keydown", retry, options);
        window.addEventListener("touchend", retry, options);
        regionUnlockCleanup = () => {
          window.removeEventListener("pointerdown", retry, options);
          window.removeEventListener("keydown", retry, options);
          window.removeEventListener("touchend", retry, options);
        };
      });
    }

    function syncRegionMusic(music) {
      const nextKey = music && music.url ? music.url : "";
      if (regionAudio && regionAudioKey === nextKey) {
        regionAudio.loop = music.loop !== false;
        regionAudio.volume = Math.max(0, Math.min(1, Number(music.volume) || 0));
        if (regionAudio.paused) playRegionAudio(regionAudio);
        return;
      }
      const previous = regionAudio;
      const startNext = () => {
        if (!music || !music.url) return;
        const audio = new Audio(music.url);
        regionAudio = audio;
        regionAudioKey = nextKey;
        audio.loop = music.loop !== false;
        audio._fadeOut = Math.max(0, Number(music.fadeOut) || 0);
        const targetVolume = Math.max(0, Math.min(1, Number(music.volume) || 0));
        audio.volume = Number(music.fadeIn) > 0 ? 0 : targetVolume;
        playRegionAudio(audio);
        fadeRegionAudio(audio, audio.volume, targetVolume, music.fadeIn);
      };
      clearRegionAudioUnlock();
      if (!previous) {
        startNext();
        return;
      }
      fadeRegionAudio(previous, previous.volume, 0, previous._fadeOut || 0, () => {
        previous.pause();
        if (regionAudio === previous) {
          regionAudio = null;
          regionAudioKey = "";
        }
        startNext();
      });
    }

    function nodeTitle(node) {
      return (node && node.data && node.data.title) || labels.option;
    }

    function audioTitle(node) {
      if (node && node.data && node.data.title) return String(node.data.title);
      const temp = document.createElement("div");
      temp.innerHTML = node && node.data && node.data.text || "";
      const text = (temp.textContent || "").trim().replace(/\\s+/g, " ");
      return text ? text.slice(0, 42) : labels.untitledAudio;
    }

    function renderPlaylist() {
      playlistItems.innerHTML = "";
      if (!playedAudios.length) {
        const empty = document.createElement("div");
        empty.className = "playlist-empty";
        empty.textContent = labels.playlistEmpty;
        playlistItems.appendChild(empty);
        return;
      }
      playedAudios.forEach((item) => {
        const row = document.createElement("div");
        const active = playlistAudio.getAttribute("src") === item.url && !playlistAudio.paused;
        row.className = "playlist-item" + (active ? " active" : "");
        const name = document.createElement("span");
        name.className = "playlist-name";
        name.textContent = item.title;
        name.title = item.title;
        const play = document.createElement("button");
        play.className = "playlist-play";
        play.type = "button";
        play.textContent = active ? "\\u275a\\u275a" : "\\u25b6";
        play.setAttribute("aria-label", active ? "Pause" : "Play");
        play.addEventListener("click", () => togglePlaylistAudio(item));
        row.append(name, play);
        playlistItems.appendChild(row);
      });
    }

    function recordAudio(node, url) {
      if (!node || !url) return;
      playlistAudio.pause();
      const item = { nodeId: node.id, title: audioTitle(node), url };
      playedAudios = [
        item,
        ...playedAudios.filter((audio) => audio.nodeId !== item.nodeId && audio.url !== item.url),
      ];
      renderPlaylist();
    }

    function togglePlaylistAudio(item) {
      const nodeAudio = document.getElementById("nodeAudio");
      if (nodeAudio) nodeAudio.pause();
      if (playlistAudio.getAttribute("src") === item.url) {
        if (playlistAudio.paused) {
          playlistAudio.play().catch(() => {});
        } else {
          playlistAudio.pause();
        }
        return;
      }
      playlistAudio.src = item.url;
      playlistAudio.currentTime = 0;
      playlistAudio.play().catch(() => renderPlaylist());
    }

    function updateAutoButton() {
      autoButton.innerHTML = '<img src="./icons/' + (settings.autoAdvance ? 'pause.svg' : 'play.svg') + '" alt="" /><span>' + (settings.autoAdvance ? labels.autoOn : labels.autoOff) + '</span>';
      autoButton.setAttribute("aria-pressed", String(settings.autoAdvance));
    }

    function outEdges(id) {
      return content.edges.filter((edge) => edge.source === id);
    }

    let isTransitioning = false;

    function getPresentationTransform(type, isExit) {
      if (type === 'slide-left' || type === 'slideLeft') {
        return 'translateX(' + (isExit ? '-120%' : '100%') + ')';
      }
      if (type === 'slide-right' || type === 'slideRight') {
        return 'translateX(' + (isExit ? '120%' : '-100%') + ')';
      }
      if (type === 'slide-up' || type === 'slideUp') {
        return 'translateY(' + (isExit ? '-120%' : '100%') + ')';
      }
      if (type === 'slide-down' || type === 'slideDown') {
        return 'translateY(' + (isExit ? '120%' : '-100%') + ')';
      }
      if (type === 'zoom') return 'scale(0.82)';
      return '';
    }

    function goTo(id) {
      if (isTransitioning) return;
      if (autoAdvanceTimer) {
        clearTimeout(autoAdvanceTimer);
        autoAdvanceTimer = null;
      }
      
      const node = nodeById.get(currentId);
      let exitDuration = 0;
      
      if (node && node.data) {
        const data = node.data;
        const sceneExit = data.presentation && data.presentation.scene && data.presentation.scene.exit;
        const sceneExitDuration =
          sceneExit && sceneExit.type !== 'none' ? Math.max(0, sceneExit.duration || 0) : 0;
        let characterExitDuration = 0;
        if (data.presentation && Array.isArray(data.presentation.characters)) {
          data.presentation.characters.forEach((char) => {
            if (char.exit && char.exit.type !== 'none') {
              characterExitDuration = Math.max(characterExitDuration, char.exit.duration || 0);
            }
          });
        }
        exitDuration = characterExitDuration + sceneExitDuration;
        
        if (exitDuration > 0) {
          isTransitioning = true;
          
          const mediaEl = stageEl.querySelector('.scene-image, #nodeVideo');
          if (mediaEl && sceneExit && sceneExit.type !== 'none') {
            mediaEl.style.transition = 'opacity ' + sceneExit.duration + 'ms ease-out, transform ' + sceneExit.duration + 'ms ease-out';
            mediaEl.style.transitionDelay = characterExitDuration + 'ms';
            if (sceneExit.type === 'fade') {
              mediaEl.style.opacity = '0';
            } else {
              mediaEl.style.transform = getPresentationTransform(sceneExit.type, true);
            }
          }
          
          if (data.presentation && Array.isArray(data.presentation.characters)) {
            const charImgs = stageEl.querySelectorAll('.character-img');
            data.presentation.characters.forEach((char, idx) => {
              const imgEl = charImgs[idx];
              if (imgEl && char.exit && char.exit.type !== 'none') {
                const duration = char.exit.duration || 0;
                imgEl.style.transition = 'opacity ' + duration + 'ms ease-out, transform ' + duration + 'ms ease-out';
                if (char.exit.type === 'fade') {
                  imgEl.style.opacity = '0';
                } else {
                  const flipScale = char.flipX ? -1 : 1;
                  const scale = char.scale || 1;
                  const transformMotion = getPresentationTransform(char.exit.type, true);
                  imgEl.style.transform = 'translate(-50%, 0) ' + transformMotion + ' scale(' + scale + ') scaleX(' + flipScale + ')';
                }
              }
            });
          }
        }
      }
      
      if (exitDuration > 0) {
        const sessionId = playbackSession;
        setTimeout(() => {
          if (sessionId !== playbackSession) return;
          isTransitioning = false;
          if (currentId) history.push(currentId);
          currentId = id;
          render();
          writeSave();
        }, exitDuration);
      } else {
        if (currentId) history.push(currentId);
        currentId = id;
        render();
        writeSave();
      }
    }

    function animationClass(animation) {
      return animation && animation !== "none" ? " anim-" + animation : "";
    }

    function stripHtml(html) {
      const temp = document.createElement("div");
      temp.innerHTML = html || "";
      return temp.textContent || "";
    }

    function filterInlineMentionTags(html) {
      if (!html) return "";
      const temp = document.createElement("div");
      temp.innerHTML = html;
      temp.querySelectorAll('[data-mention-kind="video"]').forEach((node) => node.remove());
      if (settings.hideCharacterTags) {
        temp.querySelectorAll('[data-mention-kind="character"]').forEach((node) => node.remove());
      }
      if (settings.hideSceneTags) {
        temp.querySelectorAll('[data-mention-kind="scene"]').forEach((node) => node.remove());
      }
      return temp.innerHTML;
    }

    function findInlineAction(mention, presentation) {
      if (!presentation || !Array.isArray(presentation.inlineActions)) return null;
      const kind = mention.dataset.mentionKind;
      if (kind !== "character" && kind !== "scene") return null;
      const mentionId = mention.dataset.mentionId || "";
      const name = mention.dataset.mentionName || (mention.textContent || "").replace(/^@/, "");
      const sourceNodeId = mention.dataset.sourceNodeId || mention.dataset.mentionSourceNodeId || "";
      return presentation.inlineActions.find((item) => item.id === mentionId) ||
        presentation.inlineActions.find((item) => sourceNodeId && item.kind === kind && item.sourceNodeId === sourceNodeId) ||
        presentation.inlineActions.find((item) => name && item.kind === kind && item.name === name) ||
        null;
    }

    function buildInlinePlaybackSteps(rawHtml, displayHtml, presentation) {
      if (!rawHtml || !presentation || !Array.isArray(presentation.inlineActions) || !presentation.inlineActions.length) {
        return [{ kind: "text", html: displayHtml || rawHtml || "" }];
      }
      const temp = document.createElement("div");
      temp.innerHTML = rawHtml || "";
      const steps = [];
      let buffer = "";
      const hasMeaningfulTextOutsideMentions = (html) => {
        const probe = document.createElement("div");
        probe.innerHTML = html || "";
        probe.querySelectorAll(".mention-chip").forEach((node) => node.remove());
        return /[\\p{L}\\p{N}]/u.test(probe.textContent || "");
      };
      const mentionPlacement = (mention) => {
        const beforeRange = document.createRange();
        beforeRange.setStart(temp, 0);
        beforeRange.setEndBefore(mention);
        const afterRange = document.createRange();
        afterRange.setStartAfter(mention);
        afterRange.setEnd(temp, temp.childNodes.length);
        const before = document.createElement("div");
        const after = document.createElement("div");
        before.appendChild(beforeRange.cloneContents());
        after.appendChild(afterRange.cloneContents());
        if (!hasMeaningfulTextOutsideMentions(before.innerHTML)) return "start";
        if (!hasMeaningfulTextOutsideMentions(after.innerHTML)) return "end";
        return "inline";
      };
      const flush = () => {
        const html = filterInlineMentionTags(buffer);
        if (stripHtml(html).trim()) steps.push({ kind: "text", html });
        buffer = "";
      };
      Array.from(temp.childNodes).forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains("mention-chip")) {
          if (mentionPlacement(node) !== "inline") {
            buffer += node.outerHTML || "";
            return;
          }
          const action = findInlineAction(node, presentation);
          if (action) {
            flush();
            steps.push({ kind: "action", action });
            return;
          }
        }
        buffer += node.nodeType === Node.ELEMENT_NODE ? node.outerHTML : (node.textContent || "");
      });
      flush();
      return steps.length ? steps : [{ kind: "text", html: displayHtml || rawHtml || "" }];
    }

    function cssEscape(value) {
      if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(String(value || ""));
      return String(value || "").replace(/["\\\\]/g, "\\\\$&");
    }

    function clearInlineActionElement(element) {
      if (!element) return;
      element.classList.remove("inline-shake-x", "inline-shake-y", "inline-pulse", "inline-rotate", "inline-opacity", "inline-brightness");
      element.style.removeProperty("--inline-action-duration");
      element.style.removeProperty("--inline-action-strength");
      element.style.removeProperty("--inline-action-scale");
      element.style.removeProperty("--inline-action-step-duration");
      element.style.removeProperty("--inline-action-count");
      element.style.removeProperty("--inline-action-rotation");
      element.style.removeProperty("--inline-action-opacity");
      element.style.removeProperty("--inline-action-brightness");
      const baseTransform = element.dataset.baseTransform || "";
      if (baseTransform) element.style.transform = baseTransform;
    }

    function inlineActionTransform(action) {
      if (!action || action.action === "none" || action.action === "pulse") return "";
      if (action.action === "translate") return "translate(" + (action.offsetX || action.strength || 0) + "px, " + (action.offsetY || 0) + "px)";
      if (action.action === "translate-x") return "translateX(" + (action.offsetX || action.strength || 0) + "px)";
      if (action.action === "translate-y") return "translateY(" + (action.offsetY || action.strength || 0) + "px)";
      if (action.action === "scale") return "scale(" + (action.scale || 1.08) + ")";
      return "";
    }

    function isPersistentInlineAction(action) {
      return action && (
        action.action === "translate" ||
        action.action === "translate-x" ||
        action.action === "translate-y" ||
        action.action === "rotate" ||
        action.action === "opacity" ||
        action.action === "brightness"
      );
    }

    function applyInlineAction(action) {
      if (!action || action.action === "none") return;
      const duration = Math.max(0, action.duration || 0);
      const target =
        action.kind === "scene"
          ? stageEl.querySelector('.scene-image, #nodeVideo')
          : stageEl.querySelector('.character-img[data-source-id="' + cssEscape(action.sourceNodeId || "") + '"]') ||
            Array.from(stageEl.querySelectorAll(".character-img")).find((img) => (img.getAttribute("alt") || "") === (action.name || ""));
      if (!target) return;
      clearInlineActionElement(target);
      target.style.setProperty("--inline-action-duration", duration + "ms");
      const repeats = Math.max(1, Math.round(action.repeats || 1));
      target.style.setProperty("--inline-action-step-duration", Math.max(40, duration / repeats) + "ms");
      target.style.setProperty("--inline-action-count", repeats);
      target.style.setProperty("--inline-action-strength", Math.max(1, action.strength || 14) + "px");
      target.style.setProperty("--inline-action-scale", action.scale || 1.08);
      target.style.setProperty("--inline-action-rotation", Math.max(-360, Math.min(360, action.strength || 15)) + "deg");
      target.style.setProperty("--inline-action-opacity", Math.max(0, Math.min(1, (action.strength || 0) / 100)));
      target.style.setProperty("--inline-action-brightness", Math.max(0, Math.min(1, (action.strength || 0) / 100)));
      const baseTransform = target.dataset.baseTransform || target.style.transform || "";
      target.dataset.baseTransform = baseTransform;
      const transform = inlineActionTransform(action);
      if (transform) {
        target.style.transition = "transform " + duration + "ms ease";
        target.style.transform = (baseTransform ? baseTransform + " " : "") + transform;
      } else {
        if (action.action === "shake-x") target.classList.add("inline-shake-x");
        if (action.action === "shake-y") target.classList.add("inline-shake-y");
        if (action.action === "pulse") target.classList.add("inline-pulse");
        if (action.action === "rotate") target.classList.add("inline-rotate");
        if (action.action === "opacity") target.classList.add("inline-opacity");
        if (action.action === "brightness") target.classList.add("inline-brightness");
      }
      if (!isPersistentInlineAction(action)) {
        const resetTimer = setTimeout(() => clearInlineActionElement(target), duration);
        typewriterTimers.push(resetTimer);
      }
    }

    function applyTypewriter(element, html, rawHtml, presentation, enabled, revealChoices) {
      if (!element) return;
      if (!enabled) {
        element.classList.remove("typewriter-reserved");
        element.innerHTML = html || "";
        if (revealChoices) showChoicesAndMaybeAdvance();
        return;
      }
      const playbackSteps = buildInlinePlaybackSteps(rawHtml || html || "", html || "", presentation);
      const source = playbackSteps.filter((step) => step.kind === "text").map((step) => stripHtml(step.html)).join("");
      element.classList.add("typewriter-reserved");
      element.innerHTML = "";
      const placeholder = document.createElement("span");
      placeholder.className = "typewriter-placeholder";
      placeholder.textContent = source || " ";
      placeholder.setAttribute("aria-hidden", "true");
      const visible = document.createElement("span");
      visible.className = "typewriter-visible";
      element.append(placeholder, visible);
      let stepIndex = 0;
      let committedText = "";
      let segmentTimer = 0;
      visible.textContent = "";
      const playNextStep = () => {
        clearInterval(segmentTimer);
        const step = playbackSteps[stepIndex];
        if (!step) {
          visible.textContent = committedText;
          if (revealChoices) showChoicesAndMaybeAdvance();
          return;
        }
        if (step.kind === "action") {
          applyInlineAction(step.action);
          const waitTimer = setTimeout(() => {
            stepIndex += 1;
            playNextStep();
          }, Math.max(0, step.action.duration || 0));
          typewriterTimers.push(waitTimer);
          return;
        }
        const segmentText = stripHtml(step.html);
        const segmentUnits = style.bodyTypewriterMode === "line"
          ? segmentText.split(/(\\n+)/)
          : (style.bodyTypewriterMode === "sentence" || style.bodyTypewriterMode === "word")
            ? (segmentText.match(/[^銆傦紒锛?!?\\n]+[銆傦紒锛?!?]*|\\n+/g) || Array.from(segmentText))
            : Array.from(segmentText);
        let segmentIndex = 0;
        segmentTimer = setInterval(() => {
          segmentIndex += 1;
          visible.textContent = committedText + segmentUnits.slice(0, segmentIndex).join("");
          if (segmentIndex >= segmentUnits.length) {
            clearInterval(segmentTimer);
            committedText += segmentText;
            stepIndex += 1;
            playNextStep();
          }
        }, settings.typewriterSpeed);
        typewriterTimers.push(segmentTimer);
      };
      playNextStep();
      return;
      const units = style.bodyTypewriterMode === "line"
        ? source.split(/(\\n+)/)
        : (style.bodyTypewriterMode === "sentence" || style.bodyTypewriterMode === "word")
          ? (source.match(/[^。！？.!?\\n]+[。！？.!?]*|\\n+/g) || Array.from(source))
          : Array.from(source);
      let index = 0;
      visible.textContent = "";
      const timer = setInterval(() => {
        index += 1;
        visible.textContent = units.slice(0, index).join("");
        if (index >= units.length) {
          clearInterval(timer);
          typewriterTimers = typewriterTimers.filter((item) => item !== timer);
          if (revealChoices) showChoicesAndMaybeAdvance();
        }
      }, settings.typewriterSpeed);
      typewriterTimers.push(timer);
    }

    function choicesHtml(node, edges, className) {
      if (!edges.length) {
        return '<div class="choices ' + className + '"><button class="choice anim-fade" data-target="THE_END">' + labels.end + '</button></div>';
      }
      const buttons = edges.map((edge, index) => {
        const target = nodeById.get(edge.target);
        const label = nodeTitle(target) || edge.label || (edges.length === 1 ? labels.continue : labels.option + " " + (index + 1));
        return '<button class="choice anim-fade" data-target="' + escapeAttr(edge.target) + '">' + escapeHtml(label) + '</button>';
      }).join("");
      return '<div class="choices ' + className + '">' + buttons + '</div>';
    }

    function renderChoices(node, edges, position) {
      if (settings.skipSingleChoicePopup && position === "center" && edges.length <= 1) return "";
      return choicesHtml(node, edges, position);
    }

    function bindChoices() {
      stageEl.querySelectorAll("[data-target]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          autoAdvanceHoldId = null;
          goTo(button.getAttribute("data-target"));
        });
      });
    }

    function showChoicesAndMaybeAdvance() {
      stageEl.querySelectorAll(".choices").forEach((element) => {
        element.hidden = false;
      });
      bindChoices();
      const node = nodeById.get(currentId);
      const hasMedia = Boolean(
        node &&
          node.data &&
          (node.data.audioUrl || (node.data.videoUrl && !node.data.imageUrl)),
      );
      if (
        settings.autoAdvance &&
        autoAdvanceHoldId !== currentId &&
        !hasMedia &&
        outEdges(currentId).length <= 1
      ) {
        const sessionId = playbackSession;
        autoAdvanceTimer = setTimeout(() => {
          if (sessionId !== playbackSession) return;
          const next = outEdges(currentId)[0]?.target || "THE_END";
          goTo(next);
        }, 900);
      }
    }

    function maybeAdvanceAfterMedia() {
      if (!settings.autoAdvance || autoAdvanceHoldId === currentId || outEdges(currentId).length > 1) return;
      if (currentAudioEnded && currentVideoEnded) {
        goTo(outEdges(currentId)[0]?.target || "THE_END");
      }
    }

    function continueFromText() {
      if (!currentId || currentId === "THE_END") return;
      autoAdvanceHoldId = null;
      const edges = outEdges(currentId);
      if (edges.length <= 1) {
        goTo(edges[0]?.target || "THE_END");
      }
    }

    function render() {
      clearPlaybackTimers();
      backButton.disabled = history.length === 0;
      if (!currentId) {
        syncRegionMusic(null);
        backdropEl.style.backgroundImage = "";
        stageEl.innerHTML = '<div class="end">' + labels.noStory + '</div>';
        return;
      }
      if (currentId === "THE_END") {
        syncRegionMusic(null);
        stageEl.innerHTML = '<div class="end">' + labels.end + '</div>';
        return;
      }
      const node = nodeById.get(currentId);
      if (!node) {
        currentId = "THE_END";
        render();
        return;
      }
      const data = node.data || {};
      if (node.type === "numberConditionNode") {
        if (currentId === lastJumpedNode) return;
        lastJumpedNode = currentId;
        history.push(currentId);
        currentId = numberConditionTarget(node);
        render();
        return;
      }
      if (data.skip === true) {
        if (currentId === lastJumpedNode) return;
        lastJumpedNode = currentId;
        history.push(currentId);
        currentId = outEdges(currentId)[0]?.target || "THE_END";
        render();
        return;
      }
      syncRegionMusic(data.backgroundMusic || null);
      const edges = outEdges(currentId);
      const choicePosition = settings.choicesPosition || "belowText";
      const hideCenteredTitle = style.titleVisible === false;
      const image = data.imageUrl || "";
      const video = data.videoUrl || "";
      currentAudioEnded = !data.audioUrl;
      currentVideoEnded = !video || Boolean(image);

      // 场景入场及基础样式计算
      const sceneEnter = data.presentation && data.presentation.scene && data.presentation.scene.enter;
      const hasSceneEnter = sceneEnter && sceneEnter.type !== "none";
      const sceneDuration = hasSceneEnter ? (sceneEnter.duration || 0) : 0;
      const sceneCrop = data.presentation && data.presentation.scene && data.presentation.scene.cropMode;
      const sceneScale = data.presentation && data.presentation.scene && data.presentation.scene.scale || 1;
      const sceneOffsetX = data.presentation && data.presentation.scene && data.presentation.scene.offsetX || 0;
      const sceneOffsetY = data.presentation && data.presentation.scene && data.presentation.scene.offsetY || 0;
      const sceneObjectFit = sceneCrop === 'contain' ? 'contain' : sceneCrop === 'stretch' ? 'fill' : 'cover';
      const immersive = settings.layoutMode === 'immersive';
      const finalCrop = immersive ? 'contain' : (sceneCrop ? sceneObjectFit : 'contain');
      const finalOffsetX = immersive ? 0 : sceneOffsetX;
      const finalOffsetY = immersive ? 0 : sceneOffsetY;
      
      const initSceneOpacity = (hasSceneEnter && sceneEnter.type === 'fade') ? 0 : 1;
      const initSceneTransform = hasSceneEnter ? getPresentationTransform(sceneEnter.type, false) : 'none';
      const initSceneStyle = 
        'object-fit: ' + finalCrop + '; ' +
        'object-position: ' + (50 + finalOffsetX) + '% ' + (50 + finalOffsetY) + '%; ' +
        'opacity: ' + initSceneOpacity + '; ' +
        'transform: ' + initSceneTransform + '; ' +
        'transition: opacity ' + sceneDuration + 'ms ease-out, transform ' + sceneDuration + 'ms ease-out;';

      const media = image
        ? '<img class="scene-image" src="' + escapeAttr(image) + '" alt="" style="' + initSceneStyle.replace('object-fit: ' + finalCrop, 'object-fit: contain') + '" />'
        : video
          ? '<video id="nodeVideo" src="' + escapeAttr(video) + '" controls playsinline style="' + initSceneStyle + '" ' + (settings.videoAutoPlay || settings.autoAdvance ? 'autoplay muted ' : '') + '></video>'
          : labels.noStory;

      let charactersHtml = "";
      let nameplatesHtml = "";
      if (data.presentation && Array.isArray(data.presentation.characters)) {
        const dialogWidth = clamp(style.dialogWidth, 35, 100, 86);
        const dialogLeft = 50 + clamp(style.dialogOffsetX, -100, 100, 0) * 0.5 - dialogWidth / 2;
        const visibleNameplates = style.nameplateVisible !== false
          ? data.presentation.characters.filter((char) => char && char.name)
          : [];
        if (visibleNameplates.length) {
          const total = visibleNameplates.length;
          nameplatesHtml = '<div class="nameplate-layer ' + (style.nameplateInside ? 'inside' : 'outside') + '">' +
            visibleNameplates.map((char, idx) => {
              const basePosition = char.position === "left" ? 24 : char.position === "right" ? 76 : 50;
              const characterCenter = basePosition + (Number(char.offsetX) || 0) / 10;
              const localLeft = style.nameplateFollowCharacter === false
                ? 50 + (idx - (total - 1) / 2) * 18
                : Math.max(4, Math.min(96, ((characterCenter - dialogLeft) / dialogWidth) * 100));
              return '<div class="nameplate" style="left: ' + localLeft + '%">' + escapeHtml(char.name || "") + '</div>';
            }).join("") +
            '</div>';
        }
        charactersHtml = '<div class="characters-layer">' +
          data.presentation.characters.map((char) => {
            const charEnter = char.enter;
            const hasCharEnter = charEnter && charEnter.type !== "none";
            const charDuration = hasCharEnter ? (charEnter.duration || 0) : 0;
            
            const basePosition = char.position === "left" ? 24 : char.position === "right" ? 76 : 50;
            const left = "calc(" + basePosition + "% + " + (char.offsetX / 10) + "%)";
            const bottom = (char.offsetY / 10) + "%";
            const zIndex = Math.min(20, Math.max(1, char.layer || 1));
            const flipScale = char.flipX ? -1 : 1;
            const scale = char.scale || 1;
            
            const initCharOpacity = (hasCharEnter && charEnter.type === 'fade') ? 0 : 1;
            const initCharTransform = 'translate(-50%, 0) ' + (hasCharEnter ? getPresentationTransform(charEnter.type, false) : '') + ' scale(' + scale + ') scaleX(' + flipScale + ')';
            
            return '<img class="character-img" src="' + escapeAttr(char.imageUrl) + '" alt="' + escapeAttr(char.name || "") + '" data-source-id="' + escapeAttr(char.sourceNodeId || "") + '" ' +
              'style="' +
                'left: ' + left + '; ' +
                'bottom: ' + bottom + '; ' +
                'z-index: ' + zIndex + '; ' +
                'opacity: ' + initCharOpacity + '; ' +
                'transform: ' + initCharTransform + '; ' +
                'transition: opacity ' + charDuration + 'ms ease-out ' + sceneDuration + 'ms, transform ' + charDuration + 'ms ease-out ' + sceneDuration + 'ms;' +
              '" />';
          }).join("") +
          "</div>";
      }

      backdropEl.style.backgroundImage = image ? 'url("' + image.replace(/"/g, '\\"') + '")' : "";
      stageEl.innerHTML =
        '<div class="media ' + (!image && !video ? 'empty' : '') + '">' +
          '<div class="presentation-scale" style="transform: scale(' + sceneScale + ')">' +
            media + charactersHtml +
          '</div>' +
        '</div>' +
        '<div class="dialogue">' +
          nameplatesHtml +
          (choicePosition === "aboveText" ? renderChoices(node, edges, "above") : "") +
          (hideCenteredTitle ? "" : '<h2 class="title' + animationClass(style.titleAnimation) + '">' + escapeHtml(data.title || "") + '</h2>') +
          '<div class="text' + animationClass(style.bodyAnimation) + '" id="nodeText">' + (data.text || "") + '</div>' +
          (data.audioUrl ? '<audio id="nodeAudio" src="' + escapeAttr(data.audioUrl) + '" preload="auto" hidden></audio>' : '') +
          (choicePosition === "belowText" ? renderChoices(node, edges, "below") : "") +
        '</div>' +
        (choicePosition === "center" ? renderChoices(node, edges, "center") : "");
      watchZenButtonPosition();

      // 在下一个渲染帧中触发入场动画过渡到正常状态
      setTimeout(() => {
        const mediaEl = stageEl.querySelector('.scene-image, #nodeVideo');
        if (mediaEl) {
          mediaEl.style.opacity = '1';
          mediaEl.style.transform = 'none';
          mediaEl.dataset.baseTransform = 'none';
        }
        
        if (data.presentation && Array.isArray(data.presentation.characters)) {
          const charImgs = stageEl.querySelectorAll('.character-img');
          data.presentation.characters.forEach((char, idx) => {
            const imgEl = charImgs[idx];
            if (imgEl) {
              imgEl.style.opacity = '1';
              const flipScale = char.flipX ? -1 : 1;
              const scale = char.scale || 1;
              const baseTransform = 'translate(-50%, 0) scale(' + scale + ') scaleX(' + flipScale + ')';
              imgEl.style.transform = baseTransform;
              imgEl.dataset.baseTransform = baseTransform;
            }
          });
        }
      }, 50);
      const nodeAudio = document.getElementById("nodeAudio");
      if (nodeAudio) {
        nodeAudio.addEventListener("play", () => recordAudio(node, data.audioUrl));
        nodeAudio.addEventListener("ended", () => {
          currentAudioEnded = true;
          maybeAdvanceAfterMedia();
        });
        nodeAudio.play().catch(() => {});
      }
      const nodeVideo = document.getElementById("nodeVideo");
      if (nodeVideo) {
        nodeVideo.addEventListener("ended", () => {
          currentVideoEnded = true;
          maybeAdvanceAfterMedia();
        });
        if (settings.autoAdvance) nodeVideo.play().catch(() => {});
      }
      const hideChoicesDuringTypewriter = settings.autoAdvance && settings.interactionMode === "typewriter";
      stageEl.querySelectorAll(".choices").forEach((element) => {
        element.hidden = hideChoicesDuringTypewriter;
      });
      if (!hideChoicesDuringTypewriter) bindChoices();
      applyTypewriter(
        document.getElementById("nodeText"),
        data.text || "",
        data.rawText || data.text || "",
        data.presentation || null,
        settings.interactionMode === "typewriter" || style.bodyAnimation === "typewriter",
        true
      );
      if (settings.interactionMode !== "typewriter" && style.bodyAnimation !== "typewriter") showChoicesAndMaybeAdvance();
    }

    function escapeHtml(value) {
      return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    }
    function escapeAttr(value) { return escapeHtml(value); }

    backButton.addEventListener("click", () => {
      restartPlaybackSession();
      let previous = history.pop();
      while (previous) {
        const previousNode = nodeById.get(previous);
        if (
          previousNode &&
          (previousNode.type === "numberConditionNode" || (previousNode.data && previousNode.data.skip === true))
        ) {
          previous = history.pop();
          continue;
        }
        break;
      }
      if (previous) {
        currentId = previous;
        render();
      } else {
        currentId = root ? root.id : null;
        render();
      }
      writeSave();
    });
    resetButton.addEventListener("click", () => {
      restartPlaybackSession();
      history = [];
      currentId = root ? root.id : null;
      autoAdvanceHoldId = currentId;
      render();
      writeSave();
    });
    mainMenuButton.addEventListener("click", returnToMainMenu);
    autoButton.addEventListener("click", () => {
      settings.autoAdvance = !settings.autoAdvance;
      updateAutoButton();
      updateSettingsPanel();
      render();
      writeSave();
    });
    saveSlotButton.addEventListener("click", continueSavedGame);
    newGameButton.addEventListener("click", startNewGame);
    settingsButton.addEventListener("click", openSettingsPanel);
    settingsClose.addEventListener("click", closeSettingsPanel);
    settingsBackdrop.addEventListener("click", (event) => {
      if (event.target === settingsBackdrop) closeSettingsPanel();
    });
    settingAutoButton.addEventListener("click", () => {
      settings.autoAdvance = !settings.autoAdvance;
      updateAutoButton();
      updateSettingsPanel();
      if (!startScreen.classList.contains("open")) render();
      writeSave();
    });
    settingSpeedInput.addEventListener("input", () => {
      settings.typewriterSpeed = Math.max(0, Number(settingSpeedInput.value) || 65);
      updateSettingsPanel();
      writeSave();
    });
    settingControlsButton.addEventListener("click", () => {
      controlsHidden = !controlsHidden;
      document.querySelector(".app").classList.toggle("controls-hidden", controlsHidden);
      zenButton.innerHTML = '<img src="./icons/' + (controlsHidden ? 'eye-off.svg' : 'eye.svg') + '" alt="" />';
      updateSettingsPanel();
      writeSave();
    });
    playlistButton.addEventListener("click", () => {
      const open = !playlistBackdrop.classList.contains("open");
      playlistBackdrop.classList.toggle("open", open);
      playlistButton.setAttribute("aria-expanded", String(open));
    });
    playlistClose.addEventListener("click", () => {
      playlistBackdrop.classList.remove("open");
      playlistButton.setAttribute("aria-expanded", "false");
    });
    playlistBackdrop.addEventListener("click", (event) => {
      if (event.target !== playlistBackdrop) return;
      playlistBackdrop.classList.remove("open");
      playlistButton.setAttribute("aria-expanded", "false");
    });
    playlistAudio.addEventListener("play", renderPlaylist);
    playlistAudio.addEventListener("pause", renderPlaylist);
    playlistAudio.addEventListener("ended", renderPlaylist);
    window.addEventListener("resize", updateZenButtonPosition);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", updateZenButtonPosition);
    zenButton.addEventListener("click", () => {
      controlsHidden = !controlsHidden;
      document.querySelector(".app").classList.toggle("controls-hidden", controlsHidden);
      zenButton.innerHTML = '<img src="./icons/' + (controlsHidden ? 'eye-off.svg' : 'eye.svg') + '" alt="" />';
      updateSettingsPanel();
      writeSave();
    });
    window.addEventListener("pagehide", writeSave);
    document.querySelector(".app")?.addEventListener("click", (event) => {
      if ((settings.autoAdvance && autoAdvanceHoldId !== currentId) || !currentId || currentId === "THE_END") return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          "header, button, a, video, audio, input, select, textarea, .playlist-backdrop"
        )
      ) {
        return;
      }
      continueFromText();
    });
    updateSettingsPanel();
    if (settings.showStartMenu) {
      showStartMenu();
    } else {
      renderPlaylist();
      render();
    }
  </script>
</body>
</html>`;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[char] || char;
  });
}

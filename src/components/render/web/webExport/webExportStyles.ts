export const WEB_EXPORT_STYLES = String.raw`
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: #10131a;
      color: #f8fafc;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      display: grid;
      place-items: center;
    }
    button { font: inherit; }
    .canvas-shell {
      position: relative;
      flex: 0 0 auto;
      overflow: hidden;
      transform-origin: center center;
    }
    .app {
      width: 100%;
      height: 100%;
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
      height: 100%;
      max-height: 100%;
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
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--nameplate-width, auto);
      height: var(--nameplate-height, auto);
      max-width: none;
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
      transform: translate(calc(-50% + var(--nameplate-offset-x, 0px)), var(--nameplate-translate-y, -100%)) var(--nameplate-object-transform, rotate(0deg) scale(1, 1));
    }
    .nameplate-layer.inside .nameplate {
      background: transparent;
      box-shadow: none;
      text-shadow: 0 1px 10px rgba(0,0,0,0.42);
      transform: translate(calc(-50% + var(--nameplate-offset-x, 0px)), var(--nameplate-offset-y, 0px));
    }
    .dialogue {
      position: absolute;
      left: var(--dialog-left, 0px);
      top: var(--dialog-top, 0px);
      z-index: 3;
      box-sizing: border-box;
      width: var(--dialog-width, 86%);
      display: block;
      border-top: 1px solid var(--dialog-border-color, rgba(255,255,255,0.14));
      height: var(--dialog-height, 34vh);
      padding: 20px var(--dialog-padding-x, 9%);
      background: var(--dialog-background, rgba(7, 10, 16, 0.82));
      border-radius: var(--dialog-radius, 12px);
      box-shadow: var(--dialog-shadow, 0 -14px 36px rgba(0,0,0,0.18));
      backdrop-filter: var(--dialog-backdrop-filter, none);
      overflow: auto;
      transform: var(--dialog-object-transform, none);
    }
    .app.immersive .dialogue {
      position: absolute;
      left: var(--dialog-left, 50%);
      top: var(--dialog-top, 0px);
      z-index: 4;
      margin: 0;
      width: var(--dialog-width, 86%);
      height: var(--dialog-height, 34vh);
      padding: 20px var(--dialog-padding-x, 9%);
      transform: var(--dialog-object-transform, rotate(0deg) scale(1, 1));
      border: var(--dialog-border-width, 1px) solid var(--dialog-border-color, rgba(255,255,255,0.12));
      border-radius: var(--dialog-radius, 12px);
      background: var(--dialog-background, rgba(7, 10, 16, 0.82));
      box-shadow: var(--dialog-shadow, 0 24px 80px rgba(0,0,0,0.30));
      backdrop-filter: var(--dialog-backdrop-filter, blur(18px));
    }
    .title {
      margin: 0 0 8px;
      color: transparent;
      background: var(--title-fill, var(--title-color, #f8fafc));
      -webkit-background-clip: text;
      background-clip: text;
      font-size: var(--title-size, 18px);
      font-family: var(--title-font-family, inherit);
      font-weight: 900;
      width: var(--title-width, auto);
      height: var(--title-height, auto);
      line-height: var(--title-line-height, 1.18);
      letter-spacing: var(--title-letter-spacing, 0px);
      text-align: var(--title-align, left);
      -webkit-text-stroke: var(--title-stroke, 0 transparent);
      text-shadow: var(--title-shadow, none);
      overflow-wrap: anywhere;
      transform: var(--title-transform, none);
    }
    .text {
      color: transparent;
      background: var(--body-fill, var(--body-color, #e5e7eb));
      -webkit-background-clip: text;
      background-clip: text;
      font-family: var(--body-font-family, inherit);
      width: var(--body-width, auto);
      height: var(--body-height, auto);
      line-height: var(--body-line-height, 1.55);
      font-size: var(--body-size, 16px);
      letter-spacing: var(--body-letter-spacing, 0px);
      text-align: var(--body-align, left);
      -webkit-text-stroke: var(--body-stroke, 0 transparent);
      text-shadow: var(--body-shadow, none);
      overflow-wrap: anywhere;
      transform: var(--body-transform, none);
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
      white-space: pre-wrap;
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
        height: 100%;
        max-height: 100%;
      }
    }
`;

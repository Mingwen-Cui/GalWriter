import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// The player embeds only an empty page and never links the editor, MCP, or presets.
const mobileTarget = ['android', 'ios'].includes(process.env.TAURI_ENV_PLATFORM);
if (process.platform === 'win32' && !mobileTarget) {
  const target = resolve('src-tauri', 'player', 'target');
  const playerEnv = { ...process.env };
  delete playerEnv.TAURI_CONFIG;
  const result = spawnSync(
    'cargo',
    [
      'build',
      '--release',
      '--locked',
      '--manifest-path',
      resolve('src-tauri/player/Cargo.toml'),
      '--target-dir',
      target,
    ],
    {
      env: playerEnv,
      stdio: 'inherit',
      shell: false,
    },
  );
  if (result.status !== 0) process.exit(result.status || 1);
  const destination = resolve('src-tauri', 'player-runtime');
  mkdirSync(destination, { recursive: true });
  copyFileSync(
    resolve(target, 'release', 'galwriter-player.exe'),
    resolve(destination, 'galwriter-player.exe'),
  );
  const loader = resolve(target, 'release', 'WebView2Loader.dll');
  if (existsSync(loader)) copyFileSync(loader, resolve(destination, 'WebView2Loader.dll'));
}

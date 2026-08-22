import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const [target, requestedEdition] = process.argv.slice(2);
const edition = requestedEdition === 'lite' ? 'lite' : 'full';
const tauriEntry = resolve('node_modules', '@tauri-apps', 'cli', 'tauri.js');

if (!['windows', 'android'].includes(target)) {
  throw new Error('Usage: node build-scripts/build-tauri-edition.mjs <windows|android> <full|lite>');
}

const args = target === 'android' ? ['android', 'build', '--apk', '--aab'] : ['build'];
const result = spawnSync(process.execPath, [tauriEntry, ...args], {
  cwd: resolve('.'),
  env: {
    ...process.env,
    GALWRITER_ASSET_EDITION: edition,
    VITE_ASSET_EDITION: edition,
  },
  stdio: 'inherit',
  shell: false,
});

process.exit(typeof result.status === 'number' ? result.status : 1);

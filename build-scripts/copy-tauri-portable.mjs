import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const variant = process.argv[2] ?? 'lite';
if (variant !== 'lite') {
  console.error('Usage: node build-scripts/copy-tauri-portable.mjs lite');
  process.exit(1);
}

const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const version = packageJson.version;
const appExe = resolve('src-tauri', 'target', 'release', 'app.exe');
const releaseDir = resolve('release');

if (!existsSync(appExe)) {
  console.error(`Portable app executable not found: ${appExe}`);
  console.error('Run a Tauri release build first.');
  process.exit(1);
}

mkdirSync(releaseDir, { recursive: true });

const portableExeName = `GalWriter-AI-v${version}-windows-x64.exe`;
const portableExe = join(releaseDir, portableExeName);

copyFileSync(appExe, portableExe);
console.log(`Copied ${basename(appExe)} -> ${portableExe}`);

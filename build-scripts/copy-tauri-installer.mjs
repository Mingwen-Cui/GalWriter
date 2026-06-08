import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const variant = process.argv[2];
const outputNameByVariant = {
  full: 'GalWriter-Setup.exe',
  lite: 'GalWriter-Setup-Lite.exe',
};

const outputName = outputNameByVariant[variant];
if (!outputName) {
  console.error('Usage: node build-scripts/copy-tauri-installer.mjs <full|lite>');
  process.exit(1);
}

const nsisDir = resolve('src-tauri', 'target', 'release', 'bundle', 'nsis');
if (!existsSync(nsisDir)) {
  console.error(`NSIS bundle directory not found: ${nsisDir}`);
  process.exit(1);
}

const installers = readdirSync(nsisDir)
  .filter((name) => name.toLowerCase().endsWith('.exe'))
  .map((name) => {
    const path = join(nsisDir, name);
    return { path, mtimeMs: statSync(path).mtimeMs };
  })
  .sort((a, b) => b.mtimeMs - a.mtimeMs);

if (installers.length === 0) {
  console.error(`No NSIS .exe installer found in ${nsisDir}`);
  process.exit(1);
}

const releaseDir = resolve('release');
mkdirSync(releaseDir, { recursive: true });

const destination = join(releaseDir, outputName);
copyFileSync(installers[0].path, destination);
console.log(`Copied ${basename(installers[0].path)} -> ${destination}`);

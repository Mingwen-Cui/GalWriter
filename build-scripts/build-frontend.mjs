import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const requestedEdition = process.argv[2] || process.env.GALWRITER_ASSET_EDITION || 'full';
const edition = requestedEdition === 'lite' ? 'lite' : 'full';
const rootDir = resolve('.');
const sourcePublicDir = resolve('public');
const litePublicDir = resolve('.build', 'asset-editions', 'lite-public');
const omittedResourcePacks = new Set(['assistant', 'presets', 'cover-templates', 'web-homepage']);
const viteEntry = resolve('node_modules', 'vite', 'bin', 'vite.js');

const prepareLitePublicDirectory = () => {
  rmSync(litePublicDir, { recursive: true, force: true });
  mkdirSync(litePublicDir, { recursive: true });
  cpSync(sourcePublicDir, litePublicDir, {
    recursive: true,
    filter: (source) => {
      const relative = source.slice(sourcePublicDir.length).replace(/^[\\/]+/, '');
      const root = relative.split(/[\\/]/)[0];
      return !omittedResourcePacks.has(root);
    },
  });
};

if (!existsSync(sourcePublicDir)) {
  throw new Error(`Public directory was not found: ${sourcePublicDir}`);
}

const env = {
  ...process.env,
  GALWRITER_ASSET_EDITION: edition,
  VITE_ASSET_EDITION: edition,
};

if (edition === 'lite') {
  prepareLitePublicDirectory();
  env.GALWRITER_PUBLIC_DIR = litePublicDir;
  const version = JSON.parse(readFileSync(resolve('package.json'), 'utf8')).version;
  env.VITE_ASSET_BASE_URL =
    env.VITE_ASSET_BASE_URL || `https://mingwencui.com/online/galwriter-assets/v${version}/`;
}

console.log(`Building ${edition} frontend using ${env.GALWRITER_PUBLIC_DIR || sourcePublicDir}`);

const result = spawnSync(process.execPath, [viteEntry, 'build'], {
  cwd: rootDir,
  env,
  stdio: 'inherit',
  shell: false,
});

process.exit(typeof result.status === 'number' ? result.status : 1);

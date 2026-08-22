import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const edition = process.argv[2] === 'lite' ? 'lite' : 'full';
const result = spawnSync(process.execPath, ['build-scripts/prepare-release-assets.mjs'], {
  cwd: resolve('.'),
  env: { ...process.env, GALWRITER_ASSET_EDITION: edition },
  stdio: 'inherit',
  shell: false,
});

process.exit(typeof result.status === 'number' ? result.status : 1);

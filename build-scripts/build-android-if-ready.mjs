import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = resolve('.');
const localSdkRoot = process.env.LOCALAPPDATA
  ? join(process.env.LOCALAPPDATA, 'Android', 'Sdk')
  : null;
const androidHome = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? localSdkRoot;
const androidProjectDir = resolve('src-tauri', 'gen', 'android');
const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const log = (message) => console.log(message);
const warn = (message) => console.warn(message);

const findLatestSubdirectory = (parentDir) => {
  if (!parentDir || !existsSync(parentDir)) {
    return null;
  }

  const entries = readdirSync(parentDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const fullPath = join(parentDir, entry.name);
      return {
        fullPath,
        mtimeMs: statSync(fullPath).mtimeMs,
      };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  return entries[0]?.fullPath ?? null;
};

const detectedNdkHome =
  process.env.NDK_HOME ??
  (androidHome ? findLatestSubdirectory(join(androidHome, 'ndk')) : null);

const env = {
  ...process.env,
};

if (androidHome) {
  env.ANDROID_HOME = env.ANDROID_HOME ?? androidHome;
  env.ANDROID_SDK_ROOT = env.ANDROID_SDK_ROOT ?? androidHome;
}

if (detectedNdkHome) {
  env.NDK_HOME = env.NDK_HOME ?? detectedNdkHome;
}

const runTauriAndroid = (args) => {
  const result = spawnSync(executable, ['tauri', 'android', ...args], {
    cwd: rootDir,
    env,
    stdio: 'inherit',
    shell: false,
  });

  if (typeof result.status === 'number') {
    return result.status;
  }

  return 1;
};

const main = () => {
  if (!env.ANDROID_HOME || !existsSync(env.ANDROID_HOME)) {
    warn('Skipping Android build: ANDROID_HOME / ANDROID_SDK_ROOT is missing or invalid.');
    process.exit(0);
  }

  if (!env.NDK_HOME || !existsSync(env.NDK_HOME)) {
    warn('Skipping Android build: Android NDK was not found. Install the NDK and set NDK_HOME if auto-detection fails.');
    process.exit(0);
  }

  if (!existsSync(androidProjectDir)) {
    log('Android project not initialized yet. Running `tauri android init --ci` first...');
    const initStatus = runTauriAndroid(['init', '--ci']);
    if (initStatus !== 0) {
      warn('Skipping Android build: `tauri android init --ci` failed.');
      process.exit(0);
    }
  }

  log(`Using ANDROID_HOME=${env.ANDROID_HOME}`);
  log(`Using NDK_HOME=${env.NDK_HOME}`);

  const buildStatus = runTauriAndroid(['build', '--apk', '--aab']);
  if (buildStatus !== 0) {
    process.exit(buildStatus);
  }
};

main();

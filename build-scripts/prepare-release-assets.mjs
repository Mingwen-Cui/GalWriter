import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import JSZip from 'jszip';

const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const tauriConfig = JSON.parse(readFileSync(resolve('src-tauri', 'tauri.conf.json'), 'utf8'));

const version = packageJson.version;
const productName = tauriConfig.productName ?? 'GalWriter AI';
const releaseDir = resolve('release');
const distDir = resolve('dist');
const targetReleaseDir = resolve('src-tauri', 'target', 'release');
const bundleDir = resolve(targetReleaseDir, 'bundle');
const windowsAssetPrefix = `GalWriter-AI-v${version}-windows-x64`;
const webAssetPrefix = `GalWriter-AI-v${version}-web`;
const androidAssetPrefix = `GalWriter-AI-v${version}-android`;
const portableDirName = `${windowsAssetPrefix}-portable`;
const portableDir = resolve(releaseDir, portableDirName);
const portableZipPath = resolve(releaseDir, `${portableDirName}.zip`);
const webStageDir = resolve(releaseDir, `${webAssetPrefix}-dist`);
const webZipPath = resolve(releaseDir, `${webAssetPrefix}.zip`);
const portableExeName = 'GalWriter-AI.exe';
const runtimeSidecarName = 'ffmpeg.exe';
const rawAppExe = resolve(targetReleaseDir, 'app.exe');
const bundledFfmpeg = resolve(targetReleaseDir, 'binaries', runtimeSidecarName);
const androidOutputsRoot = resolve('src-tauri', 'gen', 'android', 'app', 'build', 'outputs');

const releaseArtifactsToRemove = [
  'GalWriter-Setup.exe',
  'GalWriter-Setup-Lite.exe',
  `GalWriter-AI-v${version}-windows-x64.exe`,
  `GalWriter-AI-v${version}-windows-x64-portable-full.zip`,
  `GalWriter-AI-v${version}-windows-x64-portable-full`,
  portableDirName,
  `${webAssetPrefix}-dist`,
  `${webAssetPrefix}.zip`,
  `${androidAssetPrefix}-release-signed.apk`,
  `${androidAssetPrefix}-release.aab`,
];

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const ensureDirectory = (path) => {
  mkdirSync(path, { recursive: true });
};

const copyDirectoryRecursive = (sourceDir, destinationDir) => {
  ensureDirectory(destinationDir);

  for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = join(sourceDir, entry.name);
    const destinationPath = join(destinationDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(sourcePath, destinationPath);
      continue;
    }

    copyFileSync(sourcePath, destinationPath);
  }
};

const zipDirectory = async (sourceDir, destinationZip) => {
  const zip = new JSZip();

  const addFolder = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        addFolder(fullPath);
        continue;
      }

      const relativePath = relative(sourceDir, fullPath).replace(/\\/g, '/');
      zip.file(relativePath, readFileSync(fullPath));
    }
  };

  addFolder(sourceDir);
  const content = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
  writeFileSync(destinationZip, content);
};

const findLatestBundleFile = (directoryName, matcher) => {
  const directory = resolve(bundleDir, directoryName);
  if (!existsSync(directory)) {
    throw new Error(`Bundle directory not found: ${directory}`);
  }

  const entries = readdirSync(directory)
    .filter((name) => matcher.test(name))
    .map((name) => {
      const fullPath = join(directory, name);
      return {
        fullPath,
        name,
        mtimeMs: statSync(fullPath).mtimeMs,
      };
    })
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  if (entries.length === 0) {
    throw new Error(`No matching bundle found in ${directory}`);
  }

  return entries[0].fullPath;
};

const collectNewestMatchingFile = (rootDir, matcher) => {
  if (!existsSync(rootDir)) {
    return null;
  }

  const found = [];

  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (matcher.test(entry.name)) {
        found.push({
          fullPath,
          mtimeMs: statSync(fullPath).mtimeMs,
        });
      }
    }
  };

  walk(rootDir);
  found.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return found[0]?.fullPath ?? null;
};

const prepareWindowsAssets = async () => {
  const productPattern = new RegExp(`^${escapeRegex(productName)}_${escapeRegex(version)}_`);
  const nsisPath = findLatestBundleFile('nsis', new RegExp(`${productPattern.source}.*-setup\\.exe$`, 'i'));
  const msiPath = findLatestBundleFile('msi', new RegExp(`${productPattern.source}.*\\.msi$`, 'i'));

  const setupPath = resolve(releaseDir, `${windowsAssetPrefix}-setup.exe`);
  const msiOutputPath = resolve(releaseDir, `${windowsAssetPrefix}.msi`);

  copyFileSync(nsisPath, setupPath);
  copyFileSync(msiPath, msiOutputPath);

  if (!existsSync(rawAppExe)) {
    throw new Error(`Portable executable not found: ${rawAppExe}`);
  }

  rmSync(portableDir, { recursive: true, force: true });
  rmSync(portableZipPath, { force: true });
  ensureDirectory(portableDir);

  copyFileSync(rawAppExe, join(portableDir, portableExeName));

  const portableReadmePath = join(portableDir, 'README.txt');
  const portableReadme = [
    'GalWriter AI portable build',
    '',
    `Version: ${version}`,
    `Executable: ${portableExeName}`,
    '',
    'Extract this folder and run the executable directly.',
    'If ffmpeg.exe is included beside the app, desktop video export can use it automatically.',
  ].join('\n');
  writeFileSync(portableReadmePath, portableReadme, 'utf8');

  if (existsSync(bundledFfmpeg)) {
    copyFileSync(bundledFfmpeg, join(portableDir, runtimeSidecarName));
  }

  await zipDirectory(portableDir, portableZipPath);
  rmSync(portableDir, { recursive: true, force: true });

  return [setupPath, msiOutputPath, portableZipPath];
};

const prepareWebAssets = async () => {
  if (!existsSync(distDir)) {
    throw new Error(`Web dist directory not found: ${distDir}`);
  }

  rmSync(webStageDir, { recursive: true, force: true });
  rmSync(webZipPath, { force: true });

  copyDirectoryRecursive(distDir, webStageDir);

  const readmePath = join(webStageDir, 'README.txt');
  const content = [
    'GalWriter AI web build',
    '',
    `Version: ${version}`,
    '',
    'Deploy the extracted files to any static hosting service.',
    'Open index.html locally only for quick inspection, not as the final hosting setup.',
  ].join('\n');
  writeFileSync(readmePath, content, 'utf8');

  await zipDirectory(webStageDir, webZipPath);
  rmSync(webStageDir, { recursive: true, force: true });

  return [webZipPath];
};

const prepareAndroidAssets = () => {
  const outputs = [];

  const latestApk = collectNewestMatchingFile(androidOutputsRoot, /release.*\.apk$/i);
  if (latestApk) {
    const destination = resolve(releaseDir, `${androidAssetPrefix}-signed.apk`);
    copyFileSync(latestApk, destination);
    outputs.push(destination);
  }

  const latestAab = collectNewestMatchingFile(androidOutputsRoot, /release.*\.aab$/i);
  if (latestAab) {
    const destination = resolve(releaseDir, `${androidAssetPrefix}.aab`);
    copyFileSync(latestAab, destination);
    outputs.push(destination);
  }

  if (outputs.length === 0) {
    console.warn('Android release assets were not found under src-tauri/gen/android/app/build/outputs.');
    console.warn('Run Android init/build after installing SDK + NDK and configuring signing to include APK/AAB artifacts.');
  }

  return outputs;
};

const main = async () => {
  ensureDirectory(releaseDir);

  for (const artifactName of releaseArtifactsToRemove) {
    rmSync(resolve(releaseDir, artifactName), { recursive: true, force: true });
  }

  const outputs = [];
  outputs.push(...(await prepareWindowsAssets()));
  outputs.push(...(await prepareWebAssets()));
  outputs.push(...prepareAndroidAssets());

  console.log(`Prepared release assets for v${version}:`);
  for (const output of outputs.map((outputPath) => basename(outputPath))) {
    console.log(`- ${output}`);
  }
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

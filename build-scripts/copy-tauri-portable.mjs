import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import JSZip from 'jszip';

const variant = process.argv[2] ?? 'lite';
if (!['full', 'lite'].includes(variant)) {
  console.error('Usage: node build-scripts/copy-tauri-portable.mjs <full|lite>');
  process.exit(1);
}

const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const version = packageJson.version;
const appExe = resolve('src-tauri', 'target', 'release', 'app.exe');
const ffmpegExe = resolve('src-tauri', 'target', 'release', 'binaries', 'ffmpeg.exe');
const releaseDir = resolve('release');

if (!existsSync(appExe)) {
  console.error(`Portable app executable not found: ${appExe}`);
  console.error('Run a Tauri release build first.');
  process.exit(1);
}

mkdirSync(releaseDir, { recursive: true });

const portableExeName = `GalWriter-AI-v${version}-windows-x64.exe`;
const portableExe = join(releaseDir, portableExeName);

if (variant === 'lite') {
  copyFileSync(appExe, portableExe);
  console.log(`Copied ${basename(appExe)} -> ${portableExe}`);
  console.log('Portable Lite does not bundle FFmpeg. MP4/MOV/MKV export requires system FFmpeg.');
  process.exit(0);
}

if (!existsSync(ffmpegExe)) {
  console.error(`Bundled FFmpeg not found: ${ffmpegExe}`);
  console.error('Run the Full Tauri build or make sure src-tauri/binaries/ffmpeg.exe exists before building.');
  process.exit(1);
}

const folderName = `GalWriter-AI-v${version}-windows-x64-portable-full`;
const folder = join(releaseDir, folderName);
rmSync(folder, { recursive: true, force: true });
mkdirSync(folder, { recursive: true });

const folderAppExe = join(folder, portableExeName);
const folderFfmpegExe = join(folder, 'ffmpeg.exe');
copyFileSync(appExe, folderAppExe);
copyFileSync(ffmpegExe, folderFfmpegExe);

const zip = new JSZip();
zip.file(`${folderName}/${portableExeName}`, readFileSync(folderAppExe));
zip.file(`${folderName}/ffmpeg.exe`, readFileSync(folderFfmpegExe));

const zipPath = join(releaseDir, `${folderName}.zip`);
const zipBytes = await zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 9 },
});
writeFileSync(zipPath, zipBytes);

console.log(`Created portable Full folder: ${folder}`);
console.log(`Created portable Full zip: ${zipPath}`);

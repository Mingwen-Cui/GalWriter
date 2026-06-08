import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const binariesDir = resolve('src-tauri', 'binaries');
const ffmpegPath = resolve(binariesDir, 'ffmpeg.exe');

if (!existsSync(ffmpegPath)) {
  console.error(
    [
      'Missing src-tauri/binaries/ffmpeg.exe.',
      'The full desktop installer must include a bundled FFmpeg binary.',
      'Use npm run tauri:build:lite if you intentionally want a small installer without FFmpeg.',
    ].join('\n'),
  );
  process.exit(1);
}

const extraFiles = readdirSync(binariesDir).filter((name) => name !== 'ffmpeg.exe');
if (extraFiles.length > 0) {
  console.error(
    [
      'Unexpected files found in src-tauri/binaries:',
      ...extraFiles.map((name) => `- ${name}`),
      'Keep the full installer lean: only ffmpeg.exe should be bundled.',
    ].join('\n'),
  );
  process.exit(1);
}

const sizeMb = statSync(ffmpegPath).size / (1024 * 1024);
console.log(`Bundled FFmpeg found: ${ffmpegPath} (${sizeMb.toFixed(1)} MB)`);

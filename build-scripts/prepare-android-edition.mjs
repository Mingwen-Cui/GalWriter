import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const edition = process.argv[2] === 'lite' ? 'lite' : 'full';
const version = JSON.parse(readFileSync(resolve('package.json'), 'utf8')).version;
const outputsRoot = resolve('src-tauri', 'gen', 'android', 'app', 'build', 'outputs');
const releaseDirectory = resolve('release');

const findLatest = (directory, matcher) => {
  if (!existsSync(directory)) return null;
  const found = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (matcher.test(entry.name)) found.push(fullPath);
    }
  };
  walk(directory);
  return found.sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs)[0] || null;
};

const apk = findLatest(outputsRoot, /release.*\.apk$/i);
const aab = findLatest(outputsRoot, /release.*\.aab$/i);
if (!apk && !aab) {
  throw new Error(`No Android release APK or AAB was found under ${outputsRoot}`);
}

mkdirSync(releaseDirectory, { recursive: true });
const prefix = `GalWriter-AI-v${version}-android-${edition}`;
if (apk) copyFileSync(apk, resolve(releaseDirectory, `${prefix}-signed.apk`));
if (aab) copyFileSync(aab, resolve(releaseDirectory, `${prefix}.aab`));

console.log(`Prepared Android ${edition} release assets:`);
if (apk) console.log(`- ${prefix}-signed.apk`);
if (aab) console.log(`- ${prefix}.aab`);


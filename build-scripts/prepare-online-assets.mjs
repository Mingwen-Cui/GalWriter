import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, resolve } from 'node:path';

const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8'));
const version = packageJson.version;
const sourcePublicDir = resolve('public');
const releaseDirectory = resolve('release', `GalWriter-AI-v${version}-online-assets`);
const packDirectories = ['presets', 'cover-templates', 'web-homepage'];

const walkFiles = (directory) => {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
};

if (!existsSync(sourcePublicDir))
  throw new Error(`Public directory was not found: ${sourcePublicDir}`);

rmSync(releaseDirectory, { recursive: true, force: true });
mkdirSync(releaseDirectory, { recursive: true });

for (const directory of packDirectories) {
  const source = join(sourcePublicDir, directory);
  if (existsSync(source)) cpSync(source, join(releaseDirectory, directory), { recursive: true });
}

const files = walkFiles(releaseDirectory)
  .map((filePath) => {
    const bytes = readFileSync(filePath);
    return {
      path: relative(releaseDirectory, filePath).replace(/\\/g, '/'),
      bytes: statSync(filePath).size,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  })
  .sort((left, right) => left.path.localeCompare(right.path));

const manifest = {
  product: 'GalWriter AI',
  version,
  generatedAt: new Date().toISOString(),
  files,
};

writeFileSync(
  join(releaseDirectory, 'manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);
writeFileSync(
  join(releaseDirectory, 'UPLOAD-TO-WEBSITE.txt'),
  [
    'Upload the contents of this directory to:',
    `/online/galwriter-assets/v${version}/`,
    '',
    'Keep all file names and folders unchanged.',
    'Configure the server to allow GET, HEAD, and CORS requests from the GalWriter app.',
    'Set long cache headers for versioned files. Do not cache manifest.json forever.',
  ].join('\n'),
  'utf8',
);

console.log(`Prepared ${files.length} online asset files in ${releaseDirectory}`);

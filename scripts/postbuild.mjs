import { readFileSync, copyFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
const packName = pkg.name.replace(/^@/, '').replace(/\//g, '-');

const tgzFiles = readdirSync(rootDir)
  .filter((f) => f.endsWith('.tgz') && f.startsWith(packName))
  .map((f) => ({
    name: f,
    path: join(rootDir, f),
    mtime: statSync(join(rootDir, f)).mtime,
  }))
  .sort((a, b) => b.mtime - a.mtime);

if (tgzFiles.length === 0) {
  console.error("No pack file found. Run 'npm pack' first.");
  process.exit(1);
}

const latest = tgzFiles[0];
const latestName = latest.name;
const latestNameNew = latestName.replace(
  /-[\d.]+(-[a-z0-9.-]+)?\.tgz$/,
  '-latest.tgz',
);
const destPath = join(rootDir, latestNameNew);

copyFileSync(latest.path, destPath);
console.log(`Copied ${latestName} -> ${latestNameNew}`);

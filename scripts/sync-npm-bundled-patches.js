'use strict';

/**
 * The `npm` package (pulled in by @semantic-release/npm) ships vulnerable
 * bundled copies of brace-expansion and picomatch. Overrides do not replace
 * bundleDependencies. After install, copy patched versions from the hoisted
 * tree into npm's nested node_modules so `npm audit` is clean.
 */
const fs = require('fs');
const path = require('path');

const packageRoot = path.join(__dirname, '..');

function findNpmInstallDir(startDir) {
  let dir = path.resolve(startDir);

  for (;;) {
    const candidate = path.join(dir, 'node_modules', 'npm');

    if (fs.existsSync(path.join(candidate, 'package.json'))) {
      return candidate;
    }

    const parent = path.dirname(dir);

    if (parent === dir) {
      return null;
    }

    dir = parent;
  }
}

function main() {
  const npmDir = findNpmInstallDir(packageRoot);

  if (!npmDir) {
    return;
  }

  let braceSrc;
  let picomatchSrc;

  try {
    braceSrc = path.dirname(
      require.resolve('brace-expansion/package.json', { paths: [packageRoot] }),
    );
    picomatchSrc = path.dirname(
      require.resolve('picomatch/package.json', { paths: [packageRoot] }),
    );
  } catch {
    return;
  }

  const braceDest = path.join(npmDir, 'node_modules', 'brace-expansion');

  if (fs.existsSync(path.dirname(braceDest))) {
    fs.rmSync(braceDest, { recursive: true, force: true });
    fs.cpSync(braceSrc, braceDest, { recursive: true });
  }

  const picomatchParent = path.join(
    npmDir,
    'node_modules',
    'tinyglobby',
    'node_modules',
  );
  const picomatchDest = path.join(picomatchParent, 'picomatch');

  if (fs.existsSync(picomatchParent)) {
    fs.rmSync(picomatchDest, { recursive: true, force: true });
    fs.cpSync(picomatchSrc, picomatchDest, { recursive: true });
  }

  const braceVersion = JSON.parse(
    fs.readFileSync(path.join(braceSrc, 'package.json'), 'utf8'),
  ).version;
  const picomatchVersion = JSON.parse(
    fs.readFileSync(path.join(picomatchSrc, 'package.json'), 'utf8'),
  ).version;

  patchPackageLock(packageRoot, braceVersion, picomatchVersion);
}

/** npm audit reads package-lock.json; align bundled entry versions with on-disk copies. */
function patchPackageLock(root, braceVersion, picomatchVersion) {
  const lockPath = path.join(root, 'package-lock.json');

  if (!fs.existsSync(lockPath)) {
    return;
  }

  const raw = fs.readFileSync(lockPath, 'utf8');
  const lock = JSON.parse(raw);
  const pkgs = lock.packages;

  if (!pkgs) {
    return;
  }

  const braceKey = 'node_modules/npm/node_modules/brace-expansion';
  const picomatchKey =
    'node_modules/npm/node_modules/tinyglobby/node_modules/picomatch';

  let changed = false;

  if (pkgs[braceKey]) {
    pkgs[braceKey].version = braceVersion;
    changed = true;
  }

  if (pkgs[picomatchKey]) {
    pkgs[picomatchKey].version = picomatchVersion;
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
  }
}

try {
  main();
} catch {
  // Do not fail install if layout changes upstream
}

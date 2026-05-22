'use strict';

/**
 * The `npm` package (pulled in by @semantic-release/npm) ships vulnerable
 * bundled copies of brace-expansion, picomatch, and ip-address. Overrides do
 * not replace bundleDependencies. After install, copy patched versions from the
 * hoisted tree into npm's nested node_modules so `npm audit` is clean.
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

function readPackageVersion(packageDir) {
  return JSON.parse(
    fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'),
  ).version;
}

function replaceBundledPackage(npmDir, packageName, srcDir) {
  const dest = path.join(npmDir, 'node_modules', packageName);
  const destParent = path.dirname(dest);

  if (!fs.existsSync(destParent)) {
    return null;
  }

  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(srcDir, dest, { recursive: true });

  return readPackageVersion(srcDir);
}

function main() {
  const npmDir = findNpmInstallDir(packageRoot);

  if (!npmDir) {
    return;
  }

  let braceSrc;
  let picomatchSrc;
  let ipAddressSrc;

  try {
    braceSrc = path.dirname(
      require.resolve('brace-expansion/package.json', { paths: [packageRoot] }),
    );
    picomatchSrc = path.dirname(
      require.resolve('picomatch/package.json', { paths: [packageRoot] }),
    );
    ipAddressSrc = path.dirname(
      require.resolve('ip-address/package.json', { paths: [packageRoot] }),
    );
  } catch {
    return;
  }

  const versions = {};

  const braceVersion = replaceBundledPackage(
    npmDir,
    'brace-expansion',
    braceSrc,
  );
  if (braceVersion) {
    versions.braceExpansion = braceVersion;
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
    versions.picomatch = readPackageVersion(picomatchSrc);
  }

  const ipAddressVersion = replaceBundledPackage(
    npmDir,
    'ip-address',
    ipAddressSrc,
  );
  if (ipAddressVersion) {
    versions.ipAddress = ipAddressVersion;
  }

  patchPackageLock(packageRoot, versions);
}

/** npm audit reads package-lock.json; align bundled entry versions with on-disk copies. */
function patchPackageLock(root, versions) {
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

  const lockPatches = [
    ['node_modules/npm/node_modules/brace-expansion', versions.braceExpansion],
    [
      'node_modules/npm/node_modules/tinyglobby/node_modules/picomatch',
      versions.picomatch,
    ],
    ['node_modules/npm/node_modules/ip-address', versions.ipAddress],
  ];

  let changed = false;

  for (const [key, version] of lockPatches) {
    if (version && pkgs[key]) {
      pkgs[key].version = version;
      changed = true;
    }
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

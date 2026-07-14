'use strict';

/**
 * The `npm` package (pulled in by @semantic-release/npm) ships vulnerable
 * bundled copies of brace-expansion, picomatch, ip-address, tar, sigstore,
 * @sigstore/core, and @sigstore/verify. Overrides do not replace
 * bundleDependencies. After install, copy patched versions from the
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

  const simplePackages = [
    ['brace-expansion', 'braceExpansion'],
    ['ip-address', 'ipAddress'],
    ['tar', 'tar'],
    ['sigstore', 'sigstore'],
    ['@sigstore/core', 'sigstoreCore'],
    ['@sigstore/verify', 'sigstoreVerify'],
  ];

  const versions = {};

  for (const [packageName, versionKey] of simplePackages) {
    let src;

    try {
      src = path.dirname(
        require.resolve(`${packageName}/package.json`, { paths: [packageRoot] }),
      );
    } catch {
      continue;
    }

    const version = replaceBundledPackage(npmDir, packageName, src);
    if (version) {
      versions[versionKey] = version;
    }
  }

  try {
    const picomatchSrc = path.dirname(
      require.resolve('picomatch/package.json', { paths: [packageRoot] }),
    );
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
  } catch {
    // Do not fail install if layout changes upstream
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
    ['node_modules/npm/node_modules/tar', versions.tar],
    ['node_modules/npm/node_modules/sigstore', versions.sigstore],
    ['node_modules/npm/node_modules/@sigstore/core', versions.sigstoreCore],
    ['node_modules/npm/node_modules/@sigstore/verify', versions.sigstoreVerify],
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

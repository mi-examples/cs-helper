import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function runNpmSync(args, options) {
  const npmExec = process.env.npm_execpath;

  if (npmExec) {
    return spawnSync(process.execPath, [npmExec, ...args], options);
  }

  return spawnSync('npm', args, {
    shell: process.platform === 'win32',
    ...options,
  });
}

function scaffoldProject({ targetDir, template, packageName, description, version, v7, ai = [] }) {
  const args = [
    path.join('dist', 'bin', 'create.js'),
    targetDir,
    '--template',
    template,
    '--name',
    packageName,
    '--description',
    description,
    '--version',
    version,
  ];

  if (v7) {
    args.push('--v7');
  }

  for (const addon of ai) {
    args.push('--ai', addon);
  }

  return spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    input: `${v7 ? 'y' : 'n'}\n`,
  });
}

function runNpmCreateFromLocalPackage({ targetDir, template, packageName }) {
  const pkgUrl = pathToFileURL(repoRoot).href;
  const args = [
    'exec',
    '--yes',
    `--package=${pkgUrl}`,
    '--',
    'cs-helper-create',
    targetDir,
    '--template',
    template,
    '--name',
    packageName,
    '--description',
    `Scaffolded package ${packageName}`,
    '--version',
    '1.0.0',
  ];

  return runNpmSync(args, {
    cwd: repoRoot,
    encoding: 'utf8',
    input: 'n\n',
  });
}

test.describe('project scaffold', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(() => {
    const build = runNpmSync(['run', 'build:bin'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });

    expect(build.status, `build:bin stderr: ${build.stderr}\nstdout: ${build.stdout}`).toBe(0);
  });

  test('loads project metadata', async () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.resolve(repoRoot, 'package.json'), 'utf8'),
    );

    expect(packageJson.name).toBe('@metricinsights/cs-helper');
  });

  const scaffoldVariants = [
    { template: 'custom-script-js', ext: 'js', v7: false },
    { template: 'custom-script-js', ext: 'js', v7: true },
    { template: 'custom-script-ts', ext: 'ts', v7: false },
    { template: 'custom-script-ts', ext: 'ts', v7: true },
  ];

  for (const variant of scaffoldVariants) {
    test(`scaffold + install for ${variant.template} (v7=${String(variant.v7)})`, async () => {
      test.setTimeout(300_000);

      const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-helper-scaffold-'));
      const packageName = `${variant.template}-${variant.v7 ? 'v7' : 'v6'}-${Date.now()}`;
      const targetDir = path.join(tmpRoot, packageName);

      const scaffold = scaffoldProject({
        targetDir,
        template: variant.template,
        packageName,
        description: `Scaffolded package ${packageName}`,
        version: '1.0.0',
        v7: variant.v7,
      });

      try {
        expect(scaffold.status, `scaffold stderr: ${scaffold.stderr}\nstdout: ${scaffold.stdout}`).toBe(0);

        const packageJsonPath = path.join(targetDir, 'package.json');
        const entryFilePath = path.join(targetDir, 'src', `${packageName}.${variant.ext}`);

        expect(fs.existsSync(packageJsonPath)).toBeTruthy();
        expect(fs.existsSync(entryFilePath)).toBeTruthy();

        const generatedPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const buildScript = generatedPackageJson.scripts?.build ?? '';

        expect(generatedPackageJson.name).toBe(packageName);
        expect(buildScript.includes('--v7')).toBe(variant.v7);

        const install = runNpmSync(['install', '--no-audit', '--fund=false'], {
          cwd: targetDir,
          encoding: 'utf8',
        });

        expect(install.status, `npm install stderr: ${install.stderr}\nstdout: ${install.stdout}`).toBe(0);
        expect(fs.existsSync(path.join(targetDir, 'node_modules'))).toBeTruthy();
        expect(
          fs.existsSync(
            path.join(targetDir, 'node_modules', '@metricinsights', 'cs-helper'),
          ),
        ).toBeTruthy();
      } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });
  }

  for (const template of ['custom-script-js', 'custom-script-ts']) {
    test(`npm create flow + install for ${template}`, async () => {
      test.setTimeout(300_000);

      const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-helper-npm-flow-'));
      const packageName = `npm-flow-${template}-${Date.now()}`;
      const targetDir = path.join(tmpRoot, packageName);

      const createRun = runNpmCreateFromLocalPackage({
        targetDir,
        template,
        packageName,
      });

      try {
        expect(createRun.status, `create stderr: ${createRun.stderr}\nstdout: ${createRun.stdout}`).toBe(0);

        const install = runNpmSync(['install', '--no-audit', '--fund=false'], {
          cwd: targetDir,
          encoding: 'utf8',
        });

        expect(install.status, `npm install stderr: ${install.stderr}\nstdout: ${install.stdout}`).toBe(0);
        expect(fs.existsSync(path.join(targetDir, 'node_modules'))).toBeTruthy();
      } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });
  }

  const aiAddonVariants = [
    {
      addons: ['cursor'],
      expectedFiles: ['.cursor/rules/metric-insights-custom-script.mdc'],
    },
    {
      addons: ['claude'],
      expectedFiles: ['CLAUDE.md'],
    },
    {
      addons: ['cursor', 'claude'],
      expectedFiles: ['.cursor/rules/metric-insights-custom-script.mdc', 'CLAUDE.md'],
    },
  ];

  for (const variant of aiAddonVariants) {
    test(`scaffold + install with AI add-ons: ${variant.addons.join(',')}`, async () => {
      test.setTimeout(300_000);

      const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-helper-ai-addons-'));
      const packageName = `ai-${variant.addons.join('-')}-${Date.now()}`;
      const targetDir = path.join(tmpRoot, packageName);

      const scaffold = scaffoldProject({
        targetDir,
        template: 'custom-script-ts',
        packageName,
        description: `AI scaffold ${packageName}`,
        version: '1.0.0',
        v7: false,
        ai: variant.addons,
      });

      try {
        expect(scaffold.status, `scaffold stderr: ${scaffold.stderr}\nstdout: ${scaffold.stdout}`).toBe(0);

        for (const relativePath of variant.expectedFiles) {
          expect(
            fs.existsSync(path.join(targetDir, ...relativePath.split('/'))),
            `Expected ${relativePath} to exist`,
          ).toBeTruthy();
        }

        const install = runNpmSync(['install', '--no-audit', '--fund=false'], {
          cwd: targetDir,
          encoding: 'utf8',
        });

        expect(install.status, `npm install stderr: ${install.stderr}\nstdout: ${install.stdout}`).toBe(0);
        expect(fs.existsSync(path.join(targetDir, 'node_modules'))).toBeTruthy();
      } finally {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });
  }
});

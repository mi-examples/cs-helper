import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function makeTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function repoVersion() {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).version;
}

async function loadAiAddonsModule() {
  return import(pathToFileURL(path.join(repoRoot, 'dist/bin/ai-addons.js')).href);
}

function createProject(args, input = 'n\n') {
  return spawnSync(
    process.execPath,
    [path.join('dist', 'bin', 'create.js'), ...args],
    { cwd: repoRoot, encoding: 'utf8', input },
  );
}

test.describe('checkAiAddonsFreshness / isAiAddonPresent (unit)', () => {
  test('ok: marker matches installed version', async () => {
    const { checkAiAddonsFreshness } = await loadAiAddonsModule();
    const dir = makeTmpDir('cs-helper-ai-unit-ok-');

    try {
      fs.writeFileSync(
        path.join(dir, 'CLAUDE.md'),
        '# X\n\n<!-- cs-helper-addon-version: 1.2.3 -->\n\nCreated with `@metricinsights/cs-helper`.\n',
      );

      const results = checkAiAddonsFreshness(dir, '1.2.3');
      const claude = results.find((r) => r.name === 'claude');

      expect(claude?.status).toBe('ok');
      expect(claude?.foundVersion).toBe('1.2.3');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('stale: marker differs from installed version', async () => {
    const { checkAiAddonsFreshness } = await loadAiAddonsModule();
    const dir = makeTmpDir('cs-helper-ai-unit-stale-');

    try {
      fs.mkdirSync(path.join(dir, '.cursor', 'rules'), { recursive: true });
      fs.writeFileSync(
        path.join(dir, '.cursor', 'rules', 'metric-insights-custom-script.mdc'),
        '---\ndescription: x\ncs-helper-addon-version: 0.9.0\n---\n\nbody\n',
      );

      const results = checkAiAddonsFreshness(dir, '1.2.3');
      const cursor = results.find((r) => r.name === 'cursor');

      expect(cursor?.status).toBe('stale');
      expect(cursor?.foundVersion).toBe('0.9.0');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('unknown: file/signature present but marker missing (pre-marker scaffold)', async () => {
    const { checkAiAddonsFreshness } = await loadAiAddonsModule();
    const dir = makeTmpDir('cs-helper-ai-unit-unknown-');

    try {
      fs.writeFileSync(
        path.join(dir, 'CLAUDE.md'),
        '# X\n\nCreated with `@metricinsights/cs-helper`.\n',
      );

      const results = checkAiAddonsFreshness(dir, '1.2.3');
      const claude = results.find((r) => r.name === 'claude');

      expect(claude?.status).toBe('unknown');
      expect(claude?.foundVersion).toBeUndefined();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('absent: no entry when the addon was never scaffolded', async () => {
    const { checkAiAddonsFreshness } = await loadAiAddonsModule();
    const dir = makeTmpDir('cs-helper-ai-unit-absent-');

    try {
      expect(checkAiAddonsFreshness(dir, '1.2.3')).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('ignores an unrelated CLAUDE.md without the cs-helper signature', async () => {
    const { checkAiAddonsFreshness } = await loadAiAddonsModule();
    const dir = makeTmpDir('cs-helper-ai-unit-unrelated-');

    try {
      fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# My own project notes\n\nUnrelated content.\n');

      expect(checkAiAddonsFreshness(dir, '1.2.3').find((r) => r.name === 'claude')).toBeUndefined();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('isAiAddonPresent detects the cursor rule file and not claude', async () => {
    const { isAiAddonPresent } = await loadAiAddonsModule();
    const dir = makeTmpDir('cs-helper-ai-unit-present-');

    try {
      fs.mkdirSync(path.join(dir, '.cursor', 'rules'), { recursive: true });
      fs.writeFileSync(
        path.join(dir, '.cursor', 'rules', 'metric-insights-custom-script.mdc'),
        '---\ncs-helper-addon-version: 1.0.0\n---\n',
      );

      expect(isAiAddonPresent(dir, 'cursor')).toBe(true);
      expect(isAiAddonPresent(dir, 'claude')).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

test.describe('--update-ai (cs-helper-create)', () => {
  test.describe.configure({ mode: 'serial' });

  test('adds an ai-addon file to an existing project via --ai, then auto-detect refreshes it', async () => {
    const tmpRoot = makeTmpDir('cs-helper-update-ai-');
    const packageName = `update-ai-${Date.now()}`;
    const targetDir = path.join(tmpRoot, packageName);

    try {
      const scaffold = createProject([
        targetDir,
        '--template', 'custom-script-ts',
        '--name', packageName,
        '--description', 'update-ai test',
        '--version', '1.0.0',
      ]);

      expect(scaffold.status, `scaffold stderr: ${scaffold.stderr}\nstdout: ${scaffold.stdout}`).toBe(0);

      const claudeMdPath = path.join(targetDir, 'CLAUDE.md');

      expect(fs.existsSync(claudeMdPath)).toBeFalsy();

      const addRun = createProject([targetDir, '--update-ai', '--ai', 'claude']);

      expect(addRun.status, `update-ai stderr: ${addRun.stderr}\nstdout: ${addRun.stdout}`).toBe(0);
      expect(fs.existsSync(claudeMdPath)).toBeTruthy();

      const content = fs.readFileSync(claudeMdPath, 'utf8');

      expect(content).toContain(`cs-helper-addon-version: ${repoVersion()}`);
      expect(content).toContain(packageName);

      // Stale the marker, then refresh via auto-detect (no --ai flag).
      const staled = content.replace(
        /cs-helper-addon-version:\s*[^\s]+/,
        'cs-helper-addon-version: 0.0.1',
      );

      fs.writeFileSync(claudeMdPath, staled);

      const refreshRun = createProject([targetDir, '--update-ai']);

      expect(refreshRun.status, `refresh stderr: ${refreshRun.stderr}\nstdout: ${refreshRun.stdout}`).toBe(0);

      const refreshedContent = fs.readFileSync(claudeMdPath, 'utf8');

      expect(refreshedContent).toContain(`cs-helper-addon-version: ${repoVersion()}`);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  test('fails clearly when run outside an existing project', async () => {
    const tmpRoot = makeTmpDir('cs-helper-update-ai-missing-pkg-');

    try {
      const run = createProject([tmpRoot, '--update-ai', '--ai', 'claude']);

      expect(run.status).not.toBe(0);
      expect(run.stderr).toContain('--update-ai');
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

// The build-time staleness-warning integration test lives in test/scaffold.spec.mjs instead of here:
// it needs a freshly built dist/ + local tarball, and that describe block already owns the one
// `npm run build && npm run postbuild` lifecycle (via its serial beforeAll). A second file doing its
// own `npm run build` (which runs `clean:dist` first) races with other spec files' `dist/bin/*.js`
// imports under Playwright's parallel workers.

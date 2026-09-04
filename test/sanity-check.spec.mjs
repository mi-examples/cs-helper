import { test, expect } from '@playwright/test';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const fixturesDir = path.join(repoRoot, 'test-fixtures', 'sanity-check');

async function loadSanityCheckModule() {
  return import(pathToFileURL(path.join(repoRoot, 'dist/bin/sanity-check.js')).href);
}

function fixture(name) {
  return path.join(fixturesDir, name);
}

function ruleIds(findings) {
  return findings.map((f) => f.ruleId);
}

function runCheckCli(args) {
  return spawnSync(
    process.execPath,
    [path.join('dist', 'bin', 'check.js'), ...args],
    { cwd: repoRoot, encoding: 'utf8' },
  );
}

test.describe('runSanityChecks (unit)', () => {
  test('golden path: the scaffolded custom-script-ts template produces zero findings', async () => {
    const { runSanityChecks } = await loadSanityCheckModule();

    expect(runSanityChecks(fixture('clean-golden-path.ts'))).toEqual([]);
  });

  test('no-console: flags console.log/warn/error/info/debug', async () => {
    const { runSanityChecks } = await loadSanityCheckModule();
    const findings = runSanityChecks(fixture('no-console.ts'));
    const finding = findings.find((f) => f.ruleId === 'no-console');

    expect(finding).toBeDefined();
    expect(finding.severity).toBe('error');
  });

  test('require-cs-close: flags a script with no cs.close() call anywhere', async () => {
    const { runSanityChecks } = await loadSanityCheckModule();
    const findings = runSanityChecks(fixture('missing-close.ts'));
    const finding = findings.find((f) => f.ruleId === 'require-cs-close');

    expect(finding).toBeDefined();
    expect(finding.severity).toBe('error');
  });

  test('cs-close-not-deferred: flags cs.close() called outside a setTimeout callback', async () => {
    const { runSanityChecks } = await loadSanityCheckModule();
    const findings = runSanityChecks(fixture('close-not-deferred.ts'));
    const finding = findings.find((f) => f.ruleId === 'cs-close-not-deferred');

    expect(finding).toBeDefined();
    expect(finding.severity).toBe('warning');
    // require-cs-close must not also fire - a close() call does exist, it's just not deferred.
    expect(ruleIds(findings)).not.toContain('require-cs-close');
  });

  test('require-script-timeout-param: flags a parseParams<T>() call missing scriptTimeout', async () => {
    const { runSanityChecks } = await loadSanityCheckModule();
    const findings = runSanityChecks(fixture('missing-script-timeout.ts'));
    const finding = findings.find((f) => f.ruleId === 'require-script-timeout-param');

    expect(finding).toBeDefined();
    expect(finding.severity).toBe('warning');
  });

  test('raw-http-to-mi-backend: flags fetch(cs.homeSite + ...) but not a third-party URL', async () => {
    const { runSanityChecks } = await loadSanityCheckModule();

    const backendFindings = runSanityChecks(fixture('raw-http-mi-backend.ts'));
    const backendFinding = backendFindings.find((f) => f.ruleId === 'raw-http-to-mi-backend');

    expect(backendFinding).toBeDefined();
    expect(backendFinding.severity).toBe('warning');

    const thirdPartyFindings = runSanityChecks(fixture('raw-http-third-party-ok.ts'));

    expect(ruleIds(thirdPartyFindings)).not.toContain('raw-http-to-mi-backend');
  });

  test('parse-params-non-scalar: flags a parseParams field that is not string | number | boolean', async () => {
    const { runSanityChecks } = await loadSanityCheckModule();
    const findings = runSanityChecks(fixture('non-scalar-param.ts'));
    const finding = findings.find((f) => f.ruleId === 'parse-params-non-scalar');

    expect(finding).toBeDefined();
    expect(finding.message).toContain('config');
  });

  test('unguarded-window-context: flags window.req access with no guard, but not a guarded one', async () => {
    const { runSanityChecks } = await loadSanityCheckModule();

    const unguardedFindings = runSanityChecks(fixture('unguarded-window.ts'));
    const unguardedFinding = unguardedFindings.find((f) => f.ruleId === 'unguarded-window-context');

    expect(unguardedFinding).toBeDefined();
    expect(unguardedFinding.severity).toBe('info');

    const guardedFindings = runSanityChecks(fixture('guarded-window-ok.ts'));

    expect(ruleIds(guardedFindings)).not.toContain('unguarded-window-context');
  });

  test('v6-unsupported-builtin: flags Array.from under v6, not under v7', async () => {
    const { runSanityChecks } = await loadSanityCheckModule();

    const v6Findings = runSanityChecks(fixture('v6-unsupported-builtin.ts'), { v7: false });

    expect(ruleIds(v6Findings)).toContain('v6-unsupported-builtin');

    const v7Findings = runSanityChecks(fixture('v6-unsupported-builtin.ts'), { v7: true });

    expect(ruleIds(v7Findings)).not.toContain('v6-unsupported-builtin');
  });

  test('manual-token-header-override: flags a hardcoded token header/cs.apiToken assignment, not a variable', async () => {
    const { runSanityChecks } = await loadSanityCheckModule();

    const findings = runSanityChecks(fixture('manual-token-header.ts'));

    expect(ruleIds(findings).filter((id) => id === 'manual-token-header-override')).toHaveLength(2);

    const okFindings = runSanityChecks(fixture('token-via-variable-ok.ts'));

    expect(ruleIds(okFindings)).not.toContain('manual-token-header-override');
  });

  test('runapirequest-promise-missing-handler: flags a Promise missing resolve or reject, not one with both', async () => {
    const { runSanityChecks } = await loadSanityCheckModule();

    const findings = runSanityChecks(fixture('promise-missing-handler.ts'));
    const finding = findings.find((f) => f.ruleId === 'runapirequest-promise-missing-handler');

    expect(finding).toBeDefined();
    expect(finding.message).toContain('reject');

    const okFindings = runSanityChecks(fixture('promise-with-both-handlers-ok.ts'));

    expect(ruleIds(okFindings)).not.toContain('runapirequest-promise-missing-handler');
  });

  test('require-heartbeat-in-long-loop: flags a loop with no log/runApiRequest/updateHeartBeat call', async () => {
    const { runSanityChecks } = await loadSanityCheckModule();

    const findings = runSanityChecks(fixture('heartbeat-missing-in-loop.ts'));

    expect(ruleIds(findings)).toContain('require-heartbeat-in-long-loop');

    const okFindings = runSanityChecks(fixture('heartbeat-present-in-loop-ok.ts'));

    expect(ruleIds(okFindings)).not.toContain('require-heartbeat-in-long-loop');
  });

  test('missing-token-refresh-for-long-script: flags repeated runApiRequest in a loop with no get_token reference', async () => {
    const { runSanityChecks } = await loadSanityCheckModule();

    const findings = runSanityChecks(fixture('missing-token-refresh.ts'));
    const finding = findings.find((f) => f.ruleId === 'missing-token-refresh-for-long-script');

    expect(finding).toBeDefined();
    expect(finding.severity).toBe('info');

    const okFindings = runSanityChecks(fixture('has-token-refresh-ok.ts'));

    expect(ruleIds(okFindings)).not.toContain('missing-token-refresh-for-long-script');
  });

  test('node-only-api: flags require(nodeBuiltin), process.env, and __dirname', async () => {
    const { runSanityChecks } = await loadSanityCheckModule();
    const findings = runSanityChecks(fixture('node-only-api.ts'));

    expect(ruleIds(findings).filter((id) => id === 'node-only-api').length).toBeGreaterThanOrEqual(3);
  });

  test('no-password-in-log: flags a password-typed param passed into cs.log, not one left unlogged', async () => {
    const { runSanityChecks } = await loadSanityCheckModule();

    const findings = runSanityChecks(fixture('password-in-log.ts'));
    const finding = findings.find((f) => f.ruleId === 'no-password-in-log');

    expect(finding).toBeDefined();
    expect(finding.message).toContain('apiKey');

    const okFindings = runSanityChecks(fixture('password-not-logged-ok.ts'));

    expect(ruleIds(okFindings)).not.toContain('no-password-in-log');
  });

  test('v6-jquery-legacy-ajax-promise: flags .done/.fail chained on runApiRequest under v6, not v7', async () => {
    const { runSanityChecks } = await loadSanityCheckModule();

    const v6Findings = runSanityChecks(fixture('v6-jquery-legacy.ts'), { v7: false });

    expect(ruleIds(v6Findings).filter((id) => id === 'v6-jquery-legacy-ajax-promise').length).toBeGreaterThanOrEqual(2);

    const v7Findings = runSanityChecks(fixture('v6-jquery-legacy.ts'), { v7: true });

    expect(ruleIds(v7Findings)).not.toContain('v6-jquery-legacy-ajax-promise');
  });

  test('no-eval: flags eval(...) and new Function(...)', async () => {
    const { runSanityChecks } = await loadSanityCheckModule();
    const findings = runSanityChecks(fixture('no-eval.ts'));

    expect(ruleIds(findings).filter((id) => id === 'no-eval')).toHaveLength(2);
  });
});

test.describe('cs-helper-check (CLI)', () => {
  test('exits 0 and reports no issues for a clean entry file', () => {
    const run = runCheckCli([fixture('clean-golden-path.ts')]);

    expect(run.status, `stderr: ${run.stderr}\nstdout: ${run.stdout}`).toBe(0);
    expect(run.stdout).toContain('No sanity-check issues found.');
  });

  test('exits 1 when an error-severity finding exists', () => {
    const run = runCheckCli([fixture('missing-close.ts')]);

    expect(run.status).toBe(1);
    expect(run.stdout).toContain('require-cs-close');
  });

  test('--format json prints parseable findings', () => {
    const run = runCheckCli(['--format', 'json', fixture('no-console.ts')]);

    expect(run.status, `stderr: ${run.stderr}`).toBe(1);

    const findings = JSON.parse(run.stdout);

    expect(Array.isArray(findings)).toBe(true);
    expect(findings.some((f) => f.ruleId === 'no-console')).toBe(true);
  });

  test('--v7 suppresses the v6-only rule', () => {
    const run = runCheckCli(['--format', 'json', '--v7', fixture('v6-unsupported-builtin.ts')]);

    expect(run.status, `stderr: ${run.stderr}`).toBe(0);

    const findings = JSON.parse(run.stdout);

    expect(findings.some((f) => f.ruleId === 'v6-unsupported-builtin')).toBe(false);
  });
});

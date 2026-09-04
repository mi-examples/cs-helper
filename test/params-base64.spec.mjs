import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

async function loadParamsBase64Module() {
  return import(pathToFileURL(path.join(repoRoot, 'dist/bin/params-base64.js')).href);
}

function decode(base64) {
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
}

function callInfo(name, typeInfoTable, defaultParams = {}) {
  return { filePath: `${name}.ts`, typeInfo: '', line: 1, defaultParams, typeInfoTable };
}

test('suggestedTimeoutMinutes: computed from an isScriptTimeout-marked field with a numeric default', async () => {
  const { generateParamsBase64 } = await loadParamsBase64Module();

  const calls = [
    callInfo(
      'entry',
      [{ name: 'maxRuntimeMs', typeStr: 'number', optional: false, description: '', isScriptTimeout: true }],
      { maxRuntimeMs: '300000' },
    ),
  ];

  expect(decode(generateParamsBase64(calls)).suggestedTimeoutMinutes).toBe(5);
});

test('suggestedTimeoutMinutes: omitted when no field is marked isScriptTimeout', async () => {
  const { generateParamsBase64 } = await loadParamsBase64Module();

  const calls = [
    callInfo(
      'entry',
      [{ name: 'scriptTimeout', typeStr: 'number', optional: false, description: '' }],
      { scriptTimeout: '300000' },
    ),
  ];

  expect(decode(generateParamsBase64(calls)).suggestedTimeoutMinutes).toBeUndefined();
});

test('suggestedTimeoutMinutes: omitted when the marked field has no resolvable numeric default', async () => {
  const { generateParamsBase64 } = await loadParamsBase64Module();

  const calls = [
    callInfo('entry', [
      { name: 'maxRuntimeMs', typeStr: 'number', optional: false, description: '', isScriptTimeout: true },
    ]),
  ];

  expect(decode(generateParamsBase64(calls)).suggestedTimeoutMinutes).toBeUndefined();
});

test('suggestedTimeoutMinutes: latest marked occurrence across multiple calls wins', async () => {
  const { generateParamsBase64 } = await loadParamsBase64Module();

  const calls = [
    callInfo(
      'a',
      [{ name: 't1', typeStr: 'number', optional: false, description: '', isScriptTimeout: true }],
      { t1: '60000' },
    ),
    callInfo(
      'b',
      [{ name: 't2', typeStr: 'number', optional: false, description: '', isScriptTimeout: true }],
      { t2: '120000' },
    ),
  ];

  expect(decode(generateParamsBase64(calls)).suggestedTimeoutMinutes).toBe(2);
});

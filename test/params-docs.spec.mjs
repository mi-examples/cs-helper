import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

test('optional number params are not widened to number | string (installed TS)', async () => {
  test.info().annotations.push({
    type: 'typescript',
    description: ts.version,
  });
  const { analyzeParseParamsData } = await import(
    pathToFileURL(path.join(repoRoot, 'dist/bin/params-docs.js')).href
  );

  const fixture = path.join(repoRoot, 'test-fixtures/optional-number-params.ts');
  const [call] = analyzeParseParamsData(fixture);

  expect(call?.typeInfoTable).toBeDefined();

  const byName = Object.fromEntries(
    call.typeInfoTable.map((row) => [row.name, row]),
  );

  expect(byName.scriptTimeout.typeStr).toBe('number');
  expect(byName.excludedReportNamesDatasetId.typeStr).toBe('number');
  expect(byName.minItemsCount.typeStr).toBe('number');
  expect(byName.minPairDice.typeStr).toBe('number');
  expect(byName.requiredNum.typeStr).toBe('number');
});

test('@password JSDoc maps string param type to password', async () => {
  const { analyzeParseParamsData } = await import(
    pathToFileURL(path.join(repoRoot, 'dist/bin/params-docs.js')).href
  );

  const fixture = path.join(repoRoot, 'test-fixtures/password-param.ts');
  const [call] = analyzeParseParamsData(fixture);
  const apiToken = call?.typeInfoTable?.find((row) => row.name === 'apiToken');

  expect(apiToken?.typeStr).toBe('password');
  expect(apiToken?.optional).toBe(true);
});

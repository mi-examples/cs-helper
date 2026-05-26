import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const displayUrl = pathToFileURL(
  path.join(repoRoot, 'dist/bin/params-type-display.js'),
).href;

const noopChecker = {
  typeToString(type) {
    if (type.label) {
      return type.label;
    }

    return '';
  },
};

test.describe('getGenericTypeDisplay with TypeScript 5 TypeFlags layout', () => {
  let ts5Api;

  test.beforeAll(async () => {
    const {
      createTypeScriptApiStub,
      TYPE_FLAGS_TYPESCRIPT_5,
    } = await import(displayUrl);

    ts5Api = createTypeScriptApiStub(TYPE_FLAGS_TYPESCRIPT_5);
  });

  test('optional number union (number | undefined) resolves to number', async () => {
    const { getGenericTypeDisplay } = await import(displayUrl);
    const TF = ts5Api.TypeFlags;

    expect(
      getGenericTypeDisplay(ts5Api, noopChecker, {
        types: [{ flags: TF.Undefined }, { flags: TF.Number }],
      }),
    ).toBe('number');
  });

  test('string primitive uses String flag (4), not confused with Undefined', async () => {
    const { getGenericTypeDisplay } = await import(displayUrl);

    expect(
      getGenericTypeDisplay(ts5Api, noopChecker, {
        flags: ts5Api.TypeFlags.String,
      }),
    ).toBe('string');
  });

  test('boolean and number primitives', async () => {
    const { getGenericTypeDisplay } = await import(displayUrl);
    const TF = ts5Api.TypeFlags;

    expect(getGenericTypeDisplay(ts5Api, noopChecker, { flags: TF.Boolean })).toBe(
      'boolean',
    );
    expect(getGenericTypeDisplay(ts5Api, noopChecker, { flags: TF.Number })).toBe(
      'number',
    );
  });
});

test.describe('getGenericTypeDisplay with TypeScript 6 TypeFlags layout', () => {
  let ts6Api;

  test.beforeAll(async () => {
    const {
      createTypeScriptApiStub,
      TYPE_FLAGS_TYPESCRIPT_6,
    } = await import(displayUrl);

    ts6Api = createTypeScriptApiStub(TYPE_FLAGS_TYPESCRIPT_6);
  });

  test('optional number union (number | undefined) resolves to number', async () => {
    const { getGenericTypeDisplay } = await import(displayUrl);
    const TF = ts6Api.TypeFlags;

    expect(
      getGenericTypeDisplay(ts6Api, noopChecker, {
        types: [{ flags: TF.Undefined }, { flags: TF.Number }],
      }),
    ).toBe('number');
  });

  test('Undefined flag (4) is not reported as string', async () => {
    const { getGenericTypeDisplay } = await import(displayUrl);
    const TF = ts6Api.TypeFlags;

    expect(getGenericTypeDisplay(ts6Api, noopChecker, { flags: TF.Undefined })).toBe(
      '',
    );
    expect(
      getGenericTypeDisplay(ts6Api, noopChecker, {
        types: [{ flags: TF.Undefined }, { flags: TF.Number }],
      }),
    ).toBe('number');
  });

  test('string primitive uses String flag (32)', async () => {
    const { getGenericTypeDisplay } = await import(displayUrl);

    expect(
      getGenericTypeDisplay(ts6Api, noopChecker, {
        flags: ts6Api.TypeFlags.String,
      }),
    ).toBe('string');
  });
});

test.describe('installed typescript package', () => {
  test('TypeFlags layout matches major version', async () => {
    const {
      getTypeScriptMajorVersion,
      isTypeScript6TypeFlags,
    } = await import(displayUrl);

    const major = getTypeScriptMajorVersion(ts);
    const layoutIsTs6 = isTypeScript6TypeFlags(ts.TypeFlags);

    expect(major).toBeGreaterThanOrEqual(5);
    expect(layoutIsTs6).toBe(major >= 6);
  });

  test('optional number from real checker matches installed layout', async () => {
    const { getGenericTypeDisplay } = await import(displayUrl);
    const entry = path.join(repoRoot, 'test-fixtures/optional-number-params.ts');
    const program = ts.createProgram([entry, path.join(repoRoot, 'src/index.ts')], {
      allowJs: true,
      noEmit: true,
      skipLibCheck: true,
    });
    const checker = program.getTypeChecker();
    const sf = program.getSourceFile(entry);

    let propType;

    function visit(node) {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'parseParams'
      ) {
        const typeNode = node.typeArguments[0];

        for (const sym of checker.getPropertiesOfType(
          checker.getTypeFromTypeNode(typeNode),
        )) {
          if (sym.getName() === 'scriptTimeout') {
            propType = checker.getTypeOfSymbolAtLocation(sym, typeNode);
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sf);

    expect(getGenericTypeDisplay(ts, checker, propType)).toBe('number');
  });
});

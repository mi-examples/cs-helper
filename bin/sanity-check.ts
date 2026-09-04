const pathLib = require('path');
const fs = require('fs');
const paramsDocs = require('./params-docs');

export type SanityCheckSeverity = 'error' | 'warning' | 'info';

export type SanityCheckFinding = {
  ruleId: string;
  severity: SanityCheckSeverity;
  message: string;
  file: string;
  line?: number;
};

export type RunSanityChecksOptions = {
  /** Build target: true for v7 (Puppeteer/Chromium), false for v6 (PhantomJS/ES5). */
  v7?: boolean;
  /** Base directory findings' `file` paths are made relative to. Defaults to process.cwd(). */
  projectRoot?: string;
};

type RuleContext = {
  ts: any;
  entryFile: string;
  projectRoot: string;
  sourceFiles: string[];
  fileAsts: Map<string, any>;
  parseParamsCalls: Array<{
    filePath: string;
    typeInfoTable?: Array<{ name: string; typeStr: string }>;
    defaultParams: Record<string, any>;
    line: number;
  }>;
  v7: boolean;
};

function relativeFile(ctx: RuleContext, absPath: string): string {
  return pathLib.relative(ctx.projectRoot, absPath) || pathLib.basename(absPath);
}

function getLine(sourceFile: any, node: any): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart ? node.getStart() : node.pos).line + 1;
}

function isCsOrCustomScriptIdentifier(ts: any, node: any): boolean {
  return ts.isIdentifier(node) && (node.text === 'cs' || node.text === 'customScript');
}

/**
 * Console output is not visible in the Metric Insights run log/UI - use cs.log/cs.error instead.
 */
const CONSOLE_METHODS = new Set(['log', 'warn', 'error', 'info', 'debug']);

function ruleNoConsole(ctx: RuleContext): SanityCheckFinding[] {
  const { ts } = ctx;
  const findings: SanityCheckFinding[] = [];

  for (const filePath of ctx.sourceFiles) {
    const sourceFile = ctx.fileAsts.get(filePath);

    if (!sourceFile) {
      continue;
    }

    function visit(node: any) {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === 'console' &&
        CONSOLE_METHODS.has(node.expression.name.text)
      ) {
        findings.push({
          ruleId: 'no-console',
          severity: 'error',
          message: `console.${node.expression.name.text}(...) output is not visible in Metric Insights run logs; use cs.log(...) or cs.error(...) instead.`,
          file: relativeFile(ctx, filePath),
          line: getLine(sourceFile, node),
        });
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return findings;
}

function hasCsMemberCall(ctx: RuleContext, memberName: string): boolean {
  const { ts } = ctx;

  for (const filePath of ctx.sourceFiles) {
    const sourceFile = ctx.fileAsts.get(filePath);

    if (!sourceFile) {
      continue;
    }

    let found = false;

    function visit(node: any) {
      if (found) {
        return;
      }

      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        isCsOrCustomScriptIdentifier(ts, node.expression.expression) &&
        node.expression.name.text === memberName
      ) {
        found = true;

        return;
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    if (found) {
      return true;
    }
  }

  return false;
}

/**
 * Every run must end by calling cs.close() so Metric Insights can finalize the run
 * (flush cs.result, stop the watchdog, etc.) - see README.md "Finishing runs".
 */
function ruleRequireCsClose(ctx: RuleContext): SanityCheckFinding[] {
  if (hasCsMemberCall(ctx, 'close')) {
    return [];
  }

  return [
    {
      ruleId: 'require-cs-close',
      severity: 'error',
      message:
        'No cs.close() (or customScript.close()) call found. Every run must end by calling cs.close() when work finishes, success or failure.',
      file: relativeFile(ctx, ctx.entryFile),
    },
  ];
}

function isInsideSetTimeoutCallback(ts: any, node: any): boolean {
  let current = node.parent;

  while (current) {
    if (
      (ts.isFunctionExpression(current) || ts.isArrowFunction(current)) &&
      current.parent &&
      ts.isCallExpression(current.parent) &&
      ts.isIdentifier(current.parent.expression) &&
      current.parent.expression.text === 'setTimeout' &&
      current.parent.arguments[0] === current
    ) {
      return true;
    }

    current = current.parent;
  }

  return false;
}

/**
 * cs.close() should be deferred inside a short setTimeout so Metric Insights can flush
 * cs.result/log output first - see README.md "Finishing runs".
 */
function ruleCsCloseNotDeferred(ctx: RuleContext): SanityCheckFinding[] {
  const { ts } = ctx;
  const findings: SanityCheckFinding[] = [];

  for (const filePath of ctx.sourceFiles) {
    const sourceFile = ctx.fileAsts.get(filePath);

    if (!sourceFile) {
      continue;
    }

    function visit(node: any) {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        isCsOrCustomScriptIdentifier(ts, node.expression.expression) &&
        node.expression.name.text === 'close' &&
        !isInsideSetTimeoutCallback(ts, node)
      ) {
        findings.push({
          ruleId: 'cs-close-not-deferred',
          severity: 'warning',
          message:
            'cs.close() is called directly instead of inside a setTimeout(...) callback. Schedule it (e.g. setTimeout(() => cs.close(), 500)) so Metric Insights can flush cs.result/log output first.',
          file: relativeFile(ctx, filePath),
          line: getLine(sourceFile, node),
        });
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return findings;
}

/**
 * Long-running scripts need a scriptTimeout param plus a load-time safety setTimeout that
 * force-closes the run - see README.md "Finishing runs". This rule only checks the param is
 * declared; it can't verify the safety-timer wiring statically without excessive false positives.
 */
function ruleRequireScriptTimeoutParam(ctx: RuleContext): SanityCheckFinding[] {
  const findings: SanityCheckFinding[] = [];

  for (const call of ctx.parseParamsCalls) {
    const fieldNames = new Set<string>([
      ...(call.typeInfoTable?.map((row) => row.name) ?? []),
      ...Object.keys(call.defaultParams ?? {}),
    ]);

    if (!fieldNames.has('scriptTimeout')) {
      findings.push({
        ruleId: 'require-script-timeout-param',
        severity: 'warning',
        message:
          'parseParams<T>() does not declare a scriptTimeout field. Add one and register a load-time safety setTimeout that force-closes the run if it is exceeded.',
        file: relativeFile(ctx, call.filePath),
        line: call.line,
      });
    }
  }

  return findings;
}

function containsHomeSiteReference(ts: any, node: any): boolean {
  let found = false;

  function inner(n: any) {
    if (found || !n) {
      return;
    }

    if (
      ts.isPropertyAccessExpression(n) &&
      isCsOrCustomScriptIdentifier(ts, n.expression) &&
      n.name.text === 'homeSite'
    ) {
      found = true;

      return;
    }

    ts.forEachChild(n, inner);
  }

  inner(node);

  return found;
}

function urlArgTargetsMiBackend(ts: any, urlArg: any): boolean {
  if (!urlArg) {
    return false;
  }

  if (ts.isStringLiteral(urlArg) && urlArg.text.startsWith('/api/')) {
    return true;
  }

  return containsHomeSiteReference(ts, urlArg);
}

/**
 * cs.runApiRequest handles MI backend auth/token refresh; raw fetch/XHR/$.ajax should only be
 * used for third-party APIs. Only URLs clearly targeting the MI backend (cs.homeSite, or a bare
 * "/api/..." path) are flagged - third-party and unresolvable URL expressions are left alone, see
 * ai-addons/claude/CLAUDE.md's "Use cs.runApiRequest ... for all Metric Insights backend HTTP calls".
 */
function ruleRawHttpToMiBackend(ctx: RuleContext): SanityCheckFinding[] {
  const { ts } = ctx;
  const findings: SanityCheckFinding[] = [];

  for (const filePath of ctx.sourceFiles) {
    const sourceFile = ctx.fileAsts.get(filePath);

    if (!sourceFile) {
      continue;
    }

    const sourceCode = sourceFile.getFullText();
    const fileHasXhrConstructor = sourceCode.includes('XMLHttpRequest');

    function report(node: any, detail: string) {
      findings.push({
        ruleId: 'raw-http-to-mi-backend',
        severity: 'warning',
        message: `Raw ${detail} call appears to target the Metric Insights backend; use cs.runApiRequest(url, settings) instead so auth/token handling is managed for you. (Third-party API calls are fine with fetch/XHR/$.ajax - this only flags URLs that look like MI backend calls.)`,
        file: relativeFile(ctx, filePath),
        line: getLine(sourceFile, node),
      });
    }

    function visit(node: any) {
      if (ts.isCallExpression(node)) {
        if (
          ts.isIdentifier(node.expression) &&
          node.expression.text === 'fetch' &&
          urlArgTargetsMiBackend(ts, node.arguments[0])
        ) {
          report(node, 'fetch(...)');
        }

        if (
          ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          (node.expression.expression.text === '$' || node.expression.expression.text === 'jQuery') &&
          node.expression.name.text === 'ajax'
        ) {
          const settingsArg = node.arguments[0];

          if (settingsArg && ts.isObjectLiteralExpression(settingsArg)) {
            const urlProp = settingsArg.properties.find(
              (p: any) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'url',
            );

            if (urlProp && urlArgTargetsMiBackend(ts, urlProp.initializer)) {
              report(node, '$.ajax(...)');
            }
          }
        }

        if (
          fileHasXhrConstructor &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === 'open' &&
          node.arguments.length >= 2 &&
          urlArgTargetsMiBackend(ts, node.arguments[1])
        ) {
          report(node, 'XMLHttpRequest');
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return findings;
}

/**
 * Metric Insights only passes scalar (string | number | boolean) values into parseParams -
 * see src/index.ts's ValidScriptParameters<T> constraint. A field whose display type resolved to
 * 'any' during typeInfoTable expansion is almost always a non-scalar (object/array/function) field.
 */
const INDEX_SIGNATURE_NAME = /^\[.+:\s*.+\]$/;

function ruleParseParamsNonScalar(ctx: RuleContext): SanityCheckFinding[] {
  const findings: SanityCheckFinding[] = [];

  for (const call of ctx.parseParamsCalls) {
    for (const row of call.typeInfoTable ?? []) {
      if (INDEX_SIGNATURE_NAME.test(row.name)) {
        continue;
      }

      if (row.typeStr === 'any') {
        findings.push({
          ruleId: 'parse-params-non-scalar',
          severity: 'warning',
          message: `parseParams field "${row.name}" does not resolve to string | number | boolean. Metric Insights only supports scalar parameter values; a non-scalar field (object, array, function) will not be populated correctly at runtime.`,
          file: relativeFile(ctx, call.filePath),
          line: call.line,
        });
      }
    }
  }

  return findings;
}

function isWindowPropAccess(ts: any, node: any, propName: string): boolean {
  return (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'window' &&
    node.name.text === propName
  );
}

function fileHasWindowGuard(ts: any, sourceFile: any, propName: string): boolean {
  let found = false;

  function visit(node: any) {
    if (found) {
      return;
    }

    if (ts.isTypeOfExpression(node) && isWindowPropAccess(ts, node.expression, propName)) {
      found = true;

      return;
    }

    if (ts.isIfStatement(node) && isWindowPropAccess(ts, node.expression, propName)) {
      found = true;

      return;
    }

    if (ts.isConditionalExpression(node) && isWindowPropAccess(ts, node.condition, propName)) {
      found = true;

      return;
    }

    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
      isWindowPropAccess(ts, node.left, propName)
    ) {
      found = true;

      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return found;
}

/**
 * window.req/window.user are only conditionally present (see README.md) and must be
 * feature-detected before use. This is a file-level heuristic (not flow-sensitive): if any
 * recognizable guard exists anywhere in the file, every access in that file is considered guarded.
 */
function ruleUnguardedWindowContext(ctx: RuleContext): SanityCheckFinding[] {
  const { ts } = ctx;
  const findings: SanityCheckFinding[] = [];

  for (const filePath of ctx.sourceFiles) {
    const sourceFile = ctx.fileAsts.get(filePath);

    if (!sourceFile) {
      continue;
    }

    for (const propName of ['req', 'user']) {
      if (fileHasWindowGuard(ts, sourceFile, propName)) {
        continue;
      }

      function visit(node: any) {
        if (
          ts.isPropertyAccessExpression(node) &&
          isWindowPropAccess(ts, node.expression, propName)
        ) {
          findings.push({
            ruleId: 'unguarded-window-context',
            severity: 'info',
            message: `window.${propName}.${node.name.text} is accessed without a visible guard (e.g. typeof window.${propName} === 'string', or if (window.${propName})) earlier in the file. window.${propName} is not always present - feature-detect before use.`,
            file: relativeFile(ctx, filePath),
            line: getLine(sourceFile, node),
          });
        }

        ts.forEachChild(node, visit);
      }

      visit(sourceFile);
    }
  }

  return findings;
}

/**
 * v6 (PhantomJS/ES5) only ships a small manual polyfill set (Object.assign, Array.prototype.find,
 * Promise, String.prototype.includes - see src/polyfill/index-v6.ts). These name-matched APIs are
 * not in that set and are not guaranteed to exist at runtime under v6. Deliberately excludes
 * Array.prototype.includes and Promise.prototype.finally: their names collide with an already-
 * polyfilled String.prototype.includes / likely promise-polyfill support, so a name-only match
 * would be more misleading than helpful.
 */
const V6_STATIC_APIS: Record<string, Set<string>> = {
  Array: new Set(['from', 'of']),
  Object: new Set(['entries', 'values', 'fromEntries']),
  Number: new Set(['isInteger', 'isFinite', 'isNaN']),
  Promise: new Set(['allSettled']),
};

const V6_INSTANCE_METHOD_NAMES = new Set(['padStart', 'padEnd', 'trimStart', 'trimEnd', 'repeat']);

function ruleV6UnsupportedBuiltin(ctx: RuleContext): SanityCheckFinding[] {
  if (ctx.v7) {
    return [];
  }

  const { ts } = ctx;
  const findings: SanityCheckFinding[] = [];

  for (const filePath of ctx.sourceFiles) {
    const sourceFile = ctx.fileAsts.get(filePath);

    if (!sourceFile) {
      continue;
    }

    function visit(node: any) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const objExpr = node.expression.expression;
        const propName = node.expression.name.text;

        if (ts.isIdentifier(objExpr) && V6_STATIC_APIS[objExpr.text]?.has(propName)) {
          findings.push({
            ruleId: 'v6-unsupported-builtin',
            severity: 'warning',
            message: `${objExpr.text}.${propName}(...) is not in cs-helper's v6 (PhantomJS/ES5) polyfill set and is not guaranteed to exist at runtime. Avoid it, or build with --v7.`,
            file: relativeFile(ctx, filePath),
            line: getLine(sourceFile, node),
          });
        } else if (V6_INSTANCE_METHOD_NAMES.has(propName)) {
          findings.push({
            ruleId: 'v6-unsupported-builtin',
            severity: 'warning',
            message: `.${propName}(...) is not in cs-helper's v6 (PhantomJS/ES5) polyfill set and is not guaranteed to exist at runtime (name-based match - verify the receiver type). Avoid it, or build with --v7.`,
            file: relativeFile(ctx, filePath),
            line: getLine(sourceFile, node),
          });
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return findings;
}

/**
 * Statically analyzes a custom script entry file (and its transitive relative imports) for common
 * correctness issues, following the conventions documented in README.md and ai-addons/claude/CLAUDE.md.
 * Pure/side-effect-free: callers own presentation (see bin/build.ts and bin/check.ts).
 */
export function runSanityChecks(
  entryFile: string,
  options: RunSanityChecksOptions = {},
): SanityCheckFinding[] {
  const ts = require('typescript');
  const resolvedEntry = pathLib.resolve(entryFile);
  const sourceFiles: string[] = paramsDocs.getSourceFilesFromEntry(resolvedEntry);
  const fileAsts = new Map<string, any>();

  for (const filePath of sourceFiles) {
    const content = fs.readFileSync(filePath, 'utf-8');

    fileAsts.set(filePath, ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true));
  }

  const ctx: RuleContext = {
    ts,
    entryFile: resolvedEntry,
    projectRoot: options.projectRoot ?? process.cwd(),
    sourceFiles,
    fileAsts,
    parseParamsCalls: paramsDocs.analyzeParseParamsData(resolvedEntry),
    v7: !!options.v7,
  };

  const findings = [
    ...ruleNoConsole(ctx),
    ...ruleRequireCsClose(ctx),
    ...ruleCsCloseNotDeferred(ctx),
    ...ruleRequireScriptTimeoutParam(ctx),
    ...ruleRawHttpToMiBackend(ctx),
    ...ruleParseParamsNonScalar(ctx),
    ...ruleUnguardedWindowContext(ctx),
    ...ruleV6UnsupportedBuiltin(ctx),
  ];

  findings.sort((a, b) => {
    if (a.file !== b.file) {
      return a.file.localeCompare(b.file);
    }

    return (a.line ?? 0) - (b.line ?? 0);
  });

  return findings;
}

module.exports = { runSanityChecks };

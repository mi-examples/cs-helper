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
    typeInfoTable?: Array<{ name: string; typeStr: string; isScriptTimeout?: boolean }>;
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

function isRunApiRequestCall(ts: any, node: any): boolean {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    isCsOrCustomScriptIdentifier(ts, node.expression.expression) &&
    node.expression.name.text === 'runApiRequest'
  );
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
 * A self-managed scriptTimeout param + load-time safety setTimeout is still a good practice
 * (graceful, script-specific handling before MI's own kill) - see README.md "Finishing runs".
 * Not a hard requirement, though: newer Metric Insights instances can enforce their own
 * admin-configured "Terminate run after" wall-clock limit independently of script code (calls
 * customScript.result("run timed out") then customScript.close() after N minutes; this is
 * server-side config, invisible to static analysis of the script source), so this is info-level,
 * not a warning. This rule only checks the param is declared; it can't verify the safety-timer
 * wiring statically without excessive false positives.
 */
function ruleScriptTimeoutParam(ctx: RuleContext): SanityCheckFinding[] {
  const findings: SanityCheckFinding[] = [];

  for (const call of ctx.parseParamsCalls) {
    const fieldNames = new Set<string>([
      ...(call.typeInfoTable?.map((row) => row.name) ?? []),
      ...Object.keys(call.defaultParams ?? {}),
    ]);
    const hasMarkedField = (call.typeInfoTable ?? []).some((row) => row.isScriptTimeout);

    if (!fieldNames.has('scriptTimeout') && !hasMarkedField) {
      findings.push({
        ruleId: 'script-timeout-param',
        severity: 'info',
        message:
          "parseParams<T>() does not declare a scriptTimeout field. A self-managed timeout (declare scriptTimeout and register a load-time safety setTimeout) gives you graceful, script-specific handling before MI's own kill - recommended, but not required if you're relying on MI's admin-configured \"Terminate run after\" instance setting (where supported).",
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
 * MI injects the `token` header itself and it expires (~10 minutes on average - see
 * ai-addons/claude/CLAUDE.md's token TTL note); a hardcoded string literal there is almost always
 * a stale/one-off grabbed token that will start failing partway through a run. Only literal values
 * are flagged (not variables/expressions) to avoid penalizing a legitimate dynamic refresh flow.
 */
function ruleManualTokenHeaderOverride(ctx: RuleContext): SanityCheckFinding[] {
  const { ts } = ctx;
  const findings: SanityCheckFinding[] = [];

  for (const filePath of ctx.sourceFiles) {
    const sourceFile = ctx.fileAsts.get(filePath);

    if (!sourceFile) {
      continue;
    }

    function visit(node: any) {
      if (
        ts.isPropertyAssignment(node) &&
        ((ts.isIdentifier(node.name) && node.name.text === 'token') ||
          (ts.isStringLiteral(node.name) && node.name.text === 'token')) &&
        ts.isStringLiteral(node.initializer)
      ) {
        findings.push({
          ruleId: 'manual-token-header-override',
          severity: 'error',
          message:
            'A hardcoded "token" header value was found. The MI-injected token expires (~10 minutes on average) - do not hardcode it. Prefer cs.runApiRequest (auth is handled for you), or refresh via GET /api/get_token if you must set it manually.',
          file: relativeFile(ctx, filePath),
          line: getLine(sourceFile, node),
        });
      }

      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isPropertyAccessExpression(node.left) &&
        isCsOrCustomScriptIdentifier(ts, node.left.expression) &&
        node.left.name.text === 'apiToken'
      ) {
        findings.push({
          ruleId: 'manual-token-header-override',
          severity: 'error',
          message:
            'Direct assignment to cs.apiToken was found. The MI-injected token expires (~10 minutes on average); reassigning it manually is fragile - refresh via GET /api/get_token instead of overwriting it directly.',
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
 * True if `name` is referenced anywhere in `node`'s subtree - called directly (`resolve(x)`),
 * passed by value as a callback (`{ success: resolve, error: reject }` - the standard
 * cs.runApiRequest Promise-wrapper idiom - or `.then(resolve)`), or otherwise. Deliberately broad
 * (any Identifier with matching text, not just call expressions): the goal is "was this ever used
 * at all", not "was this specifically invoked as `name(...)` in the source text" - the latter
 * false-positives on the pass-by-reference pattern, which is by far the more common one in
 * practice.
 */
function containsIdentifierReference(ts: any, node: any, name: string): boolean {
  let found = false;

  function inner(n: any) {
    if (found || !n) {
      return;
    }

    if (ts.isIdentifier(n) && n.text === name) {
      found = true;

      return;
    }

    ts.forEachChild(n, inner);
  }

  inner(node);

  return found;
}

function subtreeContainsRunApiRequest(ts: any, node: any): boolean {
  let found = false;

  function inner(n: any) {
    if (found || !n) {
      return;
    }

    if (isRunApiRequestCall(ts, n)) {
      found = true;

      return;
    }

    ts.forEachChild(n, inner);
  }

  inner(node);

  return found;
}

/**
 * A Promise wrapping cs.runApiRequest must call both resolve and reject or it may never settle -
 * see ai-addons/claude/CLAUDE.md's Promise wrapper pattern note. Only checked when the executor
 * body contains a runApiRequest call, to scope this to the documented pitfall.
 */
function ruleRunApiRequestPromiseMissingHandler(ctx: RuleContext): SanityCheckFinding[] {
  const { ts } = ctx;
  const findings: SanityCheckFinding[] = [];

  for (const filePath of ctx.sourceFiles) {
    const sourceFile = ctx.fileAsts.get(filePath);

    if (!sourceFile) {
      continue;
    }

    function visit(node: any) {
      if (
        ts.isNewExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'Promise' &&
        node.arguments?.length
      ) {
        const executor = node.arguments[0];

        if (
          (ts.isArrowFunction(executor) || ts.isFunctionExpression(executor)) &&
          executor.parameters.length >= 2 &&
          subtreeContainsRunApiRequest(ts, executor.body)
        ) {
          const resolveParam = executor.parameters[0].name;
          const rejectParam = executor.parameters[1].name;
          const resolveUsed =
            ts.isIdentifier(resolveParam) &&
            containsIdentifierReference(ts, executor.body, resolveParam.text);
          const rejectUsed =
            ts.isIdentifier(rejectParam) &&
            containsIdentifierReference(ts, executor.body, rejectParam.text);

          if (!resolveUsed || !rejectUsed) {
            const missing = [!resolveUsed && 'resolve', !rejectUsed && 'reject']
              .filter(Boolean)
              .join(' and ');

            findings.push({
              ruleId: 'runapirequest-promise-missing-handler',
              severity: 'warning',
              message: `This Promise wraps cs.runApiRequest but never references ${missing} - the promise may never settle if that code path is hit.`,
              file: relativeFile(ctx, filePath),
              line: getLine(sourceFile, node),
            });
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return findings;
}

const HEARTBEAT_REFRESHING_CS_MEMBERS = new Set(['log', 'runApiRequest', 'updateHeartBeat']);

function subtreeRefreshesHeartbeat(ts: any, node: any): boolean {
  let found = false;

  function inner(n: any) {
    if (found || !n) {
      return;
    }

    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      isCsOrCustomScriptIdentifier(ts, n.expression.expression) &&
      HEARTBEAT_REFRESHING_CS_MEMBERS.has(n.expression.name.text)
    ) {
      found = true;

      return;
    }

    ts.forEachChild(n, inner);
  }

  inner(node);

  return found;
}

function isLoopStatement(ts: any, node: any): boolean {
  return (
    ts.isForStatement(node) ||
    ts.isWhileStatement(node) ||
    ts.isDoStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isForInStatement(node)
  );
}

/**
 * True if node's subtree contains any call/new expression - a loose proxy for "this loop does
 * more than pure local arithmetic/assignment". A loop with zero calls at all (just index math,
 * comparisons, assignments) is about as safe a bet as static analysis gets for "this won't run
 * long enough to matter" - excluding those measurably cuts false positives on trivial loops
 * (small in-memory array/map building, tight numeric loops, etc.), which vastly outnumber
 * genuinely risky ones in real code.
 */
function subtreeContainsAnyCall(ts: any, node: any): boolean {
  let found = false;

  function inner(n: any) {
    if (found || !n) {
      return;
    }

    if (ts.isCallExpression(n) || ts.isNewExpression(n)) {
      found = true;

      return;
    }

    ts.forEachChild(n, inner);
  }

  inner(node);

  return found;
}

/**
 * cs.heartBeat is only refreshed by cs.log, cs.runApiRequest, and cs.updateHeartBeat (see
 * README.md's "Inactivity watchdog") - a loop with none of these can silently trip the ~1 minute
 * watchdog. AST-only heuristic: doesn't know real iteration counts/durations, so this can't tell
 * "processes a huge API response" from "iterates a handful of items" - info-level, and collapsed
 * to at most one finding per file (rather than one per loop) so a file with several such loops
 * doesn't drown other findings in near-duplicate noise.
 */
function ruleRequireHeartbeatInLongLoop(ctx: RuleContext): SanityCheckFinding[] {
  const { ts } = ctx;
  const findings: SanityCheckFinding[] = [];

  for (const filePath of ctx.sourceFiles) {
    const sourceFile = ctx.fileAsts.get(filePath);

    if (!sourceFile) {
      continue;
    }

    let firstRiskyLoop: any;
    let riskyLoopCount = 0;

    function visit(node: any) {
      if (
        isLoopStatement(ts, node) &&
        node.statement &&
        subtreeContainsAnyCall(ts, node.statement) &&
        !subtreeRefreshesHeartbeat(ts, node.statement)
      ) {
        riskyLoopCount += 1;
        firstRiskyLoop = firstRiskyLoop ?? node;
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    if (firstRiskyLoop) {
      const message =
        riskyLoopCount > 1
          ? `${riskyLoopCount} loops in this file have no cs.log/cs.runApiRequest/cs.updateHeartBeat call inside them. If any process a large collection or do otherwise heavy work, a long silent stretch can trip the ~1 minute inactivity watchdog - call cs.updateHeartBeat() periodically in those.`
          : `A loop in this file has no cs.log/cs.runApiRequest/cs.updateHeartBeat call inside it. If it processes a large collection or does otherwise heavy work, a long silent stretch can trip the ~1 minute inactivity watchdog - call cs.updateHeartBeat() periodically in it.`;

      findings.push({
        ruleId: 'require-heartbeat-in-long-loop',
        severity: 'info',
        message,
        file: relativeFile(ctx, filePath),
        line: getLine(sourceFile, firstRiskyLoop),
      });
    }
  }

  return findings;
}

/**
 * A script that calls cs.runApiRequest repeatedly inside a loop but never references the token
 * refresh endpoint risks failing requests once the injected token expires (~10 minutes on average
 * - see ai-addons/claude/CLAUDE.md). File-level, heuristic, at most one finding per file.
 */
function ruleMissingTokenRefreshForLongScript(ctx: RuleContext): SanityCheckFinding[] {
  const { ts } = ctx;
  const findings: SanityCheckFinding[] = [];

  for (const filePath of ctx.sourceFiles) {
    const sourceFile = ctx.fileAsts.get(filePath);

    if (!sourceFile) {
      continue;
    }

    if (sourceFile.getFullText().includes('get_token')) {
      continue;
    }

    let hasLoopWithApiCall = false;

    function visit(node: any) {
      if (hasLoopWithApiCall) {
        return;
      }

      if (isLoopStatement(ts, node) && node.statement && subtreeContainsRunApiRequest(ts, node.statement)) {
        hasLoopWithApiCall = true;

        return;
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    if (hasLoopWithApiCall) {
      findings.push({
        ruleId: 'missing-token-refresh-for-long-script',
        severity: 'info',
        message:
          'This script makes repeated cs.runApiRequest calls inside a loop but has no visible token-refresh logic (GET /api/get_token). The injected token expires in ~10 minutes on average - long-running scripts may start failing backend requests partway through.',
        file: relativeFile(ctx, filePath),
      });
    }
  }

  return findings;
}

/**
 * Custom scripts run in the browser (PhantomJS/Puppeteer), not Node - requiring a Node builtin or
 * referencing process.env/process.argv/__dirname/__filename will not work at runtime even if the
 * bundle compiles.
 */
const NODE_BUILTIN_MODULES = new Set([
  'fs', 'path', 'os', 'child_process', 'http', 'https', 'net', 'crypto', 'stream',
  'util', 'events', 'cluster', 'dgram', 'dns', 'readline', 'repl', 'tls', 'vm', 'zlib', 'worker_threads',
]);
const NODE_GLOBAL_IDENTIFIERS = new Set(['__dirname', '__filename']);

function ruleNodeOnlyApi(ctx: RuleContext): SanityCheckFinding[] {
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
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require' &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0]) &&
        NODE_BUILTIN_MODULES.has(node.arguments[0].text)
      ) {
        findings.push({
          ruleId: 'node-only-api',
          severity: 'error',
          message: `require('${node.arguments[0].text}') is a Node.js builtin; custom scripts run in the browser (PhantomJS/Puppeteer) and it will not be available at runtime.`,
          file: relativeFile(ctx, filePath),
          line: getLine(sourceFile, node),
        });
      } else if (ts.isIdentifier(node) && NODE_GLOBAL_IDENTIFIERS.has(node.text)) {
        findings.push({
          ruleId: 'node-only-api',
          severity: 'error',
          message: `${node.text} is a Node.js global; it is not available in the browser environment custom scripts run in.`,
          file: relativeFile(ctx, filePath),
          line: getLine(sourceFile, node),
        });
      } else if (
        ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'process' &&
        (node.name.text === 'env' || node.name.text === 'argv')
      ) {
        findings.push({
          ruleId: 'node-only-api',
          severity: 'error',
          message: `process.${node.name.text} is a Node.js API; it is not available in the browser environment custom scripts run in.`,
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
 * Correlates password-typed parseParams fields (JSDoc @password, see bin/params-docs.ts) with
 * cs.log/cs.error/cs.result/console.* call arguments that reference them, to catch accidentally
 * logging a secret. Only covers the documented `const params = parseParams<T>(...)` pattern
 * (member access params.field) - destructured access isn't tracked, since the bare identifier
 * can't be reliably distinguished from unrelated same-named locals.
 */
function findPasswordFieldsPerVariable(
  ctx: RuleContext,
  filePath: string,
  sourceFile: any,
): Map<string, Set<string>> {
  const { ts } = ctx;
  const result = new Map<string, Set<string>>();

  function visit(node: any) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'parseParams') {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      const callInfo = ctx.parseParamsCalls.find((c) => c.filePath === filePath && c.line === line);
      const passwordFields = (callInfo?.typeInfoTable ?? [])
        .filter((row) => row.typeStr === 'password')
        .map((row) => row.name);

      if (passwordFields.length > 0) {
        let decl = node.parent;

        while (decl && !ts.isVariableDeclaration(decl)) {
          decl = decl.parent;
        }

        if (decl && ts.isIdentifier(decl.name)) {
          result.set(decl.name.text, new Set(passwordFields));
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return result;
}

const LOG_LIKE_CS_MEMBERS = new Set(['log', 'error', 'result']);

function ruleNoPasswordInLog(ctx: RuleContext): SanityCheckFinding[] {
  const { ts } = ctx;
  const findings: SanityCheckFinding[] = [];

  for (const filePath of ctx.sourceFiles) {
    const sourceFile = ctx.fileAsts.get(filePath);

    if (!sourceFile) {
      continue;
    }

    const passwordFieldsByVar = findPasswordFieldsPerVariable(ctx, filePath, sourceFile);

    if (passwordFieldsByVar.size === 0) {
      continue;
    }

    function referencesPasswordField(node: any): string | null {
      let found: string | null = null;

      function inner(n: any) {
        if (found || !n) {
          return;
        }

        if (
          ts.isPropertyAccessExpression(n) &&
          ts.isIdentifier(n.expression) &&
          passwordFieldsByVar.get(n.expression.text)?.has(n.name.text)
        ) {
          found = `${n.expression.text}.${n.name.text}`;

          return;
        }

        ts.forEachChild(n, inner);
      }

      inner(node);

      return found;
    }

    function visit(node: any) {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ((isCsOrCustomScriptIdentifier(ts, node.expression.expression) &&
          LOG_LIKE_CS_MEMBERS.has(node.expression.name.text)) ||
          (ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'console'))
      ) {
        for (const arg of node.arguments) {
          const ref = referencesPasswordField(arg);

          if (ref) {
            findings.push({
              ruleId: 'no-password-in-log',
              severity: 'error',
              message: `${ref} looks like a password-typed parseParams field passed into a log/result call. Avoid logging secrets - Metric Insights run logs may be visible to other users.`,
              file: relativeFile(ctx, filePath),
              line: getLine(sourceFile, node),
            });

            break;
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  }

  return findings;
}

const JQUERY_DEFERRED_METHODS = new Set(['done', 'fail', 'always']);

/**
 * True for cs.runApiRequest(...) itself, or a .done/.fail/.always(...) call chained (possibly
 * repeatedly, e.g. .done(...).fail(...)) on top of one - so every link in such a chain gets
 * flagged, not just the one directly touching the runApiRequest call.
 */
function isRunApiRequestOrDeferredChain(ts: any, node: any): boolean {
  if (isRunApiRequestCall(ts, node)) {
    return true;
  }

  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    JQUERY_DEFERRED_METHODS.has(node.expression.name.text) &&
    isRunApiRequestOrDeferredChain(ts, node.expression.expression)
  );
}

/**
 * v6 (PhantomJS) uses jQuery 1.2.x internally for cs.runApiRequest's ajax settings; 1.2.x's
 * $.ajax does not return a Deferred/jqXHR object (added in jQuery 1.5), so .done/.fail/.always
 * chained on cs.runApiRequest(...) will throw under v6. v7 (jQuery 3.x) supports this.
 */
function ruleV6JqueryLegacyAjaxPromise(ctx: RuleContext): SanityCheckFinding[] {
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
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        JQUERY_DEFERRED_METHODS.has(node.expression.name.text) &&
        isRunApiRequestOrDeferredChain(ts, node.expression.expression)
      ) {
        findings.push({
          ruleId: 'v6-jquery-legacy-ajax-promise',
          severity: 'warning',
          message: `.${node.expression.name.text}(...) chained on cs.runApiRequest(...) relies on a jQuery Deferred/jqXHR return value, which v6's bundled jQuery 1.2.x does not provide (added in jQuery 1.5). Use the settings object's success/error callbacks instead, or build with --v7.`,
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
 * eval/Function-from-string is fragile under bundling/minification and a common source of
 * hard-to-debug failures - flag it outright.
 */
function ruleNoEval(ctx: RuleContext): SanityCheckFinding[] {
  const { ts } = ctx;
  const findings: SanityCheckFinding[] = [];

  for (const filePath of ctx.sourceFiles) {
    const sourceFile = ctx.fileAsts.get(filePath);

    if (!sourceFile) {
      continue;
    }

    function visit(node: any) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'eval') {
        findings.push({
          ruleId: 'no-eval',
          severity: 'error',
          message:
            'eval(...) is fragile under bundling/minification and a common source of hard-to-debug failures. Avoid it.',
          file: relativeFile(ctx, filePath),
          line: getLine(sourceFile, node),
        });
      }

      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'Function') {
        findings.push({
          ruleId: 'no-eval',
          severity: 'error',
          message: 'new Function(...) constructs code from a string, same risks as eval(...). Avoid it.',
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

/*
 * A "hardcoded MI backend URL" rule was considered here (flag an absolute https://.../api/... URL
 * literal instead of one built from cs.homeSite) but was dropped: there is no reliable way to tell
 * a hardcoded MI instance URL apart from a completely ordinary third-party API call whose path
 * happens to contain "/api/" (extremely common - e.g. https://example.com/api/data), and matching
 * on that alone false-positives on normal third-party usage. raw-http-to-mi-backend below already
 * covers the safe, unambiguous case (a bare "/api/..." path, or one built from cs.homeSite).
 */

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
    ...ruleScriptTimeoutParam(ctx),
    ...ruleRawHttpToMiBackend(ctx),
    ...ruleParseParamsNonScalar(ctx),
    ...ruleUnguardedWindowContext(ctx),
    ...ruleV6UnsupportedBuiltin(ctx),
    ...ruleManualTokenHeaderOverride(ctx),
    ...ruleRunApiRequestPromiseMissingHandler(ctx),
    ...ruleRequireHeartbeatInLongLoop(ctx),
    ...ruleMissingTokenRefreshForLongScript(ctx),
    ...ruleNodeOnlyApi(ctx),
    ...ruleNoPasswordInLog(ctx),
    ...ruleV6JqueryLegacyAjaxPromise(ctx),
    ...ruleNoEval(ctx),
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

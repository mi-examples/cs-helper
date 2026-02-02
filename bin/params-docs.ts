const pathLib = require('path');
const fs = require('fs');

type ParamRow = {
  name: string;
  typeStr: string;
  optional: boolean;
  description: string;
  example?: string;
  acceptsValues?: string[];
};

type ParseParamsCallInfo = {
  filePath: string;
  typeInfo: string;
  typeInfoTable?: ParamRow[];
  defaultParams: Record<string, any>;
  line: number;
};

/**
 * Resolves entry file and all files imported by it (transitively) via relative paths.
 * Skips node_modules and non-relative specifiers.
 */
function getSourceFilesFromEntry(entryFile: string): string[] {
  const ts = require('typescript');
  const visited = new Set<string>();
  const result: string[] = [];
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

  function resolveModuleSpecifier(
    specifier: string,
    fromDir: string,
  ): string | null {
    if (!specifier.startsWith('.')) {
      return null; // skip node_modules / packages
    }

    let resolved = pathLib.resolve(fromDir, specifier);

    if (!pathLib.extname(resolved)) {
      for (const ext of extensions) {
        const candidate = resolved + ext;

        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }

      for (const ext of extensions) {
        const candidate = pathLib.join(resolved, 'index' + ext);

        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }

      return null;
    }

    return fs.existsSync(resolved) ? resolved : null;
  }

  function collectImports(filePath: string) {
    const normalized = pathLib.resolve(filePath);

    if (visited.has(normalized)) {
      return;
    }

    visited.add(normalized);

    if (!fs.existsSync(normalized)) {
      return;
    }

    const sourceCode = fs.readFileSync(normalized, 'utf-8');
    const sourceFileObj = ts.createSourceFile(
      filePath,
      sourceCode,
      ts.ScriptTarget.Latest,
      true,
    );

    result.push(normalized);

    const fromDir = pathLib.dirname(normalized);

    function visit(node: any) {
      if (ts.isImportDeclaration(node)) {
        const specifier = node.moduleSpecifier;

        if (ts.isStringLiteral(specifier)) {
          const target = resolveModuleSpecifier(specifier.text, fromDir);

          if (target) {
            collectImports(target);
          }
        }
      }

      if (
        ts.isCallExpression(node) &&
        node.expression?.kind === ts.SyntaxKind.ImportKeyword
      ) {
        const arg = node.arguments?.[0];

        if (arg && ts.isStringLiteral(arg)) {
          const target = resolveModuleSpecifier(arg.text, fromDir);

          if (target) {
            collectImports(target);
          }
        }
      }

      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require'
      ) {
        const arg = node.arguments?.[0];

        if (arg && ts.isStringLiteral(arg)) {
          const target = resolveModuleSpecifier(arg.text, fromDir);

          if (target) {
            collectImports(target);
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFileObj);
  }

  collectImports(pathLib.resolve(entryFile));

  return result;
}

type JSDocParamInfo = {
  description: string;
  example: string;
  password?: boolean;
};

/**
 * Parses JSDoc inner text (between /** and *\/) into description, @example / @default, and @password.
 */
function parseJSDocInner(inner: string): JSDocParamInfo {
  const out: JSDocParamInfo = { description: '', example: '' };
  const descPart = inner.split(/\n\s*\n|(?=@)/)[0].trim();

  out.description = descPart;

  const exampleMatch = inner.match(/@example\s+([^\n@*]+)/);

  if (exampleMatch) {
    out.example = exampleMatch[1].trim();
  }

  const defaultMatch = inner.match(/@default\s+([^\n@*]+)/);

  if (defaultMatch && !out.example) {
    out.example = defaultMatch[1].trim();
  }

  if (/@password\b/.test(inner)) {
    out.password = true;
  }

  return out;
}

/**
 * Extracts JSDoc block from leading trivia (manual scan). Returns raw inner text or ''.
 */
function getJSDocFromLeadingTrivia(
  text: string,
  fullStart: number,
  start: number,
): string {
  const leading = text.substring(fullStart, start);
  const open = leading.lastIndexOf('/**');

  if (open === -1) {
    return '';
  }

  const afterOpen = leading.slice(open + 3);
  const close = afterOpen.indexOf('*/');

  if (close === -1) {
    return '';
  }

  const raw = afterOpen.slice(0, close).trim();
  return raw
    .split(/\n/)
    .map((line: string) => line.replace(/^\s*\*\s?/, '').trim())
    .join('\n');
}

/**
 * Extracts JSDoc description and @example / @default for a declaration.
 * Uses TS getLeadingCommentRanges when available, then falls back to manual scan of leading trivia.
 */
function getJSDocParamInfo(ts: any, decl: any): JSDocParamInfo {
  const out: JSDocParamInfo = { description: '', example: '' };

  if (!decl) {
    return out;
  }

  const sourceFile = decl.getSourceFile?.();

  if (!sourceFile) {
    return out;
  }

  try {
    const text = sourceFile.getFullText();
    const fullStart =
      typeof decl.getFullStart === 'function' ? decl.getFullStart() : decl.pos;
    const start =
      typeof decl.getStart === 'function' ? decl.getStart() : decl.pos;
    let inner = '';

    if (typeof ts.getLeadingCommentRanges === 'function') {
      const commentRanges = ts.getLeadingCommentRanges(text, start);

      if (commentRanges && commentRanges.length > 0) {
        const last = commentRanges[commentRanges.length - 1];
        const raw = text.substring(last.pos, last.end).trim();

        if (raw.startsWith('/**')) {
          inner = raw
            .replace(/^\/\*\*?\s*/, '')
            .replace(/\s*\*\/$/, '')
            .split(/\n/)
            .map((line: string) => line.replace(/^\s*\*\s?/, '').trim())
            .join('\n');
        }
      }
    }

    if (!inner) {
      inner = getJSDocFromLeadingTrivia(text, fullStart, start);
    }

    if (!inner) {
      return out;
    }

    const parsed = parseJSDocInner(inner);

    out.description = parsed.description;
    out.example = parsed.example;
    if (parsed.password) {
      out.password = true;
    }

    return out;
  } catch {
    return out;
  }
}

/**
 * Maps a type to only generic primitive(s): string, number, boolean.
 * Used for the table Type column; object/custom types are not accepted.
 */
function getGenericTypeDisplay(
  checker: any,
  type: any,
  seen = new Set<number>(),
): string {
  if (!type) {
    return 'any';
  }

  const id = type.id ?? type.flags;

  if (id != null && seen.has(id)) {
    return '';
  }

  if (id != null) {
    seen.add(id);
  }

  const primitives = new Set<string>();
  const add = (s: string) => s && primitives.add(s);

  if (type.types && Array.isArray(type.types)) {
    for (const t of type.types) {
      const r = getGenericTypeDisplay(checker, t, seen);

      if (r && r !== 'any') {
        r.split(/\s*\|\s*/).forEach((p) => add(p.trim()));
      }
    }

    const arr = [...primitives].sort();

    return arr.length ? arr.join(' | ') : 'any';
  }

  if (type.value !== undefined && type.value !== null) {
    const v = type.value;

    if (typeof v === 'string') {
      return 'string';
    }

    if (typeof v === 'number') {
      return 'number';
    }

    if (v === true || v === false) {
      return 'boolean';
    }
  }

  if (type.flags != null) {
    const f = type.flags;

    if (f & 4) {
      return 'string';
    }

    if (f & 8) {
      return 'number';
    }

    if (f & 16) {
      return 'boolean';
    }
  }

  if (type.symbol && typeof checker.getDeclaredTypeOfSymbol === 'function') {
    try {
      const declared = checker.getDeclaredTypeOfSymbol(type.symbol);

      if (declared && declared !== type) {
        const r = getGenericTypeDisplay(checker, declared, seen);

        if (r && r !== 'any') {
          return r;
        }
      }
    } catch {
      //
    }
  }

  if (typeof checker.typeToString === 'function') {
    try {
      const str = checker.typeToString(type).trim().toLowerCase();

      if (str === 'boolean' || str === 'string' || str === 'number') {
        return str;
      }

      if (str === 'true' || str === 'false') {
        return 'boolean';
      }
    } catch {
      //
    }
  }
  return '';
}

/**
 * Collects literal values from a type (union of literals or type alias resolving to same).
 * Used to document "Can accept values: `a, b, c`" for enum-like params.
 */
function getAcceptableValues(
  checker: any,
  type: any,
  seen = new Set<number>(),
): string[] {
  if (!type) {
    return [];
  }

  const id = type.id ?? type.flags;

  if (id != null && seen.has(id)) {
    return [];
  }

  if (id != null) {
    seen.add(id);
  }

  const values: string[] = [];

  if (type.types && Array.isArray(type.types)) {
    for (const t of type.types) {
      values.push(...getAcceptableValues(checker, t, seen));
    }

    return [...new Set(values)].sort();
  }

  if (type.value !== undefined && type.value !== null) {
    const v = type.value;

    if (typeof v === 'string' || typeof v === 'number') {
      values.push(String(v));
    }
  }

  if (type.symbol && typeof checker.getDeclaredTypeOfSymbol === 'function') {
    try {
      const declared = checker.getDeclaredTypeOfSymbol(type.symbol);

      if (declared && declared !== type) {
        values.push(...getAcceptableValues(checker, declared, seen));
      }
    } catch {
      //
    }
  }

  return [...new Set(values)].sort();
}

/**
 * Uses TypeChecker to expand a type (including interfaces and intersections) into
 * rows with name, type, optional, and JSDoc description for table output.
 */
function expandTypeToParamRows(
  ts: any,
  checker: any,
  typeNode: any,
  sourceCode: string,
): ParamRow[] | null {
  try {
    const type = checker.getTypeFromTypeNode(typeNode);

    if (!type) {
      return null;
    }

    const rows: ParamRow[] = [];
    const seen = new Set<string>();

    const addProp = (
      name: string,
      typeStr: string,
      optional: boolean,
      description: string,
      example?: string,
      acceptsValues?: string[],
    ) => {
      if (seen.has(name)) {
        return;
      }

      seen.add(name);
      rows.push({
        name,
        typeStr,
        optional,
        description,
        example,
        acceptsValues,
      });
    };

    const props = checker.getPropertiesOfType(type);

    if (props && props.length) {
      for (const sym of props) {
        const name = sym.getName();
        const decl = sym.valueDeclaration || sym.declarations?.[0];
        const optional = !!(decl && decl.questionToken);
        const propType = checker.getTypeOfSymbolAtLocation(sym, typeNode);
        let typeStr = getGenericTypeDisplay(checker, propType) || 'any';
        const jsdoc = getJSDocParamInfo(ts, decl);
        if (jsdoc.password && typeStr === 'string') {
          typeStr = 'password';
        }
        const acceptsValues = getAcceptableValues(checker, propType);

        addProp(
          name,
          typeStr,
          optional,
          jsdoc.description,
          jsdoc.example || undefined,
          acceptsValues.length > 0 ? acceptsValues : undefined,
        );
      }
    }

    const stringIndex = type.getStringIndexType?.();

    if (stringIndex) {
      const typeStr = getGenericTypeDisplay(checker, stringIndex) || 'any';

      rows.push({
        name: '[key: string]',
        typeStr,
        optional: false,
        description: '',
      });
    }

    const numberIndex = type.getNumberIndexType?.();

    if (numberIndex) {
      const typeStr = getGenericTypeDisplay(checker, numberIndex) || 'any';

      rows.push({
        name: '[key: number]',
        typeStr,
        optional: false,
        description: '',
      });
    }

    return rows.length ? rows : null;
  } catch {
    return null;
  }
}

/**
 * Returns true if the string is a numeric value (can be used in arithmetic).
 */
function isNumericValue(s: string): boolean {
  const t = String(s).trim();

  return t !== '' && Number.isFinite(Number(t));
}

/**
 * Resolves a default value expression to a string for docs. If the value is a constant
 * (identifier), follows the symbol to its declaration and uses the initializer value.
 * Mathematical expressions with known numeric operands are evaluated (e.g. 60 * 60 * 1000 → 3600000).
 */
function resolveDefaultValue(
  ts: any,
  checker: any,
  initializer: any,
  sourceCode: string,
  depth = 0,
): string {
  if (!initializer) {
    return '';
  }

  const maxDepth = 5;

  if (depth > maxDepth) {
    return sourceCode.substring(initializer.pos, initializer.end);
  }

  const recurse = (node: any) =>
    resolveDefaultValue(ts, checker, node, sourceCode, depth + 1);

  if (ts.isStringLiteral(initializer)) {
    return `"${initializer.text}"`;
  }

  if (ts.isNumericLiteral(initializer)) {
    return initializer.text;
  }

  if (initializer.kind === ts.SyntaxKind.TrueKeyword) {
    return 'true';
  }

  if (initializer.kind === ts.SyntaxKind.FalseKeyword) {
    return 'false';
  }

  if (initializer.kind === ts.SyntaxKind.NullKeyword) {
    return 'null';
  }

  if (ts.isParenthesizedExpression?.(initializer) && initializer.expression) {
    return recurse(initializer.expression);
  }

  if (ts.isBinaryExpression(initializer)) {
    const leftStr = recurse(initializer.left);
    const rightStr = recurse(initializer.right);
    const op = initializer.operatorToken?.kind;

    if (isNumericValue(leftStr) && isNumericValue(rightStr)) {
      const left = Number(leftStr);
      const right = Number(rightStr);
      let result: number | null = null;

      if (op === ts.SyntaxKind.PlusToken) {
        result = left + right;
      } else if (op === ts.SyntaxKind.MinusToken) {
        result = left - right;
      } else if (op === ts.SyntaxKind.AsteriskToken) {
        result = left * right;
      } else if (op === ts.SyntaxKind.SlashToken) {
        result = right !== 0 ? left / right : null;
      } else if (op === ts.SyntaxKind.PercentToken) {
        result = right !== 0 ? left % right : null;
      }

      if (result !== null && Number.isFinite(result)) {
        return String(result);
      }
    }
  }

  if (
    ts.isPrefixUnaryExpression?.(initializer) &&
    initializer.operator === ts.SyntaxKind.MinusToken &&
    initializer.operand
  ) {
    const inner = recurse(initializer.operand);

    if (isNumericValue(inner)) {
      return String(-Number(inner));
    }
  }

  if (checker && ts.isIdentifier(initializer)) {
    try {
      const type = checker.getTypeAtLocation(initializer);

      if (type) {
        const str =
          typeof checker.typeToString === 'function'
            ? checker.typeToString(type, initializer)
            : String(type);

        if (str && str !== 'any' && !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(str)) {
          return str;
        }
      }

      const sym = checker.getSymbolAtLocation(initializer);

      if (sym) {
        const decl = sym.valueDeclaration || sym.declarations?.[0];

        if (decl && decl.initializer) {
          return resolveDefaultValue(
            ts,
            checker,
            decl.initializer,
            sourceCode,
            depth + 1,
          );
        }
      }
    } catch {
      //
    }
  }

  return sourceCode.substring(initializer.pos, initializer.end);
}

/**
 * Formats ParamRow[] + defaultParams as a prettified Markdown table and Params description.
 * Table: Name | Type | Required | Default. Default column shows only code default (never @example).
 * Description shows one example value: code default if present, else JSDoc @example.
 */
function formatParamsTable(
  rows: ParamRow[],
  defaultParams: Record<string, any>,
): string {
  const escape = (s: string) =>
    String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();

  /** Table Default column: only actual code default, never JSDoc @example. */
  const defaultVal = (r: ParamRow) =>
    r.name in defaultParams ? String(defaultParams[r.name]) : '';

  /** Single example for description: prefer code default, else JSDoc @example. */
  const exampleVal = (r: ParamRow) =>
    r.name in defaultParams
      ? String(defaultParams[r.name])
      : (r.example ?? '');

  const maxColWidths = {
    name: 4,
    type: 4,
    required: 8,
    default: 7,
  };
  rows.forEach((r) => {
    maxColWidths.name = Math.max(maxColWidths.name, escape(r.name).length);
    maxColWidths.type = Math.max(maxColWidths.type, escape(r.typeStr).length);
    maxColWidths.required = Math.max(
      maxColWidths.required,
      escape(r.optional ? '' : 'x').length,
    );
    maxColWidths.default = Math.max(
      maxColWidths.default,
      escape(defaultVal(r) || '').length,
    );
  });

  /**
   * Helper to center text within a given width
   */
  const centerText = (text: string, width: number): string => {
    const str = String(text);

    if (str.length >= width) {
      return str;
    }

    const pad = width - str.length;
    const leftPad = Math.floor(pad / 2);
    const rightPad = pad - leftPad;

    return ' '.repeat(leftPad) + str + ' '.repeat(rightPad);
  };

  /**
   * Name - left
   * Type - center
   * Required - center
   * Default - center
   */
  const header = `| ${'Name'.padEnd(maxColWidths.name)} | ${centerText('Type', maxColWidths.type)} | ${centerText('Required', maxColWidths.required)} | ${centerText('Default', maxColWidths.default)} |`;
  const sep = `|:${'-'.repeat(maxColWidths.name)}-|:${'-'.repeat(maxColWidths.type)}:|:${'-'.repeat(maxColWidths.required)}:|:${'-'.repeat(maxColWidths.default)}:|`;
  const body = rows
    .map((r) => {
      const required = r.optional ? '' : 'x';
      const def = defaultVal(r);
      const name = escape(r.name).padEnd(maxColWidths.name);
      const type = centerText(escape(r.typeStr), maxColWidths.type);
      const req = centerText(required, maxColWidths.required);
      const defaultValue = centerText(escape(def), maxColWidths.default);

      return `| ${name} | ${type} | ${req} | ${defaultValue} |`;
    })
    .join('\n');

  const table = `## Params\n\n${header}\n${sep}\n${body}`;

  const descLines = rows
    .filter(
      (r) =>
        r.description ||
        exampleVal(r) ||
        r.acceptsValues?.length,
    )
    .map((r) => {
      const singleExample = exampleVal(r);
      const desc = r.description || '';
      const examplePart = singleExample
        ? ` Example: \`${escape(singleExample)}\`.`
        : '';
      const acceptsPart =
        r.acceptsValues && r.acceptsValues.length > 0
          ? ` Can accept values: \`${r.acceptsValues.join(', ')}\`.`
          : '';

      return `- **${escape(r.name)}**: ${desc}${examplePart}${acceptsPart}`.trim();
    });

  const paramsDesc =
    descLines.length > 0
      ? `\n\n### Params description\n\n${descLines.join('\n')}`
      : '';

  return table + paramsDesc;
}

/**
 * Analyzes a single source file for parseParams usage. Returns structured call info.
 * When checker is provided, expands interface/intersection types into their properties.
 */
function analyzeParseParamsInFile(
  sourceFile: string,
  options: { checker?: any; program?: any; ts?: any } = {},
): ParseParamsCallInfo[] {
  const ts = options.ts || require('typescript');
  const resolvedPath = pathLib.resolve(sourceFile);
  const sourceCode = fs.readFileSync(sourceFile, 'utf-8');
  const sourceFileObj =
    options.program?.getSourceFile(resolvedPath) ??
    ts.createSourceFile(sourceFile, sourceCode, ts.ScriptTarget.Latest, true);

  const jsDocMatches: Array<{ type: string; line: number }> = [];
  const jsDocRegex = /\/\*\*[\s\S]*?\*\s*@type\s*\{([^}]+)\}[\s\S]*?\*\//g;
  let jsDocMatch;

  while ((jsDocMatch = jsDocRegex.exec(sourceCode)) !== null) {
    const matchLine = sourceCode
      .substring(0, jsDocMatch.index)
      .split('\n').length;

    jsDocMatches.push({ type: jsDocMatch[1].trim(), line: matchLine });
  }

  const parseParamsCalls: ParseParamsCallInfo[] = [];
  const checker = options.checker;

  function visit(node: any) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'parseParams'
    ) {
      let typeInfo = '';
      let defaultParams: Record<string, any> = {};
      let jsDocType: string | undefined;
      const line =
        sourceFileObj.getLineAndCharacterOfPosition(node.pos).line + 1;

      let closestJsDoc: { type: string; line: number } | undefined;

      for (const jsDoc of jsDocMatches) {
        if (jsDoc.line < line && jsDoc.line >= line - 5) {
          if (!closestJsDoc || jsDoc.line > closestJsDoc.line) {
            closestJsDoc = jsDoc;
          }
        }
      }

      if (closestJsDoc) {
        jsDocType = closestJsDoc.type;
      }

      let typeInfoTable: ParamRow[] | undefined;

      if (node.typeArguments && node.typeArguments.length > 0) {
        const typeNode = node.typeArguments[0];

        if (ts.isTypeLiteralNode(typeNode) && !checker) {
          const properties: string[] = [];

          typeNode.members.forEach((member: any) => {
            if (ts.isPropertySignature(member)) {
              const name = member.name?.text || '';
              const type = member.type
                ? sourceCode.substring(member.type.pos, member.type.end)
                : 'any';
              const optional = member.questionToken ? '?' : '';

              properties.push(`  ${name}${optional}: ${type};`);
            }
          });

          typeInfo = properties.join('\n');
        } else if (checker) {
          const rows = expandTypeToParamRows(ts, checker, typeNode, sourceCode);

          if (rows && rows.length) {
            typeInfoTable = rows;
            typeInfo = rows
              .map((r) => `  ${r.name}${r.optional ? '?' : ''}: ${r.typeStr};`)
              .join('\n');
          } else {
            typeInfo = sourceCode.substring(typeNode.pos, typeNode.end);
          }
        } else {
          typeInfo = sourceCode.substring(typeNode.pos, typeNode.end);
        }
      } else if (jsDocType) {
        typeInfo = jsDocType
          .split(';')
          .map((prop) => `  ${prop.trim()}`)
          .join('\n');
      }

      if (node.arguments.length > 0) {
        const arg = node.arguments[0];

        if (ts.isObjectLiteralExpression(arg)) {
          arg.properties.forEach((prop: any) => {
            if (ts.isPropertyAssignment(prop)) {
              const key = prop.name?.text || '';
              const value = resolveDefaultValue(
                ts,
                checker,
                prop.initializer,
                sourceCode,
              );

              defaultParams[key] = value;
            }
          });
        }
      }

      parseParamsCalls.push({
        filePath: resolvedPath,
        typeInfo,
        typeInfoTable,
        defaultParams,
        line,
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFileObj);

  return parseParamsCalls;
}

// Cache for getParseParamsFromCode results, keyed by resolved entry file path
const parseParamsCache = new Map<string, ParseParamsCallInfo[]>();

/**
 * Extracts parseParams calls from the entry script and all imported scripts.
 * This is the core function that analyzes code and returns structured parameter data.
 * Resolves interface/intersection types so their properties appear in the results.
 * Can be reused in different places (docs generation, base64 encoding, etc.).
 * Results are cached by entry file path to avoid redundant parsing.
 */
function getParseParamsFromCode(entryFile: string): ParseParamsCallInfo[] {
  const resolvedPath = pathLib.resolve(entryFile);

  // Check cache first
  if (parseParamsCache.has(resolvedPath)) {
    return parseParamsCache.get(resolvedPath)!;
  }

  try {
    const ts = require('typescript');
    const sourceFiles = getSourceFilesFromEntry(entryFile);
    let program: any = null;
    let checker: any = null;

    try {
      program = ts.createProgram(sourceFiles, {
        allowJs: true,
        noEmit: true,
        skipLibCheck: true,
        removeComments: false,
      });
      checker = program.getTypeChecker();
    } catch {
      // No checker: fall back to AST-only (no interface expansion)
    }

    const allCalls: ParseParamsCallInfo[] = [];
    const opts = checker && program ? { checker, program, ts } : { ts };

    for (const file of sourceFiles) {
      try {
        allCalls.push(...analyzeParseParamsInFile(file, opts));
      } catch (err) {
        console.warn(
          `Warning: Could not analyze parseParams in ${file}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Store in cache before returning
    parseParamsCache.set(resolvedPath, allCalls);
    return allCalls;
  } catch (error) {
    console.warn(
      `Warning: Could not analyze parseParams usage: ${error instanceof Error ? error.message : String(error)}`,
    );

    // Cache empty result to avoid repeated failures
    const emptyResult: ParseParamsCallInfo[] = [];
    parseParamsCache.set(resolvedPath, emptyResult);
    return emptyResult;
  }
}

/**
 * Formats parseParams call info into a markdown table and description.
 * Used for generating documentation banners.
 */
function formatParseParamsForDocs(
  calls: ParseParamsCallInfo[],
  projectRoot: string = process.cwd(),
): string {
  if (calls.length === 0) {
    return '';
  }

  let result = '\n***** PARAMETERS DESCRIPTION *****\n\n';

  calls.forEach((call, index) => {
    const relativePath = pathLib.relative(projectRoot, call.filePath);

    result += `parseParams call #${index + 1} (${relativePath}:${call.line}):\n\n`;

    if (call.typeInfoTable && call.typeInfoTable.length > 0) {
      result += formatParamsTable(call.typeInfoTable, call.defaultParams);
    } else if (call.typeInfo) {
      result += 'Type definition:\n';
      result += `{\n${call.typeInfo}\n}\n`;

      if (Object.keys(call.defaultParams).length > 0) {
        result += '\nDefault values:\n';
        Object.entries(call.defaultParams).forEach(([key, value]) => {
          result += `  ${key}: ${value}\n`;
        });
      } else {
        result += 'Default values: (none)\n';
      }
    } else {
      result += 'Type definition: (not specified)\n';

      if (Object.keys(call.defaultParams).length > 0) {
        result += 'Default values:\n';
        Object.entries(call.defaultParams).forEach(([key, value]) => {
          result += `  ${key}: ${value}\n`;
        });
      } else {
        result += 'Default values: (none)\n';
      }
    }

    if (index < calls.length - 1) {
      result += '\n\n';
    }
  });

  result += '\n***** ------------------------- *****';

  return result;
}

/**
 * Analyzes the entry script and all imported scripts for parseParams usage,
 * and returns a formatted banner comment block. Resolves interface/intersection
 * types so their properties appear in the banner.
 */
function analyzeParseParams(entryFile: string): string {
  const calls = getParseParamsFromCode(entryFile);

  return formatParseParamsForDocs(calls);
}

/**
 * Analyzes parseParams usage and returns structured data instead of formatted string.
 * Returns array of ParseParamsCallInfo objects.
 */
function analyzeParseParamsData(entryFile: string): ParseParamsCallInfo[] {
  return getParseParamsFromCode(entryFile);
}

/**
 * Clears the cache for getParseParamsFromCode results.
 * Useful when source files have changed and you want to force re-parsing.
 */
function clearParseParamsCache(): void {
  parseParamsCache.clear();
}

/**
 * Clears a specific entry from the cache.
 * @param entryFile - The entry file path to remove from cache
 */
function clearParseParamsCacheEntry(entryFile: string): void {
  const resolvedPath = pathLib.resolve(entryFile);
  parseParamsCache.delete(resolvedPath);
}

module.exports = {
  analyzeParseParams,
  analyzeParseParamsData,
  getSourceFilesFromEntry,
  clearParseParamsCache,
  clearParseParamsCacheEntry,
};

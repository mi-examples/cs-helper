/**
 * Resolves parameter primitive types for docs/base64 tables from TypeScript checker types.
 *
 * TypeScript 5.x and 6.x use different numeric {@link TypeFlags} values (e.g. `Undefined`
 * was `32768` in 5.x and is `4` in 6.x, which used to be `String` in 5.x). Always pass
 * the same `ts` module instance that created the `checker` and read flags via `ts.TypeFlags`
 * — never hard-coded bit masks.
 */

/** TypeFlags layout from TypeScript 5.x (checker types use these bit values). */
export const TYPE_FLAGS_TYPESCRIPT_5 = {
  String: 4,
  Number: 8,
  Boolean: 16,
  Undefined: 32768,
  Null: 65536,
  Void: 16384,
  Union: 1048576,
} as const;

/** TypeFlags layout from TypeScript 6.x. */
export const TYPE_FLAGS_TYPESCRIPT_6 = {
  String: 32,
  Number: 64,
  Boolean: 256,
  Undefined: 4,
  Null: 8,
  Void: 16,
  Union: 134217728,
} as const;

export type TypeFlagsLike = {
  String: number;
  Number: number;
  Boolean: number;
  Undefined: number;
  Null: number;
  Void: number;
  Union?: number;
};

export function getTypeScriptMajorVersion(ts: { version?: string }): number {
  const major = parseInt(String(ts.version ?? '0').split('.')[0], 10);

  return Number.isFinite(major) ? major : 0;
}

/**
 * Returns true when `ts.TypeFlags` matches the TypeScript 6+ layout (Undefined === 4).
 */
export function isTypeScript6TypeFlags(TF: TypeFlagsLike): boolean {
  return TF.Undefined === TYPE_FLAGS_TYPESCRIPT_6.Undefined;
}

/**
 * Minimal mock `ts` for tests: supply a TypeFlags-like object (TS 5 or TS 6 layout).
 */
export function createTypeScriptApiStub(typeFlags: TypeFlagsLike): {
  TypeFlags: TypeFlagsLike;
  version: string;
} {
  const major = isTypeScript6TypeFlags(typeFlags) ? 6 : 5;

  return {
    TypeFlags: typeFlags,
    version: `${major}.0.0`,
  };
}

/**
 * Maps a checker type to generic primitive name(s): `string`, `number`, `boolean`.
 */
export function getGenericTypeDisplay(
  ts: { TypeFlags: TypeFlagsLike },
  checker: {
    getDeclaredTypeOfSymbol?: (symbol: unknown) => unknown;
    typeToString?: (type: unknown) => string;
  },
  type: {
    id?: number;
    flags?: number;
    types?: unknown[];
    value?: unknown;
    symbol?: unknown;
  } | null
  | undefined,
  seen = new Set<number>(),
): string {
  if (!type) {
    return 'any';
  }

  const TF = ts.TypeFlags;
  const isAbsentPrimitive = (t: { flags?: number }) => {
    const f = t?.flags ?? 0;

    return !!(f & (TF.Undefined | TF.Null | TF.Void));
  };

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
      if (isAbsentPrimitive(t as { flags?: number })) {
        continue;
      }

      const r = getGenericTypeDisplay(
        ts,
        checker,
        t as typeof type,
        seen,
      );

      if (r && r !== 'any') {
        r.split(/\s*\|\s*/).forEach((p) => add(p.trim()));
      }
    }

    const arr = [...primitives].sort();

    return arr.length ? arr.join(' | ') : 'any';
  }

  if (isAbsentPrimitive(type)) {
    return '';
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

    if (f & TF.String) {
      return 'string';
    }

    if (f & TF.Number) {
      return 'number';
    }

    if (f & TF.Boolean) {
      return 'boolean';
    }
  }

  if (type.symbol && typeof checker.getDeclaredTypeOfSymbol === 'function') {
    try {
      const declared = checker.getDeclaredTypeOfSymbol(type.symbol) as
        | typeof type
        | undefined;

      if (declared && declared !== type) {
        const r = getGenericTypeDisplay(ts, checker, declared, seen);

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

      if (str === 'undefined' || str === 'null' || str === 'void') {
        return '';
      }

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

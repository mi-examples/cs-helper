import type { ParamRow, ParseParamsCallInfo } from './params-docs';

interface ParamHash {
  name: string;
  default_value?: string;
  available_values?: string[];
  type: string;
  required: boolean;
  description?: string;
}

interface ParamsHashData {
  hostname?: string;
  customScriptId?: number;
  customScriptName?: string;
  isParametersRequired: boolean;
  parameters: ParamHash[];
  /**
   * Minutes, rounded, derived from a parseParams field marked `ScriptTimeout` (or
   * `@scriptTimeout` in JS) whose default value is statically resolvable to a number of
   * milliseconds - see src/index.ts's `ScriptTimeout` type. Omitted when no field is marked or
   * its default isn't a resolvable number. Optional/additive - existing consumers of this JSON
   * that don't know this key can ignore it.
   */
  suggestedTimeoutMinutes?: number;
}

/**
 * Removes surrounding quotes from a string value.
 * Handles both single and double quotes.
 */
function removeQuotes(value: string): string {
  const str = String(value).trim();
  if (
    (str.startsWith('"') && str.endsWith('"')) ||
    (str.startsWith("'") && str.endsWith("'"))
  ) {
    return str.slice(1, -1);
  }
  return str;
}

/**
 * Maps ParamRow from params-docs.ts to ParamHash format for base64 encoding
 */
function mapParamRowToHash(
  row: ParamRow,
  defaultParams: Record<string, any>,
): ParamHash {
  const paramHash: ParamHash = {
    name: row.name,
    type: row.typeStr,
    required: !row.optional,
  };

  // Set default value if available, removing quotes
  if (row.name in defaultParams) {
    paramHash.default_value = removeQuotes(defaultParams[row.name]);
  }

  // Set available values if present
  if (row.acceptsValues && row.acceptsValues.length > 0) {
    paramHash.available_values = row.acceptsValues;
  }

  // Set description if present
  if (row.description) {
    paramHash.description = row.description;
  }

  return paramHash;
}

/**
 * Generates base64 encoded params data from parsed params call info
 */
function generateParamsBase64(
  parseParamsCalls: ParseParamsCallInfo[],
  options?: {
    hostname?: string;
    customScriptId?: number;
    customScriptName?: string;
  },
): string {
  const hashData: ParamsHashData = {
    isParametersRequired: false,
    parameters: [],
  };

  // Set optional fields
  if (options?.hostname) {
    hashData.hostname = options.hostname;
  }

  if (options?.customScriptId !== undefined) {
    hashData.customScriptId = options.customScriptId;
  }

  if (options?.customScriptName) {
    hashData.customScriptName = options.customScriptName;
  }

  // Process all parseParams calls and collect parameters
  // If multiple parameters have the same name, the latest one wins
  const allParams = new Map<string, ParamHash>();
  let suggestedTimeoutMinutes: number | undefined;

  for (const call of parseParamsCalls) {
    if (call.typeInfoTable && call.typeInfoTable.length > 0) {
      // Use expanded type info table
      for (const row of call.typeInfoTable) {
        // Skip generic index signature parameters like [key: string], [p: string], [index: number], etc.
        // Pattern: [variableName: type]
        if (/^\[.+\:\s*.+\]$/.test(row.name)) {
          continue;
        }

        // Always update parameter (latest occurrence wins)
        const paramHash = mapParamRowToHash(row, call.defaultParams);

        allParams.set(row.name, paramHash);

        // If this param is required, mark overall as required
        if (!row.optional) {
          hashData.isParametersRequired = true;
        }

        // Latest ScriptTimeout-marked field with a resolvable numeric (ms) default wins.
        if (row.isScriptTimeout && row.name in call.defaultParams) {
          const defaultMs = Number(call.defaultParams[row.name]);

          if (Number.isFinite(defaultMs)) {
            suggestedTimeoutMinutes = Math.round(defaultMs / 60000);
          }
        }
      }
    }
  }

  hashData.parameters = Array.from(allParams.values());

  if (suggestedTimeoutMinutes !== undefined) {
    hashData.suggestedTimeoutMinutes = suggestedTimeoutMinutes;
  }

  return Buffer.from(JSON.stringify(hashData)).toString('base64');
}

module.exports = { generateParamsBase64 };

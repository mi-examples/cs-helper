import './polyfill';

type ParametersType = Record<string, string | number | boolean>;

/**
 * Runtime surface injected by the Metric Insights custom script host. Your bundle runs with a global
 * **`customScript`** instance (see {@link cs}) exposing identity, configuration, logging, HTTP access, and lifecycle.
 *
 * Property availability and exact behavior can depend on the MI version; treat optional fields defensively.
 */
export type CustomScript = {
  /**
   * API token for the authenticated user/context running this script, as configured in Metric Insights.
   */
  apiToken: string;

  /**
   * Identifier of this custom script definition in the MI instance.
   */
  customScriptId: number;

  /**
   * Identifier of the current script run’s log entry (correlates this execution with MI logging).
   */
  customScriptRunLogId: number;

  /**
   * Raw parameter values supplied by the host (for example from the script’s MI configuration). Keys are parameter
   * names; values are scalars only. Merged with your defaults by {@link parseParams}.
   */
  parameters?: ParametersType;

  /**
   * Last merged parameter map written by {@link parseParams}: defaults from code combined with {@link CustomScript.parameters}.
   * Undefined until `parseParams` runs.
   */
  parsedParams?: ParametersType;

  /**
   * Base URL of the Metric Insights web instance (scheme, host, port, trailing path as provided). Join with API paths
   * for {@link CustomScript.runApiRequest}. Normalize a trailing slash on `homeSite`, then append paths such as
   * `api/dataset_data?...`.
   */
  homeSite: string;

  /**
   * Portal-wide constants from the MI instance (strings, numbers, or booleans). Known keys include the documented
   * fields below; additional keys may appear depending on configuration.
   */
  constants: {
    /**
     * Public hostname of the MI deployment.
     */
    HOSTNAME: string;

    /**
     * Configured portal display name.
     */
    PORTAL_NAME: string;

    /**
     * Maximum total size of digest attachments, as a string (byte limit semantics defined by MI).
     */
    DIGEST_MAX_ATTACHMENTS_SIZE: string;

    [key: string]: string | number | boolean;
  };

  /**
   * Performs an HTTP request to the Metric Insights backend. The host attaches credentials and uses the platform
   * transport (commonly a jQuery.ajax-style API). Pass URL and optional settings such as `success`, `error`, `method`,
   * and request body fields as supported by your MI version.
   *
   * @param url Request URL—often built from {@link CustomScript.homeSite} plus an API path.
   * @param settings Optional request options (e.g. callbacks and payload). Shape depends on the host implementation.
   * @returns Opaque return value from the host (often a jqXHR-like object where applicable).
   */
  runApiRequest: (url: string, settings?: any) => any;

  /**
   * Writes a line to the script run log in Metric Insights (informational).
   *
   * @param message Text to record.
   */
  log: (message: string) => void;

  /**
   * Sets the primary output/result value for this script run (payload consumed by the MI host).
   *
   * @param message Serializable result—structure depends on your script contract with MI.
   */
  result: (message: any) => void;

  /**
   * Records an error for this script run (user-visible failure path in MI).
   *
   * @param error Error message or diagnostic text.
   */
  error: (error: string) => void;

  /**
   * Ends script execution and releases host resources. Call when your async work is finished.
   */
  close: () => void;
};

/**
 * Global injected by the Metric Insights custom script runtime. Prefer the exported {@link cs} alias in modules.
 *
 * @see {@link CustomScript}
 */
declare var customScript: CustomScript;

/**
 * Convenient alias for the global {@link customScript} object (`customScript` and `cs` refer to the same instance).
 *
 * @see {@link CustomScript}
 */
export const cs = customScript;

/**
 * Resolves script parameters by merging runtime values from {@link CustomScript.parameters | `cs.parameters`}
 * with your defaults. Later sources win: values supplied in the Metric Insights UI (or host) override the same keys
 * in `defaultParams`.
 *
 * The merged object is assigned to {@link CustomScript.parsedParams | `cs.parsedParams`} (and the same property on
 * `globalThis` or `self` when present) so other code can read the resolved parameters without calling this function again.
 *
 * When you build with the cs-helper CLI, each `parseParams` call in your sources is analyzed: the generic type
 * parameter (or the inferred default object shape) drives the parameter table, descriptions, and the **Params Base64**
 * block in the output banner (base64-encoded JSON metadata for tooling).
 *
 * @template T Parameter map: keys are names; values must be `string`, `number`, or `boolean` (Metric Insights
 *   parameter values are scalar).
 * @param defaultParams Default values for parameters when the host does not supply them. May be a partial map.
 * @returns The merged parameter object (`defaultParams` ⊕ `cs.parameters`).
 */
export function parseParams<
  T extends {
    [K in keyof T]: T[K] extends string | number | boolean ? T[K] : never;
  } = ParametersType,
>(defaultParams: Partial<T> = {}): T {
  const params = Object.assign(
    {},
    defaultParams,
    cs.parameters,
  ) as CustomScript['parameters'] & T;

  const context = ((typeof globalThis !== 'undefined' && globalThis) ||
    (typeof self !== 'undefined' && self) ||
    cs) as never as { parsedParams: T };

  context.parsedParams = params;

  return params;
}

/**
 * Secondary entry: logging, dataset/metadata helpers, and other utilities.
 *
 * Import as `import { … } from '@metricinsights/cs-helper/utils'` (or via namespace `utils` if your bundler resolves it).
 */
export * as utils from './utils';

import './polyfill';

type ParametersType = Record<string, string | number | boolean>;

export type CustomScript = {
  apiToken: string;

  customScriptId: number;

  customScriptRunLogId: number;

  parameters?: ParametersType;

  parsedParams?: ParametersType;

  /**
   * MI instance's URL
   */
  homeSite: string;

  runApiRequest: (url: string, settings?: any) => any;

  /**
   * Log method
   * @param message
   */
  log: (message: string) => void;

  /**
   * Returns script result
   *
   * @param message
   */
  result: (message: any) => void;

  /**
   * Error log method
   * @param error
   */
  error: (error: string) => void;

  /**
   * Finish script execution
   */
  close: () => void;
};

declare var customScript: CustomScript;

export const cs = customScript;

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

export * as utils from './utils';

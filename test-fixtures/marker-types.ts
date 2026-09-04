import { parseParams, Password, ScriptTimeout } from '../src/index';

export interface ScriptParams {
  apiKey: Password;
  // Deliberately not named "scriptTimeout" - proves the marker is name-independent.
  maxRuntimeMs: ScriptTimeout;
}

parseParams<ScriptParams>({ maxRuntimeMs: 5 * 60 * 1000 });

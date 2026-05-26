import { parseParams } from '../src/index';

export interface ScriptParams {
  /** API secret. @password */
  apiToken?: string;
}

parseParams<ScriptParams>({});

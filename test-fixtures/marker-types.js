import { parseParams } from '../src/index';

/**
 * @type {{param1: string; apiKey: string; maxRuntimeMs: number;}}
 * @password apiKey
 * @scriptTimeout maxRuntimeMs
 */
const params = parseParams({
  param1: '',
  maxRuntimeMs: 5 * 60 * 1000,
});

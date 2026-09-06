// Multiple parseParams calls (entry + an imported module), none declaring scriptTimeout -
// script-timeout-param must still fire, but exactly once, not once per call - see
// test/sanity-check.spec.mjs.
import { cs, parseParams } from '@metricinsights/cs-helper';
import { parseSubParams } from './multi-parseparams-sub-module-no-timeout';

const params = parseParams<{ param1: string }>({ param1: '' });

parseSubParams();

setTimeout(() => {
  cs.close();
}, 500);

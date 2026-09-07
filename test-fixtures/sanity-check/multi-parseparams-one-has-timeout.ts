// A script can have multiple parseParams calls spread across files (e.g. an imported module with
// its own call) - only one of them needs to declare scriptTimeout for the whole script, so this
// must NOT trigger script-timeout-param even though THIS file's own call doesn't declare it -
// see test/sanity-check.spec.mjs.
import { cs, parseParams } from '@metricinsights/cs-helper';
import { parseSubParams } from './multi-parseparams-sub-module';

const params = parseParams<{ param1: string }>({ param1: '' });

parseSubParams();

setTimeout(() => {
  cs.close();
}, 500);

// A field typed ScriptTimeout (regardless of its name) must satisfy script-timeout-param, not just
// a field literally named "scriptTimeout" - see test/sanity-check.spec.mjs. ScriptTimeout is
// declared locally rather than imported, for the same reason as clean-golden-path.ts (a bare
// '@metricinsights/cs-helper' import doesn't resolve inside this repo's own test-fixtures, and a
// relative import into ../../src/index would pull cs-helper's own source tree into the scan).
import { cs, parseParams } from '@metricinsights/cs-helper';

type ScriptTimeout = number;

const params = parseParams<{ maxRuntimeMs: ScriptTimeout }>({ maxRuntimeMs: 60000 });

setTimeout(() => {
  cs.close();
}, 500);

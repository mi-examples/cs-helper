// Raw fetch to a third-party API is legitimate and must NOT trigger raw-http-to-mi-backend -
// see test/sanity-check.spec.mjs.
import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });

fetch('https://example.com/api/data');

setTimeout(() => {
  cs.close();
}, 500);

// A dynamically-refreshed token (not a string literal) must NOT trigger manual-token-header-override -
// see test/sanity-check.spec.mjs.
import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });

let freshToken = 'placeholder';

function refresh() {
  return cs.runApiRequest('/api/get_token').then((res: any) => {
    freshToken = res.token;
  });
}

fetch('https://example.com/vendor/api', {
  headers: { token: freshToken },
});

setTimeout(() => {
  cs.close();
}, 500);

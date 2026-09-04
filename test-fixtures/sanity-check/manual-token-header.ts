import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });

fetch('https://mi.example.com/api/some_endpoint', {
  headers: { token: 'hardcoded-token-value' },
});

cs.apiToken = 'another-hardcoded-token';

setTimeout(() => {
  cs.close();
}, 500);

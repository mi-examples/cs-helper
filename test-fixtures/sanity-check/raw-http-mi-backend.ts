import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });

fetch(cs.homeSite + '/api/some_endpoint');

setTimeout(() => {
  cs.close();
}, 500);

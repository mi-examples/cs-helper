import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });

cs.runApiRequest('/api/x')
  .done(function () {})
  .fail(function () {});

setTimeout(() => {
  cs.close();
}, 500);

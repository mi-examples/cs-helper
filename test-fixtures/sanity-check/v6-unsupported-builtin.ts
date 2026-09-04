import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });

Array.from([1, 2, 3]);

setTimeout(() => {
  cs.close();
}, 500);

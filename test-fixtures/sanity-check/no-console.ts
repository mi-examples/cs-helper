import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });

console.log('debug output nobody in MI will ever see');

setTimeout(() => {
  cs.close();
}, 500);

import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });

console.log('suppressed'); // cs-helper-disable-line no-console
console.log('still flagged - no trailing directive on this line');

setTimeout(() => {
  cs.close();
}, 500);

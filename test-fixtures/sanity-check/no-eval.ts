import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });

eval('1 + 1');
const fn = new Function('a', 'b', 'return a + b');

setTimeout(() => {
  cs.close();
}, 500);

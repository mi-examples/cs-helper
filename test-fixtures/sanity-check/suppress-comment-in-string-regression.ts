import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });

const trap = '// cs-helper-disable-next-line no-console';

console.log('must still be flagged - the directive above is inside a string, not a real comment');

setTimeout(() => {
  cs.close();
}, 500);

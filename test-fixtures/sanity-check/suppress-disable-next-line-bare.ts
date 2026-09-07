import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });

// cs-helper-disable-next-line
console.log(eval('1'));

setTimeout(() => {
  cs.close();
}, 500);

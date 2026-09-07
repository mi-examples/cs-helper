import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });

// cs-helper-disable-next-line no-console
console.log('suppressed - directive targets the very next line');

console.log('still flagged - no directive above this one');

setTimeout(() => {
  cs.close();
}, 500);

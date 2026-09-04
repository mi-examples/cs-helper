import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });

function greet() {
  return window.req.toUpperCase();
}

setTimeout(() => {
  cs.close();
}, 500);

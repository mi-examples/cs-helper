import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });

function processAll(items: number[]) {
  for (const item of items) {
    const doubled = item * 2;
  }
}

setTimeout(() => {
  cs.close();
}, 500);

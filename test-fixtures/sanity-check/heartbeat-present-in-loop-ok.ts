// cs.log inside the loop refreshes the heartbeat - must NOT trigger require-heartbeat-in-long-loop.
import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });

function processAll(items: number[]) {
  for (const item of items) {
    cs.log('processing ' + item);
  }
}

setTimeout(() => {
  cs.close();
}, 500);

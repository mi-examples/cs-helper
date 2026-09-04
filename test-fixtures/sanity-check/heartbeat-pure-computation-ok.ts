// A loop with no function calls at all (pure arithmetic/assignment) must NOT trigger
// require-heartbeat-in-long-loop - see test/sanity-check.spec.mjs.
import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });

function sumDoubled(items: number[]) {
  let total = 0;

  for (const item of items) {
    total += item * 2;
  }

  return total;
}

cs.result(sumDoubled([1, 2, 3]));

setTimeout(() => {
  cs.close();
}, 500);

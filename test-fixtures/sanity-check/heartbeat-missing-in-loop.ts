// The loop must call something (not just do arithmetic) to trip require-heartbeat-in-long-loop -
// a purely computational loop is excluded, see test/sanity-check.spec.mjs.
import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });

function transform(item: number) {
  return item * 2;
}

function processAll(items: number[]) {
  for (const item of items) {
    transform(item);
  }
}

setTimeout(() => {
  cs.close();
}, 500);

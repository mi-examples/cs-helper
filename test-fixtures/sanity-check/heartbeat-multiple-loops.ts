// Multiple risky loops in one file must collapse to a single require-heartbeat-in-long-loop
// finding, not one per loop - see test/sanity-check.spec.mjs.
import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });

function transform(item: number) {
  return item * 2;
}

function processA(items: number[]) {
  for (const item of items) {
    transform(item);
  }
}

function processB(items: number[]) {
  for (const item of items) {
    transform(item);
  }
}

function processC(items: number[]) {
  for (const item of items) {
    transform(item);
  }
}

setTimeout(() => {
  cs.close();
}, 500);

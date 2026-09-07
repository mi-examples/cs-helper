// window.req is feature-detected before use and must NOT trigger unguarded-window-context -
// see test/sanity-check.spec.mjs.
import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });

function greet() {
  if (typeof window.req === 'string') {
    return window.req.toUpperCase();
  }

  return '';
}

setTimeout(() => {
  cs.close();
}, 500);

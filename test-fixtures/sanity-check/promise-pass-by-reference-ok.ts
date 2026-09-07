// resolve/reject passed BY REFERENCE as callback values (the standard cs.runApiRequest
// Promise-wrapper idiom seen throughout real custom scripts) must NOT trigger
// runapirequest-promise-missing-handler - it's the correct pattern, not a bug. See
// test/sanity-check.spec.mjs.
import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });

function buildRequest<T>(url: string) {
  return new Promise<T>((resolve, reject) => {
    cs.runApiRequest(url, {
      success: resolve,
      error: reject,
    });
  });
}

setTimeout(() => {
  cs.close();
}, 500);

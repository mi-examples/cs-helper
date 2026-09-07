// Both resolve and reject are wired - must NOT trigger runapirequest-promise-missing-handler.
import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });

function fetchThing() {
  return new Promise((resolve, reject) => {
    cs.runApiRequest('/api/thing', {
      success: function (data: any) {
        resolve(data);
      },
      error: function (err: any) {
        reject(err);
      },
    });
  });
}

setTimeout(() => {
  cs.close();
}, 500);

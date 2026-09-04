import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });

function fetchThing() {
  return new Promise((resolve, reject) => {
    cs.runApiRequest('/api/thing', {
      success: function (data: any) {
        resolve(data);
      },
    });
  });
}

setTimeout(() => {
  cs.close();
}, 500);

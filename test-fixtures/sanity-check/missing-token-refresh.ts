import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });

function fetchAll(ids: number[]) {
  for (const id of ids) {
    cs.runApiRequest('/api/item/' + id);
  }
}

setTimeout(() => {
  cs.close();
}, 500);

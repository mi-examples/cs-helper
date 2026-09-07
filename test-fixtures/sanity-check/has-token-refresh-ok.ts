// References GET /api/get_token - must NOT trigger missing-token-refresh-for-long-script.
import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });

function refresh() {
  return cs.runApiRequest('/api/get_token');
}

function fetchAll(ids: number[]) {
  for (const id of ids) {
    cs.runApiRequest('/api/item/' + id);
  }
}

setTimeout(() => {
  cs.close();
}, 500);

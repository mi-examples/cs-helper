import { parseParams } from '@metricinsights/cs-helper';

export function parseSubParams() {
  return parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });
}

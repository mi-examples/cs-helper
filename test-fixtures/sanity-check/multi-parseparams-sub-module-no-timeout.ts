import { parseParams } from '@metricinsights/cs-helper';

export function parseSubParams() {
  return parseParams<{ other: string }>({ other: '' });
}

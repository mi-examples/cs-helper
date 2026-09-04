import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{
  scriptTimeout: number;
  config: { nested: string };
}>({ scriptTimeout: 60000 });

setTimeout(() => {
  cs.close();
}, 500);

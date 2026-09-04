import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{
  scriptTimeout: number;
  /** @password */
  apiKey: string;
}>({ scriptTimeout: 60000 });

cs.log('using apiKey ' + params.apiKey);

setTimeout(() => {
  cs.close();
}, 500);

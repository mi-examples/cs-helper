// apiKey is used but never passed into a log/result call - must NOT trigger no-password-in-log.
import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{
  scriptTimeout: number;
  /** @password */
  apiKey: string;
}>({ scriptTimeout: 60000 });

fetch('https://vendor.example.com/api', {
  headers: { Authorization: 'Bearer ' + params.apiKey },
});

cs.log('request sent');

setTimeout(() => {
  cs.close();
}, 500);

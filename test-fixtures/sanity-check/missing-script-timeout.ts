import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ param1: string }>({ param1: '' });

setTimeout(() => {
  cs.close();
}, 500);

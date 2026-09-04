import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });

const fs = require('fs');

cs.log('secret: ' + process.env.SOME_SECRET);
cs.log('dir: ' + __dirname);

setTimeout(() => {
  cs.close();
}, 500);

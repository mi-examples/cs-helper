// cs-helper-disable-file
import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });

console.log('suppressed - no-console finding');

cs.result('done, but the run is never actually closed - require-cs-close finding also suppressed');

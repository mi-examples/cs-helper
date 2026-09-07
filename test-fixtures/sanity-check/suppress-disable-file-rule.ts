/* cs-helper-disable-file require-cs-close */
import { cs, parseParams } from '@metricinsights/cs-helper';

const params = parseParams<{ scriptTimeout: number }>({ scriptTimeout: 60000 });

cs.result('done, but the run is never actually closed - suppressed for this file');

// Confirms parse-params-non-scalar and no-password-in-log now also apply to JS scripts, now that
// JS @type {{...}} blocks build a real typeInfoTable (previously JS got none at all) - see
// test/sanity-check.spec.mjs.
import { cs, parseParams } from '@metricinsights/cs-helper';

/**
 * @type {{apiKey: string; config: object; scriptTimeout: number;}}
 * @password apiKey
 */
const params = parseParams({ scriptTimeout: 60000 });

cs.log('using apiKey ' + params.apiKey);

setTimeout(() => {
  cs.close();
}, 500);

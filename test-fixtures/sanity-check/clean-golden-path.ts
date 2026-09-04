// Mirrors templates/custom-script-ts/src/index.ts. Must always produce zero findings -
// see test/sanity-check.spec.mjs's golden-path regression test.
import { cs, parseParams } from '@metricinsights/cs-helper';

// Mirrors @metricinsights/cs-helper's ScriptTimeout type, declared locally rather than imported:
// this repo isn't installed as its own dependency, so a bare-specifier import wouldn't resolve
// here (ScriptTimeout would fall back to 'any', wrongly tripping parse-params-non-scalar) - and a
// *relative* import into ../../src/index would make getSourceFilesFromEntry treat cs-helper's own
// internal source tree as part of this "entry file", which is wrong for a fixture representing a
// consumer's custom script.
type ScriptTimeout = number;

const CLOSE_DELAY_MS = 1000;

const params = parseParams<{
  param1: string;
  param2: string;
  /** Maximum wall-clock time for this run (milliseconds). */
  scriptTimeout: ScriptTimeout;
}>({
  param1: '',
  scriptTimeout: 10 * 60 * 1000,
});

function scheduleClose() {
  setTimeout(function () {
    cs.close();
  }, CLOSE_DELAY_MS);
}

setTimeout(function () {
  if (cs.isClosed) {
    return;
  }

  cs.log('Script exceeded scriptTimeout; closing.');
  scheduleClose();
}, params.scriptTimeout);

async function main() {
  cs.result(
    `Hello, ${params.param1}! ${
      params.param2 ? `Your second parameter is ${params.param2}` : ''
    }`,
  );
}

main()
  .then(() => {
    scheduleClose();
  })
  .catch(function (e) {
    cs.error(
      e.responseText ||
        e.message ||
        (e.toString() === '[object Object]' ? JSON.stringify(e) : e.toString()),
    );
    cs.error(e.stack || 'No stack trace');
    cs.error('Main execution error');

    scheduleClose();
  });

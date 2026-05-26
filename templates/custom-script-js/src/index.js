import { cs, parseParams } from '@metricinsights/cs-helper';

const CLOSE_DELAY_MS = 1000;

/**
 * @type {{param1: string; param2?: string; scriptTimeout: number;}}
 */
const params = parseParams({
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
  cs.result(`Hello, ${params.param1}! ${
    params.param2 ? `Your second parameter is ${params.param2}` : ''
  }`);

  // Long CPU-bound work with no cs.log / runApiRequest: call cs.updateHeartBeat() in the loop
  // so the inactivity watchdog (~1 minute) does not end the run early.
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

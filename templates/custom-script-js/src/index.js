import { cs, parseParams } from '@metricinsights/cs-helper';

/**
 * @type {{param1: string; param2?: string;}}
 */
const params = parseParams({
  param1: '',
});

async function main() {
  cs.result(`Hello, ${params.param1}! ${
    params.param2 ? `Your second parameter is ${params.param2}` : ''
  }`);
}

main().then(() => {
  setTimeout(function () {
    cs.close();
  }, 1000);
}).catch(function (e) {
  cs.error(
    e.responseText ||
      e.message ||
      (e.toString() === '[object Object]' ? JSON.stringify(e) : e.toString()),
  );
  cs.error(e.stack || 'No stack trace');
  cs.error('Main execution error');

  setTimeout(function () {
    cs.close();
  }, 1000);
});

setTimeout(function () {
  cs.log('Something went wrong');

  cs.close();
}, 10 * 60 * 1000);

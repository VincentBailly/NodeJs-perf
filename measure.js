import { performance } from 'node:perf_hooks';

function measureSync(fn) {
  let t0 = performance.now();
  fn();
  let t1 = performance.now();
  let duration = t1 - t0;
  return Math.round(duration);
}

function measureCallback(fn, callback) {
  let t0 = performance.now();
  fn((err) => {
    if (err) { callback(err); return; }
    let t1 = performance.now();
    let duration = t1 - t0;
    callback(0, Math.round(duration));
  });
}

async function measurePromise(fn) {
  let t0 = performance.now();
  await fn();
  let t1 = performance.now();
  let duration = t1 - t0;
  return Math.round(duration);
}

export const measure = {
  'sync': measureSync,
  'callback': measureCallback,
  'promise': measurePromise
}

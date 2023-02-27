const fs = require('node:fs');
const { parentPort, Worker, isMainThread } = require('node:worker_threads');

if (isMainThread) {
  const maxNumberOfWorkers = 4;


  let workers = [];
  for (let i = 0; i < maxNumberOfWorkers; i++) {
    const worker = new Worker(__filename);
    worker.unref();
    workers.push(worker);
  }  

  module.exports.cleanup = function cleanup(folder) {
    const entries = fs.readdirSync(folder);
    const numberOfFiles = entries.length;
    const perSplit = Math.ceil(numberOfFiles / maxNumberOfWorkers);
    const splits = [];
    return new Promise((resolve) => {
      let left = maxNumberOfWorkers;
      function onDone() {
	left--;
	if (left === 0) { resolve() }
      }
      for (let i = 0; i < maxNumberOfWorkers; i++) {
	const entries_split = entries.slice(i * perSplit, (i+1)*perSplit);
	workers[i].once('message', onDone);
	workers[i].postMessage({ folder, entries: entries_split});
      }
    });
  }
} else {
  parentPort.on("message", ({folder, entries}) => {
    entries.forEach(e => {
      try {
        const files = fs.readdirSync(`${folder}/${e}`)
        files.forEach(f => fs.unlinkSync(`${folder}/${e}/${f}`));
      } catch (e) {
        fs.unlinkSync(`${folder}/${e}`)
      }
    });
    parentPort.postMessage('')
  });
}


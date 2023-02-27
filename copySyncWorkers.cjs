const fs = require('node:fs');
const { parentPort, Worker, isMainThread, workerData } = require('node:worker_threads');


if (isMainThread) {
  const maxNumberOfWorkers = 10;
  let workers = [];
  for (let i = 0; i < maxNumberOfWorkers; i++) {
    const worker = new Worker(__filename, {workerData: `${i}-`});
    worker.unref();
    workers.push(worker);
  }  
  
  module.exports.copyBulk = function (files, size, workerCount, tmpFolder) {
    let i = 0;
    const perSplit = Math.ceil(size / workerCount);
    const splits = [];
    return new Promise((resolve) => {
      let left = workerCount;
      function onDone() {
	left--;
	if (left === 0) { resolve() }
      }
      for (let i = 0; i < workerCount; i++) {
	const filesToCopy = files.slice(i * perSplit, Math.min(size, (i+1)*perSplit));
	workers[i].postMessage({ files: filesToCopy, tmpFolder });
	workers[i].once('message', onDone);
      }
      
    });
  }
} else {
  const prefix = workerData;
  parentPort.on("message", ({ files, tmpFolder }) => {
    copy(files, prefix, tmpFolder)
    parentPort.postMessage('')
  })

  function getFilePath(i, tmpFolder) {
    const folder = i % 1000;
    return `${tmpFolder}/${folder}/${prefix}${i}`;
  }

  function copy(files, prefix, tmpFolder) {
    let i = 0;
    files.forEach((name) => {
      copyFileWrite(name, getFilePath(i++, tmpFolder));
    })
  }
  
  const BUFF_SIZE = 1024 * 1024; // 1MB
  const buff = Buffer.allocUnsafe(BUFF_SIZE);

  function copyFileWrite(src, dest) {
    const srcFd = fs.openSync(src, 'r');
    const stats = fs.fstatSync(srcFd);
    const destFd = fs.openSync(dest, 'w', stats.mode);
    let bytesToCopy = stats.size;
    while (bytesToCopy !== 0) {
      let bytesRead = fs.readSync(srcFd, buff, 0, BUFF_SIZE, null);
      const bytesWritten = fs.writeSync(destFd, buff, 0, bytesRead);
      if (bytesWritten < bytesRead) {
	throw new Error(`Failed to copy entire content of file ${dest}`);
      }
      bytesToCopy -= bytesWritten;
    }
    fs.closeSync(srcFd);
    fs.closeSync(destFd);
  }
}

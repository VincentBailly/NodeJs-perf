const fs = require('node:fs');
const { performance } = require('node:perf_hooks');
const { parentPort, Worker, isMainThread, workerData } = require('node:worker_threads');
let tmpFolder = '/home/vincent/benchmarkTmp';

if (isMainThread) {

  const numberOfWorkers = 4;
async function measure(fn) {
  let t0 = performance.now();
  await fn();
  let t1 = performance.now();
  let duration = t1 - t0;
  return duration;
}

function getFileNames(loc, set = new Set()) {
  const stats = fs.statSync(loc);
  if (stats.isFile()) {
    set.add(loc);
  } else if (stats.isDirectory()) {
    let entries = fs.readdirSync(loc);
    for (let entry of entries) {
      const entryLoc = `${loc}/${entry}`;
      getFileNames(entryLoc, set);
    }
  }
  return set;
}

function rmDir(loc) {
  const stats = fs.statSync(loc, { throwIfNoEntry: false });
  if (!stats) {
    return;
  }
  if (stats.isDirectory()) {
    fs.readdirSync(loc).forEach(e => {
      const newLoc = `${loc}/${e}`;
      rmDir(newLoc);
    })
    fs.rmdirSync(loc);
  } else {
    fs.unlinkSync(loc);
  }
}


function cleanup() {
  rmDir(tmpFolder);
  fs.mkdirSync(tmpFolder);
}

let fileNames

  let workers = [];
  for (let i = 0; i < numberOfWorkers; i++) {
    const worker = new Worker(__filename, {workerData: `${i}-`});
    worker.unref();
    workers.push(worker);
  }  
  
function copy(id) {
  let i = 0;
  const numberOfFiles = fileNames.length;
  const perSplit = Math.ceil(numberOfFiles / numberOfWorkers);
  const splits = [];
  return new Promise((resolve) => {
    let left = numberOfWorkers;
    function onDone() {
      left--;
      if (left === 0) { resolve() }
    }
  for (let i = 0; i < numberOfWorkers; i++) {
    const files = fileNames.slice(i * perSplit, (i+1)*perSplit);
    workers[i].postMessage({ id, files});
    workers[i].once('message', onDone);
  }
    
  });
}

  
function getFileNamesInStore() {
  fileNames = [...getFileNames('/home/vincent/1JS/.store')].slice(0,20000);
  console.log('number of files', fileNames.length);
}

async function logPerf(id, name) {
  const duration = await measure(() => copy(id));
  console.log(`copyFile${id}() took ${Math.round(duration)/1000} s`);
}

async function main() {
cleanup();
getFileNamesInStore();
await copy(3);
cleanup();
await logPerf(1);
cleanup();
await logPerf(2);
cleanup();
await logPerf(3);
}
main()
//console.log({totalSizeInGB: totalSize/1024/1024/1024});


} else {
  const prefix = workerData;
  parentPort.on("message", ({ id, files }) => {
    copy(id, files, prefix)
    parentPort.postMessage('')
  })

let fns = {
  copyFile1,
  copyFile2,
  copyFile3
};

  function copy(id, files, prefix) {
  let i = 0;
  const fn = fns[`copyFile${id}`];
  files.forEach((name) => {
    fn(name, `${tmpFolder}/${prefix}${i++}`);
  })
}



  
function copyFile1(src, dest) {
  fs.copyFileSync(src, dest);
}

function copyFile2(src, dest) {
  const stats = fs.statSync(src);
  const content = fs.readFileSync(src);
  const writtenSize = fs.writeFileSync(dest, content, { mode: stats.mode });
  if (writtenSize < stats.size) {
    throw new Error(`failed to copy entire content of file ${dest}`);
  }
}

const BUFF_SIZE = 1024 * 1024; // 1MB
const buff = Buffer.allocUnsafe(BUFF_SIZE);

function copyFile3(src, dest) {
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

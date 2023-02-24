import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

function measure(fn) {
  let t0 = performance.now();
  fn();
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

let tmpFolder = '/home/vincent/benchmarkTmp';

function cleanup() {
  rmDir(tmpFolder);
  fs.mkdirSync(tmpFolder);
}

let fileNames

function getFileNamesInStore() {
  fileNames = [...getFileNames('/home/vincent/1JS/.store')].slice(0,20000);
  console.log('number of files', fileNames.length);
}

let fns = {
  copyFile1,
  copyFile2,
  copyFile3
};

function copy(id) {
  let i = 0;
  const fn = fns[`copyFile${id}`];
  fileNames.forEach((name) => {
    fn(name, `${tmpFolder}/${i++}`);
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

function logPerf(id, name) {
  const duration = measure(() => copy(id));
  console.log(`copyFile${id}() took ${Math.round(duration)/1000} s`);
}

cleanup();
getFileNamesInStore();
copy(3);
cleanup();
logPerf(1);
cleanup();
logPerf(2);
cleanup();
logPerf(3);
//console.log({totalSizeInGB: totalSize/1024/1024/1024});
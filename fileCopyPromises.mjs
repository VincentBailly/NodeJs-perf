import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

async function measure(fn) {
  let t0 = performance.now();
  await fn();
  let t1 = performance.now();
  let duration = t1 - t0;
  return duration
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
  fileNames = [...getFileNames('/home/vincent/1JS/.store')];//.slice(0,20000);
  console.log('number of files', fileNames.length);
}

let fns = {
  copyFile1,
  copyFile2,
  copyFile3
};

async function copy(id) {
  const fn = fns[`copyFile${id}`];
  let left = fileNames.length;
  await Promise.all(fileNames.map((name,i) => fn(name, `${tmpFolder}/${i}`)))
}


async function copyFile1(src, dest) {
  await fs.promises.copyFile(src, dest);
}

async function copyFile2(src, dest) {
  const stats = await fs.promises.stat(src);
  const content = await fs.promises.readFile(src);
  await fs.promises.writeFile(dest, content, { mode: stats.mode });
}

const BUFF_SIZE = 1024 * 1024; // 1MB

async function copyFile3(src, dest) {
  const buff = Buffer.allocUnsafe(BUFF_SIZE);
  let srcHandle = await fs.promises.open(src, 'r');
  let stats = await srcHandle.stat();
  let destHandleP = fs.promises.open(dest, 'w', stats.mode);

  let left = stats.size;
  while(left !== 0) {
    const { bytesRead } = await srcHandle.read(buff, 0, BUFF_SIZE, null);
    const { bytesWritten } = await (await destHandleP).write(buff, 0, bytesRead, null);
    if (bytesWritten !== bytesRead) {
      throw new Error(`Failed to copy entire content of file ${dest}`);
    }
    left -= bytesWritten;
  }
  await Promise.all([srcHandle.close(), (await destHandleP).close()]);
}


async function logPerf(id) {
  const duration = await measure(() => copy(id));
  console.log(`copyFile${id}() took ${Math.round(duration)/1000} s`);
}


cleanup();
getFileNamesInStore();

async function go() {
  cleanup()
  await copy(1)
  cleanup();
  await logPerf(1);
  cleanup();
  await logPerf(2);
  cleanup();
  await logPerf(3);
}

go().catch((err) => {
  console.error(err);
  process.exit(1);
})
// Call with following args: node --max-old-space-size=4096 .

import { measure } from "./measure.js";
import { fileNames } from "./fileNames.js";
import { cleanup } from './cleanup.cjs';
import { copyFileWithWriteFileSync, copyFileWithWriteSync } from "./copySync.js";
import { copyFileWithWriteFileCallback, copyFileWithWriteCallback } from "./copyCallback.js";
import { copyFileWithWriteFilePromise, copyFileWithWritePromise } from "./copyPromise.js";
import { copyBulk } from "./copySyncWorkers.cjs";
import { makeQuery } from "./makeQuery.js";

import fs from 'node:fs';

console.log(`We have ${fileNames.length} files to copy`);
let tmpFolder = '/dataDisk/benchmarkTmp';
for(let i = 0; i < 1000; i++) {
  fs.mkdirSync(`${tmpFolder}/${i}`, { force: true, recursive: true });
}

function getFilePath(i) {
  const folder = i % 1000;
  return `${tmpFolder}/${folder}/${i}`;
}

function getRandomSrcFile() {
  let numberOfFiles = fileNames.length;
  const idx = Math.floor(Math.random() * numberOfFiles);
  return fileNames[idx];
}

async function copy(filesToCopy, type, api, workerCount, concurrency) {  
  if (type == "sync") {
    const fn = api === "copy" ? fs.copyFileSync : api === "writeFile" ? copyFileWithWriteFileSync : copyFileWithWriteSync;
    return measure.sync(() => {
      for(let i = 0; i < filesToCopy.length; i++) {
	fn(filesToCopy[i], getFilePath(i));
      }
    })
  } else if (type == "callback") {
    const fn = api === "copy" ? fs.copyFile : api === "writeFile" ? copyFileWithWriteFileCallback : copyFileWithWriteCallback;
    const limitedFn = limit(concurrency, (src,dest) => {
      return new Promise((resolve, reject) => {
	fn(src,dest, (e) => {
	  e ? reject(e) : resolve();
	})
      })
    })
    return measure.promise(async () => {
      const promises = [];
      for(let i = 0; i < filesToCopy.length; i++) {
	promises.push(limitedFn(filesToCopy[i], getFilePath(i)));
      }
      for(let p of promises) {
	await p;
      }
    })
  } else if (type == "promise") {
    const fn = api === "copy" ? fs.promises.copyFile : api === "writeFile" ? copyFileWithWriteFilePromise : copyFileWithWritePromise;
    const limitedFn = limit(concurrency, fn);
    return measure.promise(async () => {
      const promises = [];
      for(let i = 0; i < filesToCopy.length; i++) {
	promises.push(limitedFn(filesToCopy[i], getFilePath(i)));
      }
      for(let p of promises) {
	await p;
      }
    })
  } else if (type == "syncWorkers") {
    return measure.promise(() => 
      copyBulk(filesToCopy, workerCount, tmpFolder)
    )
  }
}

const makeQueue = function(size) {
  let array = [];
  let start = 0;
  let end = 0;
  return {
    push: (o) => {
      array[end] = o;
      end++;
      if (end === size) { end = 0 }
      if (end === start) { throw new Error("The queue is full") }
    },
    pop: () => {
      if (end === start) {
        return undefined;
      }
      const result = array[start];
      array[start] = undefined;
      start++;
      if (start === size) { start = 0 }
      return result;
    }
  }
};

// cheap concurrency limiter
function limit(concurrency, call) {
  let running = 0;
  let queue = makeQueue(1000000);
  async function fn(...args) {
    if (running === concurrency) {
      return new Promise((resolve) => {
      queue.push({ resolve, args });
    });
    }
    running++;
    await new Promise(async (resolve) => {
      await call(...args);
      resolve();
      let next = queue.pop();
      while (next !== undefined) {
        const resolve = next.resolve;
        await call(...next.args);
        resolve();
	next = queue.pop();
      }
      running--;
    })
  }
  return fn;
}


// schema = duration in ms, sync/callback/promise, copy/writeFile/write, size, numberOfWorkers
let savedResultsFile = 'results.csv';

let types = [
  'sync',
//  'callback',
//  'promise',
//  'syncWorkers',
];
let apis = [
  'copy',
  'writeFile',
  'write',
];
let numberOfWorkers = [
//  4,
//  10,
//  20,
  30
]
let concurrencies = [
  4
//  1,
//  10,
//  100,
//  1000,
//  10000
];
let maxSize = 100000;
let minSize = 10;

function pickFrom(array) {
  return array[Math.floor(Math.random()*array.length)];
}

function getRandomSize() {
  const minLog = Math.log10(minSize);
  const maxLog = Math.log10(maxSize);
  const randomLog = Math.random() * (maxLog - minLog) + minLog;
  const size = Math.floor(Math.pow(10, randomLog));
  return size;
}

while(true) {
  // random size with a logarithmic distribution
  let size = getRandomSize();
  let type = pickFrom(types);
  let api = pickFrom(apis);
  let workerCount = type !== "syncWorkers"? 4 : pickFrom(numberOfWorkers);
  let concurrency = type === "sync" ? 1 : pickFrom(concurrencies);


  const cleanupDuration = await measure.promise(() => cleanup(tmpFolder));
  console.log('cleanup duration:', cleanupDuration);
  process.stdout.write(`starting\n`)
  const filesToCopy = [];
  for(let i = 0; i < size; i++) {
    filesToCopy.push(getRandomSrcFile());
  }
  const duration = await copy(filesToCopy, type, api, workerCount, concurrency);
  const logLine = `${duration}, ${type}, ${api}, ${size}, ${workerCount}, ${concurrency}\n`;
  process.stdout.write('done : ' + logLine);

  const tmpFile = `${savedResultsFile}.tmp`;
  fs.copyFileSync(savedResultsFile, tmpFile);
  let fd = fs.openSync(tmpFile, 'a');
  fs.writeSync(fd, logLine);
  fs.closeSync(fd);
  fs.renameSync(tmpFile, savedResultsFile);
  await makeQuery();
}


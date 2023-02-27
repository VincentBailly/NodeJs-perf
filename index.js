// Call with following args: node --max-old-space-size=4096 .

import { measure } from "./measure.js";
import { fileNames } from "./fileNames.js";
import { cleanup } from './cleanup.cjs';
import { copyFileWithWriteFileSync, copyFileWithWriteSync } from "./copySync.js";
import { copyFileWithWriteFileCallback, copyFileWithWriteCallback } from "./copyCallback.js";
import { copyFileWithWriteFilePromise, copyFileWithWritePromise } from "./copyPromise.js";
import { copyBulk } from "./copySyncWorkers.cjs";

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

async function copy(size, type, api, workerCount) {
  if (type == "sync") {
    const fn = api === "copy" ? fs.copyFileSync : api === "writeFile" ? copyFileWithWriteFileSync : copyFileWithWriteSync;
    return measure.sync(() => {
      for(let i = 0; i < size && i < fileNames.length; i++) {
	fn(fileNames[i], getFilePath(i));
      }
    })
  } else if (type == "callback") {
    return new Promise((resolve, reject) => {
      const fn = api === "copy" ? fs.copyFile : api === "writeFile" ? copyFileWithWriteFileCallback : copyFileWithWriteCallback;
      measure.callback((cb) => {
	let left = 0;
	let failed = false;
	function onDone(err) {
	  if (failed) { return; }
	  if (err) { failed = true; cb(err); return; }
	  left--;
	  if (left === 0) {
	    cb();
	  }
	}
	for(let i = 0; i < size && i < fileNames.length; i++) {
	  left++;
	  fn(fileNames[i], getFilePath(i), onDone)
	}
      }, (err, duration) => {
	if (err) { reject(err); return; }
	resolve(duration);
      })
    });
  } else if (type == "promise") {
    const fn = api === "copy" ? fs.promises.copyFile : api === "writeFile" ? copyFileWithWriteFilePromise : copyFileWithWritePromise;
    return measure.promise(async () => {
      const promises = [];
      for(let i = 0; i < size && i < fileNames.length; i++) {
	promises.push(fn(fileNames[i], getFilePath(i)));
      }
      for(let p of promises) {
	await p;
      }
    })
  } else if (type == "syncWorkers") {
    return measure.promise(() => 
      copyBulk(fileNames, size, workerCount, tmpFolder)
    )
  }
}

// schema = duration in ms, sync/callback/promise, copy/writeFile/write, size, numberOfWorkers
let savedResultsFile = 'results.csv';
let savedResultsFd = fs.openSync(savedResultsFile, 'a');

let sizes = [10, 30, 100, 300, 1000, 3000, 10000, 30000, 100000, 300000, 1000000, 3000000, 4000000];
let types = [
//  'sync',
//  'callback',
//  'promise',
  'syncWorkers',
];
let apis = [
//  'copy',
  //  'writeFile',
  'write',
];
let numberOfWorkers = [
  4,
  10
]

for(let api of apis) {
  for(let type of types) {
    const numberOfWorker = type === "syncWorkers" ? numberOfWorkers : [4];
    for (let workerCount of numberOfWorker) {
      for(let size of sizes) {
	await cleanup(tmpFolder);
	process.stdout.write(`starting\n`)
	const duration = await copy(size, type, api, workerCount);
	const logLine = `${duration}, ${type}, ${api}, ${size}, ${workerCount}\n`;
	process.stdout.write('done : ' + logLine);

	fs.writeSync(savedResultsFd, logLine);
      }
    }
  }
}

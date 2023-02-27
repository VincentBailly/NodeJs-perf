// Call with following args: node --max-old-space-size=4096 .

import { measure } from "./measure.js";
import { fileNames } from "./fileNames.js";
import { cleanup } from './cleanup.js';
import { copyFileWithWriteFileSync } from "./copySync.js";
import { copyFileWithWriteFileCallback } from "./copyCallback.js";
import { copyFileWithWriteFilePromise } from "./copyPromise.js";

import fs from 'node:fs';

console.log(`We have ${fileNames.length} files to copy`);
let tmpFolder = '/dataDisk/benchmarkTmp';

async function copy(size, type, api) {
  if (type == "sync") {
    const fn = api === "copy" ? fs.copyFileSync : api === "writeFile" ? copyFileWithWriteFileSync : fs.copyFileSync;
    return measure.sync(() => {
      for(let i = 0; i < size && i < fileNames.length; i++) {
	fn(fileNames[i], `${tmpFolder}/${i}`);
      }
    })
  } else if (type == "callback") {
    return new Promise((resolve, reject) => {
      copyFileWithWriteFileCallback
      const fn = api === "copy" ? fs.copyFile : api === "writeFile" ? copyFileWithWriteFileCallback : fs.copyFile;
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
	  fn(fileNames[i], `${tmpFolder}/${i}`, onDone)
	}
      }, (err, duration) => {
	if (err) { reject(err); return; }
	resolve(duration);
      })
    });
  } else if (type == "promise") {
    const fn = api === "copy" ? fs.promises.copyFile : api === "writeFile" ? copyFileWithWriteFilePromise : fs.promises.copyFile;
    return measure.promise(async () => {
      const promises = [];
      for(let i = 0; i < size && i < fileNames.length; i++) {
	promises.push(fn(fileNames[i], `${tmpFolder}/${i}`));
      }
      for(let p of promises) {
	await p;
      }
    })
  }
}

// schema = duration in ms, sync/callback/promise, copy/writeFile/write, size
let savedResultsFile = 'results.csv';
let savedResultsFd = fs.openSync(savedResultsFile, 'a');

let sizes = [10, 30, 100, 300, 1000, 3000, 10000, 30000, 100000, 300000, 1000000, 3000000, 10000000];
let types = [
//  'sync',
//  'callback',
  'promise'
];
let apis = [
//  'copy',
  'writeFile'
];

for(let api of apis) {
  for(let type of types) {
    for(let size of sizes) {
      cleanup(tmpFolder);
      const duration = await copy(size, type, api);
      const logLine = `${duration}, ${type}, ${api}, ${size}\n`;
      fs.writeSync(savedResultsFd, logLine);
    }
  }
}

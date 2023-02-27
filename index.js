import { measure } from "./measure.js";
import { fileNames } from "./fileNames.js";
import { cleanup } from './cleanup.js';

import fs from 'node:fs';

console.log(`We have ${fileNames.length} files to copy`);
let tmpFolder = '/dataDisk/benchmarkTmp';

async function copy(size, type) {
  if (type == "sync") {
    return measure.sync(() => {
      for(let i = 0; i < size && i < fileNames.length; i++) {
	fs.copyFileSync(fileNames[i], `${tmpFolder}/${i}`)
      }
    })
  } else if (type == "callback") {
    return new Promise((resolve, reject) => {
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
	  fs.copyFile(fileNames[i], `${tmpFolder}/${i}`, onDone)
	}
      }, (err, duration) => {
	if (err) { reject(err); return; }
	resolve(duration);
      })
    });
  } else if (type == "promise") {
    return measure.promise(async () => {
      const promises = [];
      for(let i = 0; i < size && i < fileNames.length; i++) {
	promises.push(fs.promises.copyFile(fileNames[i], `${tmpFolder}/${i}`));
      }
      await Promise.all(promises);
    })
  }
}

// schema = duration in ms, sync/callback/promise, copy/writeFile/write, size
let savedResultsFile = 'results.csv';
let savedResultsFd = fs.openSync(savedResultsFile, 'a');

let sizes = [10, 30, 100, 300, 1000, 3000, 10000, 30000, 100000, 300000, 1000000, 3000000, 10000000];
let types = [/*'sync', *//*'callback',*/'promise']

for(let type of types) {
  for(let size of sizes) {
    cleanup(tmpFolder);
    const duration = await copy(size, type);
    const api = 'copy';
    const logLine = `${duration}, ${type}, ${api}, ${size}\n`;
    fs.writeSync(savedResultsFd, logLine);
  }
}

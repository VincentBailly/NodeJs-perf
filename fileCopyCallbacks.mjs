import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

function measure(fn, callback) {
  let t0 = performance.now();
  fn((err) => {
    if (err) { callback(err) }
    else {
      let t1 = performance.now();
      let duration = t1 - t0;
      callback(null, duration);
    }
  });
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

function copy(id, callback) {
  const fn = fns[`copyFile${id}`];
  let left = fileNames.length;
  function onFile(err) {
    if (err) { callback(err); }
    else {
      left--;
      if (left === 0) {
        callback()
      }
    }
  }
  for(let i = 0; i < fileNames.length; i++) {
    fn(fileNames[i], `${tmpFolder}/${i}`, onFile);
  }
}


function copyFile1(src, dest, callback) {
  fs.copyFile(src, dest, callback);
}


class FileCopy {
  constructor(src, dest, callback) {
    this.src = src;
    this.dest = dest;
    this.callback = callback;
    fs.stat(this.src, this.onStats.bind(this));
  }
  onStats(err, stats) {
    if (err) { this.callback(err) }
    else {
      this.stats = stats;
      fs.readFile(this.src, this.onContent.bind(this));
    }
  }
  onContent(err, content) {
    if (err) { this.callback(err) }
    else {
      fs.writeFile(this.dest, content, this.onWritten.bind(this));
    }
  }
  onWritten(err, writtenSize) {
    if (err) { this.callback(err) }
    else {
      if (writtenSize < this.stats.size) {
        this.callback(new Error(`failed to copy entire content of file ${this.dest}`));
      } else { this.callback() }
    }
  }
}

function copyFile2(src, dest, callback) {
  new FileCopy(src, dest, callback);
}

const BUFF_SIZE = 1024 * 1024; // 1MB

function copyFile3(src, dest, callback) {
  let done = false;
  let oneOffCallback = (err) => { if (!done) { done = true; callback(err) } }
  const buff = Buffer.allocUnsafe(BUFF_SIZE);
  let ctx = { src, dest, callback: oneOffCallback, buff }
  function onSrcFd(err, srcFd) {
    if (err) { ctx.callback(err); return; }
    ctx.srcFd = srcFd;
    fs.fstat(srcFd, onStats);
  }
  function onStats(err, stats) {
    if (err) { ctx.callback(err); return; }
    ctx.stats = stats;
    ctx.left = stats.size;
    fs.open(ctx.dest, 'w', ctx.stats.mode, onDestFd)
  }
  function onDestFd(err, destFd) {
    if (err) { ctx.callback(err); return; }
    ctx.destFd = destFd;
    fs.read(ctx.srcFd, ctx.buff, 0, BUFF_SIZE, null, onRead);
  }
  function onRead(err, bytesRead) {
    if (err) { ctx.callback(err); return; }
    ctx.buffSize = bytesRead;
    if (bytesRead === ctx.left) {
      fs.close(ctx.srcFd, onClosed);
    }
    fs.write(ctx.destFd, ctx.buff, 0, bytesRead, onWrite);
  }
  function onWrite(err, bytesWritten) {
    if (err) { ctx.callback(err); return; }
    if (bytesWritten < ctx.buffSize) {
      ctx.callback(new Error(`Failed to copy entire content of file ${ctx.dest}`))
      return;
    }
    ctx.left = ctx.left - bytesWritten;
    if (ctx.left === 0) { fs.close(ctx.destFd, onClosed); return; }
    fs.read(ctx.srcFd, ctx.buff, 0, BUFF_SIZE, null, onRead);
  }
  let close = 0;
  function onClosed(err) {
    if (err) { ctx.callback(err); return; }
    close++;
    if (close == 2) { ctx.callback() }
  }
  fs.open(src, 'r', onSrcFd);
}


function logPerf(id, callback) {
  measure((callback) => {copy(id, callback)}, (err, duration) => {
    if (err) {
      callback(err);
    } else {
      console.log(`copyFile${id}() took ${Math.round(duration)/1000} s`);
      callback();
    }
  });
}


cleanup();
getFileNamesInStore();

function go(callback) {
  cleanup()
  copy(1, (err) => {
    if (err) { callback(err); return; }
    cleanup();
    logPerf(1, (err) => {
      if (err) { callback(err); return; }
      cleanup();
      logPerf(2, (err) => {
        if (err) { callback(err); return; }
        cleanup();
        logPerf(3, callback)
      });
    });
  });
}

go((err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
})
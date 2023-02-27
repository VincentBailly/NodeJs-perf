import fs from 'node:fs';

export function copyFileWithWriteFileCallback(src, dest, callback) {
  let stats;
  fs.stat(src, onStats);
  
  function onStats(err, result) {
    if (err) { callback(err); return; }
    stats = result;
    fs.readFile(src, onContent);
  }
  function onContent(err, content) {
    if (err) { callback(err); return; }
    fs.writeFile(dest, content, onWritten);
  }
  function onWritten(err, writtenSize) {
    if (err) { callback(err); return; }
    if (writtenSize < stats.size) {
      callback(new Error(`failed to copy entire content of file ${this.dest}`));
    } else { callback() }
  }
}

const BUFF_SIZE = 1024 * 1024; // 1MB

export function copyFileWithWriteCallback(src, dest, callback) {
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

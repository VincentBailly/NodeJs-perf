import fs from 'node:fs';

export function copyFileWithWriteFileCallback(src, dest, callback) {
  let stats;
  fs.stat(src, onStats);
  
  function onStats(err, result) {
    if (err) { callback(err) }
    else {
      stats = result;
      fs.readFile(src, onContent);
    }
  }
  function onContent(err, content) {
    if (err) { callback(err) }
    else {
      fs.writeFile(dest, content, onWritten);
    }
  }
  function onWritten(err, writtenSize) {
    if (err) { callback(err) }
    else {
      if (writtenSize < stats.size) {
        callback(new Error(`failed to copy entire content of file ${this.dest}`));
      } else { callback() }
    }
  }
}


export function copyFileWithWriteFileSync(src, dest) {
  const stats = fs.statSync(src);
  const content = fs.readFileSync(src);
  const writtenSize = fs.writeFileSync(dest, content, { mode: stats.mode });
  if (writtenSize < stats.size) {
    throw new Error(`failed to copy entire content of file ${dest}`);
  }
}

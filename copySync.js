import fs from 'node:fs';

export function copyFileWithWriteFileSync(src, dest) {
  const stats = fs.statSync(src);
  const content = fs.readFileSync(src);
  const writtenSize = fs.writeFileSync(dest, content, { mode: stats.mode });
  if (writtenSize < stats.size) {
    throw new Error(`failed to copy entire content of file ${dest}`);
  }
}

const BUFF_SIZE = 1024 * 1024; // 1MB
const buff = Buffer.allocUnsafe(BUFF_SIZE);

export function copyFileWithWriteSync(src, dest) {
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

import fs from 'node:fs';

export async function copyFileWithWriteFilePromise(src, dest) {
  const srcHandle = await fs.promises.open(src, 'r');
  const stats = await srcHandle.stat(src);
  const content = await srcHandle.readFile();
  await Promise.all([srcHandle.close(), fs.promises.writeFile(dest, content, { mode: stats.mode })]);
}


const BUFF_SIZE = 1024 * 1024; // 1MB

export async function copyFileWithWritePromise(src, dest) {
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

import fs from 'node:fs';

export async function copyFileWithWriteFilePromise(src, dest) {
  const srcHandle = await fs.promises.open(src, 'r');
  const stats = await srcHandle.stat(src);
  const content = await srcHandle.readFile(src);
  await Promise.all([srcHandle.close(), fs.promises.writeFile(dest, content, { mode: stats.mode })]);

}

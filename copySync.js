import fs from 'node:fs';

export function copyFileWithWriteFileSync(src, dest) {
  const stats = fs.statSync(src);
  const content = fs.readFileSync(src);
  const writtenSize = fs.writeFileSync(dest, content, { mode: stats.mode });
  if (writtenSize < stats.size) {
    throw new Error(`failed to copy entire content of file ${dest}`);
  }
}

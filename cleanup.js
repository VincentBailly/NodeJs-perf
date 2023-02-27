import fs from 'node:fs';

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


export function cleanup(folder) {
  rmDir(folder);
  fs.mkdirSync(folder);
}

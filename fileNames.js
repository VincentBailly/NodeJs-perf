import fs from 'node:fs';
import { serialize, deserialize } from 'node:v8';

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

function getFileNamesInStore() {
  return [...getFileNames('../one-js/midgard/.store')]
}

let fileNameCacheFile = '.fileNamesCache';
let fileNames;
if (fs.existsSync(fileNameCacheFile)) {
  const fileNamesBuffer = fs.readFileSync(fileNameCacheFile);
  fileNames = deserialize(fileNamesBuffer);
  
} else {
  fileNames = getFileNamesInStore();
  const fileNamesBuffer = serialize(fileNames);
  fs.writeFileSync(fileNameCacheFile, fileNamesBuffer);
}

export { fileNames };

const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? 
      walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function processFile(filePath) {
  if (!filePath.endsWith('.scss')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Background Colors (Surface Section)
  content = content.replace(/(background(?:-color)?\s*:\s*)white(\s*(!important)?\s*;)/gi, '$1var(--surface-section)$3');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

const targetDir = path.join(__dirname);
walkDir(targetDir, processFile);
console.log('White background replacement done!');

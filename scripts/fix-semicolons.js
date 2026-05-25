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

  // Fix missing semicolons after var(--surface-section)
  // If we find `var(--surface-section)` followed by newline or spaces, but no semicolon, add it.
  content = content.replace(/var\(--surface-section\)(?!\s*;)(?=\s*[\r\n}a-zA-Z])/gi, 'var(--surface-section);');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed semicolons: ${filePath}`);
  }
}

const targetDir = path.join(__dirname);
walkDir(targetDir, processFile);
console.log('Semicolon fix done!');

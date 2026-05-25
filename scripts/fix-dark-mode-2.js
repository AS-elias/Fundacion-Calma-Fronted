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

  // Title Text Colors
  content = content.replace(/(color\s*:\s*)#(111827|1f1f1f|171717|0f172a)(\s*(!important)?\s*;)/gi, '$1var(--text-color-title)$3');

  // Normal Text Colors
  content = content.replace(/(color\s*:\s*)#(374151|4b5563|334155|475569|333333|000000)(\s*(!important)?\s*;)/gi, '$1var(--text-color)$3');

  // Muted Text Colors
  content = content.replace(/(color\s*:\s*)#(6b7280|9ca3af|64748b|94a3b8|555555|666666|777777|888888)(\s*(!important)?\s*;)/gi, '$1var(--text-color-secondary)$3');

  // Background Colors (Surface Section)
  content = content.replace(/(background(?:-color)?\s*:\s*)#(ffffff|fff|f9fafb|f8fafc)(\s*(!important)?\s*;)/gi, '$1var(--surface-section)$3');

  // Background Colors (Surface Ground - slightly darker)
  content = content.replace(/(background(?:-color)?\s*:\s*)#(f3f4f6|f1f5f9)(\s*(!important)?\s*;)/gi, '$1var(--surface-ground)$3');

  // Border Colors
  content = content.replace(/(border(?:-color)?\s*:\s*([^;]*?)?)#(e5e7eb|e2e8f0|cbd5e1|d1d5db|eeeeee|dddddd|cccccc|eaeaea)(\s*(!important)?\s*;)/gi, '$1var(--surface-border)$4');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

const targetDir = path.join(__dirname);
walkDir(targetDir, processFile);
console.log('Advanced hex replacement done!');

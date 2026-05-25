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

  // Background replacements
  content = content.replace(/background(-color)?\s*:\s*#fff(?:fff)?\s*(!important)?\s*;/gi, 'background$1: var(--surface-section) $2;');
  
  // Text color replacements
  content = content.replace(/color\s*:\s*#(333(?:333)?|000(?:000)?)\s*(!important)?\s*;/gi, 'color: var(--text-color) $2;');
  
  // Muted text replacements
  content = content.replace(/color\s*:\s*#(555(?:555)?|666(?:666)?|777(?:777)?|888(?:888)?|999(?:999)?)\s*(!important)?\s*;/gi, 'color: var(--text-color-secondary) $2;');

  // Border replacements
  content = content.replace(/border(-color)?\s*:\s*(1px\s+solid\s+)?#(eee(?:eee)?|ddd(?:ddd)?|ccc(?:ccc)?|eaeaea)\s*(!important)?\s*;/gi, 'border$1: $2var(--surface-border) $4;');

  // Shadows (optional: soften them since we handle global shadows)
  // We'll leave shadows alone for now unless they cause issues.

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

const targetDir = path.join(__dirname);
console.log(`Scanning: ${targetDir}`);
walkDir(targetDir, processFile);
console.log('Done!');

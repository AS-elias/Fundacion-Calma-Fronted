/**
 * Evita regresión de datos “fantasma” (mocks de UI) en módulos comercial/analisis.
 * Uso: npm run test:no-demo-data
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const scanDirs = [
  path.join(root, 'src/app/modules/area-estrategia-desarrollo-comercial'),
];

const forbidden = [
  'Red nacional de voluntariado',
  'Recopilación de datos',
  'Colegios de UGEL 04',
  'https://example.com/',
  "id: 'a1'",
  "id: 'a2'",
  "id: 'e1'",
  "id: 'e2'",
  "id: 'tarea-proceso-1'",
  "id: 'colegio-1'",
  'nombre: \'Tayloy\'',
  'Villa Lucumo',
  'Radio Exitosa',
  'San Vicente de Paul',
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) files.push(full);
  }
  return files;
}

const violations = [];

for (const dir of scanDirs) {
  for (const file of walk(dir)) {
    const content = fs.readFileSync(file, 'utf8');
    const rel = path.relative(root, file).replace(/\\/g, '/');
    for (const phrase of forbidden) {
      if (content.includes(phrase)) {
        violations.push({ file: rel, phrase });
      }
    }
  }
}

if (violations.length) {
  console.error('\n❌ Datos demo detectados (fantasmas):\n');
  for (const v of violations) {
    console.error(`  ${v.file} → "${v.phrase}"`);
  }
  console.error('\nQuita los mocks; los datos deben venir solo del API.\n');
  process.exit(1);
}

console.log('✅ Sin cadenas de datos demo conocidas en comercial/analisis.');

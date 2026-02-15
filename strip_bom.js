const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'data', '2026-02-09-07-09.json');

console.log(`Reading file: ${filePath}`);

const content = fs.readFileSync(filePath, 'utf8');
console.log(`Original length: ${content.length}`);

// Remove BOM if present
const cleanContent = content.replace(/^\uFEFF/, '');

if (content.length !== cleanContent.length) {
    console.log('BOM found and removed.');
} else {
    console.log('No BOM found (or regex failed).');
}

fs.writeFileSync(filePath, cleanContent, 'utf8');
console.log(`File written. New length: ${cleanContent.length}`);

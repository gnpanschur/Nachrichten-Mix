const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'data', '2026-02-09-07-09.json');

console.log(`Checking file: ${filePath}`);

fs.readFile(filePath, 'utf8', (err, content) => {
    if (err) {
        console.error('Error reading file:', err);
        return;
    }

    try {
        const jsonData = JSON.parse(content);
        console.log('JSON parsed successfully.');
        console.log('Item count:', Array.isArray(jsonData) ? jsonData.length : 'Not an array');
        // console.log(JSON.stringify(jsonData, null, 2));
    } catch (parseErr) {
        console.error('Error parsing JSON:', parseErr.message);
        // Show context around the error if possible
        const match = parseErr.message.match(/position (\d+)/);
        if (match) {
            const pos = parseInt(match[1], 10);
            const start = Math.max(0, pos - 20);
            const end = Math.min(content.length, pos + 20);
            console.log('Context:', content.substring(start, end));
        }
    }
});

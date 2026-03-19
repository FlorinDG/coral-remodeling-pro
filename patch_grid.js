const fs = require('fs');
const filePath = 'node_modules/react-datasheet-grid/dist/hooks/useColumnWidths.js';
let content = fs.readFileSync(filePath, 'utf8');

const searchStr = `        for (const item of items) {
            if (!item.frozen) {
                item.size += (availableWidth * item.factor) / sumFactors;`;

const replacement = `        for (const item of items) {
            if (!item.frozen) {
                if (item.factor === 0 && item.basis > 0) {
                    item.frozen = true;
                    item.size = item.basis;
                    continue;
                }
                item.size += (availableWidth * item.factor) / sumFactors;`;

if (content.includes(searchStr)) {
    content = content.replace(searchStr, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Successfully patched react-datasheet-grid useColumnWidths.js!");
} else {
    console.log("Could not find Target string in useColumnWidths.js!");
}

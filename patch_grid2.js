const fs = require('fs');
const filePath = 'node_modules/react-datasheet-grid/dist/hooks/useColumnWidths.js';
let content = fs.readFileSync(filePath, 'utf8');

const searchStr = `        for (const item of items) {
            if (!item.frozen) {
                // PATCH: If a developer explicitly passed grow: 0 and shrink: 0,
                // NEVER mathematically stretch this column under any circumstances.
                if (item.factor === 0 && item.basis > 0) {`;

const replacement = `        for (const item of items) {
            if (!item.frozen) {
                // PATCH: If a developer explicitly passed grow: 0 and shrink: 0,
                // NEVER mathematically stretch this column under any circumstances.
                if (item.factor === 0 && item.basis > 0) {`;

if (content.includes(searchStr)) {
    console.log("Successfully patched react-datasheet-grid!");
} else {
    // try applying the old version
    const oldStr = `        for (const item of items) {
            if (!item.frozen) {
                item.size += (availableWidth * item.factor) / sumFactors;`;
    const newStr = `        for (const item of items) {
            if (!item.frozen) {
                if (item.factor === 0 && item.basis > 0) {
                    item.frozen = true;
                    item.size = item.basis;
                    continue;
                }
                item.size += (availableWidth * item.factor) / sumFactors;`;

    if (content.includes(oldStr)) {
        content = content.replace(oldStr, newStr);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log("Successfully patched react-datasheet-grid useColumnWidths.js!");
    } else {
        console.log("Could not find Target string in useColumnWidths.js!");
    }
}

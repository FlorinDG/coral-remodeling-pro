const fs = require('fs');
const path = require('path');

const files = process.argv.slice(2);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // 1. Change next/link import
  if (content.includes('next/link')) {
    content = content.replace(/import\s+Link\s+from\s+["']next\/link["'];?/g, 'import { Link } from "@/i18n/routing";');
    changed = true;
  }

  // 2. Change next/navigation import
  if (content.includes('next/navigation')) {
    content = content.replace(/import\s+{([^}]+)}\s+from\s+["']next\/navigation["'];?/g, (match, imports) => {
      // Remove useParams as it's not exported by i18n routing
      let newImports = imports.split(',').map(i => i.trim()).filter(i => i !== 'useParams');
      let res = '';
      if (newImports.length > 0) {
        res += `import { ${newImports.join(', ')} } from "@/i18n/routing";\n`;
      }
      if (imports.includes('useParams')) {
        res += `import { useParams } from "next/navigation";\n`;
      }
      return res.trim();
    });
    changed = true;
  }

  // 3. Prepend /admin/time-tracker to paths
  // Find href="/"
  content = content.replace(/href=["']\/([^"']*)["']/g, (match, p1) => {
    let newPath = p1 ? `/admin/time-tracker/${p1}` : '/admin/time-tracker';
    return `href="${newPath}"`;
  });
  
  // Find router.push('/')
  content = content.replace(/router\.push\(["']\/([^"']*)["']\)/g, (match, p1) => {
    let newPath = p1 ? `/admin/time-tracker/${p1}` : '/admin/time-tracker';
    return `router.push("${newPath}")`;
  });

  if (changed) {
    fs.writeFileSync(file, content);
    console.log(`Fixed paths in ${file}`);
  }
});

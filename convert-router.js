const fs = require('fs');
const path = require('path');

const files = process.argv.slice(2);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Replace imports
  if (content.includes('react-router-dom')) {
    let routerImports = [];
    if (content.includes('useNavigate')) routerImports.push('useRouter');
    if (content.includes('useLocation')) routerImports.push('usePathname');
    if (content.includes('useParams')) routerImports.push('useParams');

    content = content.replace(/import\s+{([^}]+)}\s+from\s+['"]react-router-dom['"];?/g, (match, imports) => {
      let isLink = imports.includes('Link');
      let result = '';
      if (isLink) {
        result += `import Link from "next/link";\n`;
      }
      if (routerImports.length > 0) {
        // Only keep navigation imports
        result += `import { ${routerImports.join(', ')} } from "next/navigation";\n`;
      }
      return result.trim() ? result : match;
    });

    // Replace Link to= with Link href=
    content = content.replace(/<Link([^>]+)to=/g, '<Link$1href=');

    // Replace useNavigate hook
    content = content.replace(/const\s+(\w+)\s*=\s*useNavigate\(\)/g, "const $1 = useRouter()");
    // Note: navigate(...) becomes router.push(...)
    // Assuming variable was named 'navigate'
    content = content.replace(/navigate\(/g, "router.push(");
    
    // Replace useLocation hook
    content = content.replace(/const\s+(\w+)\s*=\s*useLocation\(\)/g, "const $1 = usePathname()");
    // location.pathname -> pathname (if named location)
    content = content.replace(/location\.pathname/g, "pathname");

    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});

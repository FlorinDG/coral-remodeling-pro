const fs = require('fs');

const files = process.argv.slice(2);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Add useRouter if router is used but not imported
  if (content.match(/\brouter\b/) && !content.includes('useRouter')) {
     content = `import { useRouter } from "@/i18n/routing";\n` + content;
     changed = true;
  }

  // Add usePathname if pathname is used but not imported
  if (content.match(/\bpathname\b/) && !content.includes('usePathname')) {
     content = `import { usePathname } from "@/i18n/routing";\n` + content;
     changed = true;
  }

  // Remove duplicate imports
  let routerMatches = content.match(/import\s+{\s*useRouter\s*}\s+from\s+["']@\/i18n\/routing["'];?/g);
  if (routerMatches && routerMatches.length > 1) {
    content = content.replace(/import\s+{\s*useRouter\s*}\s+from\s+["']@\/i18n\/routing["'];?\n?/, '');
    changed = true;
  }

  // Fix Profile.tsx which might have 2 router declarations
  if (content.includes('const router = useRouter();') && content.match(/const\s+router\s*=\s*useRouter\(\)/g)?.length > 1) {
    content = content.replace(/const\s+router\s*=\s*useRouter\(\);\s*\n\s*const\s+router\s*=\s*useRouter\(\);/, 'const router = useRouter();');
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log(`Fixed TS imports in ${file}`);
  }
});

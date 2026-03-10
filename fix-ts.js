const fs = require('fs');

const files = process.argv.slice(2);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  // Fix 1: Duplicate import of useRouter
  if (content.match(/import\s+{([^}]+)}\s+from\s+["']@\/i18n\/routing["']/g)) {
     // replace all useRouter imports from next/navigation with nothing
     content = content.replace(/import\s+{\s*useRouter\s*}\s+from\s+["']next\/navigation["'];?\n?/g, '');
     changed = true;
  }
  
  // Fix 2: missing router initialization where useNavigate used to be
  if (content.includes('router.push') || content.includes('router.replace')) {
    // If router is not defined, we need to add it. This usually happened where navigate was used without being declared or grabbed from context instead of useNavigate hook.
    // The previous script replaced navigate() with router.push(), but failed if 'const navigate = useNavigate()' wasn't present.
    // So if there's no 'const router' or 'let router', add it.
    if (!content.match(/(const|let)\s+router\s*=/)) {
        // Add const router = useRouter(); inside the component body.
        // Easiest is to inject it after the main function declaration
        content = content.replace(/(export\s+default\s+function\s+\w+\(\)\s*{|const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*{)/, "$1\n  const router = useRouter();");
        changed = true;
    }
  }

  // Fix 3: missing pathname
  if (content.includes('pathname') && !content.match(/(const|let)\s+pathname\s*=/)) {
     content = content.replace(/(export\s+default\s+function\s+\w+\(\)\s*{|const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*{)/, "$1\n  const pathname = usePathname();");
     changed = true;
  }

  // Fix 4: ZodError errors property
  if (content.includes('error.errors')) {
     content = content.replace(/error\.errors/g, '(error as any).errors');
     changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content);
    console.log(`Fixed TS in ${file}`);
  }
});

import fs from 'fs';
import path from 'path';

const file = path.join(__dirname, 'src/app/[locale]/admin/hr/timesheets/page.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add startOfMonth, endOfMonth
content = content.replace(
  "import { formatISO, startOfWeek, endOfWeek } from 'date-fns';",
  "import { formatISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';"
);

// 2. Add ChevronDown, ChevronRight
content = content.replace(
  "import { Loader2, FileText, Download, AlertCircle, Image as ImageIcon, Check, X, Clock, Hourglass, Plus } from 'lucide-react';",
  "import { Loader2, FileText, Download, AlertCircle, Image as ImageIcon, Check, X, Clock, Hourglass, Plus, ChevronDown, ChevronRight } from 'lucide-react';"
);

// 3. Fix expandedGroups.has() to expandedGroups[]
content = content.replace(/expandedGroups\.has\(([^)]+)\)/g, 'expandedGroups[$1]');

fs.writeFileSync(file, content);
console.log('Fixed page.tsx');

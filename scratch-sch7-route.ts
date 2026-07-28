import fs from 'fs';
import path from 'path';

const file = path.join(__dirname, 'src/app/api/hr/[entity]/route.ts');
let content = fs.readFileSync(file, 'utf8');

const enrichRegex = /records = records\.map\(\(r: any\) => \{\s*const u = userMap\.get\(r\.userId\);\s*const e = empMap\.get\(r\.userId\);\s*const legacy = legacyEmpMap\.get\(r\.userId\);\s*let userName = r\.userId\?\.slice\(0, 8\) \|\| 'System';\s*if \(u\?\.name\) userName = u\.name;\s*else if \(e\?\.firstName \|\| e\?\.lastName\) userName = `\$\{e\.firstName \|\| ''\} \$\{e\.lastName \|\| ''\}`\.trim\(\);\s*else if \(legacy\) userName = `\$\{legacy\.firstName \|\| ''\} \$\{legacy\.lastName \|\| ''\}`\.trim\(\);\s*else if \(u\?\.email\) userName = u\.email;\s*return \{ \.\.\.r, userName \};\s*\}\);/;

const newEnrichment = `records = records.map((r: any) => {
                    const u = userMap.get(r.userId);
                    const e = empMap.get(r.userId);
                    const legacy = legacyEmpMap.get(r.userId);
                    let userName = r.userId?.slice(0, 8) || 'System';
                    if (u?.name) userName = u.name;
                    else if (e?.firstName || e?.lastName) userName = \`\${e.firstName || ''} \${e.lastName || ''}\`.trim();
                    else if (legacy) userName = \`\${legacy.firstName || ''} \${legacy.lastName || ''}\`.trim();
                    else if (u?.email) userName = u.email;
                    
                    return { ...r, userName };
                });
            }
            
            // SCH-7: Project name enrichment for shifts
            if (entity === 'shifts') {
                const projectIds = [...new Set(records.map((r: any) => r.projectId).filter(Boolean))] as string[];
                if (projectIds.length > 0) {
                    const projects = await prisma.project.findMany({
                        where: { id: { in: projectIds } },
                        select: { id: true, name: true }
                    });
                    const projectMap = new Map(projects.map((p: any) => [p.id, p.name]));
                    records = records.map((r: any) => {
                        let projectName = r.projectId ? projectMap.get(r.projectId) : undefined;
                        if (projectName && projectName.startsWith('[ERP] ')) {
                            projectName = projectName.replace('[ERP] ', '');
                        }
                        return { ...r, projectName };
                    });
                }
            }`;

content = content.replace(enrichRegex, newEnrichment);
fs.writeFileSync(file, content);
console.log('Fixed route.ts for SCH-7');

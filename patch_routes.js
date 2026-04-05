const fs = require('fs');
const files = [
    "src/app/api/portals/route.ts",
    "src/app/api/portals/documents/route.ts",
    "src/app/api/portals/tasks/route.ts",
    "src/app/api/portals/messages/route.ts",
    "src/app/api/portals/updates/route.ts",
    "src/app/api/portals/media/route.ts"
];

for (const file of files) {
    if (!fs.existsSync(file)) continue;
    let content = fs.readFileSync(file, 'utf8');

    if (!content.includes('import { auth }')) {
        content = 'import { auth } from "@/auth";\n' + content;
    }

    // Inject auth logic into POST
    content = content.replace(
        /export async function POST\(request: Request\) \{\n\s*try \{/g,
        "export async function POST(request: Request) {\n    try {\n        const session = await auth();\n        const tenantId = (session?.user as any)?.tenantId;\n        if (!tenantId) return new Response('Unauthorized', { status: 401 });"
    );

    // Inject tenantId into prisma.____.create({ data: {
    content = content.replace(/data: \{/g, "data: {\n                tenantId,");

    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
}

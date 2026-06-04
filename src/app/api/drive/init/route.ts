import { NextResponse } from 'next/server';
import { generateClientFolderTemplate, generateProjectFolderTemplate, createFolder, findOrCreateFolder, ensureCoralDriveRoot } from '@/lib/google-drive';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

export async function POST(req: Request) {
    try {
        const session = await auth();
        const tenantId = session?.user?.tenantId;

        if (!tenantId) {
            return NextResponse.json({ error: 'Unauthorized: SaaS workspace context missing.' }, { status: 401 });
        }

        const { databaseId, pageId, title } = await req.json();

        if (!databaseId || !pageId || !title) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Short-circuit: check if page already has driveFolderId bound in Postgres
        const existingPage = await prisma.globalPage.findUnique({
            where: { id: pageId },
            select: { driveFolderId: true }
        });
        if (existingPage?.driveFolderId) {
            console.log(`[Drive init] Short-circuit: page ${pageId} is already bound to drive folder ${existingPage.driveFolderId}`);
            return NextResponse.json({ success: true, driveFolderId: existingPage.driveFolderId });
        }

        // Ensure we don't attempt Drive calls without proper OAuth credentials
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
            console.warn('[Google Drive] Aborting: OAuth credentials missing from .env');
            return NextResponse.json({ error: 'Drive integration not configured' }, { status: 503 });
        }

        // --- MULTI-TENANT SANDBOX PARTITIONING ---
        // Resolve or generate the root directory for this SaaS tenant across the Master Google Workspace
        const tenantInfo = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenantInfo) return NextResponse.json({ error: 'Invalid tenant context' }, { status: 403 });

        let tenantRootDriveId = tenantInfo.driveFolderId;

        if (!tenantRootDriveId) {
            // First time this Tenant creates a client: initialize their master vault
            const cleanTenantName = tenantInfo.companyName.replace(/[^a-zA-Z0-9 ]/g, "").trim();
            const parentFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
            if (!parentFolderId) {
                console.error('[Partitioning] Missing GOOGLE_DRIVE_ROOT_FOLDER_ID in environment variables');
                return NextResponse.json({ error: 'Server misconfiguration: Drive Parent ID missing' }, { status: 500 });
            }
            tenantRootDriveId = await createFolder(cleanTenantName || `Tenant_${tenantId}`, parentFolderId);
            await prisma.tenant.update({
                where: { id: tenantId },
                data: { driveFolderId: tenantRootDriveId }
            });
            console.log(`[Partitioning] Successfully generated Root Vault for Tenant ${tenantId} at ${tenantRootDriveId}`);
        }

        const isBase = (id: string, base: string) => id === base || id.startsWith(base + '-');

        let driveFolderId = null;

        // Generate Master Client Folder Template inside the Tenant's Vault
        if (isBase(databaseId, 'db-clients')) {
            const { masterId } = await generateClientFolderTemplate(title.trim(), tenantRootDriveId);
            driveFolderId = masterId;
        }

        // Generate Subfolders
        // For db-1 (Projects) and db-portals (Portals), we ideally need to know the Parent Client ID to nest them properly!
        // Given that during initial 'title' typing, the user likely hasn't linked the parent Client yet natively in the Notion Grid, 
        // we will generate this securely at the root, and let manual reorganization handle grouping optionally later OR we can fetch it.
        // For Phase 1 strict automation: we generate it under a generic "Orphaned Databases" folder or root, unless client relationship is provided.
        // In the future: we can check if `page.properties['client-relation']` exists.
        else if (isBase(databaseId, 'db-1')) {
            // Generating Project hierarchy inside Tenant's Root for safety isolation!
            const { projectId } = await generateProjectFolderTemplate(title.trim(), tenantRootDriveId);
            driveFolderId = projectId;
        }

        else if (isBase(databaseId, 'db-portals')) {
            const newPortalId = await createFolder(title.trim(), tenantRootDriveId);
            driveFolderId = newPortalId;
        }

        else if (isBase(databaseId, 'db-hr')) {
            // Automatically build an "HR Module" folder under the tenant vault, generating subdirectory structures: "ID & Photo's", "Contracts & Payroll", and "Required Documents".
            const hrModuleFolderId = await findOrCreateFolder('HR Module', tenantRootDriveId);
            const employeeFolderId = await createFolder(title.trim(), hrModuleFolderId);
            await createFolder("ID & Photo's", employeeFolderId);
            await createFolder("Contracts & Payroll", employeeFolderId);
            await createFolder("Required Documents", employeeFolderId);
            driveFolderId = employeeFolderId;
        }

        else if (isBase(databaseId, 'db-documents')) {
            // Automatically build a "Business Documents" vault directory with folders: "Contracts", "Disputes & Legal", "Insurance & Certs", and "General Support".
            const bizDocsFolderId = await findOrCreateFolder('Business Documents', tenantRootDriveId);
            
            // Build the main category subfolders inside "Business Documents" so they always exist
            await findOrCreateFolder('Contracts', bizDocsFolderId);
            await findOrCreateFolder('Disputes & Legal', bizDocsFolderId);
            await findOrCreateFolder('Insurance & Certs', bizDocsFolderId);
            await findOrCreateFolder('General Support', bizDocsFolderId);
            
            // Create a specific folder for this document record (using its title) inside "Business Documents"
            const docFolderId = await createFolder(title.trim(), bizDocsFolderId);
            driveFolderId = docFolderId;
        }

        if (!driveFolderId) {
            return NextResponse.json({ error: 'Unsupported database for drive generation' }, { status: 400 });
        }

        return NextResponse.json({ success: true, driveFolderId });

    } catch (error: any) {
        console.error('[Drive API Route Error]', error);
        return NextResponse.json({ error: error.message || 'Failed to generate drive assets' }, { status: 500 });
    }
}

import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { roleOfDatabase } from '@/lib/data/system-databases';
import { getDatabaseRoute } from '@/lib/databaseRoute';
import { SYSTEM_DATABASES, BASE_TO_KEY, SystemDatabaseRole } from '@/lib/kernel/system-databases';

interface Props {
    params: Promise<{ locale: string; databaseId: string; pageId: string }>;
}

export default async function DatabaseRecordPage({ params }: Props) {
    const { databaseId, pageId, locale } = await params;
    const session = await auth();
    const tenantId = session?.user?.tenantId;

    let role: SystemDatabaseRole | null = null;
    if (databaseId in SYSTEM_DATABASES) {
        role = databaseId as SystemDatabaseRole;
    } else if (databaseId in BASE_TO_KEY) {
        role = BASE_TO_KEY[databaseId];
    } else if (tenantId) {
        try {
            role = await roleOfDatabase(tenantId, databaseId);
        } catch {
            // Not a system database or not found
        }
    }

    const route = getDatabaseRoute(role, pageId);
    const parentPath = route || `/admin/database/${databaseId}?open=${pageId}`;

    redirect(`/${locale}${parentPath}`);
}

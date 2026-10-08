import { scopeFromSession, TenantMismatchError } from '@/lib/data/scope';
import { auth } from '@/auth';

export async function getAccessibleUserIds(
    tenantId: string,
    userId: string,
    sessionGetter: () => Promise<any> = auth
): Promise<string[]> {
    const session = await sessionGetter();
    const sessionTenantId = session?.user?.tenantId;
    if (!sessionTenantId) {
        throw new Error('getAccessibleUserIds: no tenant in session');
    }
    if (sessionTenantId !== tenantId) {
        throw new TenantMismatchError('HrTeamMember', `tenant mismatch: param ${tenantId} vs session ${sessionTenantId}`);
    }

    const db = await scopeFromSession();

    // A user can always see their own items
    const accessibleIds = new Set<string>();
    accessibleIds.add(userId);

    // Find all teams where this user is a "lead" — within THIS tenant only.
    // HrTeamMember is Class B (tenant via `team`); scoped client enforces this.
    const ledTeams = await db.hrTeamMember.findMany({
        where: { userId, role: 'lead', team: { tenantId } },
        select: { teamId: true }
    });

    if (ledTeams.length === 0) {
        return Array.from(accessibleIds);
    }

    const teamIds = ledTeams.map(t => t.teamId);

    // Find all members of those teams
    const teamMembers = await db.hrTeamMember.findMany({
        where: { teamId: { in: teamIds }, team: { tenantId } },
        select: { userId: true }
    });

    for (const member of teamMembers) {
        accessibleIds.add(member.userId);
    }

    return Array.from(accessibleIds);
}

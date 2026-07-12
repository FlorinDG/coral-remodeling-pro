import { prisma } from '@/lib/prisma';

export async function getAccessibleUserIds(tenantId: string, userId: string): Promise<string[]> {
    // A user can always see their own items
    const accessibleIds = new Set<string>();
    accessibleIds.add(userId);

    // Find all teams where this user is a "lead"
    const ledTeams = await prisma.hrTeamMember.findMany({
        where: { userId, role: 'lead' },
        select: { teamId: true }
    });

    if (ledTeams.length === 0) {
        return Array.from(accessibleIds);
    }

    const teamIds = ledTeams.map(t => t.teamId);

    // Find all members of those teams
    const teamMembers = await prisma.hrTeamMember.findMany({
        where: { teamId: { in: teamIds } },
        select: { userId: true }
    });

    for (const member of teamMembers) {
        accessibleIds.add(member.userId);
    }

    return Array.from(accessibleIds);
}

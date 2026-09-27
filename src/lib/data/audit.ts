import prisma from "@/lib/prisma";

export async function resolveUserLabel(tenantId: string, userId: string): Promise<string> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true, email: true },
        });
        return user?.name || user?.email || userId;
    } catch {
        return userId;
    }
}

export async function insertAuditLog(data: any) {
    return prisma.auditLog.create({ data });
}

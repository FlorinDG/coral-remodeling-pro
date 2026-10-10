import prisma from "@/lib/prisma";

export async function getPortalBySlug(slug: string) {
    return prisma.clientPortal.findUnique({
        where: { slug },
        include: {
            updates: { orderBy: { createdAt: 'desc' } },
            documents: { orderBy: { createdAt: 'desc' } },
            media: { orderBy: { createdAt: 'desc' } },
            messages: { orderBy: { createdAt: 'asc' } },
        }
    });
}

export async function getPortalById(id: string) {
    return prisma.clientPortal.findUnique({
        where: { id },
    });
}

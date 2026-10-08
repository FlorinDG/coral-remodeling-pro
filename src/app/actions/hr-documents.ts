"use server";

import { scopeFromSession } from "@/lib/data/scope";
import { auth } from "@/auth";

export async function getHrDocuments() {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const tenantId = (session.user as any).tenantId;
    if (!tenantId) {
        throw new Error("No tenant context");
    }
    const db = await scopeFromSession();

    const documents = await db.hrDocument.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' }
    });

    const acknowledgments = await db.hrDocumentAcknowledgment.findMany({
        where: {
            userId: session.user.id,
            documentId: { in: documents.map(d => d.id) }
        }
    });

    const ackMap = new Map(acknowledgments.map(a => [a.documentId, a.readAt.toISOString()]));

    return documents.map(d => ({
        id: d.id,
        title: d.title,
        description: d.description,
        fileUrl: d.fileUrl,
        content: d.content,
        requiresSignature: d.requiresSignature,
        deadline: d.deadline ? d.deadline.toISOString() : null,
        createdAt: d.createdAt.toISOString(),
        acknowledged: ackMap.has(d.id),
        acknowledgedAt: ackMap.get(d.id) || null,
        file_url: d.fileUrl,
        requires_signature: d.requiresSignature,
        created_at: d.createdAt.toISOString(),
        acknowledged_at: ackMap.get(d.id) || null
    }));
}

export async function acknowledgeHrDocument(documentId: string, signatureData?: string | null) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }
    const db = await scopeFromSession();

    await db.hrDocumentAcknowledgment.upsert({
        where: {
            userId_documentId: {
                userId: session.user.id,
                documentId
            }
        },
        update: {
            signatureData,
            readAt: new Date()
        },
        create: {
            userId: session.user.id,
            documentId,
            signatureData,
            readAt: new Date()
        }
    });
    
    return { success: true };
}

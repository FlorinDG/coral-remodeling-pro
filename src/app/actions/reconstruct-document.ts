"use server";

import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { storage } from '@/lib/storage';
import { archiveDocument } from '@/lib/records/document-archive';
import { updatePageServerFirst } from '@/app/actions/pages';

export interface ReconstructDocumentResult {
    success: boolean;
    archiveKey?: string;
    archiveFilename?: string;
    reconstructedAt?: string;
    error?: string;
}

/**
 * DOC-ARCH-5: Reconstruct and archive a document for records missing their original archive.
 *
 * Invariant (D3): A reconstruction must NEVER shadow or replace an authentic archive.
 * If an authentic archive already exists in storage or on the record, this action refuses.
 */
export async function reconstructDocumentAction(params: {
    pageId: string;
    pdfBase64: string;
}): Promise<ReconstructDocumentResult> {
    try {
        const session = await auth();
        // @ts-ignore
        const tenantId = session?.user?.tenantId;
        if (!tenantId) {
            return { success: false, error: 'Niet geautoriseerd: geen actieve sessie gevonden.' };
        }

        const { pageId, pdfBase64 } = params;
        if (!pageId || !pdfBase64) {
            return { success: false, error: 'Ontbrekende vereiste parameters: pageId of pdfBase64.' };
        }

        const page = await prisma.globalPage.findUnique({
            where: { id: pageId },
            include: { database: { select: { tenantId: true } } }
        });

        if (!page) {
            return { success: false, error: `Document record niet gevonden: ${pageId}` };
        }

        if (page.database.tenantId !== tenantId) {
            return { success: false, error: 'Onbevoegde toegang tot dit document.' };
        }

        const currentProps = (page.properties ?? {}) as Record<string, any>;

        // ── D3 Invariant: Check if authentic (non-reconstructed) archive already exists ──
        if (currentProps.receiptUrl && !currentProps.documentReconstructed) {
            return {
                success: false,
                error: 'Het originele document is al gearchiveerd. Reconstructie is niet toegestaan.'
            };
        }

        const prefix = `t_${tenantId}/documents/${page.databaseId}/${pageId}/`;
        const existingEntries = await storage.list(prefix);
        const hasAuthenticArchive = existingEntries.some(e => !e.pathname.endsWith('-reconstructed.pdf'));
        if (hasAuthenticArchive) {
            return {
                success: false,
                error: 'Het originele document is al gearchiveerd in opslag. Reconstructie is niet toegestaan.'
            };
        }

        // Archive with reconstructed flag
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');
        const documentNumber = String(currentProps.title || 'Document');
        const archiveResult = await archiveDocument({
            tenantId,
            databaseId: page.databaseId,
            pageId,
            documentNumber,
            pdf: pdfBuffer,
            reconstructed: true,
        });

        const reconstructedAt = new Date().toISOString();
        const updateRes = await updatePageServerFirst(pageId, {
            ...currentProps,
            receiptUrl: archiveResult.key,
            documentReconstructed: true,
            documentReconstructedAt: reconstructedAt,
        });

        if (!updateRes.success) {
            return {
                success: false,
                error: `Opslaan van gereconstrueerd document mislukt: ${updateRes.error}`
            };
        }

        return {
            success: true,
            archiveKey: archiveResult.key,
            archiveFilename: archiveResult.filename,
            reconstructedAt,
        };
    } catch (err: any) {
        console.error('[reconstructDocumentAction] Fout bij documentreconstructie:', err);
        return {
            success: false,
            error: err?.message || 'Onverwachte fout bij documentreconstructie.'
        };
    }
}

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function acceptQuotation(quoteId: string, signatureBase64: string) {
    try {
        const quote = await prisma.globalPage.findUnique({
            where: { id: quoteId }
        });

        if (!quote) throw new Error("Offerte niet gevonden.");

        const currentProps = typeof quote.properties === 'object' && quote.properties !== null
            ? (quote.properties as Record<string, any>)
            : {};

        await prisma.globalPage.update({
            where: { id: quoteId },
            data: {
                properties: {
                    ...currentProps,
                    status: "ACCEPTED",
                    clientSignature: signatureBase64,
                    signedAt: new Date().toISOString()
                }
            }
        });

        return { success: true };
    } catch (error: any) {
        console.error("Signature acceptance failed:", error);
        return { success: false, error: error.message || "Er is een fout opgetreden bij het opslaan." };
    }
}

async function main() {
    const result = await acceptQuotation("34959faa-bcad-4af7-a1bb-583edf3d3a8d", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");
    console.log("RESULT:", result);

    const quote = await prisma.globalPage.findUnique({
        where: { id: "34959faa-bcad-4af7-a1bb-583edf3d3a8d" }
    });
    console.log("UPDATED QUOTE STATUS:", (quote?.properties as any)?.status);
}

main().finally(() => prisma.$disconnect());

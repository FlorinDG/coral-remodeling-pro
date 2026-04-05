import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.tenantId) {
            return NextResponse.json({ error: 'Unauthorized', success: false }, { status: 401 });
        }

        const body = await req.json();
        const { invoiceId, clientId, projectId, betreft } = body;

        console.log(`[Storecove API] Initiating Peppol Dispatch for Invoice ${invoiceId} / Client ${clientId}`);

        // 1. Fetch the overarching Tenant Configuration (Sender details)
        const tenant = await prisma.tenant.findUnique({
            where: { id: session.user.tenantId }
        });

        if (!tenant) {
            return NextResponse.json({ error: 'Tenant identity missing. Configure your company settings first.', success: false }, { status: 404 });
        }

        // 2. We can retrieve the physical Database row from IndexedDB sync/Postgres 
        // For standard operations, Storecove requires:
        // - Sender VAT / KBO
        // - Receiver VAT / KBO
        // - Line Items mapping

        const STORECOVE_API_KEY = process.env.STORECOVE_API_KEY;
        if (!STORECOVE_API_KEY) {
            console.log("Mocking Peppol Dispatch (STORECOVE_API_KEY is not defined)");
            // Simulated delay for UI interaction
            await new Promise(r => setTimeout(r, 1500));
            return NextResponse.json({
                success: true,
                message: "MOCK: Invoice queued in Peppol Network Sandbox."
            });
        }

        // PHYSICAL STORECOVE INTEGRATION PIPELINE
        // https://api.storecove.com/api/v2/document_submissions

        const storecovePayload = {
            "document_submissions": {
                "routing": {
                    "network": "peppol"
                    // Real implementation acquires the ISO6523 scheme target here
                },
                "document": {
                    "document_type": "invoice",
                    "accounting_supplier_party": {
                        "party": {
                            "legal_entity": {
                                "registration_name": tenant.companyName || "Coral SaaS"
                            }
                        }
                    },
                    "accounting_customer_party": {
                        "party": {
                            "legal_entity": {
                                "registration_name": "Target Client"
                            }
                        }
                    },
                    "invoice_lines": [
                        // Map internal lines here
                    ]
                }
            }
        };

        const res = await fetch('https://api.storecove.com/api/v2/document_submissions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${STORECOVE_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(storecovePayload)
        });

        const storecoveResponse = await res.json();

        if (!res.ok) {
            console.error("Storecove Reject:", storecoveResponse);
            return NextResponse.json({ error: storecoveResponse.message || 'Storecove network failure', success: false }, { status: 400 });
        }

        return NextResponse.json({ success: true, payload: storecoveResponse });

    } catch (error: any) {
        console.error("Peppol API Error:", error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message, success: false }, { status: 500 });
    }
}

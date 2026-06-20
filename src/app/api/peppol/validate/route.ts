/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { buildPeppolPayload, performLocalPreflight } from '@/lib/peppol-payload';

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.tenantId) {
            return NextResponse.json({ error: 'Unauthorized', success: false }, { status: 401 });
        }
        const tenantId = (session!.user as any).tenantId;

        const body = await req.json();
        const { invoiceId, blocks, client, invoiceTitle, betreft, invoiceDate, dueDate, isCreditNote, parentInvoiceId, structuredComm } = body;

        // 1. Fetch Tenant (Sender) details
        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                id: true, companyName: true, vatNumber: true,
                street: true, postalCode: true, city: true,
                email: true, iban: true, bic: true,
                eInvoiceApiKey: true,
            },
        });

        if (!tenant) {
            return NextResponse.json({ error: 'TENANT_NOT_FOUND', code: 'TENANT_NOT_FOUND', success: false }, { status: 404 });
        }

        // Fetch original invoice number if Credit Note
        let parentInvoiceNumber = undefined;
        const resolvedParentInvoiceId = Array.isArray(parentInvoiceId) ? parentInvoiceId[0] : parentInvoiceId;
        if (isCreditNote && resolvedParentInvoiceId) {
            const parent = await prisma.invoice.findUnique({ where: { id: resolvedParentInvoiceId } });
            if (parent) parentInvoiceNumber = parent.invoiceNumber;
        }

        const payloadParams = {
            invoiceId,
            blocks: blocks || [],
            client,
            invoiceTitle,
            betreft,
            invoiceDate,
            dueDate,
            isCreditNote,
            parentInvoiceNumber,
            structuredComm,
            tenant,
            userEmail: session?.user?.email || ''
        };

        // 2. Perform Local Preflight Check
        const preflight = performLocalPreflight(payloadParams);
        if (!preflight.isValid) {
            return NextResponse.json({
                success: false,
                is_valid: false,
                source: 'local',
                errors: preflight.errors
            });
        }

        // 3. Remote Validation (if tenant has API key configured)
        const E_INVOICE_API_KEY = tenant.eInvoiceApiKey;
        if (!E_INVOICE_API_KEY) {
            // Local preflight passed, and without API key they run in manual/email-fallback mode.
            return NextResponse.json({
                success: true,
                is_valid: true,
                source: 'local',
                errors: [],
                message: 'Local validation passed (Manual UBL Queue Mode)'
            });
        }

        const E_INVOICE_BASE_URL = process.env.E_INVOICE_BASE_URL || 'https://api.e-invoice.be';
        const { invoicePayload } = buildPeppolPayload(payloadParams);

        const validateRes = await fetch(`${E_INVOICE_BASE_URL}/api/validate/json`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${E_INVOICE_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(invoicePayload),
        });

        let validateData;
        try {
            validateData = await validateRes.json();
        } catch {
            const errorText = await validateRes.text();
            return NextResponse.json({
                success: false,
                is_valid: false,
                source: 'remote',
                errors: [`API validatie fout (HTTP ${validateRes.status}): ${errorText || 'Ongeldig JSON antwoord'}`]
            });
        }

        if (!validateRes.ok || validateData.is_valid === false) {
            let errorMsgList: string[] = [];
            if (Array.isArray(validateData)) {
                errorMsgList = validateData.map((e: any) => e.message || e.detail || JSON.stringify(e));
            } else if (validateData && typeof validateData === 'object') {
                const issuesList = validateData.issues || validateData.errors || validateData.validation_errors;
                if (Array.isArray(issuesList)) {
                    errorMsgList = issuesList.map((e: any) => {
                        if (typeof e === 'string') return e;
                        return `${e.severity || 'ERROR'}: ${e.message || e.field || e.description || JSON.stringify(e)}`;
                    });
                } else if (issuesList && typeof issuesList === 'object') {
                    errorMsgList = Object.entries(issuesList).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : JSON.stringify(v)}`);
                } else {
                    errorMsgList = [validateData.message || validateData.detail || validateData.error || JSON.stringify(validateData)];
                }
            } else {
                errorMsgList = [String(validateData || 'Validatiefout bij e-invoice.be')];
            }

            return NextResponse.json({
                success: false,
                is_valid: false,
                source: 'remote',
                errors: errorMsgList
            });
        }

        return NextResponse.json({
            success: true,
            is_valid: true,
            source: 'remote',
            errors: []
        });

    } catch (error: any) {
        console.error('[peppol/validate] Fatal error:', error);
        return NextResponse.json({
            success: false,
            is_valid: false,
            source: 'local',
            errors: [`Interne systeemfout: ${error.message}`]
        }, { status: 500 });
    }
}

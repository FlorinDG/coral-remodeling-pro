/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { generatePeppolUBL, type UBLLineItem } from '@/lib/peppol-ubl';
import { Resend } from 'resend';
import { maybeResetMonthlyCounters, assertPeppolSentLimit, incrementPeppolSent } from '@/lib/plan-limits';
import { buildPeppolPayload } from '@/lib/peppol-payload';

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.tenantId) {
            return NextResponse.json({ error: 'Unauthorized', success: false }, { status: 401 });
        }
        const tenantId = (session!.user as any).tenantId;

        const body = await req.json();
        const { invoiceId, blocks, client, invoiceTitle, betreft, invoiceDate, dueDate, isCreditNote, parentInvoiceId, structuredComm } = body;

        // 1. Fetch Tenant (Sender) details from Prisma
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

        // ── Plan quota check ────────────────────────────────────────
        try {
            await maybeResetMonthlyCounters(tenantId);
            await assertPeppolSentLimit(tenantId);
        } catch (limitErr: any) {
            return NextResponse.json({
                error: limitErr.message,
                code: limitErr.code || 'PEPPOL_SEND_LIMIT',
                success: false,
            }, { status: 429 });
        }
        // ────────────────────────────────────────────────────────────

        if (!tenant.vatNumber) {
            return NextResponse.json({ error: 'MISSING_VAT_NUMBER', code: 'MISSING_VAT_NUMBER', success: false }, { status: 400 });
        }

        // 2. Validate client data
        if (!client?.firstName && !client?.companyName) {
            return NextResponse.json({ error: 'MISSING_CLIENT', code: 'MISSING_CLIENT', success: false }, { status: 400 });
        }

        // 3b. Fetch original invoice for Credit Note reference if applicable
        let parentInvoiceNumber = undefined;
        const resolvedParentInvoiceId = Array.isArray(parentInvoiceId) ? parentInvoiceId[0] : parentInvoiceId;
        if (isCreditNote && resolvedParentInvoiceId) {
            const parent = await prisma.invoice.findUnique({ where: { id: resolvedParentInvoiceId } });
            if (parent) parentInvoiceNumber = parent.invoiceNumber;
        }

        console.log(`[e-invoice.be] Preparing Peppol dispatch for Invoice "${invoiceTitle}" → ${client.firstName || client.companyName || ''}`);

        // 4. Build the e-invoice.be payload
        const {
            invoicePayload,
            vendorVat,
            customerVat,
            customerCountry,
            customerAddressStr,
            items
        } = buildPeppolPayload({
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
        });

        if (items.length === 0) {
            return NextResponse.json({ error: 'NO_LINE_ITEMS', code: 'NO_LINE_ITEMS', success: false }, { status: 400 });
        }

        // 5. Check for tenant-specific e-invoice.be API key (provisioned via onboarding)
        const E_INVOICE_API_KEY = tenant.eInvoiceApiKey;
        const E_INVOICE_BASE_URL = process.env.E_INVOICE_BASE_URL || 'https://api.e-invoice.be';

        if (!E_INVOICE_API_KEY) {
            // ── MANUAL DISPATCH MODE ──
            // Generate Peppol-compliant UBL XML and email it to the platform admin
            // for manual delivery. Tenant sees a seamless success response.
            console.log('[Peppol] Manual dispatch mode — generating UBL XML for admin handling');

            // Build UBL line items from the flattened e-invoice items
            const ublItems: UBLLineItem[] = items.map(item => ({
                description: item.description,
                quantity: item.quantity,
                unit: item.unit,
                unitPrice: item.unit_price,
                lineTotal: item.amount,
                taxRate: parseFloat(item.tax_rate),
            }));

            const ublXml = generatePeppolUBL({
                invoiceId: invoicePayload.invoice_id,
                issueDate: invoicePayload.invoice_date,
                dueDate: invoicePayload.due_date,
                currency: 'EUR',
                supplierName: invoicePayload.vendor_name,
                supplierVatNumber: vendorVat,
                supplierStreet: tenant.street || undefined,
                supplierCity: tenant.city || undefined,
                supplierPostalCode: tenant.postalCode || undefined,
                supplierCountry: 'BE',
                supplierEmail: invoicePayload.vendor_email,
                customerName: invoicePayload.customer_name,
                customerVatNumber: customerVat,
                customerAddress: customerAddressStr || undefined,
                customerEmail: client.email || undefined,
                customerCountry: customerCountry,
                iban: tenant.iban?.replace(/\s/g, '') || undefined,
                bic: tenant.bic || undefined,
                paymentReference: structuredComm || invoicePayload.invoice_id,
                paymentTermNote: 'Betaling binnen 30 dagen',
                note: betreft || undefined,
                items: ublItems,
                type: isCreditNote ? '381' : '380',
                parentInvoiceNumber,
            });

            // Email the UBL XML to the platform admin for manual handling
            const adminEmail = process.env.PEPPOL_ADMIN_EMAIL || 'tfo@coral-group.be';
            const resendKey = process.env.RESEND_API_KEY;

            if (resendKey) {
                try {
                    const resend = new Resend(resendKey);
                    const customerName = invoicePayload.customer_name;
                    const invoiceNum = invoicePayload.invoice_id;

                    await resend.emails.send({
                        from: 'Coral Peppol <noreply@coral-group.be>',
                        to: [adminEmail],
                        subject: `[Peppol Wachtrij] ${invoiceNum} → ${customerName}`,
                        text: [
                            `Nieuwe Peppol factuur wacht op manuele verzending.`,
                            ``,
                            `Factuur: ${invoiceNum}`,
                            `Klant: ${customerName}`,
                            `Klant BTW: ${customerVat || 'Niet opgegeven'}`,
                            `Klant Email: ${client.email || 'Niet opgegeven'}`,
                            `Bedrag excl. BTW: €${items.reduce((s, i) => s + i.amount, 0).toFixed(2)}`,
                            `Tenant: ${tenant.companyName} (${vendorVat})`,
                            ``,
                            `Het UBL XML bestand is als bijlage toegevoegd.`,
                            `Upload dit naar het Peppol Access Point portaal voor verzending.`,
                        ].join('\n'),
                        attachments: [{
                            filename: `${invoiceNum}_peppol.xml`,
                            content: Buffer.from(ublXml, 'utf-8'),
                        }],
                    });
                    console.log(`[Peppol] UBL XML emailed to admin (${adminEmail}) for invoice ${invoiceNum}`);
                } catch (emailErr) {
                    console.error('[Peppol] Failed to email UBL to admin:', emailErr);
                    // Don't fail the request — still return success to client
                }
            } else {
                console.log('[Peppol] No RESEND_API_KEY — UBL XML logged to console');
                console.log(ublXml);
            }

            // Return seamless success to the tenant
            await incrementPeppolSent(tenantId);
            return NextResponse.json({
                success: true,
                message: 'PEPPOL_SENT_OK',
            });
        }

        // 6. LIVE: Validate → Create → Send via e-invoice.be API

        const headers = {
            'Authorization': `Bearer ${E_INVOICE_API_KEY}`,
            'Content-Type': 'application/json',
        };

        // Step 6a: Validate
        console.log('[e-invoice.be] Step 1/3: Validating invoice JSON...');
        const validateRes = await fetch(`${E_INVOICE_BASE_URL}/api/validate/json`, {
            method: 'POST',
            headers,
            body: JSON.stringify(invoicePayload),
        });
        
        let validateData;
        try {
            validateData = await validateRes.json();
        } catch {
            const errorText = await validateRes.text();
            console.error('[e-invoice.be] Validation returned non-JSON:', errorText);
            return NextResponse.json({
                error: 'PEPPOL_VALIDATION_FAILED',
                code: 'PEPPOL_VALIDATION_FAILED',
                success: false,
                issues: `HTTP ${validateRes.status}: ${errorText || 'Invalid JSON response from validation API'}`,
            }, { status: 400 });
        }

        // API returns { is_valid: bool, issues: [...], ubl_document?: string }
        if (!validateRes.ok || validateData.is_valid === false) {
            console.error('[e-invoice.be] Validation failed:', JSON.stringify(validateData, null, 2));
            let errorMsg = '';
            if (Array.isArray(validateData)) {
                errorMsg = validateData.map((e: any) => e.message || e.detail || JSON.stringify(e)).join('; ');
            } else if (validateData && typeof validateData === 'object') {
                const issuesList = validateData.issues || validateData.errors || validateData.validation_errors;
                if (Array.isArray(issuesList)) {
                    errorMsg = issuesList.map((e: any) => {
                        if (typeof e === 'string') return e;
                        return `${e.severity || 'ERROR'}: ${e.message || e.field || e.description || JSON.stringify(e)}`;
                    }).join('; ');
                } else if (issuesList && typeof issuesList === 'object') {
                    errorMsg = Object.entries(issuesList)
                        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : JSON.stringify(v)}`)
                        .join('; ');
                } else {
                    errorMsg = validateData.message || validateData.detail || validateData.error || JSON.stringify(validateData);
                }
            } else {
                errorMsg = String(validateData || 'Validatiefout');
            }
            return NextResponse.json({
                error: 'PEPPOL_VALIDATION_FAILED',
                code: 'PEPPOL_VALIDATION_FAILED',
                success: false,
                details: validateData,
                issues: errorMsg,
            }, { status: 400 });
        }
        console.log('[e-invoice.be] ✓ Validation passed');

        // Step 6b: Create document
        console.log('[e-invoice.be] Step 2/3: Creating document...');
        const createRes = await fetch(`${E_INVOICE_BASE_URL}/api/documents/`, {
            method: 'POST',
            headers,
            body: JSON.stringify(invoicePayload),
        });
        
        let createData;
        try {
            createData = await createRes.json();
        } catch {
            const errorText = await createRes.text();
            console.error('[e-invoice.be] Document creation returned non-JSON:', errorText);
            return NextResponse.json({
                error: 'PEPPOL_CREATE_FAILED',
                code: 'PEPPOL_CREATE_FAILED',
                success: false,
                details: `HTTP ${createRes.status}: ${errorText || 'Invalid JSON response from creation API'}`,
            }, { status: 400 });
        }

        if (!createRes.ok || !createData.id) {
            console.error('[e-invoice.be] Document creation failed:', JSON.stringify(createData, null, 2));
            let errorMsg = '';
            if (createData && typeof createData === 'object') {
                const issuesList = createData.issues || createData.errors || createData.validation_errors;
                if (Array.isArray(issuesList)) {
                    errorMsg = issuesList.map((e: any) => typeof e === 'string' ? e : `${e.severity || 'ERROR'}: ${e.message || e.field || JSON.stringify(e)}`).join('; ');
                } else if (issuesList && typeof issuesList === 'object') {
                    errorMsg = Object.entries(issuesList).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : JSON.stringify(v)}`).join('; ');
                } else {
                    errorMsg = createData.message || createData.detail || createData.error || JSON.stringify(createData);
                }
            } else {
                errorMsg = String(createData || 'Creatiefout');
            }
            return NextResponse.json({
                error: 'PEPPOL_CREATE_FAILED',
                code: 'PEPPOL_CREATE_FAILED',
                success: false,
                details: createData,
                issues: errorMsg,
            }, { status: 400 });
        }
        console.log(`[e-invoice.be] ✓ Document created: ${createData.id}`);

        // Step 6c: Send document
        console.log('[e-invoice.be] Step 3/3: Sending via Peppol...');
        let sendUrl = `${E_INVOICE_BASE_URL}/api/documents/${createData.id}/send`;

        // Add explicit Peppol routing if we have VAT numbers
        const sendParams = new URLSearchParams();
        if (vendorVat.startsWith('BE')) {
            sendParams.set('sender_peppol_scheme', '0208');
            sendParams.set('sender_peppol_id', vendorVat.replace('BE', ''));
        }
        if (customerVat && customerVat.startsWith('BE')) {
            sendParams.set('receiver_peppol_scheme', '0208');
            sendParams.set('receiver_peppol_id', customerVat.replace('BE', ''));
        }
        // In test mode, the API needs an email for UBL delivery
        // Pass vendor email as fallback destination
        if (invoicePayload.vendor_email) {
            sendParams.set('email', invoicePayload.vendor_email);
        }
        if (sendParams.toString()) {
            sendUrl += `?${sendParams.toString()}`;
        }

        const sendRes = await fetch(sendUrl, {
            method: 'POST',
            headers,
        });
        
        let sendData;
        try {
            sendData = await sendRes.json();
        } catch {
            const errorText = await sendRes.text();
            console.error('[e-invoice.be] Document send returned non-JSON:', errorText);
            return NextResponse.json({
                error: 'PEPPOL_SEND_FAILED',
                code: 'PEPPOL_SEND_FAILED',
                success: false,
                details: `HTTP ${sendRes.status}: ${errorText || 'Invalid JSON response from send API'}`,
            }, { status: 400 });
        }

        if (!sendRes.ok) {
            console.error('[e-invoice.be] Send failed:', JSON.stringify(sendData, null, 2));
            let errorMsg = '';
            if (sendData && typeof sendData === 'object') {
                const issuesList = sendData.issues || sendData.errors || sendData.validation_errors;
                if (Array.isArray(issuesList)) {
                    errorMsg = issuesList.map((e: any) => typeof e === 'string' ? e : `${e.severity || 'ERROR'}: ${e.message || e.field || JSON.stringify(e)}`).join('; ');
                } else if (issuesList && typeof issuesList === 'object') {
                    errorMsg = Object.entries(issuesList).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : JSON.stringify(v)}`).join('; ');
                } else {
                    errorMsg = sendData.message || sendData.detail || sendData.error || JSON.stringify(sendData);
                }
            } else {
                errorMsg = String(sendData || 'Verzendfout');
            }
            return NextResponse.json({
                error: 'PEPPOL_SEND_FAILED',
                code: 'PEPPOL_SEND_FAILED',
                success: false,
                details: sendData,
                issues: errorMsg,
            }, { status: 400 });
        }

        console.log(`[e-invoice.be] ✓ Invoice sent successfully! State: ${sendData.state}`);

        // Step 7: Finalize in Prisma (Lock + Snapshot + Peppol ID)
        await prisma.$transaction([
            prisma.invoice.update({
                where: { id: invoiceId },
                data: {
                    isLocked: true,
                    status: 'SENT',
                    peppolDocumentId: createData.id,
                    peppolState: sendData.state,
                    snapshotData: {
                        vendor: {
                            name: tenant.companyName,
                            vat: tenant.vatNumber,
                            address: [tenant.street, tenant.postalCode, tenant.city].filter(Boolean).join(', '),
                            iban: tenant.iban,
                            bic: tenant.bic
                        },
                        customer: {
                            name: [client.firstName, client.lastName].filter(Boolean).join(' '),
                            vat: client.vatNumber,
                            address: client.address,
                            email: client.email
                        }
                    }
                }
            }),
            incrementPeppolSent(tenantId)
        ]);

        return NextResponse.json({
            success: true,
            documentId: createData.id,
            state: sendData.state,
            message: 'PEPPOL_SENT_OK',
        });

    } catch (error: any) {
        console.error('[e-invoice.be] Fatal error:', error);
        return NextResponse.json({
            error: 'PEPPOL_INTERNAL_ERROR',
            code: 'PEPPOL_INTERNAL_ERROR',
            details: error.message,
            success: false,
        }, { status: 500 });
    }
}

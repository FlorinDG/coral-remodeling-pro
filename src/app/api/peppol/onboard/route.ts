import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { onboardTenant, getPeppolStatus } from '@/lib/e-invoice';

/**
 * POST /api/peppol/onboard
 * 
 * Onboards the current tenant onto the e-invoice.be platform:
 * 1. Creates an e-invoice.be tenant (using admin org API key)
 * 2. Provisions a tenant-specific API key
 * 3. Registers on the Peppol network (if VAT number is available)
 * 4. Stores the e-invoice tenantId + apiKey in our Prisma Tenant record
 */
export async function POST() {
    try {
        const session = await auth();
        if (!(session?.user as any)?.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const tenantId = (session!.user as any).tenantId;

        // Fetch our tenant info from Prisma
        const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
        if (!tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        // Check if already onboarded
        if (tenant.eInvoiceTenantId) {
            // ── API Key Recovery ──────────────────────────────────────
            // If the tenant was onboarded but the API key wasn't stored
            // (e.g. e-invoice.be didn't return a key, or network failure),
            // attempt to re-provision it now.
            if (!tenant.eInvoiceApiKey) {
                console.warn(`[Peppol] Tenant ${tenantId} has eInvoiceTenantId but no API key — attempting recovery`);
                try {
                    const { createApiKey } = await import('@/lib/e-invoice');
                    const apiKeyResult = await createApiKey(
                        tenant.eInvoiceTenantId,
                        `coralos-recovery-${Date.now()}`,
                        `CoralOS recovery key for ${tenant.companyName || tenantId}`,
                    );
                    if (apiKeyResult?.id) {
                        await prisma.tenant.update({
                            where: { id: tenantId },
                            data: { eInvoiceApiKey: apiKeyResult.id },
                        });
                        console.log(`[Peppol] ✓ API key recovered: ${apiKeyResult.id}`);
                    }
                } catch (keyErr) {
                    console.error('[Peppol] API key recovery failed:', keyErr);
                }
            }
            // ──────────────────────────────────────────────────────────

            const peppolStatus = await getPeppolStatus(tenant.eInvoiceTenantId).catch(() => ({ registered: false } as { registered: boolean }));
            return NextResponse.json({
                success: true,
                alreadyConnected: true,
                eInvoiceTenantId: tenant.eInvoiceTenantId,
                peppolRegistered: peppolStatus.registered,
                peppolId: 'peppol_id' in peppolStatus ? peppolStatus.peppol_id : undefined,
                peppolStatus: 'status' in peppolStatus ? peppolStatus.status : undefined,
            });
        }

        // Validate: need at minimum a company name
        if (!tenant.companyName) {
            return NextResponse.json({
                error: 'MISSING_COMPANY_NAME',
            }, { status: 400 });
        }

        // Build a URL-safe slug from company name
        const slug = tenant.companyName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 50)
            + '-' + tenantId.substring(0, 8);

        // Derive Peppol ID from VAT number (Belgian format: BExxxxxxxxxx → 0208:xxxxxxxxxx)
        let peppolId: string | undefined;
        let companyNumber: string | undefined;
        if (tenant.vatNumber) {
            const cleanVat = tenant.vatNumber.replace(/[\s.]/g, '').toUpperCase();
            if (cleanVat.startsWith('BE')) {
                companyNumber = cleanVat.replace('BE', '');
                peppolId = `0208:${companyNumber}`;
            }
        }

        // Onboard on e-invoice.be
        const result = await onboardTenant({
            slug,
            companyName: tenant.companyName,
            companyNumber,
            vatNumber: tenant.vatNumber?.replace(/[\s.]/g, '').toUpperCase(),
            peppolId,
            companyEmail: tenant.email || undefined,
            companyAddress: tenant.street || undefined,
            companyZip: tenant.postalCode || undefined,
            companyCity: tenant.city || undefined,
        });

        // Store credentials in our database
        const updateData: Record<string, any> = {
            eInvoiceTenantId: result.tenantId,
            peppolRegistered: result.peppolRegistered,
            peppolId: peppolId || tenant.peppolId,
        };
        if (result.apiKey) {
            updateData.eInvoiceApiKey = result.apiKey;
        }
        await prisma.tenant.update({
            where: { id: tenantId },
            data: updateData,
        });

        console.log(`[Peppol Onboard] ✓ Tenant ${tenant.companyName} onboarded successfully`);

        return NextResponse.json({
            success: true,
            eInvoiceTenantId: result.tenantId,
            peppolRegistered: result.peppolRegistered,
            peppolId,
            message: result.peppolRegistered
                ? 'PEPPOL_ACTIVE'
                : 'PEPPOL_PENDING_VAT_VERIFICATION',
        });

    } catch (error: any) {
        console.error('[Peppol Onboard] Error:', error);
        return NextResponse.json({
            error: error.message || 'ONBOARD_FAILED',
            success: false,
        }, { status: 500 });
    }
}

/**
 * GET /api/peppol/onboard
 * 
 * Returns the current Peppol connection status for the tenant.
 */
export async function GET() {
    try {
        const session = await auth();
        if (!(session?.user as any)?.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const tenantId = (session!.user as any).tenantId;

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: {
                eInvoiceTenantId: true,
                eInvoiceApiKey: true,
                peppolRegistered: true,
                peppolId: true,
                vatNumber: true,
                companyName: true,
            },
        });

        if (!tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        const connected = !!tenant.eInvoiceTenantId;

        // If connected, also query live status from e-invoice.be
        let liveStatus: any = null;
        if (connected && tenant.eInvoiceTenantId) {
            liveStatus = await getPeppolStatus(tenant.eInvoiceTenantId).catch(() => null);
        }

        return NextResponse.json({
            connected,
            eInvoiceTenantId: tenant.eInvoiceTenantId,
            peppolRegistered: liveStatus?.registered ?? tenant.peppolRegistered,
            peppolId: liveStatus?.peppol_id ?? tenant.peppolId,
            peppolStatus: liveStatus?.status,
            hasVatNumber: !!tenant.vatNumber,
            companyName: tenant.companyName,
        });

    } catch (error: any) {
        console.error('[Peppol Status] Error:', error);
        return NextResponse.json({ error: error.message, connected: false }, { status: 500 });
    }
}

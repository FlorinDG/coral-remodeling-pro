#!/usr/bin/env node
/**
 * Peppol E2E Test — Full Spectrum Bidirectional
 * 
 * Tests the complete pipeline:
 *   1. Create a NEW tenant on e-invoice.be
 *   2. Provision an API key (verify the `id` IS the bearer token)
 *   3. Authenticate with the tenant key (GET /api/me/)
 *   4. Validate an invoice JSON
 *   5. Create a document
 *   6. Send the document
 *   7. Check document status
 *   8. Cleanup: delete the test tenant
 *
 * Usage: node scripts/peppol-e2e-test.mjs
 */

const BASE_URL = process.env.E_INVOICE_BASE_URL || 'https://api.e-invoice.be';
const ORG_KEY = process.env.E_INVOICE_ORG_API_KEY;

if (!ORG_KEY) {
    console.error('❌ E_INVOICE_ORG_API_KEY env var is required');
    process.exit(1);
}

const TEST_SLUG = `e2e-test-${Date.now()}`;
const TEST_COMPANY = 'E2E Test Company BV';
// Using valid Belgian mod97 VAT numbers from the docs
const VENDOR_VAT = 'BE0897290877';
const VENDOR_CBE = '0897290877';
const CUSTOMER_VAT = 'BE0817331995';

let testTenantId = null;
let testApiKeyId = null;
let testDocumentId = null;

const orgHeaders = {
    'Authorization': `Bearer ${ORG_KEY}`,
    'Content-Type': 'application/json',
};

function tenantHeaders(apiKey) {
    return {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
    };
}

async function step(name, fn) {
    process.stdout.write(`\n${'─'.repeat(60)}\n`);
    process.stdout.write(`▶ ${name}\n`);
    process.stdout.write(`${'─'.repeat(60)}\n`);
    try {
        const result = await fn();
        console.log(`✅ ${name} — PASSED`);
        return result;
    } catch (err) {
        console.error(`❌ ${name} — FAILED`);
        console.error(`   ${err.message}`);
        if (err.details) console.error(`   Details:`, JSON.stringify(err.details, null, 2));
        throw err;
    }
}

function assert(condition, message, details) {
    if (!condition) {
        const err = new Error(message);
        err.details = details;
        throw err;
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEST PIPELINE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function run() {
    const startTime = Date.now();
    let passed = 0;
    let failed = 0;

    try {
        // ── PHASE 1: TENANT LIFECYCLE ──────────────────────────

        // 1. Create tenant
        await step('1. Create Tenant', async () => {
            const res = await fetch(`${BASE_URL}/api/admin/tenants`, {
                method: 'POST',
                headers: orgHeaders,
                body: JSON.stringify({
                    name: TEST_SLUG,
                    description: `${TEST_COMPANY} — automated E2E test`,
                    company_number: VENDOR_CBE,
                    company_tax_id: VENDOR_VAT,
                    company_name: TEST_COMPANY,
                    company_email: 'test@e2e-test.be',
                    company_address: 'Teststraat 1',
                    company_zip: '1000',
                    company_city: 'Brussel',
                    company_country: 'Belgium',
                    peppol_ids: [`0208:${VENDOR_CBE}`],
                }),
            });
            const data = await res.json();
            assert(res.ok, `HTTP ${res.status}: ${JSON.stringify(data)}`, data);
            assert(data.id, 'Tenant ID missing from response', data);
            assert(data.name === TEST_SLUG, `Expected name "${TEST_SLUG}", got "${data.name}"`, data);

            testTenantId = data.id;
            console.log(`   Tenant ID: ${testTenantId}`);
            console.log(`   Name: ${data.name}`);
            console.log(`   Company Number: ${data.company_number}`);
            console.log(`   Tax ID: ${data.company_tax_id}`);
            console.log(`   Peppol IDs: ${JSON.stringify(data.peppol_ids)}`);
        });
        passed++;

        // 2. Create API key
        await step('2. Create API Key', async () => {
            const res = await fetch(`${BASE_URL}/api/admin/tenants/${testTenantId}/api-keys`, {
                method: 'POST',
                headers: orgHeaders,
                body: JSON.stringify({
                    name: `e2e-key-${Date.now()}`,
                    description: 'E2E test key — will be deleted',
                }),
            });
            const data = await res.json();
            assert(res.ok, `HTTP ${res.status}: ${JSON.stringify(data)}`, data);
            assert(data.id, 'API key ID missing from response', data);
            assert(data.id.startsWith('api-'), `Expected api-xxx format, got "${data.id}"`, data);

            testApiKeyId = data.id;

            // Log what fields ARE returned
            console.log(`   Key ID: ${data.id}`);
            console.log(`   Key field present: ${data.key !== undefined ? `YES (${data.key})` : 'NO (as expected)'}`);
            console.log(`   Tenant ID: ${data.tenant_id}`);
            console.log(`   → Using ID as bearer token: ${testApiKeyId}`);
        });
        passed++;

        // 3. Verify the API key ID works as a bearer token
        await step('3. Authenticate with Key ID as Bearer', async () => {
            const res = await fetch(`${BASE_URL}/api/me/`, {
                headers: tenantHeaders(testApiKeyId),
            });
            const data = await res.json();
            assert(res.ok, `HTTP ${res.status} — key ID does NOT work as bearer: ${JSON.stringify(data)}`, data);

            console.log(`   ✓ GET /api/me/ succeeded with key ID as bearer`);
            console.log(`   Tenant name: ${data.name || data.tenant_name || '(not in response)'}`);
            console.log(`   Full response:`, JSON.stringify(data, null, 2));
        });
        passed++;

        // ── PHASE 2: DOCUMENT OPERATIONS ───────────────────────

        const invoicePayload = {
            document_type: 'INVOICE',
            invoice_id: `E2E-${Date.now()}`,
            invoice_date: new Date().toISOString().split('T')[0],
            due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
            currency: 'EUR',

            vendor_name: TEST_COMPANY,
            vendor_tax_id: VENDOR_VAT,
            vendor_address: 'Teststraat 1, 1000 Brussel, Belgium',
            vendor_email: 'test@e2e-test.be',

            customer_name: 'E2E Customer NV',
            customer_tax_id: CUSTOMER_VAT,
            customer_address: 'Klantlaan 42, 2000 Antwerpen, Belgium',
            customer_email: 'klant@e2e-test.be',

            items: [
                {
                    description: 'E2E Test — Consulting diensten',
                    quantity: 5,
                    unit: 'HUR',
                    unit_price: 85.00,
                    amount: 425.00,
                    tax_rate: '21.00',
                },
                {
                    description: 'E2E Test — Materiaalkosten',
                    quantity: 1,
                    unit: 'C62',
                    unit_price: 150.00,
                    amount: 150.00,
                    tax_rate: '6.00',
                },
            ],

            payment_term: 'Betaling binnen 30 dagen',
            payment_details: [{
                iban: 'BE68539007547034',
                swift: 'GEBABEBB',
                payment_reference: `E2E-${Date.now()}`,
            }],
            note: 'Automated E2E test invoice — please disregard',
        };

        console.log(`\n   Invoice ID: ${invoicePayload.invoice_id}`);
        console.log(`   Subtotal: €${invoicePayload.items.reduce((s, i) => s + i.amount, 0).toFixed(2)}`);

        // 4. Validate invoice
        await step('4. Validate Invoice JSON', async () => {
            const res = await fetch(`${BASE_URL}/api/validate/json`, {
                method: 'POST',
                headers: tenantHeaders(testApiKeyId),
                body: JSON.stringify(invoicePayload),
            });
            const data = await res.json();
            assert(res.ok, `HTTP ${res.status}: ${JSON.stringify(data)}`, data);
            
            console.log(`   is_valid: ${data.is_valid}`);
            console.log(`   Issues: ${data.issues?.length || 0}`);
            if (data.issues?.length > 0) {
                data.issues.forEach((issue, i) => {
                    console.log(`     [${i}] ${issue.severity}: ${issue.message}`);
                });
            }
            console.log(`   UBL document generated: ${data.ubl_document ? 'YES (' + data.ubl_document.length + ' chars)' : 'NO'}`);

            assert(data.is_valid !== false, 'Invoice validation failed', data);
        });
        passed++;

        // 5. Create document
        await step('5. Create Document', async () => {
            const res = await fetch(`${BASE_URL}/api/documents/`, {
                method: 'POST',
                headers: tenantHeaders(testApiKeyId),
                body: JSON.stringify(invoicePayload),
            });
            const data = await res.json();
            assert(res.ok, `HTTP ${res.status}: ${JSON.stringify(data)}`, data);
            assert(data.id, 'Document ID missing from response', data);

            testDocumentId = data.id;
            console.log(`   Document ID: ${testDocumentId}`);
            console.log(`   State: ${data.state}`);
            console.log(`   Invoice ID: ${data.invoice_id}`);
            if (data.invoice_total !== undefined) console.log(`   Total: €${data.invoice_total}`);
            if (data.total_tax !== undefined) console.log(`   Tax: €${data.total_tax}`);
        });
        passed++;

        // 6. Check document status (pre-send)
        await step('6. Check Document Status (pre-send)', async () => {
            const res = await fetch(`${BASE_URL}/api/documents/${testDocumentId}`, {
                headers: tenantHeaders(testApiKeyId),
            });
            const data = await res.json();
            assert(res.ok, `HTTP ${res.status}: ${JSON.stringify(data)}`, data);
            assert(data.state === 'DRAFT', `Expected DRAFT state, got "${data.state}"`, data);

            console.log(`   State: ${data.state}`);
            console.log(`   Full doc:`, JSON.stringify(data, null, 2));
        });
        passed++;

        // 7. Send document
        await step('7. Send Document (test mode → email dispatch)', async () => {
            // Build send URL with explicit Peppol routing + test mode email
            const sendParams = new URLSearchParams({
                sender_peppol_scheme: '0208',
                sender_peppol_id: VENDOR_CBE,
                receiver_peppol_scheme: '0208',
                receiver_peppol_id: CUSTOMER_VAT.replace('BE', ''),
                email: 'test@e2e-test.be', // Required in test mode for UBL delivery
            });

            const res = await fetch(`${BASE_URL}/api/documents/${testDocumentId}/send?${sendParams}`, {
                method: 'POST',
                headers: tenantHeaders(testApiKeyId),
            });
            const data = await res.json();
            assert(res.ok, `HTTP ${res.status}: ${JSON.stringify(data)}`, data);

            console.log(`   State: ${data.state}`);
            console.log(`   Response:`, JSON.stringify(data, null, 2));
        });
        passed++;

        // 8. Check document status (post-send)
        await step('8. Check Document Status (post-send)', async () => {
            // Small delay to let the backend process
            await new Promise(r => setTimeout(r, 2000));

            const res = await fetch(`${BASE_URL}/api/documents/${testDocumentId}`, {
                headers: tenantHeaders(testApiKeyId),
            });
            const data = await res.json();
            assert(res.ok, `HTTP ${res.status}: ${JSON.stringify(data)}`, data);

            console.log(`   Final State: ${data.state}`);
            console.log(`   Expected: TRANSIT or SENT (test mode may vary)`);
            assert(
                data.state !== 'DRAFT',
                `Document still in DRAFT after send — state should have transitioned`,
                data
            );
        });
        passed++;

        // ── PHASE 3: PEPPOL REGISTRATION CHECK ─────────────────

        await step('9. Check Peppol Status', async () => {
            const res = await fetch(`${BASE_URL}/api/admin/tenants/${testTenantId}/peppol/status`, {
                headers: orgHeaders,
            });
            if (res.ok) {
                const data = await res.json();
                console.log(`   Registered: ${data.registered}`);
                console.log(`   Peppol ID: ${data.peppol_id || 'N/A'}`);
                console.log(`   Status: ${data.status || 'N/A'}`);
            } else {
                console.log(`   Status check returned ${res.status} (expected if not registered in test mode)`);
            }
        });
        passed++;

        // ── PHASE 4: LIST DOCUMENTS ────────────────────────────

        await step('10. List All Documents (bidirectional check)', async () => {
            const res = await fetch(`${BASE_URL}/api/outbox/?page=1&page_size=10`, {
                headers: tenantHeaders(testApiKeyId),
            });
            const data = await res.json();
            assert(res.ok, `HTTP ${res.status}: ${JSON.stringify(data)}`, data);

            const docs = data.items || [];
            console.log(`   Total documents: ${data.total || docs.length}`);
            console.log(`   Page: ${data.page}/${data.pages}`);
            if (Array.isArray(docs)) {
                docs.forEach((doc, i) => {
                    console.log(`   [${i}] ${doc.id} | ${doc.invoice_id} | state: ${doc.state}`);
                });
            }
        });
        passed++;

    } catch (err) {
        failed++;
        console.error(`\n💥 Pipeline failed at step. Continuing to cleanup...`);
    }

    // ── CLEANUP ────────────────────────────────────────────────
    if (testTenantId) {
        await step('CLEANUP: Delete Test Tenant', async () => {
            const res = await fetch(`${BASE_URL}/api/admin/tenants/${testTenantId}`, {
                method: 'DELETE',
                headers: orgHeaders,
            });
            if (res.ok || res.status === 204) {
                console.log(`   ✓ Tenant ${testTenantId} deleted`);
            } else {
                const data = await res.json().catch(() => ({}));
                console.log(`   ⚠ Delete returned ${res.status}: ${JSON.stringify(data)}`);
                console.log(`   (Non-critical — may require manual cleanup)`);
            }
        }).catch(() => {
            console.log(`   ⚠ Cleanup failed — tenant ${testTenantId} may need manual deletion`);
        });
    }

    // ── SUMMARY ────────────────────────────────────────────────
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  PEPPOL E2E TEST RESULTS`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`  ✅ Passed: ${passed}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  ⏱  Time: ${elapsed}s`);
    console.log(`  🏷  Tenant: ${testTenantId || 'N/A'}`);
    console.log(`  🔑 API Key: ${testApiKeyId || 'N/A'}`);
    console.log(`  📄 Document: ${testDocumentId || 'N/A'}`);
    console.log(`${'═'.repeat(60)}\n`);

    process.exit(failed > 0 ? 1 : 0);
}

run();

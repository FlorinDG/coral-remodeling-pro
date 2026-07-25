import { PrismaClient, GlobalPage } from '@prisma/client';

export interface DedupResult {
    status: 'duplicate' | 'possible' | 'none';
    matchedId?: string;
    matchedFields?: string[];
}

export interface ExtractedData {
    isInvoice: boolean;
    date?: string;
    documentNumber?: string;
    supplierName?: string;
    supplierVat?: string;
    amount?: number;
}

/**
 * Normalizes a string for comparison: trims and lowercase.
 */
function normalizeString(val?: string | null): string {
    if (!val) return '';
    return val.trim().toLowerCase();
}

/**
 * Checks if the extracted data is a duplicate of an existing record.
 */
export async function checkDuplicateExpense(
    prisma: PrismaClient,
    tenantId: string,
    targetDb: string,
    extracted: ExtractedData
): Promise<DedupResult> {
    const { isInvoice, date, documentNumber, supplierName, supplierVat, amount } = extracted;

    // We will query candidates from the database that match AT LEAST ONE of the key fields.
    const queryDate = date ? date.substring(0, 10) : '';
    const normNumber = normalizeString(documentNumber);
    const normSupplier = normalizeString(supplierName);
    const normVat = normalizeString(supplierVat);
    
    // If we have literally nothing to match on, it's not a duplicate.
    if (!queryDate && !normNumber && !normSupplier && !normVat && amount == null) {
        return { status: 'none' };
    }

    // Use raw query for efficient JSONB filtering across OR conditions
    let candidates: any[] = [];
    
    if (isInvoice) {
        // Invoices: match on date, number, supplierName, or supplierVat
        candidates = await prisma.$queryRaw`
            SELECT p.id, p.properties
            FROM "GlobalPage" p
            JOIN "GlobalDatabase" d ON p."databaseId" = d.id
            WHERE d."tenantId" = ${tenantId}
              AND p."databaseId" = ${targetDb}
              AND (
                (NULLIF(${queryDate}, '') IS NOT NULL AND p.properties->>'invoiceDate' = ${queryDate})
                OR (NULLIF(${normNumber}, '') IS NOT NULL AND LOWER(p.properties->>'invoiceNumber') = ${normNumber})
                OR (NULLIF(${normVat}, '') IS NOT NULL AND LOWER(p.properties->>'supplierVat') = ${normVat})
                OR (NULLIF(${normSupplier}, '') IS NOT NULL AND LOWER(p.properties->>'supplierName') = ${normSupplier})
              )
            LIMIT 50
        `;
    } else {
        // Tickets: match on date, amount, or merchant
        const amountStr = amount != null ? String(amount) : '';
        candidates = await prisma.$queryRaw`
            SELECT p.id, p.properties
            FROM "GlobalPage" p
            JOIN "GlobalDatabase" d ON p."databaseId" = d.id
            WHERE d."tenantId" = ${tenantId}
              AND p."databaseId" = ${targetDb}
              AND (
                (NULLIF(${queryDate}, '') IS NOT NULL AND p.properties->>'date' = ${queryDate})
                OR (NULLIF(${amountStr}, '') IS NOT NULL AND p.properties->>'amount' = ${amountStr})
                OR (NULLIF(${normSupplier}, '') IS NOT NULL AND LOWER(p.properties->>'merchant') = ${normSupplier})
              )
            LIMIT 50
        `;
    }

    if (candidates.length === 0) {
        return { status: 'none' };
    }

    // Now refine the logic in JS
    let bestMatch: DedupResult = { status: 'none' };

    for (const cand of candidates) {
        const props = typeof cand.properties === 'string' ? JSON.parse(cand.properties) : cand.properties;
        const matchedFields: string[] = [];
        
        let isDateMatch = false;
        let isNumberMatch = false;
        let isSupplierMatch = false;
        let isAmountMatch = false;

        if (isInvoice) {
            const candDate = props.invoiceDate ? String(props.invoiceDate).substring(0, 10) : '';
            if (queryDate && candDate === queryDate) {
                isDateMatch = true;
                matchedFields.push('date');
            }
            
            const candNumber = normalizeString(props.invoiceNumber);
            if (normNumber && candNumber === normNumber) {
                isNumberMatch = true;
                matchedFields.push('document number');
            }
            
            const candVat = normalizeString(props.supplierVat);
            const candSupplier = normalizeString(props.supplierName);
            
            if (normVat && candVat === normVat) {
                isSupplierMatch = true;
                matchedFields.push('supplier (VAT)');
            } else if (!normVat && normSupplier && candSupplier === normSupplier) {
                isSupplierMatch = true;
                matchedFields.push('supplier (Name)');
            } else if (normVat && candSupplier === normSupplier) {
                // If VAT didn't match but name did, we still consider it a supplier match if VAT is missing on one side.
                // But rule says: prefer VAT when present. If VAT differs, it's not the same supplier.
                if (!candVat) {
                    isSupplierMatch = true;
                    matchedFields.push('supplier (Name)');
                }
            }

            if (isDateMatch && isNumberMatch && isSupplierMatch) {
                return { status: 'duplicate', matchedId: cand.id, matchedFields };
            }
            
            if (matchedFields.length > 0) {
                bestMatch = { status: 'possible', matchedId: cand.id, matchedFields };
            }
            
        } else {
            // Tickets
            const candDate = props.date ? String(props.date).substring(0, 10) : '';
            if (queryDate && candDate === queryDate) {
                isDateMatch = true;
                matchedFields.push('date');
            }
            
            const candAmount = props.amount != null ? Number(props.amount) : null;
            if (amount != null && candAmount === amount) {
                isAmountMatch = true;
                matchedFields.push('amount');
            }
            
            const candMerchant = normalizeString(props.merchant);
            if (normSupplier && candMerchant === normSupplier) {
                isSupplierMatch = true;
                matchedFields.push('merchant');
            }

            if (isDateMatch && isAmountMatch && isSupplierMatch) {
                return { status: 'duplicate', matchedId: cand.id, matchedFields };
            }
            
            if (matchedFields.length > 0) {
                bestMatch = { status: 'possible', matchedId: cand.id, matchedFields };
            }
        }
    }

    return bestMatch;
}

/**
 * Calculates due date (YYYY-MM-DD) from an invoice date string and payment method (e.g. 'pay-30', 'pay-14').
 * Fallback defaults to 30 days if no method is supplied or method is unrecognized.
 */
export function calculateDueDate(
    invoiceDateStr: string,
    paymentMethod?: string | null,
    defaultDays: number = 30
): string {
    if (!invoiceDateStr) return '';
    let days = defaultDays;
    if (paymentMethod && typeof paymentMethod === 'string' && paymentMethod.startsWith('pay-')) {
        const parsed = parseInt(paymentMethod.split('-')[1], 10);
        if (!isNaN(parsed)) days = parsed;
    }
    const base = new Date(invoiceDateStr);
    if (isNaN(base.getTime())) return '';
    base.setDate(base.getDate() + days);
    return base.toISOString().split('T')[0];
}

/**
 * SP-2: Ensures an invoice has an invoiceDate (stamping today if missing) and a dueDate
 * (computed via payment terms if missing) upon successful send.
 * User-chosen dates are strictly preserved and never overwritten.
 */
export function resolveInvoiceDatesOnSend(
    currentProps: Record<string, any>,
    defaultPaymentTermDays?: number | null
): {
    invoiceDate: string;
    dueDate?: string;
    updates: Record<string, any>;
} {
    const today = new Date().toISOString().split('T')[0];
    const existingInvoiceDate = currentProps.invoiceDate || currentProps.date;
    const finalInvoiceDate = existingInvoiceDate ? String(existingInvoiceDate).split('T')[0] : today;

    const existingDueDate = currentProps.dueDate || currentProps.vervaldatum;
    const paymentMethod = currentProps['prop-payment-method'] || currentProps.paymentMethod;
    const fallbackDays = defaultPaymentTermDays && defaultPaymentTermDays > 0 ? defaultPaymentTermDays : 30;

    const updates: Record<string, any> = {};

    if (!existingInvoiceDate) {
        updates.invoiceDate = finalInvoiceDate;
    }

    if (!existingDueDate) {
        const computedDueDate = calculateDueDate(finalInvoiceDate, paymentMethod, fallbackDays);
        if (computedDueDate) {
            updates.dueDate = computedDueDate;
        }
    }

    return {
        invoiceDate: finalInvoiceDate,
        dueDate: existingDueDate ? String(existingDueDate).split('T')[0] : updates.dueDate,
        updates,
    };
}

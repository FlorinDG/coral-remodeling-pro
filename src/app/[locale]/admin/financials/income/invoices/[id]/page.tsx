import ClientInvoiceEngine from '@/components/admin/invoices/ClientInvoiceEngine';

export default async function InvoiceEditorPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
    const { id, locale } = await params;
    return <ClientInvoiceEngine id={id} locale={locale} />;
}

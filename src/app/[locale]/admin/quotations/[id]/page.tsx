import ClientQuotationEngine from '@/components/admin/quotations/ClientQuotationEngine';

export default async function QuotationEditorPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
    const { id, locale } = await params;
    return <ClientQuotationEngine id={id} locale={locale} />;
}

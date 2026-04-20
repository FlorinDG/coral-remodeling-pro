import RecordDetailPage from '@/components/admin/database/components/RecordDetailPage';

interface Props {
    params: Promise<{ locale: string; databaseId: string; pageId: string }>;
}

export default async function DatabaseRecordPage({ params }: Props) {
    const { locale, databaseId, pageId } = await params;
    return <RecordDetailPage databaseId={databaseId} pageId={pageId} locale={locale} />;
}

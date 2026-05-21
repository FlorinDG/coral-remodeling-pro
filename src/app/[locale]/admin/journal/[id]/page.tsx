import JournalEntryClient from './JournalEntryClient';

interface Props {
    params: Promise<{ locale: string; id: string }>;
}

export default async function JournalEntryPage({ params }: Props) {
    const { locale, id } = await params;
    return <JournalEntryClient entryId={id} locale={locale} />;
}

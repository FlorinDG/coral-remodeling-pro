"use client";
/**
 * The werkbon's own print page (a deep link). The document is ONE component (WerkbonDocument) — the timesheet opens
 * it in a viewer (WERKBON-VIEW-1); this page shows the same document with a toolbar.
 */
import React from 'react';
import { useParams } from 'next/navigation';
import { Loader2, ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { useWerkbon, WerkbonDocument, WERKBON_PRINT_CSS } from '@/components/time-tracker/components/werkbon/WerkbonDocument';

export default function WerkbonDetailPage() {
    const params = useParams();
    const { data, loading } = useWerkbon(params.id as string);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-neutral-100 dark:bg-black">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                <p className="text-sm text-neutral-500 mt-4">Werkbon genereren...</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex flex-col items-center justify-center h-screen">
                <p>Werkbon niet gevonden.</p>
                <Link href="/admin/hr/timesheets">
                    <Button variant="link">Terug naar overzicht</Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950 p-4 md:p-8 flex flex-col items-center">
            <style>{WERKBON_PRINT_CSS}</style>
            <div className="w-full max-w-[210mm] mb-6 flex items-center justify-between no-print">
                <Link href="/admin/hr/timesheets">
                    <Button variant="ghost" size="sm" className="gap-2">
                        <ArrowLeft className="w-4 h-4" /> Terug
                    </Button>
                </Link>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
                    <Printer className="w-4 h-4" /> Print / PDF
                </Button>
            </div>
            <WerkbonDocument data={data} />
        </div>
    );
}

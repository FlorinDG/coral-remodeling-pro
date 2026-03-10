"use client";

import dynamic from 'next/dynamic';

// Next.js dynamic import is used alongside the isClient check inside the component
// to ensure no hydration mismatch or window undefined errors occur.
const ExcelCloneDynamic = dynamic(
    () => import('@/components/admin/spreadsheet/ExcelClone'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Spreadsheet Environment...</div> }
);

export default function SpreadsheetPage() {
    return (
        <div className="w-full h-full pb-10">
            <ExcelCloneDynamic />
        </div>
    );
}

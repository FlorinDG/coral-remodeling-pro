"use client";

import dynamic from 'next/dynamic';

const CalendarModuleDynamic = dynamic(
    () => import('@/components/admin/calendar/CalendarModule'),
    { ssr: false, loading: () => <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-neutral-500">Preparing Calendar Environment...</div> }
);

export default function CalendarPage() {
    return (
        <div className="w-full h-full pb-10">
            <CalendarModuleDynamic />
        </div>
    );
}
